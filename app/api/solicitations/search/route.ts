import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { algoliasearch } from "algoliasearch";

const algoliaClient = algoliasearch(
  process.env.ALGOLIA_ID!,
  process.env.ALGOLIA_SEARCH_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user = await checkSession(req);
  const q = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "20", 10) || 20;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const filters: Record<string, any> = {};
  let filterString = "";

  // Quote and escape Algolia filter values so spaces and quotes are handled correctly
  const quoteAlgoliaValue = (v: string) =>
    `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("filters.")) {
      const filterKey = key.replace("filters.", "");
      filters[filterKey] = value;
      if (filterString) filterString += " AND ";
      // Do NOT URL-encode filter values; Algolia expects quoted strings for values with spaces
      filterString += `${filterKey}:${quoteAlgoliaValue(value)}`;
    }
  }

  // Always exclude nonRelevant items from search results
  if (filterString) filterString += " AND ";
  filterString += `NOT cnType:"nonRelevant"`;

  console.log('[Search API] Filter string:', filterString);

  // There is no sorting. You have to create a replicated index in Algolia
  // const sort = searchParams.get("sort") || "publishDate desc";

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 500 });
  }

  const resp = await algoliaClient.search({
    requests: [
      {
        indexName: "solicitations",
        query: q,
        page: Math.max(0, page - 1), // Algolia pages are 0-based
        filters: filterString || undefined,
        hitsPerPage: limit,
      },
    ],
  });
  const result = resp.results?.[0] as Record<string, any>;
  const records = result?.hits || [];
  const total = result?.nbHits || 0;

  return NextResponse.json({ results: records, total });
}
