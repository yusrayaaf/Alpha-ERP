# 📖 Alpha Ultimate ERP v13 — Quick Reference Card

## 🚀 Getting Started (5 minutes)

```bash
# 1. Setup
bash quick-start.sh

# 2. Configure database
nano .env.development
# Set DATABASE_URL

# 3. Start backend (Terminal 1)
npm run start

# 4. Start frontend (Terminal 2)  
npm run dev

# 5. Open browser
# http://localhost:5173
# Login: admin / Admin@12345
```

---

## 📝 Common Commands

### Development

```bash
# Start backend server
npm run start

# Start with debug logs
LOG_LEVEL=debug npm run start

# Start frontend (Vite)
npm run dev

# Build frontend for production
npm run build

# Preview production build
npm run preview

# Run type checking
npm run typecheck
```

### Database

```bash
# Connect to database
psql $DATABASE_URL

# Initialize schema
psql $DATABASE_URL -f sql/schema.sql

# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20240314.sql
```

### Docker

```bash
# Start full stack
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Rebuild image
docker-compose build --no-cache

# Execute command in container
docker-compose exec backend npm run logs
```

### Production

```bash
# Build for production
npm run build

# Deploy to production
npm run start

# Start in background
npm run start:bg

# View logs
npm run logs

# Restart service
npm run restart

# Stop service
npm run stop
```

---

## 🔑 Default Credentials

| User | Username | Password | Role |
|------|----------|----------|------|
| Admin | `admin` | `Admin@12345` | superuser |
| Creator | `creator` | `Creator@12345` | developer |

⚠️ **Change in production!**

---

## 🌐 Key URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `http://localhost:5173` | User interface |
| API | `http://localhost:3000/api` | REST API |
| Health Check | `http://localhost:3000/api/health` | Server status |
| Login | `http://localhost:5173/login` | Authentication |
| Dashboard | `http://localhost:5173/` | Main interface |

---

## 📚 Environment Variables (Essential)

```env
# Database (REQUIRED)
DATABASE_URL=postgresql://user:pass@host/db

# Authentication (REQUIRED)
JWT_SECRET=minimum-32-chars-random-secret

# Admin Credentials
VITE_USER=admin
VITE_PASSWORD=Admin@12345

# Server
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000
```

---

## 🔐 Security Quick Checklist

```bash
# ✅ Before production:

# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Change default passwords
# Update VITE_USER, VITE_PASSWORD in .env

# Enable HTTPS
# Update VITE_API_URL to https://...

# Configure file storage
# Set CF_ACCOUNT_ID or IMGBB_API_KEY

# Verify database SSL
# Use sslmode=require in DATABASE_URL

# Check logs don't leak secrets
grep -r "password\|secret\|token" logs/
```

---

## 📊 API Quick Reference

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@12345"}'
```

### Get Token from Response

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@12345"}' | jq -r '.token')
echo $TOKEN
```

### Use Token for API Calls

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/invoices
```

### Get All Invoices

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/invoices?limit=50"
```

### Create Invoice

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_123",
    "amount": 1000,
    "due_date": "2024-04-15"
  }'
```

---

## 🐛 Quick Troubleshooting

### Login Not Working

```bash
# 1. Check database connection
psql $DATABASE_URL -c "SELECT * FROM users LIMIT 1;"

# 2. Check user exists
psql $DATABASE_URL -c "SELECT username FROM users;"

# 3. Reset password
node -e "
  const crypto = require('crypto');
  const pwd = 'Admin@12345';
  const hash = crypto.createHash('sha256').update(pwd).digest('hex');
  console.log(hash);
"
# Then: UPDATE users SET password_hash='HASH' WHERE username='admin';
```

### Database Connection Failed

```bash
# 1. Test connection
psql "your-database-url"

# 2. Check credentials
echo $DATABASE_URL

# 3. Check if database exists
psql -U postgres -c "\l"

