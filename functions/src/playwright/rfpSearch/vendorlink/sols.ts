import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { md5 } from "../../../lib/md5";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

let failCount = 0;
let successCount = 0;
let expiredCount = 0;
let nonItCount = 0;
let dupCount = 0;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.myvendorlink.com/external/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input[placeholder='Email Address']", user);
  await page.fill("input[placeholder='Password']", pass);
  await page.click("input[value='Log In']");

  await page.waitForTimeout(5000);
}

async function processRow(row: Locator, env: Record<string, any>) {
  const titleEl = await row.locator("td:nth-child(3)");

  if ((await titleEl.count()) === 0) {
    return false;
  }

  const title = await titleEl.innerText();
  const publishDate = await row.locator("td:nth-child(6)").innerText();
  const closingDate = await row.locator("td:nth-child(9)").innerText();
  const sol = {
    title,
    issuer: await row.locator("td:nth-child(1)").innerText(),
    closingDate: sanitizeDateString(closingDate),
    publishDate: sanitizeDateString(publishDate),
    site: "vendorlink",
    siteUrl: "https://www.myvendorlink.com",
    siteId: "vendorlink-" + md5(title),
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
  let lastPage;
  let currPage = 1;

  await page.goto("https://www.myvendorlink.com/internal/vendor/bids", {
    waitUntil: "domcontentloaded",
  });

  await page
    .locator('select[name*="ddlStatus"]')
    .selectOption({ label: "Active" });
  await page.locator("#ctl00_RegionMiddle_btnSearch").click();

  await page
    .waitForSelector("#ctl00_RegionMiddle_grvSolicitations tbody tr")
    .catch(() => {
      lastPage = true;
    });

  do {
    logger.log(`${env.VENDOR} - page:${currPage}`);
    const rows = await page.locator(
      "#ctl00_RegionMiddle_grvSolicitations tbody tr"
    );
    const rowCount = await rows.count();

    if (rowCount === 0) {
      lastPage = true;
      continue;
    }

    for (let i = 1; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env).catch((err) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    const nextPage = page.locator("ul.pagination li.active + li");
    const nextPageCount = await nextPage.count();

    if (expiredCount >= 30) {
      lastPage = true;
      continue;
    }

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
  const USER = env.DEV_VENDORLINK_USER!;
  const PASS = env.DEV_VENDORLINK_PASS!;
  const VENDOR = "vendorlink";
  let results = {};

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);

  let sols: string[] = [];
  const keywordSols = await scrapeAllSols(page, {
    ...env,
    BASE_URL,
    VENDOR,
    SERVICE_KEY,
  });
  sols = sols.concat(keywordSols.map((s) => s.id));

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
