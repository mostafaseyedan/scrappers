import "dotenv/config";
import { Client } from "@elastic/elasticsearch";

const elasticApiKey = process.env.ELASTIC_API_KEY;
if (!elasticApiKey) {
  throw new Error("ELASTIC_API_KEY environment variable is not defined");
}

const elasticClient = new Client({
  node: process.env.ELASTIC_NODE,
  auth: { apiKey: elasticApiKey },
  serverMode: "serverless",
});

(async () => {
  const updateResp = await elasticClient.indices.putMapping({
    index: "sources",
    properties: {
      id: { type: "text" },
      name: { type: "text" },
      name_semantic: { type: "semantic_text" },
      key: { type: "text" },
      type: { type: "keyword" },
      cnNote: { type: "text" },
      description: { type: "text" },
      description_semantic: { type: "semantic_text" },
      url: { type: "text" },
      created: { type: "date" },
      updated: { type: "date" },
    },
  });
  console.log({ updateResp });
})();
