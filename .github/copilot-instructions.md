# Simon Bot - AI Coding Agent Instructions

**Project**: Modular Discord bot for 50k-user FL Studio music producer community.  
**Architecture**: Plugin-based, TypeScript, Node.js, PostgreSQL, React dashboard.

---

## Critical Architecture Overview

### The Plugin-First Model

Every feature **MUST** be a self-contained plugin implementing the `IPlugin` interface. Plugins are NOT permitted to directly depend on other plugins.

**Plugin Contract** (required fields in [src/bot/types/plugin.ts](src/bot/types/plugin.ts)):
- `id`: Unique, immutable plugin identifier
- `name`, `description`, `version`, `author`
- `requiredPermissions`: Discord permissions (PermissionResolvable[])
- `commands`: Array of slash commands this plugin registers
- `events`: Array of Discord events it listens to (e.g., "messageCreate")
- `dashboardSections`: Array of dashboard UI sections (e.g., ["word-filter-settings"])
- `defaultEnabled`: Whether enabled on bot startup
- `configSchema`: Zod schema for plugin config validation
- `initialize()`: Called when bot starts or plugin is reloaded
- `shutdown()`: Called when bot shuts down or plugin disabled

**Validation**: [PluginManager.ts](src/bot/core/PluginManager.ts) validates every plugin implements this fully. Incomplete contracts are rejected at registration.

### Separation of Concerns

| Responsibility | Owner | Files |
|---|---|---|
| Plugin lifecycle, enable/disable, reloading | Core ([PluginManager.ts](src/bot/core/PluginManager.ts)) | `src/bot/core/` |
| Global permissions, role checks, Discord auth | Core | `src/api/index.ts` |
| Bot event dispatch (messageCreate, guildCreate, etc.) | Core ([index.ts](src/bot/index.ts)) | `src/bot/index.ts` |
| Dashboard layout, navigation, theming | Core | `dashboard/src/layouts/`, `dashboard/src/theme/` |
| Plugin-specific logic only | Plugin | `src/bot/plugins/PluginName.ts` |
| Plugin dashboard content (never layout) | Plugin | `dashboard/src/pages/` |

**Key Rule**: Plugins provide **content**, core provides **structure**. If a plugin attempts custom layout/styling, reject and adapt to global system.

### Database Schema

Plugins share the Prisma client from `src/api/index.ts` and database tables defined in [prisma/schema.prisma](prisma/schema.prisma).

**Core tables**:
- `Guild`: Server config, one per Discord server
- `Member`: User levels, XP, currency (leveling/economy systems)
- `FilterSettings`, `WordGroup`, `FilterWord`: Word filter plugin tables

**For new plugins**: Add tables to `prisma/schema.prisma`, then run `npm run migrate`.

### Dashboard - Global System, Not Per-Plugin

The dashboard is **one unified interface**, not a collection of plugin-specific dashboards.

**Structure**:
- **Sidebar** ([Sidebar.tsx](dashboard/src/layouts/Sidebar.tsx)): Global navigation. Add plugin routes here centrally.
- **Theme** ([theme.ts](dashboard/src/theme/theme.ts)): Single color palette, spacing, typography used by ALL pages.
- **Pages** ([src/pages/](dashboard/src/pages/)): Plugin-specific pages rendered in main content area.

**Plugin Dashboard Integration**:
1. Plugin declares `dashboardSections: ["word-filter-settings"]`
2. Create page component: `dashboard/src/pages/WordFilterSettings.tsx`
3. Register in Sidebar navigation
4. Use global `colors`, `spacing`, `typography` from theme - **never custom CSS**
5. Styles in `WordFilterSettings.css` inherit from [theme.ts](dashboard/src/theme/theme.ts)

**Color Scheme** (FL Studio inspired):
- Primary: `#2B8C71` (teal)
- Secondary: `#3E5922` (dark green)
- Accent: `#7A8C37` (olive)
- Highlight: `#F27B13` (orange)
- Tertiary: `#593119` (brown)

