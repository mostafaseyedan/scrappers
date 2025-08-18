import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import {
  login,
  scrapeAllBids,
} from "@/functions/src/playwright/rfpSearch/publicPurchase/invitedBids";

const USER = process.env.PUBLICPURCHASE_USER!;
const PASS = process.env.PUBLICPURCHASE_PASS!;

async function run() {
  const browser: Browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  await login(page, USER, PASS);

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
