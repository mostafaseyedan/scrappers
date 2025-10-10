import { z } from "genkit";
import { algoliasearch } from "algoliasearch";

const handler = (ai: any) =>
  ai.defineTool(
    {
      name: "searchAlgolia",
      description:
        "Searches an Algolia index and returns top matching records for grounding factual answers.",
      inputSchema: z.object({
        index: z.string().describe("Algolia index name"),
        query: z.string().describe("User query to search").optional(),
        filters: z.string().optional().describe("Algolia filters expression"),
      }),
      outputSchema: z.object({
        hits: z.array(z.record(z.any())),
        nbHits: z.number(),
      }),
    },
    async (input: any) => {
      console.log("searchAlgolia", { input });

      const client = algoliasearch(
        process.env.ALGOLIA_ID!,
        process.env.ALGOLIA_SEARCH_KEY!
      );
      const resp = await client.search({
        requests: [
          {
            indexName: input.index,
            query: input.query,
            filters: input.filters,
          },
        ],
      });
      const result = (resp.results?.[0] as any) || {};
      return {
        hits: result.hits || [],
        nbHits: result.nbHits || 0,
      };
    }
  );

export default handler;
