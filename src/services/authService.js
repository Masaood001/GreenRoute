import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

/**
 * Register a new user with email and password.
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export async function signUpUser(email, password, displayName = "") {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, { displayName });
  }
  return userCredential;
}

/**
 * Sign in an existing user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export async function signInUser(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the currently authenticated user.
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  return await signOut(auth);
}

/**
 * Subscribe to authentication state changes.
 * @param {(user: import("firebase/auth").User | null) => void} callback
 * @returns {import("firebase/auth").Unsubscribe}
 */
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the currently logged-in user synchronously.
 * @returns {import("firebase/auth").User | null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Checks whether the current user holds administrator privileges.
 * NOTE: This client-side check is strictly for UI rendering convenience (e.g. toggling buttons).
 * Actual data security is strictly enforced by Firestore Security Rules.
 *
 * @returns {Promise<boolean>}
 */
export async function checkCurrentUserAdmin() {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    // 1. Check custom claims token
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims && tokenResult.claims.admin === true) {
      return true;
    }

    // 2. Check existence in the admins collection (isOwner rule allows reading own admin record)
    const adminDocRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminDocRef);
    return adminSnap.exists();
  } catch (error) {
    console.warn("[GreenRoute Auth] Admin privilege check error:", error.message);
    return false;
  }
}

/**
 * Send password reset email.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function sendPasswordReset(email) {
  return await sendPasswordResetEmail(auth, email);
}
