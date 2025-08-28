import {
  isNotExpired,
  isItRelated,
  isSolDuplicate,
  isWithinDays,
} from "../../../lib/script";
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

  await page.goto(
    "https://www.findrfp.com/service/login.aspx?ReturnUrl=%2fcustomer%2fdefault.aspx",
    {
      waitUntil: "domcontentloaded",
    }
  );
  await page.fill("input#txtLogin", user);
  await page.fill("input#txtPassword", pass);
  await page.click("#btnLogin");

  await page.waitForTimeout(5000);
}

async function processRow(
  row: Locator,
  env: Record<string, any>,
  context: BrowserContext
) {
  const siteLink = await row.locator("td:nth-child(2) a[href]");

  if ((await siteLink.count()) === 0) return false;

  const siteUrl = await siteLink.getAttribute("href");
  const siteId = siteUrl?.match(/rfpid=([A-Z0-9-]+)/i)?.[1];
  const publishDate = await row.locator("td:nth-child(5)").innerText();
  const location = await row.locator("td:nth-child(4)").innerText();
  const issuer = await row.locator("td:nth-child(3)").innerText();

  const newPagePromise = context.waitForEvent("page");
  await siteLink.click({ modifiers: ["Control"] });
  const newPage = await newPagePromise;
  await newPage.waitForSelector("#Table2 tbody tr a[href]");
  let sourceLink = await newPage
    .locator("#Table2 tbody tr a[href]")
    .first()
    .getAttribute("href");
  if (sourceLink?.startsWith("/customer"))
    sourceLink = "https://www.findrfp.com/" + sourceLink;
  await newPage.waitForTimeout(1000);
  await newPage.close();

  const sol = {
    title: await siteLink.innerText(),
    issuer: issuer.trim(),
    location,
    externalLinks: sourceLink ? [sourceLink] : [],
    publishDate: sanitizeDateString(publishDate),
    site: "findrfp",
    siteUrl: "https://www.findrfp.com/service" + siteUrl,
    siteId,
  } as Record<string, any>;

  if (sol.closingDate && !isNotExpired(sol)) {
    logger.log(sol.closingDate, "is expired");
    expiredCount++;
    return false;
  }

  if (sol.publishDate && !isWithinDays(sol.publishDate, 14)) {
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

  return sol;
}

async function scrapeAllSols(
  page: Page,
  env: Record<string, any>,
  context: BrowserContext
) {
  let allSols: Record<string, any>[] = [];
  let lastPage = true;
  let currPage = 1;

  await page.goto(
    "https://www.findrfp.com/service/search.aspx?s=it+staffing&t=FE&is=0",
    {
      waitUntil: "domcontentloaded",
    }
  );

  await page.waitForSelector(
    "table.SectionContentBlack tbody tr:not(tr.SectionContentBlack)"
  );

  do {
    logger.log(`${env.VENDOR} - page ${currPage}`);
    const rows = await page.locator(
      "table.SectionContentBlack tbody tr:not(tr.SectionContentBlack)"
    );
    const rowCount = await rows.count();
    logger.log(`Found ${rowCount} rows`);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await processRow(row, env, context).catch((err) =>
        logger.error("processRow failed", err)
      );
      if (sol) allSols.push(sol);
    }

    if (expiredCount >= 20) {
      lastPage = true;
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      continue;
    }

    const nextPage = page
      .locator(`#lblPage a.paging[href*='pageNo=${currPage + 1}']`)
      .first();
    const nextPageCount = await nextPage.count();

    if (nextPageCount === 0) {
      lastPage = true;
    } else {
      await nextPage.click();
      await page.waitForTimeout(2000);
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
  const USER = env.DEV_FINDRFP_USER!;
  const PASS = env.DEV_FINDRFP_PASS!;
  const VENDOR = "findrfp";
  let results = {};

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);

  let sols = await scrapeAllSols(
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
