# Deployment Troubleshooting & Rollback Guide

Quick reference for common deployment issues and how to fix them.

---

## Emergency Procedures

### If Bot Crashes After Deployment

1. SSH into droplet:
   ```bash
   ssh root@[STAGING_IP]
   ```

2. Check what went wrong:
   ```bash
   pm2 logs bot
   pm2 logs api
   ```

3. Find the issue in logs, then **rollback** to last known good version:
   ```bash
   cd /root/simon-bot
   git log --oneline -5  # See recent commits
   git revert HEAD
   npm run build
   npm run dashboard:build
   pm2 restart bot
   pm2 restart api
   ```

### If Dashboard Won't Load

```bash
# On droplet
pm2 logs dashboard

# If it's a build issue:
cd /root/simon-bot/dashboard
npm run build

# Restart:
pm2 restart dashboard
```

### If Database Migration Fails

```bash
cd /root/simon-bot

# Check migration status:
npx prisma migrate status

# If stuck, manually reset (CAUTION - this deletes data):
npx prisma migrate reset

# Or rollback to previous migration:
npx prisma migrate resolve --rolled-back <migration_name>

# Then retry:
npx prisma migrate deploy
```

---

## Deployment Failure Diagnostics

### 1. Check GitHub Actions Logs

1. Go to your GitHub repo
2. Click **Actions** tab
3. Click the failed workflow
4. Click the failed job
5. Expand each step to find error details

**Common errors:**
- `SSH: Permission denied` → SSH key secret is wrong or corrupted
- `git: not found` → git not installed on droplet
- `npm: command not found` → Node.js not installed
- `npm ERR! code EACCES` → Permission denied, might need `npm install -g` privileges

### 2. Test SSH Manually

```bash
# On your local machine
ssh -i ~/.ssh/your_private_key root@[STAGING_IP]

# If fails:
# - Verify IP is correct
# - Check SSH key permissions: chmod 600 ~/.ssh/your_private_key
# - Verify droplet is running in DigitalOcean console
# - Check firewall allows SSH (port 22)
```

### 3. Check Service Status on Droplet

```bash
ssh root@[STAGING_IP]

# View all processes:
pm2 status

# View full logs:
pm2 logs

# View specific process log:
pm2 logs bot
pm2 logs api
pm2 logs dashboard
```

---

## Common Issues & Fixes

### Issue: "ERR! ENOMEM"

**Symptom**: `npm ERR! ENOMEM` during install/build

**Cause**: Out of memory (usually on small $6 droplets)

**Fix**:
```bash
# Increase swap space
dd if=/dev/zero of=/swapfile bs=1G count=2
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Make permanent:
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

# Verify:
free -h
```

### Issue: "Port 3000/3001 already in use"

**Symptom**: `Error: listen EADDRINUSE :::3001`

**Cause**: Process didn't fully shutdown or port is bound

**Fix**:
```bash
# Find process using port:
lsof -i :3001

# Kill it:
kill -9 [PID]

# Or let PM2 handle it:
pm2 stop api
pm2 delete api
pm2 start "npm run api:dev" --name api
```

### Issue: "Database connection refused"

**Symptom**: `Error: getaddrinfo ENOTFOUND`

**Cause**: DATABASE_URL is wrong, database isn't running, or firewall blocked

**Fix**:
```bash
# Verify .env file has correct DATABASE_URL:
cat /root/simon-bot/.env | grep DATABASE_URL

# Test connection:
psql "your_database_url"

# If local PostgreSQL:
sudo systemctl status postgresql
sudo systemctl restart postgresql

# If DigitalOcean Managed:
# - Verify IP is in firewall rules
# - Check database is running in DO console
# - Verify SSL mode if required
```

### Issue: "DISCORD_TOKEN is invalid"

**Symptom**: Bot crashes with "Invalid token" message

**Cause**: Token is wrong, expired, or regenerated

**Fix**:
1. Go to Discord Developer Portal
2. Go to your application → Bot
3. Click "Reset Token" if regenerated
4. Copy new token
5. Update GitHub secret: `DISCORD_TOKEN_STAGING`
6. Update `.env` on droplet
7. Redeploy or manually restart:
   ```bash
   pm2 restart bot
   ```

### Issue: "PM2 error: spawn ENOENT"

**Symptom**: PM2 can't start process, shows "ENOENT"

