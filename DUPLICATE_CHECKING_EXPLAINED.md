# Duplicate Checking in Cloud Scrapers

## Quick Answers

**Q1: Do scrapers check for duplicates before saving solicitations?**
✅ **YES** - All cloud scrapers check for duplicates before saving.

**Q2: When checking for duplicates, do they use Firestore or Algolia?**
🔥 **Firestore** - Duplicate checking queries Firestore directly, NOT Algolia.

---

## How Duplicate Checking Works

### 1. The Check Happens BEFORE Saving

Every cloud scraper follows this sequence:

```typescript
// functions/src/playwright/rfpSearch/findrfp/sols.ts:83-107

// Step 1: Check if it's a duplicate (line 83)
const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY);

// Step 2: If duplicate, skip and count it (lines 89-92)
if (isDup) {
  dupCount++;
  return false;  // Don't save
}

// Step 3: Only if NOT duplicate, save to database (lines 94-103)
const newRecord = await solModel.post({
  baseUrl: env.BASE_URL,
  data: sol,
  token: env.SERVICE_KEY,
});
```

### 2. The Duplicate Check Implementation

Located in `functions/src/lib/script.ts:28-39`:

```typescript
export async function isSolDuplicate(
  sol: Record<string, any>,
  baseUrl: string,
  serviceKey: string
) {
  const respCheck = await solModel.get({
    baseUrl,
    filters: { siteId: sol.siteId },
    token: serviceKey,
  });
  return respCheck.results?.length > 0;
}
```

**Key Point:** It queries by `siteId` field to find existing solicitations.

### 3. The Query Goes to Firestore

When `solModel.get()` is called, it makes an HTTP request:

```typescript
// app/models.ts:146-160
const resp = await fetch(
  `${baseUrl || ""}/api/solicitations?filters.siteId=${sol.siteId}`,
  {
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

This hits the API endpoint at `app/api/solicitations/route.ts`:

```typescript
// app/api/solicitations/route.ts:14-53
export async function GET(req: NextRequest) {
  // ...

  // Fetch records from Firestore (line 24)
  const records = await fireGet(COLLECTION, queryOptions);

  return NextResponse.json({
    total: totalCount,
    count: filteredRecords.length,
    results: filteredRecords,
  });
}
```

**Conclusion:** The GET request queries **Firestore**, not Algolia.

---

## Database Architecture

### Two Databases in Parallel

```
┌─────────────┐
│   SCRAPER   │
└──────┬──────┘
       │
       │ 1. Check for duplicates
       ├─────────────────────────────┐
       │                             │
       ▼                             ▼
  ┌─────────┐                  ┌──────────┐
  │ Firestore│ ◄──── Query ────│ isSolDup │
  │ (Primary)│                  └──────────┘
  └─────────┘
       │
       │ If NOT duplicate:
       │
       │ 2. Save solicitation
       ├─────────────────────────────┐
       │                             │
       ▼                             ▼
  ┌─────────┐                  ┌──────────┐
  │ Firestore│ ◄──── POST ──────│ solModel │
  │  (Save)  │                  └──────────┘
  └────┬─────┘
       │
       │ 3. Sync to Algolia
       ▼
  ┌─────────┐
  │ Algolia  │ ◄──── POST ──────
  │  (Sync)  │
  └─────────┘
```

### Role of Each Database

**Firestore (Primary Database)**
- Source of truth for all solicitations
- Used for duplicate checking (by `siteId`)
- Used for structured queries and filters
- Updated first during POST operations
- Location: `app/api/solicitations/route.ts:24`

**Algolia (Search Index)**
- Secondary database for full-text search
- Used ONLY for search queries (user searches in UI)
- Synced from Firestore after save
- NOT used for duplicate checking
- Location: `app/api/solicitations/route.ts:71`

---

## Save Operation Flow

When a scraper saves a solicitation:

### Step 1: POST to API
```typescript
// Scraper calls
await solModel.post({
  baseUrl: env.BASE_URL,
  data: sol,
  token: env.SERVICE_KEY,
});
```

### Step 2: API Saves to Firestore First
```typescript
// app/api/solicitations/route.ts:70
const fireDoc = await firePost(COLLECTION, parsedData);
```

### Step 3: API Syncs to Algolia
```typescript
// app/api/solicitations/route.ts:71
await algoliaPost(COLLECTION, fireDoc.id, fireToJs(fireDoc));
```

**Important:** If Algolia sync fails, the solicitation is still saved in Firestore. Algolia is a secondary concern.

---

## Why Firestore for Duplicate Checking?

### Reasons Firestore is Used (Not Algolia):

1. **Accuracy**: Firestore is the source of truth
   - Algolia might have sync delays
   - Firestore is always up-to-date

2. **Query by siteId**: Simple exact match query
   - `filters: { siteId: sol.siteId }`
   - Firestore is optimized for this
   - No need for full-text search capabilities

3. **Consistency**: POST writes to Firestore first
   - Check and write use same database
   - Avoids race conditions

4. **Reliability**: Algolia is optional
   - If Algolia is down, scraping continues
   - Firestore is critical infrastructure

---

## Performance Implications

### Duplicate Check Performance

For each scraped solicitation:
1. **HTTP request** to API endpoint
2. **Firestore query** by siteId (indexed field)
3. **Response** with results array

**Cost:**
- ~50-100ms per duplicate check
- One Firestore read operation per check
- Counts toward Firestore read quota

### Optimization Opportunities

Current code checks duplicates **one at a time**:
```typescript
for (let i = 0; i < rowCount; i++) {
  const sol = await processSol(row, env, context);  // Sequential
  // Each processSol calls isSolDuplicate
}
```

**Potential improvement**: Batch duplicate checking
- Collect all siteIds from a page
- Query Firestore once for all siteIds
- Filter duplicates in memory
- Could reduce Firestore reads by 10-20x per page

---

## Search vs Duplicate Check

### Different Endpoints, Different Databases

**Duplicate Check:**
```
GET /api/solicitations?filters.siteId=xyz123
  → Queries Firestore
  → Returns exact matches
  → Used by scrapers
