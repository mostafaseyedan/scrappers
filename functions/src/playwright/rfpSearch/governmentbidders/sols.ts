import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
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
  const siteLink = await row.locator(".bid-title a[href]");
  const siteUrl = await siteLink.getAttribute("href");
  const siteId = siteUrl
    ? siteUrl.match(/\/government_bids\/detail\/([a-z0-9]+)\.htm/i)?.[1]
    : "";
  const publishDate = await row.locator(".bid-post").innerText();
  const closingDate = await row.locator(".bid-due").first().innerText();
  const [issuer, location] = (await row.locator(".bid-loc").innerText()).split(
    ","
  );
  const sol = {
    title: await siteLink.innerText(),
    description: await row.locator("+ tr .bid-desc").innerText(),
    location: location.trim(),
    issuer: issuer.trim(),
    closingDate: sanitizeDateString(closingDate.replace("ADD", "")),
    publishDate: sanitizeDateString(publishDate),
    site: "governmentbidders",
    siteUrl: "https://governmentbidders.com" + siteUrl,
    siteId,
  };

  if (sol.closingDate && !isNotExpired(sol)) {
    logger.log(sol.closingDate, "is expired");
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

  const solIsIt = await isItRelated(sol).catch((err) => {
    logger.error("isItRelated failed", err, sol);
    failCount++;
  });
  if (solIsIt === false) {
    nonItCount++;
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

  return sol;
}

async function scrapeAllSols(page: Page, env: Record<string, any>) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;

  await page.goto(
    "https://governmentbidders.com/government_bids/search.htm?gov%5B%5D=&keyword=software",
    { waitUntil: "domcontentloaded" }
  );

  do {
    logger.log(`${env.VENDOR} - page ${currPage}`);
    await page.waitForSelector(".main-contents .list-contents table");
    const rows = await page.locator(
      ".main-contents .list-contents table tbody tr:nth-child(odd)"
    );
    const rowCount = await rows.count();
    logger.log(`Found ${rowCount} rows`);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env).catch((err) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    const nextPage = page.locator('.list-navi a:has-text("Next")');
    const nextPageCount = await nextPage.count();

    if (nextPageCount === 0) {
      lastPage = true;
    } else {
      await nextPage.click();
      await page.waitForTimeout(1000);
    }
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
  const VENDOR = "governmentbidders";
  let results = {};

  let sols = await scrapeAllSols(page, {
    ...env,
    BASE_URL,
    VENDOR,
    SERVICE_KEY,
  });

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
