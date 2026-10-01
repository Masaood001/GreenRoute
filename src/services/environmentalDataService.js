import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase.js";

const COLLECTION_NAME = "environmental_data";

/**
 * Validates environmental data payload before submitting to Firestore.
 * @param {object} data
 */
export function validateEnvironmentalData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Environmental data must be an object");
  }
  if (!data.zoneId || typeof data.zoneId !== "string" || data.zoneId.trim().length === 0) {
    throw new Error("zoneId is required (non-empty string)");
  }
  if (data.zoneId.length > 100) {
    throw new Error("zoneId must not exceed 100 characters");
  }

  // Air Quality validation
  if (!data.airQuality || typeof data.airQuality !== "object") {
    throw new Error("airQuality object is required");
  }
  if (
    typeof data.airQuality.aqi !== "number" ||
    isNaN(data.airQuality.aqi) ||
    data.airQuality.aqi < 0 ||
    data.airQuality.aqi > 500
  ) {
    throw new Error("airQuality.aqi must be a number between 0 and 500");
  }

  // Temperature validation
  if (!data.temperature || typeof data.temperature !== "object") {
    throw new Error("temperature object is required");
  }
  if (typeof data.temperature.celsius !== "number" || isNaN(data.temperature.celsius)) {
    throw new Error("temperature.celsius must be a valid number");
  }

  // Shade validation (0 to 100 score)
  if (!data.shade || typeof data.shade !== "object") {
    throw new Error("shade object is required");
  }
  if (
    typeof data.shade.score !== "number" ||
    isNaN(data.shade.score) ||
    data.shade.score < 0 ||
    data.shade.score > 100
  ) {
    throw new Error("shade.score must be a number between 0 and 100");
  }

  // Greenery validation (0 to 100 score)
  if (!data.greenery || typeof data.greenery !== "object") {
    throw new Error("greenery object is required");
  }
  if (
    typeof data.greenery.score !== "number" ||
    isNaN(data.greenery.score) ||
    data.greenery.score < 0 ||
    data.greenery.score > 100
  ) {
    throw new Error("greenery.score must be a number between 0 and 100");
  }

  // Source & simulation flag
  if (!data.source || typeof data.source !== "string") {
    throw new Error("source string is required");
  }
  if (typeof data.isSimulated !== "boolean") {
    throw new Error("isSimulated must be an explicit boolean");
  }

  // Location validation
  if (
    data.location &&
    (typeof data.location.latitude !== "number" || typeof data.location.longitude !== "number")
  ) {
    throw new Error("location must contain numeric latitude and longitude coordinates");
  }
}

/**
 * Fetch the latest environmental reading for a specific campus zone.
 * @param {string} zoneId
 * @returns {Promise<object|null>}
 */
export async function getLatestEnvironmentalData(zoneId) {
  if (!zoneId) throw new Error("zoneId is required");

  const colRef = collection(db, COLLECTION_NAME);
  const q = query(
    colRef,
    where("zoneId", "==", zoneId),
    orderBy("timestamp", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Fetch all available environmental data records.
 * @returns {Promise<Array<object>>}
 */
export async function getAllCurrentEnvironmentalData() {
  const colRef = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(colRef);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Subscribe to real-time updates for environmental readings.
 * @param {(data: Array<object>) => void} callback
 * @param {string} [zoneId] Optional zone filter
 * @returns {import("firebase/firestore").Unsubscribe}
 */
export function subscribeEnvironmentalData(callback, zoneId = null) {
  const colRef = collection(db, COLLECTION_NAME);
  const q = zoneId ? query(colRef, where("zoneId", "==", zoneId)) : colRef;

  return onSnapshot(
    q,
    (snapshot) => {
      const readings = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(readings);
    },
    (error) => {
      console.error("[EnvironmentalData] Subscription error:", error);
    }
  );
}

/**
 * Record a new environmental measurement (admin-only operation).
 * @param {object} data
 * @returns {Promise<string>} Created document ID
 */
export async function recordEnvironmentalData(data) {
  validateEnvironmentalData(data);

  const payload = {
    zoneId: data.zoneId,
    zoneName: data.zoneName || data.zoneId,
    airQuality: {
      aqi: Number(data.airQuality.aqi),
      category: data.airQuality.category || "Unspecified",
      pm25: data.airQuality.pm25 !== undefined ? Number(data.airQuality.pm25) : null,
      pm10: data.airQuality.pm10 !== undefined ? Number(data.airQuality.pm10) : null,
    },
    temperature: {
      celsius: Number(data.temperature.celsius),
      humidity: data.temperature.humidity !== undefined ? Number(data.temperature.humidity) : null,
      feelsLike: data.temperature.feelsLike !== undefined ? Number(data.temperature.feelsLike) : null,
    },
    shade: {
      score: Number(data.shade.score),
      level: data.shade.level || "unspecified",
    },
    greenery: {
      score: Number(data.greenery.score),
      description: data.greenery.description || "",
    },
    location: data.location || null,
    source: data.source,
    isSimulated: Boolean(data.isSimulated),
    disclaimer: data.disclaimer || (data.isSimulated ? "SIMULATED DATA FOR DEVELOPMENT ONLY - NOT REAL SENSOR MEASUREMENTS" : null),
    timestamp: data.timestamp || new Date().toISOString(),
    createdAt: serverTimestamp(),
  };

  const colRef = collection(db, COLLECTION_NAME);
  const docRef = await addDoc(colRef, payload);
  return docRef.id;
}

/**
 * Fetch historical readings for a campus zone.
 * @param {string} zoneId
 * @param {number} [limitCount=20]
 * @returns {Promise<Array<object>>}
 */
export async function getEnvironmentalHistory(zoneId, limitCount = 20) {
  if (!zoneId) throw new Error("zoneId is required");

  const colRef = collection(db, COLLECTION_NAME);
  const q = query(
    colRef,
    where("zoneId", "==", zoneId),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Get a single environmental reading by ID.
 * @param {string} dataId
 * @returns {Promise<object|null>}
 */
export async function getEnvironmentalDataById(dataId) {
  if (!dataId) throw new Error("dataId is required");
  const docRef = doc(db, COLLECTION_NAME, dataId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
