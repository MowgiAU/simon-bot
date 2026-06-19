# Alt F Design System

Design language for the Alt F desktop suite (`/preview/alt_f*`).
All values are inline-style React — no CSS files, no Tailwind.
Reference page (the established standard all others must match): `FrontpageAltFBattles.tsx`.

---

## Page Status

| Page | Route | Status | Notes |
|---|---|---|---|
| Battles hub | `/preview/alt_f_battles` | ✅ Reference standard | Do not change without updating this doc |
| Battle detail | `/preview/alt_f_battle` | ✅ Approved | Centred hero, 400px, border-bottom |
| Track detail | `/preview/alt_f_track` | ✅ Approved | 280px left / 1fr right grid |
| Artist profile | `/preview/alt_f_artist` | ✅ Approved | Minor future tweaks pending |
| Charts | `/preview/alt_f_charts` | ✅ Approved | Minor future tweaks pending |
| Home | `/preview/alt_f` | 🔧 Needs work | Hero + body structure still TBD |

### Missing pages (to build next)

Routes not yet created in the Alt F suite:
- `/genres` — Genre exploration
- `/new` — Latest releases feed
- `/library` — User library
- `/artists` — Artists directory
- `/arena` — Head-to-head arena
- `/feed` — Activity feed
- `/messages` — Messages page
- `/my-tracks` — User's own tracks
- `/my-playlists` — User's playlists
- `/my-favourites` — Favourites
- `/articles` + `/article/:slug` — Editorial / articles
- `/learn` — Learning section

---

## Palette

Exported from `components/altshell/AltSidebar.tsx` — import from there in every Alt F page:

```tsx
import { BG, S_LOWEST, S_CONT, S_HIGH, S_HIGHEST, PRIMARY, SECONDARY, TERTIARY, TEXT, SUB, BORDER, FONT } from '../components/altshell/AltSidebar';
```

| Token | Value | Usage |
|---|---|---|
| `BG` | `#0f131d` | Page background |
| `S_LOWEST` | `#0a0e18` | Sidebar background, deepest surfaces |
| `S_CONT` | `#1c1f2a` | Container background (tabs, inner wells) |
| `S_HIGH` | `#262a35` | Elevated surfaces, hover fills |
| `S_HIGHEST` | `#313540` | Highest surface level |
| `PRIMARY` | `#F2780A` | Orange — CTAs, active states, rank highlights |
| `SECONDARY` | `#4cd7f6` | Cyan — accent labels, trend indicators, play state |
| `TERTIARY` | `#ff6779` | Coral/pink — warnings, down-trend, badges |
| `TEXT` | `#dfe2f1` | Primary text |
| `SUB` | `#9aa3b2` | Secondary / muted text |
| `BORDER` | `rgba(255,255,255,0.06)` | Very subtle separator (use sparingly) |
| `FONT` | `Inter, "SF Pro Display", -apple-system, …` | Typography stack |

### Row divider

Define locally per file — not exported from `AltSidebar`:
```tsx
const DIVIDER = 'rgba(87,66,54,0.25)';
```

Use `DIVIDER` for separators inside cards. Use `BORDER` only for structural borders (sidebar edge, hero bottom).

---

## Layout Shell

Every Alt F page uses the same outer shell:

```tsx
<div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: BG, color: TEXT, fontFamily: FONT }}>
    <AltSidebar active="…" />
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <AltHeader breadcrumb={[{ label: '…' }]} />
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: player.currentTrack ? 90 : 0 }}>
            {/* hero (if any), then body grid */}
        </div>
    </main>
</div>
```

---

## Body Grid Layout

**This is the single layout grid for all Alt F pages.** All pages use a narrow left column (280px) and a wide right column (1fr):

```tsx
<div style={{
    maxWidth: 1280,
    margin: '24px auto 0',
    padding: '0 32px 40px',
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: 28,
    boxSizing: 'border-box',
}}>
    {/* Left column */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Glass cards — titles INSIDE via header-row */}
    </div>
    {/* Right column */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Sections — <h2> OUTSIDE the glass card, before it */}
    </div>
</div>
```

**Rules:**
- `gridTemplateColumns` is always `280px 1fr` — never `1fr 380px` or any other variant
- `maxWidth` is always `1280px` — never wider
- Left column `gap` is `20`, right column `gap` is `28`
- Body starts at `margin-top: 24px` from the bottom of the hero (or top of scroll area if no hero)

