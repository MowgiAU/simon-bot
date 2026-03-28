# Fuji Studio — Production Migration Checklist

## Prerequisites
- [ ] DigitalOcean account with billing set up
- [ ] Domain `fujistud.io` DNS managed via Cloudflare
- [ ] GitHub repository access (MowgiAU/simon-bot)
- [ ] Discord Developer Portal access (production application)
- [ ] All API keys ready (Resend, OpenAI, Cloudflare R2)

---

## Phase 1: Infrastructure Setup

### 1.1 Create Managed PostgreSQL Database
1. **DigitalOcean** → Databases → Create → PostgreSQL 16
2. Plan: **Basic $15/mo** (1 GB RAM, 1 vCPU, 10 GB disk) — upgrade later if needed
3. Region: Same as droplet (e.g., `nyc1` or `sfo3`)
4. Database name: `fuji_production`
5. After creation, note:
   - **Connection Pool URL** (port 25061): `postgresql://user:pass@host:25061/fuji_production?sslmode=require&pgbouncer=true`
   - **Direct URL** (port 25060): `postgresql://user:pass@host:25060/fuji_production?sslmode=require`

### 1.2 Create Production Droplet
1. **DigitalOcean** → Droplets → Create
2. Image: **Ubuntu 22.04 LTS**
3. Plan: **$24/mo** (4 GB RAM, 2 vCPUs, 80 GB disk)
4. Region: Same as database
5. Auth: SSH key (create a deploy key if you don't have one)
6. Hostname: `fuji-production`
7. Note the **droplet IP address**

### 1.3 Add Droplet to Database Trusted Sources
1. DigitalOcean → Databases → your DB → Settings → Trusted Sources
2. Add the production droplet

### 1.4 Run Setup Script
```bash
ssh root@<DROPLET_IP>
# Upload or clone the repo, then:
bash scripts/setup-production.sh
```

### 1.5 Configure Environment
```bash
nano /root/simon-bot/.env
```
Fill in ALL values from the `.env.production` template:
- `DISCORD_TOKEN` — production bot token
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — production Discord app
- `DATABASE_URL` — managed PostgreSQL pool URL (port 25061)
- `DIRECT_DATABASE_URL` — managed PostgreSQL direct URL (port 25060)
- `SESSION_SECRET` — generate: `openssl rand -hex 32`
- `INVITE_ONLY=true` — keep the gate up initially
- All R2, Resend, OpenAI keys

### 1.6 SSL Certificate
```bash
certbot --nginx -d fujistud.io -d www.fujistud.io
```

---

## Phase 2: Database Migration

### 2.1 Run Prisma Migrations
```bash
cd /root/simon-bot
npx prisma migrate deploy
```
This creates all tables including the new `invited` and `role` fields on User.

### 2.2 Verify Database
```bash
npx prisma studio
# Or connect via psql to verify tables exist
```

---

## Phase 3: Discord Bot Transition

### 3.1 Update Discord Developer Portal
1. Go to https://discord.com/developers/applications
2. Select the **production** application
3. OAuth2 → Redirects: Add `https://fujistud.io/auth/discord/callback`
4. Remove any staging URLs from production app

### 3.2 First Start
```bash
cd /root/simon-bot
npm run build            # Compile TypeScript
cd dashboard && npm run build && cd ..   # Build React dashboard
pm2 start ecosystem.config.cjs
pm2 save
```

### 3.3 Verify Bot
- Check Discord: bot should be online with presence
- Check logs: `pm2 logs`
- Check API: `curl https://fujistud.io/api/beta/status` → `{"inviteOnly":true}`

---

## Phase 4: DNS & Go-Live

### 4.1 Update Cloudflare DNS
1. Cloudflare → DNS → `fujistud.io`
2. Update A record: point to new production droplet IP
3. Ensure proxy is enabled (orange cloud)
4. Wait for propagation (~5 min with Cloudflare)

### 4.2 Verify Dashboard
- Visit `https://fujistud.io` → should show Coming Soon page
- Login with Discord → should still show Coming Soon (you're not invited yet)

### 4.3 Invite Yourself (Admin)
```bash
# Option A: Direct database
psql $DATABASE_URL -c "UPDATE \"User\" SET invited = true, role = 'admin' WHERE \"discordId\" = 'YOUR_DISCORD_ID';"

# Option B: Via API (if you're already an admin by guild)
curl -X POST https://fujistud.io/api/admin/users/YOUR_USER_ID/invite \
  -H "Cookie: your-session-cookie"
```

---

## Phase 5: GitHub Actions (CI/CD)

### 5.1 Set Repository Secrets
GitHub → Settings → Secrets and variables → Actions:
- `PROD_HOST` = production droplet IP
- `PROD_USERNAME` = `root`
- `PROD_SSH_KEY` = contents of deploy SSH private key

### 5.2 Merge Staging to Main
```bash
git checkout main
git merge staging --ff-only
git push origin main
```
This triggers the production workflow.

### 5.3 Verify Deploy
- Watch GitHub Actions → production.yml run
- Check `pm2 logs` on server
- Confirm site is up

---

## Phase 6: Post-Migration

### 6.1 Monitoring
- `pm2 monit` — watch CPU/memory
- `htop` — check swap usage
- `pm2 logs --lines 100` — check for errors

### 6.2 Invite Beta Users
Use the admin endpoints or direct DB updates to invite users:
```bash
# Bulk invite via API
curl -X POST https://fujistud.io/api/admin/users/bulk-invite \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie" \
  -d '{"userIds": ["id1", "id2", "id3"]}'
```

### 6.3 When Ready for Public Launch
Set `INVITE_ONLY=false` in `.env` and restart:
```bash
pm2 restart ecosystem.config.cjs
```

---

## Pull Command for Staging Server
After pushing changes, run on the staging server:
```bash
ssh root@143.198.136.83 "cd /root/simon-bot && git pull origin staging && npm install && cd dashboard && npm install && npm run build && cd .. && npx prisma generate && pm2 restart ecosystem.config.cjs"
```

---

## Rollback Plan
If something goes wrong:
1. **DNS**: Point `fujistud.io` back to old server IP in Cloudflare
2. **Bot**: The staging bot can remain running as backup
3. **Database**: Managed PostgreSQL has automatic backups (7-day retention)
