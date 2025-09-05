import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import { md5 } from "../../../lib/md5";
import type { BrowserContext, Locator, Page } from "playwright-core";

let failCount = 0;
let successCount = 0;
let expiredCount = 0;
let nonItCount = 0;
let dupCount = 0;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.mygovwatch.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="userName"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click("button:has-text('LOGIN')");
}

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
) {
  const closingDate = await row.locator(".list-view-rfp-due-date").innerText();
  const siteLink = await row.locator("a[href^='/opportunity/']").first();
  const siteUrl =
    "https://clients.mygovwatch.com/" + (await siteLink.getAttribute("href"));

  const newPagePromise = context.waitForEvent("page");
  await siteLink.click();
  const newPage = await newPagePromise;
  await newPage.waitForSelector('a:has-text("LEAD SOURCE")');
  await newPage.locator('a:has-text("LEAD SOURCE")').click();
  await newPage.close();
  const newPagePromise2 = context.waitForEvent("page");
  const newPage2 = await newPagePromise2;
  await newPage2.waitForLoadState();
  const sourceLink = newPage2.url();
  await newPage2.close();

  const sol = {
    title: await row.locator("h4.list-view-rfp-name").innerText(),
    issuer: await row.locator("h3.list-view-buyer-name").innerText(),
    closingDate: sanitizeDateString(closingDate),
    externalLinks: sourceLink ? [sourceLink] : [],
    site: "mygovwatch",
    siteUrl,
    siteId: "mygovwatch-" + md5(siteUrl),
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

  return sol;
}

async function scrapeAllSols(
  page: Page,
  env: Record<string, any>,
  context: BrowserContext
) {
  let allSols: Record<string, any>[] = [];

  for (let currPage = 1; currPage <= 20; currPage++) {
    console.log(`mygovwatch page ${currPage}`);
    await page.waitForSelector(
      '[ng-controller="RfpListViewController as data"] tbody:nth-child(2) > tr'
    );

    const rows = await page.locator(
      '[ng-controller="RfpListViewController as data"] tbody:nth-child(2) > tr'
    );
    const rowCount = await rows.count();

    for (let i = 1; i <= rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env, context).catch((err: unknown) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    await page
      .locator('a[ng-click="selectPage(currentPage + 1);backToTop();"]')
      .first()
      .click();
  }

  return allSols;
}

export async function run(
  page: Page,
  env: Record<string, any> = {},
  context: BrowserContext
) {
  const BASE_URL = env.BASE_URL!;
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  const USER = "will@leafmedium.com";
  const PASS = "inno123!";
  const VENDOR = "mygovwatch";
  let results = {};

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);
  let sols = await scrapeAllSols(
    page,
    {
      ...env,
      BASE_URL,
      VENDOR,
      SERVICE_KEY,
    },
    context
  );

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
