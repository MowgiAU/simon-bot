# Quick Reference Guide

## Project at a Glance

**Simon Bot** - Modular Discord bot for 50k-user FL Studio community  
**Tech**: Node.js + TypeScript, discord.js, PostgreSQL + Prisma, React + Vite  
**Architecture**: Plugin-based with unified dashboard

---

## File Locations Quick Lookup

| What | Where |
|------|-------|
| Plugin interface | `src/bot/types/plugin.ts` |
| Plugin manager | `src/bot/core/PluginManager.ts` |
| Example plugin (Word Filter) | `src/bot/plugins/WordFilterPlugin.ts` |
| Bot main file | `src/bot/index.ts` |
| API server | `src/api/index.ts` |
| Theme/colors | `dashboard/src/theme/theme.ts` |
| Sidebar (global nav) | `dashboard/src/layouts/Sidebar.tsx` |
| Word Filter UI | `dashboard/src/pages/WordFilterSettings.tsx` |
| Database schema | `prisma/schema.prisma` |
| Main docs for AI | `.github/copilot-instructions.md` |
| Project overview | `README.md` |

---

## Installation

```bash
# One-time setup
npm install
cd dashboard && npm install && cd ..
cp .env.example .env

# Edit .env with:
# - DISCORD_TOKEN=your_token
# - DATABASE_URL=postgresql://...
```

---

## Run Development

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run api:dev

# Terminal 3
npm run dashboard:dev
```

Open `http://localhost:3000`

---

## Database

```bash
npm run db:push          # Apply schema changes
npm run migrate          # Create new migration
npm run db:studio        # Visual editor
```

---

## Creating a Plugin - Template

### Step 1: Define Plugin

```typescript
// src/bot/plugins/MyPlugin.ts
import { IPlugin } from '../types/plugin';
import { z } from 'zod';

export class MyPlugin implements IPlugin {
  id = 'my-plugin';
  name = 'My Plugin';
  description = 'Does something cool';
  version = '1.0.0';
  author = 'You';
  
  requiredPermissions = ['SendMessages'];
  commands = [];
  events = ['messageCreate'];
  dashboardSections = ['my-settings'];
  defaultEnabled = true;
  
  configSchema = z.object({
    enabled: z.boolean().default(true),
  });

  async initialize(): Promise<void> {
    // Setup
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }

  async onMessage(message: Message): Promise<void> {
    // Handle message
  }
}

export default new MyPlugin();
```

### Step 2: Register in Bot

```typescript
// src/bot/index.ts
import MyPlugin from './plugins/MyPlugin';

// In start():
this.pluginManager.register(MyPlugin);
```

### Step 3: Add Dashboard Page

```typescript
// dashboard/src/pages/MySettings.tsx
import { colors, spacing } from '../theme/theme';

export const MySettings: React.FC = () => (
  <div style={{ padding: spacing.xl }}>
    <h2 style={{ color: colors.textPrimary }}>My Settings</h2>
    {/* Use colors, spacing, typography from theme */}
  </div>
);
```

### Step 4: Add to Sidebar

```tsx
// dashboard/src/layouts/Sidebar.tsx
<button onClick={() => onNavigate('my-settings')}>
  <span className="nav-icon">🎨</span>
  <span>My Plugin</span>
</button>
```

### Step 5: Add Database Tables (if needed)

```prisma
// prisma/schema.prisma
model MyData {
  id      String @id @default(cuid())
  guildId String
  data    String
  
  guild   Guild  @relation(fields: [guildId], references: [id], onDelete: Cascade)
  
  @@map("my_data")
}
```

Then: `npm run migrate`

---

## Theme Colors

All dashboard styling uses theme tokens:

```typescript
import { colors, spacing, typography } from '../theme/theme';

// ✅ RIGHT
<div style={{ 
  color: colors.textPrimary, 
  padding: spacing.lg 
}}>

// ❌ WRONG
<div style={{ 
  color: '#FFFFFF', 
  padding: '16px' 
}}>
```

**Color tokens**:
- `colors.primary` = `#2B8C71` (teal)
- `colors.secondary` = `#3E5922` (dark green)
- `colors.accent` = `#7A8C37` (olive)
- `colors.highlight` = `#F27B13` (orange)
- `colors.textPrimary`, `colors.textSecondary`, `colors.textTertiary`

**Spacing tokens**: `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `3xl`

---

## Common Commands

```bash
npm run dev                # Start bot (watch)
npm run api:dev            # Start API
npm run dashboard:dev      # Start dashboard
npm run build              # Compile TypeScript
npm run type-check         # Check types
npm run db:push            # Apply DB changes
npm run db:studio          # Open DB UI
npm run migrate            # Create migration
```

---

## Plugin Contract Checklist

Before calling your plugin done, verify:

- [ ] `id` - unique, immutable string
- [ ] `name`, `description`, `version`, `author`
- [ ] `requiredPermissions` - array of Discord permissions
- [ ] `commands` - array of command names
- [ ] `events` - array of Discord event names
- [ ] `dashboardSections` - array of section IDs
- [ ] `defaultEnabled` - boolean
- [ ] `configSchema` - Zod schema
- [ ] `initialize()` - async method
- [ ] `shutdown()` - async method
- [ ] Event handlers match declared events (e.g., `onMessage` for 'messageCreate')
- [ ] Dashboard page created and registered
- [ ] Database tables (if needed) in schema.prisma
- [ ] All styling uses theme tokens, never hardcoded colors

---

## Logging Pattern

```typescript
// ✅ RIGHT - Use injected logger
this.logger.info('Something happened', { userId, action });

// ❌ WRONG - Never console.log
console.log('Something happened');
```

---

## Database Query Pattern

```typescript
// ✅ RIGHT - Use context injected by core
const data = await this.context.db.myTable.findUnique({
  where: { id },
});

// ❌ WRONG - Direct Prisma import
import { PrismaClient } from '@prisma/client';
```

---

## Error Handling

```typescript
try {
  // Do something
} catch (error) {
  this.logger.error('Operation failed', error);
  throw error; // Let caller decide what to do
}
```

---

## Testing Your Plugin

1. Register in `src/bot/index.ts`
2. Set `defaultEnabled: true`
3. Run `npm run dev`
4. Check logs for initialization
5. Test Discord integration
6. Test dashboard UI loads

---

## Deploying

```bash
# Build
npm run build
npm run dashboard:build

# Set production .env
# - NODE_ENV=production
# - DATABASE_URL=prod_database_url
# - DISCORD_TOKEN=prod_token

# Run
npm start              # Bot
npm run api:dev        # API (separate process)
cd dashboard && npm run preview  # Dashboard (static serve)
```

---

## Need Help?

1. **Architecture questions** → `.github/copilot-instructions.md`
2. **Quick ref** → This file
3. **Getting started** → `README.md`
4. **Plugin pattern** → `src/bot/plugins/WordFilterPlugin.ts`
5. **Theme tokens** → `dashboard/src/theme/theme.ts`

---

*Last updated: Jan 27, 2026*
