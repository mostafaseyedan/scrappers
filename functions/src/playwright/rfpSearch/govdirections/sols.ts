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

  await page.goto("https://govdirections.com/", {
    waitUntil: "domcontentloaded",
  });

  // Click login button and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.click(".btn.btn-default a[href='/users/login']"),
  ]);

  // Wait for login form to appear - try multiple selectors
  logger.log("Waiting for login form...");
  await page.waitForSelector("form", { timeout: 10000 });
  logger.log("Form found, looking for username field...");

  // Try to find username field with various selectors
  const usernameField = await page
    .locator('input[name="username"]')
    .or(page.locator('input[name="userName"]'))
    .or(page.locator('input[type="text"]').first())
    .or(page.locator('input[id*="user"]').first());

  await usernameField.waitFor({ timeout: 10000 });
  logger.log("Username field found");

  // Try to find password field
  const passwordField = await page
    .locator('input[name="password"]')
    .or(page.locator('input[type="password"]'));

  await passwordField.waitFor({ timeout: 10000 });
  logger.log("Password field found");

  // Fill login form
  await usernameField.fill(user);
  await passwordField.fill(pass);

  // Click submit button
  const submitButton = await page
    .locator("button[type='submit']")
    .or(page.locator("input[type='submit']"))
    .or(page.locator("button:has-text('Login')"))
    .or(page.locator("button:has-text('LOG IN')"));

  await submitButton.click();
  logger.log("Submit clicked, waiting for login to complete...");

  await page.waitForTimeout(3000);
  logger.log("Login completed");
}

async function searchITOpportunities(page: Page) {
  // Wait for industries dropdown
  await page.waitForSelector("select[name='industries[]']");

  // Select "IT: Support Services, Help Desk" option (value="940")
  await page.selectOption("select[name='industries[]']", "940");

  // Click search button
  await page.click("input.btn.btn-primary[type='submit'][value='Search']");

  await page.waitForTimeout(2000);
}

async function processDetailPage(
  detailPage: Page,
  env: Record<string, any>
): Promise<Record<string, any> | false> {
  try {
    // Wait for main content
    await detailPage.waitForSelector(".container .well");

    // Extract title from h2 tag
    const titleEl = await detailPage.locator("h2").first();
    const titleText = await titleEl.innerText();
    // Remove "Save this Bid" button text if present
    const title = titleText.replace(/Save this Bid/g, "").trim();

    // Extract event date
    let closingDate = "";
    const eventDateDt = detailPage.locator('dt:has-text("Event Date:")');
    if ((await eventDateDt.count()) > 0) {
      const eventDateDd = eventDateDt.locator("+ dd");
      closingDate = await eventDateDd.innerText();
    }

    // Extract external link (SAM.gov or other source)
    let externalLink = "";
    const linkEl = detailPage.locator(
      'dt:has-text("If online, then documents are here:") + dd a'
    );
    if ((await linkEl.count()) > 0) {
      externalLink = await linkEl.getAttribute("href");
    }

    // Extract description from summary section
    let description = "";
    const descSection = detailPage.locator(
      'h3:has-text("Summary Information") ~ p, h3:has-text("Summary Information") ~ dl'
    );
    if ((await descSection.count()) > 0) {
      description = await descSection.first().innerText();
    }

    // Extract reference number
    let referenceNum = "";
    const refEl = detailPage.locator(
      'dt:has-text("reference for this notice") + dd'
    );
    if ((await refEl.count()) > 0) {
      referenceNum = await refEl.innerText();
    }

    // Extract agency/sponsor
    let issuer = "";
    const agencyEl = detailPage.locator(
      'dt:has-text("agency sponsor") + dd a'
    );
    if ((await agencyEl.count()) > 0) {
      issuer = await agencyEl.innerText();
    }

    // Extract contact info
    let contactInfo = "";
    const contactPhoneEl = detailPage.locator(
      'dt:has-text("Agency Contact Information") + dd'
    );
    if ((await contactPhoneEl.count()) > 0) {
      const contactText = await contactPhoneEl.innerText();
      contactInfo = contactText.replace(/\n/g, " ").trim();
    }

    const siteUrl = detailPage.url();
    const siteId = siteUrl.match(/view\/([0-9]+)/)?.[1] || "";

    const sol = {
      title,
      description,
      issuer,
      closingDate: sanitizeDateString(closingDate),
      contactInfo,
      externalLinks: externalLink ? [externalLink] : [],
      site: "govdirections",
      siteUrl,
      siteId: "govdirections-" + siteId,
      siteData: {
        referenceNum,
      },
    };

    return sol;
  } catch (err) {
    logger.error("Failed to process detail page", err);
    return false;
  }
}

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
) {
  try {
    // Find the link in the row
    const siteLink = await row.locator("td:nth-child(1) a[href]").first();
    const href = await siteLink.getAttribute("href");

    if (!href) return false;

    // Open detail page in new tab
    const newPagePromise = context.waitForEvent("page");
    await siteLink.click({ modifiers: ["Control"] });
    const detailPage = await newPagePromise;
    await detailPage.waitForLoadState();

    // Extract data from detail page
    const sol = await processDetailPage(detailPage, env);
    await detailPage.close();

    if (!sol) return false;

    // Check expiration
    if (sol.closingDate && !isNotExpired(sol)) {
      expiredCount++;
      return false;
    }

    // Check duplicate
    const isDup = await isSolDuplicate(
      sol,
      env.BASE_URL,
      env.SERVICE_KEY
    ).catch((err) => {
      logger.error("isSolDuplicate failed", err, sol);
      failCount++;
    });
    if (isDup) {
      dupCount++;
      return false;
    }

    // Save to database
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

    return newRecord;
  } catch (err) {
    logger.error("processRow failed", err);
    return false;
  }
}

async function scrapeAllSols(
  page: Page,
  env: Record<string, any>,
  context: BrowserContext
) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;

  do {
    logger.log(`${env.VENDOR} - page:${currPage}`);
    await page.waitForSelector("table#bidTable").catch(() => {
      lastPage = true;
    });
    const rows = await page.locator("table#bidTable tbody tr[class*='Row']");
    const rowCount = await rows.count();

    if (rowCount === 0) {
      lastPage = true;
      continue;
    }

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env, context).catch((err) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    if (expiredCount >= 30) {
      lastPage = true;
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      continue;
    }

    const nextPage = page.locator(".pagination li.next a[rel='next']");
    const nextPageCount = await nextPage.count();

    if (nextPageCount === 0) {
      lastPage = true;
    } else {
      await nextPage.first().click();
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
  const USER = env.DEV_GOVDIRECTIONS_USER!;
  const PASS = env.DEV_GOVDIRECTIONS_PASS!;
  const VENDOR = "govdirections";
  let results = {};

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  // Login first
  await login(page, USER, PASS);

  // Search for IT opportunities
  await searchITOpportunities(page);

  // Scrape all results
  let sols: string[] = [];
  const currSols = await scrapeAllSols(
    page,
    {
      ...env,
      BASE_URL,
      VENDOR,
      SERVICE_KEY,
    },
    context
  );
  sols = sols.concat(currSols.map((s) => s.id));

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
