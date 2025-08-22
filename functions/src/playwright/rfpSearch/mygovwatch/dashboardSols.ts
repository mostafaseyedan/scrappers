import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import { md5 } from "../../../lib/md5";
import type { BrowserContext, Locator, Page } from "playwright-core";

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

async function parseSolRow(row: Locator, context: BrowserContext) {
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

  return {
    title: await row.locator("h4.list-view-rfp-name").innerText(),
    issuer: await row.locator("h3.list-view-buyer-name").innerText(),
    closingDate: sanitizeDateString(closingDate),
    externalLinks: sourceLink ? [sourceLink] : [],
    site: "mygovwatch",
    siteUrl,
    siteId: "mygovwatch-" + md5(siteUrl),
  };
}

async function scrapeAllSols(page: Page, context: BrowserContext) {
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
      const sol = await parseSolRow(row, context).catch((err: unknown) =>
        console.warn(err)
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
  let failCount = 0;
  let successCount = 0;
  let expiredCount = 0;
  let nonItCount = 0;
  let dupCount = 0;

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);
  let sols = await scrapeAllSols(page, context);
  const total = sols.length;

  // Filter out expired
  sols = sols.filter((sol) => {
    if (sol.closingDate) {
      if (isNotExpired(sol)) return true;
      logger.log(sol.closingDate, "is expired");
      expiredCount++;
      return false;
    }

    return sol;
  });

  logger.log(`${VENDOR} - Total solicitations found:${total}.`);

  // Save each sols
  for (const sol of sols) {
    const isDup = await isSolDuplicate(sol, BASE_URL, SERVICE_KEY).catch(
      (err) => {
        logger.error("isSolDuplicate failed", err, sol);
        failCount++;
      }
    );
    if (isDup) {
      dupCount++;
      continue;
    }

    const solIsIt = await isItRelated(sol).catch((err) => {
      logger.error("isItRelated failed", err, sol);
      failCount++;
    });
    if (solIsIt === false) {
      nonItCount++;
      continue;
    }

    const newRecord = await solModel
      .post({
        baseUrl: BASE_URL,
        data: { location: "", ...sol },
        token: SERVICE_KEY,
      })
      .catch((err: unknown) => {
        logger.error("Failed to save sol", err, sol);
        failCount++;
      });
    logger.log(`Saved sol: ${newRecord.id}`);
    successCount++;
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
