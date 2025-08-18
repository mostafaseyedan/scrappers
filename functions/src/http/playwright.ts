import { onRequest } from "firebase-functions/v2/https";
import playwrightCore from "playwright-core";
import chromium from "@sparticuz/chromium";
import { run as ppInvitedSols } from "../playwright/rfpSearch/publicpurchase/invitedSols";
import { run as bidsyncDashboardSols } from "../playwright/rfpSearch/bidsync/dashboardSols";
import { logger } from "firebase-functions";

const scripts = {
  "bidsync/dashboardSols": bidsyncDashboardSols,
  "publicpurchase/invitedSols": ppInvitedSols,
};

export const playwright = onRequest(
  {
    memory: "1GiB",
    secrets: [
      "DEV_BIDSYNC_USER",
      "DEV_BIDSYNC_PASS",
      "DEV_GEMINI_KEY",
      "DEV_PUBLICPURCHASE_USER",
      "DEV_PUBLICPURCHASE_PASS",
      "DEV_SERVICE_KEY",
    ],
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    const script = req.query.script as keyof typeof scripts;
    const browser = await playwrightCore.chromium.launch({
      executablePath: await chromium.executablePath(),
      headless: false,
      args: chromium.args,
    });
    let status = 200;
    let results;

    try {
      if (!scripts[script]) {
        status = 400;
        throw new Error("Invalid or missing script parameters");
      }

      const context = await browser.newContext();
      const page = await context.newPage();
      const baseUrl = process.env.BASE_URL || "http://localhost:5002";
      results = await scripts[script](page, {
        ...process.env,
        BASE_URL: baseUrl,
      });
    } catch (e: any) {
      logger.error(e);
      status = 500;
      results = { error: e.message };
    } finally {
      await browser.close();
      res.status(status).json(results);
    }
  }
);
