import "dotenv/config";
import chalk from "chalk";
import { z } from "zod";
import fs from "fs";
import { execSync } from "child_process";
import { initDb, initStorage } from "@/lib/firebaseAdmin";
import { post as elasticPost } from "@/lib/elastic";
import { fireToJs } from "@/lib/dataUtils";
import { solicitation as solModel, scriptLog as logModel } from "@/app/models";
import { executeTask, getLatestFolder, initHyperAgent } from "@/scripts/utils";

const BASE_URL = "http://localhost:3000";
const DEBUG = true;
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
      - Publication Date
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
    publicationDate: z.string(),
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
        publicationDate: z.string(),
        closingDate: z.string(),
        description: z.string(),
        location: z.string(),
      })
    ),
  }),
};

async function checkLatestSummary() {
  let summary;

  fs.mkdirSync(".output/biddirect", { recursive: true });

  let dir = ".output/biddirect";
  const folders = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.match(/^\d{4}-\d{2}-\d{2}/) &&
        fs.statSync(`${dir}/${f}`).isDirectory()
    );

  if (folders.length === 0) {
    return false;
  }

  dir = `.output/biddirect/${folders[folders.length - 1]}/summary.json`;

  if (fs.existsSync(dir)) {
    summary = JSON.parse(fs.readFileSync(dir, "utf-8"));
  }

  return { isoString: folders[folders.length - 1], summary };
}

function convertSizeToUnix(sizeStr: any) {
  const size = sizeStr
    .replace(" Kb", "KB")
    .replace(" Mb", "MB")
    .replace(" Gb", "GB");
  return size;
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
      message: `Scrapped ${successCount} solicitations from publicpurchase.com. 
        ${failCount > 0 && `Found ${failCount} failures. `}
        ${dupCount > 0 && `Found ${dupCount} duplicates. `}`,
      scriptName: "scrapers/biddirect",
      successCount: successCount,
      failCount,
      junkCount,
      timeStr: totalSec,
    },
    process.env.SERVICE_KEY
  );

  process.exit(0);
}

async function executeSolDetails(
  agent: any,
  folder: any,
  solicitationId: any,
  urlPath: any
) {
  const result = await agent.executeTask(tasks.executeSolDetails(urlPath), {
    onDebugStep: (debug: any) => {
      console.dir(debug);
    },
    onStep: (step: any) => {
      performance.mark(`executeSolDetails-step-${step.idx + 1}`);
      const duration =
        step.idx === 0
          ? performance.measure(
              `executeSolDetails-step-${step.idx + 1}-duration`,
              "start",
              `executeSolDetails-step-${step.idx + 1}`
            )
          : performance.measure(
              `executeSolDetails-step-${step.idx + 1}-duration`,
              `executeSolDetails-step-${step.idx}`,
              `executeSolDetails-step-${step.idx + 1}`
            );

      if (HIDE_STEPS) return;

      console.log(
        chalk.gray(`      ${(duration.duration / 1000).toFixed(1)}s`)
      );
      console.log(
        `    ${step.idx + 1}. ${step.agentOutput.actions[0].actionDescription}`
      );
    },
    debugDir: `.output/biddirect/${folder}/debug/executeSolDetails/${solicitationId}/debug`,
    outputSchema: schemas.solicitation,
  });

  if (!result.output) {
    throw new Error("Unable to get JSON output from agent");
  }

  return JSON.parse(result.output);
}

async function executeSummary(agent: any, folder: any) {
  const result = await agent.executeTask(tasks.executeSummary(), {
    onStep: (step: any) => {
      performance.mark(`executeSummary-step-${step.idx + 1}`);
      const duration =
        step.idx === 0
          ? performance.measure(
              `executeSummary-step-${step.idx + 1}-duration`,
              "start",
              `executeSummary-step-${step.idx + 1}`
            )
          : performance.measure(
              `executeSummary-step-${step.idx + 1}-duration`,
              `executeSummary-step-${step.idx}`,
              `executeSummary-step-${step.idx + 1}`
            );

      if (HIDE_STEPS) return;

      console.log(
        chalk.gray(`      ${(duration.duration / 1000).toFixed(1)}s`)
      );
      console.log(
        `    ${step.idx + 1}. ${step.agentOutput.actions[0].actionDescription}`
      );
    },
    outputSchema: schemas.summary,
    debugDir: `.output/biddirect/${folder}/debug/executeSummary`,
  });

  if (!result.output) {
    throw new Error("Unable to get JSON output from agent");
  }

  return JSON.parse(result.output);
}

