import { config } from "dotenv";
import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import { run as govdirections } from "./playwright/rfpSearch/govdirections/sols";

// Load .env from root directory - use absolute path
config({ path: "/home/mohammad_alsayyedan/Recon/recon/.env" });

async function test() {
  console.log("🚀 Starting govdirections test with Browserbase...");
  console.log("📝 Environment check:");
  console.log("  BASE_URL:", process.env.BASE_URL || "https://reconrfp.cendien.com");
  console.log("  SERVICE_KEY:", process.env.SERVICE_KEY ? "✓ Set" : "✗ Missing");
  console.log("  GOVDIRECTIONS_USER:", process.env.GOVDIRECTIONS_USER ? "✓ Set" : "✗ Missing");
  console.log("  GOVDIRECTIONS_PASS:", process.env.GOVDIRECTIONS_PASS ? "✓ Set" : "✗ Missing");
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
      vendor: "govdirections",
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
    // Add page event listeners for debugging
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`[Browser ${type}]:`, msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('[Browser Page Error]:', error.message);
    });

    // Log page navigation
    page.on('load', () => {
      console.log(`📄 Page loaded: ${page.url()}`);
    });

    console.log("🔍 Starting scraper with debug logging enabled...\n");

    const results = await govdirections(
      page,
      {
        BASE_URL: process.env.BASE_URL || "https://reconrfp.cendien.com",
        DEV_SERVICE_KEY: process.env.SERVICE_KEY || process.env.DEV_SERVICE_KEY,
        DEV_GOVDIRECTIONS_USER: process.env.GOVDIRECTIONS_USER || process.env.DEV_GOVDIRECTIONS_USER,
        DEV_GOVDIRECTIONS_PASS: process.env.GOVDIRECTIONS_PASS || process.env.DEV_GOVDIRECTIONS_PASS,
        DEV_BROWSERBASE_KEY: BROWSERBASE_KEY,
      },
      context
    );

    console.log("\n✅ Test completed successfully!");
    console.log("Results:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("\n❌ Test failed:", error);

    // Capture comprehensive debug info on error
    try {
      console.log("\n🔍 [TEST] Detailed Debug Info:");
      console.log("  Current URL:", page.url());
      console.log("  Page title:", await page.title().catch(() => "Unable to get title"));

      // List all forms on error
      const forms = await page.locator("form").all().catch(() => []);
      console.log(`\n  📋 Forms on page: ${forms.length}`);
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const id = await form.getAttribute("id").catch(() => null);
        const action = await form.getAttribute("action").catch(() => null);
        const visible = await form.isVisible().catch(() => false);
        console.log(`    Form ${i}: id="${id}", action="${action}", visible=${visible}`);
      }

      // List all input fields on error
      const inputs = await page.locator("input").all().catch(() => []);
      console.log(`\n  📝 Input fields on page: ${inputs.length}`);
      for (let i = 0; i < Math.min(inputs.length, 15); i++) {
        const input = inputs[i];
        const type = await input.getAttribute("type").catch(() => null);
        const id = await input.getAttribute("id").catch(() => null);
        const name = await input.getAttribute("name").catch(() => null);
        const value = await input.getAttribute("value").catch(() => null);
        const visible = await input.isVisible().catch(() => false);
        console.log(`    Input ${i}: type="${type}", id="${id}", name="${name}", value="${value}", visible=${visible}`);
      }

      // List all buttons on error
      const buttons = await page.locator("button, input[type='submit']").all().catch(() => []);
      console.log(`\n  🔘 Buttons on page: ${buttons.length}`);
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const type = await button.getAttribute("type").catch(() => null);
        const value = await button.getAttribute("value").catch(() => null);
        const text = await button.innerText().catch(() => "");
        const visible = await button.isVisible().catch(() => false);
        console.log(`    Button ${i}: type="${type}", value="${value}", text="${text}", visible=${visible}`);
      }

      // List all select dropdowns on error
      const selects = await page.locator("select").all().catch(() => []);
      console.log(`\n  📊 Select dropdowns on page: ${selects.length}`);
      for (let i = 0; i < selects.length; i++) {
        const select = selects[i];
        const name = await select.getAttribute("name").catch(() => null);
        const id = await select.getAttribute("id").catch(() => null);
        const visible = await select.isVisible().catch(() => false);
        console.log(`    Select ${i}: name="${name}", id="${id}", visible=${visible}`);
      }

      // Get page HTML snippet (first 3000 chars)
      const bodyHTML = await page.locator("body").innerHTML().catch(() => "Unable to get HTML");
      console.log(`\n  📄 Page HTML length: ${bodyHTML.length} characters`);
      if (bodyHTML.length < 3000) {
        console.log("\n  Full HTML:\n", bodyHTML);
      } else {
        console.log("\n  HTML snippet (first 3000 chars):\n", bodyHTML.substring(0, 3000) + "...");
      }

      // Take screenshot
      const screenshot = await page.screenshot({ fullPage: false }).catch(() => null);
      if (screenshot) {
        console.log("\n  📸 Screenshot captured (not displayed in terminal)");
      }
    } catch (debugError) {
      console.error("  Failed to capture debug info:", debugError);
    }
  } finally {
    await browser.close();
    console.log("");
    console.log(`📹 Review session: https://www.browserbase.com/sessions/${session.id}`);
  }
}

test();
