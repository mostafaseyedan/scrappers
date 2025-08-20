import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import { md5 } from "../../../lib/md5";
import type { BrowserContext, Locator, Page } from "playwright-core";

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

async function parseSolRow(row: Locator, context: BrowserContext) {
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
      .catch(() => logger.warn(title, "no description"))) || "";
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

async function scrapeAllSols(page: Page, context: BrowserContext) {
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

export async function run(
  page: Page,
  env: Record<string, any> = {},
  context: BrowserContext
) {
  const BASE_URL = env.BASE_URL!;
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  const USER = env.DEV_TECHBIDS_USER!;
  const PASS = env.DEV_TECHBIDS_PASS!;
  const VENDOR = "techbids";
  let results = {};
  let failCount = 0;
  let successCount = 0;
  let expiredCount = 0;
  let nonItCount = 0;
  let dupCount = 0;

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);

  let sols = await scrapeAllSols(page, context);
  const total = sols.length;

  // Filter out expired
  sols = sols.filter((sol) => {
    if (sol.closingDate) {
      if (isNotExpired(sol)) return true;
      logger.log(sol.closingDate, "is expired");
      expiredCount++;
      return false;
    }

    return sol;
  });

  logger.log(`${VENDOR} - Total solicitations found:${total}.`);

  // Save each sols
  for (const sol of sols) {
    const isDup = await isSolDuplicate(sol, BASE_URL, SERVICE_KEY).catch(
      (err) => {
        logger.error("isSolDuplicate failed", err, sol);
        failCount++;
      }
    );
    if (isDup) {
      dupCount++;
      continue;
    }

    const solIsIt = await isItRelated(sol).catch((err) => {
      logger.error("isItRelated failed", err, sol);
      failCount++;
    });
    if (solIsIt === false) {
      nonItCount++;
      continue;
    }

    const newRecord = await solModel
      .post({
        baseUrl: BASE_URL,
        data: { location: "", ...sol },
        token: SERVICE_KEY,
      })
      .catch((err: unknown) => {
        logger.error("Failed to save sol", err, sol);
        failCount++;
      });
    logger.log(`Saved sol: ${newRecord.id}`);
    successCount++;
  }

  logger.log(
    `${VENDOR} - Finished saving sols. Success: ${successCount}. Fail: ${failCount}. Duplicates: ${dupCount}. Junk: ${
      expiredCount + nonItCount
    }.`
  );

  results = {
    sols,
    counts: {
      success: successCount,
      fail: failCount,
      dup: dupCount,
      junk: expiredCount + nonItCount,
    },
  };

  return results;
}
