# Alt F → Main Site — Migration Preparation

**Status (2026-07-17): Stage 1 + Stage 2 (core) SHIPPED & LIVE.** The core content loop now
renders Alt F at its live routes (`/`, `/charts`, `/artists`, `/profile/:u[/:slug]`,
`/battles[/:id]`, `/library`, `/articles[+/:slug]`, `/feed`, `/messages`, `/my-tracks`,
`/my-playlists`, `/my-favourites`, `/playlist/:id`, `/learn`, `/arena`). **Deferred to Stage 2b**
(still on `/preview`): genres-community, genre posts, collabs, create-post. Old pages kept as dead
code; `/preview/alt_f*` routes retained. Stage 3 = cleanup.

Supersedes the stale "Migration Phases" section of `DESIGN_VERSIONS.md` (dated 2026-06-18,
written before articles / learn / arena / collabs / genres / my-tracks / messages / library /
feed pages existed).

---

## 1. How things work today (so the plan makes sense)

- **Routing:** `dashboard/src/App.tsx` is one big function that reads `currentPath`
  (`window.location.pathname`) and returns the matching page inside `<Suspense>`. There is
  **no per-route layout wrapper** — each page renders its own chrome.
- **Alt F shell is per-page:** every `FrontpageAltF*.tsx` mounts its **own** `AltSidebar` +
  `AltHeader` (+ sometimes `AltActivitySidebar`). 84 shell mounts across 26 pages. The live
  pages instead render inside `DiscoveryLayout`.
- **Providers already shared:** `AuthProvider > PlayerProvider > AnalyticsProvider > … >
  GlobalPlayer` wrap **all** routes (`App.tsx:1288-1299`). Alt F pages already use
  `useAuth()`/`usePlayer()` and the global player today — **no provider work needed** for the port.
- **Live data:** the index/listing Alt F pages already fetch real API data.
- **SEO/OG meta:** `src/api/index.ts` (~16897+) server-injects rich OpenGraph/Twitter/schema
  meta **for crawlers**, keyed off **path-based** entity URLs (`/profile/:username/:slug`,
  `/track/:username/:slug`, `/profile/:username`, `/battles/:id`, `/article/:slug`).

---

## 2. Decisions to lock BEFORE any code (these shape everything)

> **Locked (2026-07-17):**
> - **D1 = Path-based URLs** — adopt the live `/profile/:u/:slug`, `/battles/:id`, `/article/:slug`
>   scheme. Preserves SEO + existing shared links.
> - **D2 = Keep old pages as dead code for one release** — delete in a follow-up cleanup.
> - **Cutover scope** (all-at-once vs waves) — still open; decide at execution time.

### ⭐ D1 — URL strategy (the big one) — ✅ LOCKED: path-based

Alt F detail pages currently route by **query string**; the live site uses **path params**:

| Entity | Alt F today | Live (canonical, SEO-wired) |
|---|---|---|
| Track | `/preview/alt_f_track?id=…` *(actually hardcoded — see D3)* | `/profile/:username/:trackSlug` |
| Artist | `/preview/alt_f_artist` *(hardcoded)* | `/profile/:username` |
| Battle | `/preview/alt_f_battle` *(hardcoded)* | `/battles/:battleId` |
| Article | `/preview/alt_f_article?slug=…` | `/article/:slug` |
| Playlist | `/preview/alt_f_playlist?id=…` | `/playlist/:id` |
| Genre | `/preview/alt_f_genres/…` | `/genres/:slug` |

**Recommendation: adopt the live path-based URLs.** Reasons:
- The API's OG/SEO meta only fires on the path-based URLs. Query-string Alt F URLs get **zero**
  rich social cards / schema — a real regression for a 50k community that shares links.
- Thousands of existing shared links (`/profile/x/y`, `/battles/z`) must keep working. If Alt F
  becomes root without adopting these paths, every existing link 404s or loses its preview.
- Keeps one canonical URL scheme instead of two.

**Cost:** rewrite the 3 hardcoded detail pages to read path params (D3), and rewrite internal
links (§4). This is the bulk of the work but it's mechanical.

*(Alternative — keep `?id=` query strings — is faster but sacrifices SEO + breaks existing
links. Not recommended.)*

### D2 — Disposition of the old pages / `DiscoveryLayout` — ✅ LOCKED: keep as dead code 1 release

- Repoint live routes to Alt F pages, **keep old page files as dead code for one release**, then
  delete in a follow-up cleanup (safest rollback).
- Either way `DiscoveryLayout` and the `components/mobile/*` live-mobile components become
redundant once Alt F (which has its own `AltMobileNav`) owns every route.

### D3 — Three detail pages are demo-hardcoded, not wired to real targets — ✅ DONE (Stage 1, 2026-07-17)

