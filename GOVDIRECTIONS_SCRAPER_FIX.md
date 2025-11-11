# GovDirections Scraper Fix - Complete Implementation

## Overview

The govdirections scraper has been completely rewritten to address the "inactive source" issue. It now includes login functionality, IT category filtering, and comprehensive data extraction from detail pages.

---

## What Changed

### ❌ OLD BEHAVIOR (Before Fix)

**The scraper was:**
1. Going to homepage without login (public access)
2. Scraping whatever was on the first page
3. Only extracting: title, location, closing date from list view
4. Not filtering by category
5. Limited data fields

**Why it failed:**
- No authentication → limited access to opportunities
- No category filtering → irrelevant results
- Shallow data extraction → poor quality
- Missing key fields like description, external links, issuer

---

## ✅ NEW BEHAVIOR (After Fix)

### **1. LOGIN FUNCTIONALITY** (Lines 13-31)

```typescript
async function login(page: Page, user: string, pass: string) {
  // Navigate to homepage
  await page.goto("https://govdirections.com/");

  // Click login button
  await page.click(".btn.btn-default a[href='/users/login']");
  await page.waitForSelector("input[name='username']");

  // Fill credentials
  await page.fill("input[name='username']", user);
  await page.fill("input[name='password']", pass);
  await page.click("button[type='submit'], input[type='submit']");

  // Wait for login to complete
  await page.waitForTimeout(3000);
}
```

**What it does:**
- ✅ Goes to homepage
- ✅ Clicks "Click to LOG IN Below" button
- ✅ Fills username from `GOVEDIRECTIONS_USER` env variable
- ✅ Fills password from `GOVEDIRECTIONS_PASS` env variable
- ✅ Submits form and waits for authentication

---

### **2. IT CATEGORY FILTERING** (Lines 33-44)

```typescript
async function searchITOpportunities(page: Page) {
  // Wait for industries dropdown
  await page.waitForSelector("select[name='industries[]']");

  // Select "IT: Support Services, Help Desk" option (value="940")
  await page.selectOption("select[name='industries[]']", "940");

  // Click search button
  await page.click("input.btn.btn-primary[type='submit'][value='Search']");

  await page.waitForTimeout(2000);
}
```

**What it does:**
- ✅ Finds industries dropdown: `select[name='industries[]']`
- ✅ Selects option with value `"940"` (IT: Support Services, Help Desk)
- ✅ Clicks search button to filter results
- ✅ Only shows IT-related opportunities

---

### **3. DETAIL PAGE EXTRACTION** (Lines 46-137)

```typescript
async function processDetailPage(detailPage: Page, env) {
  // Extract comprehensive data from detail page

  // Title (from h2)
  const title = titleText.replace(/Save this Bid/g, "").trim();

  // Event Date (closing date)
  const eventDateDd = detailPage.locator('dt:has-text("Event Date:") + dd');
  closingDate = await eventDateDd.innerText();

  // External Links (SAM.gov)
  const linkEl = detailPage.locator(
    'dt:has-text("If online, then documents are here:") + dd a'
  );
  externalLink = await linkEl.getAttribute("href");

  // Description
  const descSection = detailPage.locator(
    'h3:has-text("Summary Information") ~ p'
  );
  description = await descSection.first().innerText();

  // Reference Number
  const refEl = detailPage.locator(
    'dt:has-text("reference for this notice") + dd'
  );
  referenceNum = await refEl.innerText();

  // Agency/Sponsor (Issuer)
  const agencyEl = detailPage.locator(
    'dt:has-text("agency sponsor") + dd a'
  );
  issuer = await agencyEl.innerText();

  // Contact Information
  const contactPhoneEl = detailPage.locator(
    'dt:has-text("Agency Contact Information") + dd'
  );
  contactInfo = await contactPhoneEl.innerText();

  return sol;
}
```

**What it extracts:**
- ✅ **Title** - From `<h2>` tag (cleaned of button text)
- ✅ **Closing Date** - From "Event Date" field
- ✅ **External Links** - SAM.gov URLs for documents
- ✅ **Description** - Summary information section
- ✅ **Reference Number** - Opportunity reference/ID
- ✅ **Issuer** - Agency/sponsor name
- ✅ **Contact Info** - Phone, email, contact person
- ✅ **Site URL** - Detail page URL
- ✅ **Site ID** - Extracted from URL

---

### **4. ENHANCED processRow()** (Lines 139-202)

