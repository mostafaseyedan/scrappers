import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { algoliasearch } from "algoliasearch";

const algoliaClient = algoliasearch(
  process.env.ALGOLIA_ID!,
  process.env.ALGOLIA_SEARCH_KEY!
);

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Facet attributes to fetch options for
  const facetKeys = [
    "issuer",
    "location",
    "site",
    "cnStatus",
    "cnType",
  ] as const;

  try {
    // Use a standard search with facets to retrieve facet counts in one request.
    // This works with attributes configured as facetable (filterOnly or searchable) and
    // does not require searchable() like searchForFacetValues does.
    const { results: algoliaResults } = await algoliaClient.search([
      {
        indexName: "solicitations",
        params: {
          query: "", // empty query to just retrieve facet distributions
          facets: facetKeys as unknown as string[],
          maxValuesPerFacet: 200,
        },
      },
    ]);

    const firstResult: any = algoliaResults?.[0] || {};
    const facetDistributions: Record<
      string,
      Record<string, number>
    > = firstResult.facets || {};

    const facets: Record<string, Array<{ value: string; count: number }>> = {};

    facetKeys.forEach((facetKey) => {
      const values = facetDistributions[facetKey] || {};
      facets[facetKey] = Object.entries(values).map(([value, count]) => ({
        value,
        count: Number(count) || 0,
      }));
    });

    results = { facets };
  } catch (error: any) {
    console.error("Algolia facet options error", error);
    results = { error: error?.message || "Failed to fetch facet options" };
    status = 500;
  }

  return NextResponse.json(results, { status });
}
