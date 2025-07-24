import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";

const db = initDb();

async function migrateIssuingOrganization() {
  const snapshot = await db
    .collection("solicitations")
    .where("cnStatus", "==", null)
    .limit(5)
    .get();
  const batch = db.batch();

  console.log(snapshot.size, "solicitations to migrate");

  snapshot.forEach((doc) => {
    console.log(doc.id);
    /*
    const docRef = db.collection("solicitations").doc(doc.id);
    batch.update(docRef, {
      cnStatus: "new",
    });
    */
  });

  await batch.commit();
  console.log("Migration complete.");
}

migrateIssuingOrganization().catch(console.error);
