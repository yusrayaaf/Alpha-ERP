# Alpha Ultimate ERP v13

**Enterprise ERP System** — Finance · HR · CRM · Projects · Assets · Analytics

## 🚀 Quick Start (Termux / Linux)

```bash
bash termux-setup.sh
```

Then open: http://localhost:3000  
Login: **admin** / **Admin@12345**

## 📋 Prerequisites

- **Node.js 18+** (auto-installed by setup script on Termux/Ubuntu)
- **NeonDB** free account: https://console.neon.tech *(get a free PostgreSQL URL)*
- **ImgBB** or **Cloudflare R2** for file uploads *(optional)*

## 🏗️ Modules

| Module | Features |
|--------|----------|
| 💰 **Finance** | Expenses, Invoices, Wallet, Budget — with approval workflow |
| 🏗️ **Assets** | Fixed Assets, Investments, Liabilities |
| 👷 **HR** | Workers, Salary & Payroll, Timesheet, Attendance |
| 🏢 **CRM** | Customers, Leads with Kanban pipeline |
| 📁 **Projects** | Projects, Tasks (Kanban board), progress tracking |
| 📋 **Reports** | Dashboard analytics, export PDF/Excel |
| 🔐 **System** | Users, Role-based Permissions Matrix, Audit Log |
| ⚙️ **Settings** | Company info, WhatsApp/Email notifications |

## ⚙️ Server Management

```bash
npm run start:bg   # Start server in background
npm run stop       # Stop server
npm run restart    # Restart server
npm run logs       # View live logs
```

## 🔧 Git Push

```bash
bash git-push.sh
```

## 📁 Project Structure

```
alpha-ultimate-erp-v13/
├── api/
│   ├── index.js      # Unified API router (1500+ lines, 50+ routes)
│   ├── _db.js        # PostgreSQL schema + auto-migrations
│   └── _auth.js      # JWT auth helpers
├── src/
│   ├── pages/        # 28 React pages
│   ├── lib/          # Auth, API client, Context
│   └── styles/       # Global CSS
├── server.js         # Express server
├── termux-setup.sh   # One-shot setup script
├── git-push.sh       # Git force push script
└── .env.example      # Environment template
```

## 🔑 Default Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `Admin@12345` |
| Role | Superuser (full access) |

> Change password immediately in Settings after first login.

## 📞 API Endpoints

`GET|POST|PUT|DELETE /api/<route>` — all authenticated via Bearer JWT

Key routes: `auth/login`, `expenses`, `invoices`, `workers`, `salary`, `attendance`, `assets`, `investments`, `liabilities`, `budgets`, `customers`, `leads`, `projects`, `tasks`, `reports/dashboard`, `reports/workers`, `users`, `permissions`, `settings`, `notifications`, `audit-log`
