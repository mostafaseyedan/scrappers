import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";
import { Client } from "@elastic/elasticsearch";
import chalk from "chalk";
import { fireToJs } from "@/lib/dataUtils";

const elasticApiKey = process.env.ELASTIC_API_KEY;
if (!elasticApiKey) {
  throw new Error("ELASTIC_API_KEY environment variable is not defined");
}

const elasticClient = new Client({
  node: process.env.ELASTIC_NODE,
  auth: { apiKey: elasticApiKey },
  serverMode: "serverless",
});

async function run() {
  const db = initDb();

  const test = await elasticClient.deleteByQuery({
    index: "solicitations",
    query: { match_all: {} },
  });
  console.log({ test });

  const solicitationsSnapshot = await db.collection("solicitations").get();
  let docs: Record<string, any>[] = [];

  solicitationsSnapshot.forEach((doc) => {
    let newEsDoc: Record<string, any> = fireToJs({
      id: doc.id,
      ...doc.data(),
    });
    delete newEsDoc.extractedDate;
    docs.push(newEsDoc);
  });

  const bulkIngestResp = await elasticClient.helpers
    .bulk({
      index: "solicitations",
      datasource: docs,
      onDocument: (doc) => {
        console.log("Processing document", doc.id);
        return [
          { index: { _index: "solicitations", _id: doc.id } },
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
