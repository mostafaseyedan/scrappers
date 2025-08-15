import { onRequest } from "firebase-functions/v2/https";
import playwrightCore from "playwright-core";
import chromium from "@sparticuz/chromium";
import type { Locator } from "playwright-core";

async function captureBids(rows: Locator) {
  const bids: any[] = [];
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    bids.push({
      title: await row.locator("> td:nth-child(1)").innerText(),
      issuer: await row.locator("> td:nth-child(2)").innerText(),
      publishDate: await row.locator("> td:nth-child(3)").innerText(),
      closingDate: await row.locator("> td:nth-child(4)").innerText(),
      site: "publicpurchase",
      siteId: await row.locator("> td:nth-child(7)").innerText(),
    });
  }
  return bids;
}

export const playwright = onRequest(
  { memory: "1GiB", timeoutSeconds: 3600 },
  async (req, res) => {
    const USER = process.env.PUBLICPURCHASE_USER || "idenis";
    const PASS = process.env.PUBLICPURCHASE_PASS || "3620NJosey!";

    if (!USER || !PASS) {
      res.status(500).send("Missing creds");
      return;
    }

    // Ensure playwright looks inside node_modules
    // process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
    // const { chromium } = await import("playwright");
    // Debug: log what’s actually deployed
    /*
    try {
      const coreDir = path.dirname(
        require.resolve("playwright-core/package.json")
      );
      const localBrowsers = path.join(coreDir, ".local-browsers");
      console.log("Exists .local-browsers:", fs.existsSync(localBrowsers));
      if (fs.existsSync(localBrowsers)) {
        console.log(".local-browsers contents:", fs.readdirSync(localBrowsers));
      }
      console.log("chromium.executablePath():", chromium.executablePath());
    } catch (e) {
      console.log("Browser debug error:", e);
    } */

    const browser = await playwrightCore.chromium.launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: chromium.args,
    });

    let allBids: any[] = [];

    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("https://www.publicpurchase.com/gems/login/login", {
        waitUntil: "domcontentloaded",
      });

      await page.fill("input[name=\"uname\"]", USER);
      await page.fill("input[name=\"pwd\"]", PASS);
      await Promise.all([
        page.waitForLoadState("networkidle"),
        page.click("input[value=\"Login\"]"),
      ]);

      await page.waitForSelector("#invitedBids");
      await page
        .locator("#invitedBids > div:nth-child(2) a:last-child")
        .click();
      await page.waitForTimeout(1000);

      allBids.push(
        ...(await captureBids(page.locator("#invitedBids tbody > tr:visible")))
      );

      /*
      let done = false;
      while (!done) {
        allBids.push(
          ...(await captureBids(
            page.locator("#invitedBids tbody > tr:visible")
          ))
        );
        const prevPage = page.locator(
          "#invitedBids > div:nth-child(2) a:nth-child(2)"
        );
        const style = await prevPage.getAttribute("style");
        if (style?.includes("color:#999999")) {
          done = true;
        } else {
          await prevPage.click();
          await page.waitForTimeout(1500);
        }
      } */

      res.json({ bids: allBids });
    } catch (e: any) {
      console.error(e);
      res.status(500).send(e.message);
    } finally {
      await browser.close();
    }
  }
);
