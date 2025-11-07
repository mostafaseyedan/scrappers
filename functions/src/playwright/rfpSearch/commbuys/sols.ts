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
  const siteLink = await row.locator("td:nth-child(1) a[href]");
  const siteUrl = await siteLink.getAttribute("href");
  const siteId = siteUrl ? siteUrl.match(/docId=([a-z0-9-]+)/i)?.[1] : "";
  const closingDate = await row.locator("td:nth-child(8)").innerText();
  const sol = {
    title: await row.locator("td:nth-child(7)").innerText(),
    issuer: await row.locator("td:nth-child(3)").innerText(),
    closingDate: sanitizeDateString(closingDate),
    site: "commbuys",
    siteUrl: "https://www.commbuys.com" + siteUrl,
    siteId,
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

async function scrapeAllSols(
  keyword: string = "software",
  page: Page,
  env: Record<string, any>
) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;

  await page.goto(
    `https://www.commbuys.com/bso/view/search/external/advancedSearchBid.xhtml?q=${encodeURIComponent(
      keyword
    )}&currentDocType=bids`,
    { waitUntil: "domcontentloaded" }
  );

  do {
    logger.log(`${env.VENDOR} - keyword:${keyword} page:${currPage}`);
    await page
      .waitForSelector(
        "[id='bidSearchResultsForm:bidResultId_data'] tr:not(.ui-datatable-empty-message)"
      )
      .catch(() => {
        lastPage = true;
      });
    const rows = await page.locator(
      "[id='bidSearchResultsForm:bidResultId_data'] tr:not(.ui-datatable-empty-message)"
    );

    const rowCount = await rows.count();

    if (rowCount === 0) {
      lastPage = true;
      continue;
    }

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env).catch((err) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    if (expiredCount >= 20) {
      lastPage = true;
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      continue;
    }

    const nextPage = page.locator(
      "[id='bidSearchResultsForm:bidResultId_paginator_top'] a[aria-label='Next Page']:not(.ui-state-disabled)"
    );
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
  const VENDOR = "commbuys";
  let results = {};

  const keywords = [
    "erp",
    "software",
    "peoplesoft",
    "lawson",
    "it staffing",
    "workday",
    "oracle",
    "infor",
  ];

  let sols: string[] = [];
  for (const keyword of keywords) {
    logger.info(`${VENDOR} - keyword ${keyword}`);
    expiredCount = 0;
    const keywordSols = await scrapeAllSols(keyword, page, {
      ...env,
      BASE_URL,
      VENDOR,
      SERVICE_KEY,
    });
    sols = sols.concat(keywordSols.map((s) => s.id));
  }

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
