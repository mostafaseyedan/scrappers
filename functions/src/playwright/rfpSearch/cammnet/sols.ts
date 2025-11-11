import { isNotExpired, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

let failCount = 0;
let successCount = 0;
let expiredCount = 0;
let nonItCount = 0;
let dupCount = 0;

async function processRow(row: Locator, env: Record<string, any>) {
  const cells = row.locator("[role='gridcell']");
  const cellCount = await cells.count();

  if (cellCount < 6) {
    logger.warn("Row doesn't have enough cells, skipping");
    return false;
  }

  // Extract data from cells based on OpenGov structure
  // Cell 0: Title (with link)
  // Cell 1: Project ID
  // Cell 2: Status
  // Cell 3: Addenda count
  // Cell 4: Release Date
  // Cell 5: Due Date
  const title = await cells.nth(0).textContent();
  const projectId = await cells.nth(1).textContent();
  const releaseDate = await cells.nth(4).textContent();
  const closingDate = await cells.nth(5).textContent();

  const sol = {
    title: title?.trim() || "",
    location: "CA",
    publishDate: sanitizeDateString(releaseDate?.trim() || ""),
    closingDate: sanitizeDateString(closingDate?.trim() || ""),
    site: "cammnet",
    siteUrl: "https://procurement.opengov.com/portal/octa",
    siteId: "cammnet-" + projectId?.trim(),
  };

  if (sol.closingDate && !isNotExpired(sol)) {
    expiredCount++;
    return false;
  }

  const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY).catch(
    (err) => {
      logger.error("isSolDuplicate failed", err, sol);
      failCount++;
    }
  );
  if (isDup) {
    dupCount++;
    return false;
  }

  const newRecord = await solModel
    .post({
      baseUrl: env.BASE_URL,
      data: sol,
      token: env.SERVICE_KEY,
    })
    .catch((err: unknown) => {
      logger.error("Failed to save sol", err, sol);
      failCount++;
    });
  successCount++;
  logger.log(`Saved sol: ${newRecord.id}`);

  return newRecord;
}

async function scrapeAllSols(page: Page, env: Record<string, any>) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;
  await page.goto("https://procurement.opengov.com/portal/octa", {
    waitUntil: "domcontentloaded",
  });

  // Wait for Cloudflare challenge to pass
  await page.waitForFunction(
    () => !document.title.includes("Just a moment"),
    { timeout: 90000 }
  ).catch(() => logger.warn("Cloudflare challenge timeout"));

  // Wait for rows to appear
  await page.waitForSelector("[role='row']", { timeout: 30000 })
    .catch(() => logger.warn("No rows found"));

  await page.waitForTimeout(3000); // Wait for content to load

  do {
    logger.log(`${env.VENDOR} - page:${currPage}`);
    const rows = await page.locator("[role='row']");
    const rowCount = await rows.count();

    if (rowCount === 0) {
      lastPage = true;
      continue;
    }

    // Skip first row (header)
    for (let i = 1; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env).catch((err) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    lastPage = true;
    currPage++;
  } while (!lastPage);

  return allSols;
}

export async function run(
  page: Page,
  env: Record<string, any> = {},
  context: BrowserContext
) {
  const BASE_URL = env.BASE_URL!;
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  const VENDOR = "cammnet";
  let results = {};

  let sols: string[] = [];
  const currSols = await scrapeAllSols(page, {
    ...env,
    BASE_URL,
    VENDOR,
    SERVICE_KEY,
  });
  sols = sols.concat(currSols.map((s) => s.id));

  logger.log(
    `${VENDOR} - Finished saving sols. Success: ${successCount}. Fail: ${failCount}. Duplicates: ${dupCount}. Junk: ${
      expiredCount + nonItCount
    }.`
  );

  results = {
    sols,
    counts: {
      success: successCount,
      fail: failCount,
      dup: dupCount,
      junk: expiredCount + nonItCount,
    },
  };

  return results;
}
