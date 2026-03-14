#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  Alpha Ultimate ERP v13 — Quick Start Setup                       ║
# ║  Usage: bash quick-start.sh                                       ║
# ╚═══════════════════════════════════════════════════════════════════╝

set -e  # Exit on error

echo "╔═════════════════════════════════════════════════════════════╗"
echo "║  Alpha Ultimate ERP v13 — Quick Setup Wizard 🚀             ║"
echo "╚═════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js detected: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
  echo "❌ npm not found."
  exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm detected: $NPM_VERSION"
echo ""

# Create .env.development if it doesn't exist
if [ ! -f ".env.development" ]; then
  echo "📝 Creating .env.development..."
  cat > .env.development << 'EOF'
# Alpha Ultimate ERP v13 — Development Environment
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alpha_erp_dev
JWT_SECRET=dev-secret-change-this-in-production-1234567890123456
VITE_USER=admin
VITE_PASSWORD=Admin@12345
VITE_CREATOR_USER=creator
VITE_CREATOR_PASSWORD=Creator@12345
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000
EOF
  echo "✅ Created .env.development"
  echo "   📌 Update DATABASE_URL with your PostgreSQL connection string"
else
  echo "✅ .env.development already exists"
fi

echo ""
echo "📦 Installing dependencies..."
npm install --break-system-packages

echo ""
echo "✅ Setup complete!"
echo ""
echo "╔═════════════════════════════════════════════════════════════╗"
echo "║  Next Steps                                                 ║"
echo "╚═════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Update .env.development with your database URL:"
echo "   nano .env.development"
echo ""
echo "2. Create/initialize your PostgreSQL database:"
echo "   psql -U postgres -d postgres -c 'CREATE DATABASE alpha_erp_dev;'"
echo "   psql -U postgres -d alpha_erp_dev -f sql/schema.sql"
echo ""
echo "3. Start the development servers (in separate terminals):"
echo ""
echo "   Terminal 1 (Backend):"
echo "   $ npm run start"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   $ npm run dev"
echo ""
echo "4. Open in browser: http://localhost:5173"
echo ""
echo "5. Login with:"
echo "   Username: admin"
echo "   Password: Admin@12345"
echo ""
echo "📚 For detailed setup: see SETUP_GUIDE.md"
echo ""
