import "dotenv/config";
import chalk from "chalk";
import { z } from "zod";
import { initDb, initStorage } from "@/lib/firebaseAdmin";
import { solicitation as solModel, scriptLog as logModel } from "@/app/models";
import {
  executeTask,
  getLatestFolder,
  initHyperAgent,
  isItRelated,
  withTimeout,
} from "@/scripts/utils";
import { sanitizeDateString, secToTimeStr } from "@/lib/utils";

const BASE_URL = "http://localhost:3000";
const DEBUG = true;
const HIDE_STEPS = true;
const USER = process.env.INSTANTMARKETS_USER;
const PASS = process.env.INSTANTMARKETS_PASS;

const tasks = {
  categoryTotal: () =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract the total number of solicitations in the category 'Information Technology' and return it as a JSON object with the key 'total'.
    1. Go to https://www.instantmarkets.com/
    2. Log in with the credentials provided.
    3. Go to https://www.instantmarkets.com/q/Information_Technology?ot=Bid%20Notification,Pre-Bid%20Notification&pg=1 and get the total number of results.`,
  categoryPage: (params: { page: number }) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract solicitations from this page.
    1. Go to https://www.instantmarkets.com/
    2. Log in with the credentials provided.
    3. Go to https://www.instantmarkets.com/q/Information_Technology?ot=Bid%20Notification,Pre-Bid%20Notification&pg=${params.page}.
    4. Wait for page to load. Hit 'Skip' to close the tutorial. Close any popups that may appear.
    5. Then extract solicitations from page and append to memory list with the following fields:
      - id: get from the href of link title like https://www.instantmarkets.com/view/ID230323767421003878904161400601415524770/Enterprise_resource_Planning_ERP and ID230323767421003878904161400601415524770 is the id
      - title
      - issuer: get from underlined text after Agency:
      - location: is in parenthesis after Agency: and underlined text like (Florida, United States)
      - desciription: is the text below Agency:
      - closingDate: is after Due Date and in format like Aug 18, 2025
    6. Once you reach the bottom of page, stop and return the list of solicitations as a JSON object with the key 'solicitations'.`,
  solDetailsPage: (params: { url: string }) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window.
    1. Go to https://www.instantmarkets.com/signin and log in with the credentials provided.
    2. Go to ${params.url}.
    3. Wait for page to load, click 'More Details'
    4. Then extract solicitations from page and save the following fields:
      - title: is the text in the header
      - externalLink: [href] from "Go To Official Site" button
      - startDate: Below Start Date in the format of Jul 18, 2025
      - oppId: Below Opportunity Identifier`,
};

const rawSolSchema = z.object({
  id: z.string(),
  title: z.string(),
  issuer: z.string(),
  location: z.string(),
  closingDate: z.string(),
  description: z.string(),
  url: z.string(),
});

const schemas = {
  rawSol: rawSolSchema,
  categoryTotal: z.object({
    total: z.number().default(0),
  }),
  categoryPage: z.object({
    solicitations: z.array(rawSolSchema),
  }),
  solDetailsPage: z.object({
    title: z.string(),
    externalLink: z.string(),
    startDate: z.string(),
    oppId: z.string(),
  }),
};

function sanitizeSolForApi(rawSolData: Record<string, any>) {
  const externalLinks = [];

  if (rawSolData.externalLink?.match(/^http/))
    externalLinks.push(rawSolData.externalLink);

  const newData = {
    closingDate: sanitizeDateString(rawSolData.closingDate),
    publishDate: sanitizeDateString(rawSolData.publishDate),
    cnStatus: "new",
    description: rawSolData.description || "",
    externalLinks,
    issuer: rawSolData.issuer || "",
    location: rawSolData.location || "",
    site: "instantmarkets",
    siteData: { ...rawSolData },
    siteId: rawSolData.id,
    siteUrl: rawSolData.url || "",
    title: rawSolData.title || "",
    url: rawSolData.url || "",
  };

  return newData;
}

async function end() {
  performance.mark("end");
  const totalSec = (
    performance.measure("total-duration", "start", "end").duration / 1000
  ).toFixed(1);
  console.log(`\nTotal solicitations processed: ${successCount}`);
  console.log(`Total time: ${totalSec}s ${new Date().toLocaleString()}`);

  await logModel.post(
    BASE_URL,
    {
      message: `Scrapped ${successCount} solicitations from instantmarkets.com. 
        ${failCount > 0 ? `Found ${failCount} failures. ` : ""}
        ${dupCount > 0 ? `Found ${dupCount} duplicates. ` : ""}`,
      scriptName: "scrapers/instantmarkets",
      successCount,
      failCount,
      junkCount,
      timeStr: secToTimeStr(Number(totalSec)),
    },
    process.env.SERVICE_KEY
  );

  process.exit(0);
}

