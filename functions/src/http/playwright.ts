import { onRequest } from "firebase-functions/v2/https";
import playwrightCore from "playwright-core";
import chromium from "@sparticuz/chromium";
import { run as ppInvitedSols } from "../playwright/rfpSearch/publicpurchase/invitedSols";
import { run as bidsyncDashboardSols } from "../playwright/rfpSearch/bidsync/dashboardSols";
import { run as vendorRegistryDashboardSols } from "../playwright/rfpSearch/vendorregistry/dashboardSols";
import { run as biddirectDashboardSols } from "../playwright/rfpSearch/biddirect/dashboardSols";
import { logger } from "firebase-functions";

// import { chromium } from "playwright-core";

const scripts = {
  biddirect: biddirectDashboardSols,
  bidsync: bidsyncDashboardSols,
  publicpurchase: ppInvitedSols,
  vendorregistry: vendorRegistryDashboardSols,
};

export const playwright = onRequest(
  {
    memory: "1GiB",
    secrets: [
      "DEV_BIDDIRECT_USER",
      "DEV_BIDDIRECT_PASS",
      "DEV_BIDSYNC_USER",
      "DEV_BIDSYNC_PASS",
      "DEV_GEMINI_KEY",
      "DEV_PUBLICPURCHASE_USER",
      "DEV_PUBLICPURCHASE_PASS",
      "DEV_SERVICE_KEY",
      "DEV_VENDORREGISTRY_USER",
      "DEV_VENDORREGISTRY_PASS",
    ],
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    const script = req.query.script as keyof typeof scripts;
    /*
    const browser = await chromium.launch({
      headless: false,
      slowMo: 50, // Slow down for debugging
    });
    */
    const browser = await playwrightCore.chromium.launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: chromium.args,
    });
    let status = 200;
    let results;
    let page;

    try {
      if (!scripts[script]) {
        status = 400;
        throw new Error("Invalid or missing script parameters");
      }

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      });
      page = await context.newPage();

      const baseUrl = process.env.BASE_URL || "http://localhost:5002";
      results = await scripts[script](page, {
        ...process.env,
        BASE_URL: baseUrl,
      });
    } catch (e: any) {
      logger.error(e);
      status = 500;
      results = { error: e.message };
      logger.debug("body.innerHTML", await page?.innerHTML("body"));
    } finally {
      await browser.close();
      res.status(status).json(results);
    }
  }
);
