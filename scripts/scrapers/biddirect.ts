import "dotenv/config";
import chalk from "chalk";
import { z } from "zod";
import fs from "fs";
import { execSync } from "child_process";
import { initDb, initStorage } from "@/lib/firebaseAdmin";
import { solicitation as solModel, scriptLog as logModel } from "@/app/models";
import {
  endScript,
  executeTask,
  getLatestFolder,
  initHyperAgent,
  isItRelated,
} from "@/scripts/utils";
import { sanitizeDateString } from "@/lib/utils";

const VENDOR = "biddirect";
const BASE_URL = process.env.BASE_URL;
const DEBUG = false;
const HIDE_STEPS = true;
const USER = process.env.BIDDIRECT_USER;
const PASS = process.env.BIDDIRECT_PASS;

const tasks = {
  executeSummary: () =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'. Do not click any links that will leave the site, and do not click any links that will open a new tab or window. You will be using the browser to navigate the site and extract data. The goal is to extract all solicitations from bidnetdirect.com.
    1. Navigate to bidnetdirect.com and log in.
    2. Click on the "Solicitations" tab and then click "Search".
    4. Getting the total number of pages and results from the bottom of the page.`,
  executeSummarySolByPage: (page: number) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'.
    1. Navigate to bidnetdirect.com and log in.
    2. Click 'Allow all cookies'.
    3. Click on the "Solicitations" tab and then click "Search".
    4. Wait at least 5 seconds for the page to refresh and confirm that 'Loading' text is not on the screen. 
    5. Scroll down to the bottom and click on page ${page}.
    6. Wait 5 seconds for page to load. Scroll to the bottom.
    7. Extract all solicitations with their URLs from the current page. Make sure to get the description.`,
  executeSolDetails: (urlPath: string) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'.
    1. Navigate to bidnetdirect.com${urlPath}.
    2. If 'See more' exists below Description, click on 'See more' to get the full description.
    3. Wait 5 seconds for the page to load before extracting the details.
    4. Extract the following fields from the solicitation page:
      - ID: Extract the ID from the URL.
      - URL: The full URL of the solicitation.
      - AI Overview
      - Reference Number
      - Issuing Organization
      - Solicitation Title
      - Title
      - Source Id
      - Location
      - Purchase Type
      - Piggyback Contract
      - Publish Date
      - Closing Date
      - Questions Due By Date
      - Contact Information
      - Description: Copy word to word. Don't summarize.
      - External Url
      - Pre-Bidding Events: Extract for each event: type, date, attendance, and any notes.
    5. Wait until most of the fields are extracted before clicking on Categories on sidebar to fill the categories array.
    6. Click Documents on sidebar and save file name, file size, and URL to fill the documents array.
    7. Download each file by clicking only once.`,
};

const schemas = {
  solicitation: z.object({
    id: z.string(),
    url: z.string(),
    aiOverview: z.string(),
    referenceNumber: z.string(),
    issuingOrganization: z.string(),
    solicitationTitle: z.string(),
    title: z.string(),
    sourceId: z.string(),
    location: z.string(),
    purchaseType: z.string(),
    piggybackContract: z.string(),
    publishDate: z.string(),
    closingDate: z.string(),
    questionsDueByDate: z.string(),
    contactInformation: z.string(),
    description: z.string(),
    externalUrl: z.string(),
    preBiddingEvents: z.array(
      z.object({
        eventType: z.string(),
        eventDate: z.string(),
        attendance: z.string(),
        note: z.string(),
      })
    ),
    categories: z.array(z.string()),
    documents: z.array(
      z.object({
        name: z.string(),
        size: z.string(),
        url: z.string(),
      })
    ),
  }),
  summary: z.object({
    total: z.number(),
    pages: z.number(),
  }),
  summarySolicitations: z.object({
    page: z.number(),
    solicitations: z.array(
      z.object({
        id: z.string(),
        url: z.string(),
        title: z.string(),
        issuingOrganization: z.string(),
        publishDate: z.string(),
        closingDate: z.string(),
        description: z.string(),
        location: z.string(),
      })
    ),
  }),
};

function convertSizeToUnix(sizeStr: any) {
  const size = sizeStr
    .replace(" Kb", "KB")
    .replace(" Mb", "MB")
    .replace(" Gb", "GB");
  return size;
}

async function getFile(filePath: any) {
  let results;

  if (fs.existsSync(filePath)) {
    results = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return results;
}

function sanitizeSolForApi(rawSolData: Record<string, any>) {
  if (!rawSolData || !rawSolData.id) {
    throw new Error("Invalid solicitation data");
  }

  return {
    categories: rawSolData.categories || [],
    closingDate: sanitizeDateString(rawSolData.closingDate),
    cnStatus: "new",
    description: rawSolData.description,
    externalLinks: rawSolData.externalUrl ? [rawSolData.externalUrl] : [],
    issuer: rawSolData.issuingOrganization,
    location: rawSolData.location,
    publishDate: sanitizeDateString(rawSolData.publishDate),
    questionsDueByDate: sanitizeDateString(rawSolData.questionsDueByDate),
    site: "bidnetdirect",
    siteData: { ...rawSolData },
    siteId: rawSolData.id,
    siteUrl: rawSolData.url,
    title: rawSolData.title,
    url: rawSolData.url,
  };
}

function parseFileSize(sizeStr: string) {
  let size;
  size = parseInt(
    sizeStr
      .replace(" Kb", "000")
      .replace(" Mb", "000000")
      .replace(" Gb", "000000000")
  );
  return size;
}

async function processDownloads({
  solDetails,
  solPath,
  bucket,
}: {
  solDetails: any;
  solPath: any;
  bucket: any;
}) {
  let cmd, out;

  if (!solDetails || !solPath) {
    throw new Error("solDetails and solPath required for processDownloads");
  }

  if (!solDetails.documents || solDetails.documents.length === 0) {
    console.log(`    No documents found for ${solDetails.id}`);
    return [];
  }

  fs.mkdirSync(`${solPath}/documents`, { recursive: true });

  // Move downloaded files to the correct folder
  // Note: This is a workaround. Playwright is not exposing the original file name so we are guessing by file size.
  const sortedDocs = solDetails.documents.sort(
    (a: any, b: any) => parseFileSize(a.size) - parseFileSize(b.size)
  );
  cmd = `find .output/biddirect/tmp/downloads/ -maxdepth 1 -type f -printf "%s %f\n" | awk '{cmd="numfmt --to=iec --suffix=B "$1; cmd | getline size; close(cmd); print size, substr($0, index($0,$2))}' | sort -h`;
  out = execSync(cmd);
  const rawFiles = out
    .toString()
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (rawFiles.length === 0) {
    return [];
  }

  let docIndex = 0;
  let fileUrls: string[] = [];
  for (let doc of sortedDocs) {
    const rawLine = rawFiles[docIndex];

    if (!rawLine) {
      continue;
    }

    const rawSep = rawLine.indexOf(" ");
    const [rawSize, rawName] = [
      rawLine.slice(0, rawSep),
      rawLine.slice(rawSep + 1),
    ];
    const size = convertSizeToUnix(doc.size);

    // If the first and second to last characters are the same, we assume it's the same file
    let targetName;
    if (
      size[0] === rawSize[0] &&
      size[size.length - 2] === rawSize[rawSize.length - 2]
    ) {
      targetName = doc.name.replace(/[^a-z0-9.]+/gi, "-");
    } else {
      targetName = rawName;
    }

    const target = `${solPath}/documents/${targetName}`;
    cmd = `mv '.output/biddirect/tmp/downloads/${rawName}' '${target}'`;
    execSync(cmd);
    console.log(`    ${targetName} saved`);

    const destination = `solicitations/${solDetails.id}/documents/${targetName}`;
    const uploadResults = await bucket.upload(target, {
      destination,
      public: true,
    });

    if (!uploadResults || !uploadResults[0]) {
      console.error(chalk.red(`    Failed to upload ${targetName} to storage`));
      return [];
    }

    const fileUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${destination}`;
    console.log(`    ${targetName} uploaded to storage`);
    fileUrls.push(fileUrl);

    docIndex++;
  }

  return fileUrls;
}

