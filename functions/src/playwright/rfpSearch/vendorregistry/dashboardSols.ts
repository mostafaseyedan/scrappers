import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://vrapp.vendorregistry.com/Account/LogOn", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input[name=\"UserName\"]", user);
  await page.fill("input[name=\"Password\"]", pass);
  await page.click("input#login");

  await page.waitForSelector("#afterLoginModal");

  const dismissButton = await page
    .locator("#afterLoginModal button[data-dismiss]")
    .first();
  if (await dismissButton.isVisible()) {
    await dismissButton.click();
  }
}

async function parseSolRow(row: Locator) {
  const siteUrl = await row
    .locator("#description-item a[href]")
    .getAttribute("href");
  const siteId = siteUrl
    ? siteUrl.match(/\/Bids\/View\/Bid\/([a-z0-9-]+)\?/i)?.[1]
    : "";
  const closingDate = sanitizeDateString(
    await row.locator("#Deadline-item").innerText()
  );
  const publishDate = sanitizeDateString(
    await row.locator("#Posted-item").innerText()
  );
  return {
    title: await row.locator("#description-item").innerText(),
    issuer: await row.locator("#buyer-item").innerText(),
    location: await row.locator("#state-item").innerText(),
    site: "vendorregistry",
    siteId,
    siteUrl: siteUrl ? "https://vrapp.vendorregistry.com" + siteUrl : "",
    closingDate,
    publishDate,
  };
}

export async function scrapeAllSols(page: Page) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;

  // Set to sort by date posted desc
  await page.locator("#contractTable th[data-fieldname=\"datePosted\"]").click();
  await page.waitForTimeout(1000);
  await page.locator("#contractTable th[data-fieldname=\"datePosted\"]").click();
  await page.waitForTimeout(1000);

  do {
    console.log(`VendorRegistry - Page ${currPage}`);
    const rows = page.locator("#contractTable tbody > tr:visible");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await parseSolRow(row).catch((err: unknown) =>
        console.warn(err)
      );
      if (sol?.siteId) allSols.push(sol);
    }

    const nextPage = page.locator(".pageSelector li.PagedList-skipToNext");
    const classes = await nextPage.getAttribute("class");

    if (classes?.includes("disabled")) {
      lastPage = true;
    } else {
      await nextPage.locator("> a").click();
      await page.waitForTimeout(1000);
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
  const USER = env.DEV_VENDORREGISTRY_USER!;
  const PASS = env.DEV_VENDORREGISTRY_PASS!;
  const VENDOR = "vendorregistry";
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