**Cause**: Node command not found or path is wrong

**Fix**:
```bash
# Verify Node is installed:
which node
which npm

# Use full paths in PM2:
pm2 start /usr/bin/node --cwd /root/simon-bot -- dist/bot/index.js --name bot

# Or reinstall:
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
pm2 restart all
```

---

## Rollback Procedures

### Rollback Last Deployment

If the latest deploy broke something:

```bash
ssh root@[STAGING_IP]
cd /root/simon-bot

# See recent commits:
git log --oneline -10

# Revert to previous commit:
git revert HEAD

# Or checkout specific commit:
git checkout abc123def

# Rebuild:
npm run build
npm run dashboard:build

# Restart services:
pm2 restart all

# Verify:
pm2 status
pm2 logs
```

### Emergency: Restore from Database Backup

If database is corrupted:

```bash
# DigitalOcean Managed Database:
# 1. Go to DigitalOcean Console → Databases → Your cluster
# 2. Click "Backups" tab
# 3. Click restore icon on backup you want
# 4. Select target cluster
# 5. Restore completes (takes few minutes)

# Local PostgreSQL on droplet:
# Use pg_dump/pg_restore if you have backups
sudo -u postgres pg_dump simon_bot_staging > backup.sql

# To restore:
sudo -u postgres psql simon_bot_staging < backup.sql
```

---

## Database Troubleshooting

### Check Database Connection

```bash
# On droplet:
cd /root/simon-bot

# Use Prisma to check:
npx prisma db execute --stdin < /dev/null

# Or direct psql:
psql $DATABASE_URL -c "SELECT version();"
```

### Reset Development Database

⚠️ **WARNING: This deletes all data**

```bash
cd /root/simon-bot

# Reset to fresh state:
npx prisma migrate reset

# This will:
# 1. Drop database
# 2. Create new database
# 3. Run all migrations
# 4. Re-seed data (if seed.ts exists)
```

### Verify Migrations Applied

```bash
npx prisma migrate status

# Should show all migrations as "Migration applied successfully"
```

---

## Performance Troubleshooting

### Check Resource Usage

```bash
# Memory:
free -h

# CPU:
top -b -n 1 | head -20

# Disk:
df -h

# Process details:
ps aux | grep node
```

### If Using Too Much Memory

```bash
# Check which process:
ps aux | sort -rk 3,3 | head -10

# Restart that process:
pm2 restart [process_name]

# Consider upgrading droplet if consistently high
```

### If CPU Usage High

Usually caused by:
- Unoptimized database queries
- Memory leaks (forces garbage collection)
- Heavy computation

**Fix**:
1. Check logs for errors
2. Profile application: `node --prof`
3. Optimize code or database
4. Upgrade droplet if legitimately high load

---

## Monitoring Commands

Use these to check system health:

```bash
# All processes running:
pm2 status

# Full logs:
pm2 logs

# Save state for auto-start:
pm2 save
pm2 startup

# Delete process:
pm2 delete bot

# Restart everything:
pm2 restart all

# Stop all:
pm2 stop all

# Clear all logs:
pm2 flush

# Check system stats:
pm2 monit
```

---

## Prevention: Before Deployment

1. **Test locally first**:
   ```bash
   npm run build
   npm run dashboard:build
   npm run type-check
   ```

2. **Review changes**:
   ```bash
   git diff main..staging
   ```

3. **Test on staging FIRST**:
   - Push to staging branch
   - Wait for GitHub Actions to complete
   - Verify bot works in test guild
   - Only then merge to main

4. **Keep main branch stable**:
   - Never push broken code to main
   - Always test on staging first
   - Use pull requests for reviews

---

## Getting Help

If you're stuck:

1. **Check logs** - Always the first step
2. **Google the error** - Most issues have solutions online
3. **Check GitHub Actions** - Logs there too
4. **Simplify** - Roll back to last known good state
5. **Escalate** - Get help from team if needed

---

## Contacts & Resources

- **DigitalOcean Support**: https://www.digitalocean.com/support
- **Node.js Issues**: https://github.com/nodejs/node/issues
- **Prisma Support**: https://www.prisma.io/docs
- **Discord.js Help**: https://discord.gg/djs
- **PM2 Documentation**: https://pm2.keymetrics.io/docs

---

**Last Updated**: January 27, 2026