---

## Card Header Patterns

There are exactly two patterns. Never mix them.

### Pattern A — Left sidebar cards: title INSIDE via header-row

Used for all cards in the 280px left column.

```tsx
<div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
    {/* Header row: title inside card with bottom border */}
    <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${DIVIDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Card Title</h3>
        {/* optional right-side element (count, button, etc.) */}
    </div>
    {/* Card body */}
    <div style={{ padding: '16px 20px' }}>
        {/* content */}
    </div>
</div>
```

### Pattern B — Right column sections: h2 OUTSIDE the glass card

Used for all sections in the 1fr right column.

```tsx
<section>
    <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Section Title</h2>
    <div style={{ ...glass, borderRadius: 20, padding: '20px 24px' }}>
        {/* content */}
    </div>
</section>
```

If the section header needs a "View All" link or action button, put it in a flex row alongside the h2 (still outside the card):
```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Section Title</h2>
    <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600, cursor: 'pointer' }}>View All</span>
</div>
```

---

## Glass Card

The core card surface. All cards use this — vary only `borderRadius` and `padding`.

```tsx
const glass: React.CSSProperties = {
    background: 'rgba(15,19,29,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
};
```

### Border radius

| Context | Value |
|---|---|
| Top-level cards (left or right column) | `20` |
| Inner sub-cards (entry rows, stat blocks, nested panels) | `12` |
| Inline tags / chips | `9999` (pill) |
| Buttons | `10–14` |

**Never use `borderRadius: 16`** — old value, replaced everywhere with `20`.

**Never use** `rgba(23,27,38,0.7)` or `rgba(28,31,42,0.4)` — these are stale (lighter) glass values.

---

## Hero Sections

### Standard: profile-page hero (artist, track)

Full-width banner image, content constrained to 1280px, aligned to bottom-left. Height: `400px`.

```tsx
<section style={{
    position: 'relative',
    width: '100%',
    height: 400,
    overflow: 'hidden',
    borderBottom: `1px solid ${BORDER}`,
}}>
    {/* Background — full width, absolutely positioned */}
    <img src={banner} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.4) 60%, transparent 100%)' }} />
    {/* Content: constrained to 1280px, pinned to bottom */}
    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', boxSizing: 'border-box' }}>
            {/* profile pic + name + stats on left; action buttons on right */}
        </div>
    </div>
</section>
```

### Standard: centred hero (battles hub, battle detail)

Full-width banner, content centred (column flex) within 1280px. Height: `400px`.

```tsx
<section style={{
    position: 'relative',
    width: '100%',
    height: 400,
    overflow: 'hidden',
    borderBottom: `1px solid ${BORDER}`,
}}>
    {/* Background */}
    <img src={banner} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a2242 0%, #2a1040 50%, #1a0f10 100%)', opacity: 0.7 }} />
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,29,1) 0%, rgba(15,19,29,0.4) 50%, transparent 100%)' }} />
    {/* Content: centred column, constrained to 1280px */}
    <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 1280, width: '100%', padding: '0 32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0, boxSizing: 'border-box' }}>
            {/* status badge, title, info pills, CTA */}
        </div>
    </div>
</section>
```

**Both hero types:**
- Height is always `400px`
- Always include `borderBottom: \`1px solid ${BORDER}\`` on the section
- Background image/gradient is always `position: absolute, inset: 0` — never constrained
- Content is always constrained to `maxWidth: 1280` with `padding: '0 32px'`

---

## Sidebar (`AltSidebar`)

The shared left navigation bar. Width `256px` (expanded) / `64px` (collapsed).

### Logo row

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <img src="/fujistudioiconalt.png" style={{ width: 32, height: 32, objectFit: 'contain' }} />
    <img src="/fujitext.svg" alt="Fuji Studio" style={{ height: 22, width: 'auto' }} />
