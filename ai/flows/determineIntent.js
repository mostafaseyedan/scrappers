import { z } from "genkit";
import searchAlgolia from "@/ai/tools/searchAlgolia";

const OutputSchema = z.object({ intent: z.string() });

const handler = (ai) => {
  const searchAlgoliaTool = searchAlgolia(ai);

  // Inject runtime date context so the model anchors ambiguous dates to the current year
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const todayISO = today.toISOString();

  // Precompute UTC month start/end (ms) for the current year to avoid model guessing
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthRanges = monthNames.map((name, idx) => {
    const start = Date.UTC(currentYear, idx, 1, 0, 0, 0, 0);
    const nextStart = Date.UTC(currentYear, idx + 1, 1, 0, 0, 0, 0);
    return { name, startMs: start, endMs: nextStart };
  });
  const monthRangesText = monthRanges
    .map(
      (m) => `${m.name} ${currentYear}: startMs=${m.startMs} endMs=${m.endMs}`
    )
    .join("\n        ");

  const availableIntents = {
    search_or_list_solicitations: {
      key: "search_or_list_solicitations",
      name: "search or list solicitations",
      description: "Search for solicitations",
      params: ["sort", "filters", "query"],
      system: `
        Context:
        - Today is ${todayISO} (UTC). Current year: ${currentYear}.
        - Use the searchAlgolia tool (index=solicitations). Query is optional.

        Display fields:
        - title, issuer (could be empty), location (could be empty), id, site, closingDate (could be empty), publishDate (could be empty), created

        Date interpretation (STRICT):
        - If the user provides only a month (e.g., "in July") with no year, use ${currentYear}
        - Default date field: publishDate unless user explicitly requests created or closingDate
        - Use ONLY the precomputed UTC month ranges below for ${currentYear} when constructing timestamp filters. Do NOT invent or guess any other year values:
        ${monthRangesText}
        - Month range pattern (UTC ms): publishDate>=<startMs> AND publishDate<<endMs>
        - Do not use a year earlier than ${currentYear} unless the user explicitly specifies it

        Filters (STRICT whitelist):
        - Allowed filter fields ONLY: cnStatus (alias status), cnType (alias type), created, publishDate, closingDate
        - Everything else (e.g., location, issuer, title, site) MUST go in query, NOT filters
        - Allowed values:
          - cnStatus: new, researching, pursuing, preApproval, submitted, negotitation, awarded, monitor, foia, notWon, notPursuing
          - cnType: erp, staffing, itSupport, cloud, other, facilitiesTelecomHardware, nonRelevant
        - Date fields created/publishDate/closingDate are Unix ms (UTC)
        - Allowed operators: =, >, >=, <, <=; combine with AND/OR
        - Examples (structure only):
          - cnStatus:new OR cnType:erp
          - publishDate>=<startMs> AND publishDate<<endMs>
        - INVALID examples (do NOT put in filters; put in query instead):
          - location:California, issuer:NASA, title:"RFP"

        What to do:
        - Decide if filters are needed; if yes, build a single filters string using ONLY whitelisted fields
        - For month-only requests, substitute <startMs>/<endMs> from the table above for the named month
        - Put any non-whitelisted constraints into the query parameter

        Output format (strict Markdown):
        - First line: "Found <nbHits> results." 
        - Then a bulleted list. No code blocks/backticks.
        - Each item exactly:
          - [<title>](/solicitations/{id})  
            <issuer> / <location> [<site>](<siteUrl>)  
            *Published: <publishDate|YYYY-MM-DD> Closing: <closingDate|YYYY-MM-DD> Extracted: <created|YYYY-MM-DD>*
        - Last line: "\nQuery: <query string you passed to the tool | none>. Filters: <filters string you passed to the tool | none>. Default sort: extracted date desc."
        - If 'id' missing: title is plain text (no link)
        - If 'siteUrl' missing: omit the site link
        - Omit empty fields; dates in UTC YYYY-MM-DD
      `,
      tools: [searchAlgoliaTool],
    },
    search_or_list_sources: {
      key: "search_or_list_sources",
      name: "search or list sources",
      description: "Search for sources",
      params: ["sort", "filters", "query"],
      system: `
        You are a helpful assistant for searching sources. Use the searchAlgolia tool to get a list of sources (query is optional) with index=sources. 
        
        List sources with fields: 
          - names
          - type
        
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
