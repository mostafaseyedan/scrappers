import { onRequest } from "firebase-functions/v2/https";
import { chromium, Locator } from "playwright-core";
// import { logger } from "firebase-functions";

async function captureBids(rows: Locator) {
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
    };
    bids.push(bid);
  }

  return bids;
}

export const playwright = onRequest(
  { memory: "1GiB", timeoutSeconds: 60 * 60 },
  async (req, res) => {
    const USER = "idenis";
    const PASS = "3620NJosey!";
    let bids = [];

    if (!USER || !PASS) {
      res.status(500).send("Missing creds");
      return;
    }

    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

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

      // We should be at home page
      await page.waitForSelector("#invitedBids");

      // Go to last page
      page.locator("#invitedBids > div:nth-child(2) a:last-child").click();
      await page.waitForTimeout(1000);

      /*
  bids = [
    ...(await captureBids(page.locator("#invitedBids tbody > tr:visible"))),
  ];
  console.log(bids);
  */

      let lastPage = false;
      do {
        bids = [
          ...(await captureBids(
            page.locator("#invitedBids tbody > tr:visible"),
          )),
        ];
        console.log(bids);

        const prevPage = page.locator(
          "#invitedBids > div:nth-child(2) a:nth-child(2)",
        );
        const styles = await prevPage.getAttribute("style");

        prevPage.click();
        await page.waitForTimeout(3000);

        if (styles?.includes("color:#999999")) {
          lastPage = true;
        }
      } while (lastPage !== false);

      // Temporary pause so you can see the logged-in state
      await page.waitForTimeout(5000);

      await browser.close();

      res.json({ bids });
    } catch (e: any) {
      console.error(e);
      res.status(500).send(e.message);
    } finally {
      await browser.close();
    }
  },
);
