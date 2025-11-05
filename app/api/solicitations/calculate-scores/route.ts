import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const VERTEX_PROJECT = process.env.VERTEX_GCLOUD_PROJECT || "cendien-sales-support-ai";
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || "us-central1";
const VERTEX_RAG_CORPUS_ID = process.env.VERTEX_RAG_CORPUS_ID || "sharepoint-files-datastore";
const VERTEX_SEARCH_LOCATION = process.env.VERTEX_SEARCH_LOCATION || "global";

export async function POST(request: NextRequest) {
  try {
    const { solicitations } = await request.json();

    if (!Array.isArray(solicitations) || solicitations.length === 0) {
      return NextResponse.json(
        { error: "No solicitations provided" },
        { status: 400 }
      );
    }

    // Filter to only process "new" status solicitations
    const newSolicitations = solicitations.filter(
      (sol) => sol.cnStatus === "new"
    );

    if (newSolicitations.length === 0) {
      return NextResponse.json(
        { error: "No solicitations with 'new' status found" },
        { status: 400 }
      );
    }

    console.log(`[Calculate Scores] Processing ${newSolicitations.length} solicitations with 'new' status`);

    // Initialize Vertex AI client using SDK (like reference code)
    const vertexGenai = new GoogleGenAI({
      vertexai: true,
      project: VERTEX_PROJECT,
      location: VERTEX_LOCATION,
    });

    const modelName = "gemini-2.5-flash";

    // Build the system instruction (SHORT - just role and grounding access)
    const systemInstruction = `You are an expert RFP analyst for Cendien (Arisma LLC dba Cendien).

**IMPORTANT - Use Grounding Tool**: You have access to a Vertex AI Search Datastore containing Cendien's internal knowledge base. Query this datastore to understand Cendien's capabilities and past experience.`;

    // Build solicitations text
    const solicitationsText = newSolicitations.map((sol, index) =>
`RFP ${index + 1}:
ID: ${sol.id}
Title: ${sol.title || 'N/A'}
Description: ${sol.description || 'N/A'}
Issuer: ${sol.issuer || 'N/A'}
Location: ${sol.location || 'N/A'}
Keywords: ${sol.keywords?.join(", ") || 'N/A'}
Categories: ${sol.categories?.join(", ") || 'N/A'}`
    ).join("\n\n");

    // Build the prompt (DETAILED - task, criteria, examples)
    const prompt = `# RFP SCORING TASK

STEP 1: Use your Vertex AI Search Datastore tool to search for Cendien's capabilities, services, and past project experience.

STEP 2: Evaluate each RFP below based on how well it matches what you found about Cendien.

## RFPs TO EVALUATE

${solicitationsText}

## EVALUATION CRITERIA

Score each RFP based on alignment with Cendien's core competencies:
- ERP implementations (Infor CloudSuite, Infor Lawson, Workday)
- Human Capital Management (HCM, HR, Payroll, Benefits, Talent Management)
- IT Managed Services (24/7 support, helpdesk, cloud migrations, disaster recovery)
- Financial systems (FSM, Financials, Supply Chain Management)
- Public sector and government experience
- System integrations, migrations, and upgrades

## SCORING GUIDELINES

- 1.0: Perfect match with Cendien's core services, means the solicitation has all the criteria (rarely happens)
- 0.9-0.99: Excellent fit with strong relevant experience (9 out of 10 criteria met)
- 0.7-0.9: Good fit with some relevant experience
- 0.4-0.6: Moderate fit, may require additional resources
- 0.0-0.3: Poor fit, outside core competencies

## OUTPUT FORMAT

Return ONLY scores in this EXACT format, one per line:
RFP ID <id>: <score>

Example:
RFP ID abc123: 0.85
RFP ID xyz789: 0.92

**IMPORTANT**: Do not include any explanations, analysis, markdown formatting, headers, or additional text. ONLY the ID and score lines.`;

    // Build the Vertex AI request using SDK (like reference code)
    const datastorePath = `projects/${VERTEX_PROJECT}/locations/${VERTEX_SEARCH_LOCATION}/collections/default_collection/dataStores/${VERTEX_RAG_CORPUS_ID}`;

    const requestConfig = {
      model: modelName,
      contents: prompt,
      systemInstruction: systemInstruction,
      config: {
        maxOutputTokens: 5000,
        temperature: 0.3,
        topP: 0.85,
        tools: [
          {
            retrieval: {
              vertexAiSearch: {
                datastore: datastorePath,
              },
              disableAttribution: true,
            },
          },
        ],
      },
    };

    console.log(`[Calculate Scores] Calling Vertex AI with model: ${modelName}`);
    console.log(`[Calculate Scores] Using datastore: ${datastorePath}`);
    console.log(`[Calculate Scores] System Instruction:`, systemInstruction);
    console.log(`[Calculate Scores] Prompt:`, prompt);

    // Call Vertex AI using SDK
    const response = await vertexGenai.models.generateContent(requestConfig);

    // Extract response text
    const candidate = response?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let responseText = "";

    for (const part of parts) {
      if (part.text) {
        responseText += part.text;
      }
    }

    if (!responseText) {
      throw new Error("No response text from AI");
    }

    console.log(`[Calculate Scores] AI Response:`, responseText);
    console.log(`[Calculate Scores] Full AI Response Object:`, JSON.stringify(response, null, 2));

    // Parse scores from response
    const scores: Record<string, number> = {};
    const lines = responseText.split("\n");

    for (const line of lines) {
      // Match format: "RFP ID xyz123: 0.85" or "RFP ID xyz123: 75"
      const match = line.match(/RFP ID\s+([^\s:]+):\s*(\d+\.?\d*|\d*\.\d+)/i);
      if (match) {
        const id = match[1];
        let score = parseFloat(match[2]);

        // If score is > 1, assume it's a percentage and divide by 100
        if (score > 1) {
          score = score / 100;
        }

        if (!isNaN(score) && score >= 0 && score <= 1) {
          scores[id] = score;
        }
      }
    }

    console.log(`[Calculate Scores] Parsed scores:`, scores);

    if (Object.keys(scores).length === 0) {
      return NextResponse.json(
        { error: "Failed to parse scores from AI response", rawResponse: responseText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scores,
      processedCount: Object.keys(scores).length,
      totalCount: newSolicitations.length,
    });
  } catch (error: any) {
    console.error("[Calculate Scores] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate scores" },
      { status: 500 }
    );
  }
}
