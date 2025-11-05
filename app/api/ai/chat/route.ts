import { NextRequest, NextResponse } from "next/server";
import { AlgoliaGeminiTool } from "@/ai/tools/algoliaGeminiTool";
import { checkSession } from "@/lib/serverUtils";

// Initialize the Algolia Gemini Tool (singleton instance)
let algoliaGeminiTool: AlgoliaGeminiTool | null = null;

function getAlgoliaGeminiTool(): AlgoliaGeminiTool {
  if (!algoliaGeminiTool) {
    algoliaGeminiTool = new AlgoliaGeminiTool({
      algolia_app_id: process.env.ALGOLIA_ID,
      algolia_search_api_key: process.env.ALGOLIA_SEARCH_KEY,
      algolia_index: "solicitations",
      gemini_api_key: process.env.GEMINI_API_KEY,
      model: "gemini-2.0-flash-exp",
    });
  }
  return algoliaGeminiTool;
}

export const POST = async (request: NextRequest) => {
  const user = await checkSession(request);

  if (!user) throw new Error("Not authenticated");

  const { chatKey, message } = await request.json();
  let results;
  let status = 200;

  try {
    // Get the Algolia Gemini Tool instance
    const tool = getAlgoliaGeminiTool();

    // Send message and get response with function calling
    const { response, functionCalls, sources } = await tool.sendMessage(
      message,
      chatKey // Use chatKey as thread ID for conversation continuity
    );

    results = {
      response: response,
      functionCalls,
      sources,
    };
  } catch (error) {
    console.error("Failed to process AI chat post:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json(results, { status });
};
