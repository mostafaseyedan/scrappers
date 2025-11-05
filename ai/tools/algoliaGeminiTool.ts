/**
 * Algolia Handler using Gemini Function Calling
 * TypeScript port of algolia_gemini_tool.py
 * Registers Algolia search as tools that Gemini can automatically invoke
 * Uses the newer @google/genai SDK (v1.28.0+)
 */

import { GoogleGenAI } from "@google/genai";
import { algoliasearch } from "algoliasearch";

interface AlgoliaGeminiConfig {
  algolia_app_id?: string;
  algolia_search_api_key?: string;
  algolia_index?: string;
  gemini_api_key?: string;
  model?: string;
}

interface SchemaInfo {
  date_fields: string[];
  sample_keys: string[];
}

interface SearchResult {
  title: string;
  description: string;
  issuer: string;
  location: string;
  site: string;
  siteUrl: string;
  scrapedDate: string | null;
  closingDate: string | null;
  publishDate: string | null;
  questionsDueByDate: string | null;
  cnStatus: string;
  cnType: string;
  categories: string[];
  keywords: string[];
}

interface SearchToolResult {
  success: boolean;
  total_matching_rfps?: number;
  returned_results?: number;
  results?: SearchResult[];
  error?: string;
}

interface StatisticsToolResult {
  success: boolean;
  total_rfps?: number;
  facet_field?: string;
  date_range?: string;
  breakdown?: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;
  error?: string;
}

export class AlgoliaGeminiTool {
  private appId: string;
  private apiKey: string;
  private indexName: string;
  private geminiApiKey: string;
  private modelName: string;

  private algoliaClient: ReturnType<typeof algoliasearch>;
  private geminiClient: GoogleGenAI;
  private chatSessions: Map<string, any> = new Map();
  private schemaInfo: SchemaInfo | null = null;

  constructor(config: AlgoliaGeminiConfig = {}) {
    // Algolia configuration
    this.appId = config.algolia_app_id || process.env.ALGOLIA_ID || "";
    this.apiKey = config.algolia_search_api_key || process.env.ALGOLIA_SEARCH_KEY || "";
    this.indexName = config.algolia_index || process.env.ALGOLIA_INDEX_NAME || "solicitations";

    // Gemini configuration
    this.geminiApiKey = config.gemini_api_key || process.env.GEMINI_API_KEY || "";
    this.modelName = config.model || "gemini-2.0-flash-exp";

    // Validation
    if (!this.appId || !this.apiKey) {
      throw new Error("Missing Algolia configuration");
    }
    if (!this.geminiApiKey) {
      throw new Error("Missing Gemini API key");
    }

    // Initialize Algolia client
    this.algoliaClient = algoliasearch(this.appId, this.apiKey);

    // Initialize Gemini client (newer SDK)
    this.geminiClient = new GoogleGenAI({
      apiKey: this.geminiApiKey,
    });

    console.log(`Initialized AlgoliaGeminiTool: index=${this.indexName}, model=${this.modelName}`);
  }

  /**
   * Discover schema by sampling documents from Algolia
   * Returns information about available fields for filtering
   */
  private async discoverSchema(): Promise<SchemaInfo> {
    if (this.schemaInfo) {
      return this.schemaInfo;
    }

    try {
      // Sample a few documents to discover schema
      const results = await this.algoliaClient.search({
        requests: [
          {
            indexName: this.indexName,
            query: "", // Empty query to get any documents
            hitsPerPage: 3,
          },
        ],
      });

      const hits = (results.results[0] as any).hits || [];

      if (hits.length > 0) {
        const sampleHit = hits[0] as Record<string, any>;

        // Identify date fields
        const dateFields: string[] = [];
        for (const [key, value] of Object.entries(sampleHit)) {
          if (
            typeof value === "number" &&
            ["publishdate", "closingdate", "created", "updated", "posteddate"].includes(key.toLowerCase())
          ) {
            dateFields.push(key);
          }
        }

        this.schemaInfo = {
          date_fields: dateFields,
          sample_keys: Object.keys(sampleHit),
        };

        console.log(`Discovered schema - Date fields: ${dateFields.join(", ")}`);
        return this.schemaInfo;
      }
    } catch (e) {
      console.error("Schema discovery failed:", e);
    }

    // Fallback to known fields
    this.schemaInfo = {
      date_fields: ["publishDate", "closingDate", "created", "updated"],
      sample_keys: ["title", "location", "site", "categories", "keywords"],
    };

    return this.schemaInfo;
  }

