import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

let failCount = 0;
let successCount = 0;
let expiredCount = 0;
let nonItCount = 0;
let dupCount = 0;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.demandstar.com/app/login", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input#userName", user);
  await page.fill("input#password", pass);
  await page.click("button[name='login']");

  await page.waitForNavigation({ waitUntil: "domcontentloaded" });
}

async function processRow(row: Locator, env: Record<string, any>) {
  const siteLink = await row.locator("a[href^='/app/suppliers/bids/']");
  const siteUrl = await siteLink.getAttribute("href");
  const siteId = await row
    .locator("ul.list-inline:last-child li:nth-child(1)")
    .innerText();
  const publishDate = await row
    .locator("ul.list-inline:last-child li:nth-child(2)")
    .innerText();
  const closingDate = await row
    .locator("ul.list-inline:last-child li:nth-child(3)")
    .innerText();
  const issuerLoc = await row.locator("h5[title] + ul p").first().innerText();
  const issuer = issuerLoc.substring(0, issuerLoc.indexOf(",")).trim();
  const location = issuerLoc.substring(issuerLoc.indexOf(",") + 1).trim();
  const sol = {
    title: await siteLink.innerText(),
    location,
    issuer,
    closingDate: sanitizeDateString(closingDate.replace("Due: ", "")),
    publishDate: sanitizeDateString(publishDate.replace("Broadcast: ", "")),
    site: "demandstar",
    siteUrl: "https://www.demandstar.com" + siteUrl,
    siteId: siteId.replace("ID: ", ""),
  };

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

  const solIsIt = await isItRelated(sol).catch((err) => {
    logger.error("isItRelated failed", err, sol);
    failCount++;
  });
  if (solIsIt === false) {
    nonItCount++;
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

  return newRecord;
}

async function scrapeAllSols(
  keyword: string = "software",
  page: Page,
  env: Record<string, any>
) {
  let allSols: Record<string, any>[] = [];
  let lastPage;
  let currPage = 1;

  await page.goto("https://www.demandstar.com/app/suppliers/bids", {
    waitUntil: "domcontentloaded",
  });

  await page.locator("[placeholder=\"Bid Name\"]").fill(keyword);
  await page.locator("button[title=\"Search\"]").click();

  await page
    .waitForSelector(
      "[data-testid=\"bids.search.result.list\"] .listGroupWrapper"
    )
    .catch(() => {
      lastPage = true;
    });

  do {
    logger.log(`${env.VENDOR} - keyword:${keyword} page:${currPage}`);
    const rows = await page.locator(
      "[data-testid=\"bids.search.result.list\"] .listGroupWrapper"
    );
    const rowCount = await rows.count();

    if (rowCount === 0) {
      lastPage = true;
      continue;
    }

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env).catch((err) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    const nextPage = page.locator(".pagingWrapper li.active + li");
    const nextPageCount = await nextPage.count();

    if (nextPageCount === 0) {
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
  const USER = env.DEV_DEMANDSTAR_USER!;
  const PASS = env.DEV_DEMANDSTAR_PASS!;
  const VENDOR = "demandstar";
  let results = {};

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);

  const keywords = [
    "erp",
    "software",
    "peoplesoft",
    "lawson",
    "it staffing",
    "workday",
    "oracle",
    "infor",
  ];

  let sols: string[] = [];
  for (const keyword of keywords) {
    logger.info(`${VENDOR} - keyword ${keyword}`);
    expiredCount = 0;
    const keywordSols = await scrapeAllSols(keyword, page, {
      ...env,
      BASE_URL,
      VENDOR,
      SERVICE_KEY,
    });
    sols = sols.concat(keywordSols.map((s) => s.id));
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
