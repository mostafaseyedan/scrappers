# Cloud vs Local Scrapers Comparison

## Overview

This document provides a comprehensive comparison between cloud scrapers (in `functions` folder) and local scrapers (in `scripts` folder). The codebase contains **three distinct types** of scraper implementations.

## Summary Statistics

| Type | Location | Count | Total Lines | Purpose |
|------|----------|-------|-------------|---------|
| **Cloud Scrapers** | `functions/src/playwright/rfpSearch/` | 22 | ~4,288 | Production scraping for all sources |
| **Local Playwright** | `scripts/playwright/` | 8 | ~827 | Development/debugging dashboard solicitations |
| **AI Scrapers** | `scripts/scrapers/` | 4 | ~14,070 | AI-powered scraping for complex sites |

---

## Type 1: Cloud Scrapers (Firebase Functions)

### Location
`functions/src/playwright/rfpSearch/`

### Scrapers (22 total)
- biddirect, bidsync, bonfirehub, cammnet, commbuys
- demandstar, findrfp, floridabids, govdirections, governmentbidders
- highergov, instantmarkets, merx, mygovwatch, omniapartners
- publicpurchase, rfpmart, techbids, txsmartbuy, vendorline
- vendorlink, vendorregistry

### Key Characteristics

**Infrastructure:**
- Run on Firebase Cloud Functions (serverless)
- Use Browserbase for cloud-based browser automation
- Scheduled to run automatically via cron jobs
- Deployed to production environment

**Code Features:**
```typescript
// Example from functions/src/playwright/rfpSearch/findrfp/sols.ts
export async function run(
  page: Page,
  env: Record<string, any> = {},
  context: BrowserContext
) {
  // Full production logic
  const BASE_URL = env.BASE_URL!;
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  const USER = env.DEV_FINDRFP_USER!;
  const PASS = env.DEV_FINDRFP_PASS!;

  // Login, scrape, check duplicates, save to database
  await login(page, USER, PASS);
  const sols = await scrapeAllSols(page, env, context);

  return {
    sols,
    counts: {
      success: successCount,
      fail: failCount,
      dup: dupCount,
      junk: expiredCount + nonItCount,
    },
  };
}
```

**Features:**
1. **Duplicate Detection** (lines 83-92 in findrfp/sols.ts)
   ```typescript
   const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY);
   if (isDup) {
     dupCount++;
     return false;
   }
   ```

2. **Expiration Checking** (lines 73-76)
   ```typescript
   if (sol.closingDate && !isNotExpired(sol)) {
     expiredCount++;
     return false;
   }
   ```

3. **Date Range Filtering** (lines 78-81)
   ```typescript
   if (sol.publishDate && !isWithinDays(sol.publishDate, 14)) {
     expiredCount++;
     return false;
   }
   ```

4. **API Integration** (lines 94-103)
   ```typescript
   const newRecord = await solModel.post({
     baseUrl: env.BASE_URL,
     data: sol,
     token: env.SERVICE_KEY,
   });
   ```

5. **Comprehensive Error Handling**
   - Try-catch blocks throughout
   - Error logging with firebase-functions logger
   - Graceful degradation on failures

6. **Keyword-based Searching**
   - Multiple keywords per scraper (ERP, software, peoplesoft, etc.)
   - Pagination through all results
   - Early termination on too many expired results

**Metrics Tracking:**
- `successCount` - Successfully saved solicitations
- `failCount` - Failed operations
- `dupCount` - Duplicate solicitations skipped
- `expiredCount` - Expired solicitations skipped
- `nonItCount` - Non-IT related solicitations skipped

**Dependencies:**
- Browserbase SDK for cloud browser automation
- Firebase Functions for deployment
- Custom models and utilities from functions/src/lib/
- Playwright for browser automation

---

## Type 2: Local Playwright Scrapers (Development/Debugging)

### Location
`scripts/playwright/`

### Scrapers (8 total)
- biddirect/dashboardSols.ts
- bidsync/dashboardSols.ts
- instantmarkets/getSols.ts
- mygovwatch/dashboardSols.ts
- publicpurchase/invitedSols.ts
- techbids/dashboardSols.ts
- vendorline/dashboardSols.ts
- vendorregistry/dashboardSols.ts

