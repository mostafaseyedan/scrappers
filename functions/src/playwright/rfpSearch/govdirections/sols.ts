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

async function debugPageElements(page: Page, context: string) {
  console.log(`\n🔍 [DEBUG] Capturing page elements for: ${context}`);
  try {
    console.log(`  Current URL: ${page.url()}`);
    console.log(`  Page title: ${await page.title().catch(() => "N/A")}`);

    // List all forms
    const forms = await page.locator("form").all();
    console.log(`  Forms found: ${forms.length}`);
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const id = await form.getAttribute("id").catch(() => null);
      const action = await form.getAttribute("action").catch(() => null);
      const visible = await form.isVisible().catch(() => false);
      console.log(`    Form ${i}: id="${id}", action="${action}", visible=${visible}`);
    }

    // List all input fields
    const inputs = await page.locator("input").all();
    console.log(`  Input fields found: ${inputs.length}`);
    for (let i = 0; i < Math.min(inputs.length, 20); i++) {
      const input = inputs[i];
      const type = await input.getAttribute("type").catch(() => null);
      const id = await input.getAttribute("id").catch(() => null);
      const name = await input.getAttribute("name").catch(() => null);
      const placeholder = await input.getAttribute("placeholder").catch(() => null);
      const visible = await input.isVisible().catch(() => false);
      console.log(`    Input ${i}: type="${type}", id="${id}", name="${name}", placeholder="${placeholder}", visible=${visible}`);
    }

    // List all buttons
    const buttons = await page.locator("button, input[type='submit']").all();
    console.log(`  Buttons found: ${buttons.length}`);
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const type = await button.getAttribute("type").catch(() => null);
      const value = await button.getAttribute("value").catch(() => null);
      const text = await button.innerText().catch(() => null);
      const visible = await button.isVisible().catch(() => false);
      console.log(`    Button ${i}: type="${type}", value="${value}", text="${text}", visible=${visible}`);
    }

    // List all select dropdowns
    const selects = await page.locator("select").all();
    console.log(`  Select dropdowns found: ${selects.length}`);
    for (let i = 0; i < selects.length; i++) {
      const select = selects[i];
      const name = await select.getAttribute("name").catch(() => null);
      const id = await select.getAttribute("id").catch(() => null);
      const visible = await select.isVisible().catch(() => false);
      console.log(`    Select ${i}: name="${name}", id="${id}", visible=${visible}`);
    }
  } catch (err) {
    console.error(`  Failed to capture debug elements:`, err);
  }
  console.log(`🔍 [DEBUG] End of element capture\n`);
}

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  try {
    await page.goto("https://govdirections.com/", {
      waitUntil: "domcontentloaded",
    });

    // Click login button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.click(".btn.btn-default a[href='/users/login']"),
    ]);

    // Wait for login page to be ready
    console.log("🔐 [LOGIN] Waiting for login page...");

    // Wait a bit for the page to fully render
    await page.waitForTimeout(1000);

    // Find email field - the actual field name is "data[User][email]" with id="UserEmail"
    console.log("✓ [LOGIN] Looking for email field...");
    const emailField = await page
      .locator('input[id="UserEmail"]')
      .or(page.locator('input[name="data[User][email]"]'))
      .or(page.locator('input[type="email"]'));

    await emailField.waitFor({ timeout: 10000 });
    console.log("✓ [LOGIN] Email field found");

    // Find password field - the actual field name is "data[User][passwd]" with id="UserPasswd"
    const passwordField = await page
      .locator('input[id="UserPasswd"]')
      .or(page.locator('input[name="data[User][passwd]"]'))
      .or(page.locator('input[type="password"]'));

    await passwordField.waitFor({ timeout: 10000 });
    console.log("✓ [LOGIN] Password field found");

    // Fill login form
    await emailField.fill(user);
    await passwordField.fill(pass);
    console.log("✓ [LOGIN] Credentials filled");

    // Click submit button - actual button is: <input type="submit" value="LOG In | See Terms">
    const submitButton = await page
      .locator('input[type="submit"][value*="LOG In"]')
      .or(page.locator('input[type="submit"].btn-primary'))
      .or(page.locator('input[type="submit"]'));

    await submitButton.click();
    console.log("✓ [LOGIN] Submit clicked, waiting for login to complete...");

    await page.waitForTimeout(3000);
    console.log("✅ [LOGIN] Login completed");
  } catch (err) {
    console.error("❌ [LOGIN] Error during login:", err);
    await debugPageElements(page, "Login Error");
    throw err;
  }
}

