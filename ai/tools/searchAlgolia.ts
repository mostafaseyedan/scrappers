import { z } from "genkit";
import { algoliasearch } from "algoliasearch";
import { normalize } from "@/lib/algolia";

const handler = (ai: any) =>
  ai.defineTool(
    {
      name: "searchAlgolia",
      description:
        "Searches an Algolia index and returns top matching records for grounding factual answers.",
      inputSchema: z.object({
        index: z.string().describe("Algolia index name"),
        query: z
          .string()
          .nullable()
          .optional()
          .default("")
          .describe("User query to search"),
        filters: z.string().nullable().describe("Algolia filters").optional(),
      }),
      outputSchema: z.object({
        hits: z.array(z.record(z.any())),
        nbHits: z.number(),
      }),
    },
    async (input: any) => {
      console.log("searchAlgolia input:", input);

      const client = algoliasearch(
        process.env.ALGOLIA_ID!,
        process.env.ALGOLIA_SEARCH_KEY!
      );
      const resp = await client.search({
        requests: [
          {
            indexName: input.index,
            query: input.query || "",
            filters: input.filters || "",
            hitsPerPage: 10,
          },
        ],
      });
      const result = (resp.results?.[0] as any) || {};
      const rawHits = (result.hits || []) as any[];
      const hits = rawHits.map((hit) => {
        const normalized = normalize(hit);

        for (const key of Object.keys(normalized)) {
          const val = normalized[key];
          if (val instanceof Date) {
            normalized[key] = val.toLocaleString();
          }
        }

        return normalized;
      });

      return {
        hits,
        nbHits: result.nbHits || 0,
      };
    }
  );

export default handler;
