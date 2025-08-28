import { onRequest } from "firebase-functions/v2/https";
import { run as ppInvitedSols } from "../playwright/rfpSearch/publicpurchase/invitedSols";
import { run as bidsyncDashboardSols } from "../playwright/rfpSearch/bidsync/dashboardSols";
import { run as vendorRegistryDashboardSols } from "../playwright/rfpSearch/vendorregistry/dashboardSols";
import { run as biddirectDashboardSols } from "../playwright/rfpSearch/biddirect/dashboardSols";
import { run as vendorlineDashboardSols } from "../playwright/rfpSearch/vendorline/dashboardSols";
import { run as techbidDashboardSols } from "../playwright/rfpSearch/techbids/dashboardSols";
import { run as instantGetSols } from "../playwright/rfpSearch/instantmarkets/getSols";
import { run as mygovwatch } from "../playwright/rfpSearch/mygovwatch/dashboardSols";
import { run as governmentbidders } from "../playwright/rfpSearch/governmentbidders/sols";
import { run as demandstar } from "../playwright/rfpSearch/demandstar/sols";
import { run as highergov } from "../playwright/rfpSearch/highergov/sols";
import { logger } from "firebase-functions";
import { scriptLog as logModel } from "../models";
import { secToTimeStr } from "../lib/utils";
import { chromium, Browser } from "playwright-core";
// import Browserbase from "@browserbasehq/sdk";

const vendors = {
  biddirect: biddirectDashboardSols,
  bidsync: bidsyncDashboardSols,
  demandstar,
  governmentbidders,
  highergov,
  instantmarkets: instantGetSols,
  mygovwatch,
  publicpurchase: ppInvitedSols,
  techbids: techbidDashboardSols,
  vendorline: vendorlineDashboardSols,
  vendorregistry: vendorRegistryDashboardSols,
};

type Results = {
  counts?: {
    success: number;
    fail: number;
    dup: number;
    junk: number;
  };
  [key: string]: any;
};

export async function runVendor(
  vendor: keyof typeof vendors,
  env: Record<string, any>
) {
  const baseUrl = env.BASE_URL || "http://localhost:5002";
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  // const BROWSERBASE_KEY = env.DEV_BROWSERBASE_KEY!;

  let page;
  let status = 200;
  let results: Results = {};
  let counts = { success: 0, dup: 0, junk: 0, fail: 0 };

  performance.mark("start");

  /*
  const bb = new Browserbase({
    apiKey: BROWSERBASE_KEY,
  });

  const session = await bb.sessions.create({
    projectId: "ab8af307-2e85-4ce6-86c4-a9d7751bf2a7",
    userMetadata: {
      vendor,
    },
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  page = context.pages()[0];
  */

  const browser: Browser = await chromium.launch({
    headless: false,
    slowMo: 50, // Slow down for debugging
  });
  const context = await browser.newContext();
  page = await context.newPage();

  try {
    if (!vendors[vendor]) {
      status = 400;
      throw new Error("Invalid or missing script parameters");
    }

    results = await vendors[vendor](
      page,
      {
        ...process.env,
        BASE_URL: baseUrl,
      },
      context
    );
    counts = { ...counts, ...results.counts };
  } catch (e: any) {
    logger.error(e);
    status = 500;
    results = { error: e.message };
    logger.debug("BODY OUTPUT", await page?.locator("body").innerText());
  } finally {
    await browser.close();
    performance.mark("end");

    const totalTime = (
      performance.measure("end", "start").duration / 1000
    ).toFixed(0);

    // Save log
    await logModel.post({
      baseUrl,
      token: SERVICE_KEY,
      data: {
        message: `${status !== 200 ? "Error: " : ""}Scraped ${
          counts.success
        } solicitations from ${vendor}. ${
          counts.fail > 0 ? `Found ${counts.fail} failures. ` : ""
        } ${counts.dup > 0 ? `Found ${counts.dup} duplicates. ` : ""}`,
        scriptName: `firefunctions/${vendor}`,
        status: status === 200 ? "success" : "error",
        dupCount: counts.dup,
        successCount: counts.success,
        junkCount: counts.junk,
        timeStr: secToTimeStr(Number(totalTime)),
        data: {
          ...(results.sols ? { sols: results.sols } : {}),
          ...(results.error ? { error: results.error } : {}),
        },
      },
    });
  }

  return { status, results };
}

export const playwright = onRequest(
  {
    memory: "1GiB",
    secrets: [
      "DEV_BIDDIRECT_USER",
      "DEV_BIDDIRECT_PASS",
      "DEV_BIDSYNC_USER",
      "DEV_BIDSYNC_PASS",
      "DEV_BROWSERBASE_KEY",
      "DEV_DEMANDSTAR_USER",
      "DEV_DEMANDSTAR_PASS",
      "DEV_GEMINI_KEY",
      "DEV_HIGHERGOV_USER",
      "DEV_HIGHERGOV_PASS",
      "DEV_INSTANTMARKETS_USER",
      "DEV_INSTANTMARKETS_PASS",
      "DEV_PUBLICPURCHASE_USER",
      "DEV_PUBLICPURCHASE_PASS",
      "DEV_SERVICE_KEY",
      "DEV_TECHBIDS_USER",
      "DEV_TECHBIDS_PASS",
      "DEV_VENDORREGISTRY_USER",
      "DEV_VENDORREGISTRY_PASS",
      "DEV_VENDORLINE_USER",
      "DEV_VENDORLINE_PASS",
    ],
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    const vendor = req.query.vendor as keyof typeof vendors;
    const { status, results } = await runVendor(vendor, { ...process.env });
    res.status(status).json(results);
  }
);