async function executeSummarySolByPage(agent: any, page: any, folder: any) {
  const result = await agent.executeTask(tasks.executeSummarySolByPage(page), {
    onStep: (step: any) => {
      performance.mark(`executeSummarySolByPage-step-${step.idx + 1}`);
      const duration =
        step.idx === 0
          ? performance.measure(
              `executeSummarySolByPage-step-${step.idx + 1}-duration`,
              "start",
              `executeSummarySolByPage-step-${step.idx + 1}`
            )
          : performance.measure(
              `executeSummarySolByPage-step-${step.idx + 1}-duration`,
              `executeSummarySolByPage-step-${step.idx}`,
              `executeSummarySolByPage-step-${step.idx + 1}`
            );

      if (HIDE_STEPS) return;

      console.log(
        chalk.gray(`      ${(duration.duration / 1000).toFixed(1)}s`)
      );
      console.log(
        `    ${step.idx + 1}. ${step.agentOutput.actions[0].actionDescription}`
      );
    },
    outputSchema: schemas.summarySolicitations,
    debugDir: `.output/biddirect/${folder}/debug/executeSummarySolByPage/${page.toString()}`,
  });

  if (!result.output) {
    throw new Error("Unable to get JSON output from agent");
  }

  return JSON.parse(result.output);
}