async function run(agent: any) {
  console.log(`\nExtracting from bidnetdirect.com ${start.toLocaleString()}`);

  const storage = initStorage();
  const bucket = storage.bucket();

  let cacheFolder = getLatestFolder(".output/publicpurchase");
  if (cacheFolder) console.log(`\nPrevious session found: ${cacheFolder}`);
  else cacheFolder = start.toISOString();

  console.log(`\nGet summary`);
  let latestSummary = await executeTask({
    agent,
    name: "executeSummary",
    folder: `.output/biddirect/${cacheFolder}`,
    task: tasks.executeSummary(),
    outputSchema: schemas.summary,
    hideSteps: HIDE_STEPS,
  });
  latestSummary = JSON.parse(latestSummary);

  // Loop through all pages
  const lastPage = latestSummary.lastPage || 1;
  for (let page = lastPage; page <= latestSummary.pages; page++) {
    console.log(`\nGet solicitations for page ${page}`);

    let pageSummary = await executeTask({
      agent,
      name: `executeSummarySolByPage/${page}`,
      folder: `.output/biddirect/${cacheFolder}`,
      task: tasks.executeSummarySolByPage(page),
      outputSchema: schemas.summarySolicitations,
      hideSteps: HIDE_STEPS,
    });
    pageSummary = JSON.parse(pageSummary);

    if (pageSummary.solicitations.length === 0) {
      console.error(chalk.red(`  No solicitations found on page ${page}`));
      continue;
    }

    console.log(
      `  ${pageSummary.solicitations.length} solicitations extracted`
    );

    // Loop through each solicitation on the page
    const max = pageSummary.solicitations.length;
    for (let solIndex = 0; solIndex < max; solIndex++) {
      execSync(
        `rm -rf .output/biddirect/tmp/downloads && mkdir -p .output/biddirect/tmp/downloads`
      );

      const rawSol = pageSummary.solicitations[solIndex];
      console.log(
        `\np[${page}/${latestSummary.pages}] [${solIndex + 1}/${max}] ${
          rawSol.id
        } ${rawSol.title}`
      );

      // Check Firestore for existing solicitation
      const respCheckExist = await solModel.get({
        baseUrl: BASE_URL,
        filters: { siteId: rawSol.id },
        token: process.env.SERVICE_KEY,
      });
      if (respCheckExist.results?.length) {
        console.log(chalk.grey(`  Already exists in Firestore. Skipping.`));
        dupCount++;
        continue;
      }

      // Check if the solicitation is IT-related
      const isIt = await isItRelated(rawSol);
      if (!isIt) {
        junkCount++;
        console.log(chalk.yellow(`  Not IT-related. Skipping.`));
        continue;
      }

      // Check if the solicitation is expired
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
          chalk.yellow(`  Closing date expired. ${closingDate}. Skipping.`)
        );
        continue;
      }

      // Get sol details
      let rawSolDetails = await executeTask({
        agent,
        name: `executeSolDetails/${rawSol.id}`,
        folder: `.output/biddirect/${cacheFolder}`,
        task: tasks.executeSolDetails(rawSol.url),
        outputSchema: schemas.solicitation,
        hideSteps: HIDE_STEPS,
      });
      rawSolDetails = JSON.parse(rawSolDetails) || {};

      // Save data
      const dbSolData = sanitizeSolForApi({
        ...rawSol,
        ...(rawSol.title === rawSolDetails.title ? rawSolDetails : {}),
      });
      const newRecord = await solModel.post({
        baseUrl: BASE_URL,
        data: dbSolData,
        token: process.env.SERVICE_KEY,
      });
      console.log(chalk.green(`  Saved. ${newRecord.id}`));
      successCount++;

      // Process downloads
      const fileUrls = await processDownloads({
        solDetails: newRecord,
        solPath: `.output/biddirect/${cacheFolder}/executeSolDetails/${rawSol.id}`,
        bucket,
      });

      if (fileUrls.length === 0) {
        console.log(chalk.grey(`  No files found for ${rawSol.id}`));
        continue;
      }

      await solModel.patch({
        baseUrl: BASE_URL,
        id: newRecord.id,
        data: { documents: fileUrls },
        token: process.env.SERVICE_KEY,
      });
      console.log(
        chalk.green(
          `  ${fileUrls.length} documents updated in Firestore for ${newRecord.id}`
        )
      );

      if (dupCount >= 10) {
        console.warn(
          chalk.yellow`\nSkipping page ${page} due to too many duplicates found.`
        );
        dupCount = 0;
        continue;
      }
    }
  }

  await agent.closeAgent();
}

const agent = initHyperAgent({ debug: DEBUG, vendor: VENDOR });
let dupCount = 0;
let successCount = 0;
let failCount = 0;
let junkCount = 0;
const start = new Date();
performance.mark("start");

const endScriptOptions = {
  agent,
  baseUrl: BASE_URL,
  vendor: VENDOR,
  counts: {
    success: successCount,
    fail: failCount,
    junk: junkCount,
    duplicates: dupCount,
  },
};

run(agent)
  .catch((error: any) => console.error(chalk.red(`  ${error}`, error?.stack)))
  .finally(() =>
    endScript({
      ...endScriptOptions,
      counts: {
        success: successCount,
        fail: failCount,
        junk: junkCount,
        duplicates: dupCount,
      },
    })
  );

process.on("SIGINT", () =>
  endScript({
    ...endScriptOptions,
    counts: {
      success: successCount,
      fail: failCount,
      junk: junkCount,
      duplicates: dupCount,
    },
  })
);
