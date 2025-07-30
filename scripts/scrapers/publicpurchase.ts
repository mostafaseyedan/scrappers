import "dotenv/config";
import chalk from "chalk";
import { z } from "zod";
import { initDb, initStorage } from "@/lib/firebaseAdmin";
import { solicitation as solModel, scriptLog as logModel } from "@/app/models";
import { cnStatuses } from "@/app/config";
import {
  endScript,
  executeTask,
  getLatestFolder,
  initHyperAgent,
} from "@/scripts/utils";
import { sanitizeDateString } from "@/lib/utils";

const BASE_URL = "http://localhost:3000";
const DEBUG = true;
const HIDE_STEPS = true;
const USER = process.env.PUBLICPURCHASE_USER;
const PASS = process.env.PUBLICPURCHASE_PASS;

const tasks = {
  categorySummary: ({ categoryId }: Record<string, any>) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract all solicitations from publicpurchase.com.
    1. Go to https://publicpurchase.com/gems/browse/marketBids?reg=y&agt=y&cl=y&parentId=${categoryId}&stype=0
    2. Extract solicitations from table on this page and append to memory with the field mappings:
      - id: Id column
      - title: Bid column
      - Issuer: Agency column
      - Location: State column
      - closingDate: Estimated End Date column
      - url: get link from last column
    3. Scroll to bottom to hit next page and repeat Step 2 until the last page.
    4. Get the total number of pages from the bottom of the page
    5. Get from memory and store to the json under the key 'solicitations' and also set 'successCount' to the total number of solicitations found.`,
  solDetails: ({ rawSolId }: Record<string, any>) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract all solicitations from publicpurchase.com.
    1. Go to https://publicpurchase.com/gems/syndication/bidView?syndicatedBidId=${rawSolId}
    2. Extract from solicitation from table on this page and append to memory with the field mappings:
      - contactInfo: Contact Information section which can possibly be missing
      - description: Description section which can possibly be missing
      - externalLink: Relevant Bid Links section which can possibly be missing,
      - vendorLink: [href] attribute from link in the left side bar`,
};

const rawCategorySolSchema = z.object({
  id: z.string(),
  title: z.string(),
  issuer: z.string(),
  location: z.string(),
  closingDate: z.string().nullable(),
  notes: z.string(),
  categories: z.array(z.string()).default([]),
  url: z.string(),
});

const schemas = {
  categorySummary: z.object({
    categoryId: z.string(),
    successCount: z.number().default(0),
    totalPages: z.number(),
    solicitations: z.array(rawCategorySolSchema).default([]),
  }),
  rawCategorySol: rawCategorySolSchema,
  solDetails: z.object({
    contactInfo: z.string(),
    description: z.string(),
    externalLink: z.string(),
    vendorLink: z.string(),
  }),
  dbSol: z.object({
    categories: z.array(z.string()).default([]),
    closingDate: z.date().nullable().optional(),
    cnData: z.object({}).default({}),
    cnLiked: z.boolean().default(false),
    cnModified: z.boolean().default(false),
    cnStatus: z
      .enum(Object.keys(cnStatuses) as [string, ...string[]])
      .default("new"),
    comments: z.array(z.object({})).default([]).describe("[submodel]"),
    commentsCount: z.number().default(0),
    contactEmail: z.string().optional(),
    contactName: z.string().optional(),
    contactNote: z.string().optional(),
    contactPhone: z.string().optional(),
    created: z.date(),
    description: z.string(),
    documents: z.array(z.string().url()).default([]),
    externalLinks: z.array(z.string()).default([]),
    issuer: z.string(),
    keywords: z.array(z.string()).default([]),
    location: z.string(),
    logs: z.array(z.any()).default([]).describe("[submodel]"),
    publicationDate: z.date().optional(),
    questionsDueByDate: z.date().optional(),
    rfpType: z.string().optional(),
    site: z.string(),
    siteData: z.any().default({}),
    siteId: z.string(),
    siteUrl: z.string().optional(),
    title: z.string(),
    updated: z.date(),
    url: z.string().optional(),
  }),
};

// https://publicpurchase.com/gems/browse/marketBids?reg=y&agt=y&cl=y&parentId=${categoryId}&stype=0
const interestedCategories = {
  "33546": "Information > Data processing, hosting, and related services",
  "33550": "Information > Other information services",
  "33483": "Information > Publishing industries (except internet)",
  "33532": "Information > Telecommunications",
  "33705": "Professional, scientific, and technical services",
};

function cleanUpCategorySummary(
  categorySummary: z.infer<typeof schemas.categorySummary>
) {
  const categoryId =
    categorySummary.categoryId as keyof typeof interestedCategories;
  let cleanedUpSols = [];
  let countExpired = 0;

  for (const sol of categorySummary.solicitations) {
    const closingDate = sol.closingDate?.toString() || "";

    sol.categories = [`${categoryId} - ${interestedCategories[categoryId]}`];

    if (!closingDate.match(/closed/i)) {
      if (closingDate == "Upon Contract") {
        sol.closingDate = null;
        sol.notes = "Estimated End Date is Upon Contract";
        cleanedUpSols.push(sol);
      } else if (closingDate.match(/^[a-z]+ \d{2}, \d{4}/i)) {
        sol.closingDate = new Date(closingDate).toISOString();
        const secDiff =
          (new Date(sol.closingDate).getTime() - new Date().getTime()) / 1000;
        // If the closing date is more than 3 days in the future, we keep it
        if (secDiff > 60 * 60 * 24 * 3) {
          cleanedUpSols.push(sol);
        } else {
          countExpired++;
        }
      } else {
        if (sol.closingDate) {
          const testDate = new Date(sol.closingDate);
          if (!isNaN(testDate.getTime())) {
            sol.closingDate = testDate.toISOString();
            cleanedUpSols.push(sol);
          } else {
            console.log("ignored", sol.title);
          }
        } else {
          sol.closingDate = "";
          cleanedUpSols.push(sol);
        }
      }
    } else {
      countExpired++;
    }
  }

  if (countExpired > 0) {
    console.log(`${countExpired} expired.`);
  }

  return cleanedUpSols;
}

