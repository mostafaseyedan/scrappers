// import OpenAI from "openai";
import { onRequest } from "firebase-functions/v2/https";
import { solicitation as solModel } from "../models";
// import default as webPrompt from "../chatGptPrompts/rfpSearch/web";

export const chatgpt = onRequest(
  {
    secrets: ["DEV_OPENAI_API_KEY", "DEV_SERVICE_KEY"],
    timeoutSeconds: 60 * 60,
  },
  async (req, res) => {
    const qRaw = req.query.q;
    const query = Array.isArray(qRaw) ? qRaw[0] : qRaw;

    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({ error: "Missing query param 'q'" });
      return;
    }

    const apiKey = process.env.DEV_OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "DEV_OPENAI_API_KEY not configured" });
      return;
    }

    const test = await solModel.get({
      baseUrl: "https://reconrfp.cendien.com",
      limit: 10,
      token: process.env.DEV_SERVICE_KEY,
    });

    res.json(test);

    /*
    try {
      const agentResponse = await runAgent();
      const json = JSON.parse(agentResponse.output_text);
      res.json(json);
    } catch (err) {
      logger.error("websearch failed", { error: (err as Error).message });
      res.status(500).json({ error: "Search failed" });
    } */
  }
);

/*
async function runAgent(): Promise<any> {
  const aiClient = new OpenAI({
    apiKey: process.env.DEV_OPENAI_API_KEY,
  });
  const response = await aiClient.responses.create({
    model: "gpt-5",
    tools: [{ type: "web_search_preview" }],
    input: webPrompt,
  });
  return response;
}
*/
