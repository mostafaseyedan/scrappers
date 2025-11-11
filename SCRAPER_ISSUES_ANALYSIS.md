# Scraper Issues Analysis

## Overview
This document provides an analysis of the reported scraper issues and the potential causes for zero-result scrapers and inactive sources.

## Scraper Issues (Zero Results)

### 1. findrfp (functions/src/playwright/rfpSearch/findrfp/sols.ts)

**Potential Issues:**
- **Login credentials**: Lines 17-32 show login functionality that requires valid credentials (DEV_FINDRFP_USER and DEV_FINDRFP_PASS)
- **Page structure changes**: Uses specific selectors like `input#txtLogin`, `input#txtPassword`, `#btnLogin` which may have changed
- **Search results selector**: Lines 129-135 wait for `table.SectionContentBlack tbody tr:not(tr.SectionContentBlack)` which might not exist anymore
- **Timeout issues**: Uses `waitForTimeout(5000)` which may not be sufficient

**Recommendations:**
- Verify login credentials are still valid
- Check if the website has updated its HTML structure
- Test using the new test file: `functions/src/test-findrfp.ts`
- Increase timeout values if needed
- Add better error logging to identify exact failure point

### 2. merx (functions/src/playwright/rfpSearch/merx/sols.ts)

**Potential Issues:**
- **Login flow**: Lines 13-28 require valid credentials
- **Cookie banner**: Lines 120-123 try to handle cookie banner - this might be blocking the flow
- **Search table selector**: Line 118 waits for `#solicitationsTable` which might have changed
- **Pagination changes**: Lines 151-159 use `.mets-pagination-page-icon.next` selector which might be outdated

**Recommendations:**
- Verify MERX credentials are valid
- Check if cookie banner handling is working correctly
- Test with `functions/src/test-merx.ts`
- Verify pagination selectors are still correct
- Add screenshots on failure for debugging

### 3. vendorline (functions/src/playwright/rfpSearch/vendorline/sols.ts)

**Potential Issues:**
- **Login button selector**: Line 23 uses `button.btn-primary.close-login` which may have changed
- **No wait after login**: Line 24 doesn't wait after clicking login button
- **Reload strategy**: Lines 123-124 reload the page which might cause issues
- **Limited iteration**: Lines 141-158 only iterate through 100 records with fixed loop
- **Complex selectors**: Uses `.MuiDataGrid-virtualScrollerRenderZone` which is MUI-specific and version-dependent

**Recommendations:**
- Add explicit wait after login
- Verify MUI component selectors haven't changed with library updates
- Test with `functions/src/test-vendorline.ts`
- Add error handling for the reload operation
- Consider dynamic iteration instead of fixed 100 records

## Inactive Sources (Not Scraped in 7 Days)

### 1. bidmain (functions/src/aiPrompts/rfpSearch/bidmain.ts)

**Status:** Uses AI prompts instead of Playwright automation

**Issues:**
- This is not a traditional scraper - it's an AI prompt configuration
- May not be integrated into the automated scraping pipeline
- No test file exists for this source

**Recommendations:**
- Check if this scraper is actually scheduled to run
- Verify the AI scraping system is operational
- May need different testing approach than other scrapers

### 2. highergov (functions/src/playwright/rfpSearch/highergov/sols.ts)

**Potential Issues:**
- **Login wait**: Line 24 uses `waitForEvent("domcontentloaded")` which might not be reliable
- **Search selector**: Lines 91-95 use `#free_text` for search which might have changed
- **Table selector**: Line 95 waits for specific table row `#datatable_search_contract_opportunity tbody tr.odd`
- **Single row check**: Lines 105-108 consider a single row as "last page" which might be incorrect

**Recommendations:**
- Add more robust wait conditions after login
- Test with `functions/src/test-highergov.ts`
- Verify search functionality is still working
- Add better detection for empty results vs. single result row

### 3. omniapartners (functions/src/playwright/rfpSearch/omniapartners/sols.ts)

**Note:** The folder name is "omniapartners" but the issue mentions "omniqpartners" - verify the correct name.

**Potential Issues:**
- **No login required**: This scraper doesn't require authentication
- **Complex selector**: Line 88 uses `[id^='hs_cos_wrapper_module_']` which is a HubSpot-specific selector
- **Early termination**: Lines 103-108 stop after only 3 expired or 3 duplicates
- **Brittle regex**: Lines 29-35 use complex regex for parsing content

**Recommendations:**
- Test with `functions/src/test-omniapartners.ts`
- Verify HubSpot page structure hasn't changed
- Consider increasing the threshold for early termination
- Add logging to see if any rows are being found

### 4. techbids (functions/src/playwright/rfpSearch/techbids/sols.ts)

**Potential Issues:**
- **Login selector**: Line 23 uses `button:has-text('Sign In to Your Account')` which is text-dependent
- **Year calculation**: Lines 30-32, 66-67 append current year to dates which might cause issues
- **Dashboard wait**: Line 129 waits for `.sticky + .mt-0.hidden.px-0` - very specific Tailwind CSS selector
- **Limited pages**: Line 123 has maxPage = 20 limit

