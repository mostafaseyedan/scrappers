import "dotenv/config";
import chalk from "chalk";
import { z } from "zod";
import { initDb, initStorage } from "@/lib/firebaseAdmin";
import { solicitation as solModel } from "@/app/models";
import {
  endScript,
  executeTask,
  getLatestFolder,
  initHyperAgent,
  isItRelated,
} from "@/scripts/utils";
import jsdom from "jsdom";
import { sanitizeDateString } from "@/lib/utils";

const BASE_URL = "http://localhost:3000";
const VENDOR = "vendorregistry";
const DEBUG = true;
const HIDE_STEPS = false;
const USER = process.env.VENDORREGISTRY_USER;
const PASS = process.env.VENDORREGISTRY_PASS;

const { JSDOM } = jsdom;

const tasks = {
  categorySummary: () =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract all solicitations from vendorregistry.com.
    1. Go to https://vrapp.vendorregistry.com/Account/LogOn and login
    2. Hit 'No Thanks' on the popup
    3. Extract solicitations from table on this page and append to memory with the field mappings:
      - id: extract from href of link in 5th column. For example, we want id 306d79b2-7767-48e3-98ad-2b03d362120d from https://vrapp.vendorregistry.com/Bids/View/Bid/306d79b2-7767-48e3-98ad-2b03d362120d?isBuyerAction=False
      - title: 5th column Title
      - issuer: 3rd column Buyer
      - location: 4th column State
      - closingDate: 8th column Deadline
      - publishDate: 9th column Added On
      - url: href of the link in the 5th column
    4. Scroll to bottom and click next page and repeat Step 3 until there are no more pages`,
};

const rawSolSchema = z.object({
  id: z.string(),
  title: z.string(),
  issuer: z.string(),
  location: z.string(),
  closingDate: z.string(),
  publishDate: z.string(),
  url: z.string(),
});

const schemas = {
  rawSol: rawSolSchema,
  categorySummary: z.object({
    solicitations: z.array(rawSolSchema).default([]),
  }),
  solDetails: z.object({
    description: z.string(),
    externalLink: z.string(),
    documents: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
        })
      )
      .default([]),
  }),
};

function sanitizeSolForApi(rawSolData: Record<string, any>) {
  const externalLinks = [];

  if (rawSolData.externalLink?.match(/^http/))
    externalLinks.push(rawSolData.externalLink);
  if (rawSolData.vendorLink?.match(/^http/))
    externalLinks.push(rawSolData.vendorLink);

  const newData = {
    closingDate: sanitizeDateString(rawSolData.closingDate),
    publishDate: sanitizeDateString(rawSolData.publishDate),
    cnStatus: "new",
    description: rawSolData.description || "",
    externalLinks,
    issuer: rawSolData.issuer || "",
    location: rawSolData.location || "",
    site: "vendorregistry",
    siteData: { documents: rawSolData.documents || [] },
    siteId: rawSolData.id,
    siteUrl: `https://vrapp.vendorregistry.com/Bids/View/Bid/${rawSolData.id}?isBuyerAction=False`,
    title: rawSolData.title || "",
    url: rawSolData.url || "",
  };

  return newData;
}

async function run() {
  console.log(`\nExtracting from vendorregistry.com ${start.toLocaleString()}`);

  const db = initDb();
  const storage = initStorage();
  const bucket = storage.bucket();
  const solCollection = db.collection("solicitations");
  const agent = initHyperAgent({ vendor: VENDOR });

  let cacheFolder = getLatestFolder(".output/vendorregistry");
  if (cacheFolder) console.log("Previous session found:", cacheFolder);
  else {
    cacheFolder = start.toISOString();
    console.log("New cache folder created:", cacheFolder);
  }

  let categorySummary = await executeTask({
    agent,
    name: "categorySummary",
    folder: `.output/vendorregistry/${cacheFolder}`,
    task: tasks.categorySummary(),
    outputSchema: schemas.categorySummary,
    hideSteps: HIDE_STEPS,
  });
  categorySummary = JSON.parse(categorySummary);

  const max = categorySummary.solicitations.length;
  for (let i = 0; i < max; i++) {
    const rawSol = categorySummary.solicitations[i];
    console.log(
      `\n[${i + 1}/${categorySummary.solicitations.length}] ${rawSol.id} - ${
        rawSol.title
      }`
    );

    // Check Firestore for existing solicitation
    const existingSol = await solCollection
      .where("siteId", "==", rawSol.id)
      .get();

    // Save to Firestore
    let fireDoc;
    if (!existingSol.empty) {
      fireDoc = existingSol.docs[0];
      console.log(chalk.grey(`  Already exists in Firestore. ${fireDoc.id}`));
      dupCount++;
      continue;
    }

    const isIt = await isItRelated(rawSol);
    if (!isIt) {
      junkCount++;
      console.log(chalk.yellow(`  Not IT-related. Skipping.`));
      continue;
    }

    const respSolDetails = await fetch(
      `https://vrapp.vendorregistry.com/Bids/View/Bid/${rawSol.id}?isBuyerAction=False`
    );
    const html = await respSolDetails.text();
    const { document: solDom } = new JSDOM(html).window;
    let rawSolDetails: Record<string, any> = { documents: [] };
    solDom.querySelectorAll(".bid-info > p").forEach((element) => {
      const text = element.textContent?.replace(/^[\n ]+/g, "");

      if (text?.match(/(Description|Deadline|Solicitation Number):/)) {
        rawSolDetails.description =
          text.replace("Description:", "").trim() + "\n\n";
      } else if (text?.startsWith("Additional Information:")) {
        rawSolDetails.externalLink = text
          .replace("Additional Information:", "")
          .trim();
      }
    });
    solDom.querySelectorAll("#attachments-table a[href]").forEach((element) => {
      const link = element.getAttribute("href");
      const name = element.textContent?.trim();
      if (link && name) {
        rawSolDetails.documents.push({ name, url: link });
      }
    });

    const dbSolData = sanitizeSolForApi({ ...rawSol, ...rawSolDetails });
    const newRecord = await solModel.post(
      BASE_URL,
      dbSolData,
      process.env.SERVICE_KEY
    );
    console.log(chalk.green(`  Saved. ${newRecord.id}`));
    successCount++;
  }
}

let dupCount = 0;
let failCount = 0;
let successCount = 0;
let junkCount = 0;
const start = new Date();
performance.mark("start");

run()
  .catch((error: any) => console.error(chalk.red(`  ${error}`, error?.stack)))
  .finally(async () => {
    await endScript({
      baseUrl: BASE_URL,
      vendor: VENDOR,
      counts: {
        success: successCount,
        fail: failCount,
        junk: junkCount,
        duplicates: dupCount,
      },
    });
  });

process.on("SIGINT", async () => {
  await endScript({
    baseUrl: BASE_URL,
    vendor: VENDOR,
    counts: {
      success: successCount,
      fail: failCount,
      junk: junkCount,
      duplicates: dupCount,
    },
  });
});
