# Simon Bot

A modular, scalable Discord bot for the FL Studio music producer community (50k+ users).

## Architecture

**Plugin-Based System** - Every feature is a self-contained, enable/disable-able plugin:
- Plugins implement `IPlugin` interface
- Core system manages lifecycle, permissions, logging
- Plugins share database (PostgreSQL + Prisma)
- React dashboard with unified theming

**Key Components**:
- **Bot Core** (`src/bot/`) - Discord client, plugin lifecycle, event dispatch
- **API Server** (`src/api/`) - Express backend for dashboard
- **Dashboard** (`dashboard/`) - React frontend with Vuexy-inspired theme
- **Plugins** (`src/bot/plugins/`) - Feature implementations

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Discord bot token

### Setup

1. **Clone and install**:
   ```bash
   npm install
   cd dashboard && npm install && cd ..
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Discord token and database URL
   ```

3. **Setup database**:
   ```bash
   npm run db:push
   ```

### Development

**Terminal 1 - Bot**:
```bash
npm run dev
```

**Terminal 2 - API**:
```bash
npm run api:dev
```

**Terminal 3 - Dashboard**:
```bash
npm run dashboard:dev
```

Then open `http://localhost:3000` in your browser.

## Project Structure

```
src/
├── bot/
│   ├── core/           # Plugin manager, lifecycle
│   ├── plugins/        # Feature plugins
│   ├── types/          # IPlugin interface
│   ├── utils/          # Logger, plugin loader
│   └── index.ts        # Bot initialization
├── api/
│   └── index.ts        # Express server
dashboard/
├── src/
│   ├── layouts/        # Sidebar, global nav
│   ├── pages/          # Plugin UI sections
│   ├── theme/          # Design tokens
│   └── App.tsx
prisma/
└── schema.prisma       # Database schema
```

## Creating a New Plugin

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for detailed guide.

**Quick example**:

1. Create `src/bot/plugins/MyPlugin.ts` implementing `IPlugin`
2. Register in `src/bot/index.ts`
3. Add dashboard page in `dashboard/src/pages/`
4. Update database schema if needed: `npm run migrate`

## Plugins

### Word Filter (✅ Complete)

Detects and filters inappropriate words, reposts messages with replacements via webhook.

**Dashboard**: Word Filter Settings page  
**Commands**: Configure filter rules  
**Events**: messageCreate

### Planned

- **Leveling System** - XP tracking, levels, leaderboard
- **Currency System** - Balance, transactions, economy
- **Music Player** - Play, queue, skip (Lavalink integration)

## Theme

FL Studio inspired color scheme integrated throughout:
- Primary: `#2B8C71` (teal)
- Secondary: `#3E5922` (dark green)
- Accent: `#7A8C37` (olive)
- Highlight: `#F27B13` (orange)

See `dashboard/src/theme/theme.ts` for full token system.

## Database

PostgreSQL with Prisma ORM.

**Key tables**:
- `Guild` - Server configuration
- `Member` - User data (level, XP, currency)
- `FilterSettings`, `WordGroup`, `FilterWord` - Word filter data

**Migrations**:
```bash
npm run migrate      # Create new migration
npm run db:push      # Apply changes
npm run db:studio    # Visual editor
```

## Development Commands

```bash
npm run dev           # Start bot (watch mode)
npm run api:dev       # Start API server
npm run dashboard:dev # Start dashboard (Vite)
npm run build         # Compile for production
npm run type-check    # Type check all code
npm run db:studio     # Open database UI
```

## Deployment

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for complete setup with staging/production branching.

Quick reference:

1. **Local Development**: Uses `.env` and localhost
2. **Staging**: Push to `staging` branch → deploys to staging droplet
3. **Production**: Push to `main` branch → deploys to production droplet

### DigitalOcean Setup

See **[DIGITALOCEAN_SETUP.md](DIGITALOCEAN_SETUP.md)** for:
- Creating PostgreSQL databases
- Setting up Ubuntu droplets
- Installing Node.js & PM2
- Configuring GitHub Actions for auto-deployment

### Build for Production

```bash
npm run build
npm run dashboard:build
```

## Contributing

### Code Standards

- Use TypeScript strictly
- Follow plugin contract strictly
- Use shared database (Prisma client) via context
- Use theme tokens in dashboard (never hardcoded colors)
- Log via injected logger, never `console.log()`

### Adding Features

1. Create plugin implementing `IPlugin`
2. Add database schema (if needed)
3. Create dashboard UI using theme tokens
4. Update `.github/copilot-instructions.md` if adding core changes
5. Test with multiple guild configurations

## Support

For AI agents, see `.github/copilot-instructions.md` for comprehensive architecture guide.

---

**Last Updated**: January 27, 2026
