import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

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

async function parseSolRow(row: Locator) {
  const siteUrl = await row
    .locator(".result-title a[href]")
    .getAttribute("href");
  const siteId = siteUrl
    ? siteUrl.match(/bid-detail\/([a-z0-9\-]+)/i)?.[1]
    : "";
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
  return {
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
}

async function scrapeAllSols(page: Page) {
  let allSols: Record<string, any>[] = [];
  const rows = page.locator("#matAllBidsContent .mat-list-item-content");
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const sol = await parseSolRow(row).catch((err: unknown) =>
      console.warn(err)
    );
    if (sol?.siteId) allSols.push(sol);
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
  const failCount = 0;
  let successCount = 0;
  let expiredCount = 0;
  let nonItCount = 0;
  let dupCount = 0;

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);
  await page.waitForSelector("#matAllBidsContent");

  for (let i = 0; i < 10; i++) {
    page.locator("#loadMoreBids").click();
    await page.waitForTimeout(1000);
  }

  let sols = await scrapeAllSols(page);
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
    if (await isSolDuplicate(sol, BASE_URL, SERVICE_KEY)) {
      dupCount++;
      continue;
    }

    if ((await isItRelated(sol)) === false) {
      nonItCount++;
      continue;
    }

    const newRecord = await solModel.post({
      baseUrl: BASE_URL,
      data: { location: "", ...sol },
      token: SERVICE_KEY,
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
