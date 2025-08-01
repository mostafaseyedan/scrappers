import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";
import { solicitation as solModel } from "@/app/models";

const BASE_URL = "http://localhost:3000";

const db = initDb();

async function dedupeSolicitations() {
  const snapshot = await db.collection("solicitations").get();
  const siteIdMap: Record<string, any[]> = {};

  // Group docs by siteId
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const siteId = data.siteId;
    if (!siteId) return;
    if (!siteIdMap[siteId]) siteIdMap[siteId] = [];
    siteIdMap[siteId].push({ id: doc.id, data });
  });

  let totalDeleted = 0;
  for (const [siteId, records] of Object.entries(siteIdMap)) {
    if (records.length <= 1) continue;
    // Prefer to keep the one with documents
    let toKeep = records.find(
      (r) => Array.isArray(r.data.documents) && r.data.documents.length > 0
    );
    if (!toKeep) toKeep = records[0];
    const toDelete = records.filter((r) => r.id !== toKeep.id);
    for (const rec of toDelete) {
      await solModel.remove(rec.id, BASE_URL, process.env.DEV_API_TOKEN);
      console.log(`Deleted duplicate for siteId ${siteId}: ${rec.id}`);
      totalDeleted++;
    }
    console.log(`Kept for siteId ${siteId}: ${toKeep.id}`);
  }
  console.log(`Done. Deleted ${totalDeleted} duplicate records.`);
}

dedupeSolicitations().catch(console.error);
