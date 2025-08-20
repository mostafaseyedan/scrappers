import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import { sanitizeDateString } from "../../../functions/src/lib/utils";
import { md5 } from "../../utils";

const USER = process.env.TECHBIDS_USER!;
const PASS = process.env.TECHBIDS_PASS!;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://techbids.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="email"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click("button:has-text('Sign In to Your Account')");
}

async function parseSolRow(row, context) {
  const currYear = new Date().getFullYear();
  const closingDate =
    (await row.locator("td:nth-child(5)").innerText()) + " " + currYear;
  const siteLink = await row.locator("td:nth-child(2) a[href]");
  const title = await siteLink.innerText();
  const siteUrl = await siteLink.getAttribute("href");
  const siteId =
    siteUrl?.match(/https:\/\/techbids.com\/bids\/(\d+)\//i)?.[1] ||
    "techbids-" + md5(title + closingDate);

  const newPagePromise = context.waitForEvent("page");
  await siteLink.click();
  const newPage = await newPagePromise;
  await newPage.waitForLoadState();
  const sourceLink = await newPage
    .locator('a:has-text(" View Full Details at Source ")')
    .first()
    .getAttribute("href");
  const description =
    (await newPage
      .locator(
        ".relative.overflow-hidden + .px-4.py-8 > div > div > div.rounded-xl.border-gray-100 .leading-relaxed"
      )
      .innerText()
      .catch(() => console.warn("no description"))) || "";
  await newPage.close();

  return {
    title,
    description,
    issuer: await row.locator("td:nth-child(4)").innerText(),
    closingDate: sanitizeDateString(closingDate),
    publishDate: sanitizeDateString(
      (await row.locator("td:nth-child(1)").innerText()) + " " + currYear
    ),
    externalLinks: [sourceLink],
    site: "techbids",
    siteUrl,
    siteId: "techbids-" + siteId,
  };
}

async function scrapeAllSols(page: Page, context) {
  let allSols: Record<string, any>[] = [];

  const nextPage = await page
    .locator('nav[aria-label="Pagination Navigation"] button[dusk="nextPage"]')
    .first();
  const list = await page.locator(".sticky + .mt-0.hidden.px-0");
  const rows = await list.locator("tbody > tr:visible");
  const rowCount = await rows.count();
  let lastPage = false;

  do {
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await parseSolRow(row, context).catch((err: unknown) =>
        console.warn(err)
      );
      if (sol) allSols.push(sol);
    }

    const classes = await nextPage.getAttribute("class");
    if (classes?.includes("disabled")) {
      lastPage = true;
    } else {
      await nextPage.click();
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
  const allSols = await scrapeAllSols(page, context);
  console.log(allSols);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
