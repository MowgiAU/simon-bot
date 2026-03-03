# Fuji Studio – AI Coding Agent & Project Instructions

**Project**: Modular Discord bot for 50k-user FL Studio music producer community.
**Project Name**: Fuji Studio (formerly Simon Bot).
**Architecture**: Strict plugin-based (TypeScript/Node.js backend, React/Vite dashboard, PostgreSQL/Prisma)

---

## ⚠️ Critical Rules for AI Agents

1.  **Name Usage**: The bot is named **Fuji Studio**. All user-facing text must reference "Fuji Studio". Code folder names can remain `simon-bot`.
2.  **Deployment Awareness**:
    *   **Always** commit and push your changes to the `staging` branch on GitHub after any significant change:
        ```powershell
        git add .
        git commit -m "<your message>"
        git push origin staging
        ```
    *   **Dashboard Builds**: React builds consume high RAM. If a build fails with "Killed", check server swap space.

3.  **Plugin Architecture (Strict)**:
    *   Every feature **MUST** be a plugin (`src/bot/plugins/`).
    *   Plugins must implement `IPlugin`.
    *   **NO** direct dependencies between plugins.
    *   Plugins provide **Dashboard Content** (Pages), Core provides **Structure** (Layouts/Theme).
    *   **NEVER** use hardcoded colors. Use `dashboard/src/theme/theme.ts`.
    *   **API Exposure**: When adding a new plugin, you **MUST** update `src/api/index.ts` to include the plugin ID in the `accessiblePlugins` list for administrators, otherwise it will not appear in the dashboard sidebar.
    *   **Default State**: When creating a new plugin, unless it is strictly opt-in, set `readonly defaultEnabled = true;`. If set to false, the bot will completely ignore commands and events for that plugin until manually enabled in the database, which often confuses users testing the feature.

4.  **Dashboard & API Integration**:
    *   **Sidebar Visibility**: When adding a new plugin with a Dashboard page, you **must** manually add the plugin ID to the `accessiblePlugins` list in `src/api/index.ts` (Endpoint: `/api/guilds/:guildId/my-permissions`).
    *   If you don't do this, the Dashboard sidebar button will remain hidden even if the UI code is correct.
    *   **Material UI**: If you use new MUI components, ensure they are in `dashboard/package.json`.

---

## 📂 File Structure

```
/ (project root)
├── src/
│   ├── bot/
│   │   ├── core/           ← Plugin management
│   │   ├── plugins/        ← ALL Feature logic
│   │   └── index.ts        ← Core bot entry
│   ├── api/                ← Express API
├── dashboard/
│   ├── src/
│   │   ├── layouts/        ← Sidebar, Layout (Global)
│   │   ├── pages/          ← Plugin UIs (Plugin-specific)
│   │   └── theme/          ← Theme tokens
├── prisma/                 ← Database Schema
├── .github/                ← Project meta/config
├── README.md               ← Project Overview
├── INSTALL.md              ← Deployment Ops
└── AI_INSTRUCTIONS.md      ← Full project rules for AI agents
```

---

## 🎨 Frontend / Dashboard Rules

*   **Framework**: React 18 + Vite.
*   **Styling**: Plain CSS or inline styles using Theme Tokens (`colors`, `spacing`, `typography` from `theme.ts`).
*   **Icons**: Use `lucide-react` for all icons (modern, line-style). Do not use Emojis for UI elements.
*   **Mobile**: Always ensure layouts (grids, tables) are responsive. Use simple media queries.
*   **Guild Context:** Always use `selectedGuild` from `useAuth` (AuthProvider context) for the current guild in all dashboard plugin pages. Never use route params or fall back to undefined. This ensures the dashboard always has a valid, user-selected guild and prevents context errors.

## ⚙️ Backend Rules

*   **Database**: Prisma ORM. Do not write raw SQL unless necessary.
*   **Logging**: Use `this.logger.info()` injected into plugins. Never `console.log`.
*   **Config**: Defined in `configSchema` (Zod) within the plugin.

---

## 7. Frontend UI Standards
*   **Plugin Page Headers**: Must follow the standard pattern:
    ```tsx
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Icon size={32} color={colors.primary} style={{ marginRight: '16px' }} />
        <div>
            <h1 style={{ margin: 0 }}>Title</h1>
            <p style={{ margin: '4px 0 0', color: colors.textSecondary }}>Subtitle</p>
        </div>
    </div>
    ```
*   **Explanations**: All plugin settings pages must include a prominent explanation block below the header:
    ```tsx
    <div className="settings-explanation" style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.primary}` }}>
         <p style={{ margin: 0, color: colors.textPrimary }}>Explanation text...</p>
    </div>
    ```
*   **Dropdowns**: Use the `<ChannelSelect />` component for any channel selection. Do not use raw `<select>` or `<input>` for IDs.

## 🔄 Development Process

1.  **Analyze**: Understand if the request is Core (System) or Plugin (Feature).
2.  **Implementation**:
    *   If Plugin: Edit `src/bot/plugins/X.ts` and `dashboard/src/pages/X.tsx`.
    *   If Core: Edit `src/bot/core/` or `dashboard/src/layouts/`.
3.  **Refine**: Check Mobile responsiveness and Error Handling.
4.  **Deploy**: 
    - Commit changes (`git push`).
    - Instruct user to run the `ssh` pull command.

---

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
