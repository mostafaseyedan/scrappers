import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { solicitation as solModel } from "@/app/models";
import {
  count,
  get as fireGet,
  post as firePost,
  parseQueryString,
} from "au/server/firebase";
import { fireToJs } from "@/lib/dataUtils";
import { post as algoliaPost } from "@/lib/algolia";

const COLLECTION = "solicitations";

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  const queryOptions = parseQueryString(req.url);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    const records = await fireGet(COLLECTION, queryOptions);

    // Filter out nonRelevant items after fetching
    const filteredRecords = records.filter(
      (record: any) => record.cnType !== "nonRelevant"
    );

    const total = await count(COLLECTION, {
      filters: { ...queryOptions.filters },
    });

    results = {
      total: filteredRecords.length,
      count: filteredRecords.length,
      results: filteredRecords,
    };
  } catch (error) {
    console.error(`Failed to get ${COLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}

export async function POST(req: NextRequest) {
  const { body } = req;
  const bodyJson = await new NextResponse(body).json();
  const user = await checkSession(req);
  let results;
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    bodyJson.created = new Date().toISOString();
    bodyJson.updated = new Date().toISOString();
    bodyJson.authorId = user.uid;

    const parsedData = solModel.schema.postApi.parse(bodyJson);
    const fireDoc = await firePost(COLLECTION, parsedData);
    await algoliaPost(COLLECTION, fireDoc.id, fireToJs(fireDoc));

    results = fireDoc;
  } catch (error) {
    console.error(`Failed to create ${COLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
