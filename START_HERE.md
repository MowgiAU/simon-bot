# 📖 START HERE - Reading Guide

Your project is **fully scaffolded** and ready. Here's where to read based on your role:

---

## 👤 If You're a Human Developer

### Read These Files (In Order)

1. **[SCAFFOLDING_COMPLETE.md](SCAFFOLDING_COMPLETE.md)** ← **Start here** (5 min overview)
   - What was created
   - Quick start guide
   - Key principles

2. **[README.md](README.md)** (10 min)
   - Project overview
   - Development commands
   - Architecture summary

3. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** (Keep bookmarked)
   - Common tasks
   - Plugin template
   - Theme usage

Then start developing:
```bash
npm install && cd dashboard && npm install && cd ..
npm run dev           # Terminal 1
npm run api:dev       # Terminal 2
npm run dashboard:dev # Terminal 3
```

---

## 🤖 If You're an AI Coding Agent (Copilot/Claude)

### Read These Files (In Order)

1. **[`.github/copilot-instructions.md`](.github/copilot-instructions.md)** ← **CRITICAL**
   - Complete architecture guide
   - Plugin creation step-by-step
   - Code patterns and conventions
   - Safety checks before changes
   - 370 lines, comprehensive

2. **[src/bot/types/plugin.ts](src/bot/types/plugin.ts)** (Reference)
   - IPlugin interface - the contract
   - Read when creating plugins

3. **[src/bot/plugins/WordFilterPlugin.ts](src/bot/plugins/WordFilterPlugin.ts)** (Example)
   - Reference implementation
   - Follow this pattern for new plugins

4. **[dashboard/src/theme/theme.ts](dashboard/src/theme/theme.ts)** (Reference)
   - Design tokens
   - Use these, never hardcoded colors

5. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** (Cheat sheet)
   - Template snippets
   - Common patterns
   - Plugin checklist

### When Creating Features

- **Creating a plugin?** → Use `.github/copilot-instructions.md` section "How to Create a New Plugin"
- **Adding dashboard UI?** → Reference `dashboard/src/pages/WordFilterSettings.tsx`
- **Adding database tables?** → Look at `prisma/schema.prisma` pattern
- **Styling dashboard?** → Always use `dashboard/src/theme/theme.ts` tokens
- **Logging?** → Use injected logger, never `console.log()`

---

## 📚 Complete File Reference

### Core Architecture
- **`.github/copilot-instructions.md`** - 🟥 **READ THIS FIRST** if you're an AI
- **`src/bot/types/plugin.ts`** - Plugin interface definition
- **`src/bot/core/PluginManager.ts`** - Plugin lifecycle management
- **`src/bot/index.ts`** - Bot initialization and event dispatch

### First Plugin (Reference Implementation)
- **`src/bot/plugins/WordFilterPlugin.ts`** - Word filter plugin
- **`prisma/schema.prisma`** - Database schema (FilterSettings, WordGroup, FilterWord tables)

### Dashboard
- **`dashboard/src/theme/theme.ts`** - Design tokens (colors, spacing, typography)
- **`dashboard/src/layouts/Sidebar.tsx`** - Global navigation
- **`dashboard/src/pages/WordFilterSettings.tsx`** - Plugin UI example

### Configuration
- **`package.json`** - Root dependencies
- **`dashboard/package.json`** - Frontend dependencies
- **`tsconfig.json`** - TypeScript config
- **`prisma/schema.prisma`** - Database schema
- **`.env.example`** - Environment variables template

### Documentation
- **`SCAFFOLDING_COMPLETE.md`** - This scaffolding summary
- **`README.md`** - Project overview
- **`QUICK_REFERENCE.md`** - Common tasks and patterns
- **`PROJECT_SUMMARY.md`** - Detailed breakdown

---

## 🎯 Common Tasks - Where to Look

| I want to... | Read this |
|---|---|
| Understand the architecture | `.github/copilot-instructions.md` |
| Create a new plugin | `.github/copilot-instructions.md` + `QUICK_REFERENCE.md` |
| Add dashboard UI | `src/pages/WordFilterSettings.tsx` as example |
| Use design tokens | `dashboard/src/theme/theme.ts` |
| Understand plugin contract | `src/bot/types/plugin.ts` |
| See plugin pattern | `src/bot/plugins/WordFilterPlugin.ts` |
| Start development | `QUICK_REFERENCE.md` "Quick Start" section |
| Understand database | `prisma/schema.prisma` |
| Deploy to production | `README.md` "Deployment" section |

---

## 🚀 Quick Start Reminder

```bash
# 1. Install
npm install && cd dashboard && npm install && cd ..

# 2. Configure
cp .env.example .env
# Edit .env with your Discord token and database URL

# 3. Setup database
npm run db:push

# 4. Develop (3 terminals)
npm run dev           # Bot
npm run api:dev       # API
npm run dashboard:dev # Dashboard @ http://localhost:3000
```

---

## ✅ What's Ready to Use

- ✅ Plugin system (ready for unlimited plugins)
- ✅ First plugin (Word Filter - complete)
- ✅ Dashboard theme and layout (Vuexy inspired)
- ✅ Database schema (PostgreSQL + Prisma)
- ✅ API server (Express)
- ✅ Development workflow (watch modes, hot reload)
- ✅ Documentation (comprehensive)

---

## ❓ Help Me Decide

**Are you:**

- [ ] **Just exploring** → Read `SCAFFOLDING_COMPLETE.md` (5 min)
- [ ] **Setting up locally** → Read `README.md` and `QUICK_REFERENCE.md`
- [ ] **Creating a plugin** → Read `.github/copilot-instructions.md` + `QUICK_REFERENCE.md`
- [ ] **An AI agent** → Read `.github/copilot-instructions.md` FIRST
- [ ] **Deploying to production** → Read `README.md` Deployment section
- [ ] **Contributing features** → Read `.github/copilot-instructions.md` → Safety Checks

---

## 📞 Still Have Questions?

1. Check `QUICK_REFERENCE.md`
2. Reference `src/bot/plugins/WordFilterPlugin.ts` for patterns
3. Read `.github/copilot-instructions.md` for architecture
4. Look at `dashboard/src/theme/theme.ts` for styling

---

**Status**: 🟢 Project is ready for development  
**Next**: Choose a starting point above and begin! 🚀
