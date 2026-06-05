# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Fuji Studio** is a modular Discord bot for a 50k-user FL Studio music producer community. The project name in code is `simon-bot` but all user-facing strings must say **Fuji Studio**.

Three separate processes run in production via PM2:
- `api` — Express REST API (`src/api/index.ts`)
- `bot` — Discord.js bot (`src/bot/start.ts`)
- `radio-worker` — Standalone voice radio worker (`src/bot/radio-worker.ts`)

The **dashboard** is a separate React/Vite SPA (`dashboard/`) with its own `package.json`.

## Commands

### Bot & API (root directory)
```bash
npm run dev          # Run bot with hot reload (tsx watch)
npm run api:dev      # Run API server with hot reload
npm run build        # Generate Prisma client + TypeScript compile
npm run type-check   # Type-check without emitting
npm run start        # Run bot (no watch)
```

### Database
```bash
npm run db:push      # Push schema changes (no migration history)
npm run migrate      # Create and apply a migration
npm run db:studio    # Launch Prisma Studio
npm run db:backup    # Run database backup script
```

### Dashboard (from root)
```bash
npm run dashboard:dev    # Vite dev server for dashboard
npm run dashboard:build  # Production build of dashboard
```
Or `cd dashboard && npm run dev` / `npm run build` / `npm run type-check`.

### Deployment (production)
```bash
ssh root@143.198.51.52 "cd ~/simon-bot && git pull && npm install && cd dashboard && npm install && cd .. && npm run build && npm run dashboard:build && pm2 restart all"
```
Dashboard builds consume high RAM — if build is killed, check server swap space.

There is **no test suite** — do not attempt to run tests.

## Architecture

### Backend (TypeScript, ESM)

`src/bot/` contains the Discord bot:
- `index.ts` — Main `SimonBot` class: Discord client init, plugin registration, command routing
- `start.ts` — Entry point; also initialises Express API side-by-side
- `core/PluginManager.ts` — Plugin registry (enable/disable, lifecycle)
- `utils/PluginLoader.ts` — File-system plugin discovery
- `plugins/` — **All feature logic lives here** (one plugin per file)
- `types/plugin.ts` — `IPlugin` and `IPluginContext` interfaces (the plugin contract)

`src/api/index.ts` — Monolithic Express server: session auth, Discord OAuth, all REST endpoints, file uploads (multer), Prisma queries.

`src/services/` — Shared services used by both bot plugins and the API: `R2Storage`, `AudioService`, `MediaConverter`, `WaveformExtractor`, `EmailService`, `ProfileService`, `FileValidator`, `MessageEncryption`, `DatabaseBackup`.

`src/bot/services/FeedbackAIService.ts` — LangChain + OpenAI wrapper for AI-driven feedback analysis.

### Frontend (React 18 + Vite)

`dashboard/src/`:
- `App.tsx` — React Router routes (one route per plugin page + public/discovery pages). All pages are lazy-loaded.
- `layouts/Sidebar.tsx` — Main navigation shell
- `layouts/DiscoveryLayout.tsx` — Public discovery section layout
- `pages/` — Plugin UI pages (admin) and user-facing pages (tracks, profile, battles, etc.)
- `components/` — Shared components (`GlobalPlayer`, `ChannelSelect`, `RoleSelect`, `Toast`, `AuthProvider`, `PlayerProvider`, etc.)
- `theme/theme.ts` — **Single source of truth for all design tokens** (colors, spacing, typography, shadows, borderRadius)

The dashboard uses **inline React styles exclusively** — no CSS files, no CSS modules, no Tailwind. The `@emotion` packages are pulled in by MUI only; do not use Emotion directly.

### Plugin System

Every feature must be a plugin implementing `IPlugin` (`src/bot/types/plugin.ts`). Required fields: `id`, `name`, `description`, `version`, `author`, `requiredPermissions`, `commands`, `events`, `dashboardSections`, `defaultEnabled`, `configSchema` (Zod), `initialize()`, `shutdown()`.

Plugins receive an `IPluginContext` on init: `{ logger, config, db (Prisma), client (Discord), plugins (registry), api, logAction }`.

Plugins are **manually imported and registered** in `src/bot/index.ts` — auto-discovery is not used at runtime. A plugin file in `plugins/` that is not imported in `index.ts` will never load.

**Event handlers**: Declaring an event string in `events[]` is not enough — the plugin must also implement the corresponding method. The `SimonBot` event dispatcher calls these by name:

