# End-to-End Word Filter Test Plan

**Date**: January 27, 2026  
**Objective**: Verify word filter works completely from dashboard UI through Discord bot message filtering

## Prerequisites
- [ ] Bot dev server running (`npm run dev` in root)
- [ ] API server running (`npm run api:dev`)
- [ ] Dashboard running (`cd dashboard && npm run dev`)
- [ ] PostgreSQL connected (Railway)
- [ ] Discord bot joined to test server
- [ ] Test Discord server ready

## Test Scenario 1: Create Word Group via Dashboard

### Step 1.1: Access Dashboard
- [ ] Open http://localhost:3000
- [ ] Verify dashboard loads without errors
- [ ] Click "Word Filter" in sidebar

### Step 1.2: Create Word Group
- [ ] Fill in "Group Name": `Inappropriate Words`
- [ ] Fill in "Replacement Text/Emoji": `***`
- [ ] Toggle "Use emoji for replacement" off
- [ ] Click "Create Word Group"
- [ ] Verify success message appears
- [ ] Verify group appears in list below form

### Step 1.3: Add Words to Group
- [ ] Click edit button (📝) on the group
- [ ] In "Add Word to Group" field, enter: `badword`
- [ ] Click "Add Word"
- [ ] Verify word appears in tags below
- [ ] Add 2-3 more test words: `inappropriate`, `forbidden`, `censored`
- [ ] Verify all words display in list

### Step 1.4: Verify Database Save
- [ ] Open database studio: `npm run db:studio`
- [ ] Navigate to `WordGroup` table
- [ ] Verify group exists with name `Inappropriate Words`
- [ ] Navigate to `FilterWord` table
- [ ] Verify all 4 words are in database with correct groupId
- [ ] Close database studio

## Test Scenario 2: Test Word Filter in Discord

### Step 2.1: Send Unfiltered Message
- [ ] In test Discord server, send: "This is a normal message"
- [ ] Verify message appears normally in chat

### Step 2.2: Send Message with Filtered Word
- [ ] Send message: "This is a badword message"
- [ ] Verify:
  - [ ] Original message is deleted
  - [ ] New message appears with user's avatar/name
  - [ ] Text shows: "This is a *** message" (word replaced)
  - [ ] No errors in bot console

### Step 2.3: Multiple Words in One Message
- [ ] Send: "This message has inappropriate and forbidden content"
- [ ] Verify:
  - [ ] Message deleted
  - [ ] Reposts with: "This message has *** and *** content"
  - [ ] Both words replaced

### Step 2.4: Mixed Case
- [ ] Send: "This is a BADWORD and Forbidden message"
- [ ] Verify both words are caught (case-insensitive regex)

## Test Scenario 3: Modify Word Group

### Step 3.1: Edit Group
- [ ] Go back to dashboard → Word Filter
- [ ] Click edit on `Inappropriate Words` group
- [ ] Remove one word (click X on tag)
- [ ] Verify word disappears
- [ ] Add new word: `test`
- [ ] Send message: "This test word should be filtered"
- [ ] Verify it's caught and replaced

### Step 3.2: Delete Group
- [ ] Click delete button on group
- [ ] Confirm deletion
- [ ] Send filtered message in Discord
- [ ] Verify message is NOT filtered anymore

## Test Scenario 4: Edge Cases

### Step 4.1: Word Boundaries
- [ ] Create group with word `bat`
- [ ] Send: "This is a baseball bat"
- [ ] Verify word NOT caught (bat is part of baseball)
- [ ] Send: "Stop being a bat"
- [ ] Verify word IS caught

### Step 4.2: Multiple Instances
- [ ] Send: "badword badword badword"
- [ ] Verify all three instances replaced: "*** *** ***"

### Step 4.3: Special Characters
- [ ] Create group with word `test123`
- [ ] Send: "This test123 here"
- [ ] Verify caught and replaced

## Expected Results

| Test | Expected | Status |
|------|----------|--------|
| Dashboard loads | No errors | ? |
| Create word group | Success message, appears in list | ? |
| Save to database | Group + words in DB | ? |
| Filter in Discord | Message deleted + reposted with replacement | ? |
| Edit group | Changes appear immediately | ? |
| Delete group | Filtering stops | ? |
| Case-insensitive | Works with any case | ? |
| Word boundaries | Doesn't match substrings | ? |

## Troubleshooting

### Bot not catching messages
- Check: Is plugin enabled in dashboard?
- Check: Is guild initialized in database?
- Check: Are word groups created and have words?
- Check: Bot has `ManageMessages` permission?

### Messages not reposting
- Check: Bot has `SendMessages` permission?
- Check: Channel has webhooks enabled?
- Check: `repostEnabled` is true in settings?

### Dashboard not saving
- Check: API server running on :3001?
- Check: Database connected?
- Check: Network tab in DevTools for 400/500 errors?

## Sign-Off

- [ ] All tests passed
- [ ] No console errors (bot or dashboard)
- [ ] Database changes persisted
- [ ] Ready to move to Infrastructure Setup

**Tested by**: ______________________  
**Date**: ______________________  
**Notes**: 

