# Fuji Studio – AI Coding Agent Instructions

## Project Overview
- **Name:** Fuji Studio (formerly Simon Bot)
- **Purpose:** Modular Discord bot for a 50k+ FL Studio music producer community
- **Architecture:** Strict plugin-based (TypeScript/Node.js backend, React/Vite dashboard, PostgreSQL/Prisma)

## Key Architectural Patterns
- **Plugins:** All features are plugins in `src/bot/plugins/`, each implementing `IPlugin`. No direct dependencies between plugins. Plugins provide logic and dashboard content; core provides structure.
- **Plugin Discovery:** Plugins are auto-discovered by scanning `src/bot/plugins/` and must export `id`, `name`, and `description`.
- **Dashboard Integration:**
  - Each plugin can have a dashboard page in `dashboard/src/pages/` (filename matches plugin `id`).
  - To expose a plugin in the dashboard sidebar, add its ID to `accessiblePlugins` in `src/api/index.ts`.
  - Dashboard uses React 18, Vite, Material UI, and custom theme tokens from `dashboard/src/theme/theme.ts`.
- **API:** Express server in `src/api/` exposes plugin settings, permissions, and plugin list endpoints.
- **Database:** Prisma ORM (PostgreSQL). All schema in `/prisma`.
- **Frontend/Backend Communication:** REST API endpoints, no GraphQL.

## Developer Workflow
- **Push/Deploy:**
  - After any significant change, always instruct the user to run:
    ```powershell
    ssh root@simon-bot-main "git pull && npm install && npm run build && npm run dashboard:build && pm2 restart all"
    ```
  - This pulls, installs, builds backend and dashboard, and restarts all services.
- **Build/Run Locally:**
  - Backend: `npm run build` (from project root)
  - Dashboard: `cd dashboard && npm install && npm run build`
  - Start bot: `pm2 start dist/index.js` (or use `npm run dev` for local dev)
- **Testing:** No formal test suite; manual testing via Discord and dashboard.

## Project-Specific Conventions
- **No hardcoded colors:** Use theme tokens from `dashboard/src/theme/theme.ts`.
- **Plugin UI:**
  - Page headers follow a strict pattern (see AI_INSTRUCTIONS.md, section 7).
  - All plugin settings pages require an explanation block below the header.
  - Use `lucide-react` for icons, not emojis.
  - Channel selection must use `<ChannelSelect />` (not raw `<select>`).
- **Access Control:** Plugin visibility in dashboard is controlled by `accessiblePlugins` in `src/api/index.ts`.
- **Logging:** Use `this.logger.info()` in plugins, not `console.log`.
- **Config:** Plugin config schemas use Zod.

## Key Files & Directories
- `src/bot/plugins/` – All plugin logic (see README.md for plugin authoring)
- `src/api/index.ts` – API endpoints, plugin exposure, permissions
- `dashboard/src/pages/` – Dashboard plugin pages (filename = plugin id)
- `dashboard/src/theme/theme.ts` – Theme tokens for all UI
- `AI_INSTRUCTIONS.md` – Full project rules for AI agents
- `README.md` – Project overview and tech stack

## Examples
- To add a new plugin:
  1. Create `src/bot/plugins/MyPlugin.ts` implementing `IPlugin`.
  2. Add a dashboard page: `dashboard/src/pages/MyPlugin.tsx`.
  3. Add plugin ID to `accessiblePlugins` in `src/api/index.ts`.
  4. Use theme tokens and follow UI header/explanation block pattern.

---
For more, see `AI_INSTRUCTIONS.md` and `src/bot/plugins/README.md`.
