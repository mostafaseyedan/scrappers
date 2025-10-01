import { algoliasearch } from "algoliasearch";

const client = init();

export function init() {
  return algoliasearch(process.env.ALGOLIA_ID!, process.env.ALGOLIA_WRITE_KEY!);
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