| `events[]` value       | Method to implement         |
|------------------------|-----------------------------|
| `interactionCreate`    | `onInteractionCreate()`     |
| `messageCreate`        | `onMessageCreate()`         |
| `voiceStateUpdate`     | `onVoiceStateUpdate()`      |
| `messageReactionAdd`   | `onMessageReactionAdd()`    |
| `messageReactionRemove`| `onMessageReactionRemove()` |
| `threadCreate`         | `onThreadCreate()`          |
| `guildMemberAdd`       | `onGuildMemberAdd()`        |
| `guildMemberRemove`    | `onGuildMemberRemove()`     |
| `guildMemberUpdate`    | `onGuildMemberUpdate()`     |
| `guildBanAdd`          | `onGuildBanAdd()`           |

**Slash commands**: Most common commands are hardcoded in `registerSlashCommands()` in `src/bot/index.ts`. Plugins can also contribute commands by implementing `registerCommands(): Promise<SlashCommandBuilder[]>` — the method is called automatically on startup.

**Plugin-enable cache**: `SimonBot` keeps a 30-second in-memory cache (`pluginCache`) of per-guild plugin enabled/disabled state. Interactions use a non-blocking cache read; message events do a cached DB lookup.

**Adding a new plugin checklist:**
1. Create `src/bot/plugins/MyPlugin.ts` implementing `IPlugin`
2. Import and register it in `src/bot/index.ts`
3. Add plugin `id` to `accessiblePlugins` in `src/api/index.ts` (controls dashboard sidebar visibility)
4. Add dashboard route in `dashboard/src/App.tsx`
5. Create `dashboard/src/pages/MyPlugin.tsx` for the settings UI
6. If the plugin has slash commands, implement `registerCommands()` or add them to `registerSlashCommands()` in `src/bot/index.ts`
7. Set `defaultEnabled = true` unless the feature is strictly opt-in

### Database

PostgreSQL via Prisma ORM. Schema at `prisma/schema.prisma`. Key models: `User` (native auth with optional Discord link, 2FA/TOTP, soft delete), `Guild`, `Member`, `PluginSettings`, `Track`, `BeatBattle`, `FeedbackPoints`, and many more feature-specific models.

Uses two connection strings: `DATABASE_URL` (pooled, e.g. PgBouncer) and `DIRECT_DATABASE_URL` (direct connection for migrations).

Two Prisma middleware layers are applied globally:
- `retryMiddleware` (`src/services/prismaRetry.ts`) — auto-retries transient failures
- `softDeleteMiddleware` (`src/services/softDelete.ts`) — filters `deletedAt != null` from reads on the `User` model

### Key Environment Variables

| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot login token |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth app credentials |
| `GUILD_ID` | Primary guild ID for slash command registration |
| `DATABASE_URL` | Pooled Postgres connection |
| `DIRECT_DATABASE_URL` | Direct Postgres connection (migrations) |
| `SESSION_SECRET` | Express session signing key |
| `OPENAI_API_KEY` | Optional — enables AI feedback analysis |
| `FUJI_STORAGE_GUILD_ID` | Guild used as Fuji sample library storage |
| `R2_*` | Cloudflare R2 credentials for file storage |

## Rules

### Backend
- Use `this.logger.info/warn/error()` (injected via `IPluginContext`). Never `console.log`.
- Use Prisma ORM — no raw SQL unless unavoidable.
- Plugin config is validated with Zod `configSchema`.
- No direct dependencies between plugins. Use `IPluginContext.plugins` registry if cross-plugin access is needed.

### Frontend / Dashboard
- **Never use hardcoded colors.** Import from `dashboard/src/theme/theme.ts` (`colors`, `spacing`, `typography`, `borderRadius`, `shadows`).
- **Icons**: `lucide-react` only. No emojis in UI elements.
- **Channel/role inputs**: Use `<ChannelSelect />` and `<RoleSelect />` components — never raw `<select>` for Discord IDs.
- **Plugin page header pattern**:
  ```tsx
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
    <Icon size={32} color={colors.primary} style={{ marginRight: '16px' }} />
    <div>
      <h1 style={{ margin: 0 }}>Title</h1>
      <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Subtitle</p>
    </div>
  </div>
  ```
- **Settings explanation block** (required on every plugin settings page):
  ```tsx
  <div style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
    <p style={{ margin: 0, color: colors.textPrimary }}>Explanation text...</p>
  </div>
  ```
- New MUI components must be added to `dashboard/package.json` before use.
- All layouts must be mobile-responsive.

## Infrastructure

- **Production:** `ssh root@143.198.51.52` (IP: 143.198.51.52), domain: fujistud.io
- **Staging:** `ssh root@143.198.136.83`, domain: staging.fujistud.io:3000, branch: `staging`
- PM2 config: `ecosystem.config.cjs` (uses `tsx` as interpreter — no compiled JS in production)
- Sessions stored in PostgreSQL via `connect-pg-simple`
- File uploads stored locally under `public/uploads/` and/or Cloudflare R2 (`R2Storage`)
