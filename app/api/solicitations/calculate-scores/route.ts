import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// 1. DEFINE ZOD SCHEMAS (Single Source of Truth)

// Simple output: just ID -> score mapping
const ScoreMapSchema = z.record(
  z.string().describe("Solicitation ID"),
  z.number().min(0).max(1).describe("Relevance score from 0.0 to 1.0")
).describe("Map of solicitation IDs to their relevance scores");

// Successful response
const SuccessResponseSchema = z.object({
  success: z.literal(true),
  scores: ScoreMapSchema,
});

// Error response when model cannot process
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().describe("Reason the model could not score the RFPs"),
});

// Robust union schema (maps to 'anyOf')
const RobustScoreSchema = z.union([SuccessResponseSchema, ErrorResponseSchema]);

// Infer TypeScript types
type RobustResponse = z.infer<typeof RobustScoreSchema>;

export async function POST(request: NextRequest) {
  try {
    const { solicitations } = await request.json();

    if (!Array.isArray(solicitations) || solicitations.length === 0) {
      return NextResponse.json(
        { error: "No solicitations provided" },
        { status: 400 }
      );
    }

    // First, check for solicitations that already have scores < 50% but aren't marked as nonRelevant
    const solsWithLowScores = solicitations.filter(
      (sol) => sol.aiPursueScore !== null &&
               sol.aiPursueScore !== undefined &&
               sol.aiPursueScore < 0.5 &&
               sol.cnType !== "nonRelevant"
    );

    const lowScoreUpdates: Record<string, { score: number; cnType: string }> = {};
    for (const sol of solsWithLowScores) {
      lowScoreUpdates[sol.id] = {
        score: sol.aiPursueScore,
        cnType: "nonRelevant"
      };
    }

    console.log(`[Calculate Scores] Found ${solsWithLowScores.length} items with existing scores < 50% that need cnType update`);

    // Filter to only process "new" status solicitations without scores
    const newSolicitations = solicitations.filter(
      (sol) => sol.cnStatus === "new" && (sol.aiPursueScore === null || sol.aiPursueScore === undefined)
    );

    // If no new solicitations but have low score updates, return those
    if (newSolicitations.length === 0 && Object.keys(lowScoreUpdates).length > 0) {
      return NextResponse.json({
        success: true,
        scores: {},
        updates: lowScoreUpdates,
        processedCount: 0,
        lowScoreUpdatesCount: Object.keys(lowScoreUpdates).length,
        totalCount: solicitations.length,
        message: `No new scores to calculate, but ${Object.keys(lowScoreUpdates).length} items with low scores marked as nonRelevant`
      });
    }

    if (newSolicitations.length === 0) {
      return NextResponse.json(
        { error: "No solicitations with 'new' status and no existing scores found" },
        { status: 400 }
      );
    }

    console.log(`[Calculate Scores] Processing ${newSolicitations.length} solicitations`);

    // 2. INITIALIZE GEMINI CLIENT
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.ANALYSIS_MODEL_DEFAULT || "gemini-2.0-flash-exp";

    // 3. DEFINE JSON SCHEMA DIRECTLY (zod-to-json-schema doesn't handle unions well)
    const scoreJsonSchema = {
      type: "object",
      properties: {
        success: { type: "boolean" },
        scores: {
          type: "object",
          additionalProperties: {
            type: "number",
            minimum: 0,
            maximum: 1
          }
        },
        error: { type: "string" }
      },
      required: ["success"],
      anyOf: [
        {
          properties: {
            success: { const: true },
            scores: { type: "object" }
          },
          required: ["success", "scores"]
        },
        {
          properties: {
            success: { const: false },
            error: { type: "string" }
          },
          required: ["success", "error"]
        }
      ]
    };

    // 4. DEFINE SYSTEM INSTRUCTION (Behavioral Control - Role & Context Only)
    const systemInstruction = {
      parts: [{
        text: `You are an AI RFP Sourcing Agent for Cendien, a specialized IT services and staffing firm. Your goal is to evaluate RFP opportunities and assign a relevance score from 0.0 to 1.0 based on how well they match Cendien's business profile.

CENDIEN'S BUSINESS PROFILE:

Core Services:
- Managed IT Services (especially "co-managed" models)
- IT Staff Augmentation / Staffing Services
- Specialized ERP Support (Oracle, Infor/Lawson, PeopleSoft, Workday)

Target Clients:
- Public Sector (City, County, State, Federal Government)
- Public Utilities & Transit Authorities (Water Districts, Power, Transportation)
- Public Education (School Districts, Universities)
- Public Health (Hospitals, Health Commissions)

Key Differentiators (Score Boosters):
- Certified Minority Business Enterprise (MBE)
- Compliance Expertise: CJIS, HIPAA, NIST, PCI
- Headquartered in Dallas, Texas (strong presence in TX, CA, NC, IL, OH, VA, FL, GA)`
      }]
    };

    // 5. BUILD USER PROMPT (Task Definition - Detailed Instructions & Data)
    const solicitationsText = newSolicitations.map((sol) =>
`ID: ${sol.id}
Title: ${sol.title || 'N/A'}
Description: ${sol.description || 'N/A'}
Issuer: ${sol.issuer || 'N/A'}
Location: ${sol.location || 'N/A'}`
    ).join("\n\n");

    const prompt = `Evaluate the following RFPs and assign a relevance score (0.0 to 1.0) for each based on Cendien's profile.

SCORING LOGIC:

Step 1: Base Score & Irrelevance Filter
Start with 0.0. If clearly non-IT services (construction, janitorial, legal, landscaping, heavy equipment, uniforms, architectural design), assign 0.0 and stop.

Step 2: Core Service Match (+0.4)
Add +0.4 if Title or Description mentions: "Managed IT Services", "IT Support", "IT Staff Augmentation", "IT Staffing", "IT Consultant", "Help Desk", "Network Management", "Cybersecurity", "Infor", "ERP", "Oracle" "Application Managed Services" (AMS)

Step 3: Client Sector Match (+0.3)
Add +0.3 if Issuer or Description mentions: "City of", "County of", "Township of", "Village of", "Public Utility", "Water District", "Transit Authority", "Transportation", "School District", "University", "College", "Public Health", "DMV"

STOP: If still 0.0 after Steps 2 and 3, assign 0.0 (not IT services OR not public sector).

Step 4: High-Value ERP Match (+0.3)
Add +0.3 if any ERP keyword found: "Oracle", "PeopleSoft", "Infor", "Lawson", "Workday"

Step 5: Differentiator Match (+0.25)
Add +0.15 for diversity requirement: "MBE", "Minority Business Enterprise", "Supplier Diversity"
Add +0.1 for compliance: "CJIS", "HIPAA", "NIST", "PCI"

Step 6: Geographic (+0.1)
- Add +0.1 if Location is "Texas" (Home state)
- Add +0.05 if Location is "California", "North Carolina", "Illinois", "Ohio", "Virginia", "Florida", or "Georgia" (Strong reference states)

Step 7: Final Score
Sum all steps. Cap at 1.0.

SCORING EXAMPLES:
- 1.0 = Perfect Match: ERP + Public Sector + Texas/MBE (e.g., "City of Dallas seeks MBE for Oracle Managed Services")
- 0.7 = Strong Match: "Managed IT Services" from city/county
- 0.4-0.6 = Potential: Partial match, single service
- 0.0 = Irrelevant: Non-IT or non-public sector

OUTPUT FORMAT:
Return JSON with this exact structure:
{
  "success": true,
  "scores": {
    "id1": 0.7,
    "id2": 0.95,
    ...
  }
}

If you cannot process the input, return:
{
  "success": false,
  "error": "reason"
}

RFPs TO EVALUATE:

${solicitationsText}`;

    // 6. CONFIGURE GENERATION (Format Control)
    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: scoreJsonSchema as any,
      maxOutputTokens: 1000,
      temperature: 0.2,
      topP: 0.85,
    };

    // 7. EXECUTE API CALL (Correct Structure)
    console.log(`[Calculate Scores] Calling Gemini with model: ${modelName}`);
    console.log(`[Calculate Scores] Generation Config:`, JSON.stringify(generationConfig, null, 2));
    console.log(`[Calculate Scores] Response Schema:`, JSON.stringify(scoreJsonSchema, null, 2));

    const requestConfig = {
      model: modelName,
      systemInstruction,
      generationConfig,
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    } as any;

    console.log(`[Calculate Scores] Full Request Config:`, JSON.stringify(requestConfig, null, 2));

    const response = await ai.models.generateContent(requestConfig);

    // 8. EXTRACT AND VALIDATE RESPONSE
    let jsonText = response.text;
    console.log(`[Calculate Scores] Raw JSON response:`, jsonText);

    if (!jsonText) {
      throw new Error("No response text from AI");
    }

    // Strip markdown code blocks if present (workaround for SDK issue)
    jsonText = jsonText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    console.log(`[Calculate Scores] Cleaned JSON:`, jsonText);

    // Parse JSON
    const parsedJson = JSON.parse(jsonText);

    // VALIDATE using Zod schema (Runtime Type Safety)
    const validatedResponse: RobustResponse = RobustScoreSchema.parse(parsedJson);

    // 9. HANDLE ROBUST RESPONSE
    if (!validatedResponse.success) {
      // Model reported an error
      console.error(`[Calculate Scores] Model error:`, validatedResponse.error);
      return NextResponse.json(
        {
          error: "AI could not process the solicitations",
          details: validatedResponse.error
        },
        { status: 500 }
      );
    }

    // Success case - extract scores (already in the right format)
    const scores = validatedResponse.scores;

    console.log(`[Calculate Scores] Validated ${Object.keys(scores).length} scores`);

    if (Object.keys(scores).length === 0) {
      return NextResponse.json(
        { error: "No valid scores returned from AI" },
        { status: 500 }
      );
    }

    // 10. BUILD UPDATES INCLUDING cnType FOR LOW SCORES
    const updates: Record<string, { score: number; cnType?: string }> = {};
    for (const [id, score] of Object.entries(scores)) {
      updates[id] = { score };
      // Set cnType to "nonRelevant" for scores < 50%
      if (score < 0.5) {
        updates[id].cnType = "nonRelevant";
      }
    }

    // Merge with lowScoreUpdates
    const allUpdates = { ...lowScoreUpdates, ...updates };

    return NextResponse.json({
      success: true,
      scores,
      updates: allUpdates,
      processedCount: Object.keys(scores).length,
      lowScoreUpdatesCount: Object.keys(lowScoreUpdates).length,
      totalCount: newSolicitations.length,
    });

  } catch (error: any) {
    console.error("[Calculate Scores] Error:", error);

    // Provide more detailed error info
    let errorMessage = error.message || "Failed to calculate scores";

    if (error instanceof z.ZodError) {
      errorMessage = `Validation error: ${JSON.stringify(error.issues)}`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