</div>
```

- Icon: `fujistudioiconalt.png` at `32×32`
- Wordmark: `fujitext.svg` at `height: 22px`, fill baked in as `fill="#ffffff"` in the SVG root
- No text labels — no "Fuji Studio" string, no "Pro Account" string

---

## Interactive States

### Clickable cards (hover lift + border glow)

```tsx
onMouseEnter={ev => {
    ev.currentTarget.style.borderColor = `${PRIMARY}66`;
    ev.currentTarget.style.transform = 'translateY(-2px)';
}}
onMouseLeave={ev => {
    ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
    ev.currentTarget.style.transform = 'translateY(0)';
}}
```

Card must have `transition: 'border-color 0.2s, transform 0.15s'`.

### Clickable rows (hover fill)

```tsx
onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(38,42,53,0.4)')}
onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
```

### Hover play overlay (on covers/thumbnails)

```tsx
<div style={{
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: 0, transition: 'opacity 0.2s',
}}
    onMouseEnter={ev => { ev.currentTarget.style.opacity = '1'; }}
    onMouseLeave={ev => { ev.currentTarget.style.opacity = '0'; }}>
    <Play size={20} fill="#fff" color="#fff" />
</div>
```

---

## Table / List Rows

### Table header row

```tsx
<div style={{
    display: 'grid',
    gridTemplateColumns: '/* your columns */',
    padding: '12px 24px',
    background: 'rgba(38,42,53,0.5)',
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: SUB,
    borderBottom: `1px solid ${DIVIDER}`,
}} />
```

### Data rows

```tsx
<div style={{
    display: 'grid',
    gridTemplateColumns: '/* same columns */',
    padding: '14px 24px',
    borderBottom: `1px solid ${DIVIDER}`, // omit on last row
    cursor: 'pointer',
    transition: 'background 0.15s',
}}
    onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(38,42,53,0.4)')}
    onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')} />
