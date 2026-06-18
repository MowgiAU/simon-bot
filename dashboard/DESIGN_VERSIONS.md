# Design Versions — Fuji Studio

This document tracks all active layout candidates and preview pages for the Fuji Studio dashboard.
It is the single source of truth for what exists, what it covers, and what's missing before any version can go live.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Done / working |
| ⚠️ | Partial / needs work |
| ❌ | Missing / not built |
| 🗄️ | Archived / not a candidate |

---

## Desktop: Alt F Suite (primary candidate)

**Design direction:** Spotify-style left sidebar + top header shell, dark palette.
**Shell:** `components/altshell/AltSidebar.tsx` + `components/altshell/AltHeader.tsx`
**Palette:** Defined in `AltSidebar.tsx` exports — `BG=#0f131d`, `PRIMARY=#F2780A`, `SECONDARY=#4cd7f6`, `TERTIARY=#ff6779`

### Pages

| Route | File | Live equivalent | Status | Notes |
|---|---|---|---|---|
| `/preview/alt_f` | `pages/FrontpageAltF.tsx` | `/` (home) | ✅ | Hero slider, featured drops, artists, battles, playlists. Live data. |
| `/preview/alt_f_artist` | `pages/FrontpageAltFArtist.tsx` | `/profile/:username` | ✅ | Profile header, tracks, top friends, comments. Uses `CommentSection`. |
| `/preview/alt_f_charts` | `pages/FrontpageAltFCharts.tsx` | `/charts` | ✅ | Daily/weekly/all-time, hero #1, ranked table with trend indicators. |
| `/preview/alt_f_track` | `pages/FrontpageAltFTrack.tsx` | `/profile/:username/:trackSlug` | ✅ | 2-col grid, stems mixer (compact), arrangement viewer, comments, lyrics. |
| `/preview/alt_f_battle` | `pages/FrontpageAltFBattle.tsx` | `/battles/:battleId` | ✅ | Hero banner, countdown, entries grid, rules, samples, podium. |
| `/preview/alt_f_battles` | `pages/FrontpageAltFBattles.tsx` | `/battles` | ✅ | Featured battle hero, battles grid, history, wall of fame. |

### What's covered
- Home/discovery, charts, artist profile, track detail, battle detail, battles hub
- Real API data on all pages
- Shared components properly imported: `CommentSection`, `StemsMixer`, `ArrangementViewer`, `GlobalPlayer`

### What's missing before this can go live

**Pages not yet built in this design language:**
- ❌ `/artists` — artist directory / browse
- ❌ `/new` — latest releases
- ❌ `/library` — track library / browse all
- ❌ `/genres` + `/genres/:slug` — genre pages
- ❌ `/feed` — subscription feed
- ❌ `/articles` + `/article/:slug` — news/editorial
- ❌ `/learn` — academy
- ❌ `/arena` — head-to-head
- ❌ `/my-tracks`, `/my-playlists`, `/my-favourites` — user library management
- ❌ `/messages` — private messaging

**Shell / navigation gaps:**
- ⚠️ `AltSidebar` links are wired to live routes (`/artists`, `/charts`, etc.) but those routes will still render the OLD `DiscoveryLayout` until the shell is promoted — the sidebar will appear but drop into the old layout on navigation
- ⚠️ `AltHeader` search, upload, notifications — UI exists but functionality untested
- ❌ No mobile responsiveness — `AltSidebar` is fixed-width desktop only; below ~768px the layout breaks
- ❌ Admin dashboard link not visible in `AltHeader`

**Functional gaps on existing pages:**
- ⚠️ Battle entry submission (`BattleSubmitModal`) — not linked from `/preview/alt_f_battle`
- ⚠️ Alt F artist page: follow/message/edit buttons — present but auth-gating needs verification
- ⚠️ Palette defined in `AltSidebar.tsx` — not derived from `theme/theme.ts`. Changing brand colours requires editing both.

### Component reuse health

