# 🚀 Deployment Checklist & Troubleshooting

## Pre-Deployment Checklist

### 🔒 Security
- [ ] Change default admin password (VITE_PASSWORD)
- [ ] Change default creator password (VITE_CREATOR_PASSWORD)
- [ ] Generate secure JWT_SECRET (48+ characters)
- [ ] No hardcoded credentials in code
- [ ] .env files not committed to git
- [ ] HTTPS enabled (certificate configured)
- [ ] Database password is strong and unique
- [ ] File storage credentials secured (R2 or ImgBB)
- [ ] CORS properly configured for your domain
- [ ] Security headers enabled (X-Frame-Options, CSP, etc.)

### 🗄️ Database
- [ ] PostgreSQL installed and running
- [ ] Database created
- [ ] Schema initialized (sql/schema.sql applied)
- [ ] Database backups configured
- [ ] SSL/TLS enabled for database connection
- [ ] Database user has proper permissions
- [ ] Connection pool configured

### 🌐 Network & DNS
- [ ] Domain purchased and configured
- [ ] DNS records pointing to server
- [ ] SSL certificate obtained (Let's Encrypt recommended)
- [ ] Firewall rules configured (allow ports 80, 443)
- [ ] Rate limiting configured
- [ ] DDoS protection enabled (if available)

### 📦 Application
- [ ] Node.js v18+ installed
- [ ] npm dependencies installed
- [ ] Build successful (`npm run build`)
- [ ] Frontend dist folder created
- [ ] All environment variables set
- [ ] API endpoints tested
- [ ] File uploads tested
- [ ] Email/notifications tested

### 📊 Monitoring
- [ ] Error tracking enabled (Sentry recommended)
- [ ] Logging configured
- [ ] Uptime monitoring set
- [ ] Performance monitoring enabled
- [ ] Database monitoring configured
- [ ] Alerting rules created

### 📋 Documentation
- [ ] Admin credentials documented (securely)
- [ ] Backup procedures documented
- [ ] Support contact information available
- [ ] Deployment notes saved

---

## Deployment Methods

### Option 1: Vercel (Easiest)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in dashboard:
# - DATABASE_URL
# - JWT_SECRET
# - VITE_USER
# - VITE_PASSWORD
# - VITE_CREATOR_USER
# - VITE_CREATOR_PASSWORD
# - CF_ACCOUNT_ID, CF_ACCESS_KEY_ID, CF_SECRET_ACCESS_KEY (for R2)
```

**Pros:**
- ✅ Automatic HTTPS
- ✅ Zero-config deployments
- ✅ Free tier available
- ✅ Global CDN

**Cons:**
- ❌ Limited to serverless
- ❌ Cold starts
- ❌ Cost at scale

---

### Option 2: Docker + VPS

```bash
# Build image
docker build -t alpha-erp:v13 .

# Run with environment
docker run -d \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e VITE_USER="admin" \
  -e VITE_PASSWORD="secure-pass" \
  -p 3000:3000 \
  --name alpha-erp \
  alpha-erp:v13
```

**Pros:**
- ✅ Full control
- ✅ Affordable
- ✅ Portable

**Cons:**
- ❌ Manual management required
- ❌ Need server knowledge

---

### Option 3: Docker Compose

```bash
# Copy .env files
cp .env.production .env

# Start stack
docker-compose up -d

# View logs
docker-compose logs -f
```

**Pros:**
- ✅ Complete stack in one command
- ✅ Database included
- ✅ Easy to manage

**Cons:**
- ❌ Requires Docker/Docker Compose

---

### Option 4: Traditional Server (IONOS/AWS/DigitalOcean)

```bash
# SSH to server
ssh user@server.ip

# Clone project
git clone https://github.com/yourrepo/alpha-erp.git
cd alpha-erp

# Install dependencies
npm install --break-system-packages

# Create .env with production settings
nano .env.production
cp .env.production .env

# Build
npm run build

# Start background service
npm run start:bg

# View logs
npm run logs
```

**Pros:**
- ✅ Full control
- ✅ No vendor lock-in
- ✅ Predictable costs

**Cons:**
- ❌ Manual SSL setup
- ❌ Manual backups
- ❌ Server management needed

---

## Post-Deployment

### Verify Installation

```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Expected response:
# {
#   "status": "ok",
#   "version": "13",
#   "db": "configured"
# }

# Test login
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'

# Should return JWT token
```

### Initialize Data

```bash
# Trigger auto-seed (happens on first API call)
curl https://your-domain.com/api/health

# Or manually seed
curl -X POST https://your-domain.com/api/migrate
```

### Configure Backups

```bash
# Daily database backup (cron job)
0 2 * * * pg_dump $DATABASE_URL > /backups/alpha_$(date +\%Y\%m\%d).sql
```

### Enable Monitoring

1. **Sentry** (Error Tracking)
   ```env
   SENTRY_DSN=https://your-key@sentry.io/project
   SENTRY_ENABLED=true
   ```

2. **Uptime Monitoring**
   - UptimeRobot: Monitor `/api/health`
   - Interval: Every 5 minutes
   - Alert on failure

3. **Log Aggregation**
   - Papertrail / Loggly
   - Send logs to external service

---

## 🔧 Troubleshooting

### ❌ Error: Database Connection Failed

**Symptoms:** 
```
Error: could not connect to database
```

**Solutions:**

1. Verify connection string:
   ```bash
   psql "your-database-url"
   ```

2. Check database is running:
   ```bash
   docker ps | grep postgres
   ```

3. Verify credentials:
   ```bash
   echo $DATABASE_URL
   ```

4. Check firewall:
   ```bash
   telnet db-host.com 5432
   ```

5. Enable SSL if required:
   ```env
   DATABASE_URL=postgresql://...?sslmode=require
   ```

---

### ❌ Error: Login Fails

**Symptoms:**
```
Invalid credentials / Login failed
```

**Solutions:**

1. Check default credentials in database:
   ```sql
   SELECT username, password_hash FROM users LIMIT 1;
   ```

2. Verify password hash:
   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('Admin@12345').digest('hex'))"
   ```

3. Check if user is active:
   ```sql
   SELECT is_active FROM users WHERE username='admin';
   ```

4. Reset admin password:
   ```sql
   UPDATE users SET password_hash='HASH_HERE' WHERE username='admin';
   ```

---

### ❌ Error: API Calls Return 401 Unauthorized

**Symptoms:**
```
Unauthorized / Token invalid
```

**Solutions:**

1. Check JWT_SECRET matches:
   - Must be same on all instances
   - Cannot change without invalidating tokens

2. Verify token in localStorage:
   ```javascript
   console.log(localStorage.getItem('erp_token'))
   ```

3. Check token expiry:
   ```javascript
   const token = localStorage.getItem('erp_token')
   const payload = JSON.parse(atob(token.split('.')[1]))
   console.log(new Date(payload.exp * 1000))
   ```

4. Force re-login:
   ```javascript
   localStorage.removeItem('erp_token')
   localStorage.removeItem('erp_user')
   window.location.href = '/login'
   ```

---

### ❌ Error: File Upload Fails

**Symptoms:**
```
Error uploading file / Storage not configured
```

**Solutions:**

1. Check storage provider configured:
   ```bash
   echo $CF_ACCOUNT_ID    # Cloudflare R2
   echo $IMGBB_API_KEY    # ImgBB
   ```

2. Verify R2 credentials:
   ```bash
   curl -H "Authorization: Bearer $CF_ACCESS_KEY_ID" \
     https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/r2/buckets
   ```

3. Check ImgBB API:
   ```bash
   curl "https://api.imgbb.com/1/upload?key=$IMGBB_API_KEY" \
     -F "image=@test.png"
   ```

4. Fallback to local storage (dev only)

---

### ❌ Error: High Memory Usage

**Symptoms:**
```
Node process using 500MB+
```

**Solutions:**

1. Restart service:
   ```bash
   npm run restart
   ```

2. Check for memory leaks:
   ```bash
   # Monitor memory
   node --inspect server.js
   # Open chrome://inspect
   ```

3. Increase Node memory:
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm start
   ```

4. Enable clustering (production):
   - Use PM2 or StrongLoop Process Manager

---

### ❌ Error: Slow API Responses

**Symptoms:**
```
API taking 5+ seconds
```

**Solutions:**

1. Check database performance:
   ```sql
   -- View slow queries
   SELECT query FROM pg_stat_statements WHERE mean_exec_time > 1000;
   ```

2. Add database indexes:
   ```sql
   CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
   CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);
   ```

3. Enable query caching (Redis):
   ```env
   REDIS_URL=redis://localhost:6379
   ```

4. Monitor API endpoints:
   ```bash
   npm run logs | grep slow
   ```

5. Check server resources:
   ```bash
   top
   df -h
   ```

---

### ❌ Error: CORS Errors

**Symptoms:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solutions:**

1. Check CORS configuration:
   ```env
   CORS_ORIGIN=https://yourdomain.com
   ```

2. Verify origin header:
   ```bash
   curl -H "Origin: https://yourdomain.com" -v https://api.yourdomain.com/api/health
   ```

3. Check proxy configuration:
   ```nginx
   proxy_pass_request_headers on;
   ```

4. Allow localhost in development:
   ```env
   NODE_ENV=development  # Auto-allows all origins
   ```

---

### ❌ Error: SSL Certificate Invalid

**Symptoms:**
```
ERR_CERT_AUTHORITY_INVALID
```

**Solutions:**

1. Get free certificate (Let's Encrypt):
   ```bash
   certbot certonly --standalone -d yourdomain.com
   ```

2. Configure in Nginx:
   ```nginx
   ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
   ```

3. Auto-renew certificate:
   ```bash
   certbot renew --quiet
   # Add to cron: 0 3 * * * certbot renew --quiet
   ```

4. Force HTTPS redirect:
   ```nginx
   server {
     listen 80;
     server_name yourdomain.com;
     return 301 https://$server_name$request_uri;
   }
   ```

---

### ❌ Error: 502 Bad Gateway

**Symptoms:**
```
502 Bad Gateway
```

**Solutions:**

1. Check backend is running:
   ```bash
   curl http://localhost:3000/api/health
   ```

2. Check Nginx proxy config:
   ```nginx
   upstream alpha {
     server localhost:3000;
   }
   server {
     location /api {
       proxy_pass http://alpha;
     }
   }
   ```

3. Check logs:
   ```bash
   npm run logs
   tail -f /var/log/nginx/error.log
   ```

4. Increase timeouts:
   ```nginx
   proxy_connect_timeout 60s;
   proxy_send_timeout 60s;
   proxy_read_timeout 60s;
   ```

---

## 📊 Performance Optimization

### Enable Compression
```nginx
gzip on;
gzip_types text/plain text/css application/json;
gzip_min_length 1000;
```

### Database Optimization
```sql
-- Analyze tables
ANALYZE;

-- Vacuum tables
VACUUM ANALYZE;

-- Check index usage
SELECT * FROM pg_stat_user_indexes;
```

### Frontend Optimization
```bash
# Check bundle size
npm run build
ls -lh dist/

# Analyze build
npm install --save-dev webpack-bundle-analyzer
```

### Caching
```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|gif)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Don't cache HTML
location / {
  expires -1;
}
```

---

## 📞 Getting Help

If issues persist:

1. **Check logs:**
   ```bash
   npm run logs | tail -50
   ```

2. **Enable debug mode:**
   ```env
   VITE_ENABLE_DEBUG=true
   LOG_LEVEL=debug
   ```

3. **Test API manually:**
   ```bash
   curl -v https://your-domain.com/api/health
   ```

4. **Check server resources:**
   ```bash
   free -h      # Memory
   df -h        # Disk
   top          # Processes
   ```

5. **Contact support:**
   - Email: support@alpha-01.com
   - Provide: error logs, environment config, steps to reproduce

