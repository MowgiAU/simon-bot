#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Fuji Studio — Production Server Setup
# For DigitalOcean Droplet (Ubuntu 22.04+)
# ═══════════════════════════════════════════════════════════════════════
set -e

echo "🚀 Fuji Studio Production Server Setup"
echo "========================================"

if [ "$EUID" -ne 0 ]; then 
  echo "❌ Must run as root: sudo bash setup-production.sh"
  exit 1
fi

# ── 1. System Updates ──────────────────────────────────────
echo ""
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# ── 2. Swapfile (2GB) ─────────────────────────────────────
echo ""
echo "💾 Setting up 2GB swapfile..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Optimize swappiness for a web server
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "✅ Swapfile created and enabled"
else
  echo "✅ Swapfile already exists"
fi
echo "   Current swap:"
swapon --show

# ── 3. Node.js 20 LTS ─────────────────────────────────────
echo ""
echo "📦 Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "✅ Node $(node -v), npm $(npm -v)"

# ── 4. PM2 ────────────────────────────────────────────────
echo ""
echo "📦 Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root
echo "✅ PM2 installed"

# ── 5. Git ─────────────────────────────────────────────────
echo ""
apt install -y git nginx certbot python3-certbot-nginx
echo "✅ Git, Nginx, Certbot installed"

# ── 6. Firewall ────────────────────────────────────────────
echo ""
echo "🔒 Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "✅ Firewall configured (SSH + HTTP/HTTPS)"

# ── 7. Clone Repository ───────────────────────────────────
echo ""
REPO_URL="${1:-git@github.com:MowgiAU/simon-bot.git}"
APP_DIR="/root/simon-bot"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "🔗 Cloning repository..."
  git clone -b main "$REPO_URL" "$APP_DIR"
else
  echo "✅ Repository already cloned at $APP_DIR"
fi

cd "$APP_DIR"

# ── 8. Install Dependencies ───────────────────────────────
echo ""
echo "📚 Installing dependencies..."
npm install
cd dashboard && npm install && cd ..

# ── 9. Environment File ───────────────────────────────────
echo ""
if [ ! -f .env ]; then
  cp .env.production .env
  echo "📝 Created .env from .env.production template"
  echo "   ⚠️  EDIT THIS FILE before starting the app:"
  echo "   nano $APP_DIR/.env"
  echo ""
  echo "   Required values to fill in:"
  echo "   - DISCORD_TOKEN (production bot token)"
  echo "   - DISCORD_CLIENT_ID"
  echo "   - DISCORD_CLIENT_SECRET"
  echo "   - DATABASE_URL (your DO Managed PostgreSQL connection string)"
  echo "   - DIRECT_DATABASE_URL (direct connection for migrations)"
  echo "   - SESSION_SECRET (generate with: openssl rand -hex 32)"
  echo "   - OPENAI_API_KEY"
  echo "   - RESEND_API_KEY"
  echo "   - R2_* (Cloudflare R2 credentials)"
else
  echo "✅ .env already exists"
fi

# ── 10. Nginx Configuration ───────────────────────────────
echo ""
echo "📝 Creating Nginx config..."
cat > /etc/nginx/sites-available/fujistudio << 'NGINX'
server {
    listen 80;
    server_name fujistud.io www.fujistud.io;

    # Redirect to HTTPS (certbot will add the SSL block)
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name fujistud.io www.fujistud.io;

    # SSL certs managed by certbot (run certbot after setup)
    # ssl_certificate /etc/letsencrypt/live/fujistud.io/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/fujistud.io/privkey.pem;

    client_max_body_size 100M;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # Auth routes
    location /auth/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dashboard static files (pre-built Vite output)
    location / {
        root /root/simon-bot/dashboard/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Uploaded files
    location /uploads/ {
        alias /root/simon-bot/public/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/fujistudio /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✅ Nginx configured"

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env:           nano $APP_DIR/.env"
echo "  2. SSL certificate:     certbot --nginx -d fujistud.io -d www.fujistud.io"
echo "  3. Run DB migration:    cd $APP_DIR && npx prisma migrate deploy"
echo "  4. Build:               npm run build && cd dashboard && npm run build && cd .."
echo "  5. Start:               pm2 start ecosystem.config.cjs && pm2 save"
echo ""
echo "GitHub Actions secrets needed:"
echo "  PROD_HOST       = $(curl -s ifconfig.me)"
echo "  PROD_USERNAME   = root"
echo "  PROD_SSH_KEY    = (your deploy SSH private key)"
echo "════════════════════════════════════════════════════"
