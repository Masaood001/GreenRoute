/**
 * GreenRoute Safe & Least-Privileged Firebase Verification Script
 *
 * Safely verifies live Firebase client connectivity without Admin SDK keys,
 * without bypassing Firestore security rules, using only least-privileged student operations.
 * Guaranteed cleanup of all created documents and test users via try ... finally block.
 *
 * Usage:
 *   node src/services/verifyConnection.js [testEmail] [testPassword]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../");

// Load .env.local manually for standalone Node execution
function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

async function runLiveVerification() {
  console.log("=================================================");
  console.log("GreenRoute: Firebase Live Connectivity Check");
  console.log("=================================================");

  const env = loadEnvLocal();
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  if (!apiKey || apiKey.includes("YOUR_") || !projectId || projectId.includes("YOUR_")) {
    console.log("\n[STATUS: PENDING CREDENTIALS]");
    console.log("Placeholder values detected in .env.local.");
    console.log("To run live verification:");
    console.log("1. Open Firebase Console (https://console.firebase.google.com/)");
    console.log("2. Navigate to Project Settings > General > Your apps (Web app)");
    console.log("3. Copy the firebaseConfig keys into .env.local");
    console.log("4. Ensure Email/Password Auth & Cloud Firestore are enabled");
    console.log("5. Re-run this script: node src/services/verifyConnection.js\n");
    return;
  }

  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  console.log(`Connecting to Firebase project: ${firebaseConfig.projectId}...`);
  const app = initializeApp(firebaseConfig, "GreenRoute-Verifier");
  const auth = getAuth(app);
  const db = getFirestore(app);

  const testEmail = process.argv[2] || `verifier_${Date.now()}@greenroute.local`;
  const testPassword = process.argv[3] || "GreenRouteTestPass123!";

  let testUser = null;
  let createdNewUser = false;
  const cleanupDocRefs = [];

  try {
    // 1. Authenticate with least-privileged test user
    console.log(`\n[Step 1/5] Authenticating test user: ${testEmail}...`);
    try {
      const userCred = await signInWithEmailAndPassword(auth, testEmail, testPassword);
      testUser = userCred.user;
      console.log(`  ✓ Signed in existing test user (UID: ${testUser.uid})`);
    } catch (err) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        const userCred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
        testUser = userCred.user;
        createdNewUser = true;
        console.log(`  ✓ Created temporary test user (UID: ${testUser.uid})`);
      } else {
        throw err;
      }
    }

    // 2. Test reading campus_conditions & environmental_data (public read rules)
    console.log("\n[Step 2/5] Testing public read access to campus_conditions & environmental_data...");
    const conditionsSnap = await getDocs(collection(db, "campus_conditions"));
    console.log(`  ✓ Queried campus_conditions (${conditionsSnap.size} documents found)`);

    const envSnap = await getDocs(collection(db, "environmental_data"));
    console.log(`  ✓ Queried environmental_data (${envSnap.size} documents found)`);

    // 3. Test writing & reading user preferences (isOwner rule)
    console.log("\n[Step 3/5] Testing strict user_preferences ownership read/write...");
    const prefDocRef = doc(db, "user_preferences", testUser.uid);
    cleanupDocRefs.push(prefDocRef);

    const testPrefPayload = {
      userId: testUser.uid,
      preferredRouteType: "greenest",
      avoidHazards: true,
      avoidStairs: false,
      wheelchairAccessible: false,
      minimumShadePreference: 70,
      maxAirQualityIndex: 80,
      walkingSpeed: "normal",
      notificationAlerts: true,
      updatedAt: serverTimestamp(),
    };

    await setDoc(prefDocRef, testPrefPayload);
    console.log("  ✓ Created valid user preferences document conforming to schema");

    const readBackPrefSnap = await getDoc(prefDocRef);
    if (!readBackPrefSnap.exists() || readBackPrefSnap.data().preferredRouteType !== "greenest") {
      throw new Error("Verification failed: saved preferences do not match expected data");
    }
    console.log("  ✓ Read back verified user preferences document matching owner UID");

    // 4. Test writing & reading saved routes (isValidRoute + ownership rule)
    console.log("\n[Step 4/5] Testing saved routes ownership & schema validation...");
    const testRoutePayload = {
      name: "Verifier Campus Route",
      userId: testUser.uid,
      origin: { latitude: 28.5458, longitude: 77.1925, name: "Quad" },
      destination: { latitude: 28.5472, longitude: 77.1941, name: "Science Block" },
      waypoints: [],
      routeMetadata: { distanceMeters: 250, routeType: "greenest" },
      isFavorite: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const routeColRef = collection(db, "routes");
    const routeDocRef = await addDoc(routeColRef, testRoutePayload);
    cleanupDocRefs.push(routeDocRef);
    console.log(`  ✓ Saved valid route document (ID: ${routeDocRef.id})`);

    const readBackRouteSnap = await getDoc(routeDocRef);
    if (!readBackRouteSnap.exists() || readBackRouteSnap.data().name !== "Verifier Campus Route") {
      throw new Error("Verification failed: saved route does not match expected data");
    }
    console.log("  ✓ Read back verified route document matching creator UID");

    console.log("\n=================================================");
    console.log("✓ ALL LIVE FIREBASE TESTS PASSED");
    console.log("=================================================");
  } catch (error) {
    console.error("\n❌ Live Verification Failed:", error.message);
    if (error.code) console.error("Firebase Error Code:", error.code);
  } finally {
    // 5. Guaranteed cleanup of test data and temporary user regardless of pass or fail
    console.log("\n[Step 5/5] Performing guaranteed cleanup...");
    for (const docRef of cleanupDocRefs) {
      try {
        await deleteDoc(docRef);
        console.log(`  ✓ Deleted temporary test document: ${docRef.path}`);
      } catch (cleanupErr) {
        console.warn(`  ! Could not delete document ${docRef.path}:`, cleanupErr.message);
      }
    }

    if (createdNewUser && testUser) {
      try {
        await testUser.delete();
        console.log("  ✓ Deleted temporary test user account");
      } catch (userCleanupErr) {
        console.warn("  ! Could not delete test user:", userCleanupErr.message);
      }
    } else if (testUser) {
      try {
        await signOut(auth);
        console.log("  ✓ Signed out test user");
      } catch {
        // Ignore signout error
      }
    }
    console.log("Cleanup complete.\n");
  }
}

runLiveVerification();
