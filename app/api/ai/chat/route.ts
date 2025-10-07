import { genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/google-genai";
import { NextRequest, NextResponse } from "next/server";

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_KEY })],
  model: googleAI.model("gemini-2.5-pro"),
});

export const POST = async (request: NextRequest) => {
  const { message } = await request.json();
  const chat = ai.chat({
    system: "You are a helpful assistant.",
  });
  const response = await chat.send(message);
  let responseMessage;

  if (!response.message?.content?.[0]?.text) {
    responseMessage = "I'm sorry, I didn't understand that.";
  } else {
    responseMessage = response.message.content[0].text;
  }

  return NextResponse.json({ response: responseMessage });
};