async function searchITOpportunities(page: Page) {
  try {
    // Wait for industries dropdown
    console.log("🔍 [SEARCH] Waiting for industries dropdown...");
    await page.waitForSelector("select[name='industries[]']");
    console.log("✓ [SEARCH] Industries dropdown found");

    // Select "IT: Support Services, Help Desk" option (value="940")
    await page.selectOption("select[name='industries[]']", "940");
    console.log("✓ [SEARCH] Selected IT category (value=940)");

    // Click search button
    await page.click("input.btn.btn-primary[type='submit'][value='Search']");
    console.log("✓ [SEARCH] Search button clicked");

    await page.waitForTimeout(2000);
    console.log("✅ [SEARCH] Search completed");
  } catch (err) {
    console.error("❌ [SEARCH] Error during search:", err);
    await debugPageElements(page, "Search Error");
    throw err;
  }
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
      externalLink = (await linkEl.getAttribute("href")) || "";
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
    console.log(`📊 [SCRAPE] Processing page ${currPage}...`);
    logger.log(`${env.VENDOR} - page:${currPage}`);

    // Try to find the table
    const tableFound = await page.waitForSelector("table#bidTable").catch(() => {
      console.log("⚠️ [SCRAPE] table#bidTable not found");
      lastPage = true;
      return null;
    });

    if (!tableFound) {
      console.log("🔍 [SCRAPE] Debugging table structure...");
      await debugPageElements(page, "Search Results - No Table Found");

      // Try to find any tables
      const allTables = await page.locator("table").all();
      console.log(`  Found ${allTables.length} table(s) on page`);
      for (let i = 0; i < allTables.length; i++) {
        const table = allTables[i];
        const id = await table.getAttribute("id").catch(() => null);
        const className = await table.getAttribute("class").catch(() => null);
        console.log(`    Table ${i}: id="${id}", class="${className}"`);
      }
      continue;
    }

    const rows = await page.locator("table#bidTable tbody tr[class*='Row']");
    const rowCount = await rows.count();
    console.log(`✓ [SCRAPE] Found ${rowCount} rows in table`);

    if (rowCount === 0) {
      console.log("⚠️ [SCRAPE] No rows found with selector: table#bidTable tbody tr[class*='Row']");
      console.log("🔍 [SCRAPE] Trying alternative row selectors...");

      // Try alternative selectors
      const allTableRows = await page.locator("table#bidTable tbody tr").count();
      const tableRows = await page.locator("table#bidTable tr").count();
      const anyRows = await page.locator("table tbody tr").count();

      console.log(`  table#bidTable tbody tr: ${allTableRows} rows`);
      console.log(`  table#bidTable tr: ${tableRows} rows`);
      console.log(`  table tbody tr: ${anyRows} rows`);

      if (allTableRows > 0 || tableRows > 0 || anyRows > 0) {
        console.log("🔍 [SCRAPE] Rows exist but class selector doesn't match. Debugging first row...");
        const firstRow = await page.locator("table#bidTable tbody tr, table#bidTable tr").first();
        const rowClass = await firstRow.getAttribute("class").catch(() => null);
        const rowId = await firstRow.getAttribute("id").catch(() => null);
        const rowHTML = await firstRow.innerHTML().catch(() => "").then(html => html.substring(0, 500));
        console.log(`    First row: class="${rowClass}", id="${rowId}"`);
        console.log(`    First row HTML (500 chars): ${rowHTML}`);
      }

      lastPage = true;
      continue;
    }

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      console.log(`  Processing row ${i + 1}/${rowCount}...`);
      const sol = await processRow(row, env, context).catch((err) => {
        console.error(`  ❌ Row ${i + 1} failed:`, err);
        logger.error("processRow failed", err);
        return null;
      });
      if (sol) {
        console.log(`  ✓ Row ${i + 1} saved successfully`);
        allSols.push(sol);
      }
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
      console.log("📄 [SCRAPE] No more pages");
    } else {
      await nextPage.first().click();
      await page.waitForTimeout(1000);
      console.log("📄 [SCRAPE] Moving to next page...");
    }
    currPage++;
  } while (!lastPage);

  console.log(`✅ [SCRAPE] Completed. Total sols collected: ${allSols.length}`);
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