# 4. Create database if missing
psql -U postgres -c "CREATE DATABASE alpha_erp_dev;"

# 5. Initialize schema
psql -U postgres -d alpha_erp_dev -f sql/schema.sql
```

### API Returns 401

```bash
# 1. Check token exists
console.log(localStorage.getItem('erp_token'))

# 2. Check token is valid (not expired)
const token = localStorage.getItem('erp_token')
const [, payload] = token.split('.')
const decoded = JSON.parse(atob(payload))
console.log(new Date(decoded.exp * 1000))

# 3. Re-login to get new token
# Clear localStorage and login again
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run start
```

---

## 🎯 Typical Workflow

### 1. Create Invoice

```bash
# API call to create
curl -X POST $API/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_id": "cust_456",
    "line_items": [{
      "description": "Service",
      "quantity": 1,
      "unit_price": 500
    }]
  }'
```

### 2. Approve Invoice

```bash
curl -X POST $API/invoices/inv_123/approve \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Send to Customer

```bash
curl -X POST $API/invoices/inv_123/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"send_email": true}'
```

### 4. Track Payment

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/reports/invoices?status=pending"
```

---

## 📦 Project Structure

```
alpha-ultimate-erp-v13/
├── src/                    # Frontend (React)
│   ├── pages/             # Page components
│   ├── components/        # Reusable components
│   ├── lib/               # Utilities & contexts
│   └── assets/            # Images, fonts
├── api/                    # Backend (Express)
│   ├── index.js           # Main handler
│   ├── _auth.js           # Authentication
│   └── _db.js             # Database
├── sql/                    # Database schema
├── dist/                   # Built frontend
├── public/                 # Static files
├── server.js              # Express server
├── vite.config.ts         # Frontend config
├── package.json           # Dependencies
├── .env.development       # Dev environment
├── .env.production        # Prod environment
└── docker-compose.yml     # Docker stack
```

---

## 🎓 Learning Resources

| Topic | Resource |
|-------|----------|
| React | https://react.dev |
| TypeScript | https://typescriptlang.org |
| PostgreSQL | https://postgresql.org |
| Express | https://expressjs.com |
| REST APIs | https://restfulapi.net |
| Docker | https://docker.com |

---

## 📞 Support Channels

| Issue | Solution |
|-------|----------|
| Server won't start | Check logs: `npm run logs` |
| Login fails | See troubleshooting section |
| Slow performance | Enable Redis caching |
| Database errors | Run: `psql $DATABASE_URL -c "\dt"` |
| Missing features | Check feature flags in .env |

---

## ⏱️ Common Task Times

| Task | Time |
|------|------|
| Setup new instance | 5-10 min |
| Deploy to production | 10-15 min |
| Create invoice | <1 min |
| Generate report | 2-5 min |
| Add new user | 1-2 min |
| Database backup | 1-2 min |

---

## 🔄 Deployment Checklist

```
[ ] Database configured
[ ] Environment variables set
[ ] SSL certificate installed
[ ] File storage configured
[ ] Backups scheduled
[ ] Monitoring enabled
[ ] Admin credentials changed
[ ] Firewall rules applied
[ ] Health check working
[ ] API endpoints tested
[ ] Frontend accessible
[ ] Login functioning
[ ] Error tracking enabled
[ ] Notifications configured
```

---

## 💡 Pro Tips

- Use browser DevTools Network tab to debug API calls
- Enable debug mode: `VITE_ENABLE_DEBUG=true`
- Check `/api/health` endpoint for server status
- Use Postman for API testing
- Keep logs for troubleshooting: `npm run logs > debug.log`
- Regular backups: `pg_dump $DATABASE_URL > backup.sql`
- Monitor memory: `docker stats` or `top`
- Use Redis for caching: Install & set `REDIS_URL`

---

**Last Updated:** March 14, 2024  
**Version:** 13.0.0