  /**
   * Convert natural language date range to Algolia filter string
   */
  private parseDateRange(dateRange: string = ""): string {
    if (!dateRange) {
      return "";
    }

    const now = new Date();
    let start: Date;
    let end: Date;

    // Convert to lowercase for case-insensitive matching
    const range = dateRange.toLowerCase().trim();

    if (range === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (range === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    } else if (range === "past_week" || range === "past_7_days") {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      end = now;
    } else if (range === "past_month" || range === "past_30_days") {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      end = now;
    } else if (range === "past_3_months" || range === "past_90_days") {
      start = new Date(now);
      start.setDate(now.getDate() - 90);
      end = now;
    } else if (range.includes("_to_")) {
      // Custom range like "2025-01-01_to_2025-01-31"
      try {
        const [startStr, endStr] = range.split("_to_");
        start = new Date(startStr.trim());
        end = new Date(endStr.trim());
        end.setHours(23, 59, 59, 999);
      } catch {
        return "";
      }
    } else {
      return "";
    }

    // Convert to Unix timestamps in milliseconds
    const startTs = start.getTime();
    const endTs = end.getTime();

    return `created>=${startTs} AND created<=${endTs}`;
  }

  /**
   * Format timestamp to readable date
   */
  private formatTimestamp(timestamp: any): string | null {
    if (!timestamp) {
      return null;
    }
    try {
      const date = new Date(Number(timestamp));
      return date.toISOString().split("T")[0]; // YYYY-MM-DD format
    } catch {
      return null;
    }
  }

  /**
   * The actual search function that Gemini will call
   * Returns JSON string of results for Gemini to process
   */
  private async searchAlgoliaTool(
    query: string,
    filters: string = "",
    hitsPerPage: number = 5,
    dateRange: string = ""
  ): Promise<string> {
    try {
      // Parse date range into filter if provided
      const dateFilter = dateRange ? this.parseDateRange(dateRange) : "";

      // Combine date filter with custom filters
      let combinedFilters = "";
      if (dateFilter && filters) {
        combinedFilters = `(${dateFilter}) AND (${filters})`;
      } else if (dateFilter) {
        combinedFilters = dateFilter;
      } else if (filters) {
        combinedFilters = filters;
      }

      // Execute search
      const results = await this.algoliaClient.search({
        requests: [
          {
            indexName: this.indexName,
            query: query,
            hitsPerPage: hitsPerPage,
            attributesToRetrieve: ["*"],
            ...(combinedFilters && { filters: combinedFilters }),
          },
        ],
      });

      const searchResult = results.results[0] as any;
      const hits = searchResult.hits || [];
      const totalHits = searchResult.nbHits || 0;

      // Format results
      const formattedResults: SearchResult[] = hits.map((hit: any) => ({
        title: hit.title || "Untitled",
        description: hit.description || "",
        issuer: hit.issuer || "",
        location: hit.location || "",
        site: hit.site || "",
        siteUrl: hit.siteUrl || "",
        scrapedDate: this.formatTimestamp(hit.created),
        closingDate: this.formatTimestamp(hit.closingDate),
        publishDate: this.formatTimestamp(hit.publishDate),
        questionsDueByDate: this.formatTimestamp(hit.questionsDueByDate),
        cnStatus: hit.cnStatus || "",
        cnType: hit.cnType || "",
        categories: hit.categories || [],
        keywords: hit.keywords || [],
      }));

      const result: SearchToolResult = {
        success: true,
        total_matching_rfps: totalHits,
        returned_results: formattedResults.length,
        results: formattedResults,
      };

      return JSON.stringify(result, null, 2);
    } catch (e: any) {
      const result: SearchToolResult = {
        success: false,
        error: e.message || String(e),
      };
      return JSON.stringify(result);
    }
  }

  /**
   * Get statistical analysis using Algolia faceting
   * Returns aggregated counts grouped by the specified facet field
   */
  private async getStatisticsTool(
    facetBy: string,
    filters: string = "",
    dateRange: string = ""
  ): Promise<string> {
    try {
      // Parse date range into filter if provided
      const dateFilter = dateRange ? this.parseDateRange(dateRange) : "";

      // Combine date filter with custom filters
      let combinedFilters = "";
      if (dateFilter && filters) {
        combinedFilters = `(${dateFilter}) AND (${filters})`;
      } else if (dateFilter) {
        combinedFilters = dateFilter;
      } else if (filters) {
        combinedFilters = filters;
      }

      // Execute search with faceting
      const results = await this.algoliaClient.search({
        requests: [
          {
            indexName: this.indexName,
            query: "", // Empty query to get all results
            hitsPerPage: 0, // Don't need actual documents, just stats
            facets: [facetBy],
            ...(combinedFilters && { filters: combinedFilters }),
          },
        ],
      });

      const searchResult = results.results[0] as any;
      const totalRfps = searchResult.nbHits || 0;
      const facetData = searchResult.facets?.[facetBy] || {};

      // Format facet results with percentages
      const breakdown = Object.entries(facetData)
        .map(([value, count]) => ({
          value,
          count: count as number,
          percentage: totalRfps > 0 ? Math.round((count as number / totalRfps) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const result: StatisticsToolResult = {
        success: true,
        total_rfps: totalRfps,
        facet_field: facetBy,
        date_range: dateRange || "all_time",
        breakdown,
      };

      return JSON.stringify(result, null, 2);
    } catch (e: any) {
      const result: StatisticsToolResult = {
        success: false,
        error: e.message || String(e),
      };
      return JSON.stringify(result);
    }
  }

  /**
   * Create the Gemini function declarations for Algolia search
   * This tells Gemini how to call our search functions with correct schema
   */
  private async createSearchToolDeclaration(): Promise<any> {
    // Discover schema first
    const schema = await this.discoverSchema();
    const dateFieldsStr = schema.date_fields.join(", ");

    const filterDescription = `Optional Algolia filter string for refined search. ` +
      `Available date fields: ${dateFieldsStr}. ` +
      `IMPORTANT DATE FIELD MEANINGS:\n` +
      `- 'created': When the RFP was SCRAPED/ADDED to our database (use this for 'scrapped on' questions)\n` +
      `- 'publishDate': When the RFP was originally published on the source website\n` +
      `- 'closingDate': Submission deadline for the RFP\n` +
      `- 'updated': When the record was last modified\n\n` +
      `Date filter examples: 'created>=1728518400000 AND created<=1728604799000' for RFPs scraped in a date range. ` +
      `Location example: 'location:California'. Category example: 'categories:IT Services'. ` +
      `IMPORTANT: All dates must be Unix timestamps in milliseconds (not seconds).`;

    return [
      {
        functionDeclarations: [
          {
            name: "search_rfp_database",
            description:
              "Search the RFP (Request for Proposal) and solicitations database. " +
              "Use this tool to find government contracts, RFPs, bids, and procurement opportunities. " +
              "You can search by keywords, filter by date ranges, locations, or categories. " +
              "The database contains information about IT services, managed services, consulting, and other government contracts.",
            parameters: {
              type: "OBJECT" as any,
              properties: {
                query: {
                  type: "STRING" as any,
                  description:
                    "The search keywords or terms. For company/product names (Infor, Microsoft, Oracle, SAP, etc.), use the EXACT name only. For general topics, use descriptive terms (e.g., 'IT managed services', 'consulting', 'cloud migration')",
                },
                filters: {
                  type: "STRING" as any,
                  description: filterDescription,
                },
                date_range: {
                  type: "STRING" as any,
                  description:
                    "Simplified date filtering for when RFPs were scraped. " +
                    "Options: 'today', 'yesterday', 'past_week', 'past_month', 'past_3_months', " +
                    "or custom range like 'YYYY-MM-DD_to_YYYY-MM-DD'. " +
                    "Use this instead of manually constructing date filters.",
                },
                hits_per_page: {
                  type: "INTEGER" as any,
                  description:
                    "Number of results to return (default: 5, max: 50). For statistical counts, you only need 1 result since total_matching_rfps is returned.",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_rfp_statistics",
            description:
              "Get statistical analysis and trends from the RFP database using aggregation. " +
              "Use this for questions about patterns, trends, distributions, and percentages. " +
              "Examples: 'What % of RFPs are we pursuing?', 'Which states have most RFPs?', " +
              "'What are the trends?', 'How many RFPs by pursuit status?'",
            parameters: {
              type: "OBJECT" as any,
              properties: {
                facet_by: {
                  type: "STRING" as any,
                  description:
                    "Field to group/aggregate by for statistics. Options:\n" +
                    "- 'cnStatus': Pursuit status breakdown (pursuing, notPursuing, monitor, researching, submitted)\n" +
                    "- 'location': Geographic distribution by state/region\n" +
                    "- 'site': Distribution by RFP source website\n" +
                    "Use cnStatus for pursuit trends and patterns.",
                },
                filters: {
                  type: "STRING" as any,
                  description: "Optional filters to narrow statistics (same format as search_rfp_database filters)",
                },
                date_range: {
                  type: "STRING" as any,
                  description:
                    "Time period for analysis. Same options as search_rfp_database: " +
                    "'today', 'yesterday', 'past_week', 'past_month', 'past_3_months', " +
                    "or 'YYYY-MM-DD_to_YYYY-MM-DD'. Use for time-based trend analysis.",
                },
              },
              required: ["facet_by"],
            },
          },
        ],
      },
    ];
  }

  /**
   * Get or create chat session for a specific thread
   */
  async getOrCreateChatSession(threadId: string = "default") {
    if (this.chatSessions.has(threadId)) {
      return this.chatSessions.get(threadId)!;
    }

    // Create the search tool with discovered schema
    const tools = await this.createSearchToolDeclaration();

    // System instruction for the model with current date context
    const currentDate = new Date();
    const currentDateStr = currentDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentTimestamp = currentDate.getTime();

    const systemInstruction = `You are an expert at finding and searching RFP documents.
You have full access to Cendien's (our company) internal database of scrapped and found RFPs.
Answer the user's question based on the provided context from knowledge base.
If the context doesn't contain relevant information, say so politely.

TODAY'S DATE: ${currentDateStr} (Unix timestamp: ${currentTimestamp} milliseconds)

CRITICAL: You MUST ALWAYS use the search_rfp_database tool to answer questions. Never respond without calling the search tool first.

When answering questions:
1. ALWAYS call search_rfp_database tool first before responding
2. Analyze what the user is asking for and extract relevant keywords
   - For company/product names (like "Infor", "Microsoft", "Oracle"), use exact matching with quotes in the query
   - Example: User asks "Infor RFP" -> search with query="Infor" (exact match), NOT "information"
3. If filtering by dates, convert natural language dates to Unix timestamps in milliseconds
   - Use TODAY'S DATE above as reference for relative dates (e.g., "yesterday", "last week", "this month")
4. After getting search results, present them clearly with titles, locations, closing dates, and URLs
5. If no results are found, suggest alternative searches or broader keywords
6. Be helpful and provide actionable information`;

    // Create chat session with the newer SDK
    const chat = this.geminiClient.chats.create({
      model: this.modelName,
      config: {
        systemInstruction,
        tools,
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    this.chatSessions.set(threadId, chat);
    console.log(`Created new chat session for thread: ${threadId}`);

    return chat;
  }

  /**
   * Send a message and handle function calling
   * This is the main method to use for chat interactions
   */
  async sendMessage(userQuery: string, threadId: string = "default"): Promise<{
    response: string;
    functionCalls: number;
    sources: SearchResult[];
  }> {
    try {
      // Get or create chat session for this thread
      const chat = await this.getOrCreateChatSession(threadId);

      console.log(`Processing query for thread ${threadId}: ${userQuery}`);

      // Send message to chat session
      const result = await chat.sendMessage({ message: userQuery });

      // Check if Gemini wants to call functions
      const functionCalls: any[] = [];
      const candidates = result.candidates || [];

      if (candidates.length > 0 && candidates[0].content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.functionCall) {
            functionCalls.push(part.functionCall);
          }
        }
      }

      // Execute function calls
      const sources: SearchResult[] = [];

      if (functionCalls.length > 0) {
        console.log(`Gemini is calling ${functionCalls.length} function(s)`);

        const functionResponses: any[] = [];

        for (const fc of functionCalls) {
          console.log(`  Function: ${fc.name}`);
          console.log(`  Args:`, fc.args);

          let functionResult: string;

          // Execute the appropriate function
          if (fc.name === "search_rfp_database") {
            functionResult = await this.searchAlgoliaTool(
              fc.args?.query || "",
              fc.args?.filters || "",
              fc.args?.hits_per_page || 5,
              fc.args?.date_range || ""
            );

            // Parse results for source tracking
            const resultData: SearchToolResult = JSON.parse(functionResult);
            if (resultData.success && resultData.results) {
              sources.push(...resultData.results);
            }
          } else if (fc.name === "get_rfp_statistics") {
            functionResult = await this.getStatisticsTool(
              fc.args?.facet_by || "cnStatus",
              fc.args?.filters || "",
              fc.args?.date_range || ""
            );

            // For statistics, add a metadata entry to show total analyzed
            const resultData: StatisticsToolResult = JSON.parse(functionResult);
            if (resultData.success && resultData.total_rfps) {
              sources.push({
                title: `Statistical Analysis of ${resultData.total_rfps} RFPs`,
                description: `Analyzed by ${resultData.facet_field || "field"}`,
                siteUrl: "",
                site: "Statistics",
                scrapedDate: null,
                closingDate: null,
                publishDate: null,
                questionsDueByDate: null,
                issuer: "",
                location: "",
                cnStatus: "",
                cnType: "",
                categories: [],
                keywords: [],
              });
            }
          } else {
            functionResult = JSON.stringify({
              success: false,
              error: `Unknown function: ${fc.name}`,
            });
          }

          // Create function response
          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: { result: functionResult },
            },
          });
        }

        // Send function results back to chat session
        const finalResult = await chat.sendMessage({ message: functionResponses });

        return {
          response: finalResult.text || "",
          functionCalls: functionCalls.length,
          sources,
        };
      }

      // No function call needed - return direct response
      return {
        response: result.text || "",
        functionCalls: 0,
        sources: [],
      };
    } catch (e: any) {
      console.error("Error generating response:", e);
      throw new Error(`Error generating response: ${e.message || String(e)}`);
    }
  }

  /**
   * Close clients
   */
  async close(): Promise<void> {
    try {
      // Clear chat sessions
      this.chatSessions.clear();
    } catch (e) {
      console.error("Error closing clients:", e);
    }
  }
}
