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

const COLLECTION_NAME = "routes";

/**
 * Validates a route object against the requirements in firestore.rules (isValidRoute).
 * @param {object} data
 * @param {string} userId
 */
export function validateRoutePayload(data, userId) {
  if (!data || typeof data !== "object") {
    throw new Error("Route payload must be an object");
  }
  if (!userId || typeof userId !== "string") {
    throw new Error("Valid userId string is required");
  }
  if (data.userId && data.userId !== userId) {
    throw new Error("userId in route payload does not match authenticated user UID");
  }
  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    throw new Error("Route name is required (non-empty string)");
  }
  if (data.name.length > 100) {
    throw new Error("Route name must not exceed 100 characters");
  }

  // Validate origin
  if (!data.origin || typeof data.origin !== "object") {
    throw new Error("origin map is required");
  }
  if (
    typeof data.origin.latitude !== "number" ||
    isNaN(data.origin.latitude) ||
    typeof data.origin.longitude !== "number" ||
    isNaN(data.origin.longitude)
  ) {
    throw new Error("origin must contain valid numeric latitude and longitude coordinates");
  }

  // Validate destination
  if (!data.destination || typeof data.destination !== "object") {
    throw new Error("destination map is required");
  }
  if (
    typeof data.destination.latitude !== "number" ||
    isNaN(data.destination.latitude) ||
    typeof data.destination.longitude !== "number" ||
    isNaN(data.destination.longitude)
  ) {
    throw new Error("destination must contain valid numeric latitude and longitude coordinates");
  }

  // Optional waypoints validation
  if (data.waypoints !== undefined && !Array.isArray(data.waypoints)) {
    throw new Error("waypoints must be an array of coordinate objects");
  }

  // Optional isFavorite validation
  if (data.isFavorite !== undefined && typeof data.isFavorite !== "boolean") {
    throw new Error("isFavorite must be a boolean");
  }
}

/**
 * Save a new route computed by the routing module.
 * @param {string} userId
 * @param {object} routeData
 * @returns {Promise<string>} Created route document ID
 */
export async function saveRoute(userId, routeData) {
  if (!userId) throw new Error("userId is required to save route");

  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid !== userId) {
    throw new Error("Cannot save a route under another user's UID");
  }

  const payload = {
    userId,
    name: routeData.name.trim(),
    origin: {
      latitude: Number(routeData.origin.latitude),
      longitude: Number(routeData.origin.longitude),
      name: routeData.origin.name || "Origin",
    },
    destination: {
      latitude: Number(routeData.destination.latitude),
      longitude: Number(routeData.destination.longitude),
      name: routeData.destination.name || "Destination",
    },
    waypoints: Array.isArray(routeData.waypoints) ? routeData.waypoints : [],
    routeMetadata: routeData.routeMetadata || {},
    isFavorite: Boolean(routeData.isFavorite),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  validateRoutePayload(payload, userId);

  const colRef = collection(db, COLLECTION_NAME);
  const docRef = await addDoc(colRef, payload);
  return docRef.id;
}

/**
 * Fetch all saved routes for a given authenticated user.
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
export async function getUserSavedRoutes(userId) {
  if (!userId) throw new Error("userId is required to fetch routes");

  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid !== userId) {
    throw new Error("Cannot query routes of another user");
  }

  const colRef = collection(db, COLLECTION_NAME);
  const q = query(colRef, where("userId", "==", userId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Get a specific route by ID.
 * @param {string} routeId
 * @returns {Promise<object|null>}
 */
export async function getRouteById(routeId) {
  if (!routeId) throw new Error("routeId is required");
  const docRef = doc(db, COLLECTION_NAME, routeId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Update a saved route. Prevents transferring ownership to another user.
 * @param {string} routeId
 * @param {string} userId
 * @param {object} updates
 * @returns {Promise<void>}
 */
export async function updateRoute(routeId, userId, updates) {
  if (!routeId) throw new Error("routeId is required");
  if (!userId) throw new Error("userId is required");

  // Prevent modifying ownership
  if (updates.userId && updates.userId !== userId) {
    throw new Error("Forbidden: Cannot reassign route ownership");
  }

  const payload = {
    ...updates,
    userId, // Ensure userId remains immutable
    updatedAt: serverTimestamp(),
  };

  const docRef = doc(db, COLLECTION_NAME, routeId);
  await updateDoc(docRef, payload);
}

/**
 * Toggle favorite status of a saved route.
 * @param {string} routeId
 * @param {string} userId
 * @param {boolean} isFavorite
 * @returns {Promise<void>}
 */
export async function toggleFavoriteRoute(routeId, userId, isFavorite) {
  return await updateRoute(routeId, userId, {
    isFavorite: Boolean(isFavorite),
  });
}

/**
 * Delete a saved route (owner-only).
 * @param {string} routeId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function deleteRoute(routeId, userId) {
  if (!routeId) throw new Error("routeId is required");
  if (!userId) throw new Error("userId is required");

  const docRef = doc(db, COLLECTION_NAME, routeId);
  await deleteDoc(docRef);
}

/**
 * Subscribe to real-time changes in a user's saved routes.
 * @param {string} userId
 * @param {(routes: Array<object>) => void} callback
 * @returns {import("firebase/firestore").Unsubscribe}
 */
export function subscribeUserRoutes(userId, callback) {
  if (!userId) throw new Error("userId is required");

  const colRef = collection(db, COLLECTION_NAME);
  const q = query(colRef, where("userId", "==", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const routes = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(routes);
    },
    (error) => {
      console.error("[RoutesService] Subscription error:", error);
    }
  );
}
