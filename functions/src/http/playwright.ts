import { onRequest } from "firebase-functions/v2/https";
import playwrightCore from "playwright-core";
import chromium from "@sparticuz/chromium";
import { run } from "../playwright/rfpSearch/publicPurchase/invitedBids";
import { logger } from "firebase-functions";

export const playwright = onRequest(
  {
    memory: "1GiB",
    secrets: ["DEV_PUBLICPURCHASE_USER", "DEV_PUBLICPURCHASE_PASS"],
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    const browser = await playwrightCore.chromium.launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: chromium.args,
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      const results = await run(page, process.env);

      res.json(results);
    } catch (e: any) {
      logger.error(e);
      res.status(500).json({ error: e.message });
    } finally {
      await browser.close();
    }
  }
);
