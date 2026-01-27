# Production Setup Complete ✅

I've added **staging/production environment setup** for your DigitalOcean deployment.

---

## What's New

### 📁 Files Created:

1. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** 
   - Complete workflow: feature → staging → production
   - Git branching strategy
   - CI/CD with GitHub Actions
   - Monitoring & rollback procedures

2. **[DIGITALOCEAN_SETUP.md](DIGITALOCEAN_SETUP.md)**
   - Step-by-step DigitalOcean configuration
   - PostgreSQL database creation
   - Droplet setup
   - PM2 process management
   - Troubleshooting guide

3. **[.env.staging](.env.staging)**
   - Staging environment template
   - Different ports, debug logging

4. **[.env.production](.env.production)**
   - Production environment template
   - Minimal logging, optimized settings

5. **[.github/workflows/deploy.yml](.github/workflows/deploy.yml)**
   - GitHub Actions automation
   - Auto-deploys when you push to `staging` or `main`

---

## Architecture

```
your-repo/
├── main branch (production)
│   └── deploys to production droplet
├── staging branch (testing)
│   └── deploys to staging droplet
└── feature/\* branches (development)
    └── merge to staging for testing
```

---

## Workflow

### 1. **Local Development**
```bash
git checkout -b feature/my-plugin
npm run dev      # Uses .env (localhost)
# Test locally...
```

### 2. **Test on Staging**
```bash
git push origin feature/my-plugin
git checkout staging
git merge feature/my-plugin
git push origin staging
# GitHub Actions auto-deploys to staging droplet
# Test with real Discord interactions, larger data, etc.
```

### 3. **Deploy to Production**
```bash
git checkout main
git merge staging
git push origin main
# GitHub Actions auto-deploys to production droplet
```

---

## Setup Steps

1. **Follow [DIGITALOCEAN_SETUP.md](DIGITALOCEAN_SETUP.md)** to:
   - Create PostgreSQL databases
   - Create Ubuntu droplets
   - Install Node.js & PM2
   - Configure environment files

2. **Add GitHub Secrets** (for automated deployments):
   ```
   DIGITALOCEAN_SSH_KEY_STAGING
   DIGITALOCEAN_HOST_STAGING
   DIGITALOCEAN_SSH_KEY_PROD
   DIGITALOCEAN_HOST_PROD
   ```

3. **Push code**:
   ```bash
   git push origin staging  # First test on staging
   ```

4. **GitHub Actions deploys automatically** ✨

---

## Key Benefits

✅ **Staging first** - Test plugins before production  
✅ **Automated deploys** - Push code → auto-deploy  
✅ **Easy rollback** - Git revert if something breaks  
✅ **Separate databases** - Staging data doesn't affect production  
✅ **Multiple bots** - Staging and prod Discord bots  
✅ **PM2 monitoring** - Easy process management  

---

## Next Actions

### Immediate:

1. Read [DIGITALOCEAN_SETUP.md](DIGITALOCEAN_SETUP.md) **completely**
2. Create PostgreSQL databases on DigitalOcean
3. Create Ubuntu droplets for staging & production
4. SSH into droplets and install Node.js + PM2
5. Clone repo and setup `.env` files on each droplet

### Then:

1. Add GitHub Actions secrets
2. Push code to `staging` branch
3. Watch GitHub Actions deploy automatically
4. Test staging bot
5. When ready: merge `staging` → `main` for production

---

## Environment Files Explained

| File | Purpose | Logging | Database |
|------|---------|---------|----------|
| `.env` | Local development | debug | localhost:5432 |
| `.env.staging` | Testing new plugins | debug | DigitalOcean staging |
| `.env.production` | Live bot | info | DigitalOcean production |

---

## Important Notes

- **Each environment has its own Discord bot token** (create 3 bots in Discord Developer Portal)
- **Staging and production have separate databases** (no data leakage)
- **GitHub Actions only deploys if SSH keys are configured** (add secrets to repo)
- **PM2 auto-restarts services on reboot** (don't worry about droplet restarts)

---

## Support

- **Deployment questions?** → Read DEPLOYMENT_GUIDE.md
- **DigitalOcean setup?** → Read DIGITALOCEAN_SETUP.md
- **GitHub Actions not working?** → Check you added all 4 secrets
- **Can't SSH to droplet?** → Verify SSH key permissions: `chmod 600 key.pem`

---

## Cost Estimate (DigitalOcean)

- Production Droplet (2GB): $12/mo
- Staging Droplet (1GB): $6/mo
- Production Database: $15/mo
- Staging Database: $8/mo
- **Total: ~$41/month**

(Can reduce by combining staging/prod on one droplet if needed)

---

**You're ready to deploy to production!** 🚀

Start with [DIGITALOCEAN_SETUP.md](DIGITALOCEAN_SETUP.md) when you're ready to set up your infrastructure.
