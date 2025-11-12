import { isNotExpired, isSolDuplicate } from "../../../lib/script";
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

  await page.goto("https://vendorline.planetbids.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input[name=\"userName\"]", user);
  await page.fill("input[name=\"password\"]", pass);
  await page.click("button.btn-primary.close-login");
}

async function parseSolRow(
  row: Locator,
  context: BrowserContext
): Promise<Record<string, any>> {
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

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
): Promise<Record<string, any> | false> {
  const sol = await parseSolRow(row, context).catch((err: unknown) => {
    logger.error("parseSolRow failed", err);
  });
  if (!sol) return false;

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
      data: { location: "", ...sol },
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
): Promise<Record<string, any>[]> {
  let allSols: Record<string, any>[] = [];

  await page.waitForTimeout(3000);

  // Click "Go to My Bids" button to navigate to solicitations page
  const goToBidsBtn = page.locator('button:has-text("Go to My Bids")');
  if (await goToBidsBtn.isVisible()) {
    await goToBidsBtn.click();
    await page.waitForTimeout(2000);
  }

  await page.waitForSelector(".MuiDataGrid-virtualScrollerRenderZone", {
    timeout: 120000,
  });

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
    if (i % 10 === 0) logger.log(`${env.VENDOR} - Record ${i}`);
    const row = page.locator(".slide-container");
    const sol = await processRow(row, env, context).catch((err: unknown) =>
      logger.error("processRow failed", err)
    );
    if (sol && sol?.siteId) {
      allSols.push(sol);
    }

    if (expiredCount >= 20) {
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      break;
    }

    await page.locator(".footer-buttons .center-buttons + button").click();
    await page.waitForTimeout(1000);
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

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);

  const sols = await scrapeAllSols(
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