All three now resolve their target from the live path first, then a query-param override, then
the demo entity (so the `/preview` URLs still work). Verified live against real entities:
- `FrontpageAltFArtist.tsx` → `/profile/:username` (`resolveArtistUsername()`) — verified `xeinu`.
- `FrontpageAltFTrack.tsx` → `/profile/:u/:slug` or `/track/:u/:slug` (`resolveTarget()`) — verified `xeinu/bitter-sweets`.
- `FrontpageAltFBattle.tsx` → `/battles/:idOrSlug` — verified `fujistud-io-beat-battle-2`.

No live routing changed yet — this was pure prerequisite. Next: Stage 2 (route cutover + link rewrite).

### D4 — Staging first?

Recommended: cut over on `staging` branch / `staging.fujistud.io` first (root = Alt F), soak,
then merge to `main`. Rollback is a single `git revert` (no backend/schema changes involved).

---

## 3. Page inventory & readiness

Legend: ✅ live data + real nav · 🔶 built but needs param wiring · ➕ Alt F-only (new feature)

| Alt F route | Page file | Live equivalent | Ready? |
|---|---|---|---|
| `/preview/alt_f` | FrontpageAltF | `/` | ✅ |
| `/preview/alt_f_charts` | FrontpageAltFCharts | `/charts` | ✅ |
| `/preview/alt_f_battles` | FrontpageAltFBattles | `/battles` | ✅ |
| `/preview/alt_f_artists` | FrontpageAltFArtists | `/artists` | ✅ |
| `/preview/alt_f_library` | FrontpageAltFLibrary | `/library` | ✅ |
| `/preview/alt_f_articles` | FrontpageAltFArticles | `/articles` | ✅ |
| `/preview/alt_f_genres` | FrontpageAltFGenres | `/genres` | ✅ |
| `/preview/alt_f_feed` | FrontpageAltFFeed | `/feed` | ✅ |
| `/preview/alt_f_messages` | FrontpageAltFMessages | `/messages` | ✅ |
| `/preview/alt_f_my_tracks` | FrontpageAltFMyTracks | `/my-tracks` | ✅ |
| `/preview/alt_f_my_playlists` | FrontpageAltFMyPlaylists | `/my-playlists` | ✅ |
| `/preview/alt_f_favourites` | FrontpageAltFFavourites | `/my-favourites` | ✅ |
| `/preview/alt_f_article` | FrontpageAltFArticle | `/article/:slug` | ✅ (reads `?slug`) |
| `/preview/alt_f_playlist` | FrontpageAltFPlaylist | `/playlist/:id` | ✅ (reads `?id`) |
| `/preview/alt_f_genre_post` | FrontpageAltFGenrePost | *(new)* | ➕ (reads `/:postId`) |
| `/preview/alt_f_track` | FrontpageAltFTrack | `/profile/:u/:slug` | 🔶 **hardcoded** |
| `/preview/alt_f_battle` | FrontpageAltFBattle | `/battles/:id` | 🔶 **hardcoded** |
| `/preview/alt_f_artist` | FrontpageAltFArtist | `/profile/:username` | 🔶 **hardcoded** |
| `/preview/alt_f_arena` | FrontpageAltFArena | `/arena` | ➕ new live-lobby arena |
| `/preview/alt_f_learn` | FrontpageAltFLearn | `/learn` (Academy) | ✅ |
| `/preview/alt_f_collabs` + callout/workspace/my_collabs | FrontpageAltFCollab* | *(new feature)* | ➕ (read `?id`) |
| `/preview/alt_f_create_post` | FrontpageAltFCreatePost | *(new)* | ➕ |
| `/preview/alt_f_index` | FrontpageAltFIndex | *(dev index)* | dev-only, drop |

**No Alt F equivalent yet** (live-only pages that still need an Alt F home, or must keep their
current page): `/download`, `/terms`, `/features`, `/account`, `/login`+auth flows, `/slots`,
`/projects` + `/projects/:id`, `/guides/*`, `/profile/edit`, `/profile/setup`, `/write`
(Writing Studio), `/dashboard` (admin). Most of these are utility/auth pages that can keep their
current styling initially — decide per-page whether they need reskinning.

---

## 4. Work breakdown

### 4.1 Wire the 3 hardcoded detail pages (D3) — **biggest task**
- `FrontpageAltFArtist`: replace `REF_USER` with `:username` from path.
- `FrontpageAltFTrack`: replace hardcoded fetch with `:username/:trackSlug` from path.
- `FrontpageAltFBattle`: replace `baby-audio-presents` with `:battleId`/slug from path.
- Match the live pages' param-reading + not-found/loading/auth-gating behaviour.

