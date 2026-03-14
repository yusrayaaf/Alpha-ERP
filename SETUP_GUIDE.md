# 🚀 Alpha Ultimate ERP v13 — Complete Setup & Deployment Guide

## 📋 Quick Start (Development)

### 1️⃣ Prerequisites
- **Node.js**: v18.0.0 or higher
- **Database**: PostgreSQL 12+ (or use Neon for free)
- **Git**: Latest version
- **npm**: v9+

### 2️⃣ Installation

```bash
# Clone or extract the project
cd alpha-ultimate-erp-v13

# Install dependencies
npm install

# Create .env.development file (copy from .env.development)
cp .env.development .env.development
# Edit with your actual credentials
```

### 3️⃣ Set Environment Variables

Create `.env.development` in project root:

```env
# Database (use local PostgreSQL or Neon)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alpha_erp_dev

# Auth secrets
JWT_SECRET=dev-secret-minimum-32-chars-change-in-production-1234567890

# Creator Login Credentials
VITE_USER=admin
VITE_PASSWORD=Admin@12345

VITE_CREATOR_USER=creator
VITE_CREATOR_PASSWORD=Creator@12345

# Server
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000
```

### 4️⃣ Database Setup

#### Option A: Local PostgreSQL

```bash
# Create database and tables
psql -U postgres -d postgres -c "CREATE DATABASE alpha_erp_dev;"
psql -U postgres -d alpha_erp_dev -f sql/schema.sql
```

#### Option B: Neon PostgreSQL (Free Cloud)

1. Go to https://console.neon.tech
2. Create new project
3. Copy connection string to `DATABASE_URL` in `.env.development`

```bash
# Initialize schema
psql "postgresql://user:password@host.neon.tech/dbname?sslmode=require" -f sql/schema.sql
```

### 5️⃣ Run Development Server

```bash
# Terminal 1: Start Express backend
npm run start

# Terminal 2: Start Vite dev server
npm run dev
```

**Access the app:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Default login: `admin` / `Admin@12345`

---

## 🎯 Creator/Admin Panel Access

### Quick Login Methods:

1. **Direct Credentials** (Environment Variables)
   ```
   Username: admin (from VITE_USER)
   Password: Admin@12345 (from VITE_PASSWORD)
   ```

2. **Quick Login Buttons** (Development only)
   - Login page shows quick "Admin" and "Creator" buttons
   - Click to auto-fill credentials

3. **Creator Panel**
   - After login as admin, navigate to `/creator` (if access enabled)
   - Manage all system settings and users

---

## 🐳 Docker Deployment

### Docker Setup

```dockerfile
# Dockerfile (provided in project)
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --break-system-packages

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Run with Docker

```bash
# Build image
docker build -t alpha-erp:v13 .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e VITE_USER="admin" \
  -e VITE_PASSWORD="Admin@12345" \
  alpha-erp:v13
```

---

## 🌐 Production Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# - DATABASE_URL
# - JWT_SECRET
# - VITE_USER
# - VITE_PASSWORD
# - VITE_CREATOR_USER
# - VITE_CREATOR_PASSWORD
```

### IONOS VPS / Traditional Server

```bash
# Upload files to server
scp -r . user@server:/var/www/alpha-erp/

# SSH into server
ssh user@server

# Install & run
cd /var/www/alpha-erp
npm install --break-system-packages
npm run build

# Start background service
npm run start:bg

# View logs
npm run logs

# Restart service
npm run restart
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔐 Security Best Practices

### Environment Variables Checklist

✅ **Before Production:**

1. **Change default credentials**
   ```env
   VITE_USER=unique-admin-username
   VITE_PASSWORD=ComplexPassword123!@#
   VITE_CREATOR_PASSWORD=ComplexPassword456!@#
   ```

2. **Generate secure JWT secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

3. **Use environment-specific .env files**
   - `.env.development` — local dev only
   - `.env.production` — secure production creds
   - **NEVER commit .env files to git**

4. **Enable HTTPS/SSL**
   - Use Let's Encrypt (free)
   - Configure in Nginx/Apache

5. **Database security**
   - Use strong passwords
   - Enable SSL connections
   - Restrict network access
   - Regular backups

### .gitignore Configuration

```
.env
.env.*.local
.env.production
node_modules/
dist/
logs/
data/
*.log
.DS_Store
```

---

## 🗄️ Database Seeding

### Auto-Seed (Default)

The system auto-seeds default data on first API call:
- Default admin user: `admin` / `Admin@12345`
- Default creator user: `creator` / `Creator@12345`
- All tables created automatically

### Manual Seed

```bash
# Reset and reseed database
npm run seed
```

---

## 🔧 Troubleshooting

### ❌ Login Not Working

**Problem:** "Invalid credentials" error
**Solution:**
1. Check DATABASE_URL is correct
2. Verify database has user table
3. Check password is hashed correctly in DB:
   ```sql
   SELECT username, password_hash FROM users LIMIT 1;
   ```
4. Ensure JWT_SECRET is set

### ❌ Database Connection Failed

**Problem:** "Could not connect to database"
**Solution:**
1. Verify PostgreSQL is running
2. Check DATABASE_URL format:
   ```
   postgresql://user:pass@host:port/dbname?sslmode=require
   ```
3. Test connection:
   ```bash
   psql "your-database-url"
   ```

### ❌ PORT Already in Use

**Problem:** "Address already in use"
**Solution:**
```bash
# Change PORT in .env
PORT=3001

# Or kill existing process
lsof -i :3000
kill -9 <PID>
```

### ❌ Cannot Import Modules

**Problem:** "Cannot find module 'xyz'"
**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install --break-system-packages
```

---

## 📊 Features Enabled

Customize feature availability in `.env`:

```env
# Enable/disable modules
VITE_ENABLE_REPORTS=true
VITE_ENABLE_APPROVALS=true
VITE_ENABLE_PROJECTS=true
VITE_ENABLE_CRM=true
VITE_ENABLE_HR=true
VITE_ENABLE_FORM_BUILDER=true
VITE_ENABLE_ASSETS=true
```

---

## 📱 Mobile Support

The ERP is mobile-responsive:
- **iOS**: Use any modern browser
- **Android**: Chrome, Firefox, Samsung Internet
- **PWA**: Can be installed as app (menu → Add to Home Screen)

---

## 🎓 Learning Resources

- **React**: https://react.dev
- **TypeScript**: https://typescriptlang.org
- **PostgreSQL**: https://postgresql.org
- **Vite**: https://vitejs.dev
- **Express**: https://expressjs.com

---

## 🤝 Support & Community

- **Issues**: Create GitHub issue
- **Discussions**: GitHub Discussions
- **Docs**: See README.md
- **Email**: support@alpha-01.com

---

## 📄 License

© 2024 Alpha Ultimate ERP. All rights reserved.

---

## 🎉 You're Ready!

Your ERP system is now set up and ready to use. 

**Next steps:**
1. ✅ Access at http://localhost:5173
2. ✅ Login with default credentials
3. ✅ Create your first transaction
4. ✅ Invite team members
5. ✅ Customize to your needs

**Questions?** Check the troubleshooting section above or review logs:
```bash
npm run logs
```

Happy ERP-ing! 🚀
