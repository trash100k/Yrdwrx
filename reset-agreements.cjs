import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

async function run() {
  const serviceAccount = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
  
  const app = initializeApp({
    credential: cert(serviceAccount)
  });
  
  const db = getFirestore(app);
  
  const usersRef = db.collection("users");
  const users = await usersRef.get();
  
  const batch = db.batch();
  let count = 0;
  users.forEach(doc => {
     batch.update(doc.ref, { agreementsAccepted: false });
     count++;
  });
  
  if (count > 0) {
      await batch.commit();
      console.log(`Reset ${count} users' agreementsAccepted to false`);
  } else {
      console.log("No users found to reset");
  }
}

run().catch(console.error);
