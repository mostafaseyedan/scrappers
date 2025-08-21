import { onRequest } from "firebase-functions/v2/https";
import playwrightCore from "playwright-core";
import chromium from "@sparticuz/chromium";
import { run as ppInvitedSols } from "../playwright/rfpSearch/publicpurchase/invitedSols";
import { run as bidsyncDashboardSols } from "../playwright/rfpSearch/bidsync/dashboardSols";
import { run as vendorRegistryDashboardSols } from "../playwright/rfpSearch/vendorregistry/dashboardSols";
import { run as biddirectDashboardSols } from "../playwright/rfpSearch/biddirect/dashboardSols";
import { run as vendorlineDashboardSols } from "../playwright/rfpSearch/vendorline/dashboardSols";
import { run as techbidDashboardSols } from "../playwright/rfpSearch/techbids/dashboardSols";
import { logger } from "firebase-functions";
import { scriptLog as logModel } from "../models";
import { secToTimeStr } from "../lib/utils";

// import { chromium } from "playwright-core";

const vendors = {
  biddirect: biddirectDashboardSols,
  bidsync: bidsyncDashboardSols,
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
  let results: Results = {};
  let page;
  let counts = { success: 0, dup: 0, junk: 0, fail: 0 };

  performance.mark("start");

  try {
    if (!vendors[vendor]) {
      status = 400;
      throw new Error("Invalid or missing script parameters");
    }

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    });
    page = await context.newPage();
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

    return { status, results };
  }
}

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
