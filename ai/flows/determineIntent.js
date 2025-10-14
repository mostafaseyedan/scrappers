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
        - Allowed values:
          - cnStatus: new, researching, pursuing, preApproval, submitted, negotitation, awarded, monitor, foia, notWon, notPursuing
          - cnType: erp, staffing, itSupport, cloud, other, facilitiesTelecomHardware, nonRelevant
        - Everything else that is not a filter allowed value (e.g., location, issuer, title, site) MUST go in query
        - Date fields created/publishDate/closingDate are Unix ms (UTC)
        - Allowed operators: =, >, >=, <, <=; combine with AND/OR

        Default/override rules for cnStatus (MANDATORY):
        - If the user does NOT specify a status, ADD cnStatus:new to filters.
        - If the user specifies a single allowed status, use that instead of the default.
        - If the user specifies multiple statuses, join them with OR, e.g., (cnStatus:new OR cnStatus:submitted).
        - If the user explicitly requests no status constraint (e.g., "any status", "all statuses", "don't filter by status"), OMIT cnStatus entirely.
        - Never duplicate recognized status terms in query.

        Matching rules (IMPORTANT):
        - Compare filter value mentions case-insensitively.
        - When matching cnType values, ignore spaces and hyphens in the user's text (e.g., "it support", "IT-Support" => itSupport).
        - Map common phrases to canonical values:
          - "it support" or "it-support" => cnType:itSupport
          - "erp" => cnType:erp
          - "staffing" => cnType:staffing
          - "cloud" => cnType:cloud
          - "facilities telecom hardware" => cnType:facilitiesTelecomHardware
        - If a value matches an allowed filter after normalization, PUT IT IN filters and DO NOT include it in query.
        
        Examples (structure only):
        - Default status only: cnStatus:new
        - Specific status: cnStatus:submitted
        - Multiple statuses: (cnStatus:new OR cnStatus:submitted)
        - With month range: cnStatus:new AND publishDate>=<startMs> AND publishDate<<endMs>
        - INVALID examples (do NOT put in filters; put in query instead):
          - location:California, issuer:NASA, title:"RFP"

        What to do:
        - Always apply the cnStatus default/override rules above
        - Decide if filters are needed; if yes, build a single filters string using ONLY whitelisted fields
        - For month-only requests, substitute <startMs>/<endMs> from the table above for the named month
        - Put any non-whitelisted constraints into the query parameter
        - Do not duplicate recognized filter terms in the query; keep query for free-text terms only

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