```typescript
async function processRow(row: Locator, env, context: BrowserContext) {
  // Find link in row
  const siteLink = await row.locator("td:nth-child(1) a[href]").first();

  // Open detail page in new tab (Ctrl+Click)
  const newPagePromise = context.waitForEvent("page");
  await siteLink.click({ modifiers: ["Control"] });
  const detailPage = await newPagePromise;
  await detailPage.waitForLoadState();

  // Extract data from detail page
  const sol = await processDetailPage(detailPage, env);
  await detailPage.close();

  // Check expiration, duplicates, and save
  // ... existing validation logic ...
}
```

**What it does:**
- ✅ Opens each opportunity in a new tab
- ✅ Extracts comprehensive data
- ✅ Closes tab after extraction
- ✅ Continues with validation and saving

---

### **5. UPDATED run() FUNCTION** (Lines 255-307)

```typescript
export async function run(page, env, context) {
  const USER = env.DEV_GOVEDIRECTIONS_USER!;
  const PASS = env.DEV_GOVEDIRECTIONS_PASS!;

  // Validate credentials
  if (!USER) throw new Error("Missing USER environment variable");
  if (!PASS) throw new Error("Missing PASS environment variable");

  // Login first
  await login(page, USER, PASS);

  // Search for IT opportunities
  await searchITOpportunities(page);

  // Scrape all results
  const currSols = await scrapeAllSols(page, {...}, context);

  return results;
}
```

**Execution order:**
1. ✅ Validate credentials exist
2. ✅ Login to govdirections
3. ✅ Filter to IT category (value=940)
4. ✅ Scrape all pages
5. ✅ For each row: open detail page, extract data, close tab
6. ✅ Validate and save to database

---

## Environment Variables Required

Add these to your `.env` file:

```bash
# GovDirections Credentials
GOVEDIRECTIONS_USER=your_username
GOVEDIRECTIONS_PASS=your_password

# Or use DEV_ prefix
DEV_GOVEDIRECTIONS_USER=your_username
DEV_GOVEDIRECTIONS_PASS=your_password
```

**Note:** Variable name is `GOVEDIRECTIONS` (no "N" in middle), not `GOVDIRECTIONS`

---

## Data Fields Extracted

### Before Fix (3 fields):
- title
- location
- closingDate

### After Fix (9 fields):
- ✅ **title** - Opportunity title
- ✅ **description** - Full description from summary
- ✅ **issuer** - Agency/sponsor name
- ✅ **closingDate** - Event/due date
- ✅ **contactInfo** - Phone, email, contact person
- ✅ **externalLinks[]** - Array of SAM.gov URLs
- ✅ **site** - "govdirections"
- ✅ **siteUrl** - Detail page URL
- ✅ **siteId** - "govdirections-{id}"
- ✅ **siteData.referenceNum** - Reference number

---

## Testing the Fixed Scraper

### Run Test File:
```bash
cd functions
npx tsx src/test-govdirections.ts
```

### What You'll See:
```
🚀 Starting govdirections test with Browserbase...
📝 Environment check:
  BASE_URL: https://reconrfp.cendien.com
  SERVICE_KEY: ✓ Set
  GOVEDIRECTIONS_USER: ✓ Set
  GOVEDIRECTIONS_PASS: ✓ Set
  BROWSERBASE_KEY: ✓ Set

🌐 Creating Browserbase session...
✓ Session created: 12345...
📹 Watch live: https://www.browserbase.com/sessions/12345...

[Scraper runs...]

✅ Test completed successfully!
Results: {
  "sols": ["sol_abc123", "sol_def456", ...],
  "counts": {
    "success": 15,
    "fail": 0,
    "dup": 3,
    "junk": 2
  }
}

📹 Review session: https://www.browserbase.com/sessions/12345...
```

### Watch Live:
Click the Browserbase session URL to watch the scraper in real-time:
1. See it login
2. See it select IT category
3. See it open detail pages
4. See data being extracted

---

## Expected Behavior

### Step-by-Step Execution:

**1. Login Phase:**
```
→ Navigate to https://govdirections.com/
→ Click "Click to LOG IN Below" button
→ Fill username field
→ Fill password field
→ Submit form
→ Wait 3 seconds for authentication
```

**2. Search Phase:**
```
→ Wait for industries dropdown
→ Select option value="940" (IT: Support Services, Help Desk)
→ Click "Search" button
→ Wait 2 seconds for results to load
```

**3. Scraping Phase:**
```
For each page:
  → Wait for table#bidTable
  → Find all rows with class containing "Row"
  → For each row:
    → Ctrl+Click to open in new tab
    → Extract: title, date, description, issuer, contact, links
    → Close tab
    → Check expiration
    → Check duplicate in Firestore
    → Save to database if valid
  → Check if 30+ expired (early exit)
  → Click next page button
  → Repeat until no more pages
```

**4. Completion:**
```
→ Log summary: success, fail, duplicates, junk counts
→ Return array of saved solicitation IDs
```

---

