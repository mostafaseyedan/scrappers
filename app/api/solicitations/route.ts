import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { solicitation as solModel } from "@/app/models";
import {
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

    // Check if caller wants to include nonRelevant items (for duplicate checks by scrapers)
    const { searchParams } = new URL(req.url);
    const includeNonRelevant = searchParams.get("includeNonRelevant") === "true";

    // Fetch records from Firestore
    const records = await fireGet(COLLECTION, queryOptions);

    // Filter out nonRelevant items unless explicitly requested to include them
    const filteredRecords = includeNonRelevant
      ? records
      : records.filter((record: any) => record.cnType !== "nonRelevant");

    // Count total matching records
    let totalCount: number;
    if (includeNonRelevant) {
      // When including nonRelevant, just count what we fetched
      totalCount = filteredRecords.length;
    } else {
      // For UI requests, count all non-relevant records
      const allRecords = await fireGet(COLLECTION, {
        ...queryOptions,
        limit: 10000, // Fetch large batch to count properly
      });
      totalCount = allRecords.filter(
        (record: any) => record.cnType !== "nonRelevant"
      ).length;
    }

    results = {
      total: totalCount,
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
