import "dotenv/config";
import { chromium, Browser, Page } from "playwright-core";
import {
  login,
  scrapeAllSols,
} from "../../../functions/src/playwright/rfpSearch/publicPurchase/invitedSols";

const USER = process.env.PUBLICPURCHASE_USER!;
const PASS = process.env.PUBLICPURCHASE_PASS!;

async function run() {
  const browser: Browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  await login(page, USER, PASS);

  // We should be at home page
  await page.waitForSelector("#invitedBids");

  // Go to last page
  page.locator("#invitedBids > div:nth-child(2) a:last-child").click();
  await page.waitForTimeout(1000);

  const sols = await scrapeAllSols(page);
  console.log({ sols });

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
