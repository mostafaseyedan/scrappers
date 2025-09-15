import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";
import { Client } from "@elastic/elasticsearch";
import chalk from "chalk";
import { fireToJs } from "@/lib/dataUtils";

const elasticApiKey = process.env.ELASTIC_API_KEY;
if (!elasticApiKey) {
  throw new Error("ELASTIC_API_KEY environment variable is not defined");
}

const COLLECTION = "sources";

const elasticClient = new Client({
  node: process.env.ELASTIC_NODE,
  auth: { apiKey: elasticApiKey },
  serverMode: "serverless",
});

async function run() {
  const db = initDb();

  const test = await elasticClient.deleteByQuery({
    index: COLLECTION,
    query: { match_all: {} },
  });
  console.log({ test });

  const solicitationsSnapshot = await db.collection(COLLECTION).get();
  let docs: Record<string, any>[] = [];

  solicitationsSnapshot.forEach((doc) => {
    const docData = doc.data();
    let newEsDoc: Record<string, any> = fireToJs({
      id: doc.id,
      ...docData,
      name_semantic: docData.name,
      description_semantic: docData.description,
    });
    delete newEsDoc.extractedDate;
    docs.push(newEsDoc);
  });

  const bulkIngestResp = await elasticClient.helpers
    .bulk({
      index: COLLECTION,
      datasource: docs,
      onDocument: (doc) => {
        console.log("Processing document", doc.id);
        return [
          { index: { _index: COLLECTION, _id: doc.id } },
          {
            ...doc,
            title_semantic: doc.title,
            description_semantic: doc.description,
          },
        ];
      },
      onDrop: (tdoc) => {
        console.error(
          chalk.red(
            `Document dropped ${tdoc.document.id}`,
            JSON.stringify(tdoc.error, null, 2)
          )
        );
      },
      onSuccess: (tdoc) => {
        const doc = tdoc.document as Record<string, any>;
        console.log(chalk.green(`Document indexed successfully ${doc.id}`));
      },
    })
    .catch((error) => {
      throw new Error(error);
    });
  console.log({ bulkIngestResp });
}

(async () => {
  await run().catch((error) => {
    console.error("Error during bulk ingest:", error);
    process.exit(1);
  });
})();
