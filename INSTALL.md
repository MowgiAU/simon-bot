# Installation & Deployment Guide

This guide covers setting up **Fuji Studio** on a local development machine and deploying it to a Linux VPS (DigitalOcean/Ubuntu).

---

## 1. Prerequisites (VPS)

Ensure your server matches these requirements:
*   **OS**: Ubuntu 22.04 LTS (Recommended)
*   **Node.js**: Version 20.x or higher
*   **Database**: PostgreSQL 15+
*   **Process Manager**: PM2
*   **Web Server**: Nginx (Reverse Proxy) - **Requires `client_max_body_size 50M;`** for email attachments.
*   **Memory**: Min 1GB RAM + **4GB Swap File** (Crucial for building React)

### Setting up Swap (If < 2GB RAM)
```bash
swapoff -a
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
# Add to /etc/fstab for persistence
```

---

## 2. Local Development Setup

1.  **Clone the repository**:
    ```bash
    git clone <repo-url>
    cd simon-bot
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    cd dashboard && npm install
    ```

3.  **Environment Variables**:
    Create a `.env` file in the root:
    ```env
    DATABASE_URL="postgresql://user:pass@localhost:5432/simonbot"
    DISCORD_TOKEN="your_bot_token"
    # Add other required vars...
    ```

4.  **Run Development Mode**:
    ```bash
    npm run dev         # Starts Bot
    npm run api:dev     # Starts API
    cd dashboard && npm run dev  # Starts Dashboard
    ```

---

## 3. Deployment Commands

### Update Code & Redeploy (The "Pull" Command)
Run this one-liner from your local machine to update the production server:

```powershell
ssh root@simon-bot-main "cd ~/new-simon && git pull && npm install && npm run build && npm run dashboard:build && pm2 restart all"
```

**What this does:**
1.  Pulls latest code from GitHub.
2.  Installs any new backend dependencies.
3.  Builds the Bot backend.
4.  Builds the React Dashboard.
5.  Restarts all PM2 services to apply changes.

### Manual Update (If One-Liner Fails)
1.  **SSH into server**: `ssh root@simon-bot-main`
2.  **Pull changes**: `cd ~/new-simon && git pull`
3.  **Install deps**: `npm install` (and `cd dashboard && npm install` if frontend changed)
4.  **Build**: `npm run build`
5.  **Build Dashboard**: `cd dashboard && npm run build` (Watch out for OOM! Ensure swap is on)
6.  **Restart**: `pm2 restart all`

---

## 4. Troubleshooting

*   **Dashboard shows 403 Forbidden**: Nginx cannot read the `dist` folder. Run:
    ```bash
    chmod -R 755 ~/new-simon/dashboard/dist
    ```
*   **Dashboard Build Says "Killed"**: Out of memory. Enable swap (see Section 1).
*   **Bot Offline**: Check logs with `pm2 logs bot-prod`.

---

## 5. Nginx Configuration (Vital for Emails)

To receive large email attachments (up to 50MB), you must configure Nginx to allow large request bodies.

1.  Edit your site config: `nano /etc/nginx/sites-available/default` (or your specific domain file).
2.  Add `client_max_body_size 50M;` to the `server` block.

**Example:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # ALLOW LARGE UPLOADS FOR EMAILS
    client_max_body_size 50M; 

    location / {
        proxy_pass http://localhost:3001;
        # ... standard proxy headers ...
    }
}
```
3.  Reload Nginx: `systemctl reload nginx`

