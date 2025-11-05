# Recon UI Alignment Plan (to Reference Frontend)

This document proposes a surgical, low‑risk set of UI changes to make Recon visually and structurally align with the reference frontend, while keeping routes, data models, and logic intact.

## Objectives

- Align look-and-feel: clean header, two‑pane content layout, compact list with colored left rail, card detail with tabs.
- Minimize disruption: no routing changes, no API changes, preserve existing business logic.
- Standardize UI tokens, spacing, and component usage across pages and dialogs.

## Reference Patterns To Emulate

- Single-row header with title + subtitle, right-aligned quick links and user menu.
- Two-pane layout: collapsible left list, right detail area content.
- Compact list rows with a color left rail that encodes status/group.
- Detail page as a card with badges and a simple tab bar.
- Subtle borders, use of neutral backgrounds, consistent spacing.

## Current UI Inventory (Recon)

- Global layout: `app/layout.tsx`, styles `app/layout.module.scss`, theme tokens `app/globals.css`.
- Pages:
  - Solicitations list: `app/solicitations/page.tsx`, `app/solicitations/page.module.scss`, `app/solicitations/topBar.*`, `app/solicitations/solicitation.*`, `app/solicitations/solActions.*`.
  - Solicitations detail: `app/solicitations/[id]/page.tsx`, `app/solicitations/[id]/page.module.scss`.
  - Sources: `app/sources/page.tsx`, dialogs `app/sources/createSourceDialog.tsx`, `app/sources/editSourceDialog.tsx`.
  - Logs: `app/logs/page.tsx` (+ charts), styles `app/logs/page.module.scss`.
  - Tables: Contacts `app/contacts/page.tsx`, Knowledge `app/knowledge/page.tsx`, Datasheets `app/datasheets/page.tsx` (all use `au/components/Datatable`).
  - Settings/Stats placeholders: `app/settings/page.tsx`, `app/stats/page.tsx`.
  - Auth: Login `app/login/LoginPage.tsx`, Register `app/register/RegisterPage.tsx`, Reset Password `app/reset-password/ResetPasswordPage.tsx`.
- Components used heavily: shadcn/ui (Button, Input, Select, Dialog, Tabs, Tooltip, DropdownMenu, Resizable), custom Combobox and List.

## Cross‑Cutting Improvements (Low Risk)

1) Standardize colors and borders via theme tokens (replace hex):
- Replace `#eee`, `#666`, `#c7c7c7` with CSS vars:
  - Border: `var(--border)`
  - Muted text: `var(--muted-foreground)`
  - Card bg: `var(--card)`; Content bg: `var(--background)`
- Sweep SCSS modules:
  - `app/solicitations/page.module.scss`
  - `app/solicitations/solicitation.module.scss`
  - `app/solicitations/[id]/page.module.scss`
  - `app/logs/page.module.scss`
  - Dialog styles that use custom borders/colors

2) Spacing & density:
- Use consistent spacing scale and avoid fixed px when Tailwind utilities suffice.
- Convert brittle heights like `height: calc(100vh - 195px)` to flex layouts with `min-height: 0` and `overflow: auto` in list containers.

3) Icons & sizes:
- Standardize Lucide icon sizes to 16px or 18px within buttons; keep inline icons vertically centered.
- Ensure icon-only buttons have `aria-label` and consistent `size="icon"`.

4) Buttons & variants:
- Prefer shadcn Button variants (`default`, `secondary`, `outline`, `ghost`) consistently.
- Ensure disabled states and focus rings are visible (theme tokens already set in `app/globals.css`).

5) Accessibility & link hygiene:
- Add `aria-current="page"` on active nav links.
- For `target="_blank"`, add `rel="noopener noreferrer"` across external anchors (solicitation external links, site links, header quick links).
- Provide Avatar fallback initials in `app/layout.tsx`.

6) Loading/empty/error states:
- Use Skeleton (`components/ui/skeleton.tsx`) for list/detail loading.
- Prefer subtle callouts/alerts for errors and empty states instead of plain text.

