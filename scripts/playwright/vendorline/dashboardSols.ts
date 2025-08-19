import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import { sanitizeDateString } from "../../../functions/src/lib/utils";

const USER = process.env.VENDORLINE_USER!;
const PASS = process.env.VENDORLINE_PASS!;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://vendorline.planetbids.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="userName"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click("button.btn-primary.close-login");
}

async function parseSolRow(row, siteId, context) {
  await row
    .locator(".bid-details-info .list-item-row")
    .first()
    .waitFor({ state: "visible" });
  const bidDetailsItems = await row.locator(".bid-details-info .list-item-row");
  const bidDetailsCount = await bidDetailsItems.count();
  const bidDetails = {};

  for (let i = 0; i < bidDetailsCount; i++) {
    const bidDetailsItem = bidDetailsItems.nth(i);
    const label = await bidDetailsItem
      .locator(".list-item-label")
      .first()
      .innerText();
    const value = await bidDetailsItem
      .locator(".list-item-value")
      .first()
      .innerText();
    bidDetails[label] = value;
  }

  const newPagePromise = context.waitForEvent("page");
  await row.locator(".bid-actions button:has-text('Open Details')").click();
  const newPage = await newPagePromise;
  await newPage.waitForLoadState();
  const siteUrl = newPage.url();
  await newPage.close();

  return {
    title: await row.locator(".project-title").innerText(),
    description: await row.locator(".bid-details-description").innerText(),
    issuer: bidDetails["Agency"],
    closingDate: sanitizeDateString(
      await row.locator(".due-date-value").innerText()
    ),
    site: "vendorline",
    siteUrl,
    siteId,
    siteData: {
      bidDetails,
    },
  };
}

async function scrapeAllSols(page: Page, context) {
  let allSols: Record<string, any>[] = [];

  await page.waitForSelector(".MuiDataGrid-virtualScrollerRenderZone");

  const closeSurveyEl = page.locator(
    ".productfruits--container-pr-fk .close-btn"
  );
  if (await closeSurveyEl.isVisible()) {
    await closeSurveyEl.click();
  }

  await page
    .locator(".MuiDataGrid-virtualScrollerRenderZone > div[data-id]")
    .first()
    .click();

  for (let i = 0; i < 5; i++) {
    const row = await page.locator(".slide-container");
    const siteId = await row.getAttribute("data-id");
    const sol = await parseSolRow(row, siteId, context).catch((err: unknown) =>
      console.warn(err)
    );
    if (sol) allSols.push(sol);
    await page.locator(".footer-buttons .center-buttons + button").click();
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
  const allSols = await scrapeAllSols(page, context);
  console.log(allSols);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
