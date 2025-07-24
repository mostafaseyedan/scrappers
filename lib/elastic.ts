import { Client } from "@elastic/elasticsearch";

const elasticApiKey = process.env.ELASTIC_API_KEY || "";
if (!elasticApiKey) {
  throw new Error("ELASTIC_API_KEY environment variable is not defined");
}

export const client = init();

export function init() {
  return new Client({
    node: process.env.ELASTIC_NODE,
    auth: { apiKey: elasticApiKey },
    serverMode: "serverless",
  });
}

export async function patch(
  index: string,
  id: string,
  doc: Record<string, any>
) {
  const response = await client.update({
    index,
    id,
    doc: {
      ...doc,
    },
  });
  if (response.result !== "updated") {
    throw new Error(`Failed to update document in Elasticsearch ${id}`);
  }
}

export async function post(
  index: string,
  id: string,
  doc: Record<string, any>
) {
  const response = await client.index({
    index,
    id,
    body: doc,
  });
  if (response.result !== "created") {
    throw new Error(`Failed to create document in Elasticsearch ${id}`);
  }
  return { success: id };
}

export async function remove(index: string, id: string) {
  const response = await client.delete({ index, id });
  if (response.result !== "deleted") {
    throw new Error(`Failed to delete document in Elasticsearch ${id}`);
  }
  return { success: id };
}
