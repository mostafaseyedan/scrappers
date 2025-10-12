import { genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/google-genai";
import { NextRequest, NextResponse } from "next/server";
import determineIntent from "@/ai/flows/determineIntent";

const model = googleAI.model("gemini-2.0-flash");

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_KEY })],
  model,
});

const determineIntentFlow = determineIntent(ai);

export const POST = async (request: NextRequest) => {
  const { message } = await request.json();

  const intent = await determineIntentFlow({ inputMessage: message });
  const chat = ai.chat({ system: intent.system, tools: intent.tools });
  const response = await chat.send(message).catch((err) => {
    console.error("AI chat error:", err);
  });

  const responseMessage =
    response?.message?.content?.[0]?.text ||
    "I'm sorry, I didn't understand that.";

  return NextResponse.json({ response: responseMessage, intent });
};
