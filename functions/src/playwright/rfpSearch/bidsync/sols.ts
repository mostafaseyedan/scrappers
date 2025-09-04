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

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://app.bidsync.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="email"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click("button#loginButton");
}

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
) {
  const siteUrl = await row
    .locator(".result-title a[href]")
    .getAttribute("href");
  const siteId = siteUrl ? siteUrl.match(/bid-detail\/([a-z0-9-]+)/i)?.[1] : "";
  const bidNumber = await row.locator("[aria-label='bid number']");
  const uniqueId = (await bidNumber.isVisible())
    ? await bidNumber
        .first()
        .innerText()
        .catch((err: unknown) => logger.warn(err))
    : "";
  const closingDate = sanitizeDateString(
    await row.locator(".result-bid-end-date").innerText()
  );
  const sol = {
    title: await row.locator(".result-title").innerText(),
    location: await row.locator(".result-state").first().innerText(),
    issuer: await row.locator(".result-agency").first().innerText(),
    closingDate,
    site: "bidsync",
    siteUrl: siteUrl ? "https://app.bidsync.com/" + siteUrl : "",
    siteId,
    siteData: {
      uniqueId,
    },
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

async function scrapeAllSols(
  page: Page,
  env: Record<string, any>,
  context: BrowserContext
) {
  let allSols: Record<string, any>[] = [];

  await page.waitForSelector("#matAllBidsContent");

  for (let i = 0; i < 10; i++) {
    page.locator("#loadMoreBids").click();
    await page.waitForTimeout(1000);
  }

  const rows = page.locator("#matAllBidsContent .mat-list-item-content");
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const sol = await processRow(row, env, context).catch((err: unknown) =>
      logger.error("processRow failed", err)
    );
    if (sol && sol?.siteId) allSols.push(sol);

    if (expiredCount >= 20) {
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      break;
    }
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
  const USER = env.DEV_BIDSYNC_USER!;
  const PASS = env.DEV_BIDSYNC_PASS!;
  const VENDOR = "bidsync";
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
