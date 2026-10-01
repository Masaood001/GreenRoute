import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase.js";

const COLLECTION_NAME = "user_preferences";

export const ALLOWED_ROUTE_TYPES = [
  "quickest",
  "greenest",
  "shadiest",
  "cleanest_air",
  "balanced",
];

export const ALLOWED_WALKING_SPEEDS = ["slow", "normal", "fast"];

export const ALLOWED_PREFERENCE_KEYS = [
  "userId",
  "preferredRouteType",
  "avoidHazards",
  "avoidStairs",
  "wheelchairAccessible",
  "minimumShadePreference",
  "maxAirQualityIndex",
  "walkingSpeed",
  "notificationAlerts",
  "updatedAt",
];

export const DEFAULT_USER_PREFERENCES = {
  preferredRouteType: "greenest",
  avoidHazards: true,
  avoidStairs: false,
  wheelchairAccessible: false,
  minimumShadePreference: 50,
  maxAirQualityIndex: 100,
  walkingSpeed: "normal",
  notificationAlerts: true,
};

/**
 * Validates a user preferences object against strict schema constraints.
 * Throws an Error if validation fails.
 *
 * @param {object} data
 * @param {string} userId
 */
export function validateUserPreferences(data, userId) {
  if (!data || typeof data !== "object") {
    throw new Error("Preferences data must be an object");
  }
  if (!userId || typeof userId !== "string") {
    throw new Error("Valid userId string is required");
  }
  if (data.userId && data.userId !== userId) {
    throw new Error("userId in payload does not match target document userId");
  }

  // Prevent unexpected / extraneous fields
  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    if (!ALLOWED_PREFERENCE_KEYS.includes(key)) {
      throw new Error(`Unexpected field "${key}" in user preferences`);
    }
  }

  // Validate route type enum
  if (
    data.preferredRouteType !== undefined &&
    !ALLOWED_ROUTE_TYPES.includes(data.preferredRouteType)
  ) {
    throw new Error(
      `Invalid preferredRouteType "${data.preferredRouteType}". Allowed: ${ALLOWED_ROUTE_TYPES.join(", ")}`
    );
  }

  // Validate booleans
  const booleanFields = [
    "avoidHazards",
    "avoidStairs",
    "wheelchairAccessible",
    "notificationAlerts",
  ];
  for (const field of booleanFields) {
    if (data[field] !== undefined && typeof data[field] !== "boolean") {
      throw new Error(`Field "${field}" must be a boolean`);
    }
  }

  // Validate shade preference (0 to 100)
  if (data.minimumShadePreference !== undefined) {
    if (
      typeof data.minimumShadePreference !== "number" ||
      isNaN(data.minimumShadePreference) ||
      data.minimumShadePreference < 0 ||
      data.minimumShadePreference > 100
    ) {
      throw new Error("minimumShadePreference must be a number between 0 and 100");
    }
  }

  // Validate max air quality index (0 to 500)
  if (data.maxAirQualityIndex !== undefined) {
    if (
      typeof data.maxAirQualityIndex !== "number" ||
      isNaN(data.maxAirQualityIndex) ||
      data.maxAirQualityIndex < 0 ||
      data.maxAirQualityIndex > 500
    ) {
      throw new Error("maxAirQualityIndex must be a number between 0 and 500");
    }
  }

  // Validate walking speed enum
  if (
    data.walkingSpeed !== undefined &&
    !ALLOWED_WALKING_SPEEDS.includes(data.walkingSpeed)
  ) {
    throw new Error(
      `Invalid walkingSpeed "${data.walkingSpeed}". Allowed: ${ALLOWED_WALKING_SPEEDS.join(", ")}`
    );
  }
}

/**
 * Fetch preferences for a given user.
 * Returns default preferences merged with stored preferences if available.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getUserPreferences(userId) {
  if (!userId) throw new Error("userId is required to get preferences");

  const docRef = doc(db, COLLECTION_NAME, userId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return {
      userId,
      ...DEFAULT_USER_PREFERENCES,
      isDefault: true,
    };
  }

  return {
    userId,
    ...DEFAULT_USER_PREFERENCES,
    ...snap.data(),
    isDefault: false,
  };
}

/**
 * Save or update user preferences with strict validation.
 *
 * @param {string} userId
 * @param {object} preferences
 * @returns {Promise<void>}
 */
export async function saveUserPreferences(userId, preferences) {
  if (!userId) throw new Error("userId is required to save preferences");

  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid !== userId) {
    throw new Error("Cannot save preferences for another user");
  }

  const payload = {
    userId,
    preferredRouteType: preferences.preferredRouteType ?? DEFAULT_USER_PREFERENCES.preferredRouteType,
    avoidHazards: preferences.avoidHazards ?? DEFAULT_USER_PREFERENCES.avoidHazards,
    avoidStairs: preferences.avoidStairs ?? DEFAULT_USER_PREFERENCES.avoidStairs,
    wheelchairAccessible: preferences.wheelchairAccessible ?? DEFAULT_USER_PREFERENCES.wheelchairAccessible,
    minimumShadePreference: Number(preferences.minimumShadePreference ?? DEFAULT_USER_PREFERENCES.minimumShadePreference),
    maxAirQualityIndex: Number(preferences.maxAirQualityIndex ?? DEFAULT_USER_PREFERENCES.maxAirQualityIndex),
    walkingSpeed: preferences.walkingSpeed ?? DEFAULT_USER_PREFERENCES.walkingSpeed,
    notificationAlerts: preferences.notificationAlerts ?? DEFAULT_USER_PREFERENCES.notificationAlerts,
    updatedAt: serverTimestamp(),
  };

  validateUserPreferences(payload, userId);

  const docRef = doc(db, COLLECTION_NAME, userId);
  await setDoc(docRef, payload, { merge: true });
}

/**
 * Subscribe to real-time changes in a user's route preferences.
 *
 * @param {string} userId
 * @param {(preferences: object) => void} callback
 * @returns {import("firebase/firestore").Unsubscribe}
 */
export function subscribeUserPreferences(userId, callback) {
  if (!userId) throw new Error("userId is required to subscribe to preferences");

  const docRef = doc(db, COLLECTION_NAME, userId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        callback({
          userId,
          ...DEFAULT_USER_PREFERENCES,
          isDefault: true,
        });
      } else {
        callback({
          userId,
          ...DEFAULT_USER_PREFERENCES,
          ...snap.data(),
          isDefault: false,
        });
      }
    },
    (error) => {
      console.error("[UserPreferences] Subscription error:", error);
    }
  );
}
