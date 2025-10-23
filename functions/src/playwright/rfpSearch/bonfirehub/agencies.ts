import { isNotExpired, isItRelated, isSolDuplicate } from "../../../lib/script";
import { issuer as issuerModel, site as siteModel } from "../../../models2";
import {
  solicitation as solModel,
  scriptLog as scriptLogModel,
} from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import { parse } from "date-fns";
import urlJoin from "url-join";
import type { BrowserContext, Locator, Page } from "playwright-core";

let failCount = 0;
let successCount = 0;
let expiredCount = 0;
let nonItCount = 0;
let dupCount = 0;
let lastAgencyKey = "";
let totalPages = 0;
let currPage = 1;
let sols: string[] = [];
let resume = false;

async function login(page: Page, user: string, pass: string) {
  if (!pass) throw new Error("Password parameter is missing for login");
  if (!user) throw new Error("User parameter is missing for login");

  await page.goto("https://account.bonfirehub.com/login", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector('input[name="email"]');
  await page.fill('input[name="email"]', user);
  await page.click('button:has-text("Continue")');

  await page.waitForSelector('input[name="password"]');
  await page.fill('input[name="password"]', pass);
  await page.click('button:has-text("Log In")');

  await page.waitForLoadState("networkidle");
}

async function processAgency({
  el,
  env = {},
  _context,
}: {
  el: Locator;
  env: Record<string, any>;
  _context: BrowserContext;
}) {
  const registered = el.locator(':has-text("Registered")').first();
  const locationEl = await el.locator(
    ".MuiTypography-subtitle2 + .MuiTypography-body3"
  );
  const name = await el.locator(".MuiTypography-subtitle2").innerText();
  const key = name
    .toLowerCase()
    .normalize("NFD") // split letters and accents
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/[-]+/g, "-");
  let agency: Record<string, any> = {};

  if (resume && key != lastAgencyKey) {
    console.log(`Skipping agency ${key} to resume previous session`);
    return null;
  } else {
    // continue normally when we find the last agency key
    resume = false;
  }

  const checkIssuer = await issuerModel.get({
    queryOptions: { filters: { key }, limit: 1 },
  });
  const checkSubsite = await siteModel.submodels?.subsites.get({
    queryOptions: { filters: { key }, limit: 1 },
  });

  if (checkIssuer && checkIssuer.records.length > 0)
    agency = checkIssuer.records[0];

  if (!agency.url) {
    const newPagePromise = _context?.waitForEvent("page");
    await el.click();
    const newPage = await newPagePromise;
    let url = "";

    if (newPage) {
      await newPage
        .waitForFunction(() =>
          location.href.match(
            /^https:\/\/([a-z0-9-]+)?\.bonfirehub\.c(om|a)\/(portal|registration)/
          )
        )
        .catch((err: unknown) => {
          logger.warn("Not able to load agency page", err);
        });
      url = (await newPage.url()) || "";
      url = url.replace("registration", "portal");
      await newPage.close().catch(() => {});

      agency = {
        name,
        key,
        location: (await locationEl.isVisible())
          ? await locationEl.innerText()
          : "",
        isRegistered: (await registered.isVisible()) ? true : false,
        url,
      };

      if (!checkIssuer || checkIssuer.records.length === 0) {
        await issuerModel
          .post({ data: { ...agency, bidsUrl: url, url: "" } })
          .catch((err: unknown) => {
            logger.error("Error creating issuer", err);
          })
          .finally(() => {
            console.log("Issuer created", agency.key);
          });
      } else {
        console.log("Issuer already exists", agency.key);
      }

      if (!checkSubsite || checkSubsite.records.length === 0) {
        await siteModel.submodels?.subsites
          .post({ data: agency })
          .catch((err: unknown) => {
            logger.error("Error creating subsite", err);
          })
          .finally(() => {
            console.log("Subsite created", agency.key);
          });
      } else {
        console.log("Subsite already exists", agency.key);
      }
    }
  }

  await scrapeSols({ agency, _context, env });

  return agency;
}