function sanitizeSolForDb(rawSolData: Record<string, any>) {
  const externalLinks = [];

  if (rawSolData.externalLink?.match(/^http/))
    externalLinks.push(rawSolData.externalLink);
  if (rawSolData.vendorLink?.match(/^http/))
    externalLinks.push(rawSolData.vendorLink);

  const newData = {
    categories: rawSolData.categories || [],
    closingDate: sanitizeDateString(rawSolData.closingDate),
    cnStatus: "new",
    created: new Date(),
    description: rawSolData.description,
    externalLinks,
    issuer: rawSolData.issuer,
    location: rawSolData.location,
    site: "publicpurchase",
    siteId: rawSolData.id,
    siteUrl: `https://publicpurchase.com/gems/syndication/bidView?syndicatedBidId=${rawSolData.id}`,
    title: rawSolData.title,
    updated: new Date(),
    url: `https://publicpurchase.com/gems/syndication/bidView?syndicatedBidId=${rawSolData.id}`,
  };

  return schemas.dbSol.parse(newData);
}

async function run() {
  console.log(`\nExtracting from publicpurchase.com ${start.toLocaleString()}`);

  const db = initDb();
  const storage = initStorage();
  const bucket = storage.bucket();
  const solCollection = db.collection("solicitations");

  let out, cmd;

  const agent = initHyperAgent({ debug: DEBUG, vendor: "publicpurchase" });

  let cacheFolder = getLatestFolder(".output/publicpurchase");
  if (cacheFolder) console.log(`Previous session found: ${cacheFolder}`);
  else cacheFolder = start.toISOString();

  // Loop through each category
  for (const categoryId of Object.keys(interestedCategories) as Array<
    keyof typeof interestedCategories
  >) {
    const categoryName = interestedCategories[categoryId];
    console.log(`\n  Processing category ${categoryId} ${categoryName}`);
    let categorySummary = await executeTask({
      agent,
      name: "categorySummary",
      task: tasks.categorySummary({ categoryId }),
      folder: `.output/publicpurchase/${cacheFolder}`,
      data: { categoryId },
      outputSchema: schemas.categorySummary,
      hideSteps: HIDE_STEPS,
    });
    categorySummary = JSON.parse(categorySummary);
    categorySummary.categoryId = categoryId;
    dupCount = 0;

    // Loop through each solicitation in the category
    const cleanedUpSols = cleanUpCategorySummary(categorySummary);
    console.log(
      `    Filtered ${cleanedUpSols.length} out of ${categorySummary.totalSolicitations} solicitations`
    );
    for (let i = 0; i < cleanedUpSols.length; i++) {
      const rawSol = cleanedUpSols[i];
      console.log(
        `\n    [${i + 1}/${cleanedUpSols.length}] ${rawSol.id} - ${
          rawSol.title
        }`
      );

      // Check Firestore for existing solicitation
      const existingSol = await solCollection
        .where("siteId", "==", rawSol.id)
        .get();
      if (!existingSol.empty) {
        console.log(`      Already exists in Firestore. Skipping.`);
        dupCount++;
        continue;
      }

      if (dupCount >= 10) {
        throw new Error("Stopping script due to too many duplicates found.");
      }

      // Go into each solicitation details page and grab more details
      let solDetails = await executeTask({
        agent,
        name: "solDetails",
        folder: `.output/publicpurchase/${cacheFolder}`,
        data: { rawSolId: rawSol.id },
        outputSchema: schemas.solDetails,
        task: tasks.solDetails({ rawSolId: rawSol.id }),
        hideSteps: HIDE_STEPS,
      });
      solDetails = JSON.parse(solDetails);

      // Save to Firestore
      let fireDoc;
      if (!existingSol.empty) {
        fireDoc = existingSol.docs[0];
        console.log(`      Already exists in Firestore ${fireDoc.id}.`);
        dupCount++;
      } else {
        const dbSolData = sanitizeSolForDb({ ...rawSol, ...solDetails });
        const newRecord = await solModel.post(
          BASE_URL,
          dbSolData,
          process.env.SERVICE_KEY
        );
        console.log(chalk.green(`      Saved. ${newRecord.id}`));
        successCount++;
      }
    }
  }

  await agent.closeAgent();
}

let dupCount = 0;
let successCount = 0;
let failCount = 0;
let junkCount = 0;
const start = new Date();
performance.mark("start");

run()
  .catch((error: any) => console.error(chalk.red(`  ${error?.stack || error}`)))
  .finally(async () => {
    await endScript({
      baseUrl: BASE_URL,
      vendor: "publicpurchase",
      counts: {
        success: successCount,
        fail: failCount,
        junk: junkCount,
      },
    });
  });

process.on("SIGINT", async () => {
  await endScript({
    baseUrl: BASE_URL,
    vendor: "publicpurchase",
    counts: { success: successCount, fail: failCount, junk: junkCount },
  });
});
