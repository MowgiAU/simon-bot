# ✅ End-to-End Test Execution Checklist

**Started**: _____________  
**Completed**: _____________  
**Tested By**: _____________

---

## Phase 1: Dashboard Form ✍️

### Section 1.1: Access Dashboard
- [ ] Navigate to http://localhost:3000
- [ ] Dashboard loads without errors
- [ ] Sidebar visible on left
- [ ] "Word Filter" menu item visible
- [ ] Click "Word Filter" to navigate

**Status**: PASS / FAIL  
**Notes**: _______________________________________________

---

### Section 1.2: Create First Word Group
**Action**: Fill in the "Create Word Group" form

| Field | Value | Status |
|-------|-------|--------|
| Group Name | `TestGroup1` | [ ] Filled |
| Replacement Text | `***` | [ ] Filled |
| Use Emoji | OFF | [ ] Unchecked |
| | | |
| **Action** | Click "Create Word Group" | [ ] Clicked |

**Expected Result**:
- [ ] Green success message appears
- [ ] "TestGroup1" appears in list below form
- [ ] Form fields clear
- [ ] No console errors (F12 → Console)

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL  
**If FAIL - check**:
- [ ] Network tab shows POST succeeded (200/201)
- [ ] API console shows no errors
- [ ] Database connected

---

## Phase 2: Add Words to Group 📝

### Section 2.1: Edit Word Group

- [ ] Locate "TestGroup1" in the list
- [ ] Click edit button (pencil icon 📝)
- [ ] Group enters edit mode with form fields

**Status**: PASS / FAIL

---

### Section 2.2: Add First Word

**Action**: Add word `badword`

| Step | Action | Status |
|------|--------|--------|
| 1 | Type `badword` in "Add Word" field | [ ] |
| 2 | Click "Add Word" button | [ ] |
| 3 | Wait for word to appear | [ ] |

**Expected Result**:
- [ ] Word appears as a tag/badge below
- [ ] Field clears
- [ ] No error message
- [ ] Word appears in database

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

---

### Section 2.3: Add More Words

**Action**: Repeat for these words:

| Word | Added | Status | Notes |
|------|-------|--------|-------|
| `inappropriate` | [ ] | PASS/FAIL | |
| `forbidden` | [ ] | PASS/FAIL | |
| `censored` | [ ] | PASS/FAIL | |

**Overall Status**: PASS / FAIL

---

### Section 2.4: Verify Database

**Action**: Check database directly

```bash
npm run db:studio  # Opens Prisma Studio
```

- [ ] Open http://localhost:5555
- [ ] Navigate to "WordGroup" table
- [ ] Find row with `name: "TestGroup1"`
- [ ] Navigate to "FilterWord" table  
- [ ] See 4 rows with words: badword, inappropriate, forbidden, censored
- [ ] Each has correct `groupId` reference

**Database Status**: PASS / FAIL  
**Notes**: _________________________________________________

---

## Phase 3: Discord Bot Testing 🤖

### Section 3.1: Setup Discord Test

**Prerequisites**:
- [ ] Bot is in your test Discord server
- [ ] Have a test channel available
- [ ] Bot has these permissions:
  - [ ] Manage Messages
  - [ ] Send Messages
  - [ ] Create Webhooks

**Setup Status**: PASS / FAIL

---

### Section 3.2: Test Normal Message (Baseline)

**Action**: Send message in Discord

```
Message: "This is a normal message"
```

**Expected Result**:
- [ ] Message appears normally
- [ ] No deletion
- [ ] No reposting

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

---

### Section 3.3: Test Single Filtered Word

**Action**: Send message in Discord

```
Message: "This is a badword message"
```

**Expected Result**:
- [ ] Original message **DELETED**
- [ ] New message appears by the bot
- [ ] New message has **your avatar**
- [ ] New message has **your username**
- [ ] Text shows: `"This is a *** message"`
- [ ] No errors in bot console

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

**If FAIL - troubleshoot**:
- [ ] Bot console (terminal): Any error logs?
- [ ] Check bot permissions in Discord server
- [ ] Check bot has webhook permissions
- [ ] Check word filter is enabled in settings

---

### Section 3.4: Test Multiple Words

**Action**: Send message in Discord

```
Message: "This message has inappropriate and forbidden content"
```

**Expected Result**:
- [ ] Original message deleted
- [ ] New message appears
- [ ] Both words replaced: `"This message has *** and *** content"`

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

