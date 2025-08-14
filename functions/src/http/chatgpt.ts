import OpenAI from "openai";
import { onRequest } from "firebase-functions/v2/https";
import { solicitation as solModel, scriptLog as logModel } from "../models";
import bidmainPrompt from "../aiPrompts/rfpSearch/bidmain";
import bidsyncPrompt from "../aiPrompts/rfpSearch/bidsync";
import centralauctionPrompt from "../aiPrompts/rfpSearch/centralauction";
import webPrompt from "../aiPrompts/rfpSearch/web";
import vendorregistryPrompt from "../aiPrompts/rfpSearch/vendorregistry";
import { logger } from "firebase-functions";
import { secToTimeStr } from "../lib/utils";

const prompts = {
  bidmain: bidmainPrompt,
  bidsync: bidsyncPrompt,
  centralauction: centralauctionPrompt,
  web: webPrompt,
  vendorregistry: vendorregistryPrompt,
};

export const chatgpt = onRequest(
  {
    secrets: ["DEV_OPENAI_API_KEY", "DEV_SERVICE_KEY"],
    timeoutSeconds: 60 * 60,
  },
  async (req, res) => {
    const BASE_URL = "http://localhost:3000";
    const TOKEN = process.env.DEV_SERVICE_KEY;
    let dupCount = 0;
    let failCount = 0;
    let successCount = 0;
    let junkCount = 0;
    let agentResponse;
    let status = 200;
    let results;
    performance.mark("start");
    const vendorRaw = req.query.vendor;
    const vendorStr = Array.isArray(vendorRaw) ? vendorRaw[0] : vendorRaw;
    const VENDOR = (
      typeof vendorStr === "string" && vendorStr.trim() in prompts
        ? vendorStr.trim()
        : undefined
    ) as keyof typeof prompts | undefined;

    logger.log(
      `ChatGpt Rfp ${VENDOR} Search Started`,
      new Date().toISOString()
    );

    if (!VENDOR || typeof VENDOR !== "string" || !VENDOR.trim()) {
      res.status(400).json({ error: "Missing query param 'vendor'" });
      return;
    }

    const apiKey = process.env.DEV_OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "DEV_OPENAI_API_KEY not configured" });
      return;
    }

    try {
      agentResponse = await runAgent({ vendor: VENDOR });
      logger.log({ agentResponse });

      // TODO save this response to cloud
      const json = JSON.parse(agentResponse.output_text);
      logger.log("Agent response received");

      for (const record of json) {
        logger.log(`\n${record.siteId} - ${record.title}`);

        const checkRecord = await solModel.get({
          baseUrl: BASE_URL,
          token: TOKEN,
          filters: { siteId: record.siteId },
        });

        if (checkRecord.results?.length) {
          logger.log("Record already exists ", checkRecord.results[0].id);
          dupCount++;

          /*
          await solModel.patch({
            id: checkRecord.results[0].id,
            baseUrl: BASE_URL,
            token: TOKEN,
            data: { ...record },
          });
          logger.log("  Updated existing record");
          */

          continue; // Skip if the record already exists
        }

        record.site = "chatgpt" + VENDOR;
        record.externalLinks = record.externalLinks?.split(",") || [];
        record.externalLinks = record.externalLinks.filter(
          (link: string) => link.trim() !== ""
        );

        const result = await solModel.post({
          baseUrl: BASE_URL,
          token: TOKEN,
          data: record,
        });
        logger.log("Saved", result.id);
        successCount++;
      }
    } catch (err) {
      logger.error("websearch failed", { error: (err as Error).message });
      failCount++;
      status = 500;
      results = { error: "Search failed" };
    } finally {
      performance.mark("end");
      const totalSec = Number(
        (
          performance.measure("total-duration", "start", "end").duration / 1000
        ).toFixed(0)
      );

      logger.log(
        `\nTotal time: ${secToTimeStr(totalSec)} ${new Date().toLocaleString()}`
      );
      logger.log(
        `Success: ${successCount}, Failures: ${failCount}, Duplicates: ${dupCount}, Junk: ${junkCount}`
      );

      const logRecord = {
        message: `Scraped ${successCount} solicitations from chatgpt${VENDOR}.`,
        timestamp: new Date().toISOString(),
        successCount,
        failCount,
        dupCount,
        junkCount,
        timeStr: secToTimeStr(totalSec),
        data: { chatgpt: agentResponse },
        status: "success",
      };

      if (results?.error) {
        logRecord.message = `Error: Failed to scrape solicitations from chatgpt${VENDOR}. ${results.error}`;
        logRecord.status = "error";
      }

      await logModel.post({
        baseUrl: BASE_URL,
        data: logRecord,
        token: TOKEN,
      });

      if (!results?.error) results = logRecord;
      logger.log({ status });

      res.status(status).json({ ...results });
    }
  }
);

async function runAgent({
  vendor,
}: {
  vendor: keyof typeof prompts;
}): Promise<any> {
  if (!vendor) throw new Error("Vendor is required for runAgent");
  if (!prompts[vendor])
    throw new Error(`No prompt found for vendor: ${vendor}`);

  const aiClient = new OpenAI({
    apiKey: process.env.DEV_OPENAI_API_KEY,
  });
  const response = await aiClient.responses.create({
    model: "gpt-5",
    tools: [{ type: "web_search_preview" }],
    input: prompts[vendor],
  });
  return response;
}
