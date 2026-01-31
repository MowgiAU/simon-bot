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

# Install Node.js 20 (LTS)
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
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

# Install PostgreSQL (Optional but recommended for Staging)
echo "📦 Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

if [ -n "$DB_PASSWORD" ]; then
    echo "⚙️  Configuring PostgreSQL automatically..."
    # Check if DB exists to avoid errors
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'simon_staging'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE simon_staging;"
    
    # Check if user exists
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = 'simon_runner'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER simon_runner WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
    
    # Grant privileges
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE simon_staging TO simon_runner;"
    sudo -u postgres psql -c "ALTER DATABASE simon_staging OWNER TO simon_runner;"
    echo "✅ Database configured: simon_staging / simon_runner"
else
    echo "⚠️  No database password provided. Skipping automatic DB setup."
    echo "   You will need to create the database manually:"
    echo "   sudo -u postgres psql"
    echo "   CREATE DATABASE simon_staging;"
    echo "   CREATE USER simon_runner WITH ENCRYPTED PASSWORD 'password';"
    echo "   GRANT ALL PRIVILEGES ON DATABASE simon_staging TO simon_runner;"
fi

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /root/simon-bot
cd /root/simon-bot

# Clone repository
echo "🔗 Cloning repository..."
REPO_URL=${1}
BRANCH=${2:-main}
DB_PASSWORD=${3}

if [ -z "$REPO_URL" ]; then
    read -p "Enter GitHub repository URL (e.g., https://github.com/user/simon-bot.git): " REPO_URL
fi

git clone -b $BRANCH $REPO_URL .

# Install dependencies (installing all including devDependencies for build process)
echo "📚 Installing Node dependencies..."
npm install

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
