# DigitalOcean Setup Checklist

## Quick Setup for Production & Staging

---

## 1. Create PostgreSQL Databases

### On DigitalOcean Console:

1. **Create Production Database**
   - Click **Databases** → **Create** → **PostgreSQL**
   - Name: `simon-bot-prod`
   - Region: Choose your region
   - Size: Basic, 1GB RAM (or larger for 50k users)
   - Copy connection string → paste into `.env.production` as `DATABASE_URL`

2. **Create Staging Database** (optional but recommended)
   - Click **Databases** → **Create** → **PostgreSQL**
   - Name: `simon-bot-staging`
   - Region: Same as production
   - Size: Basic, 512MB RAM
   - Copy connection string → paste into `.env.staging` as `DATABASE_URL`

---

## 2. Create Droplets (Virtual Machines)

### Production Droplet:

1. Click **Droplets** → **Create** → **Droplets**
2. **Image**: Ubuntu 22.04 (LTS)
3. **Size**: Basic, $5/mo (1GB RAM) - increase if needed for 50k users
4. **Region**: Same as your database
5. **Authentication**: SSH key (recommended, save private key)
6. **Name**: `simon-bot-prod`
7. Click **Create Droplet**

### Staging Droplet (optional):

1. Repeat above
2. **Size**: Basic, $5/mo (512MB RAM is fine for staging)
3. **Name**: `simon-bot-staging`
4. Click **Create Droplet**

---

## 3. SSH into Droplets & Install Software

### Connect to Droplet:

```bash
# Use the SSH key you downloaded
ssh -i your_private_key.pem root@your_droplet_ip
```

### On Both Droplets - Install Node.js:

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs git

# Verify
node --version  # Should be v18+
npm --version
```

### Install PM2 (Process Manager):

```bash
npm install -g pm2
```

---

## 4. Clone Repository & Setup

### On Both Droplets:

```bash
# Clone your repo (replace with your repo)
git clone https://github.com/yourusername/simon-bot.git
cd simon-bot

# Install dependencies
npm install
cd dashboard && npm install && cd ..
```

### Create `.env` File:

#### On Production Droplet:

```bash
nano .env  # or vim
```

Paste your `.env.production` content (with actual tokens/credentials):

```
NODE_ENV=production
DISCORD_TOKEN=your_prod_token
DATABASE_URL=your_prod_db_connection_string
API_PORT=3001
DASHBOARD_PORT=3000
LOG_LEVEL=info
```

Save: `Ctrl+X → Y → Enter`

#### On Staging Droplet:

```bash
nano .env
```

Paste `.env.staging` content with staging credentials.

---

## 5. Build & Deploy

### On Both Droplets:

```bash
npm run build
npm run dashboard:build
```

---

## 6. Start Services with PM2

### On Both Droplets:

```bash
# Start bot
pm2 start "npm run start" --name bot --env production

# Start API
pm2 start "npm run api:dev" --name api --env production

# Start dashboard
cd dashboard && pm2 start "npm run preview" --name dashboard

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Check Status:

```bash
pm2 status
pm2 logs bot      # View bot logs
pm2 logs api      # View API logs
pm2 logs dashboard
```

---

## 7. Update GitHub Actions Secrets

Go to GitHub → Settings → Secrets and variables → Actions

Add these secrets:

```
DIGITALOCEAN_SSH_KEY_STAGING = (paste private SSH key)
DIGITALOCEAN_HOST_STAGING = (paste staging droplet IP)

DIGITALOCEAN_SSH_KEY_PROD = (paste private SSH key)
DIGITALOCEAN_HOST_PROD = (paste production droplet IP)
```

---

## 8. Create Two Discord Bots

1. Go to https://discord.com/developers/applications
2. Create bot named "Simon Bot Staging"
   - Copy token → `.env.staging`
3. Create bot named "Simon Bot Production"
   - Copy token → `.env.production`
4. Add both to your test server with same permissions

---

## 9. First Deployment

### Push to GitHub:

```bash
git add .env.staging .env.production DEPLOYMENT_GUIDE.md
git commit -m "setup: production and staging environments"
git push origin staging  # Deploy to staging first
```

### Verify:

1. **GitHub Actions** - Check Actions tab to see deployment running
2. **Staging Droplet** - SSH in and run `pm2 status` - should see bot, api, dashboard running
3. **Staging Bot** - Should appear online in Discord
4. **Dashboard** - Open `http://staging_droplet_ip:3000`

### If Staging Works → Push to Production:

```bash
git push origin main
```

---

## 10. Monitoring & Logs

### On Droplet:

```bash
# View all logs
pm2 logs

# View specific service
pm2 logs bot

# Real-time monitoring
pm2 monit

# Restart a service
pm2 restart bot
pm2 restart api
```

### DigitalOcean Monitoring:

1. Go to Droplets → Your Droplet → **Monitoring**
2. See CPU, RAM, disk usage in real-time

---

## Cost Breakdown

| Item | Cost/Month |
|------|-----------|
| Production Droplet (2GB) | $12 |
| Staging Droplet (1GB) | $6 |
| Production Database (1GB) | $15 |
| Staging Database (512MB) | $8 |
| **Total** | **~$41/month** |

(Can reduce by using smaller droplets or combining staging/prod on one droplet)

---

## Common Commands

```bash
# SSH into droplet
ssh -i your_key.pem root@your_ip

# Check running services
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# Start services
pm2 start all

# Update code
git pull origin main
npm run build
pm2 restart all
```

---

## Troubleshooting

### Bot not appearing online:

```bash
pm2 logs bot | grep -i error
```

Check DISCORD_TOKEN is correct.

### API not responding:

```bash
pm2 logs api
# Check if port 3001 is in use:
sudo lsof -i :3001
```

### Database connection fails:

```bash
# Test connection string
psql "your_connection_string"
```

---

## Next Steps After Setup

1. ✅ Databases created
2. ✅ Droplets created & configured
3. ✅ Code deployed
4. ✅ Services running
5. 📋 Create Discord test server
6. 📋 Test staging bot thoroughly
7. 📋 Merge staging → main to deploy to production
8. 📋 Monitor both environments

---

**Questions? Check DEPLOYMENT_GUIDE.md for full workflow details.**
