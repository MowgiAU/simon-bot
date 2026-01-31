# Fuji Studio - AI Instructions

**Project**: Modular Discord bot for 50k-user FL Studio music producer community.
**Project Name**: Fuji Studio (formerly Simon Bot).
**Architecture**: Plugin-based, TypeScript, Node.js, PostgreSQL, React dashboard.

---

## ⚠️ Critical Rules for AI Agents

1.  **Name Usage**: The bot is named **Fuji Studio**. Ensure all user-facing text references "Fuji Studio". Code folder names can remain `simon-bot`.
2.  **Deployment Awareness**:
    *   **Always** remind the user to run the pull command after significant changes.
    *   **Pull Command**:
        ```powershell
        ssh root@simon-bot-main "git pull && npm install && npm run build && npm run dashboard:build && pm2 restart all"
        ```
    *   **Dashboard Builds**: React builds consume high RAM. If a build fails with "Killed", check server swap space.

3.  **Plugin Architecture (Strict)**:
    *   Every feature **MUST** be a plugin (`src/bot/plugins/`).
    *   Plugins must implement `IPlugin`.
    *   **NO** direct dependencies between plugins.
    *   Plugins provide **Dashboard Content** (Pages), Core provides **Structure** (Layouts/Theme).
    *   **NEVER** use hardcoded colors. Use `src/theme/theme.ts`.

---

## 📂 File Structure

```
/
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
├── .github/                ← (Legacy)
├── README.md               ← Project Overview
├── INSTALL.md              ← Deployment Ops
└── AI_INSTRUCTIONS.md      ← YOU ARE HERE
```

---

## 🎨 Frontend / Dashboard Rules

*   **Framework**: React 18 + Vite.
*   **Styling**: Plain CSS or inline styles using Theme Tokens (`colors`, `spacing`, `typography` from `theme.ts`).
*   **Icons**: Use `lucide-react` for all icons (modern, line-style). Do not use Emojis for UI elements.
*   **Mobile**: Always ensure layouts (grids, tables) are responsive. Use simple media queries.

## ⚙️ Backend Rules

*   **Database**: Prisma ORM. Do not write raw SQL unless necessary.
*   **Logging**: Use `this.logger.info()` injected into plugins. Never `console.log`.
*   **Config**: Defined in `configSchema` (Zod) within the plugin.

---

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

**Last Updated**: January 31, 2026
**Maintained By**: Fuji Studio Team
