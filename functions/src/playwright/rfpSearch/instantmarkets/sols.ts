import { isNotExpired, isSolDuplicate } from "../../../lib/script";
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

  await page.goto("https://www.instantmarkets.com/signin", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input[placeholder=\"Enter your email address\"]", user);
  await page.fill("input[placeholder=\"Enter your password\"]", pass);
  await page.click("button:has-text('Login')");

  // Wait for navigation after login
  await page.waitForTimeout(2000);
}

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
) {
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
  location = location.replace(",", ", ").trim();
  const issuer = await row
    .locator("span:has-text('Agency: ') + span")
    .first()
    .innerText();
  const sol = {
    title,
    description: await row
      .locator(".cursor-pointer p.greyText.break-words")
      .innerText(),
    location: location.substr(1, location.length - 2),
    issuer,
    closingDate: closingDate === "N/A" ? null : sanitizeDateString(closingDate),
    site: "instantmarkets",
    siteUrl: "https://www.instantmarkets.com" + siteUrl,
    siteId,
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
  let lastPage = false;
  let currPage = 1;

  await page.goto(
    "https://www.instantmarkets.com/q/erp%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive",
    { waitUntil: "domcontentloaded" }
  );

  do {
    logger.log(`${env.VENDOR} - page ${currPage}`);
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
      const sol = await processRow(row, env, context).catch((err: unknown) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    // Wait for any Angular overlay/modal to disappear completely
    try {
      await page.waitForFunction(() => {
        const overlayPane = document.querySelector('.cdk-overlay-pane');
        if (!overlayPane) return true;
        const style = window.getComputedStyle(overlayPane);
        return style.pointerEvents === 'none';
      }, { timeout: 3000 });
      console.log("  ✓ Overlay cleared");
    } catch {
      console.log("  ⚠️ Overlay still present, proceeding anyway");
    }

    // Check for next page button
    const nextPage = page.locator("pagination-async button:has-text(\"Next \")");
    const nextPageCount = await nextPage.count();
    console.log(`  Looking for Next button: found ${nextPageCount}`);

    if (nextPageCount === 0) {
      console.log("  No Next button found - last page reached");
      lastPage = true;
    } else {
      try {
        // Check if button is enabled
        const isDisabled = await nextPage.getAttribute("disabled");
        if (isDisabled !== null) {
          console.log("  Next button is disabled - last page reached");
          lastPage = true;
        } else {
          console.log("  Clicking Next button...");
          // Use force:true to bypass actionability checks if modal overlay is blocking
          await nextPage.click({ timeout: 5000, force: true });
          await page.waitForTimeout(2000);
          console.log("  ✓ Navigated to next page");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`  ⚠️ Failed to click Next button: ${errorMsg}`);
        console.log("  Assuming last page reached");
        lastPage = true;
      }
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