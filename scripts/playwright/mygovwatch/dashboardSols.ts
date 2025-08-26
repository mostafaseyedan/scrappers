import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import { sanitizeDateString } from "../../../functions/src/lib/utils";
import { md5 } from "../../utils";

const USER = "will@leafmedium.com";
const PASS = "inno123!";

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.mygovwatch.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="userName"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click("button:has-text('LOGIN')");
}

async function parseSolRow(row, context) {
  const closingDate = await row.locator(".list-view-rfp-due-date").innerText();
  const siteLink = await row.locator("a[href^='/opportunity/']").first();
  const siteUrl =
    "https://clients.mygovwatch.com/" + (await siteLink.getAttribute("href"));

  const newPagePromise = context.waitForEvent("page");
  await siteLink.click();
  const newPage = await newPagePromise;
  await newPage.waitForSelector('a:has-text("LEAD SOURCE")');
  await newPage.locator('a:has-text("LEAD SOURCE")').click();
  await newPage.close();
  const newPagePromise2 = context.waitForEvent("page");
  const newPage2 = await newPagePromise2;
  await newPage2.waitForLoadState();
  const sourceLink = newPage2.url();
  await newPage2.close();

  return {
    title: await row.locator("h4.list-view-rfp-name").innerText(),
    issuer: await row.locator("h3.list-view-buyer-name").innerText(),
    closingDate: sanitizeDateString(closingDate),
    externalLinks: sourceLink ? [sourceLink] : [],
    site: "mygovwatch",
    siteUrl,
    siteId: "mygovwatch-" + md5(siteUrl),
  };
}

async function scrapeAllSols(page: Page, context) {
  let allSols: Record<string, any>[] = [];

  for (let currPage = 1; currPage <= 3; currPage++) {
    console.log(`mygovwatch page ${currPage}`);
    await page.waitForSelector(
      '[ng-controller="RfpListViewController as data"] tbody:nth-child(2) > tr'
    );

    const rows = await page.locator(
      '[ng-controller="RfpListViewController as data"] tbody:nth-child(2) > tr'
    );
    const rowCount = await rows.count();

    for (let i = 1; i <= 3; i++) {
      const row = rows.nth(i);
      const sol = await parseSolRow(row, context).catch((err: unknown) =>
        console.warn(err)
      );
      if (sol) allSols.push(sol);
    }

    await page
      .locator('a[ng-click="selectPage(currentPage + 1);backToTop();"]')
      .first()
      .click();
  }

  return allSols;
}

async function run() {
  const browser: Browser = await chromium.launch({
    headless: false,
    slowMo: 50, // Slow down for debugging
    args: ["--deny-permission-prompts"],
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