```

**User Search:**
```
GET /api/solicitations/search?q=software&filters.site=findrfp
  → Queries Algolia (line 46 in search/route.ts)
  → Full-text search with ranking
  → Used by web UI
```

### Why Two Different Endpoints?

Located in:
- `app/api/solicitations/route.ts` - Firestore queries
- `app/api/solicitations/search/route.ts` - Algolia queries

**Benefits:**
- Firestore: Fast exact lookups (duplicate checking)
- Algolia: Advanced text search (user queries)
- Each database optimized for its use case

---

## All Scrapers Use Same Logic

All 22 cloud scrapers import and use the same duplicate checking function:

```typescript
// Every scraper has this import:
import { isSolDuplicate } from "../../../lib/script";

// And uses it the same way:
const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY);
if (isDup) {
  dupCount++;
  return false;
}
```

**Scrapers using this:**
- biddirect, bidsync, bonfirehub, cammnet, commbuys
- demandstar, findrfp, floridabids, govdirections, governmentbidders
- highergov, instantmarkets, merx, mygovwatch, omniapartners
- publicpurchase, rfpmart, techbids, txsmartbuy, vendorline
- vendorlink, vendorregistry

---

## Example: Full Flow for findrfp Scraper

### 1. Scraper Finds New Solicitation
```typescript
// findrfp/sols.ts:62-71
const sol = {
  title: await siteLink.innerText(),
  issuer: issuer.trim(),
  location,
  externalLinks: sourceLink ? [sourceLink] : [],
  publishDate: sanitizeDateString(publishDate),
  site: "findrfp",
  siteUrl: "https://www.findrfp.com/service/" + siteUrl,
  siteId,  // e.g., "findrfp-ABC123"
}
```

### 2. Check Expiration
```typescript
// findrfp/sols.ts:73-81
if (sol.closingDate && !isNotExpired(sol)) {
  expiredCount++;
  return false;
}
```

### 3. Check Duplicate (FIRESTORE)
```typescript
// findrfp/sols.ts:83-92
const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY);
  ↓
// Makes request to: GET /api/solicitations?filters.siteId=findrfp-ABC123
  ↓
// API queries Firestore
const records = await fireGet("solicitations", { filters: { siteId: "findrfp-ABC123" } });
  ↓
// Returns: { results: [existing_solicitation] } or { results: [] }
  ↓
if (isDup) {
  dupCount++;
  return false;  // Don't save
}
```

### 4. If Not Duplicate, Save (FIRESTORE + ALGOLIA)
```typescript
// findrfp/sols.ts:94-103
const newRecord = await solModel.post({
  baseUrl: env.BASE_URL,
  data: sol,
  token: env.SERVICE_KEY,
});
  ↓
// API saves to Firestore first
const fireDoc = await firePost("solicitations", sol);
  ↓
// Then syncs to Algolia
await algoliaPost("solicitations", fireDoc.id, fireDoc);
  ↓
successCount++;
```

---

## Summary

### Duplicate Checking:
✅ **Happens before saving** - Every solicitation checked
✅ **Uses Firestore** - Not Algolia
✅ **Queries by siteId** - Exact match lookup
✅ **Prevents duplicates** - Skips and counts them

### Database Roles:
🔥 **Firestore** - Primary database, duplicate checking, structured queries
🔍 **Algolia** - Secondary index, full-text search, user queries only

### Architecture:
📊 **Check** → Firestore (GET /api/solicitations)
💾 **Save** → Firestore → Algolia (POST /api/solicitations)
🔎 **Search** → Algolia (GET /api/solicitations/search)

---

## Code Locations Reference

| Component | File Path | Lines |
|-----------|-----------|-------|
| Duplicate check function | `functions/src/lib/script.ts` | 28-39 |
| Scraper usage example | `functions/src/playwright/rfpSearch/findrfp/sols.ts` | 83-92 |
| Solicitation model | `app/models.ts` | 377-540 |
| API GET endpoint | `app/api/solicitations/route.ts` | 14-53 |
| API POST endpoint | `app/api/solicitations/route.ts` | 55-82 |
| Search endpoint (Algolia) | `app/api/solicitations/search/route.ts` | 10-62 |
| Algolia sync function | `lib/algolia.ts` | 35-44 |
| Firestore GET function | `au/server/firebase` | (imported) |
| Firestore POST function | `au/server/firebase` | (imported) |
