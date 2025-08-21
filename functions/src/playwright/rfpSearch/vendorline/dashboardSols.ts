import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import { md5 } from "../../../lib/md5";
import type { BrowserContext, Locator, Page } from "playwright-core";

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://vendorline.planetbids.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input[name=\"userName\"]", user);
  await page.fill("input[name=\"password\"]", pass);
  await page.click("button.btn-primary.close-login");
}

async function parseSolRow(row: Locator, context: BrowserContext) {
  await row
    .locator(".bid-details-info .list-item-row")
    .first()
    .waitFor({ state: "visible" });
  const bidDetailsItems = await row.locator(".bid-details-info .list-item-row");
  const bidDetailsCount = await bidDetailsItems.count();
  const bidDetails: Record<string, any> = {};

  for (let i = 0; i < bidDetailsCount; i++) {
    const bidDetailsItem = bidDetailsItems.nth(i);
    const label = await bidDetailsItem
      .locator(".list-item-label")
      .first()
      .innerText();
    const value = await bidDetailsItem
      .locator(".list-item-value")
      .first()
      .innerText();
    bidDetails[label] = value;
  }

  const newPagePromise = context.waitForEvent("page");
  await row.locator(".bid-actions button:has-text('Open Details')").click();
  const newPage = await newPagePromise;
  await newPage.waitForLoadState("domcontentloaded");
  const siteUrl = newPage.url();
  await newPage.close();

  const title = await row.locator(".project-title").innerText();
  const closingDate = await row.locator(".due-date-value").innerText();
  return {
    title,
    description: await row.locator(".bid-details-description").innerText(),
    issuer: bidDetails["Agency"],
    closingDate: sanitizeDateString(closingDate),
    site: "vendorline",
    siteUrl,
    siteId:
      bidDetails["Public Reference"] || "vendorline" + md5(title + closingDate),
    siteData: {
      bidDetails,
    },
  };
}

async function scrapeAllSols(page: Page, context: BrowserContext) {
  let allSols: Record<string, any>[] = [];

  await page.waitForSelector(".MuiDataGrid-virtualScrollerRenderZone");

  const closeSurveyEl = page.locator(
    ".productfruits--container-pr-fk .close-btn"
  );
  if (await closeSurveyEl.isVisible()) {
    await closeSurveyEl.click();
  }

  await page
    .locator(".MuiDataGrid-virtualScrollerRenderZone > div[data-id]")
    .first()
    .click();

  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) console.log(`Vendorline - Record ${i}`);
    const row = await page.locator(".slide-container");
    const sol = await parseSolRow(row, context).catch((err: unknown) =>
      console.warn(err)
    );
    if (sol) allSols.push(sol);
    await page.locator(".footer-buttons .center-buttons + button").click();
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
  const USER = env.DEV_VENDORLINE_USER!;
  const PASS = env.DEV_VENDORLINE_PASS!;
  const VENDOR = "vendorline";
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
