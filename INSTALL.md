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
ssh root@staging.fujistud.io "cd ~/simon-bot && git pull && npm install && npm run build && npm run dashboard:build && pm2 restart all"
```

**What this does:**
1.  Pulls latest code from GitHub.
2.  Installs any new backend dependencies.
3.  Builds the Bot backend.
4.  Builds the React Dashboard.
5.  Restarts all PM2 services to apply changes.

### Manual Update (If One-Liner Fails)
1.  **SSH into server**: `ssh root@staging.fujistud.io`
2.  **Pull changes**: `cd ~/simon-bot && git pull`
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

## 5. Nginx Configuration

Fuji Studio uses a single Express server (port 3001) that serves both the API and the built dashboard SPA. Nginx must proxy **all** traffic to it, including `/uploads/` (user images/audio files).

**Full recommended config** (`/etc/nginx/sites-available/fuji-studio`):

```nginx
server {
    listen 80;
    server_name staging.fujistud.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name staging.fujistud.io;

    ssl_certificate     /etc/letsencrypt/live/staging.fujistud.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.fujistud.io/privkey.pem;

    # Allow large uploads (audio, email attachments, etc.)
    client_max_body_size 50M;

    # IMPORTANT: ALL requests (including /uploads/*) must proxy to Express.
    # Do NOT add a separate `location /` that serves from dashboard/dist —
    # Express itself serves the dashboard SPA from the dist folder.
    location / {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> ⚠️ **If you previously had a `location /` block pointing to `dashboard/dist` as a static root**, that will break `/uploads/*` image serving. Remove it — Express handles all static file serving.

3.  Test and reload Nginx:
```bash
nginx -t && systemctl reload nginx
```

