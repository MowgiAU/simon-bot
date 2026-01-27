# ✅ Word Filter End-to-End Test - Quick Checklist

## Server Status
- [x] API Server: Running on :3001 
- [x] Dashboard: Running on :3000
- [x] Bot Server: Running (Node process detected)
- [x] Database: Connected (PostgreSQL)

---

## 🎯 Quick Test Steps (5-10 minutes)

### Phase 1: Dashboard → Database (2 min)
1. Open http://localhost:3000
2. Navigate to "Word Filter" sidebar
3. Create a word group:
   - Name: `Test Filter`
   - Replacement: `***`
   - Click "Create Word Group"
4. ✅ Check: Success message appears + group shows in list

### Phase 2: Add Words (2 min)
1. Click edit (📝) on "Test Filter" group
2. Type in "Add Word" field: `badword`
3. Click "Add Word"
4. Repeat for: `inappropriate`, `forbidden`
5. ✅ Check: All three words visible as tags

### Phase 3: Discord Test (3 min)
1. Go to your Discord test server
2. Send message: "This is a badword message"
3. ✅ Check: 
   - Original message deleted
   - New message appears with your avatar
   - Text shows: "This is a *** message"

### Phase 4: Edit Test (1 min)
1. Back to dashboard
2. Delete one word from group (click X)
3. Send test message in Discord again
4. ✅ Check: That word no longer filtered

### Phase 5: Delete Test (1 min)
1. Click delete button on group
2. Send filtered message in Discord
3. ✅ Check: Message stays (no longer filtered)

---

## 📋 What We're Testing

| Component | Testing | Expected |
|-----------|---------|----------|
| **Dashboard Form** | Can create word groups? | Form works, no JS errors |
| **API Endpoint** | Data saves to backend? | POST /api/word-filter/groups/:guildId succeeds |
| **Database** | Data persisted? | Rows appear in FilterWord + WordGroup tables |
| **Bot Plugin** | Catches words in Discord? | Message deleted + reposted with ***  |
| **Bidirectional** | Edit reflects in bot? | Changes instant, no restart needed |

---

## 🔍 If Something Fails

**Dashboard won't load:**
- Clear browser cache (Ctrl+Shift+Del)
- Check console (F12) for errors
- Restart dashboard: Ctrl+C then `npm run dev`

**API not saving:**
- Check DevTools Network tab (F12 → Network)
- Look for 400/500 errors on POST
- Check API terminal for error logs

**Bot not filtering:**
- Check bot has `Manage Messages` + `Send Messages` permission
- Check word group exists in database (`npm run db:studio`)
- Restart bot: Ctrl+C then `npm run dev`

**Word not matching:**
- Check spelling exactly (case-insensitive regex used)
- Ensure word boundaries (won't match substrings)
- Test with simple word first (`badword` vs `bad-word`)

---

## ⏱️ Estimated Time: 10-15 minutes

**Ready to go?** Open http://localhost:3000 and start! 🚀