See [theme.ts](dashboard/src/theme/theme.ts) for all tokens.

---

## How to Create a New Plugin

### 1. Define the Plugin Class

```typescript
// src/bot/plugins/ExamplePlugin.ts
import { IPlugin } from '../types/plugin';
import { z } from 'zod';

export class ExamplePlugin implements IPlugin {
  id = 'example';
  name = 'Example Plugin';
  description = 'Example plugin for demonstration';
  version = '1.0.0';
  author = 'Your Name';
  
  requiredPermissions = ['SendMessages'];
  commands = ['example'];
  events = ['messageCreate'];
  dashboardSections = ['example-settings'];
  defaultEnabled = false;
  
  configSchema = z.object({
    enabled: z.boolean().default(true),
    setting1: z.string().optional(),
  });

  async initialize(): Promise<void> {
    // Setup: connect listeners, initialize state
  }

  async shutdown(): Promise<void> {
    // Cleanup: unregister listeners, flush caches
  }
  
  async onMessageCreate(message: Message): Promise<void> {
    // Handle messageCreate event
  }
}

export default new ExamplePlugin();
```

### 2. Register Plugin in Core

In [src/bot/index.ts](src/bot/index.ts), add:
```typescript
import ExamplePlugin from './plugins/ExamplePlugin';
// In start():
this.pluginManager.register(ExamplePlugin);
```

### 3. Add Dashboard Section (if needed)

Create `dashboard/src/pages/ExampleSettings.tsx`:
```typescript
import React from 'react';
import { colors, spacing } from '../theme/theme';

export const ExampleSettings: React.FC = () => {
  return (
    <div style={{ padding: spacing.xl }}>
      <h2 style={{ color: colors.textPrimary }}>Example Settings</h2>
      {/* Use theme tokens only, never hardcoded colors */}
    </div>
  );
};
```

Add to Sidebar in [Sidebar.tsx](dashboard/src/layouts/Sidebar.tsx):
```tsx
<button className="nav-item" onClick={() => onNavigate('example-settings')}>
  <span className="nav-icon">🔧</span>
  <span>Example</span>
</button>
```

### 4. Add Database Schema (if needed)

In [prisma/schema.prisma](prisma/schema.prisma):
```prisma
model ExampleData {
  id        String   @id @default(cuid())
  guildId   String
  data      String
  createdAt DateTime @default(now())

  guild     Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)
  
  @@map("example_data")
}
```

Then: `npm run migrate`

---

## Word Filter Plugin - Reference Implementation

The Word Filter plugin is the **first production plugin**. Use it as a template.

**Location**: [src/bot/plugins/WordFilterPlugin.ts](src/bot/plugins/WordFilterPlugin.ts)

**Key patterns**:
- Implements full `IPlugin` interface
- Registers `messageCreate` event listener
- Queries database for guild settings
- Modifies messages (delete + webhook repost)
- Dashboard settings page: [WordFilterSettings.tsx](dashboard/src/pages/WordFilterSettings.tsx)
- Uses theme tokens exclusively

**Database integration**:
- Reads `FilterSettings`, `WordGroup`, `FilterWord` tables
- All queries use Prisma client from context

---

## Command Running & Development

### Start Bot Development
```bash
npm run dev  # Runs src/bot/index.ts with auto-reload (tsx watch)
```

### Start API Server
```bash
npm run api:dev  # Express server on :3001
```

### Start Dashboard
```bash
cd dashboard && npm run dev  # Vite dev server on :3000
```

### Database
```bash
npm run db:push      # Apply schema changes
npm run migrate      # Create migration file
npm run db:studio    # Visual database explorer
```

### Build for Production
```bash
npm run build        # Compile TypeScript
npm run dashboard:build
```

---

## Critical Patterns & Conventions

### 1. Never Hardcode Configuration

All settings **must** be either:
- Environment variables (`.env`)
- Database records (Prisma queries)
- Plugin config schema + dashboard UI

### 2. Event Dispatching to Plugins

