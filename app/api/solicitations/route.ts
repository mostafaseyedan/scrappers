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

    // Extract cnStatus filter to apply in-memory
    const statusFilter = queryOptions.filters?.cnStatus;
    const otherFilters = { ...queryOptions.filters };
    delete otherFilters.cnStatus;

    // Fetch ALL records with sorting, no status filter yet
    const fetchOptions = {
      ...queryOptions,
      filters: otherFilters, // Remove cnStatus from Firestore query
      limit: 3000, // Fetch enough to get all relevant records (174 relevant out of ~3000 total)
    };

    console.log('Fetching with options:', JSON.stringify(fetchOptions));
    const allRecords = await fireGet(COLLECTION, fetchOptions);
    console.log(`Fetched ${allRecords.length} records from Firestore`);

    // Filter out nonRelevant in memory (fast for small dataset)
    const relevantRecords = includeNonRelevant
      ? allRecords
      : allRecords.filter((r: any) => r.cnType !== "nonRelevant");
    console.log(`After cnType filter: ${relevantRecords.length} relevant records`);

    // Apply cnStatus filter in memory
    const filteredRecords = statusFilter
      ? relevantRecords.filter((r: any) => r.cnStatus === statusFilter)
      : relevantRecords;
    console.log(`After cnStatus filter: ${filteredRecords.length} records (status: ${statusFilter || 'none'})`);

    // Apply pagination in memory
    const page = queryOptions.page || 1;
    const limit = queryOptions.limit || 500;
    const startIndex = (page - 1) * limit;
    const paginatedRecords = filteredRecords.slice(startIndex, startIndex + limit);
    console.log(`After pagination: ${paginatedRecords.length} records (page ${page}, limit ${limit})`);

    results = {
      total: filteredRecords.length,
      count: paginatedRecords.length,
      results: paginatedRecords,
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