## Why This Fixes the "Inactive Source" Issue

### Problem:
- Govdirections was listed as **"Inactive Source"**
- Not being scraped in last 7 days
- Likely returning zero results

### Root Causes Fixed:
1. ✅ **No login** → Now logs in with credentials
2. ✅ **No filtering** → Now filters to IT category only
3. ✅ **Shallow data** → Now extracts comprehensive detail page data
4. ✅ **Wrong selectors** → Updated to match current website structure
5. ✅ **Missing credentials** → Added credential validation

### Expected Improvements:
- 🎯 **Access to logged-in content** → More opportunities visible
- 🎯 **Relevant results** → Only IT opportunities (category 940)
- 🎯 **Better data quality** → Descriptions, links, contact info
- 🎯 **Higher match rate** → More fields for duplicate detection
- 🎯 **Consistent scraping** → Proper authentication prevents blocks

---

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Login** | ❌ No | ✅ Yes |
| **Category Filter** | ❌ No | ✅ IT: Support Services (940) |
| **Detail Pages** | ❌ No | ✅ Opens each in new tab |
| **Data Fields** | 3 fields | 9 fields |
| **External Links** | ❌ No | ✅ SAM.gov URLs |
| **Description** | ❌ No | ✅ Full summary |
| **Issuer** | ❌ No | ✅ Agency name |
| **Contact Info** | ❌ No | ✅ Phone, email |
| **Reference Number** | ❌ No | ✅ Yes |
| **Data Quality** | 🔴 Low | 🟢 High |
| **Match Rate** | 🔴 Low | 🟢 High |

---

## HTML Selectors Used

### Login Page:
```css
.btn.btn-default a[href='/users/login']  /* Login button */
input[name='username']                    /* Username field */
input[name='password']                    /* Password field */
button[type='submit']                     /* Submit button */
```

### Search Page:
```css
select[name='industries[]']                              /* Industries dropdown */
input.btn.btn-primary[type='submit'][value='Search']    /* Search button */
```

### List Page:
```css
table#bidTable                          /* Results table */
tbody tr[class*='Row']                  /* Table rows */
td:nth-child(1) a[href]                /* Opportunity link */
```

### Detail Page:
```css
h2                                                              /* Title */
dt:has-text("Event Date:") + dd                                /* Closing date */
dt:has-text("If online, then documents are here:") + dd a     /* External link */
h3:has-text("Summary Information") ~ p                        /* Description */
dt:has-text("reference for this notice") + dd                 /* Reference # */
dt:has-text("agency sponsor") + dd a                          /* Issuer */
dt:has-text("Agency Contact Information") + dd                /* Contact info */
```

---

## Troubleshooting

### Issue: Login fails
**Check:**
- Credentials are correct in `.env` file
- Variable name is `GOVEDIRECTIONS_USER` (no "N")
- Login button selector still matches: `.btn.btn-default a[href='/users/login']`

### Issue: No results after search
**Check:**
- IT category option value is still "940"
- Search button selector matches: `input[type='submit'][value='Search']`
- Website didn't change category values

### Issue: Detail pages not opening
**Check:**
- Link selector matches: `td:nth-child(1) a[href]`
- Ctrl+Click is working in Browserbase
- Detail pages load successfully

### Issue: Missing data fields
**Check:**
- Detail page HTML structure hasn't changed
- Selectors for `dt`/`dd` pairs still match
- `has-text()` locators match current text

---

## Next Steps

1. ✅ **Test the scraper** with `npx tsx src/test-govdirections.ts`
2. ✅ **Watch Browserbase session** to verify each step
3. ✅ **Check database** for new govdirections solicitations
4. ✅ **Verify data quality** - descriptions, links, contact info present
5. ✅ **Monitor in production** - should no longer be "inactive"

---

## Success Metrics

After deployment, you should see:

- 🎯 **Govdirections appears in "active sources"**
- 🎯 **Solicitations scraped in last 7 days > 0**
- 🎯 **Higher success count** (more valid opportunities)
- 🎯 **Lower junk count** (better filtering to IT category)
- 🎯 **Richer data** (descriptions, external links, contacts filled in)
- 🎯 **Better duplicate detection** (more fields to match on)

---

## Files Modified

1. ✅ `functions/src/playwright/rfpSearch/govdirections/sols.ts` - Main scraper
2. ✅ `functions/src/test-govdirections.ts` - Test file (updated env vars)

---

## Summary

The govdirections scraper is now a **comprehensive, authenticated scraper** that:
- ✅ Logs in with credentials
- ✅ Filters to IT category only
- ✅ Extracts detailed information from each opportunity
- ✅ Saves rich data for better matching and user experience

This should resolve the "inactive source" issue and provide much better data quality.