### Key Characteristics

**Infrastructure:**
- Run locally on developer machine
- Use local Chromium browser (headless: false)
- Manual execution for testing/debugging
- Not deployed to production

**Code Features:**
```typescript
// Example from scripts/playwright/techbids/dashboardSols.ts
async function run() {
  const browser: Browser = await chromium.launch({
    headless: false,    // Can see the browser
    slowMo: 50,        // Slow down for debugging
  });
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  await login(page, USER, PASS);
  const allSols = await scrapeAllSols(page, context);
  console.log(allSols);  // Just output to console

  await browser.close();
}
```

**Features:**
1. **Simplified Logic**
   - No duplicate checking
   - No expiration validation
   - No database saving
   - Just extraction and console output

2. **Focus on Dashboard/Invited Solicitations**
   - Scrapes user-specific solicitations from dashboard
   - "invitedSols" for publicpurchase
   - "dashboardSols" for most others
   - Different from public search results

3. **Development Features**
   ```typescript
   headless: false,  // Visible browser for debugging
   slowMo: 50,       // Slower execution to observe
   ```

4. **Minimal Dependencies**
   - Only playwright-core
   - dotenv for environment variables
   - Utilities from functions/src/lib/ for date sanitization

5. **Limited Scope**
   - Usually only scrapes first few pages/records
   - Example: vendorline only loops 5 times (line 94)
   - No keyword iteration
   - No comprehensive pagination

**Use Cases:**
- Testing login credentials
- Debugging selectors
- Validating scraper logic before deploying to cloud
- Extracting user-specific solicitations not available in public search

---

## Type 3: AI-Powered Scrapers (HyperAgent)

### Location
`scripts/scrapers/`

### Scrapers (4 total)
- biddirect.ts
- instantmarkets.ts
- publicpurchase.ts
- vendorregistry.ts

### Key Characteristics

**Infrastructure:**
- Run locally on developer machine
- Use HyperAgent (AI-powered browser automation)
- Uses OpenAI/LangChain for intelligent navigation
- Cloud browser via Browserbase or local

**Code Features:**
```typescript
// Example from scripts/scrapers/instantmarkets.ts
const tasks = {
  categoryPage: (params: { page: number }) =>
    `Throughout the whole task, you will be using the credentials: username: '${USER}', password: '${PASS}'.
    1. Go to https://www.instantmarkets.com/
    2. Log in with the credentials provided.
    3. Go to https://www.instantmarkets.com/q/Information_Technology?ot=Bid%20Notification&pg=${params.page}.
    4. Wait for page to load. Hit 'Skip' to close the tutorial. Close any popups that may appear.
    5. Then extract solicitations from page with the following fields:
      - id, title, issuer, location, description, closingDate
    6. Return the list of solicitations as a JSON object.`,
};

let categoryPage = await executeTask({
  agent,
  name: `categoryPage/${page}`,
  folder: `.output/instantmarkets/${cacheFolder}`,
  task: tasks.categoryPage({ page }),
  outputSchema: schemas.categoryPage,
  hideSteps: HIDE_STEPS,
});
```

**Features:**
1. **Natural Language Tasks**
   - Describe what to do in plain English
   - AI agent figures out how to do it
   - More resilient to UI changes

2. **Intelligent Navigation**
   - Automatically handles popups, tutorials, cookie banners
   - Can adapt to dynamic content
   - Understands context better than hard-coded selectors

3. **Full Production Features**
   - Duplicate checking via Firestore
   - Expiration validation
   - Database saving via API
   - Comprehensive error handling

4. **Caching System** (lines 112-114)
   ```typescript
   let cacheFolder = getLatestFolder(".output/instantmarkets");
   if (cacheFolder) console.log(`Previous session found: ${cacheFolder}`);
   ```
   - Saves results to .output/ folder
   - Can resume from previous runs
   - Avoids re-scraping already processed pages

5. **Schema Validation** (lines 55-79)
   ```typescript
   const rawSolSchema = z.object({
     id: z.string(),
     title: z.string(),
     issuer: z.string(),
     location: z.string(),
     closingDate: z.string(),
     description: z.string(),
     url: z.string(),
   });
   ```

