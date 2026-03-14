# 🔐 Environment Variables Reference

Complete guide to all configurable environment variables for Alpha Ultimate ERP v13.

## 📋 Table of Contents

1. [Database Configuration](#database-configuration)
2. [Authentication](#authentication)
3. [Server Settings](#server-settings)
4. [File Storage](#file-storage)
5. [API & Client](#api--client)
6. [Feature Flags](#feature-flags)
7. [Notifications](#notifications)
8. [External Services](#external-services)
9. [Logging & Debugging](#logging--debugging)

---

## Database Configuration

### `DATABASE_URL` (REQUIRED)

PostgreSQL connection string.

**Format:**
```
postgresql://[user[:password]@][host][:port][/dbname][?sslmode=...]
```

**Examples:**

Local development:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alpha_erp_dev
```

Neon cloud (recommended):
```env
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
```

AWS RDS:
```env
DATABASE_URL=postgresql://admin:password@alpha-db.xxx.us-east-1.rds.amazonaws.com:5432/alpha_erp
```

**Options:**
- `sslmode=require` — Enforce SSL (recommended for production)
- `sslmode=disable` — No SSL (dev only)
- `connect_timeout=10` — Connection timeout in seconds
- `application_name=alpha-erp` — App name for monitoring

---

## Authentication

### `JWT_SECRET` (REQUIRED)

Secret key for signing JWT tokens.

**Generate secure secret:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Requirements:**
- Minimum 32 characters (48+ recommended)
- Random, unguessable
- Change in production
- Never commit to version control

**Example:**
```env
JWT_SECRET=a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a
```

---

### `VITE_USER`

Default admin username.

**Default:** `admin`

**Set custom:**
```env
VITE_USER=mycompany_admin
```

---

### `VITE_PASSWORD`

Default admin password.

**Default:** `Admin@12345`

**Security warning:** ⚠️ Change immediately in production!

**Requirements:**
- Minimum 8 characters
- Mix of upper/lowercase, numbers, symbols recommended
- Unique and strong

**Set secure password:**
```env
VITE_PASSWORD=MySecurePass123!@#
```

---

### `VITE_CREATOR_USER`

Creator/developer panel username.

**Default:** `creator`

```env
VITE_CREATOR_USER=dev_user
```

---

### `VITE_CREATOR_PASSWORD`

Creator/developer panel password.

**Default:** `Creator@12345`

**Change in production:**
```env
VITE_CREATOR_PASSWORD=CreatorSecurePass456!@#
```

---

### `JWT_EXPIRY` (Optional)

Token expiration time in seconds.

**Default:** `2592000` (30 days)

```env
JWT_EXPIRY=86400           # 1 day
JWT_EXPIRY=604800          # 7 days
JWT_EXPIRY=2592000         # 30 days
```

---

## Server Settings

### `PORT`

Server port.

**Default:** `3000`

```env
PORT=3000
PORT=8080
PORT=5000
```

---

### `NODE_ENV`

Node.js environment.

**Options:**
- `development` — Dev mode, hot-reload, verbose logs
- `production` — Production mode, optimized, errors only

```env
NODE_ENV=development
NODE_ENV=production
```

---

### `VITE_API_URL`

API base URL for frontend.

**Development:**
```env
VITE_API_URL=http://localhost:3000
```

**Production:**
```env
VITE_API_URL=https://api.yourdomain.com
```

---

### `CORS_ORIGIN` (Optional)

Allowed CORS origins.

**Default:** `*` (allow all in development)

```env
CORS_ORIGIN=https://yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com,https://admin.yourdomain.com
```

---

### `REQUEST_TIMEOUT` (Optional)

Request timeout in milliseconds.

**Default:** `30000` (30 seconds)

```env
REQUEST_TIMEOUT=30000
REQUEST_TIMEOUT=60000      # 1 minute
```

---

## File Storage

### `CF_ACCOUNT_ID` (Optional)

Cloudflare Account ID (for R2 storage).

Get from: https://dash.cloudflare.com

```env
CF_ACCOUNT_ID=abc123def456ghi789jkl012mno345pqr
```

---

### `CF_ACCESS_KEY_ID` (Optional)

Cloudflare R2 API access key ID.

```env
CF_ACCESS_KEY_ID=62d6771fd45bbb003b92a123
```

---

### `CF_SECRET_ACCESS_KEY` (Optional)

Cloudflare R2 API secret access key.

⚠️ Keep secret!

```env
CF_SECRET_ACCESS_KEY=abc123...xyz789
```

---

### `CF_R2_BUCKET` (Optional)

Cloudflare R2 bucket name.

```env
CF_R2_BUCKET=alpha-erp-uploads
```

---

### `CF_R2_PUBLIC_URL` (Optional)

Public URL for accessing R2 files.

```env
CF_R2_PUBLIC_URL=https://pub-abc123.r2.dev
CF_R2_PUBLIC_URL=https://cdn.yourdomain.com
```

---

### `IMGBB_API_KEY` (Optional)

ImgBB API key (fallback image storage).

Get from: https://api.imgbb.com

```env
IMGBB_API_KEY=abc123def456ghi789jkl012mno345pqr
```

**Storage limit:** 32MB/month (free tier)

---

### `STORAGE_TYPE` (Optional)

Storage provider priority.

**Options:**
- `r2` — Cloudflare R2 (recommended)
- `imgbb` — ImgBB (images only)
- `local` — Local filesystem (development only)

**Default:** Auto-detect based on configured credentials

```env
STORAGE_TYPE=r2
```

---

## API & Client

### `VITE_API_TIMEOUT` (Optional)

API request timeout.

**Default:** `30000` (30 seconds)

```env
VITE_API_TIMEOUT=30000
VITE_API_TIMEOUT=60000
```

---

### `VITE_ENABLE_DEBUG` (Optional)

Enable debug mode (logs all API calls).

**Options:** `true` | `false`

**Default:** `false`

```env
VITE_ENABLE_DEBUG=true     # Development only
```

---

## Feature Flags

### `VITE_ENABLE_REPORTS`

Enable financial reports module.

**Default:** `true`

```env
VITE_ENABLE_REPORTS=true
VITE_ENABLE_REPORTS=false
```

---

### `VITE_ENABLE_APPROVALS`

Enable approval workflows.

**Default:** `true`

```env
VITE_ENABLE_APPROVALS=true
```

---

### `VITE_ENABLE_PROJECTS`

Enable projects module.

**Default:** `true`

```env
VITE_ENABLE_PROJECTS=true
```

---

### `VITE_ENABLE_CRM`

Enable CRM (Customer Relationship Management).

**Default:** `true`

```env
VITE_ENABLE_CRM=true
```

---

### `VITE_ENABLE_HR`

Enable HR (Human Resources) module.

**Default:** `true`

```env
VITE_ENABLE_HR=true
```

---

### `VITE_ENABLE_FORM_BUILDER`

Enable custom form builder.

**Default:** `true`

```env
VITE_ENABLE_FORM_BUILDER=true
```

---

### `VITE_ENABLE_ASSETS`

Enable asset management.

**Default:** `true`

```env
VITE_ENABLE_ASSETS=true
```

---

## Notifications

### `NOTIF_WHATSAPP_ENABLED`

Enable WhatsApp notifications.

**Default:** `false`

**Options:** `true` | `false`

```env
NOTIF_WHATSAPP_ENABLED=true
```

---

### `NOTIF_WHATSAPP_TOKEN`

WhatsApp Business API token.

Get from: https://www.whatsapp.com/business/

```env
NOTIF_WHATSAPP_TOKEN=EAAxx...
```

---

### `NOTIF_WHATSAPP_PHONE_ID`

WhatsApp Business Phone Number ID.

```env
NOTIF_WHATSAPP_PHONE_ID=123456789012345
```

---

### `NOTIF_EMAIL_ENABLED` (Optional)

Enable email notifications.

```env
NOTIF_EMAIL_ENABLED=true
```

---

### `NOTIF_EMAIL_PROVIDER` (Optional)

Email service provider.

**Options:** `sendgrid` | `smtp` | `aws-ses`

```env
NOTIF_EMAIL_PROVIDER=sendgrid
```

---

### `SENDGRID_API_KEY` (Optional)

SendGrid API key.

Get from: https://sendgrid.com

```env
SENDGRID_API_KEY=SG.abc123...
```

---

### `SENDGRID_FROM_EMAIL` (Optional)

Email address to send from.

```env
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

---

## External Services

### `STRIPE_API_KEY` (Optional)

Stripe API key for payment processing.

Get from: https://stripe.com

```env
STRIPE_API_KEY=sk_live_abc123...
```

---

### `STRIPE_WEBHOOK_SECRET` (Optional)

Stripe webhook signing secret.

```env
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

---

### `GOOGLE_ANALYTICS_ID` (Optional)

Google Analytics tracking ID.

```env
GOOGLE_ANALYTICS_ID=UA-123456789-1
```

---

### `SENTRY_DSN` (Optional)

Sentry error tracking DSN.

Get from: https://sentry.io

```env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456
```

---

## Logging & Debugging

### `LOG_LEVEL` (Optional)

Log verbosity level.

**Options:** `debug` | `info` | `warn` | `error`

**Default:** `info`

```env
LOG_LEVEL=debug        # Development
LOG_LEVEL=error        # Production
```

---

### `LOG_FORMAT` (Optional)

Log format.

**Options:** `json` | `text`

**Default:** `text`

```env
LOG_FORMAT=json        # Production (better for log aggregation)
```

---

### `SENTRY_ENABLED` (Optional)

Enable Sentry error tracking.

**Default:** `false`

```env
SENTRY_ENABLED=true
```

---

## Complete .env Example

### Development

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alpha_erp_dev

# Authentication
JWT_SECRET=dev-secret-change-in-production-minimum-32-chars
VITE_USER=admin
VITE_PASSWORD=Admin@12345
VITE_CREATOR_USER=creator
VITE_CREATOR_PASSWORD=Creator@12345

# Server
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000

# Features (all enabled in dev)
VITE_ENABLE_REPORTS=true
VITE_ENABLE_APPROVALS=true
VITE_ENABLE_PROJECTS=true
VITE_ENABLE_CRM=true
VITE_ENABLE_HR=true
VITE_ENABLE_FORM_BUILDER=true
VITE_ENABLE_ASSETS=true

# Debug
VITE_ENABLE_DEBUG=true
LOG_LEVEL=debug
```

### Production

```env
# Database
DATABASE_URL=postgresql://user:securepass@ep-xxx.neon.tech/alpha_erp?sslmode=require

# Authentication (CHANGE THESE!)
JWT_SECRET=production-secret-abc123xyz789...minimum-48-chars
VITE_USER=secure_admin_username
VITE_PASSWORD=SecurePassword123!@#
VITE_CREATOR_USER=secure_creator
VITE_CREATOR_PASSWORD=CreatorSecurePass456!@#

# Server
PORT=3000
NODE_ENV=production
VITE_API_URL=https://api.yourdomain.com

# File Storage
CF_ACCOUNT_ID=abc123...
CF_ACCESS_KEY_ID=62d6771...
CF_SECRET_ACCESS_KEY=abc123...xyz
CF_R2_BUCKET=alpha-erp-uploads
CF_R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Features
VITE_ENABLE_REPORTS=true
VITE_ENABLE_APPROVALS=true
VITE_ENABLE_PROJECTS=true

# Notifications
NOTIF_WHATSAPP_ENABLED=true
NOTIF_WHATSAPP_TOKEN=EAAxx...
NOTIF_WHATSAPP_PHONE_ID=123456789

# Logging
LOG_LEVEL=error
LOG_FORMAT=json
SENTRY_ENABLED=true
SENTRY_DSN=https://abc123@o.ingest.sentry.io/123
```

---

## 🔐 Security Checklist

✅ **Before production:**

- [ ] Change all default passwords
- [ ] Generate secure JWT_SECRET (48+ chars, random)
- [ ] Enable HTTPS/SSL (VITE_API_URL = https://...)
- [ ] Set NODE_ENV=production
- [ ] Configure database with SSL connection
- [ ] Use strong, unique credentials for all services
- [ ] Never commit .env files to git
- [ ] Enable file storage (R2 or ImgBB)
- [ ] Set LOG_LEVEL=error (production)
- [ ] Enable Sentry error tracking
- [ ] Restrict CORS_ORIGIN to your domain
- [ ] Configure email/WhatsApp notifications
- [ ] Set up regular database backups

---

## 📝 Notes

- Environment variables override defaults
- `.env.development` for local development
- `.env.production` for production servers
- Use `.env.local` for machine-specific overrides (git-ignored)
- Docker: Pass via `-e` flag or docker-compose `environment`
- Vercel: Set in project settings → Environment Variables

---

For questions or issues: support@alpha-01.com

