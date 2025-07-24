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
import { executeTask, getLatestFolder } from "@/scripts/utils";
import { title } from "process";
import { stringifyResumeDataCache } from "next/dist/server/resume-data-cache/resume-data-cache";

const DEBUG = true;
const HIDE_STEPS = false;
const USER = process.env.VENDORREGISTRY_USER;
const PASS = process.env.VENDORREGISTRY_PASS;

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
  solDetails: ({ rawSolId, title }: Record<string, any>) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract all solicitations from vendorregistry.com.
    1. Go to https://vrapp.vendorregistry.com/Bids/View/Bid/${rawSolId}?isBuyerAction=False
    2. Reload the page and wait for title to be set to "${title}"
    3. Wait for page to load then extract solicitation from page with the field mappings:
      - description: extract the entire visible text content (including all child elements) from the element with selector 'div.bid-info' and store it in description
      - externalLink: if there is text after Additional Information:, extract the link
      - documents: extract all links from the Documents section with name and url`,
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

function sanitizeSolForDb(rawSolData: Record<string, any>) {}

let totalSolicitations = 0;
const start = new Date();
performance.mark("start");

async function run() {
  console.log(`\nExtracting from vendorregistry.com ${start.toLocaleString()}`);

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
      downloadsPath: ".output/vendorregistry/tmp/downloads",
    },
  });

  let cacheFolder = getLatestFolder(".output/vendorregistry");
  if (cacheFolder) console.log(`Previous session found: ${cacheFolder}`);
  else cacheFolder = start.toISOString();

  let categorySummary = await executeTask({
    agent,
    name: "categorySummary",
    folder: `.output/vendorregistry/${cacheFolder}`,
    task: tasks.categorySummary(),
    outputSchema: schemas.categorySummary,
    hideSteps: HIDE_STEPS,
  });
  categorySummary = JSON.parse(categorySummary);

  for (let i = 0; i < categorySummary.solicitations.length; i++) {
    const rawSol = categorySummary.solicitations[i];
    console.log(
      `    [${i + 1}/${categorySummary.solicitations.length}] ${rawSol.id} - ${
        rawSol.title
      }`
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
      folder: `.output/vendorregistry/${cacheFolder}`,
      data: { rawSolId: rawSol.id },
      outputSchema: schemas.solDetails,
      task: tasks.solDetails({ rawSolId: rawSol.id, title: rawSol.title }),
      hideSteps: HIDE_STEPS,
    });
    solDetails = JSON.parse(solDetails);
    console.log({ solDetails });
  }
}

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
