import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import { sanitizeDateString } from "../../../functions/src/lib/utils";

const USER = process.env.BIDSYNC_USER!;
const PASS = process.env.BIDSYNC_PASS!;

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

async function parseSolRow(row) {
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
        .catch((err: unknown) => console.warn(err))
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
    siteUrl,
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
  console.log(`Found ${rowCount} rows`);
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const sol = await parseSolRow(row);
    allSols.push(sol);
  }

  return allSols;
}

async function run() {
  const browser: Browser = await chromium.launch({
    headless: false,
    slowMo: 50, // Slow down for debugging
  });
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  await login(page, USER, PASS);
  await page.waitForSelector("#matAllBidsContent");

  for (let i = 0; i < 2; i++) {
    page.locator("#loadMoreBids").click();
    await page.waitForTimeout(1000);
  }

  const allSols = await scrapeAllSols(page);
  console.log(allSols);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
