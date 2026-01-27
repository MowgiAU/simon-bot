# Staging & Production Setup Guide

## Git Branching Strategy

```
main
├── prod/    (production - deployed to DigitalOcean)
└── staging/ (staging - test plugins before prod)
    └── feature-branches (individual plugin work)
```

---

## Environment Setup

### `.env.production`
```
NODE_ENV=production
DISCORD_TOKEN=your_prod_bot_token
DATABASE_URL=postgresql://user:pass@prod-host/simon_bot
API_PORT=3001
API_HOST=0.0.0.0
DASHBOARD_PORT=3000
LOG_LEVEL=info
```

### `.env.staging`
```
NODE_ENV=staging
DISCORD_TOKEN=your_staging_bot_token
DATABASE_URL=postgresql://user:pass@staging-host/simon_bot_staging
API_PORT=3002
API_HOST=0.0.0.0
DASHBOARD_PORT=3001
LOG_LEVEL=debug
```

### `.env.development` (local - already exists)
```
NODE_ENV=development
DISCORD_TOKEN=your_dev_bot_token
DATABASE_URL=postgresql://localhost/simon_bot_dev
API_PORT=3001
DASHBOARD_PORT=3000
LOG_LEVEL=debug
```

---

## Workflow

### 1. Create Feature Branch (from `staging`)

```bash
git checkout staging
git pull origin staging
git checkout -b feature/my-plugin-name
```

### 2. Develop Plugin

```bash
npm run dev          # Uses .env (development)
npm run api:dev
npm run dashboard:dev
```

Test thoroughly locally.

### 3. Push to Staging

```bash
git add .
git commit -m "feat: add my plugin"
git push origin feature/my-plugin-name
git checkout staging
git pull origin staging
git merge feature/my-plugin-name
git push origin staging
```

**Automated**: CI/CD deploys staging to DigitalOcean droplet

### 4. Test on Staging Server

- Bot is running on staging
- Test all plugin interactions
- Test with larger datasets
- Verify no breaking changes

### 5. Merge to Production

Once staging is stable:

```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

**Automated**: CI/CD deploys `main` to production DigitalOcean droplet

---

## DigitalOcean Deployment

### Create Two Droplets

1. **Staging Droplet** (Ubuntu 22.04, 1GB RAM)
   - Has staging bot + API + dashboard
   - Pulls from `staging` branch
   - Connected to staging database

2. **Production Droplet** (Ubuntu 22.04, 2GB RAM)
   - Has production bot + API + dashboard
   - Pulls from `main` branch
   - Connected to production database

### On Each Droplet (Setup Once)

```bash
# SSH into droplet
ssh root@your_droplet_ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL client (if not using managed DB)
sudo apt-get install -y postgresql-client

# Clone repo
git clone https://github.com/yourusername/simon-bot.git
cd simon-bot

# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Create .env (with appropriate credentials)
cp .env.example .env.production  # Edit for prod
# or
cp .env.example .env.staging     # Edit for staging
```

### Deploy (Whenever You Push)

Option A: **Manual** (simple)
```bash
git pull origin main  # or staging
npm run build
npm run dashboard:build
npm run start
```

Option B: **Automated with GitHub Actions** (recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to DigitalOcean
        env:
          SSH_KEY: ${{ secrets.DIGITALOCEAN_SSH_KEY }}
          HOST: ${{ secrets.DIGITALOCEAN_HOST }}
          USER: ${{ secrets.DIGITALOCEAN_USER }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh -i ~/.ssh/id_rsa $USER@$HOST 'cd simon-bot && git pull origin ${{ github.ref_name }} && npm run build && npm run dashboard:build && pm2 restart all'
```

---

## Monitoring

### Check Bot Status (on Droplet)

```bash
pm2 status          # View running processes
pm2 logs bot        # View bot logs
pm2 logs api        # View API logs
```

### Setup PM2 (Process Manager)

```bash
npm install -g pm2

# Start bot
pm2 start "npm run start" --name bot

# Start API
pm2 start "npm run api:dev" --name api

# Start dashboard (static serve)
pm2 start "cd dashboard && npm run preview" --name dashboard

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## Rollback (If Production Breaks)

```bash
# On production droplet
git log --oneline
git revert <commit-hash>
git push origin main
pm2 restart all
```

---

## Testing Plugins on Staging

### Before Merging to Prod, Test:

- [ ] Plugin initializes without errors
- [ ] All Discord interactions work
- [ ] Dashboard UI loads and functions
- [ ] Database queries work with staging data
- [ ] No console errors in logs
- [ ] Plugin can be disabled/enabled
- [ ] Bot handles 50k user load (if applicable)

### Staging Bot Commands

Same as production - just connect your test Discord server to staging bot for testing.

---

## Summary

| Environment | Branch | Bot Token | Database | URL |
|---|---|---|---|---|
| **Development** | feature/\* | dev token | localhost | localhost:3000 |
| **Staging** | staging | staging token | DO staging DB | staging.example.com |
| **Production** | main | prod token | DO prod DB | bot.example.com |

---

## Next Steps

1. **Create two DigitalOcean PostgreSQL databases** (or one with separate schemas)
2. **Update `.env.production` and `.env.staging`** with connection strings
3. **Set up GitHub Actions** for automatic deployment (optional but recommended)
4. **SSH into droplets** and install Node.js + dependencies
5. **Test deployment** by pushing to staging branch

---

*Let me know if you need help with any of these steps!*
