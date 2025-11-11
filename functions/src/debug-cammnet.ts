import { config } from "dotenv";
import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";

config({ path: "/home/mohammad_alsayyedan/Recon/recon/.env" });

async function debug() {
  console.log("🔍 Debugging cammnet page structure...");

  const BROWSERBASE_KEY = process.env.BROWSERBASE_KEY || process.env.DEV_BROWSERBASE_KEY;

  const bb = new Browserbase({ apiKey: BROWSERBASE_KEY! });
  const session = await bb.sessions.create({
    projectId: "859b2230-84b0-449b-a2db-f9352988518c",
    proxies: true,
  });

  console.log(`📹 Watch live: https://www.browserbase.com/sessions/${session.id}`);

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  await page.goto("https://procurement.opengov.com/portal/octa", {
    waitUntil: "domcontentloaded",
  });

  console.log("⏳ Waiting for Cloudflare challenge to pass (up to 90s)...");

  // Wait for Cloudflare challenge to disappear
  await page.waitForFunction(
    () => !document.title.includes("Just a moment"),
    { timeout: 90000 }
  ).catch(() => console.log("⚠️  Cloudflare challenge timeout after 90s"));

  console.log("✓ Cloudflare passed, waiting for content...");

  // Wait for actual content to appear
  await page.waitForSelector("[role='row']", { timeout: 30000 })
    .catch(() => console.log("⚠️  No rows found"));

  await page.waitForTimeout(3000); // Extra wait for content to stabilize

  console.log("\n🔍 Checking for common table/list selectors:");

  const selectors = [
    "table",
    "tbody tr",
    "[role='row']",
    ".procurement-item",
    ".opportunity",
    "[data-testid*='row']",
    "[data-testid*='item']",
    ".MuiDataGrid-row",
    "[class*='row']",
  ];

  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    console.log(`  ${selector}: ${count} elements`);
  }

  console.log("\n📄 Page title:", await page.title());
  console.log("📄 Page URL:", page.url());

  // Get HTML snippet
  const bodyText = await page.locator("body").textContent();
  console.log("\n📝 First 500 chars of body text:");
  console.log(bodyText?.substring(0, 500));

  // Get details of first row
  const rows = page.locator("[role='row']");
  const firstRowCount = await rows.count();

  if (firstRowCount > 1) { // Skip header row
    console.log("\n🔍 First data row structure:");
    const firstRow = rows.nth(1); // Skip header, get first data row
    const rowText = await firstRow.textContent();
    console.log("Text content:", rowText);

    const rowHTML = await firstRow.innerHTML();
    console.log("\nHTML structure (first 800 chars):");
    console.log(rowHTML.substring(0, 800));
  }

  await browser.close();
  console.log(`\n📹 Review session: https://www.browserbase.com/sessions/${session.id}`);
}

debug();