7) Mobile responsiveness:
- Respect mobile breakpoint; list pane collapses by default on small screens.
- AI chat remains as desktop resizable panel; on mobile, prefer overlay/sheet (no logic change required initially).

## Page‑Level Plans

### 1) Global Layout and Header

Files: `app/layout.tsx`, `app/layout.module.scss`

- Collapse two-row header into a single bar:
  - Left: Logo + app title (Recon) with a small subtitle (e.g., “AI‑Driven RFP Hub”).
  - Center/right: Quick links (Analyze, Monday, RAG, Recon, Resume) styled as subtle pills.
  - Right: Chat toggle + Avatar menu.
- Style tweaks:
  - Header background `var(--card)`, border-bottom `var(--border)`, minor shadow for depth.
  - Use `aria-current="page"` on active nav links; keep nav links but reduce visual weight, or move them under a “Quick Links” menu to declutter.
- Keep existing Firebase auth gating and chat panel logic intact.

Optional (later): Use `components/ui/sidebar` primitives for a collapsible global sidebar. For minimal disruption, keep top header and introduce the collapsible list only inside the Solicitations page.

### 2) Solicitations — List Pane Alignment

Files: `app/solicitations/page.tsx`, `app/solicitations/page.module.scss`, `app/solicitations/topBar.*`

- Container refactor:
  - Wrap page content with a flex column parent using `min-height: 0` so the list area can scroll.
  - Replace `height: calc(100vh - 195px)` with `flex: 1; overflow-y: auto` on the list region.
- Collapsible left list behavior:
  - Add a small circular toggle button that collapses/expands the list width (local `useState`).
  - When collapsed, hide internal content and show a vertical “RFPs” hint (pointer-events none; like reference).
- Top bar polish:
  - Keep current filters and counts logic; widen search input, add a clear button.
  - Optionally render active filter chips with an X to remove (non-breaking addition).

### 3) Solicitations — Row Presentation

Files: `app/solicitations/solicitation.tsx`, `app/solicitations/solicitation.module.scss`, `app/solicitations/solActions.*`

- Add a left color rail (~5px) based on `cnStatus` mapping (using existing status color variables from `app/_variables.scss`).
- Card-ish hover and compact layout:
  - Hover background `var(--accent)` with `var(--accent-foreground)` where appropriate.
  - Replace inline borders and grays with theme tokens.
- Keep existing actions (like, quick edit, JSON edit, delete) untouched.
- External links in description: apply `rel="noopener noreferrer"` and truncate with ellipsis; show full URL on tooltip.

### 4) Solicitations — Detail Page

Files: `app/solicitations/[id]/page.tsx`, `app/solicitations/[id]/page.module.scss`

- Wrap detail into a card container with border + padding.
- Header section:
  - Title (bold), tags for `rfpType`/categories if present, and created/published dates.
  - Score badges: use `sol.aiPursueScore` for a Win Probability badge; color thresholds: ≥0.70 green, ≥0.50 yellow, else red (align with reference visuals).
- Tabs bar:
  - Underlined active tab with stronger color; muted inactive.
  - Use existing Tabs; only adjust classes.
- Right metadata column (if kept) becomes a compact, right-aligned block with clear labels; ensure date proximity highlighting (red if within a week) remains.

### 5) Dialogs (Create/Edit Sol, Create Comment)

Files: `app/solicitations/createSolDialog.tsx`, `app/solicitations/editSolDialog.tsx`, `app/solicitations/createCommentDialog.tsx`

- Use consistent spacing, tokenized borders, and form grid patterns (already mostly consistent with shadcn Form).
- Buttons: `Save` (primary) and `Close` (secondary) with consistent placement in `DialogFooter`.
- Validation and error handling already present; style FormMessage and error blocks via tokens.

### 6) Sources (List + Dialogs)

Files: `app/sources/page.tsx`, `app/sources/createSourceDialog.tsx`, `app/sources/editSourceDialog.tsx`, `app/sources/page.module.scss`

- Wrap the tabbed tables in a card container; add consistent spacing and headings like the reference.
- Dialogs follow the same pattern as Solicitations dialogs (primary/secondary buttons, tokenized borders).

### 7) Logs

