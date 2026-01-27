# Quick Deployment Reference

Essential commands and steps for deploying Simon Bot.

---

## 📋 Pre-Deployment Checklist (2 min)

```bash
# Local machine
npm run type-check        # TypeScript check
npm run build            # Build bot
npm run dashboard:build  # Build dashboard
git status               # No uncommitted changes
```

---

## 🚀 Deploy to Staging (5 min)

```bash
# Local machine
git checkout staging
git pull origin staging
# Make your changes
git push origin staging

# Monitor GitHub Actions
# Go to: https://github.com/YOUR_ORG/simon-bot/actions
# Wait for workflow to complete (2-3 min)

# After deployment, test:
# 1. Open http://[STAGING_IP]:3000 (dashboard)
# 2. Check http://[STAGING_IP]:3001/health (API)
# 3. Send test message in Discord (word filter)
```

---

## ✅ Verify Staging

SSH into staging droplet:

```bash
ssh root@[STAGING_IP]

# Check services running:
pm2 status

# View logs:
pm2 logs

# Check database:
npx prisma studio

# Exit:
exit
```

---

## 📦 Promote to Production

After staging tests pass:

```bash
# Local machine
git checkout main
git merge staging
git push origin main

# Monitor: https://github.com/YOUR_ORG/simon-bot/actions
# Wait 2-3 minutes for deployment
```

---

## 🔍 SSH into Droplets

```bash
# Staging
ssh root@[STAGING_IP]

# Production
ssh root@[PROD_IP]

# Once connected, try:
pm2 status          # Process status
pm2 logs bot        # Bot logs
pm2 logs api        # API logs
pm2 logs dashboard  # Dashboard logs
pm2 restart bot     # Restart bot
pm2 save            # Save PM2 state
exit                # Disconnect
```

---

## 🆘 Emergency Rollback

If deployment breaks staging:

```bash
ssh root@[STAGING_IP]
cd /root/simon-bot
git revert HEAD
npm run build
npm run dashboard:build
pm2 restart all
exit
```

---

## 🔑 GitHub Secrets Setup (One Time)

In repo → Settings → Secrets and variables → Actions

**Add these secrets:**

| Name | Value |
|------|-------|
| `DIGITALOCEAN_SSH_KEY_STAGING` | (Private SSH key content) |
| `DIGITALOCEAN_HOST_STAGING` | `XXX.XXX.XXX.XXX` (Staging IP) |
| `DIGITALOCEAN_SSH_KEY_PROD` | (Private SSH key content) |
| `DIGITALOCEAN_HOST_PROD` | `YYY.YYY.YYY.YYY` (Prod IP) |

---

## 📱 First Time Setup (30 min)

See [INFRASTRUCTURE_SETUP.md](INFRASTRUCTURE_SETUP.md) for detailed guide

Quick version:

1. Create 2 DigitalOcean droplets ($6 staging, $12 prod)
2. Create PostgreSQL database
3. Run setup script on each droplet:
   ```bash
   ssh root@[IP]
   bash < <(curl -s https://raw.githubusercontent.com/YOUR_ORG/simon-bot/main/scripts/setup-droplet.sh)
   ```
4. Configure GitHub secrets (table above)
5. Deploy: `git push origin staging`

---

## 📊 Monitoring

### Check All Services

```bash
ssh root@[IP]
pm2 status
```

### View Logs

```bash
pm2 logs bot       # Bot activity
pm2 logs api       # API requests/errors
pm2 logs dashboard # Dashboard server
pm2 logs           # All logs together
```

### Stop Services

```bash
pm2 stop bot       # Stop specific process
pm2 stop all       # Stop everything
pm2 restart api    # Restart specific process
```

---

## 🐛 Common Issues

| Issue | Command |
|-------|---------|
| Services not running | `pm2 restart all` |
| Can't SSH | Check IP in GitHub secret, verify key permissions |
| API error 500 | `pm2 logs api` (check for database error) |
| Bot not responding | `pm2 logs bot` (check for token error) |
| High memory | `pm2 monit` (watch usage) |
| Port in use | `lsof -i :3000` then `kill -9 [PID]` |

See [DEPLOYMENT_TROUBLESHOOTING.md](DEPLOYMENT_TROUBLESHOOTING.md) for full guide.

---

## 📝 Environment Variables

Edit `.env` on each droplet:

```bash
ssh root@[IP]
nano /root/simon-bot/.env

# Edit these:
DISCORD_TOKEN=your_token
DATABASE_URL=postgresql://...
NODE_ENV=staging|production
```

---

## 🔄 Typical Workflow

```
Local dev
    ↓
git push origin staging
    ↓ (GitHub Actions auto-deploys)
Test on staging server
    ↓
git push origin main
    ↓ (GitHub Actions auto-deploys)
Live in production
```

---

## 📞 Need Help?

1. Check logs: `pm2 logs`
2. See [DEPLOYMENT_TROUBLESHOOTING.md](DEPLOYMENT_TROUBLESHOOTING.md)
3. Check GitHub Actions logs
4. Rollback: `git revert HEAD` on droplet

---

**Next Steps**: Phase 3 - Staging Branch Workflow
