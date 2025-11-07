import { isNotExpired, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import { md5 } from "../../../lib/md5";
import type { BrowserContext, Locator, Page } from "playwright-core";

let failCount = 0;
let successCount = 0;
let expiredCount = 0;
let nonItCount = 0;
let dupCount = 0;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://techbids.com/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input[name=\"email\"]", user);
  await page.fill("input[name=\"password\"]", pass);
  await page.click("button:has-text('Sign In to Your Account')");
}

async function parseSolRow(
  row: Locator,
  context: BrowserContext
): Promise<Record<string, any>> {
  const currYear = new Date().getFullYear();
  const closingDate =
    (await row.locator("td:nth-child(5)").innerText()) + " " + currYear;
  const siteLink = await row.locator("td:nth-child(2) a[href]");
  const title = await siteLink.innerText();
  const siteUrl = await siteLink.getAttribute("href");
  const siteIdPart =
    siteUrl?.match(/https:\/\/techbids.com\/bids\/(\d+)\//i)?.[1] ||
    md5(title + closingDate);

  const newPagePromise = context.waitForEvent("page");
  await siteLink.click();
  const newPage = await newPagePromise;
  await newPage.waitForLoadState();
  const sourceLink = await newPage
    .locator("a:has-text(\" View Full Details at Source \")")
    .first()
    .getAttribute("href");
  const description =
    (await newPage
      .locator(
        ".relative.overflow-hidden + .px-4.py-8 > div > div > div.rounded-xl.border-gray-100 .leading-relaxed"
      )
      .innerText()
      .catch(() => logger.warn(title, "no description"))) || "";
  const issuer = await newPage
    .locator(".relative p.mt-2.text-lg.text-gray-600 span.font-medium")
    .innerText();
  await newPage.close();

  return {
    title,
    description,
    issuer,
    location: await row.locator("td:nth-child(4)").innerText(),
    closingDate: sanitizeDateString(closingDate),
    publishDate: sanitizeDateString(
      (await row.locator("td:nth-child(1)").innerText()) + " " + currYear
    ),
    externalLinks: [sourceLink],
    site: "techbids",
    siteUrl,
    siteId: "techbids-" + siteIdPart,
  };
}

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
): Promise<Record<string, any> | false> {
  const sol = await parseSolRow(row, context).catch((err: unknown) => {
    logger.error("parseSolRow failed", err);
  });
  if (!sol) return false;

  if (sol.closingDate && !isNotExpired(sol)) {
    expiredCount++;
    return false;
  }

  const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY).catch(
    (err) => {
      logger.error("isSolDuplicate failed", err, sol);
      failCount++;
    }
  );
  if (isDup) {
    dupCount++;
    return false;
  }

  const newRecord = await solModel
    .post({
      baseUrl: env.BASE_URL,
      data: sol,
      token: env.SERVICE_KEY,
    })
    .catch((err: unknown) => {
      logger.error("Failed to save sol", err, sol);
      failCount++;
    });
  successCount++;
  logger.log(`Saved sol: ${newRecord.id}`);

  return sol as Record<string, any>;
}

async function scrapeAllSols(
  page: Page,
  env: Record<string, any>,
  context: BrowserContext
) {
  const maxPage = 20;
  let allSols: Record<string, any>[] = [];
  let lastPage = false;
  let currPage = 1;

  // Wait for the dashboard table to be present after login
  await page.waitForSelector(".sticky + .mt-0.hidden.px-0");

  do {
    logger.log(`${env.VENDOR} - page ${currPage}`);

    const list = page.locator(".sticky + .mt-0.hidden.px-0");
    const rows = list.locator("tbody > tr:visible");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env, context).catch((err: unknown) =>
        logger.error("processRow failed", err)
      );
      if (sol && sol?.siteId) {
        allSols.push(sol);
      }
    }

    if (expiredCount >= 20) {
      lastPage = true;
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      continue;
    }

    const nextPage = page
      .locator(
        "nav[aria-label=\"Pagination Navigation\"] button[dusk=\"nextPage\"]"
      )
      .first();
    const classes = await nextPage.getAttribute("class");

    if (classes?.includes("disabled") || currPage === maxPage) {
      lastPage = true;
    } else {
      await nextPage.click();
      await page.waitForTimeout(1000);
    }
    currPage++;
  } while (!lastPage);

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

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);

  const sols = await scrapeAllSols(
    page,
    {
      ...env,
      BASE_URL,
      VENDOR,
      SERVICE_KEY,
    },
    context
  );

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