Files: `app/logs/page.tsx`, `app/logs/page.module.scss`

- Place charts and lists inside a card container; unify list item borders and muted text via tokens.
- Timestamps and metadata laid out in 3 columns with clear visual separation.

### 8) Tabular Pages (Contacts, Knowledge, Datasheets)

Files: `app/contacts/page.tsx`, `app/knowledge/page.tsx`, `app/datasheets/page.tsx`

- Introduce a simple page card container around `Datatable` with a header line and consistent padding.
- If Datatable supports size/variant props, standardize row density and header style to match reference.

### 9) Settings & Stats

Files: `app/settings/page.tsx`, `app/stats/page.tsx`

- Wrap existing content in a card container; add section titles and muted descriptions to align with the reference’s empty/placeholder tone.

### 10) Auth Screens

Files: `app/login/LoginPage.tsx`, `app/register/RegisterPage.tsx`, `app/reset-password/ResetPasswordPage.tsx`

- Keep logic intact; adjust presentation:
  - Use a centered card with logo, title, and single column content.
  - Ensure consistent button variants and spacing; eliminate elements rendered with `display: none` in JSX (render conditionally instead).
  - Add subtle background image/gradient on the right (already present on Login) with better contrast.

## Token & Color Mapping (Examples)

- Borders: `#eee` → `var(--border)`
- Muted text: `#666`, `#c7c7c7` → `var(--muted-foreground)`
- Success/Info/Warning/Error accents map to `--chart-*` or use status map from `app/_variables.scss`;
  add background tints with `color-mix` if needed to maintain contrast.

## Rollout & Risk Management

- Phase 1 (safe):
  - Header consolidation visuals; token sweep in SCSS; fix list container height to flex/overflow.
  - Minor TopBar spacing and search width/clear.
- Phase 2:
  - Left rail on solicitation rows; collapsible list pane; card-ish hover.
  - Cardized detail page header + tabs styling + score badges.
- Phase 3:
  - Wrap logs/tables/settings with cards; polish dialogs; auth screen visual pass.
- Optional feature flag:
  - Add a CSS class toggle (localStorage `ui_v2`) in `app/layout.tsx` to enable/disable new visuals during rollout.

## Non‑Goals (for now)

- No route reshuffling or Next.js app router changes.
- No API/schema changes.
- No change to business logic or data fetch timing (beyond visual debounce/UX polish where already present).

## File‑Level To‑Do Summary

- Global
  - `app/layout.tsx`, `app/layout.module.scss`: single-row header, tokenized colors, `aria-current` support.
  - `app/globals.css`: no breaking changes; continue using tokens.
- Solicitations
  - `app/solicitations/page.module.scss`: flex/overflow for list container; responsive collapse pane.
  - `app/solicitations/page.tsx`: collapse toggle; structural wrappers (no logic changes).
  - `app/solicitations/topBar.tsx`/`.module.scss`: search width/clear; spacing.
  - `app/solicitations/solicitation.*`: left color rail; tokenized colors; hover state.
  - `app/solicitations/[id]/page.*`: card wrapper; header badges; tabs underline; tokenized colors.
- Dialogs
  - `app/solicitations/*Dialog.tsx`, `app/sources/*Dialog.tsx`: ensure consistent footer/buttons; tokenized borders.
- Other Pages
  - `app/sources/page.tsx`, `app/logs/page.tsx`, tables pages, settings/stats: card wrappers and spacing.
- Hygiene
  - Add `rel="noopener noreferrer"` to all external links.
  - Avatar fallback initials.

## QA Checklist

- Header: all links accessible via keyboard; active state announced.
- List pane: collapse/expand works, scrolls independently, no content overflow on small screens.
- Solicitations row: hover states, tooltips, and actions retain function.
- Detail page: tabs switch without layout shift; badges render only when data present.
- Dialogs: validation errors readable; Save/Close buttons consistent.
- Auth: form errors readable; redirect flow unchanged.
- Dark mode: tokens applied correctly in both themes.

---

This plan preserves all existing data flows and server endpoints, focusing on predictable, incremental visual improvements that align with the reference app’s UX.

