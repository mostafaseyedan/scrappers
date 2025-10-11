import { z } from "genkit";
import searchAlgolia from "@/ai/tools/searchAlgolia";

const OutputSchema = z.object({ intent: z.string() });

const handler = (ai) => {
  const searchAlgoliaTool = searchAlgolia(ai);

  const availableIntents = {
    search_or_list_solicitations: {
      key: "search_or_list_solicitations",
      name: "search or list solicitations",
      description: "Search for solicitations",
      params: { sort: { type: "string" } },
      system: `
        You are a helpful assistant for searching solicitations. Use the searchAlgolia tool to get a list of solicitations (query is optional) with index=solicitations. 
        
        List solicitations with fields: 
          - title (make this a clickable link to /solicitations/{id})
          - issuer (possible this is empty) 
          - location (possible this is empty)
          - id
          - site (make this a clickable link to siteUrl)
          - closingDate (possible this is empty)
          - publishDate (possible this is empty)
          - created 
        
        Format the results as a nice list.
        `,
      tools: [searchAlgoliaTool],
    },
    search_or_list_sources: {
      key: "search_or_list_sources",
      name: "search or list sources",
      description: "Search for sources",
      params: { sort: { type: "string" } },
      system: `
        You are a helpful assistant for searching sources. Use the searchAlgolia tool to get a list of sources (query is optional) with index=sources. 
        
        List sources with fields: 
          - names
          - type
          - id
        
        Format the results as a nice list.
        `,
      tools: [searchAlgoliaTool],
    },
    other: {
      key: "other",
      name: "other",
      description: "Anything else",
      system: "You are a concise, friendly assistant. Answer briefly.",
      params: {},
      tools: [],
    },
  };

  return ai.defineFlow(
    {
      name: "determineIntent",
      inputSchema: z.object({ inputMessage: z.string() }),
    },
    async ({ inputMessage }) => {
      const prompt = `Determine the user's intent based on the following message: "${inputMessage}". Choose one from the following intents: ${JSON.stringify(
        Object.keys(availableIntents)
      )}. Respond with the selected intent.`;

      let { output } = await ai.generate({
        prompt,
        output: { schema: OutputSchema },
      });

      if (output == null) {
        output = { intent: "other" };
      }

      return availableIntents[output.intent];
    }
  );
};

export default handler;
