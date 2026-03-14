-- ============================================================
--  Alpha Ultimate ERP v11 — NeonDB Schema
--  Domain: erp.alpha-01.com
--  IDEMPOTENT: safe to run multiple times
--
--  DEFAULT LOGIN: admin / Admin@12345
--  Hash below = SHA-256 hex of "Admin@12345"
--  Verified with: node -e "require('crypto').createHash('sha256').update('Admin@12345').digest('hex')"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SEQUENCE IF NOT EXISTS expense_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS asset_seq      START 1;
CREATE SEQUENCE IF NOT EXISTS liability_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS investment_seq START 1;
CREATE SEQUENCE IF NOT EXISTS budget_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS worker_seq     START 1;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT        UNIQUE NOT NULL,
  email           TEXT        UNIQUE NOT NULL,
  password_hash   TEXT        NOT NULL,
  full_name       TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'staff' CHECK (role IN ('superuser','manager','staff')),
  department      TEXT,
  phone           TEXT,
  whatsapp_number TEXT,
  avatar_url      TEXT,
  id_photo_url    TEXT,
  id_number       TEXT,
  nationality     TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login      TIMESTAMPTZ,
  last_login_ip   TEXT
);

-- 2. PERMISSIONS
CREATE TABLE IF NOT EXISTS user_permissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module       TEXT        NOT NULL,
  access_level TEXT        NOT NULL DEFAULT 'none' CHECK (access_level IN (
    'none','submit_only','view_own','view_all','view_with_details',
    'report_view','report_with_details','full_control'
  )),
  granted_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module)
);

-- 3. EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS expense_categories (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT    NOT NULL,
  code      TEXT    UNIQUE,
  is_active BOOLEAN DEFAULT true
);

-- 4. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  form_number       TEXT          UNIQUE NOT NULL,
  submitted_by      UUID          NOT NULL REFERENCES users(id),
  submitted_by_name TEXT          NOT NULL,
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  project_name      TEXT,
  project_location  TEXT,
  category_id       UUID          REFERENCES expense_categories(id),
  notes             TEXT,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  media_urls        JSONB         DEFAULT '[]',
  is_locked         BOOLEAN       NOT NULL DEFAULT true,
  status            TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hold')),
  approved_by       UUID          REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  rejection_comment TEXT
);

CREATE TABLE IF NOT EXISTS expense_line_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit        TEXT,
  unit_price  NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2)  NOT NULL DEFAULT 15,
  line_total  NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  INTEGER       DEFAULT 0
);

-- 5. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT          UNIQUE NOT NULL,
  submitted_by      UUID          NOT NULL REFERENCES users(id),
  submitted_by_name TEXT          NOT NULL,
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  client_name       TEXT          NOT NULL,
  client_address    TEXT,
  client_vat_number TEXT,
  project_name      TEXT,
  po_number         TEXT,
  notes             TEXT,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  media_urls        JSONB         DEFAULT '[]',
  is_locked         BOOLEAN       NOT NULL DEFAULT true,
  status            TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hold')),
  approved_by       UUID          REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  rejection_comment TEXT
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  TEXT          NOT NULL,
  quantity     NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit         TEXT,
  unit_price   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_percent  NUMERIC(5,2)  NOT NULL DEFAULT 15,
  line_total   NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order   INTEGER       DEFAULT 0
);