**Recommendations:**
- Use more robust selectors instead of text-based ones
- Test with `functions/src/test-techbids.ts`
- Verify date parsing logic is correct
- Check if dashboard structure has changed
- Consider removing or increasing the page limit

## Common Issues Across All Scrapers

1. **Hard-coded selectors**: All scrapers use CSS selectors that can break when websites update
2. **Insufficient error handling**: Many scrapers don't capture screenshots or detailed errors on failure
3. **Timeout values**: Fixed timeout values might not work for slower connections
4. **Credentials**: Many issues likely stem from expired or invalid login credentials
5. **Anti-bot measures**: Websites may have added CAPTCHAs or other anti-scraping measures

## Testing Instructions

All test files have been created following the pattern from `test-bonfirehub.ts`:

### Test Files Created:
- test-biddirect.ts
- test-bidsync.ts
- test-cammnet.ts
- test-commbuys.ts
- test-demandstar.ts
- test-findrfp.ts
- test-floridabids.ts
- test-govdirections.ts
- test-governmentbidders.ts
- test-highergov.ts
- test-instantmarkets.ts
- test-merx.ts
- test-mygovwatch.ts
- test-omniapartners.ts
- test-publicpurchase.ts
- test-rfpmart.ts
- test-techbids.ts
- test-txsmartbuy.ts
- test-vendorline.ts
- test-vendorlink.ts
- test-vendorregistry.ts

### How to Run Tests:

1. **Set up environment variables** in `/home/mohammad_alsayyedan/Recon/recon/.env`:
   ```
   BASE_URL=https://reconrfp.cendien.com
   SERVICE_KEY=your_service_key
   BROWSERBASE_KEY=your_browserbase_key

   # Scraper-specific credentials
   FINDRFP_USER=your_username
   FINDRFP_PASS=your_password
   MERX_USER=your_username
   MERX_PASS=your_password
   # ... etc for each scraper
   ```

2. **Run a specific test**:
   ```bash
   cd functions
   npx tsx src/test-findrfp.ts
   ```

3. **Watch the scraper live**:
   - Each test outputs a Browserbase session URL
   - Open the URL in your browser to watch the scraper in real-time
   - This is invaluable for debugging selector issues

4. **Review session recordings**:
   - After the test completes, you can review the session recording
   - This helps identify exactly where the scraper failed

## Next Steps

1. **Test problematic scrapers**: Run test files for findrfp, merx, vendorline, highergov, omniapartners, and techbids
2. **Review Browserbase sessions**: Watch the recordings to identify exact failure points
3. **Update selectors**: Based on session recordings, update selectors that no longer match
4. **Verify credentials**: Ensure all login credentials are current and valid
5. **Add monitoring**: Consider adding automated alerts when scrapers return zero results
6. **Implement retry logic**: Add exponential backoff for transient failures
7. **Add health checks**: Create a monitoring system to track scraper success rates
8. **Update error handling**: Capture screenshots and page HTML on failures for debugging

## Environment Variable Requirements

Each scraper may require different environment variables. Here's a summary:

**Required for all scrapers:**
- BASE_URL
- SERVICE_KEY (or DEV_SERVICE_KEY)
- BROWSERBASE_KEY (or DEV_BROWSERBASE_KEY)

**Scrapers requiring login credentials:**
- findrfp: FINDRFP_USER, FINDRFP_PASS
- merx: MERX_USER, MERX_PASS
- vendorline: VENDORLINE_USER, VENDORLINE_PASS
- highergov: HIGHERGOV_USER, HIGHERGOV_PASS
- techbids: TECHBIDS_USER, TECHBIDS_PASS
- biddirect: BIDDIRECT_USER, BIDDIRECT_PASS
- bidsync: BIDSYNC_USER, BIDSYNC_PASS
- demandstar: DEMANDSTAR_USER, DEMANDSTAR_PASS
- govdirections: GOVDIRECTIONS_USER, GOVDIRECTIONS_PASS
- governmentbidders: GOVERNMENTBIDDERS_USER, GOVERNMENTBIDDERS_PASS
- instantmarkets: INSTANTMARKETS_USER, INSTANTMARKETS_PASS
- mygovwatch: MYGOVWATCH_USER, MYGOVWATCH_PASS
- publicpurchase: PUBLICPURCHASE_USER, PUBLICPURCHASE_PASS
- rfpmart: RFPMART_USER, RFPMART_PASS
- vendorlink: VENDORLINK_USER, VENDORLINK_PASS
- vendorregistry: VENDORREGISTRY_USER, VENDORREGISTRY_PASS
- bonfirehub: BONFIRE_USER, BONFIRE_PASS

**Scrapers NOT requiring login:**
- cammnet
- commbuys
- floridabids
- omniapartners
- txsmartbuy
