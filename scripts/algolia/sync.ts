import "dotenv/config";
import { algoliasearch } from "algoliasearch";
import { solicitation as solModel, source as sourceModel } from "@/app/models";

const client = algoliasearch(
  process.env.ALGOLIA_ID!,
  process.env.ALGOLIA_WRITE_KEY!
);

const baseUrl = process.env.BASE_URL;
const token = process.env.SERVICE_KEY;

function parseIndexNameFromArgs(): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--index" || arg === "--indexName" || arg === "-i") {
      const val = args[i + 1];
      if (val && !val.startsWith("-")) return val;
    }
    const m = arg.match(/^--index(?:Name)?=(.+)$/);
    if (m) return m[1];
  }
  return undefined;
}

const indexName = parseIndexNameFromArgs();
let updateCount = 0;
let createCount = 0;

async function upsertSource(rec: any) {
  const objectID =
    rec?.id != null
      ? String(rec.id)
      : rec?.objectID != null
      ? String(rec.objectID)
      : undefined;
  if (!objectID) {
    console.warn("Skipping record without id/objectID", rec);
    return { status: "skipped" as const };
  }

  const payload = { ...rec, objectID };

  try {
    // Check if object exists
    await client.getObject({ indexName, objectID });
    // Exists -> update/replace
    await client.saveObjects({ indexName, objects: [payload] });
    console.log(`Record updated ${objectID}`);
    updateCount++;
    return { status: "updated" as const };
  } catch (e: any) {
    const notFound = e?.status === 404 || e?.statusCode === 404;
    if (notFound) {
      // Does not exist -> create
      await client.saveObjects({ indexName, objects: [payload] });
      console.log(`Record created ${objectID}`);
      createCount++;
      return { status: "created" as const };
    }
    console.error(`Failed processing objectID=${objectID}`, e);
    return { status: "failed" as const };
  }
}

async function run() {
  let fireModel;
  if (indexName === "solicitations") fireModel = solModel;
  else if (indexName === "sources") fireModel = sourceModel;
  else throw new Error(`Unknown index name: ${indexName}`);

  const total = await fireModel.count({ baseUrl, token });
  let currentIndex = 0;
  let page = 1;

  do {
    const sources =
      (await fireModel.get({
        baseUrl,
        token,
        sort: "created desc",
        limit: 200,
        page,
      })) || [];

    if ((sources as any).error) throw new Error((sources as any).error);

    if ((sources as any).results) {
      const records: any[] = (sources as any).results;

      const results = await Promise.allSettled(
        records.map((r) => upsertSource(r))
      );

      page++;
      currentIndex += records.length;
    }
  } while (currentIndex < total);

  console.log(
    `Sources synced to Algolia. Created: ${createCount}, Updated: ${updateCount}`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
