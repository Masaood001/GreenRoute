import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase.js";

const COLLECTION_NAME = "campus_conditions";

export const ALLOWED_CONDITION_TYPES = [
  "blocked_path",
  "construction",
  "hazard",
  "maintenance",
  "event",
  "other",
];

export const ALLOWED_SEVERITIES = ["low", "medium", "high", "critical"];

export const ALLOWED_STATUSES = ["active", "scheduled", "resolved"];

/**
 * Validates campus condition payload before submitting to Firestore.
 * @param {object} data
 */
export function validateCampusCondition(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Condition data must be an object");
  }
  if (!data.title || typeof data.title !== "string" || data.title.trim().length === 0) {
    throw new Error("Condition title is required (non-empty string)");
  }
  if (data.title.length > 150) {
    throw new Error("Condition title must not exceed 150 characters");
  }
  if (!ALLOWED_CONDITION_TYPES.includes(data.type)) {
    throw new Error(
      `Invalid condition type "${data.type}". Must be one of: ${ALLOWED_CONDITION_TYPES.join(", ")}`
    );
  }
  if (!ALLOWED_SEVERITIES.includes(data.severity)) {
    throw new Error(
      `Invalid severity "${data.severity}". Must be one of: ${ALLOWED_SEVERITIES.join(", ")}`
    );
  }
  if (data.status && !ALLOWED_STATUSES.includes(data.status)) {
    throw new Error(
      `Invalid status "${data.status}". Must be one of: ${ALLOWED_STATUSES.join(", ")}`
    );
  }
  if (!data.location || typeof data.location !== "object") {
    throw new Error("Condition location must be an object with coordinates or area information");
  }
}

/**
 * Fetch all campus conditions matching optional filter.
 * @param {object} [options]
 * @param {string} [options.status] e.g. 'active'
 * @param {string} [options.type] e.g. 'hazard'
 * @returns {Promise<Array<object>>}
 */
export async function getCampusConditions(options = {}) {
  const colRef = collection(db, COLLECTION_NAME);
  const constraints = [];

  if (options.status) {
    constraints.push(where("status", "==", options.status));
  }
  if (options.type) {
    constraints.push(where("type", "==", options.type));
  }

  const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Subscribe to real-time updates for campus conditions.
 * @param {(conditions: Array<object>) => void} callback
 * @param {object} [options]
 * @param {string} [options.status] Filter by status (e.g. 'active')
 * @returns {import("firebase/firestore").Unsubscribe}
 */
export function subscribeCampusConditions(callback, options = {}) {
  const colRef = collection(db, COLLECTION_NAME);
  const constraints = [];

  if (options.status) {
    constraints.push(where("status", "==", options.status));
  }

  const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;

  return onSnapshot(
    q,
    (snapshot) => {
      const conditions = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(conditions);
    },
    (error) => {
      console.error("[CampusConditions] Subscription error:", error);
    }
  );
}

/**
 * Get a single campus condition by ID.
 * @param {string} conditionId
 * @returns {Promise<object|null>}
 */
export async function getCampusConditionById(conditionId) {
  if (!conditionId) throw new Error("Condition ID is required");
  const docRef = doc(db, COLLECTION_NAME, conditionId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Add a new campus condition (admin or owner authenticated).
 * @param {object} conditionData
 * @returns {Promise<string>} The created document ID
 */
export async function addCampusCondition(conditionData) {
  validateCampusCondition(conditionData);

  const currentUser = auth.currentUser;
  const isAuth = Boolean(currentUser);
  const uidExists = Boolean(currentUser?.uid);

  const reportedBy = currentUser ? currentUser.uid : null;

  const payload = {
    title: conditionData.title.trim(),
    description: conditionData.description || "",
    type: conditionData.type,
    severity: conditionData.severity,
    status: conditionData.status || "active",
    location: conditionData.location,
    startLocation: conditionData.startLocation || null,
    endLocation: conditionData.endLocation || null,
    affectedPathIds: conditionData.affectedPathIds || [],
    startTime: conditionData.startTime || new Date().toISOString(),
    endTime: conditionData.endTime || null,
    reportedBy,
    isSimulated: conditionData.isSimulated ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  validateCampusCondition(payload);

  console.log("[CampusConditions Diagnostics]", {
    authAppMatches: auth.app.options.projectId,
    isUserAuthenticated: isAuth,
    hasUid: uidExists,
    reportedByMatchesAuthUid: currentUser ? (reportedBy === currentUser.uid) : false,
    payloadReportedBy: reportedBy ? `${reportedBy.substring(0, 4)}...` : null,
    payloadKeys: Object.keys(payload),
    locationIsObject: typeof payload.location === "object" && payload.location !== null,
    locationLat: payload.location?.latitude,
    locationLng: payload.location?.longitude,
  });

  const colRef = collection(db, COLLECTION_NAME);
  try {
    const docRef = await addDoc(colRef, payload);
    console.log("[CampusConditions Diagnostics] Write success! Doc ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("[CampusConditions Diagnostics] Write failed!", {
      code: err.code,
      name: err.name,
      message: err.message,
    });
    throw err;
  }
}

/**
 * Update an existing campus condition (owner or admin authorized).
 * @param {string} conditionId
 * @param {object} updates
 * @returns {Promise<void>}
 */
export async function updateCampusCondition(conditionId, updates) {
  if (!conditionId) throw new Error("Condition ID is required");

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required: You must be signed in to update or resolve a condition.");
  }

  const docRef = doc(db, COLLECTION_NAME, conditionId);
  const payload = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(docRef, payload);
}

/**
 * Mark a campus condition as resolved (owner or admin authorized).
 * @param {string} conditionId
 * @returns {Promise<void>}
 */
export async function resolveCampusCondition(conditionId) {
  return await updateCampusCondition(conditionId, {
    status: "resolved",
  });
}

/**
 * Delete a campus condition (owner or admin authorized).
 * @param {string} conditionId
 * @returns {Promise<void>}
 */
export async function deleteCampusCondition(conditionId) {
  if (!conditionId) throw new Error("Condition ID is required");

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required: You must be signed in to delete a condition.");
  }

  const docRef = doc(db, COLLECTION_NAME, conditionId);
  await deleteDoc(docRef);
}
