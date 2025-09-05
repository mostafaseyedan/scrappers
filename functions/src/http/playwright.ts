import { onRequest } from "firebase-functions/v2/https";
import { run as publicpurchase } from "../playwright/rfpSearch/publicpurchase/sols";
import { run as bidsync } from "../playwright/rfpSearch/bidsync/sols";
import { run as vendorregistry } from "../playwright/rfpSearch/vendorregistry/sols";
import { run as biddirect } from "../playwright/rfpSearch/biddirect/sols";
import { run as vendorline } from "../playwright/rfpSearch/vendorline/sols";
import { run as techbids } from "../playwright/rfpSearch/techbids/sols";
import { run as instantmarkets } from "../playwright/rfpSearch/instantmarkets/sols";
import { run as mygovwatch } from "../playwright/rfpSearch/mygovwatch/sols";
import { run as governmentbidders } from "../playwright/rfpSearch/governmentbidders/sols";
import { run as demandstar } from "../playwright/rfpSearch/demandstar/sols";
import { run as highergov } from "../playwright/rfpSearch/highergov/sols";
import { run as findrfp } from "../playwright/rfpSearch/findrfp/sols";
import { run as merx } from "../playwright/rfpSearch/merx/sols";
import { run as commbuys } from "../playwright/rfpSearch/commbuys/sols";
import { run as txsmartbuy } from "../playwright/rfpSearch/txsmartbuy/sols";
import { run as govdirections } from "../playwright/rfpSearch/govdirections/sols";
import { run as floridabids } from "../playwright/rfpSearch/floridabids/sols";
import { run as vendorlink } from "../playwright/rfpSearch/vendorlink/sols";
import { run as rfpmart } from "../playwright/rfpSearch/rfpmart/sols";
import { run as cammnet } from "../playwright/rfpSearch/cammnet/sols";
import { logger } from "firebase-functions";
import { scriptLog as logModel } from "../models";
import { secToTimeStr } from "../lib/utils";
import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";

const vendors = {
  biddirect,
  bidsync,
  cammnet,
  commbuys,
  demandstar,
  findrfp,
  floridabids,
  govdirections,
  governmentbidders,
  highergov,
  instantmarkets,
  merx,
  mygovwatch,
  publicpurchase,
  rfpmart,
  techbids,
  txsmartbuy,
  vendorline,
  vendorlink,
  vendorregistry,
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
  const BROWSERBASE_KEY = env.DEV_BROWSERBASE_KEY!;

  let page;
  let status = 200;
  let results: Results = {};
  let counts = { success: 0, dup: 0, junk: 0, fail: 0 };

  performance.mark("start");

  const bb = new Browserbase({
    apiKey: BROWSERBASE_KEY,
  });

  const session = await bb.sessions.create({
    projectId: "859b2230-84b0-449b-a2db-f9352988518c",
    proxies: true,
    userMetadata: {
      vendor,
    },
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  page = context.pages()[0];

  /*
  const browser: Browser = await chromium.launch({
    headless: false,
    // slowMo: 50, // Slow down for debugging
  });
  const context = await browser.newContext();
  page = await context.newPage();
  */

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

async function runWithConcurrency<T>(
  items: string[],
  fn: (item: string) => Promise<T>,
  concurrency: number
) {
  const results: Record<string, { ok: boolean; data?: T; error?: any }> = {};
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      try {
        logger.info("Vendor start", { vendor: item });
        const data = await fn(item);
        results[item] = { ok: true, data };
        logger.info("Vendor done", {
          vendor: item,
          status: (data as any).status,
        });
      } catch (error: any) {
        results[item] = {
          ok: false,
          error: error?.message || String(error),
        };
        logger.error("Vendor failed", { vendor: item, error });
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
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
      "DEV_FINDRFP_USER",
      "DEV_FINDRFP_PASS",
      "DEV_GEMINI_KEY",
      "DEV_HIGHERGOV_USER",
      "DEV_HIGHERGOV_PASS",
      "DEV_INSTANTMARKETS_USER",
      "DEV_INSTANTMARKETS_PASS",
      "DEV_MERX_USER",
      "DEV_MERX_PASS",
      "DEV_PUBLICPURCHASE_USER",
      "DEV_PUBLICPURCHASE_PASS",
      "DEV_SERVICE_KEY",
      "DEV_TECHBIDS_USER",
      "DEV_TECHBIDS_PASS",
      "DEV_VENDORREGISTRY_USER",
      "DEV_VENDORREGISTRY_PASS",
      "DEV_VENDORLINE_USER",
      "DEV_VENDORLINE_PASS",
      "DEV_VENDORLINK_USER",
      "DEV_VENDORLINK_PASS",
    ],
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    const BASE_URL = req.query.baseUrl || "http://localhost:5002";
    const vendor = req.query.vendor as keyof typeof vendors;
    let results;
    let status = 200;

    if (vendor) {
      ({ status, results } = await runVendor(vendor, {
        ...process.env,
        BASE_URL,
      }));
    } else {
      const selectedVendors = [
        "biddirect",
        "bidsync",
        "demandstar",
        "findrfp",
        "governmentbidders",
        "highergov", // trial
        "instantmarkets",
        // "mygovwatch", // trial
        "publicpurchase",
        // "techbids", // trial
        "vendorline",
        "vendorregistry",
      ];
      const limit = Math.max(
        1,
        parseInt(process.env.VENDOR_CONCURRENCY || "5", 10)
      );

      logger.info("Starting vendor runs", {
        vendors,
        concurrency: limit,
      });

      results = await runWithConcurrency(
        selectedVendors,
        (vendor) => runVendor(vendor as any, { ...process.env, BASE_URL }),
        limit
      );
    }

    res.status(status).json(results);
  }
);
