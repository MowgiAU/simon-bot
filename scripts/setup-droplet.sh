#!/bin/bash
# Quick setup script for DigitalOcean droplet
# Run this on the droplet after basic setup: bash setup.sh

set -e

echo "🚀 Simon Bot DigitalOcean Setup"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ This script must be run as root"
  exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify Node installation
echo "✅ Node version: $(node --version)"
echo "✅ NPM version: $(npm --version)"

# Install PM2 globally
echo "📦 Installing PM2 (process manager)..."
npm install -g pm2

# Install Git
echo "📦 Installing Git..."
apt install -y git

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /root/simon-bot
cd /root/simon-bot

# Clone repository
echo "🔗 Cloning repository..."
read -p "Enter GitHub repository URL (e.g., https://github.com/user/simon-bot.git): " REPO_URL
git clone $REPO_URL .

# Install dependencies
echo "📚 Installing Node dependencies..."
npm install --production

echo "📚 Installing dashboard dependencies..."
cd dashboard
npm install --production
cd ..

# Setup .env file
echo "⚙️ Setting up environment file..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Created .env file. Please edit it with your configuration:"
  echo "   nano .env"
  echo ""
  echo "Required values:"
  echo "  - DISCORD_TOKEN"
  echo "  - DISCORD_CLIENT_ID"
  echo "  - DATABASE_URL"
  echo "  - NODE_ENV (staging or production)"
  echo ""
  read -p "Press Enter after editing .env file..."
fi

# Initialize database
echo "🗄️ Initializing database..."
npx prisma migrate deploy

# Build application
echo "🔨 Building bot..."
npm run build

echo "🎨 Building dashboard..."
npm run dashboard:build

# Setup PM2
echo "⚙️ Setting up PM2..."
pm2 start "npm run start" --name bot --watch
pm2 start "npm run api:dev" --name api --watch
pm2 start "npm run preview" --cwd dashboard --name dashboard

pm2 save
pm2 startup

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit your .env file if you haven't already:"
echo "   nano /root/simon-bot/.env"
echo ""
echo "2. Check service status:"
echo "   pm2 status"
echo ""
echo "3. View logs:"
echo "   pm2 logs"
echo ""
echo "4. Test API:"
echo "   curl http://localhost:3001/health"
echo ""
echo "5. Access dashboard:"
echo "   Open http://YOUR_SERVER_IP:3000 in browser"
echo ""
