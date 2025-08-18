export default `
VendorRegistry

Objective
• Log in to https://www.vendorregistry.com and find active/upcoming (future, not expired) RFPs in the USA related to ERP and IT services. Extract structured data as JSON.

Authentication
• Credentials (use securely; prefer secret variables if available):
	– user: vendor@cendien.com
	– pass: 3620NJoseyLn!

Scope & Filters
• Geography: United States only.
• Timing: Only opportunities with a future closing date (strictly greater than “now” at runtime). Exclude past/expired/cancelled.
• Categories/Keywords (match any; prioritize exact matches in title/description):
	– ERP Consulting, ERP Upgrades, ERP Implementation, ERP Migration, ERP Integration
	– Infor Support, Infor Consulting, Infor Managed Services, Infor CloudSuite Implementation, CloudSuite Implementation
	– Lawson Consulting, Lawson Managed Services
	– Workday HCM, Workday Migration
	– PeopleSoft Services, PeopleSoft Migration, PeopleSoft Support
	– Oracle ERP, Oracle Support, Oracle Database Managed Services
	– IT Staffing, IT Services, IT Support, Information Technology Consulting, Managed IT Services
	– System Modernization

Core Workflow
1) Search web for opportunities/bids search/browse page.
2) For each keyword above:
	 • Run a search (try both singular/plural and common synonyms where applicable).
	 • Apply filters for “Active/Upcoming” and the USA if available.
	 • Sort by closing date ascending, then iterate results.
3) For each result detail page, extract fields (see Data Extraction). Skip if closing date is missing or in the past.
4) Deduplicate across keywords using the tuple: [title, issuer, closingDate].

Resilience & Error Handling
• Handle cookie banners, pop-ups, and consent prompts by accepting/dismissing to proceed.
• If a search yields no results, continue to the next keyword automatically.
• Retry transient actions (navigation, page load, extraction) up to 2 times with exponential backoff.
• If the detail page link cannot be reliably retrieved, leave siteUrl blank and continue.
• If a field is missing, leave it blank except for required derived fields (site, extractedDate).

Data Extraction (per opportunity)
• title: The RFP title as shown on the detail page.
• description: 1–3 brief sentences summarizing the scope and buyer needs.
• closingDate: Bid deadline in ISO 8601 (use site timezone if available, else local time). Must be future.
• issuer: Agency or issuing organization name.
• location: City/County/State as listed (or State if only that is available).
• siteId: Prefer an explicit ID on the page. Else, use the last meaningful path segment of the detail URL (e.g., the GUID-like token). If neither exists, use a stable hash of [title + issuer + closingDate].
• siteUrl: Direct detail page URL (leave blank if not retrievable).
• contactInfo: Any listed emails and/or phone numbers (comma-separated). Scan the description and contact sections.
• externalLinks: Any external or referenced links (comma-separated), including the issuer’s procurement page if present.
• extractedDate: Current timestamp in ISO 8601.

Output Targets
• Output as JSON

Output Schema (columns in order)
1) title
2) description
3) closingDate
4) issuer
5) location
6) siteId
7) site
8) siteUrl
9) contactInfo
10) externalLinks
11) extractedDate

Quality & Compliance
• Throttle requests to be polite (e.g., ~1–2 pages/sec; add random jitter).
• Validate closingDate > now; discard otherwise.
• Limit total processed results to a reasonable cap (e.g., first 200 unique matches) to avoid runaway loops.
• Only output JSON at the end.

Notes
• If multiple closing dates are shown, choose the main bid submission deadline (not questions or pre-bid dates).
• Prefer issuer’s legal/procurement name rather than a platform alias.
• Keep descriptions concise; avoid copying large blocks verbatim.
`;
