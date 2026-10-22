const { initializeApp } = require('firebase/app');
const { initializeFirestore, doc, setDoc, getDoc, terminate } = require('firebase/firestore');
const fs = require('fs');

const newConfig = {
  apiKey: "AIzaSyBznPfG6w7aOSWXGYYHwK3aC0gyeHPBbXM",
  authDomain: "congregazionedb.firebaseapp.com",
  projectId: "congregazionedb",
  storageBucket: "congregazionedb.firebasestorage.app",
  messagingSenderId: "408093970394",
  appId: "1:408093970394:web:40e846e7289f79a1917ae3",
  measurementId: "G-E684F7QH78"
};

const app = initializeApp(newConfig);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

async function migrate() {
  try {
    console.log("Connecting to congregazionedb Firestore...");
    const dump = JSON.parse(fs.readFileSync("./old_db_dump.json", "utf8"));
    const docRef = doc(db, "congregationData", "main");
    
    console.log(`Uploading data (${dump.state?.people?.length || 0} proclamatori)...`);
    await setDoc(docRef, dump);
    console.log("Upload completed successfully!");

    const verifySnap = await getDoc(docRef);
    if (verifySnap.exists()) {
      const data = verifySnap.data();
      console.log(`VERIFICATION OK: Document exists with ${data.state?.people?.length || 0} proclamatori!`);
    } else {
      console.error("Verification failed: document not found after write.");
    }
    
    await terminate(db);
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err.message);
    if (db) await terminate(db).catch(() => {});
    process.exit(1);
  }
}

migrate();