async function run() {
  console.log(`\nExtracting from instantmarkets.com ${start.toLocaleString()}`);

  const db = initDb();
  const storage = initStorage();
  const bucket = storage.bucket();
  const solCollection = db.collection("solicitations");

  let out, cmd;

  const agent = initHyperAgent({ debug: DEBUG, vendor: "instantmarkets" });

  let cacheFolder = getLatestFolder(".output/instantmarkets");
  if (cacheFolder) console.log(`Previous session found: ${cacheFolder}`);
  else cacheFolder = start.toISOString();

  let categoryTotal = await withTimeout(
    executeTask({
      agent,
      name: "categoryTotal",
      folder: `.output/instantmarkets/${cacheFolder}`,
      task: tasks.categoryTotal(),
      outputSchema: schemas.categoryTotal,
      hideSteps: HIDE_STEPS,
    }),
    5 * 60000
  );
  categoryTotal = JSON.parse(categoryTotal);
  const total = categoryTotal.total;
  const totalPages = Math.ceil(total / 10);

  console.log(`  ${total} solcitations. ${totalPages} pages.`);

  // Loop through each page of the category
  for (let page = totalPages; page > 0; page--) {
    console.log(`  Page[${page}/${totalPages}]`);
    let categoryPage = await executeTask({
      agent,
      name: `categoryPage/${page}`,
      folder: `.output/instantmarkets/${cacheFolder}`,
      task: tasks.categoryPage({ page }),
      outputSchema: schemas.categoryPage,
      hideSteps: HIDE_STEPS,
    });
    if (!categoryPage) {
      console.warn(`Failed to fetch category page ${page}`);
      continue;
    }
    categoryPage = JSON.parse(categoryPage);
    dupCount = 0;

    // Loop through each solicitation on the page
    const solsLen = categoryPage.solicitations.length;
    for (let solIndex = 0; solIndex < solsLen; solIndex++) {
      const rawSol = categoryPage.solicitations[solIndex];
      console.log(
        `    p[${page}/${totalPages}] [${solIndex + 1}/${solsLen}] ${
          rawSol.id
        } ${rawSol.title}`
      );

      const isIt = await isItRelated(rawSol);
      if (!isIt) {
        junkCount++;
        console.log(chalk.yellow(`      Not IT-related. Skipping.`));
        continue;
      }

      const sanitizedDateStr = sanitizeDateString(rawSol.closingDate);
      const closingDate =
        rawSol.closingDate && sanitizedDateStr
          ? new Date(sanitizedDateStr)
          : null;
      if (
        closingDate &&
        closingDate.getTime() < new Date().getTime() + 60 * 60 * 24 * 7
      ) {
        junkCount++;
        console.log(
          chalk.yellow(`      Closing date expired. ${closingDate}. Skipping.`)
        );
        continue;
      }

      let rawSolDetails = await executeTask({
        agent,
        name: `solDetails/${rawSol.id}`,
        folder: `.output/instantmarkets/${cacheFolder}`,
        task: tasks.solDetailsPage({ url: rawSol.url }),
        outputSchema: schemas.solDetailsPage,
        hideSteps: HIDE_STEPS,
      });
      rawSolDetails = JSON.parse(rawSolDetails);

      // Check Firestore for existing solicitation
      const existingSol = await solCollection
        .where("siteId", "==", rawSol.id)
        .get();

      // Save to Firestore
      let fireDoc;
      if (!existingSol.empty) {
        fireDoc = existingSol.docs[0];
        console.log(`      Already exists in Firestore ${fireDoc.id}.`);
        dupCount++;
      } else {
        const dbSolData = sanitizeSolForApi({
          ...rawSol,
          ...(rawSol.title === rawSolDetails.title ? rawSolDetails : {}),
        });
        const newRecord = await solModel.post(
          BASE_URL,
          dbSolData,
          process.env.SERVICE_KEY
        );
        console.log(chalk.green(`      Saved. ${newRecord.id}`));
        successCount++;
      }

      if (dupCount >= 3) {
        console.warn(`Skipping page ${page} due to too many duplicates found.`);
        dupCount = 0;
        continue;
      }
    }
  }
}

let dupCount = 0;
let failCount = 0;
let successCount = 0;
let junkCount = 0;
const start = new Date();
performance.mark("start");

run()
  .catch((error: any) => console.error(chalk.red(`  ${error?.stack || error}`)))
  .finally(async () => {
    await end();
  });

process.on("SIGINT", async () => {
  await end();
});
