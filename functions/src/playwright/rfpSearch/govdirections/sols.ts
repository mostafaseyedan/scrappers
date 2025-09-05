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
  const siteLink = await row.locator("td:nth-child(1) a[href]");
  const siteUrl = await siteLink.getAttribute("href");
  const siteId = siteUrl ? siteUrl.match(/[0-9]+/i)?.[0] : "";
  const closingDate = await row.locator("td:nth-child(2)").innerText();
  const sol = {
    title: await siteLink.innerText(),
    location: await row.locator("td:nth-child(3)").innerText(),
    closingDate: sanitizeDateString(closingDate),
    site: "govdirections",
    siteUrl: "https://www.govdirections.com" + siteUrl,
    siteId: "govdirections-" + siteId,
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
  //govdirections.com/bids/view/1061418126/Advanced_Development_of_Enhanced_Operator_Capabilities_ADEOC
  https: await page.goto(`https://govdirections.com/`, {
    waitUntil: "domcontentloaded",
  });

  do {
    logger.log(`${env.VENDOR} - page:${currPage}`);
    await page.waitForSelector("table#bidTable").catch(() => {
      lastPage = true;
    });
    const rows = await page.locator("table#bidTable tbody tr[class*='Row']");
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

    const nextPage = page.locator(".pagination li.next a[rel='next']");
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
  const VENDOR = "govdirections";
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