6. **IT Relevance Checking** (lines 177-182)
   ```typescript
   const isIt = await isItRelated(rawSol);
   if (!isIt) {
     junkCount++;
     console.log(chalk.yellow(`  Not IT-related. Skipping.`));
     continue;
   }
   ```

**Dependencies:**
- @hyperbrowser/agent - AI browser automation
- @langchain/openai - Language model integration
- zod - Schema validation
- Firebase models for database access
- chalk - Colored console output

**Advantages:**
- More resilient to website changes
- Can handle complex UIs with dynamic content
- Natural language makes logic easier to understand
- Adapts to unexpected UI elements (popups, tutorials)

**Disadvantages:**
- Requires OpenAI API key (cost per run)
- Slower than direct Playwright automation
- Less deterministic (AI might do things differently each time)
- Harder to debug when things go wrong

---

## Detailed Comparison Table

| Feature | Cloud Scrapers | Local Playwright | AI Scrapers |
|---------|----------------|------------------|-------------|
| **Deployment** | Firebase Functions | Local only | Local only |
| **Browser** | Browserbase (cloud) | Local Chromium | Browserbase or local |
| **Automation** | Playwright selectors | Playwright selectors | AI agent (natural language) |
| **Duplicate Check** | ✅ Yes | ❌ No | ✅ Yes |
| **Expiration Check** | ✅ Yes | ❌ No | ✅ Yes |
| **Date Range Filter** | ✅ Yes (14 days) | ❌ No | ✅ Yes |
| **Database Save** | ✅ Yes (via API) | ❌ No (console only) | ✅ Yes (via API) |
| **Error Handling** | ✅ Comprehensive | ⚠️ Basic | ✅ Comprehensive |
| **Metrics Tracking** | ✅ Full counts | ❌ No | ✅ Full counts |
| **Keyword Search** | ✅ Multiple keywords | ❌ Single query | ✅ AI-determined |
| **Pagination** | ✅ Full pagination | ⚠️ Limited | ✅ Full pagination |
| **Debugging** | ❌ Harder (cloud) | ✅ Easy (visible) | ⚠️ Medium (AI logs) |
| **Speed** | ⚠️ Medium | ✅ Fast | ❌ Slower (AI) |
| **Resilience** | ⚠️ Brittle selectors | ⚠️ Brittle selectors | ✅ Adaptive AI |
| **Cost** | $ Browserbase | Free | $$ OpenAI API |
| **Logging** | Firebase logger | console.log | chalk + Firebase |
| **Focus** | Public search | User dashboard | Public search |
| **Caching** | ❌ No | ❌ No | ✅ Yes (.output/) |

---

## Coverage Analysis

### Sources Only in Cloud Scrapers (14 sources)
These sources don't have local equivalents:
1. bonfirehub
2. cammnet
3. commbuys
4. demandstar
5. findrfp
6. floridabids
7. govdirections
8. governmentbidders
9. highergov
10. merx
11. omniapartners
12. rfpmart
13. txsmartbuy
14. vendorlink

### Sources in Multiple Implementations

**biddirect:**
- ✅ Cloud: functions/src/playwright/rfpSearch/biddirect/sols.ts
- ✅ Local: scripts/playwright/biddirect/dashboardSols.ts
- ✅ AI: scripts/scrapers/biddirect.ts

**instantmarkets:**
- ✅ Cloud: functions/src/playwright/rfpSearch/instantmarkets/sols.ts
- ✅ Local: scripts/playwright/instantmarkets/getSols.ts
- ✅ AI: scripts/scrapers/instantmarkets.ts

**publicpurchase:**
- ✅ Cloud: functions/src/playwright/rfpSearch/publicpurchase/sols.ts
- ✅ Local: scripts/playwright/publicpurchase/invitedSols.ts
- ✅ AI: scripts/scrapers/publicpurchase.ts

**vendorregistry:**
- ✅ Cloud: functions/src/playwright/rfpSearch/vendorregistry/sols.ts
- ✅ Local: scripts/playwright/vendorregistry/dashboardSols.ts
- ✅ AI: scripts/scrapers/vendorregistry.ts

