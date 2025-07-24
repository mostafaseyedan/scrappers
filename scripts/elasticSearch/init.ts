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
    index: "solicitations",
    properties: {
      id: { type: "text" },
      url: { type: "text" },
      title: { type: "text" },
      description: { type: "text" },
      location: { type: "text" },
      issuer: { type: "text" },
      publicationDate: { type: "date" },
      closingDate: { type: "date" },
      questionsDueByDate: { type: "date" },
      contactName: { type: "text" },
      contactEmail: { type: "text" },
      contactPhone: { type: "text" },
      contactNote: { type: "text" },
      externalLinks: { type: "keyword" },
      categories: { type: "keyword" },
      documents: { type: "keyword" },
      siteData: { type: "object" },
      site: { type: "text" },
      siteId: { type: "text" },
      siteUrl: { type: "text" },
      keywords: { type: "keyword" },
      rfpType: { type: "text" },
      cnStatus: { type: "text" },
      cnData: { type: "object" },
      cnLiked: { type: "boolean" },
      cnModified: { type: "boolean" },
      created: { type: "date" },
      updated: { type: "date" },
    },
  });
  console.log({ updateResp });
})();
