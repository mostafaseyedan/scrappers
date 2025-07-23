import "dotenv/config";
import HyperAgent from "@hyperbrowser/agent";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import { z } from "zod";
import fs from "fs";
import { exec, execSync } from "child_process";
import { initDb, initStorage } from "@/lib/firebaseAdmin";
import { solicitation as solModel } from "@/app/models";
import { cnStatuses } from "@/app/config";

const DEBUG = true;
const HIDE_STEPS = true;
const USER = process.env.PUBLICPURCHASE_USER;
const PASS = process.env.PUBLICPURCHASE_PASS;

const tasks = {
  categorySummary: ({ categoryId }: Record<string, any>) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract all solicitations from publicpurchase.com.
    1. Go to https://publicpurchase.com/gems/browse/marketBids?reg=y&agt=y&cl=y&parentId=${categoryId}&stype=0
    2. Extract from solicitation from table on this page and append to memory with the field mappings:
      - id: Id column
      - title: Bid column
      - Issuer: Agency column
      - Location: State column
      - closingDate: Estimated End Date column
      - url: get link from last column
    3. Scroll to bottom to hit next page and repeat Step 2 until the last page.
    4. Get the total number of pages from the bottom of the page
    5. Get from memory and store to the json under the key 'solicitations' and also set 'totalSolicitations' to the total number of solicitations found.`,
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
  notes: z.string().optional(),
  categories: z.array(z.string()).default([]),
  url: z.string(),
});

const schemas = {
  categorySummary: z.object({
    categoryId: z.string(),
    totalSolicitations: z.number().default(0),
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
    closingDate: z.date().nullable(),
    cnData: z.object({}).default({}),
    cnLiked: z.boolean().default(false),
    cnModified: z.boolean().default(false),
    cnStatus: z.enum(Object.keys(cnStatuses)).default("new"),
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

type ExecuteTaskParams = {
  agent: any;
  name: keyof typeof tasks;
  folder: string;
  data?: Record<string, any>;
  outputSchema?: z.ZodTypeAny;
};

function cleanUpCategorySummary(
  categorySummary: z.infer<typeof schemas.categorySummary>
) {
  const categoryId =
    categorySummary.categoryId as keyof typeof interestedCategories;
  let cleanedUpSols = [];

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
        }
      }
    }
  }

  return cleanedUpSols;
}

function getLatestFolder() {
  const dir = ".output/purchasehistory";
  fs.mkdirSync(dir, { recursive: true });
  const folders = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.match(/^\d{4}-\d{2}-\d{2}/) &&
        fs.statSync(`${dir}/${f}`).isDirectory()
    );
  if (folders.length === 0) return "";
  return folders[folders.length - 1];
}

async function executeTask({
  agent,
  name,
  folder,
  data = {},
  outputSchema,
}: ExecuteTaskParams) {
  const task = tasks[name](data);
  let result;
  const outputFile = `.output/purchasehistory/${folder}/${name}/${JSON.stringify(
    data
  )
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase()}.json`;

  result = fs.existsSync(outputFile) && fs.readFileSync(outputFile, "utf8");
  if (result) return result;

  result = await agent.executeTask(task, {
    onStep: (step: any) => {
      performance.mark(`${name}-step-${step.idx + 1}`);
      const duration =
        step.idx === 0
          ? performance.measure(
              `${name}-step-${step.idx + 1}-duration`,
              "start",
              `${name}-step-${step.idx + 1}`
            )
          : performance.measure(
              `${name}-step-${step.idx + 1}-duration`,
              `${name}-step-${step.idx}`,
              `${name}-step-${step.idx + 1}`
            );

      if (HIDE_STEPS) return;

      console.log(
        chalk.gray(`      ${(duration.duration / 1000).toFixed(1)}s`)
      );
      console.log(
        `    ${step.idx + 1}. ${step.agentOutput.actions[0].actionDescription}`
      );
    },
    debugDir: `.output/purchasehistory/${folder}/debug/${name}`,
    ...(outputSchema ? { outputSchema } : {}),
  });

  if (!result.output) {
    throw new Error("Unable to get JSON output from agent");
  }

  console.log(outputFile, outputFile.substr(0, outputFile.lastIndexOf("/")));
  fs.mkdirSync(outputFile.substr(0, outputFile.lastIndexOf("/")), {
    recursive: true,
  });
  fs.writeFileSync(outputFile, result.output);

  return result.output;
}

function sanitizeSolForDb(rawSolData: Record<string, any>) {
  const externalLinks = [];

  if (rawSolData.externalLink?.match(/^http/))
    externalLinks.push(rawSolData.externalLink);
  if (rawSolData.vendorLink?.match(/^http/))
    externalLinks.push(rawSolData.vendorLink);

  const newData = {
    categories: rawSolData.categories || [],
    closingDate: rawSolData.closingDate?.match(/^\d{4}-\d{2}-\d{2}/)
      ? new Date(rawSolData.closingDate)
      : null,
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
  console.log(`\nExtracting from bidnetdirect.com ${start.toLocaleString()}`);

  const db = initDb();
  const storage = initStorage();
  const bucket = storage.bucket();
  const solCollection = db.collection("solicitations");

  let out, cmd;

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4.1-mini",
    temperature: 0,
    cache: true,
  });

  const agent = new HyperAgent({
    llm,
    debug: DEBUG,
    browserProvider: "Local",
    localConfig: {
      downloadsPath: ".output/purchasehistory/tmp/downloads",
    },
  });

  let cacheFolder = getLatestFolder();
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
      folder: cacheFolder,
      data: { categoryId },
      outputSchema: schemas.categorySummary,
    });
    categorySummary = JSON.parse(categorySummary);
    categorySummary.categoryId = categoryId;

    // Loop through each solicitation in the category
    const cleanedUpSols = cleanUpCategorySummary(categorySummary);
    console.log(
      `    Filtered ${cleanedUpSols.length} out of ${categorySummary.totalSolicitations} solicitations`
    );
    for (let i = 0; i < cleanedUpSols.length; i++) {
      const rawSol = cleanedUpSols[i];
      console.log(
        `    [${i + 1}/${cleanedUpSols.length}] ${rawSol.id} - ${rawSol.title}`
      );

      // Check Firestore for existing solicitation
      const existingSol = await solCollection
        .where("siteId", "==", rawSol.id)
        .get();
      if (!existingSol.empty) {
        console.log(`      Already exists in Firestore. Skipping.`);
        continue;
      }

      // Go into each solicitation details page and grab more details
      let solDetails = await executeTask({
        agent,
        name: "solDetails",
        folder: cacheFolder,
        data: { rawSolId: rawSol.id },
        outputSchema: schemas.solDetails,
      });
      solDetails = JSON.parse(solDetails);

      // Sanitize rawSol and save to Firestore
      const dbSolData = sanitizeSolForDb({ ...rawSol, ...solDetails });
      const newDoc = await solCollection.add(dbSolData);
      console.log(`      Saved to Firestore ${newDoc.id}`);

      // Save to Elasticsearch

      totalSolicitations++;
    }
  }
}

let totalSolicitations = 0;
const start = new Date();
performance.mark("start");

run()
  .catch((error: any) => console.error(chalk.red(`  ${error}`, error?.stack)))
  .finally(() => {
    performance.mark("end");
    const totalSec = (
      performance.measure("total-duration", "start", "end").duration / 1000
    ).toFixed(1);
    console.log(`\nTotal solicitations processed: ${totalSolicitations}`);
    console.log(`Total time: ${totalSec}s ${new Date().toLocaleString()}`);
    process.exit(0);
  });