**Others with dual implementation:**
- bidsync: Cloud + Local
- mygovwatch: Cloud + Local
- techbids: Cloud + Local
- vendorline: Cloud + Local

---

## Key Implementation Differences

### 1. Function Signature

**Cloud Scrapers:**
```typescript
export async function run(
  page: Page,
  env: Record<string, any> = {},
  context: BrowserContext
) {
  // Receives page, env config, and context from caller
  // Returns structured results with counts
}
```

**Local Playwright:**
```typescript
async function run() {
  // Self-contained, launches own browser
  // Reads credentials from process.env directly
  // Just console.log output
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**AI Scrapers:**
```typescript
async function run(agent: any) {
  // Receives initialized HyperAgent
  // Uses natural language tasks
  // Saves to database and logs
}

const agent = initHyperAgent({ debug: DEBUG, vendor: VENDOR });
run(agent).finally(() => endScript({ agent, vendor, counts }));
```

### 2. Credential Handling

**Cloud Scrapers:**
```typescript
const USER = env.DEV_FINDRFP_USER!;
const PASS = env.DEV_FINDRFP_PASS!;
// Passed in from Cloud Function environment
```

**Local Scrapers:**
```typescript
import "dotenv/config";
const USER = process.env.FINDRFP_USER!;
const PASS = process.env.FINDRFP_PASS!;
// Loaded from local .env file
```

### 3. Browser Initialization

**Cloud Scrapers:**
```typescript
// Browser already initialized by Cloud Function
// Just receives page and context
export async function run(page: Page, env, context: BrowserContext)
```

**Local Playwright:**
```typescript
const browser = await chromium.launch({
  headless: false,
  slowMo: 50,
});
const context = await browser.newContext();
const page = await context.newPage();
```

**AI Scrapers:**
```typescript
const agent = initHyperAgent({ debug: DEBUG, vendor: VENDOR });
// HyperAgent manages browser internally
```

### 4. Data Saving

**Cloud Scrapers:**
```typescript
const newRecord = await solModel.post({
  baseUrl: env.BASE_URL,
  data: sol,
  token: env.SERVICE_KEY,
});
successCount++;
logger.log(`Saved sol: ${newRecord.id}`);
```

**Local Playwright:**
```typescript
// No saving, just collection
allSols.push(sol);
// ...
console.log(allSols);  // Output to console
```

**AI Scrapers:**
```typescript
const newRecord = await solModel.post({
  baseUrl: BASE_URL,
  data: dbSolData,
  token: process.env.SERVICE_KEY,
});
console.log(chalk.green(`  Saved. ${newRecord.id}`));
successCount++;
```

### 5. Duplicate Detection

**Cloud Scrapers:**
```typescript
const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY);
if (isDup) {
  dupCount++;
  return false;
}
```

**Local Playwright:**
```typescript
// No duplicate checking
// Just extracts and returns all results
```

**AI Scrapers:**
```typescript
const respCheckExist = await solModel.get({
  baseUrl: BASE_URL,
  filters: { siteId: rawSol.id },
  token: process.env.SERVICE_KEY,
});
if (respCheckExist.results?.length) {
  fireDoc = respCheckExist.results[0];
  console.log(chalk.grey(`  Already exists in Firestore ${fireDoc.id}.`));
  dupCount++;
  continue;
}
```

---

## When to Use Each Type

### Use Cloud Scrapers When:
- Running in production
- Need scheduled/automated execution
- Want comprehensive scraping of all public sources
- Need duplicate checking and validation
- Saving to production database
- Scraping from multiple keywords
- Need metrics and logging

### Use Local Playwright When:
- Testing scraper logic before deployment
- Debugging selector issues
- Validating login credentials
- Scraping user-specific dashboard solicitations
- Quick extraction without database overhead
- Need to see the browser in action
- Developing new scrapers

### Use AI Scrapers When:
- Website has complex/dynamic UI
- Frequent website changes make selectors brittle
- Need to handle unpredictable popups/tutorials
- Want more resilient scraping logic
- Have OpenAI API access
- Can tolerate slower execution
- Need intelligent adaptation to UI changes

---

## Recommendations

### 1. Sync Missing Scrapers
Consider creating local development versions for the 14 sources that only exist in cloud:
- bonfirehub, cammnet, commbuys, demandstar, findrfp
- floridabids, govdirections, governmentbidders, highergov, merx
- omniapartners, rfpmart, txsmartbuy, vendorlink

This would allow easier debugging when cloud scrapers fail.

### 2. Standardize Test Files
Now that test files exist for all cloud scrapers (test-*.ts), use them for:
- Validating scrapers before deployment
- Debugging zero-result issues
- Testing credential validity
- Recording sessions for review

### 3. Consider AI Migration for Problematic Scrapers
For scrapers with frequent failures (findrfp, merx, vendorline), consider:
- Creating AI scraper versions
- More resilient to website changes
- Can handle dynamic content better

### 4. Hybrid Approach
Use a tiered strategy:
1. **Primary**: Cloud Playwright scrapers (fast, cheap, predictable)
2. **Fallback**: AI scrapers when Playwright fails
3. **Development**: Local Playwright for testing

### 5. Better Error Handling
All scraper types could benefit from:
- Screenshot capture on failures
- HTML snapshot saving
- Better error categorization (login failed, selector not found, timeout, etc.)
- Automated alerts on repeated failures

### 6. Consolidate Common Code
Much logic is duplicated across scraper types:
- Login patterns
- Date sanitization
- Pagination logic
- Error handling

Consider creating shared modules for:
- `scraperBase.ts` - Common scraper functionality
- `loginHandlers.ts` - Standard login flows
- `validators.ts` - Expiration, duplicate, relevance checking

### 7. Documentation
Add README files for each scraper type explaining:
- When to use each type
- How to run locally
- Environment variables required
- Common issues and solutions

---

## Environment Variables Summary

### Cloud Scrapers (Firebase Functions)
```
BASE_URL
DEV_SERVICE_KEY
DEV_BROWSERBASE_KEY
DEV_<SOURCE>_USER  # e.g., DEV_FINDRFP_USER
DEV_<SOURCE>_PASS  # e.g., DEV_FINDRFP_PASS
```

### Local Scrapers
```
<SOURCE>_USER  # e.g., FINDRFP_USER
<SOURCE>_PASS  # e.g., FINDRFP_PASS
```

### AI Scrapers
```
BASE_URL
SERVICE_KEY
OPENAI_API_KEY
HYPERBROWSER_API_KEY
<SOURCE>_USER
<SOURCE>_PASS
```

---

## File Structure

```
scrappers/
├── functions/src/playwright/rfpSearch/     # Cloud scrapers (22)
│   ├── biddirect/sols.ts
│   ├── bidsync/sols.ts
│   ├── bonfirehub/agencies.ts
│   ├── findrfp/sols.ts
│   ├── merx/sols.ts
│   └── ... (17 more)
│
├── scripts/playwright/                      # Local Playwright (8)
│   ├── biddirect/dashboardSols.ts
│   ├── techbids/dashboardSols.ts
│   ├── vendorline/dashboardSols.ts
│   └── ... (5 more)
│
├── scripts/scrapers/                        # AI scrapers (4)
│   ├── biddirect.ts
│   ├── instantmarkets.ts
│   ├── publicpurchase.ts
│   └── vendorregistry.ts
│
└── functions/src/test-*.ts                  # Test files (21)
    ├── test-findrfp.ts
    ├── test-merx.ts
    └── ... (19 more)
```

---

## Conclusion

The codebase has three complementary scraper systems:

1. **Cloud Scrapers** - Production workhorses, comprehensive but brittle
2. **Local Playwright** - Development tools, simple but limited
3. **AI Scrapers** - Intelligent alternatives, resilient but expensive

Each serves a specific purpose. The key is knowing when to use each and maintaining consistency across all three types.

The main issues with zero-result scrapers (findrfp, merx, vendorline) could potentially be resolved by:
1. Using the new test files to debug
2. Updating brittle selectors
3. Considering AI scraper migration for chronic failures
4. Adding better error logging and alerts
