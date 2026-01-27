# 🚀 Phase 1: End-to-End Testing - Getting Started

## Current Status ✅
- **API Server**: Running on http://localhost:3001
- **Dashboard**: Running on http://localhost:3000  
- **Bot Server**: Running (connected to Discord)
- **Database**: Connected (PostgreSQL via Railway)
- **All 3 Servers**: Operational and communicating

---

## System Architecture Overview

```
┌──────────────────┐
│   Dashboard UI   │ ← http://localhost:3000
│  (React + Vite)  │   Create/edit word groups
└────────┬─────────┘
         │ API calls
         ↓
┌──────────────────┐
│   API Server     │ ← http://localhost:3001
│  (Express.js)    │   REST endpoints for word filter
└────────┬─────────┘
         │ Prisma ORM
         ↓
┌──────────────────┐
│    Database      │ ← PostgreSQL (Railway)
│  (PostgreSQL)    │   Stores word groups & words
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│   Bot Server     │ ← Discord Connection
│  (discord.js)    │   Listens for filtered words
└──────────────────┘
         │
         ↓
┌──────────────────┐
│    Discord       │
│    Messages      │ ← Real-time filtering happens here
└──────────────────┘
```

---

## What We're Testing Today

### Test Flow: Dashboard → API → Database → Discord Bot

1. **Create Word Group on Dashboard**
   - HTTP POST → API → Prisma → Database
   - ✅ Verify data saves

2. **Add Words to Group**
   - HTTP POST → API → Prisma → Database
   - ✅ Verify words appear in dashboard list

3. **Bot Filters Messages in Discord**
   - Bot queries database → Checks for filtered words
   - ✅ Verify message deleted + reposted with ***

4. **Edit/Delete Groups**
   - Dashboard changes → API updates → Database changes
   - ✅ Verify bot immediately reflects changes

---

## Pre-Test Checklist

Before you start, verify:

- [ ] **Dashboard loads**: Open http://localhost:3000
- [ ] **Can see "Word Filter" in sidebar**: Navigation works
- [ ] **Bot is in your test Discord server**: Check member list
- [ ] **Bot has permissions**: 
  - [ ] Manage Messages (to delete original)
  - [ ] Send Messages (to repost)
  - [ ] Create Webhooks (to impersonate user)
- [ ] **Test channel is accessible**: Where you'll test filtering

---

## Quick Commands Reference

```bash
# Watch bot logs (troubleshoot filtering issues)
cd h:\Simon Bot\new-simon
npm run dev

# Watch API logs (troubleshoot API/database issues)
npm run api:dev

# Watch Dashboard (troubleshoot UI issues)
cd dashboard
npm run dev

# View database directly
npm run db:studio

# Check if servers running
netstat -ano | findstr ":3000\|:3001"
```

---

## API Endpoints We'll Be Testing

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/word-filter/settings/:guildId` | Fetch word filter settings |
| `POST` | `/api/word-filter/groups/:guildId` | Create word group |
| `PUT` | `/api/word-filter/groups/:guildId/:groupId` | Edit word group |
| `DELETE` | `/api/word-filter/groups/:guildId/:groupId` | Delete word group |
| `POST` | `/api/word-filter/groups/:guildId/:groupId/words` | Add word to group |
| `DELETE` | `/api/word-filter/groups/:guildId/:groupId/words/:wordId` | Remove word |

---

## Database Tables We'll Check

**WordGroup** (created word groups)
```
id: string (cuid)
guildId: string (reference to Guild)
name: string (e.g., "Inappropriate Words")
replacementText: string (e.g., "***")
replacementEmoji: string (e.g., "🤐")
useEmoji: boolean
createdAt: timestamp
updatedAt: timestamp
```

**FilterWord** (individual words in groups)
```
id: string (cuid)
groupId: string (reference to WordGroup)
word: string (lowercase, e.g., "badword")
createdAt: timestamp
```

---

## Expected Test Results

### ✅ Success Looks Like:
- Dashboard form submits without errors
- Word group appears in list with all words
- In Discord: message deleted → new message appears with user's avatar
- Text replaced: "badword" → "***"
- Multiple words in one message: "badword badword" → "*** ***"

### ❌ Failure Looks Like:
- Form doesn't submit (check Network tab in DevTools)
- Word group doesn't appear in list
- In Discord: message stays (not deleted)
- Console shows JavaScript errors
- API returns 400/500 status

---

## Next: Run the Test!

👉 **Open http://localhost:3000 and follow the checklist in `E2E_QUICK_TEST.md`**

Estimated time: **10-15 minutes**

Once complete, update the todo list and we'll move to **Infrastructure Setup**.