-- 6. ASSETS
CREATE TABLE IF NOT EXISTS assets (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number        TEXT          UNIQUE NOT NULL,
  name                TEXT          NOT NULL,
  category            TEXT          DEFAULT 'equipment',
  description         TEXT,
  location            TEXT,
  project_branch      TEXT,
  purchase_date       DATE,
  purchase_cost       NUMERIC(14,2) DEFAULT 0,
  current_value       NUMERIC(14,2) DEFAULT 0,
  useful_life_years   INTEGER       DEFAULT 5,
  salvage_value       NUMERIC(14,2) DEFAULT 0,
  depreciation_method TEXT          DEFAULT 'straight_line',
  vendor              TEXT,
  warranty_expiry     DATE,
  serial_number       TEXT,
  media_urls          JSONB         DEFAULT '[]',
  status              TEXT          NOT NULL DEFAULT 'in_use' CHECK (status IN ('in_use','under_maintenance','disposed','lost')),
  notes               TEXT,
  submitted_by        UUID          REFERENCES users(id),
  submitted_by_name   TEXT,
  internal_owner_name TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 7. INVESTMENTS
CREATE TABLE IF NOT EXISTS investments (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  inv_number        TEXT          UNIQUE NOT NULL,
  title             TEXT          NOT NULL,
  type              TEXT          DEFAULT 'equity',
  project_branch    TEXT,
  start_date        DATE,
  end_date          DATE,
  principal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency          TEXT          DEFAULT 'SAR',
  expected_roi_pct  NUMERIC(5,2)  DEFAULT 0,
  payment_frequency TEXT          DEFAULT 'yearly',
  risk_level        TEXT          DEFAULT 'medium',
  investor_name     TEXT,
  investor_contact  TEXT,
  status            TEXT          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed','hold','written_off')),
  media_urls        JSONB         DEFAULT '[]',
  notes             TEXT,
  submitted_by      UUID          REFERENCES users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 8. LIABILITIES
CREATE TABLE IF NOT EXISTS liabilities (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  lib_number       TEXT          UNIQUE NOT NULL,
  type             TEXT          DEFAULT 'bank_loan',
  lender_supplier  TEXT          NOT NULL,
  project_branch   TEXT,
  principal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate    NUMERIC(5,2)  DEFAULT 0,
  start_date       DATE,
  maturity_date    DATE,
  installment_amt  NUMERIC(14,2) DEFAULT 0,
  frequency        TEXT          DEFAULT 'monthly',
  outstanding      NUMERIC(14,2) DEFAULT 0,
  status           TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled','overdue','restructured')),
  media_urls       JSONB         DEFAULT '[]',
  notes            TEXT,
  submitted_by     UUID          REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 9. BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_number    TEXT          UNIQUE NOT NULL,
  name             TEXT          NOT NULL,
  category         TEXT          DEFAULT 'operations',
  fiscal_year      INTEGER       NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  fiscal_quarter   INTEGER       DEFAULT 1 CHECK (fiscal_quarter BETWEEN 1 AND 4),
  total_budget     NUMERIC(14,2) NOT NULL DEFAULT 0,
  spent_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  committed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  project_branch   TEXT,
  status           TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','draft')),
  notes            TEXT,
  submitted_by     UUID          REFERENCES users(id),
  created_by_name  TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 10. MEDIA
CREATE TABLE IF NOT EXISTS media_uploads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  entity_type  TEXT,
  entity_id    UUID,
  file_name    TEXT        NOT NULL,
  file_type    TEXT,
  file_size    INTEGER,
  cdn_url      TEXT        NOT NULL,
  thumb_url    TEXT,
  delete_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT,
  entity_type TEXT,
  entity_id   UUID,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  user_name   TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB,
  updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. WORKERS
CREATE TABLE IF NOT EXISTS workers (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             TEXT          UNIQUE,
  full_name               TEXT          NOT NULL,
  arabic_name             TEXT,
  nationality             TEXT          DEFAULT 'Saudi',
  national_id             TEXT,
  passport_number         TEXT,
  iqama_number            TEXT,
  iqama_expiry            DATE,
  date_of_birth           DATE,
  gender                  TEXT          DEFAULT 'Male',
  marital_status          TEXT          DEFAULT 'Single',
  phone                   TEXT,
  phone2                  TEXT,
  email                   TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  position                TEXT          DEFAULT 'Worker',
  department              TEXT          DEFAULT 'Operations',
  project_assignment      TEXT,
  join_date               DATE,
  contract_type           TEXT          DEFAULT 'Full-time',
  contract_end            DATE,
  basic_salary            NUMERIC(14,2) DEFAULT 0,
  housing_allowance       NUMERIC(14,2) DEFAULT 0,
  transport_allowance     NUMERIC(14,2) DEFAULT 0,
  other_allowance         NUMERIC(14,2) DEFAULT 0,
  bank_name               TEXT,
  bank_iban               TEXT,
  photo_url               TEXT,
  id_photo_url            TEXT,
  passport_photo_url      TEXT,
  iqama_photo_url         TEXT,
  status                  TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','terminated','on_leave')),
  notes                   TEXT,
  created_by              UUID          REFERENCES users(id),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 15. SALARY RECORDS
CREATE TABLE IF NOT EXISTS salary_records (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id           UUID          NOT NULL REFERENCES workers(id),
  worker_name         TEXT          NOT NULL,
  period_month        INTEGER       NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year         INTEGER       NOT NULL,
  basic_salary        NUMERIC(14,2) DEFAULT 0,
  housing_allowance   NUMERIC(14,2) DEFAULT 0,
  transport_allowance NUMERIC(14,2) DEFAULT 0,
  other_allowance     NUMERIC(14,2) DEFAULT 0,
  overtime_hours      NUMERIC(8,2)  DEFAULT 0,
  overtime_rate       NUMERIC(8,2)  DEFAULT 25,
  overtime_pay        NUMERIC(14,2) DEFAULT 0,
  deductions          NUMERIC(14,2) DEFAULT 0,
  deduction_reason    TEXT,
  bonus               NUMERIC(14,2) DEFAULT 0,
  bonus_reason        TEXT,
  gross_salary        NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_salary          NUMERIC(14,2) NOT NULL DEFAULT 0,
  gosi_employee       NUMERIC(14,2) DEFAULT 0,
  gosi_employer       NUMERIC(14,2) DEFAULT 0,
  working_days        INTEGER       DEFAULT 26,
  absent_days         INTEGER       DEFAULT 0,
  leave_days          INTEGER       DEFAULT 0,
  payment_method      TEXT          DEFAULT 'bank_transfer',
  payment_date        DATE,
  status              TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  notes               TEXT,
  created_by          UUID          REFERENCES users(id),
  created_by_name     TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, period_month, period_year)
);

-- 16. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID          NOT NULL REFERENCES workers(id),
  worker_name     TEXT          NOT NULL,
  date            DATE          NOT NULL,
  check_in        TIME,
  check_out       TIME,
  hours_worked    NUMERIC(5,2)  DEFAULT 0,
  status          TEXT          NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','leave','holiday','half_day')),
  overtime_hours  NUMERIC(5,2)  DEFAULT 0,
  project         TEXT,
  location        TEXT,
  notes           TEXT,
  approved_by     UUID          REFERENCES users(id),
  created_by      UUID          REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, date)
);

-- 17. CUSTOM FORMS
CREATE TABLE IF NOT EXISTS custom_forms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  module      TEXT        DEFAULT 'general',
  fields      JSONB       DEFAULT '[]',
  settings    JSONB       DEFAULT '{}',
  status      TEXT        DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  created_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. NOTIFICATION TEMPLATES
CREATE TABLE IF NOT EXISTS notification_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT        UNIQUE NOT NULL,
  label       TEXT        NOT NULL,
  email_subj  TEXT,
  email_body  TEXT,
  wa_body     TEXT,
  sms_body    TEXT,
  is_active   BOOLEAN     DEFAULT true,
  updated_by  UUID        REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WALLET VIEW
CREATE OR REPLACE VIEW user_wallet_balance AS
SELECT
  u.id AS user_id, u.full_name,
  COALESCE((SELECT SUM(grand_total) FROM expenses WHERE submitted_by=u.id AND status='approved'),0) AS total_expenses,
  COALESCE((SELECT SUM(grand_total) FROM invoices  WHERE submitted_by=u.id AND status='approved'),0) AS total_invoiced,
  COALESCE((SELECT SUM(grand_total) FROM invoices  WHERE submitted_by=u.id AND status='approved'),0)
  - COALESCE((SELECT SUM(grand_total) FROM expenses WHERE submitted_by=u.id AND status='approved'),0) AS balance
FROM users u;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_expenses_sub      ON expenses(submitted_by, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_invoices_sub      ON invoices(submitted_by, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user        ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workers_status    ON workers(status);
CREATE INDEX IF NOT EXISTS idx_salary_period     ON salary_records(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_assets_status     ON assets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_year      ON budgets(fiscal_year);

-- ══════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════

INSERT INTO expense_categories (name, code) VALUES
  ('Materials & Supplies',  'MAT'),('Labour & Wages','LAB'),
  ('Equipment & Tools','EQP'),('Transport & Fuel','TRN'),
  ('Utilities','UTL'),('Office & Admin','OFC'),
  ('Maintenance & Repairs','MNT'),('Safety & PPE','SAF'),
  ('Miscellaneous','MSC')
ON CONFLICT (code) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- SUPERUSER — username: admin   password: Admin@12345
-- Hash = crypto.createHash('sha256').update('Admin@12345').digest('hex')
-- ══════════════════════════════════════════════════════════════
INSERT INTO users (username, email, password_hash, full_name, role, is_active)
VALUES (
  'admin',
  'admin@alpha-ultimate.com',
  '6f2cb9dd8f4b65e24e1c3f3fa5bc57982349237f11abceacd45bbcb74d621c25',
  'System Administrator',
  'superuser',
  true
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = '6f2cb9dd8f4b65e24e1c3f3fa5bc57982349237f11abceacd45bbcb74d621c25',
  role          = 'superuser',
  is_active     = true;

INSERT INTO system_settings (key,value) VALUES
  ('company_name',           '"Alpha Ultimate Ltd"'),
  ('company_cr',             '"1234567890"'),
  ('company_vat',            '""'),
  ('company_address',        '"Riyadh, Saudi Arabia"'),
  ('company_phone',          '""'),
  ('company_email',          '"erp@alpha-01.info"'),
  ('company_website',        '"https://www.alpha-01.info"'),
  ('currency',               '"SAR"'),
  ('vat_rate',               '"15"'),
  ('fiscal_year_start',      '"01"'),
  ('timezone',               '"Asia/Riyadh"'),
  ('date_format',            '"DD/MM/YYYY"'),
  ('week_start',             '"sat"'),
  ('report_title',           '"Alpha Ultimate Ltd"'),
  ('report_subtitle',        '"Construction & Cleaning Services | Riyadh, KSA"'),
  ('report_footer',          '"Alpha Ultimate Ltd — Computer Generated Document"'),
  ('report_show_logo',       'true'),
  ('salary_gosi_rate',       '"10"'),
  ('salary_ot_rate',         '"25"'),
  ('working_days_month',     '"26"'),
  ('notif_whatsapp_enabled', 'false'),
  ('notif_whatsapp_token',   '""'),
  ('notif_whatsapp_phone_id','""'),
  ('notif_email_enabled',    'false'),
  ('notif_email_smtp_host',  '""'),
  ('notif_email_smtp_port',  '"587"'),
  ('notif_email_user',       '""'),
  ('notif_email_pass',       '""'),
  ('notif_email_from',       '"reply@alpha-01.info"'),
  ('notif_inapp_enabled',    'true'),
  ('notif_templates',        '{}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO notification_templates (event_name,label,email_subj,wa_body) VALUES
  ('expense_submitted','Expense Submitted','New Expense — {{form_number}}','📋 *New Expense*\nForm: {{form_number}}\nBy: {{submitted_by}}\nAmount: SAR {{amount}}'),
  ('expense_approved', 'Expense Approved', 'Expense Approved ✓',          '✅ *Expense Approved*\nForm: {{form_number}}'),
  ('expense_rejected', 'Expense Rejected', 'Expense Rejected',            '❌ *Expense Rejected*\nForm: {{form_number}}\nReason: {{comment}}'),
  ('invoice_submitted','Invoice Submitted','New Invoice — {{invoice_number}}','🧾 *New Invoice*\nInvoice: {{invoice_number}}\nAmount: SAR {{amount}}'),
  ('invoice_approved', 'Invoice Approved', 'Invoice Approved ✓',          '✅ *Invoice Approved*\nInvoice: {{invoice_number}}')
ON CONFLICT (event_name) DO NOTHING;

SELECT 'v11 schema installed ✅  Login: admin / Admin@12345' AS result;

-- =============================================
-- v12 ADDITIONS
-- =============================================

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name       TEXT          NOT NULL DEFAULT 'Starter',
  status          TEXT          NOT NULL DEFAULT 'trial'
                  CHECK (status IN ('active','trial','suspended','expired','cancelled')),
  started_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  trial_ends_at   TIMESTAMPTZ,
  billing_cycle   TEXT          NOT NULL DEFAULT 'monthly'
                  CHECK (billing_cycle IN ('monthly','yearly','lifetime')),
  price_paid      NUMERIC(12,2) DEFAULT 0,
  max_users       INTEGER       DEFAULT 5,
  max_storage_gb  INTEGER       DEFAULT 5,
  contact_email   TEXT,
  contact_phone   TEXT,
  notes           TEXT,
  updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed a default trial subscription if none exists
INSERT INTO subscriptions (plan_name, status, billing_cycle, max_users, max_storage_gb, trial_ends_at)
SELECT 'Starter', 'trial', 'monthly', 5, 5, NOW() + INTERVAL '30 days'
WHERE NOT EXISTS (SELECT 1 FROM subscriptions);

-- Ensure last_login_ip column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS iqama_photo_url TEXT;
