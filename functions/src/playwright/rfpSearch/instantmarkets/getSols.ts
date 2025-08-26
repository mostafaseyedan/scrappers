import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.instantmarkets.com/signin", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input[placeholder=\"Enter your email address\"]", user);
  await page.fill("input[placeholder=\"Enter your password\"]", pass);
  await page.click("button:has-text('Login')");
}

async function parseSolRow(row: Locator) {
  const siteLink = await row.locator("a.opptitle");
  const siteUrl = await siteLink.getAttribute("href");
  const title = await siteLink.getAttribute("title");
  const siteId = siteUrl ? siteUrl.match(/\/view\/([a-z0-9]+)\//i)?.[1] : "";
  const closingDate = await row
    .locator("span:has-text(' Due Date ') + span")
    .first()
    .innerText();
  let location = await row
    .locator("span:has-text('Agency: ') + span + span")
    .first()
    .innerText();
  location = location.trim();
  const issuer = await row
    .locator("span:has-text('Agency: ') + span")
    .first()
    .innerText();
  return {
    title,
    description: await row
      .locator("> div > p.greyText.break-words")
      .innerText(),
    location: location.substr(1, location.length - 2),
    issuer,
    closingDate: sanitizeDateString(closingDate),
    site: "instantmarkets",
    siteUrl: "https://www.instantmarkets.com" + siteUrl,
    siteId,
  };
}

async function scrapeAllSols(page: Page) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;

  await page.goto(
    "https://www.instantmarkets.com/q/ERP%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive",
    { waitUntil: "domcontentloaded" }
  );

  do {
    console.log(`instantmarkets - page ${currPage}`);
    await page.waitForSelector("app-opp-list-view li.collection-item-desc");
    const rows = await page.locator(
      "app-opp-list-view li.collection-item-desc"
    );
    const rowCount = await rows.count();
    console.log(`Found ${rowCount} rows`);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const checkRow = await row.locator("a.opptitle");
      if ((await checkRow.count()) === 0) continue;
      const sol = await parseSolRow(row);
      allSols.push(sol);
    }

    const popupDismiss = await page.locator(
      "button:has-text(\"Don't Ask Again\")"
    );
    const popupDismissCount = await popupDismiss.count();
    if (popupDismissCount > 0) await popupDismiss.click();

    await page.waitForTimeout(1000);

    const nextPage = page.locator("pagination-async button:has-text(\"Next \")");
    const nextPageCount = await nextPage.count();

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
  const USER = env.DEV_INSTANTMARKETS_USER!;
  const PASS = env.DEV_INSTANTMARKETS_PASS!;
  const VENDOR = "instantmarkets";
  let results = {};
  let failCount = 0;
  let successCount = 0;
  let expiredCount = 0;
  let nonItCount = 0;
  let dupCount = 0;

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);

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