---

### Section 3.5: Test Case-Insensitive Matching

**Action**: Send message in Discord

```
Message: "This has BADWORD and Forbidden words"
```

**Expected Result**:
- [ ] Both words matched (case-insensitive)
- [ ] Result: `"This has *** and *** words"`

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

---

### Section 3.6: Test Word Boundaries

**Action**: Send message in Discord

```
Message: "I like baseball and the wooden bat"
```

(Note: We have `bat` and `badword` in the filter)

**Expected Result**:
- [ ] "bat" in "baseball" is NOT matched (not a word boundary)
- [ ] "bat" as standalone word IS matched
- [ ] Result: `"I like baseball and the wooden ***"`

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

---

## Phase 4: Edit & Persistence Testing 🔄

### Section 4.1: Edit Word Group Name

**Action**: Go back to dashboard, edit group name

- [ ] Click edit button on "TestGroup1"
- [ ] Change name to "TestGroup1_Updated"
- [ ] Click save/update
- [ ] Name updates in list

**Status**: PASS / FAIL

---

### Section 4.2: Remove a Word

**Action**: Delete one word from group

- [ ] Locate "TestGroup1_Updated" 
- [ ] Click edit button
- [ ] Find "inappropriate" word
- [ ] Click X/delete button on the word
- [ ] Word disappears from list

**Status**: PASS / FAIL

---

### Section 4.3: Test Immediate Filter Change

**Action**: In Discord, test that change is immediate

```
Message: "This is inappropriate content"
```

**Expected Result**:
- [ ] Message stays (word removed, no longer filtered)
- [ ] No deletion/reposting

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

---

### Section 4.4: Delete Entire Group

**Action**: Delete the word group

- [ ] Locate "TestGroup1_Updated"
- [ ] Click delete button
- [ ] Confirm deletion
- [ ] Group disappears from list

**Status**: PASS / FAIL

---

### Section 4.5: Test Filtering Stopped

**Action**: In Discord, send previously filtered word

```
Message: "This is a badword message"
```

**Expected Result**:
- [ ] Message stays (group deleted, no longer filters)
- [ ] No deletion/reposting

**Actual Result**: _________________________________________________

**Status**: PASS / FAIL

---

## Phase 5: Edge Cases & Performance ⚡

### Section 5.1: Duplicate Words

**Action**: Try adding same word twice to group

- [ ] Create new group "EdgeCase"
- [ ] Add word `test`
- [ ] Try adding `test` again

**Expected Result**: Either error or ignored gracefully

**Status**: PASS / FAIL

---

### Section 5.2: Empty Group

**Action**: Create group with no words

- [ ] Create group "EmptyGroup"
- [ ] Don't add any words
- [ ] Send "badword" in Discord

**Expected Result**: Message not filtered (no words to match)

**Status**: PASS / FAIL

---

### Section 5.3: API Performance

**Action**: Measure API response time

- [ ] Open DevTools (F12 → Network tab)
- [ ] Create a word group
- [ ] Watch Network tab for POST request
- [ ] Check response time

**Expected**: < 500ms

**Actual**: _____________ms

**Status**: PASS / FAIL

---

## 📊 Final Results Summary

| Category | Status | Details |
|----------|--------|---------|
| Dashboard Form | PASS/FAIL | |
| Database Save | PASS/FAIL | |
| Bot Filtering | PASS/FAIL | |
| Edit/Delete | PASS/FAIL | |
| API Performance | PASS/FAIL | |
| Edge Cases | PASS/FAIL | |

---

## Overall Test Result

**VERDICT**: ☐ ALL PASS ✅ | ☐ SOME FAIL ⚠️ | ☐ CRITICAL FAIL ❌

---

## Issues Found

| Issue | Severity | Description | Solution |
|-------|----------|-------------|----------|
| | HIGH/MED/LOW | | |
| | HIGH/MED/LOW | | |
| | HIGH/MED/LOW | | |

---

## Sign-Off

- **Tester**: ____________________
- **Date**: ____________________
- **Time Spent**: ____________________
- **Recommended Next Step**: 
  - [ ] Infrastructure Setup (if PASS)
  - [ ] Fix issues (if FAIL)
  - [ ] Manual testing of edge cases

**Notes/Comments**:

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

**Ready for Phase 2?** Update the todo list and proceed to Infrastructure Setup! 🚀

