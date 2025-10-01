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
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = searchParams.get("sort") || "publishDate desc";

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 500 });
  }

  const result = await algoliaClient.search({
    requests: [
      { indexName: "solicitations", query: q, page, hitsPerPage: limit },
    ],
  });

  return NextResponse.json(result);
}
