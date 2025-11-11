import { config } from "dotenv";
import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import { run as merx } from "./playwright/rfpSearch/merx/sols";

// Load .env from root directory - use absolute path
config({ path: "/home/mohammad_alsayyedan/Recon/recon/.env" });

async function test() {
  console.log("🚀 Starting merx test with Browserbase...");
  console.log("📝 Environment check:");
  console.log("  BASE_URL:", process.env.BASE_URL || "https://reconrfp.cendien.com");
  console.log("  SERVICE_KEY:", process.env.SERVICE_KEY ? "✓ Set" : "✗ Missing");
  console.log("  MERX_USER:", process.env.MERX_USER ? "✓ Set" : "✗ Missing");
  console.log("  MERX_PASS:", process.env.MERX_PASS ? "✓ Set" : "✗ Missing");
  console.log("  BROWSERBASE_KEY:", process.env.BROWSERBASE_KEY ? "✓ Set" : "✗ Missing");
  console.log("");

  const BROWSERBASE_KEY = process.env.BROWSERBASE_KEY || process.env.DEV_BROWSERBASE_KEY;

  if (!BROWSERBASE_KEY) {
    throw new Error("BROWSERBASE_KEY not found in environment");
  }

  console.log("🌐 Creating Browserbase session...");
  const bb = new Browserbase({
    apiKey: BROWSERBASE_KEY,
  });

  const session = await bb.sessions.create({
    projectId: "859b2230-84b0-449b-a2db-f9352988518c",
    proxies: true,
    userMetadata: {
      vendor: "merx",
      test: "local-test",
    },
  });

  console.log(`✓ Session created: ${session.id}`);
  console.log(`📹 Watch live: https://www.browserbase.com/sessions/${session.id}`);
  console.log("");

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  try {
    const results = await merx(
      page,
      {
        BASE_URL: process.env.BASE_URL || "https://reconrfp.cendien.com",
        DEV_SERVICE_KEY: process.env.SERVICE_KEY || process.env.DEV_SERVICE_KEY,
        DEV_MERX_USER: process.env.MERX_USER || process.env.DEV_MERX_USER,
        DEV_MERX_PASS: process.env.MERX_PASS || process.env.DEV_MERX_PASS,
        DEV_BROWSERBASE_KEY: BROWSERBASE_KEY,
      },
      context
    );

    console.log("✅ Test completed successfully!");
    console.log("Results:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await browser.close();
    console.log("");
    console.log(`📹 Review session: https://www.browserbase.com/sessions/${session.id}`);
  }
}

test();