Core bot dispatches events. Plugins listen. Example:
```typescript
// src/bot/index.ts
this.client.on('messageCreate', async message => {
  const plugins = this.pluginManager.getEnabled();
  for (const plugin of plugins) {
    if (plugin.events.includes('messageCreate') && plugin.onMessage) {
      await plugin.onMessage(message);
    }
  }
});
```

### 3. Dashboard Components - Always Use Theme Tokens

❌ **Wrong**:
```tsx
<div style={{ color: '#FFF', padding: '16px' }}>
```

✅ **Right**:
```tsx
import { colors, spacing } from '../theme/theme';
<div style={{ color: colors.textPrimary, padding: spacing.lg }}>
```

### 4. Database Access

Plugins receive Prisma client via context:
```typescript
const settings = await this.context.db.filterSettings.findUnique({
  where: { guildId: message.guildId },
});
```

**No direct Prisma imports in plugins** - use injected context.

### 5. Logging

Always use the injected logger:
```typescript
this.logger.info('Message', data);
this.logger.error('Error occurred', error);
```

Never use `console.log()`.

---

## Critical Safety Checks

### Before Modifying Core Files

Ask these questions:
1. **Does this break plugin contracts?** Plugins must not be forced to change.
2. **Is this a plugin concern?** Move to plugin if yes.
3. **Does this add new global behavior?** Update documentation and add to [#](#-critical-architecture-overview) Architecture Overview.
4. **Will existing plugins break?** Check all plugin usages.

### Before Creating a Plugin

1. **Does this fit the contract?** All required fields must be filled.
2. **Will it coexist with other plugins?** No shared state, no direct dependencies.
3. **Is the database schema minimal?** Keep tables focused; use JSON fields sparingly.
4. **Does the dashboard follow the theme?** Use `colors`, `spacing`, `typography` tokens only.

---

## File Structure Reference

```
h:\Simon Bot\new-simon\
├── src/
│   ├── bot/
│   │   ├── core/
│   │   │   └── PluginManager.ts          ← Plugin lifecycle
│   │   ├── plugins/
│   │   │   └── WordFilterPlugin.ts       ← Reference plugin
│   │   ├── types/
│   │   │   └── plugin.ts                 ← IPlugin interface
│   │   ├── utils/
│   │   │   ├── logger.ts                 ← Logging
│   │   │   └── PluginLoader.ts           ← Load plugins from disk
│   │   └── index.ts                      ← Bot initialization
│   ├── api/
│   │   └── index.ts                      ← Express server
├── dashboard/
│   ├── src/
│   │   ├── layouts/
│   │   │   └── Sidebar.tsx               ← Global navigation
│   │   ├── pages/
│   │   │   └── WordFilterSettings.tsx    ← Plugin settings UI
│   │   ├── theme/
│   │   │   └── theme.ts                  ← Global design tokens
├── prisma/
│   └── schema.prisma                     ← Database schema
├── package.json                          ← Root dependencies
└── .github/
    └── copilot-instructions.md           ← This file
```

---

## External Dependencies & Integration

| Package | Version | Use |
|---------|---------|-----|
| `discord.js` | ^14.14 | Discord API client |
| `@prisma/client` | ^5.7 | Database ORM |
| `zod` | ^3.22 | Config validation |
| `express` | ^4.18 | Dashboard API |
| `react` | ^18.2 | Dashboard UI |
| `pino` | ^8.17 | Structured logging |

**No plugins should add new top-level dependencies**. Request dependencies via PR to root `package.json`.

---

## Next Steps for Developers

1. ✅ **Word Filter Plugin** is complete and fully functional
2. 📋 **Leveling System**: Create plugin with XP/level tracking, leaderboard
3. 💰 **Currency System**: Create plugin with balance, transactions, shop
4. 🎵 **Music Commands**: Create plugin with play/queue/skip (requires Lavalink)

Each follows the same pattern: IPlugin contract → Database schema → Dashboard UI.

---

**Last Updated**: January 27, 2026  
**Maintained By**: Simon Bot Core Team
