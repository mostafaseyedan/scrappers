import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import { sanitizeDateString } from "../../../functions/src/lib/utils";

const USER = process.env.INSTANTMARKETS_USER!;
const PASS = process.env.INSTANTMARKETS_PASS!;

/*
https://www.instantmarkets.com/q/ERP%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Information_Technology%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/SaaS%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Cloud%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Business_Intelligence%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Staffing%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Software%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/System%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Application%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Website%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Computers%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
https://www.instantmarkets.com/q/Laptops%3Fot%3DBid%2520Notification,Pre-Bid%2520Notification&os%3DActive
*/

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.instantmarkets.com/signin", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[placeholder="Enter your email address"]', user);
  await page.fill('input[placeholder="Enter your password"]', pass);
  await page.click("button:has-text('Login')");
}

async function parseSolRow(row) {
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
      'button:has-text("Don\'t Ask Again")'
    );
    const popupDismissCount = await popupDismiss.count();
    if (popupDismissCount > 0) await popupDismiss.click();

    await page.waitForTimeout(1000);

    const nextPage = page.locator('pagination-async button:has-text("Next ")');
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

async function run() {
  const browser: Browser = await chromium.launch({
    headless: false,
    args: ["--deny-permission-prompts"],
    slowMo: 50, // Slow down for debugging
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  });
  const page: Page = await context.newPage();

  await login(page, USER, PASS);
  const allSols = await scrapeAllSols(page);
  console.log(allSols);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