async function processSol({
  el,
  url,
  issuer,
  env,
}: {
  el: Locator;
  url: string;
  issuer: Record<string, any>;
  env: Record<string, any>;
}) {
  const title = await el.locator("td:nth-child(3)");

  if (!(await title.isVisible())) {
    return null;
  }

  const refEl = await el.locator("td:nth-child(2)");
  let closingDate = await el.locator("td:nth-last-child(3)").innerText();
  try {
    closingDate = closingDate.split(",")[0].trim();
    closingDate = parse(closingDate, "MMMM do yyyy", new Date()).toISOString();
  } catch (err) {
    console.log("Error parsing closing date:", closingDate, err);
    closingDate = "";
  }

  const solUrl = await el
    .locator("td a:has-text('View Opportunity')")
    .getAttribute("href");

  const sol = {
    title: await title.innerText(),
    closingDate: sanitizeDateString(closingDate),
    issuer: issuer.name,
    issuerKey: issuer.key,
    location: issuer.location || "",
    siteUrl: solUrl ? urlJoin(url, solUrl).replace("/portal/", "/") : "",
    site: "bonafirehub",
    siteId: "bonfirehub-" + (solUrl ? solUrl.split("/").pop() : ""),
    siteData: {
      refNo: (await refEl.isVisible()) ? await refEl.innerText() : "",
    },
    subsiteKey: issuer.key,
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
  sols.push(newRecord.id);
  logger.log(`Saved sol: ${newRecord.id}`);

  return newRecord;
}

async function scrapeAgencies({
  page,
  env,
  _context,
}: {
  page: Page;
  env: Record<string, any>;
  _context: BrowserContext;
}) {
  const agencies = [];
  let lastPage = false;

  // Scan for a previous unfinished session
  const checkLogsResp = await scriptLogModel
    .get({
      filters: { scriptName: "firefunctions/bonfirehub" },
      sort: "created desc",
      limit: 1,
      baseUrl: env.BASE_URL,
      token: env.SERVICE_KEY,
    })
    .catch((err: unknown) => {
      logger.error("Failed to check logs", err);
      failCount++;
    });
  const lastLog = checkLogsResp?.results?.[0] || null;
  resume = lastLog ? lastLog.data.currPage < lastLog.data.totalPages : false;

  await page.goto("https://vendor.bonfirehub.com/agencies/search", {
    waitUntil: "domcontentloaded",
  });

  // Choose page size to 80
  await page.waitForSelector('[data-cy="pagination_show_per_page_dropdown"]');
  const pageSize = page.locator(
    '[data-cy="pagination_show_per_page_dropdown"]'
  );
  await pageSize.click();
  const pageSizeOption = page.locator(
    '[data-cy="pagination_show_per_page_80"]'
  );
  await pageSizeOption.click();

  // Get total pages
  const pageNav = page.locator(
    'nav[aria-label="Pagination Navigation"] ul li:nth-last-child(3) button[aria-label*="Go to page"]'
  );
  totalPages = parseInt((await pageNav.innerText()) || "0");

  // Resume from last session if applicable
  if (resume) {
    do {
      const nextPage = page.locator(`button[data-testid="next"]`).first();
      await nextPage.click();
      currPage++;
    } while (currPage < lastLog.data.currPage);
    lastAgencyKey = lastLog.data.lastAgencyKey;
    logger.info(
      `Resuming from previous unfinished session at page ${currPage}`
    );
  }

  do {
    logger.log(`${env.VENDOR} - page:${currPage}`);

    await page.waitForSelector('[data-testid="agency-card"]');
    const agencyEls = page.locator('[data-testid="agency-card"]');
    const agencyElsCount = await agencyEls.count();

    for (let i = 0; i < agencyElsCount; i++) {
      const agencyEl = agencyEls.nth(i);
      const agency = await processAgency({
        el: agencyEl,
        env,
        _context,
      }).catch((err) => logger.error("processAgency failed", err));
      if (agency) {
        agencies.push(agency);
        lastAgencyKey = agency.key;
      }
    }

    /*
    if (expiredCount >= 10) {
      lastPage = true;
      logger.info(`${env.VENDOR} - ended because too many expired dates`);
      continue;
    }

    if (dupCount >= 10) {
      lastPage = true;
      logger.info(`${env.VENDOR} - ended because too many duplicates`);
      continue;
    }
    */

    const nextPage = page.locator(`button[data-testid="next"]`).first();
    const nextPageCount = await nextPage.count();

    if (nextPageCount === 0) {
      lastPage = true;
    } else {
      await nextPage.click();
      await page.waitForTimeout(2000);
    }

    currPage++;
  } while (!lastPage);

  return agencies;
}

async function scrapeSols({
  agency,
  _context,
  env,
}: {
  agency: Record<string, any>;
  _context: BrowserContext;
  env: Record<string, any>;
}) {
  const newPage = await _context.newPage();
  const { url } = agency;

  await newPage.goto(url, { waitUntil: "domcontentloaded" });

  const rowsSelector =
    '#openOpportunitiesTabPane [id*="DataTables_Table_"] tbody tr';
  try {
    await newPage.waitForSelector(rowsSelector, { timeout: 10000 });

    const solRows = newPage.locator(rowsSelector);
    const solCount = await solRows.count();

    console.log(agency.key + " - Found " + solCount + " open opportunities.");

    for (let i = 0; i < solCount; i++) {
      const solEl = solRows.nth(i);
      await processSol({ el: solEl, url, issuer: agency, env });
    }
  } catch (err: unknown) {
    logger.warn(
      "Open opportunities table not found or took too long to load. Skipping.",
      err
    );
  } finally {
    await newPage.close().catch(() => {});
  }
}

export async function run(
  page: Page,
  env: Record<string, any> = {},
  _context: BrowserContext
) {
  const BASE_URL = env.BASE_URL!;
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  const USER = env.DEV_BONFIRE_USER!;
  const PASS = env.DEV_BONFIRE_PASS!;
  const VENDOR = "bonfirehub";
  let results = {};

  issuerModel.set({
    token: SERVICE_KEY,
    apiBaseUrl: env.BASE_URL + "/api/",
  });

  siteModel.set({
    token: SERVICE_KEY,
    apiBaseUrl: env.BASE_URL + "/api/",
  });

  if (!USER) throw new Error("Missing USER environment variable for run");
  if (!PASS) throw new Error("Missing PASS environment variable for run");

  // Grab site record
  const siteResp = await siteModel.get({
    queryOptions: { filters: { key: "bonfirehub" }, limit: 1 },
  });
  const site = siteResp.records?.[0];

  if (siteModel.submodels?.subsites) {
    siteModel.submodels.subsites.set({
      token: SERVICE_KEY,
      apiBaseUrl: env.BASE_URL + "/api/",
      path: `sites/${site?.id}/subsites`,
    });
  } else {
    throw new Error("Missing subsites submodel from site model");
  }

  await login(page, USER, PASS);

  let agencies =
    (await scrapeAgencies({
      page,
      env: {
        ...env,
        BASE_URL,
        VENDOR,
        SERVICE_KEY,
      },
      _context,
    })) || [];
  console.log({ agencies });
  agencies = agencies.map((a) => a.id);

  logger.log(
    `${VENDOR} - Finished saving agencies and sols. Success: ${successCount}. Fail: ${failCount}. Duplicates: ${dupCount}. Junk: ${
      expiredCount + nonItCount
    }.`
  );

  results = {
    agencies,
    sols,
    counts: {
      success: successCount,
      fail: failCount,
      dup: dupCount,
      junk: expiredCount + nonItCount,
    },
    data: {
      lastAgencyKey,
      currPage,
      totalPages,
    },
  };

  return results;
}
