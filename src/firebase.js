import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Universal environment helper supporting both Vite (import.meta.env) and Node.js (process.env)
const env =
  (typeof import.meta !== "undefined" && import.meta.env) ||
  (typeof process !== "undefined" && process.env) ||
  {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "greenroute-57125.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "greenroute-57125",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "greenroute-57125.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

/**
 * Checks whether Firebase configuration has valid values instead of placeholders.
 * @returns {{ isConfigured: boolean, missingKeys: string[] }}
 */
export function getFirebaseConfigStatus() {
  const missingKeys = [];
  const requiredKeys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
  ];

  for (const key of requiredKeys) {
    const val = env[key];
    if (!val || val.includes("YOUR_")) {
      missingKeys.push(key);
    }
  }

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
  };
}

const status = getFirebaseConfigStatus();
const isDev =
  (typeof import.meta !== "undefined" && import.meta.env?.DEV) ||
  (typeof process !== "undefined" && process.env?.NODE_ENV !== "production");

if (!status.isConfigured && isDev) {
  console.warn(
    "[GreenRoute Firebase] Configuration is incomplete or uses placeholders. Missing/placeholder keys:",
    status.missingKeys.join(", "),
    "\nPlease update .env.local with credentials from Firebase Console."
  );
}

// Initialize or retrieve Firebase App safely (singleton pattern)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Authentication & Cloud Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
