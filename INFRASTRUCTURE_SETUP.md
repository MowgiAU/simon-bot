# Infrastructure Setup Guide (Single Droplet: Staging + Production)

This guide explains how to deploy Simon Bot to a single $12/month DigitalOcean droplet, running both staging and production environments as separate PM2 processes.

---

## Prerequisites
- DigitalOcean account ([get $200 credit](https://www.digitalocean.com/))
- GitHub repository with `main` and `staging` branches
- Two Discord bot tokens (one for staging, one for production)
- PostgreSQL database (DigitalOcean managed or local on droplet)

---

## 1. Create a Single DigitalOcean Droplet
1. Go to [DigitalOcean Console](https://cloud.digitalocean.com/)
2. Click **Create** → **Droplets**
3. Configure:
   - **Region**: Closest to your users
   - **OS**: Ubuntu 22.04 LTS
   - **Size**: $12/month (2GB RAM, 2 vCPU)
   - **Authentication**: SSH key (create or use existing)
   - **Hostname**: `simon-bot-main`
4. Note the droplet's public IP address

---

## 2. Set Up PostgreSQL
- **Recommended:** Use DigitalOcean Managed PostgreSQL (see DigitalOcean docs)
- **Budget:** Install PostgreSQL locally on the droplet:
  ```bash
  apt update && apt install -y postgresql postgresql-contrib
  sudo -u postgres createdb simon_bot_staging
  sudo -u postgres createdb simon_bot_prod
  sudo -u postgres psql -c "CREATE USER simonbot WITH PASSWORD 'your_secure_password';"
  sudo -u postgres psql -c "ALTER ROLE simonbot WITH CREATEDB;"
  ```

---

## 3. Prepare the Droplet
```bash
ssh root@[DROPLET_IP]
# Update system
apt update && apt upgrade -y
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
# Install PM2 and Git
npm install -g pm2
apt install -y git
# Clone repo
mkdir -p /root/simon-bot && cd /root/simon-bot
git clone https://github.com/YOUR_GITHUB_USERNAME/simon-bot.git .
# Install dependencies
npm install
cd dashboard && npm install && cd ..
```

---

## 4. Create Environment Files
In `/root/simon-bot`, create:

**.env.staging**
```
DISCORD_TOKEN=your_staging_token
DISCORD_CLIENT_ID=your_staging_client_id
NODE_ENV=staging
API_PORT=3001
API_HOST=0.0.0.0
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@localhost:5432/simon_bot_staging?schema=public
BOT_PREFIX=!s
GUILD_ID=your_staging_guild_id
```

**.env.production**
```
DISCORD_TOKEN=your_production_token
DISCORD_CLIENT_ID=your_production_client_id
NODE_ENV=production
API_PORT=3003
API_HOST=0.0.0.0
DASHBOARD_PORT=3002
DASHBOARD_HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@localhost:5432/simon_bot_prod?schema=public
BOT_PREFIX=!
GUILD_ID=your_production_guild_id
```

> Use different ports for staging and production API/Dashboard to avoid conflicts.

---

## 5. Set Up GitHub Secrets
In your GitHub repo:
- Go to **Settings** → **Secrets and variables** → **Actions**
- Add:
  - `DIGITALOCEAN_SSH_KEY` (private SSH key content)
  - `DIGITALOCEAN_HOST` (droplet IP)

---

## 6. Deploying Staging and Production

### Deploy Staging
```bash
git checkout staging
git push origin staging
```
This triggers GitHub Actions to deploy and restart the **staging** bot and API on the droplet.

### Deploy Production
```bash
git checkout main
git merge staging
git push origin main
```
This triggers GitHub Actions to deploy and restart the **production** bot and API on the same droplet.

---

## 7. PM2 Process Management (on droplet)
Start both environments as separate processes:
```bash
# Staging
pm2 start "npm run start" --name bot-staging --env .env.staging
pm2 start "npm run api:dev" --name api-staging --env .env.staging
pm2 start "npm run preview" --cwd dashboard --name dashboard-staging --env .env.staging
# Production
pm2 start "npm run start" --name bot-prod --env .env.production
pm2 start "npm run api:dev" --name api-prod --env .env.production
pm2 start "npm run preview" --cwd dashboard --name dashboard-prod --env .env.production
pm2 save
pm2 startup
```
> Each process uses its own environment file and ports. You can now test both bots independently on the same server.

---

## 8. Port Management
| Environment   | API Port | Dashboard Port |
|--------------|----------|---------------|
| Staging      | 3001     | 3000          |
| Production   | 3003     | 3002          |

If a port is in use:
```bash
lsof -i :3001  # Replace with port
kill -9 [PID]
```

---

## 9. Monitoring & Maintenance
```bash
pm2 status
pm2 logs bot-staging
pm2 logs bot-prod
pm2 logs api-staging
pm2 logs api-prod
pm2 logs dashboard-staging
pm2 logs dashboard-prod
npx prisma studio  # View/manage database
```

---

## 10. Cost Estimate (Monthly)
| Service           | Cost | Notes                        |
|-------------------|------|------------------------------|
| Single Droplet    | $12  | 2GB RAM, both envs           |
| PostgreSQL Managed| $18  | Backups, monitoring          |
| **Total**         | $30  | Can reduce if local database |

---

## 11. After Deployment
- Test both staging and production bots in their Discord servers
- Monitor logs for errors (`pm2 logs bot-staging`, `pm2 logs bot-prod`)
- Set up **Phase 3: Staging Workflow** (auto-deploy on branch changes)
- Begin work on **Phase 4+: Additional Plugins**

---

## 12. Resources
- [DigitalOcean Docs](https://docs.digitalocean.com/)
- [Node.js on DigitalOcean](https://docs.digitalocean.com/tutorials/app-deploy-node-js/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Prisma Database URLs](https://www.prisma.io/docs/reference/database-reference/connection-urls)
