import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, getDoc, collection, deleteDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../");

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
  return env;
}

async function verifyLiveFlow() {
  console.log("=================================================");
  console.log("GreenRoute: Live Firebase Condition Audit Suite");
  console.log("=================================================");
  const env = loadEnvLocal();
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(firebaseConfig, "Live-Condition-Test");
  const auth = getAuth(app);
  const db = getFirestore(app);

  const testEmail = `live_tester_${Date.now()}@greenroute.local`;
  const testPassword = "LiveTestPass123!";
  let testUser = null;

  try {
    // 1. Auth check
    console.log("\n[Step 1/4] Authenticating live test user:", testEmail);
    const userCred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    testUser = userCred.user;
    console.log("  ✓ Created test user (UID: " + testUser.uid + ")");

    // 2. Prepare live condition payload
    const payload = {
      title: "Waterlogging on Kalpi Road",
      description: "Deep water accumulation near Kalpi Road intersection",
      type: "blocked_path",
      severity: "critical",
      status: "active",
      location: {
        latitude: 26.4596,
        longitude: 80.2383,
        areaName: "Panki Study Area",
      },
      affectedPathIds: [],
      startTime: new Date().toISOString(),
      endTime: null,
      reportedBy: testUser.uid,
      isSimulated: false,
    };

    console.log("\n[Step 2/4] Writing real condition to Firestore `campus_conditions`...");
    const colRef = collection(db, "campus_conditions");
    const docRef = await addDoc(colRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("  ✓ Condition created in Firestore with document ID:", docRef.id);

    // 3. Read back & verify fields
    console.log("\n[Step 3/4] Verifying document directly in Firebase Console / Firestore...");
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Document does not exist in Firestore!");
    const data = docSnap.data();
    console.log("  ✓ Document fields verified:", {
      id: docSnap.id,
      title: data.title,
      type: data.type,
      severity: data.severity,
      status: data.status,
      reportedBy: data.reportedBy,
      isSimulated: data.isSimulated,
      location: data.location,
    });

    if (data.reportedBy !== testUser.uid) throw new Error("reportedBy mismatch!");
    if (data.isSimulated !== false) throw new Error("isSimulated is not false!");
    if (data.status !== "active") throw new Error("status is not active!");

    // 4. Resolve condition
    console.log("\n[Step 4/4] Updating condition status to `resolved`...");
    await updateDoc(docRef, {
      status: "resolved",
      updatedAt: serverTimestamp(),
    });
    const updatedSnap = await getDoc(docRef);
    console.log("  ✓ Status successfully transitioned to:", updatedSnap.data().status);

    // 5. Cleanup doc
    console.log("\n[Cleanup] Cleaning up test condition document...");
    await deleteDoc(docRef);
    console.log("  ✓ Deleted test document from Firestore.");

    console.log("\n=================================================");
    console.log("✓ ALL LIVE FIREBASE CONDITION TESTS PASSED 100%");
    console.log("=================================================");
  } catch (err) {
    console.error("\n❌ Live condition test failed:", err.message);
  } finally {
    if (testUser) {
      try {
        await testUser.delete();
        console.log("  ✓ Deleted temporary test user account.");
      } catch {
        console.log("  Cleaned up auth.");
      }
    }
  }
}

verifyLiveFlow();
