import { algoliasearch } from "algoliasearch";

const client = init();

export function init() {
  return algoliasearch(process.env.ALGOLIA_ID!, process.env.ALGOLIA_WRITE_KEY!);
}

export function normalize(data: Record<string, any>) {
  const normalized: Record<string, any> = {};

  for (const key of Object.keys(data)) {
    const val = data[key];
    if (typeof val === "number" && val > 1000000000000) {
      normalized[key] = new Date(val);
    } else {
      normalized[key] = val;
    }
  }

  return normalized;
}

export async function patch(
  index: string,
  id: string,
  data: Record<string, any>
) {
  await client.partialUpdateObjects({
    indexName: index,
    objects: [{ ...data, objectID: id }],
  });
}

export async function post(
  index: string,
  id: string,
  data: Record<string, any>
) {
  await client.saveObjects({
    indexName: index,
    objects: [{ ...data, objectID: id }],
  });
}

export async function remove(index: string, id: string) {
  await client.deleteObject({
    indexName: index,
    objectID: id,
  });
  return { success: id };
}

export function sanitize(data: Record<string, any>) {
  const sanitized: Record<string, any> = {};

  for (const key of Object.keys(data)) {
    const val = data[key];
    if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) {
      sanitized[key] = new Date(val).getTime();
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
