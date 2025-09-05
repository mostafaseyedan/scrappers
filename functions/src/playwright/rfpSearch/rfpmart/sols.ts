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
  const siteLink = await row.locator(".rfpmartIN-descriptionCategory a[href]");
  const siteUrl = await siteLink.getAttribute("href");
  const siteLinkText = await siteLink.innerText();
  const siteLinkTextSegs = siteLinkText.split(" - ");
  const title = siteLinkTextSegs[1].trim();
  const siteIdLoc = siteLinkTextSegs[0].match(/^([a-z-0-9 ]+)\(([a-z, ]+)\)/i);
  const siteId = siteIdLoc?.[1] ? siteIdLoc[1].trim() : "";
  const location = siteIdLoc?.[2] ? siteIdLoc[2].trim() : "";
  const publishDate = await row.locator(".post-date").innerText();
  const closingDate = await row.locator(".expiry-date").innerText();
  const sol = {
    title,
    location,
    publishDate: sanitizeDateString(publishDate),
    closingDate: sanitizeDateString(closingDate),
    site: "rfpmart",
    siteUrl: "https://www.rfpmart.com/" + siteUrl,
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

  return newRecord;
}

async function scrapeAllSols(page: Page, env: Record<string, any>) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;
  //rfpmart.com/bids/view/1061418126/Advanced_Development_of_Enhanced_Operator_Capabilities_ADEOC
  https: await page.goto(`https://rfpmart.com/`, {
    waitUntil: "domcontentloaded",
  });

  do {
    logger.log(`${env.VENDOR} - page:${currPage}`);
    await page
      .waitForSelector("#home ul.rfpmart_india-categoryDetailLists > li")
      .catch(() => {
        lastPage = true;
      });
    const rows = await page.locator(
      "#home ul.rfpmart_india-categoryDetailLists > li"
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

    if (expiredCount >= 30) {
      lastPage = true;
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      continue;
    }

    const nextPage = page.locator("#tnt_pagination a[title='Next']");
    const nextPageCount = await nextPage.count();

    if (nextPageCount === 0) {
      lastPage = true;
    } else {
      await nextPage.first().click();
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
  const VENDOR = "rfpmart";
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
