# Phase 2: Infrastructure Setup Checklist

Use this checklist to ensure all infrastructure components are properly configured.

---

## Pre-Deployment

- [ ] GitHub repository has both `main` and `staging` branches
- [ ] `.env.example` file is up-to-date with all required variables
- [ ] `.gitignore` includes `.env` file (don't commit secrets!)
- [ ] `package.json` has correct build scripts: `build`, `start`, `api:dev`, `dashboard:build`
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Dashboard builds successfully: `npm run dashboard:build`

---

## DigitalOcean Account Setup

- [ ] DigitalOcean account created (https://digitalocean.com/)
- [ ] SSH key generated or uploaded to DigitalOcean
- [ ] DigitalOcean SSH key downloaded and stored securely

---

## Droplet Creation

### Staging Droplet

- [ ] Created: Ubuntu 22.04 LTS
- [ ] Hostname: `simon-bot-staging`
- [ ] Size: $6/month (1GB RAM minimum)
- [ ] Region: Chosen (preferably close to users)
- [ ] IP Address noted: `_______________`
- [ ] SSH access verified: `ssh root@[IP]` works

### Production Droplet

- [ ] Created: Ubuntu 22.04 LTS
- [ ] Hostname: `simon-bot-prod`
- [ ] Size: $12+/month (2GB RAM recommended)
- [ ] Region: Same as staging
- [ ] IP Address noted: `_______________`
- [ ] SSH access verified: `ssh root@[IP]` works

---

## Database Setup

### Option: DigitalOcean Managed PostgreSQL

- [ ] PostgreSQL cluster created (engine v15+)
- [ ] Cluster name: `simon-bot-db`
- [ ] Region: Same as droplets
- [ ] Database name: `defaultdb` or custom
- [ ] Connection details saved:
  - Host: `_______________________`
  - Port: `_______________________`
  - Username: `_______________________`
  - Password: `_______________________` (stored securely)

### Option: PostgreSQL on Droplet

- [ ] PostgreSQL installed on staging droplet
- [ ] Database created: `simon_bot_staging`
- [ ] Database user created with password
- [ ] User permissions configured: CREATEDB enabled

---

## Droplet Provisioning

For each droplet (staging first, then production):

- [ ] Connected via SSH
- [ ] System updated: `apt update && apt upgrade -y`
- [ ] Node.js 18 installed: `node --version` shows v18+
- [ ] NPM verified: `npm --version` shows v9+
- [ ] PM2 installed globally: `pm2 --version` shows v5+
- [ ] Git installed: `git --version` works
- [ ] Repository cloned to `/root/simon-bot`
- [ ] `.env` file created with correct values:
  - `DISCORD_TOKEN` set
  - `DATABASE_URL` set (correct database)
  - `NODE_ENV` set to `staging` or `production`
  - `DISCORD_CLIENT_ID` set
- [ ] Dependencies installed: `npm install --production`
- [ ] Dashboard dependencies installed: `cd dashboard && npm install`
- [ ] Database migrated: `npx prisma migrate deploy`
- [ ] Bot built: `npm run build` completes without errors
- [ ] Dashboard built: `npm run dashboard:build` completes
- [ ] Services started with PM2:
  - Bot: `pm2 start "npm run start" --name bot`
  - API: `pm2 start "npm run api:dev" --name api`
  - Dashboard: `pm2 start "npm run preview" --cwd dashboard --name dashboard`
- [ ] PM2 startup enabled: `pm2 startup` and `pm2 save` complete

---

## GitHub Secrets Configuration

In GitHub repository Settings → Secrets and variables → Actions:

### Staging Secrets

- [ ] `DIGITALOCEAN_SSH_KEY_STAGING` - Private SSH key (full content)
- [ ] `DIGITALOCEAN_HOST_STAGING` - Staging droplet IP address

### Production Secrets

- [ ] `DIGITALOCEAN_SSH_KEY_PROD` - Production SSH key (full content)
- [ ] `DIGITALOCEAN_HOST_PROD` - Production droplet IP address

---

## GitHub Actions Configuration

- [ ] `.github/workflows/deploy.yml` exists and is valid
- [ ] Workflow references correct secrets (see above)
- [ ] Staging deployment uses `staging` branch
- [ ] Production deployment uses `main` branch

---

## Testing Deployment

### To Staging

```bash
# Create/update staging branch
git checkout staging
git push origin staging

# Monitor deployment
# Go to GitHub → Actions tab and watch workflow
# Should complete in 2-3 minutes
```

- [ ] GitHub Actions workflow completes successfully
- [ ] SSH into staging droplet: `ssh root@[STAGING_IP]`
- [ ] Check service status: `pm2 status` - all showing "online"
- [ ] Check logs: `pm2 logs` - no errors visible
- [ ] Test API: `curl http://[STAGING_IP]:3001/health` - returns `{"status":"ok"}`
- [ ] Test dashboard: Open `http://[STAGING_IP]:3000` in browser - page loads
- [ ] Test database: `npx prisma studio` accessible on staging droplet
- [ ] Send test message in Discord guild - word filter works (or at least no errors in logs)

### To Production

Only after staging passes all tests:

```bash
git checkout main
git merge staging
git push origin main

# Monitor deployment
# Go to GitHub → Actions tab
```

- [ ] GitHub Actions workflow completes successfully
- [ ] SSH into production droplet: `ssh root@[PROD_IP]`
- [ ] Check service status: `pm2 status` - all showing "online"
- [ ] Test API: `curl http://[PROD_IP]:3001/health` - returns `{"status":"ok"}`
- [ ] Bot is active in Discord (check it's online)
- [ ] Word filter working in production guild

---

## Monitoring & Maintenance Setup

- [ ] PM2 logs configured: `pm2 save` and `pm2 startup` completed
- [ ] SSH key backed up securely (not just in GitHub)
- [ ] Database backups enabled (DigitalOcean managed does this automatically)
- [ ] Monitoring plan documented:
  - How to check service status
  - How to view logs
  - How to restart services
  - How to rollback on failure

---

## Documentation

- [ ] This checklist completed and all items checked
- [ ] `INFRASTRUCTURE_SETUP.md` reviewed and customized
- [ ] Environment variables documented in `.env.example`
- [ ] Deployment procedures documented for team
- [ ] Rollback procedures documented

---

## Final Verification

- [ ] Both staging and production droplets are running
- [ ] Both are connected to the same PostgreSQL database
- [ ] GitHub Actions can successfully deploy to both
- [ ] Word filter plugin works in test guild
- [ ] Dashboard is accessible and functional
- [ ] No sensitive data (tokens, passwords) committed to git
- [ ] `.env` files exist on droplets but not in repository

---

## Post-Deployment

- [ ] Set up monitoring/alerting (optional: DataDog, Sentry, etc.)
- [ ] Configure DNS records to point to droplets (if using custom domain)
- [ ] Set up SSL/TLS certificates (Let's Encrypt via Certbot)
- [ ] Configure firewall rules on droplets:
  - Allow SSH (22)
  - Allow HTTP (80)
  - Allow HTTPS (443)
- [ ] Document any custom configuration specific to your deployment

---

## Troubleshooting Reference

| Problem | Solution |
|---------|----------|
| SSH connection fails | Verify IP in GitHub secret, check SSH key permissions (chmod 600) |
| Deployment hangs | Check GitHub Actions logs, verify SSH key is correct |
| API returns error | Check database connection, verify DATABASE_URL in .env |
| Bot not responding | Check bot logs: `pm2 logs bot`, verify DISCORD_TOKEN is correct |
| High latency | Choose DigitalOcean region closer to your users |
| Database connection refused | Verify database is running, check firewall rules |

---

**Status**: When all items are checked, Phase 2 is complete! ✅

Next: Phase 3 - Staging Branch Workflow
