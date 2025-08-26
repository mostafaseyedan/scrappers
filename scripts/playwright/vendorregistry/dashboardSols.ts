import "dotenv/config";
import { chromium, Browser, Locator, Page } from "playwright-core";
import { sanitizeDateString } from "../../../functions/src/lib/utils";

const USER = process.env.VENDORREGISTRY_USER!;
const PASS = process.env.VENDORREGISTRY_PASS!;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://vrapp.vendorregistry.com/Account/LogOn", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="UserName"]', user);
  await page.fill('input[name="Password"]', pass);
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
    ? siteUrl.match(/\/Bids\/View\/Bid\/([a-z0-9\-]+)\?/i)?.[1]
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

  do {
    const rows = page.locator("#contractTable tbody > tr:visible");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await parseSolRow(row);
      allSols.push(sol);
    }

    const nextPage = page.locator(".pageSelector li.PagedList-skipToNext");
    const classes = await nextPage.getAttribute("class");

    if (classes?.includes("disabled")) {
      lastPage = true;
    } else {
      await nextPage.locator("> a").click();
      await page.waitForTimeout(1000);
    }
  } while (lastPage !== true);

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

  // Set to sort by date posted desc
  await page.locator('#contractTable th[data-fieldname="datePosted"]').click();
  await page.waitForTimeout(1000);
  await page.locator('#contractTable th[data-fieldname="datePosted"]').click();
  await page.waitForTimeout(1000);

  const sols = await scrapeAllSols(page);
  console.log(sols);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
