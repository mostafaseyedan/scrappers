import "dotenv/config";
import { chromium, Browser, Page, Locator } from "playwright";

const USER = process.env.PUBLICPURCHASE_USER!;
const PASS = process.env.PUBLICPURCHASE_PASS!;

async function parseBidRows(rows: Locator) {
  const bids = [];
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const bid = {
      title: await row.locator("> td:nth-child(1)").innerText(),
      issuer: await row.locator("> td:nth-child(2)").innerText(),
      publishDate: await row.locator("> td:nth-child(3)").innerText(),
      closingDate: await row.locator("> td:nth-child(4)").innerText(),
      site: "publicpurchase",
      siteId: await row.locator("> td:nth-child(7)").innerText(),
      siteUrl:
        "https://www.publicpurchase.com" +
        (await row
          .locator("> td:nth-child(1) > a[href]")
          .first()
          .getAttribute("href")),
    };
    bids.push(bid);
  }

  return bids;
}

async function login(page: Page) {
  await page.goto("https://www.publicpurchase.com/gems/login/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill('input[name="uname"]', USER);
  await page.fill('input[name="pwd"]', PASS);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('input[value="Login"]'),
  ]);

  // We should be at home page
  await page.waitForSelector("#invitedBids");
}

async function scrapeAllBids(page: Page) {
  let allBids: Record<string, any>[] = [];
  let lastPage = false;

  do {
    const bids = await parseBidRows(
      page.locator("#invitedBids tbody > tr:visible")
    );
    allBids = allBids.concat(bids);

    const prevPage = page.locator(
      "#invitedBids > div:nth-child(2) a:nth-child(2)"
    );
    const styles = await prevPage.getAttribute("style");
    prevPage.click();
    await page.waitForTimeout(3000);

    const prevPageExists = (await prevPage.count()) > 0;

    // Is this disabled?
    if (styles?.includes("color:#999999") || !prevPageExists) {
      lastPage = true;
    }
  } while (lastPage !== true);

  return allBids;
}

async function run() {
  const browser: Browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  await login(page);

  // Go to last page
  page.locator("#invitedBids > div:nth-child(2) a:last-child").click();
  await page.waitForTimeout(1000);

  const bids = await scrapeAllBids(page);
  console.log({ bids });

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
