import { genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/google-genai";
import { NextRequest, NextResponse } from "next/server";
import determineIntent from "@/ai/flows/determineIntent";
import { chat_message as chatMessageModel } from "@/app/models2Server";
import { checkSession } from "@/lib/serverUtils";

const model = googleAI.model("gemini-2.0-flash");

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_KEY })],
  model,
});

const determineIntentFlow = determineIntent(ai);

export const POST = async (request: NextRequest) => {
  const user = await checkSession(request);

  if (!user) throw new Error("Not authenticated");

  const { chatKey, message } = await request.json();
  let results,
    status = 200,
    responseMessage;

  chatMessageModel.set({
    apiBaseUrl: process.env.BASE_URL + "/api",
    token: process.env.SERVICE_KEY,
    parentKey: chatKey,
  });

  try {
    const intent = await determineIntentFlow({ inputMessage: message });
    const chat = ai.chat({ system: intent.system, tools: intent.tools });
    const response = await chat.send(message).catch((err) => {
      console.error("AI chat error:", err);
    });

    responseMessage =
      response?.message?.content?.[0]?.text ||
      "I'm sorry, I didn't understand that.";

    await chatMessageModel.post({
      data: { senderId: user.uid, content: message },
    });
    await chatMessageModel.post({
      data: { senderId: "ai", content: responseMessage },
    });

    results = { response: responseMessage, intent };
  } catch (error) {
    console.error(`Failed to process ai chat post`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    responseMessage = errorMessage;
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json(results, { status });
};
