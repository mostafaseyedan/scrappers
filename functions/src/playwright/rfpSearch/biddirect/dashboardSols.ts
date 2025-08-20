import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://www.bidnetdirect.com/", {
    waitUntil: "domcontentloaded",
  });
  await page.click("#header_btnLogin");

  await page.waitForSelector('input[name="j_username"]');
  await page.fill('input[name="j_username"]', user);
  await page.fill('input[name="j_password"]', pass);
  await page.click("#loginButton");
}

async function parseSolRow(row: Locator) {
  const siteUrl = await row
    .locator(".solicitationTitle > a[href]")
    .getAttribute("href");
  const siteId = siteUrl ? siteUrl.match(/[0-9]+/i)?.[0] : "";
  const closingDate = sanitizeDateString(
    await row.locator(".dateValue").innerText()
  );
  const buyerEl = await row.locator(".buyerIdentification");
  const issuer = (await buyerEl.isVisible())
    ? await buyerEl
        .first()
        .innerText()
        .catch((err: unknown) => console.warn(err))
    : "";
  const title = await row.locator(".solicitationTitle > a").innerText();
  const publishDateEl = await row
    .locator(".publicationDate")
    .first()
    .innerText();
  const publishDate = sanitizeDateString(publishDateEl);
  return {
    title: title.replace(/\n/g, " "),
    location: await row.locator(".regionValue").first().innerText(),
    issuer,
    description: await row.locator(".solicitationDescription").innerText(),
    closingDate,
    publishDate,
    site: "biddirect",
    siteUrl: siteUrl ? "https://www.bidnetdirect.com" + siteUrl : "",
    siteId,
  };
}

async function scrapeAllSols(page: Page) {
  let allSols: Record<string, any>[] = [];
  let lastPage = false;

  await page.goto(
    "https://www.bidnetdirect.com/private/supplier/solicitations/search?target=init",
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForSelector("#solicitationsTable");

  const cookieEl = page.locator("#cookieBannerAcceptBtn");
  if (await cookieEl.isVisible()) {
    await cookieEl.click();
  }

  do {
    const rows = page.locator("#solicitationsTable tbody > tr:visible");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const sol = await parseSolRow(row).catch((err: unknown) =>
        console.warn(err)
      );
      if (sol?.siteId) allSols.push(sol);
    }

    const nextPage = page.locator(".mets-pagination-page-icon.next").first();
    const classes = await nextPage.getAttribute("class");

    if (classes?.includes("disabled")) {
      lastPage = true;
    } else {
      await nextPage.click();
      await page.waitForTimeout(1000);
    }
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
  const USER = env.DEV_BIDDIRECT_USER!;
  const PASS = env.DEV_BIDDIRECT_PASS!;
  const VENDOR = "biddirect";
  let results = {};
  let failCount = 0;
  let successCount = 0;
  let expiredCount = 0;
  let nonItCount = 0;
  let dupCount = 0;

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  await login(page, USER, PASS);
  let sols = await scrapeAllSols(page);
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