### 4.2 Internal link rewrite — **210 refs across 30 files**
- Every `/preview/alt_f_*` link → its live path (`/charts`, `/battles`, `/profile/:u/:slug`,
  `/article/:slug`, `/playlist/:id`, `/genres/...`, `/arena`, `/learn`, `/messages`, etc.).
- Covers the 26 Alt F pages **plus** the shell: `AltSidebar` `NAV` (`:25-35`, all 9 point to
  `/preview/alt_f*` today), `AltSidebar` playlist links (`:240`), `AltMobileNav` `TABS`+`PIE_NAV`
  (14 refs), `AltActivitySidebar` (6 refs, incl. the arena teaser).
- Detail-entity links (`?id=`/`?slug=`) become path segments per D1.
- One `/preview/alt_f` ref also lives in `MusicianProfilePublic.tsx` — audit non-Alt-F files too.

### 4.3 Route table cutover (`App.tsx`)
- Point live routes at the Alt F components (`/` → `FrontpageAltF`, `/charts` →
  `FrontpageAltFCharts`, `/battles` → `FrontpageAltFBattles`, `/profile/:u/:slug` →
  `FrontpageAltFTrack`, `/battles/:id` → `FrontpageAltFBattle`, `/profile/:username` →
  `FrontpageAltFArtist`, `/articles`, `/article/:slug`, `/genres`, `/feed`, `/library`,
  `/artists`, `/messages`, `/my-tracks`, `/my-playlists`, `/my-favourites`, `/learn`, `/arena`,
  collabs, etc.).
- Add net-new routes for Alt F-only features (collabs, genre posts, create-post).
- Keep the `/preview/alt_f*` routes during the soak (they'll just render the same components),
  remove in cleanup.

### 4.4 Repoint the ~10 existing `/arena` entry points
- Previously deferred "until redesign launch." This **is** that launch. Point the live `/arena`
  route + all in-app entry links at the new arena.

### 4.5 Shell / chrome polish
- `AltHeader`: confirm search, upload, notifications, admin-dashboard link all work against live
  (DESIGN_VERSIONS flagged these as "untested").
- Confirm `AltMobileNav` covers every destination now that the nav set grew.
- Verify Alt F responsive CSS (injected by `AltSidebar`) holds on every newly-promoted page.

### 4.6 Palette / theme debt (optional but recommended now)
- Alt F palette lives in `AltSidebar.tsx` exports, **not** `theme/theme.ts` (brand-drift risk).
  Consider unifying during the port so there's one source of truth going forward.

### 4.7 Cleanup (after soak)
- Remove old page files + `DiscoveryLayout` + redundant `components/mobile/*` (per D2).
- Remove `/preview/alt_f*` routes (or keep as aliases).
- Update/replace `DESIGN_VERSIONS.md`.

---

## 5. Suggested execution order (when we DO run it)

1. **D1–D4 confirmed** (see §7).
2. Branch `staging`. Wire the 3 detail pages (4.1) — verify each against a real entity.
3. Rewrite internal links + shell nav (4.2). Grep must return **0** `/preview/alt_f` refs in
   shipped pages afterward.
4. Cut over the route table (4.3) + arena entry points (4.4).
5. Shell polish (4.5), palette unify (4.6 optional).
6. `npm run type-check` + `npm run dashboard:build` clean.
7. Deploy to `staging.fujistud.io`, full soak (see §6).
8. Merge to `main`, deploy prod. Cleanup (4.7) in a follow-up release.

---

## 6. Verification checklist (per page, on staging)

- Every live route renders the Alt F page with real data, no console errors.
- Deep links work: paste `/profile/:u/:slug`, `/battles/:id`, `/article/:slug`, `/playlist/:id`
  directly → correct entity loads (proves D3 wiring + D1 URLs).
- Existing shared links still resolve (no 404s).
- Crawler OG cards intact: `curl -A "Twitterbot" https://staging.fujistud.io/track/...` returns
  the rich meta (proves path-based URLs preserved SEO).
- Global player persists across navigations; auth-gated actions gate correctly.
- Mobile (`AltMobileNav`) + tablet + narrow-desktop layouts hold on every promoted page.
- Arena: full lobby → challenge → match flow works from the live `/arena`.

---

## 7. Open questions for Thomas

**Resolved:** D1 = path-based URLs · D2 = keep old pages as dead code 1 release.

**Still open (decide at execution time):**
1. **Scope of first cutover:** all pages at once, or promote in waves (e.g. charts → battles →
   profile → track → home) behind the same shell?
2. **Utility/auth pages** (`/login`, `/account`, `/terms`, `/download`, `/projects`, `/slots`,
   admin): reskin to Alt F now, or leave as-is for a later pass?
3. **Staging soak** first (recommended) or straight to prod?

---

## 8. Rollback

Single `git revert <cutover-commit>` + rebuild — no backend or schema changes are involved in
the port, so rollback is always clean.