async function getFile(filePath: any) {
  let results;

  if (fs.existsSync(filePath)) {
    results = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return results;
}

function sanitizeSolForDb(solicitation: Record<string, any>) {
  if (!solicitation || !solicitation.id) {
    throw new Error("Invalid solicitation data");
  }

  const questionsDueByDate = new Date(solicitation.questionsDueByDate);
  const publicationDate = new Date(solicitation.publicationDate);
  const closingDate = new Date(solicitation.closingDate);

  return {
    categories: solicitation.categories || [],
    closingDate: !isNaN(closingDate.getTime()) ? closingDate : null,
    cnStatus: "new",
    contactEmail: "",
    contactName: "",
    contactNote: "",
    contactPhone: "",
    created: new Date(),
    description: solicitation.description,
    documents: [],
    externalLinks: solicitation.externalUrl ? [solicitation.externalUrl] : [],
    issuer: solicitation.issuingOrganization,
    keywords: "",
    location: solicitation.location,
    meta: {},
    publicationDate: !isNaN(publicationDate.getTime()) ? publicationDate : null,
    questionsDueByDate: !isNaN(questionsDueByDate.getTime())
      ? questionsDueByDate
      : null,
    rfpType: "",
    site: "bidnetdirect",
    siteData: { ...solicitation },
    siteId: solicitation.id,
    siteUrl: solicitation.url,
    title: solicitation.title,
    updated: new Date(),
    url: solicitation.url,
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
      continue;
    }

    const fileUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${destination}`;
    console.log(`    ${targetName} uploaded to storage`);
    fileUrls.push(fileUrl);

    docIndex++;
  }

  return fileUrls;
}

async function run() {
  console.log(`\nExtracting from bidnetdirect.com ${start.toLocaleString()}`);

  const db = initDb();
  const storage = initStorage();
  const bucket = storage.bucket();
  const solCollection = db.collection("solicitations");

  let out, cmd;

  const agent = initHyperAgent({ debug: DEBUG, vendor: "biddirect" });

  const latestSummary = await checkLatestSummary();
  let cacheFolder = start.toISOString();

  console.log("  Get summary");

  // Get the overall summary
  let summary;
  if (latestSummary && latestSummary.summary) {
    console.log(`    Cache found ${latestSummary.isoString}`);
    summary = latestSummary.summary;
    cacheFolder = latestSummary.isoString;
  } else {
    summary = await executeSummary(agent, cacheFolder);
    const baseDir = `.output/biddirect/${start.toISOString()}`;
    fs.mkdirSync(baseDir, { recursive: true });
    fs.mkdirSync(`${baseDir}/solicitations`, { recursive: true });
    fs.mkdirSync(`${baseDir}/debug`, { recursive: true });
    fs.writeFileSync(
      `${baseDir}/summary.json`,
      JSON.stringify(summary, null, 2)
    );
    console.log(`  summary.json saved`);
  }

  if (summary.pages === 0) {
    console.log(`    No pages found`);
    return;
  }

  // Loop through all pages
  for (let currPage = 1; currPage <= summary.pages; currPage++) {
    console.log(`\n  Get solicitations for page ${currPage}`);

    const pageFileName = `page-${currPage.toString().padStart(3, "0")}.json`;
    const pageFilePath = `.output/biddirect/${cacheFolder}/pages/${pageFileName}`;
    const checkPage = await getFile(pageFilePath);

    let pageSummary;
    if (checkPage) {
      console.log("     Cache found");
      pageSummary = checkPage;
    } else {
      pageSummary = await executeSummarySolByPage(agent, currPage, cacheFolder);
      fs.writeFileSync(pageFilePath, JSON.stringify(pageSummary, null, 2));
      console.log(`    ${pageFileName} saved`);
    }

    if (pageSummary.solicitations.length === 0) {
      console.log(`    No solicitations found on page ${currPage}`);
      continue;
    }

    console.log(
      `    ${pageSummary.solicitations.length} solicitations extracted`
    );

    const max = pageSummary.solicitations.length;
    for (let solIndex = 0; solIndex < max; solIndex++) {
      execSync(
        `rm -rf .output/biddirect/tmp/downloads && mkdir -p .output/biddirect/tmp/downloads`
      );

      try {
        const rawSol = pageSummary.solicitations[solIndex];
        console.log(
          `\n  Processing solicitation p${currPage}/${summary.pages} ${
            solIndex + 1
          }/${max} - ${rawSol.id} ${rawSol.title}`
        );
        const solPath = `.output/biddirect/${cacheFolder}/solicitations/${rawSol.id}`;
        const checkFile = await getFile(`${solPath}/post.json`);
        let solDetails;

        if (checkFile) {
          solDetails = checkFile;
          console.log(`    Found cached solicitation details for ${rawSol.id}`);
        } else {
          solDetails = await executeSolDetails(
            agent,
            cacheFolder,
            rawSol.id,
            rawSol.url
          );

          // Write to file
          fs.mkdirSync(`${solPath}/documents`, {
            recursive: true,
          });
          fs.writeFileSync(
            `${solPath}/post.json`,
            JSON.stringify(solDetails, null, 2)
          );
          console.log("    post.json saved");

          // Write to database
          const solDbRecord = sanitizeSolForDb(solDetails);
          const newDoc = await solCollection.add(solDbRecord);
          console.log(
            chalk.green(`    Initial record saved to Firestore ${newDoc.id}`)
          );
        }

        const fileUrls = await processDownloads({
          solDetails,
          solPath: solPath,
          bucket,
        });

        // Save fileUrls to the database
        if (fileUrls.length === 0) {
          console.log(chalk.yellow(`    No files found for ${rawSol.id}`));
          continue;
        }

        const checkDocs = await solCollection
          .where("siteId", "==", rawSol.id)
          .get();
        let dbDoc = checkDocs.docs[0];

        if (!dbDoc) {
          console.log(
            chalk.red(`    No Firestore record found for ${rawSol.id}`)
          );

          // Write to database
          const solDbRecord = sanitizeSolForDb({
            ...solDetails,
            siteId: rawSol.id,
          });
          const newDoc = await solCollection.add(solDbRecord);
          const checkDocs = await solCollection
            .where("siteId", "==", newDoc.id)
            .get();
          dbDoc = checkDocs.docs[0];
          console.log(
            chalk.green(`    Initial record saved to Firestore ${newDoc.id}`)
          );
        }

        dbDoc.ref.update({ documents: fileUrls });
        console.log(
          chalk.green(
            `    ${fileUrls.length} documents updated in Firestore for ${dbDoc.id}`
          )
        );

        /* TODO: Fix me
        await elasticPost("solicitations", dbDoc.id, fireToJs(dbDoc.data()));
        console.log(chalk.green(`    Elastic record created ${dbDoc.id}`));
        */

        totalSolicitations++;
      } catch (error: any) {
        console.error(chalk.red("    Failed to process solicitation"));
        console.error(chalk.red(`    ${error}`, error?.stack));
      }
    }
  }

  await agent.closeAgent();
}

let dupCount = 0;
let successCount = 0;
let failCount = 0;
let junkCount = 0;
let totalSolicitations = 0;
const start = new Date();
performance.mark("start");

run()
  .catch((error: any) => console.error(chalk.red(`  ${error}`, error?.stack)))
  .finally(async () => {
    await end();
  });

process.on("SIGINT", async () => {
  await end();
});