```

---

## Content Cards (grid items)

### Battle / content card with image top

```tsx
<div style={{
    ...glass, borderRadius: 20, overflow: 'hidden',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    transition: 'border-color 0.2s, transform 0.15s',
}}
    onMouseEnter={ev => { ev.currentTarget.style.borderColor = `${PRIMARY}66`; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; }}>
    {/* Image: 128px tall */}
    <div style={{ height: 128, position: 'relative', background: S_HIGH, overflow: 'hidden' }}>
        <img style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
            onMouseEnter={ev => (ev.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={ev => (ev.currentTarget.style.transform = 'scale(1)')} />
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
            <span style={{ background: 'rgba(15,19,29,0.85)', backdropFilter: 'blur(8px)', border: `1px solid ${statusColor}55`, color: statusColor, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{statusLabel}</span>
        </div>
    </div>
    {/* Body */}
    <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ padding: '2px 8px', borderRadius: 4, background: `${SECONDARY}20`, border: `1px solid ${SECONDARY}40`, fontSize: 10, color: SECONDARY, fontWeight: 600 }}>{genre}</span>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${DIVIDER}`, fontSize: 12 }}>
            <span style={{ color: SUB }}>{count} Entries</span>
            <span style={{ color: PRIMARY, fontWeight: 700 }}>{prize}</span>
        </div>
    </div>
</div>
```

---

## Badges / Status Chips

### Status badge (Live / Voting / Ended)

```tsx
<span style={{
    background: `${statusColor}22`, border: `1px solid ${statusColor}55`,
    color: statusColor, padding: '4px 14px', borderRadius: 9999,
    fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
    display: 'flex', alignItems: 'center', gap: 6,
}}>
    <Flame size={12} fill={statusColor} /> {statusLabel}
</span>
```

### Metadata chip (BPM, Key, Genre)

```tsx
<span style={{
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 9999,
    background: `${SECONDARY}18`, border: `1px solid ${SECONDARY}33`,
    fontSize: 12, fontWeight: 600, color: SECONDARY,
}}><Activity size={11} /> {bpm} BPM</span>
```

### Genre tag (in card body)

```tsx
<span style={{
    padding: '2px 8px', borderRadius: 4,
    background: `${SECONDARY}20`, border: `1px solid ${SECONDARY}40`,
    fontSize: 10, color: SECONDARY, fontWeight: 600,
}}>{genre}</span>
```

---

## Buttons

### Primary CTA

```tsx
<button style={{
    padding: '14px 36px', borderRadius: 12,
    background: PRIMARY, border: 'none',
    color: '#fff', fontWeight: 800, fontSize: 15,
    cursor: 'pointer', boxShadow: `0 0 24px ${PRIMARY}55`,
}}>
    Join Battle
</button>
```

On hover: `boxShadow: '0 0 28px rgba(242,120,10,0.5)'`.

### Secondary (outline)

```tsx
<button style={{
    padding: '10px 24px', borderRadius: 10,
    background: 'transparent', border: `1px solid ${SECONDARY}`,
    color: SECONDARY, fontSize: 13, fontWeight: 700, cursor: 'pointer',
}}>
    Learn More
</button>
```

### Pill toggle (period/filter selector)

```tsx
<div style={{ display: 'flex', background: S_CONT, padding: 4, borderRadius: 12, border: `1px solid ${BORDER}`, gap: 2 }}>
    <button style={{
        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        background: active ? PRIMARY : 'transparent',
        color: active ? '#fff' : SUB,
        transition: 'all 0.2s',
    }}>{label}</button>
</div>
```

---

## Stats Pill (hero info block)

Used inside centred hero sections (battles hub, battle detail):

```tsx
<div style={{
    display: 'flex', alignItems: 'center',
    background: 'rgba(28,31,42,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(87,66,54,0.35)', borderRadius: 20, padding: '20px 40px',
}}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 0 0' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Prize Pool</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: PRIMARY }}>{prize}</span>
    </div>
    <div style={{ width: 1, height: 48, background: 'rgba(87,66,54,0.5)' }} />
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Producers</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{count}</span>
    </div>
    <div style={{ width: 1, height: 48, background: 'rgba(87,66,54,0.5)' }} />
    <div style={{ padding: '0 0 0 28px' }}>
        <button style={{ padding: '14px 36px', borderRadius: 12, background: PRIMARY, color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', boxShadow: `0 0 24px ${PRIMARY}55` }}>
            Join Battle
        </button>
    </div>
</div>
```

---

## Animated Waveform

```tsx
function useWaveform(n = 12) {
    const [heights, setHeights] = useState(() => Array.from({ length: n }, () => 30 + Math.random() * 70));
    useEffect(() => {
        const id = setInterval(() => setHeights(Array.from({ length: n }, () => 30 + Math.random() * 70)), 400);
        return () => clearInterval(id);
    }, [n]);
    return heights;
}

// Render:
<div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48,
              maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
    {waveHeights.map((h, i) => (
        <div key={i} style={{ width: 6, height: `${h}%`, background: SECONDARY,
                               borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease-in-out' }} />
    ))}
</div>
```

---

## Typography Scale

| Use | Size | Weight | Colour |
|---|---|---|---|
| Page hero title (centred) | 46–56px | 900 | `#fff` |
| Section H2 (outside card) | 20px | 700 | `TEXT` |
| Card title (inside header-row) | 15px | 700 | `TEXT` |
| Card item title | 15px | 800 | `TEXT` |
| Body text | 14px | 400 | `SUB` |
| Label / meta | 12–13px | 400–600 | `SUB` |
| Chip / badge | 10–11px | 700–800 | varies |
| Table header | 10px | 700 uppercase | `SUB` |

Letter spacing on uppercase labels: `0.08–0.1em`.

---

## Winner / Rank Colours

```tsx
const rankColor = (i: number) => ['#FFD700', '#C0C0C0', '#CD7F32', SUB, SUB][i] ?? SUB;
```

Prize place colours (1st/2nd/3rd):
- 1st: `PRIMARY` (`#F2780A`)
- 2nd: `SECONDARY` (`#4cd7f6`)
- 3rd: `TERTIARY` (`#ff6779`)

---

## What NOT to do

- Do not use `rgba(23,27,38,0.7)` or `rgba(28,31,42,0.4)` — old glass values
- Do not use `borderRadius: 16` — use `20` for top-level cards
- Do not use `borderRadius: 12` for top-level cards
- Do not use `BORDER` for row separators inside cards — use `DIVIDER`
- Do not omit `boxShadow` from glass cards
- Do not hardcode colours outside `AltSidebar.tsx` exports — use the tokens
- Do not add flat (non-glass) backgrounds to content cards
- Do not put card titles outside the glass card in the left column (Pattern A: title is always inside)
- Do not put section `<h2>` headings inside the glass card in the right column (Pattern B: h2 is always outside)
- Do not make the grid `1fr 380px` or any wide-left variant — always `280px 1fr`
- Do not make `maxWidth` wider than `1280px`
- Do not use CSS filter to colour SVG assets — bake the fill colour directly into the SVG
