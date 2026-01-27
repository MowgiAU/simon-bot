# 🧪 Phase 1: End-to-End Testing - Complete Guide

> **Objective**: Verify the entire word filter system works from dashboard UI through Discord bot message filtering
>
> **Time Estimate**: 15-20 minutes  
> **Difficulty**: Easy (follow the checklist)

---

## 📋 Documentation Files (in order)

1. **THIS FILE** - Overview & quick start
2. **`E2E_QUICK_TEST.md`** - 5-minute quick reference
3. **`TESTING_GUIDE.md`** - Detailed system architecture & setup
4. **`E2E_TEST_PLAN.md`** - Comprehensive test scenarios
5. **`E2E_EXECUTION_CHECKLIST.md`** - Step-by-step checklist (USE THIS!)

---

## 🚀 Quick Start (2 minutes)

### Prerequisite: All Servers Running ✅

```bash
# Terminal 1: Bot
cd h:\Simon Bot\new-simon
npm run dev

# Terminal 2: API  
npm run api:dev

# Terminal 3: Dashboard
cd dashboard
npm run dev
```

**Check servers are running**:
- http://localhost:3000 (Dashboard) - Should load
- http://localhost:3001/health (API) - Should return `{"status":"ok"}`
- Bot in Discord - Should show online

---

### Test Flow (5 phases)

| Phase | What | Where | Time |
|-------|------|-------|------|
| 1️⃣ | Create word group | Dashboard | 2 min |
| 2️⃣ | Add words to group | Dashboard | 2 min |
| 3️⃣ | Filter message | Discord | 2 min |
| 4️⃣ | Edit/Delete group | Dashboard + Discord | 2 min |
| 5️⃣ | Edge cases | Edge cases | 2 min |

---

## 🎯 What Gets Tested

### Data Flow: Dashboard → API → Database → Discord Bot

```
User creates word group in Dashboard
                ↓
API receives POST request
                ↓
Prisma saves to PostgreSQL
                ↓
Bot queries database on message
                ↓
Bot detects filtered word
                ↓
Bot deletes original message
                ↓
Bot reposts with replacement text (***) 
using user's avatar & username
```

### Success Criteria ✅

- [ ] **Dashboard Form Works**: Can create groups without errors
- [ ] **Data Persists**: Groups appear in list after refresh
- [ ] **Database Saves**: Rows appear in PostgreSQL
- [ ] **Bot Filters**: Message deleted + reposts with ***
- [ ] **Edits Apply**: Changes take effect immediately (no restart needed)
- [ ] **Deletions Work**: Filtering stops when group deleted
- [ ] **API Fast**: Response time < 500ms

---

## 🔧 How to Execute

### Option A: Follow Quick Guide (5 min)
1. Read `E2E_QUICK_TEST.md`
2. Execute each step
3. Record results

### Option B: Follow Detailed Checklist (20 min)
1. Use `E2E_EXECUTION_CHECKLIST.md`
2. Check off each test
3. Record any failures
4. Troubleshoot as needed

### Option C: Run Full Test Plan (30 min)
1. Read `E2E_TEST_PLAN.md` for context
2. Execute all scenarios
3. Document edge cases
4. Report comprehensive results

---

## 📊 What To Check

### Dashboard Level
- Form validation (required fields)
- Success/error messages
- Data displays correctly
- No JavaScript errors (F12 → Console)

### API Level
- HTTP status codes (201 for create, 200 for update)
- Response contains all data
- No server errors (500 status)
- Response time < 500ms

### Database Level
- WordGroup table has new row
- FilterWord table has word rows
- Foreign keys reference correctly
- Data matches what's in dashboard

### Bot Level
- Message detected as filtered (check console)
- Original message deleted
- New message appears with user info
- Text replaced correctly
- No JS errors in bot terminal

---

## 🐛 Common Issues & Fixes

### Dashboard Form Won't Submit
**Check**:
- Network tab (F12) shows what error?
- API running on :3001?
- Database connected?
- Try clearing browser cache

### Bot Not Filtering Messages
**Check**:
- Word filter enabled in settings?
- Word group exists in database?
- Bot has `Manage Messages` permission?
- Check bot console for errors
- Try restarting bot

### API Returning 404/500
**Check**:
- Guild ID matches in request?
- Database has FilterSettings row for guild?
- Prisma connection working?
- Check API console for errors

### Can't See Changes in Dashboard
**Check**:
- Try refreshing page (F5)
- Network tab for failed requests
- Browser console (F12) for JS errors
- Clear browser cache

---

## 📈 Success Metrics

After completing the test, answer:

1. **Could you create a word group?** YES / NO
2. **Could you add words to the group?** YES / NO
3. **Did the bot catch filtered words in Discord?** YES / NO
4. **Did edits take effect immediately?** YES / NO
5. **Did the dashboard survive refresh?** YES / NO

**If YES to all 5**: ✅ **PHASE 1 COMPLETE** - Move to Infrastructure Setup

**If NO to any**: ⚠️ **Debug using checklist** - Fix issue and retry

---

## 📝 How to Document Results

Use `E2E_EXECUTION_CHECKLIST.md`:

1. Check off each step as you complete it
2. Mark PASS/FAIL for each section
3. Note any errors in "Actual Result" fields
4. List issues found at bottom
5. Sign off when complete

Then update the todo list:

```bash
# Update todo.md to mark Phase 1 complete
# Then proceed to Phase 2: Infrastructure Setup
```

---

## 🎓 Learning Outcomes

After this test, you'll understand:

✅ How dashboard UI connects to backend API  
✅ How API saves to database via Prisma  
✅ How bot queries database in real-time  
✅ How plugin systems dispatch events  
✅ How to troubleshoot full-stack issues  

---

## ⏱️ Time Breakdown

| Task | Time |
|------|------|
| Read documentation | 2 min |
| Create word group | 2 min |
| Add words | 2 min |
| Test in Discord | 2 min |
| Edit/delete test | 2 min |
| Edge cases | 2 min |
| Documentation | 2 min |
| **TOTAL** | **~15 min** |

---

## 🚀 Next Steps After Phase 1

Once you pass all tests:

1. ✅ Update todo list (mark Phase 1 complete)
2. 📊 Review infrastructure requirements
3. 🖥️ Set up DigitalOcean droplets
4. 🔄 Deploy to staging environment
5. 🧪 Test full pipeline

---

## 📞 Troubleshooting Help

**Problem**: X is not working  
**Solution**:
1. Read relevant section in `E2E_EXECUTION_CHECKLIST.md`
2. Check bot/API console for error messages
3. Verify database has required rows (`npm run db:studio`)
4. Restart the failing server (Ctrl+C then npm run dev)
5. If still stuck, check specific documentation file

---

## 🎯 You're Ready!

**Next Step**: Open `E2E_EXECUTION_CHECKLIST.md` and start testing! 🚀

Questions? Check the specific documentation files above.

---

**Created**: January 27, 2026  
**For**: Simon Bot End-to-End Testing  
**Difficulty**: Beginner-Friendly ✨

