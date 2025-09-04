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

export async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.publicpurchase.com/gems/login/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="uname"]', user);
  await page.fill('input[name="pwd"]', pass);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('input[value="Login"]'),
  ]);
}

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
) {
  const publishDate = sanitizeDateString(
    await row.locator("> td:nth-child(3)").innerText()
  );
  const closingDate = sanitizeDateString(
    await row.locator("> td:nth-child(4)").innerText()
  );
  const sol = {
    title: await row.locator("> td:nth-child(1)").innerText(),
    issuer: await row.locator("> td:nth-child(2)").innerText(),
    publishDate: publishDate || null,
    closingDate: closingDate || null,
    site: "publicpurchase",
    siteId: await row.locator("> td:nth-child(7)").innerText(),
    siteUrl:
      "https://www.publicpurchase.com" +
      (await row
        .locator("> td:nth-child(1) > a[href]")
        .first()
        .getAttribute("href")),
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

export async function scrapeAllSols(
  page: Page,
  env: Record<string, any>,
  context: BrowserContext
) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;

  // We should be at home page
  await page.waitForSelector("#invitedBids");

  // Go to last page
  page.locator("#invitedBids > div:nth-child(2) a:last-child").click();
  await page.waitForTimeout(1000);

  do {
    console.log(`PublicPurchase - Page ${currPage}`);
    const rows = page.locator("#invitedBids tbody > tr:visible");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env, context).catch((err: unknown) =>
        console.warn(err)
      );
      if (sol && sol?.siteId) allSols.push(sol);
    }

    const prevPage = page.locator(
      "#invitedBids > div:nth-child(2) a:nth-child(2)"
    );
    const styles = await prevPage.getAttribute("style");
    prevPage.click();
    await page.waitForTimeout(3000);

    const prevPageExists = (await prevPage.count()) > 0;

    // Is this disabled?
    if (styles?.includes("color:#999999") || !prevPageExists) {
      lastPage = true;
    }
    currPage++;
  } while (lastPage !== true);

  return allSols;
}

export async function run(
  page: Page,
  env: Record<string, any> = {},
  context: BrowserContext
) {
  const BASE_URL = env.BASE_URL!;
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  const USER = env.DEV_PUBLICPURCHASE_USER!;
  const PASS = env.DEV_PUBLICPURCHASE_PASS!;
  const VENDOR = "publicpurchase";
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
