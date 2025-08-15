import { onRequest } from "firebase-functions/v2/https";
import playwrightCore from "playwright-core";
import chromium from "@sparticuz/chromium";
import {
  login,
  scrapeAllBids,
} from "../playwright/rfpSearch/publicPurchase/invitedBids";

export const playwright = onRequest(
  {
    memory: "1GiB",
    secrets: ["DEV_PUBLICPURCHASE_USER", "DEV_PUBLICPURCHASE_PASS"],
    timeoutSeconds: 3600,
  },
  async (req, res) => {
    const USER = process.env.PUBLICPURCHASE_USER!;
    const PASS = process.env.PUBLICPURCHASE_PASS!;

    if (!USER || !PASS) {
      res.status(500).send("Missing creds");
      return;
    }

    const browser = await playwrightCore.chromium.launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: chromium.args,
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await login(page, USER, PASS);

      // Go to last page
      page.locator("#invitedBids > div:nth-child(2) a:last-child").click();
      await page.waitForTimeout(1000);

      const bids = await scrapeAllBids(page);

      await browser.close();

      res.json({ bids });
    } catch (e: any) {
      console.error(e);
      res.status(500).send(e.message);
    } finally {
      await browser.close();
    }
  }
);
