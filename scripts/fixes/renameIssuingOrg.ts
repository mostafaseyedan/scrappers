import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const db = initDb();

async function migrateIssuingOrganization() {
  const snapshot = await db.collection("solicitations").get();
  const batch = db.batch();

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.issuingOrganization !== undefined) {
      const docRef = db.collection("solicitations").doc(doc.id);
      batch.update(docRef, {
        issuer: data.issuingOrganization,
        issuingOrganization: FieldValue.delete(),
      });
    }
  });

  await batch.commit();
  console.log("Migration complete.");
}

migrateIssuingOrganization().catch(console.error);
