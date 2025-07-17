import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";
import { Client } from "@elastic/elasticsearch";

const elasticApiKey = process.env.ELASTIC_API_KEY;
if (!elasticApiKey) {
  throw new Error("ELASTIC_API_KEY environment variable is not defined");
}

const elastic = new Client({
  node: process.env.ELASTIC_NODE,
  auth: { apiKey: elasticApiKey },
  serverMode: "serverless",
});

const db = initDb();
const elasticIndex = "solicitations";
async function main() {
  const snapshot = await db
    .collection("solicitations")
    .where("site", "==", "bidnetdirect.com")
    .get();

  console.log(`Found ${snapshot.size} solicitations to update.`);

  for (const doc of snapshot.docs) {
    // Update Firestore
    await doc.ref.update({ site: "bidnetdirect" });
    console.log(`Firestore: Updated ${doc.id}`);

    // Update Elasticsearch
    try {
      await elastic.update({
        index: elasticIndex,
        id: doc.id,
        body: { doc: { site: "bidnetdirect" } },
      });
      console.log(`Elasticsearch: Updated ${doc.id}`);
    } catch (err) {
      console.error(`Elasticsearch error for ${doc.id}:`, err);
    }
  }
}

main().catch(console.error);
