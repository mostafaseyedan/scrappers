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

const DEBUG = true;
const HIDE_STEPS = true;
const USER = process.env.PUBLICPURCHASE_USER;
const PASS = process.env.PUBLICPURCHASE_PASS;

const tasks = {
  categorySummary: () =>
    `Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract all solicitations from instantmarkets.com.
    1. Go to https://www.instantmarkets.com/
    2. Type 'Information Technology' in the search bar and click 'Search'
    3. Wait for page to load. Hit 'Skip' to close the tutorial. There should be about 10 solicitations per page.
    4. Then extract solicitations from page and append to memory list with the following fields:
      - id: get from the href of link title like https://www.instantmarkets.com/view/ID230323767421003878904161400601415524770/Enterprise_resource_Planning_ERP and ID230323767421003878904161400601415524770 is the id
      - title
      - issuer: get from underlined text after Agency:
      - location: is in parenthesis after Agency: and underlined text like (Florida, United States)
      - desciription: is the text below Agency:
      - closingDate: is after Due Date and in format like Aug 18, 2025
    5. Scroll to bottom and click next page and repeat Step 4 until there are no more pages
    6. Append solicitations to list of solicitations in memory
    7. On last page store solicitations list to 'solicitations' key of JSON result`,
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
  categorySummary: z.object({
    solicitations: z.array(rawSolSchema).default([]),
  }),
};

let totalSolicitations = 0;
const start = new Date();
performance.mark("start");

async function run() {
  console.log(`\nExtracting from instantmarkets.com ${start.toLocaleString()}`);

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
      downloadsPath: ".output/instantmarkets/tmp/downloads",
    },
  });

  let cacheFolder = getLatestFolder(".output/instantmarkets");
  if (cacheFolder) console.log(`Previous session found: ${cacheFolder}`);
  else cacheFolder = start.toISOString();

  let categorySummary = await executeTask({
    agent,
    name: "categorySummary",
    folder: `.output/instantmarkets/${cacheFolder}`,
    task: tasks.categorySummary(),
    outputSchema: schemas.categorySummary,
    hideSteps: HIDE_STEPS,
  });
  console.log({ test: JSON.parse(categorySummary) });
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
