import { isNotExpired, isSolDuplicate } from "../../../lib/script";
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

  await page.goto("https://www.highergov.com/signin/", {
    waitUntil: "domcontentloaded",
  });
  await page.fill("input#id_username", user);
  await page.fill("input#id_password", pass);
  await page.click("button#sign_in_button");

  await page.waitForEvent("domcontentloaded");
}

async function processRow(row: Locator, env: Record<string, any>) {
  const siteLink = await row.locator("a[href^='/contract-']");
  const siteUrl = await siteLink.getAttribute("href");
  const siteId = await row.getAttribute("id");
  const publishDate = await row.locator("> td:nth-child(5)").innerText();
  const closingDate = await row.locator("> td:nth-child(6)").innerText();
  const issuer = await row.locator("> td:nth-child(3)").innerText();
  const description = await row.locator("+ tr .dtr-data").innerText();
  const sol = {
    title: await siteLink.innerText(),
    description,
    issuer: issuer.trim(),
    closingDate: sanitizeDateString(closingDate),
    publishDate: sanitizeDateString(publishDate),
    site: "highergov",
    siteUrl: "https://highergov.com" + siteUrl,
    siteId: siteId?.replace("row-", ""),
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

  await page.goto("https://www.highergov.com/contract-opportunity/", {
    waitUntil: "domcontentloaded",
  });

  await page.locator("#free_text").fill(keyword);
  await page.locator("#free_text").press("Enter");

  await page.waitForSelector(
    "#datatable_search_contract_opportunity tbody tr.odd"
  );

  do {
    logger.log(`${env.VENDOR} - keyword:${keyword} page:${currPage}`);
    const rows = await page.locator(
      "#datatable_search_contract_opportunity tbody tr.odd"
    );
    const rowCount = await rows.count();

    if (rowCount === 1) {
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

    if (expiredCount >= 20) {
      lastPage = true;
      logger.info("higher gov - ended because too many expired dates");
      continue;
    }

    const nextPage = page.locator(
      "#datatable_search_contract_opportunity_paginate li.paginate_button.next"
    );
    const nextPageCount = await nextPage.count();

    if (nextPageCount === 0) {
      lastPage = true;
    } else {
      await nextPage.click();
      await page.waitForSelector(
        "#datatable_search_contract_opportunity_processing",
        { state: "hidden" }
      );
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
  const USER = env.DEV_HIGHERGOV_USER!;
  const PASS = env.DEV_HIGHERGOV_PASS!;
  const VENDOR = "highergov";
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
