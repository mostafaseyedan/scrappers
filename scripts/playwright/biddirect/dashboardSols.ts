import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import { sanitizeDateString } from "../../../functions/src/lib/utils";

const USER = process.env.BIDDIRECT_USER!;
const PASS = process.env.BIDDIRECT_PASS!;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.bidnetdirect.com/", {
    waitUntil: "domcontentloaded",
  });
  await page.click("#header_btnLogin");

  await page.waitForSelector('input[name="j_username"]');
  await page.fill('input[name="j_username"]', user);
  await page.fill('input[name="j_password"]', pass);
  await page.click("#loginButton");
}

async function parseSolRow(row) {
  const siteUrl = await row
    .locator(".solicitationTitle > a[href]")
    .getAttribute("href");
  const siteId = siteUrl ? siteUrl.match(/[0-9]+/i)?.[0] : "";
  const closingDate = sanitizeDateString(
    await row.locator(".dateValue").innerText()
  );
  const buyerEl = await row.locator(".buyerIdentification");
  const issuer = (await buyerEl.isVisible())
    ? await buyerEl
        .first()
        .innerText()
        .catch((err: unknown) => console.warn(err))
    : "";
  const title = await row.locator(".solicitationTitle > a").innerText();
  const publishDateEl = await row
    .locator(".publicationDate")
    .first()
    .innerText();
  const publishDate = sanitizeDateString(publishDateEl);
  return {
    title: title.replace(/\n/g, " "),
    location: await row.locator(".regionValue").first().innerText(),
    issuer,
    description: await row.locator(".solicitationDescription").innerText(),
    closingDate,
    publishDate,
    site: "biddirect",
    siteUrl: siteUrl ? "https://www.bidnetdirect.com" + siteUrl : "",
    siteId,
  };
}

async function scrapeAllSols(page: Page) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;

  await page.goto(
    "https://www.bidnetdirect.com/private/supplier/solicitations/search?target=init",
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForSelector("#solicitationsTable");

  const cookieEl = page.locator("#cookieBannerAcceptBtn");
  if (await cookieEl.isVisible()) {
    await cookieEl.click();
  }

  do {
    const rows = page.locator("#solicitationsTable tbody > tr:visible");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await parseSolRow(row).catch((err: unknown) =>
        console.warn(err)
      );
      if (sol) allSols.push(sol);
    }

    const nextPage = page.locator(".mets-pagination-page-icon.next").first();
    const classes = await nextPage.getAttribute("class");

    if (classes?.includes("disabled")) {
      lastPage = true;
    } else {
      await nextPage.click();
      await page.waitForTimeout(1000);
    }
  } while (!lastPage);

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
  const allSols = await scrapeAllSols(page);
  console.log(allSols);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