| Component | Used in Alt F? | Risk |
|---|---|---|
| `CommentSection` | ✅ imported | Low |
| `StemsMixer` | ✅ imported (with `compact` prop) | Low |
| `ArrangementViewer` | ✅ imported | Low |
| `GlobalPlayer` | ✅ via `usePlayer()` | Low |
| `AuthProvider` | ✅ via `useAuth()` | Low |
| `AltSidebar` palette | ⚠️ not from `theme.ts` | Medium — brand drift risk |

---

## Mobile: Stitch Suite (live, incrementally shipped)

**Design direction:** Full-screen mobile layouts served inside `DiscoveryLayout`'s existing mobile chrome (bottom nav + GlobalPlayer).
**Pattern:** Live pages use `useMobile(1024)` to branch into a mobile component fed by the page's existing data.

### Live mobile components (`components/mobile/`)

| Component | Used by live page | Status |
|---|---|---|
| `ChartsMobile.tsx` | `ChartsPage.tsx` | ✅ Live |
| `HomeMobile.tsx` | `ArtistDiscovery.tsx` | ✅ Live |
| `ProfileMobile.tsx` | `MusicianProfile.tsx` | ✅ Live |
| `BattleDetailMobile.tsx` | `BattleDetailPage.tsx` | ✅ Live |
| `NowPlayingMobile.tsx` | `TrackPage.tsx` | ❌ Not yet built (static mockup only) |

### Static design references (`/preview/mobile-*`)

These are CSP-safe React reconstructions of the original Stitch HTML mockups.
They are **design references only** — they do not use the real `GlobalPlayer` or live data wiring.
They are superseded by the live `components/mobile/` components above.

| Route | File | Superseded by |
|---|---|---|
| `/preview/mobile-home` | `pages/MobilePreviewHome.tsx` | `HomeMobile.tsx` |
| `/preview/mobile-charts` | `pages/MobilePreviewCharts.tsx` | `ChartsMobile.tsx` |
| `/preview/mobile-profile` | `pages/MobilePreviewProfile.tsx` | `ProfileMobile.tsx` |
| `/preview/mobile-now-playing` | `pages/MobilePreviewNowPlaying.tsx` | `NowPlayingMobile.tsx` (TBD) |

**Do not delete these** — they are the canonical visual reference for the mobile design.

---

## Archived / Rejected Versions

These homepage explorations are kept for reference only. They are **not migration candidates**.

| Route | File | Reason archived |
|---|---|---|
| `/preview/alt_a` | `pages/FrontpageStitch.tsx` | Homepage-only, design not chosen |
| `/preview/alt_b` | `pages/FrontpageEditorialB.tsx` | Homepage-only, design not chosen |
| `/preview/alt_c` | `pages/FrontpageVHub.tsx` | Homepage-only, design not chosen |
| `/preview/alt_d` | `pages/FrontpageEditorialMix.tsx` | Homepage-only, design not chosen |
| `/preview/alt_e` | `pages/FrontpageNeon.tsx` | Homepage-only, design not chosen |

---

## Migration Phases (Alt F → Live)

See `C:\Users\te198\.claude\plans\jolly-skipping-waffle.md` for the full migration plan.
Short summary:

1. **Phase 1 (now):** Gap-fill missing pages, fix nav links, add mobile responsiveness to Alt F shell
2. **Phase 2:** Parallel test on staging (`staging.fujistud.io`) with Alt F routes as root
3. **Phase 3:** Promote pages one at a time (charts → battles → profile → track → home)
4. **Phase 4:** Full shell cutover — replace `DiscoveryLayout` with Alt F shell
5. **Phase 5:** Archive old preview pages, clean up routes

**Live routes must not change until Phase 3.** All work before that happens inside `/preview/alt_f*`.

---

## Rollback

All rollbacks are a single git revert — no backend changes involved.

```bash
git revert <commit>
git push origin main
ssh root@143.198.51.52 "cd ~/simon-bot && git pull && npm run dashboard:build"
```

---

*Last updated: 2026-06-18*
