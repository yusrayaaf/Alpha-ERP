// api/_db.js — Alpha Ultimate ERP v13 — Auto-migrating DB module
import { neon } from '@neondatabase/serverless';

let _sql = null;
let _migrated = false;

export async function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  if (!_migrated) {
    _migrated = true;
    await runMigrations(_sql).catch(e => console.warn('Migration warn:', e.message));
  }
  return _sql;
}

async function runMigrations(sql) {
  const stmts = SCHEMA.replace(/--[^\n]*/g, '').split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 5);
  for (const stmt of stmts) {
    try { await sql.unsafe(stmt + ';'); } catch(e) {
      if (!/already exists|duplicate key/i.test(e.message))
        console.warn('Migration skip:', e.message.slice(0, 80));
    }
  }
}

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SEQUENCE IF NOT EXISTS expense_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS asset_seq      START 1;
CREATE SEQUENCE IF NOT EXISTS liability_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS investment_seq START 1;
CREATE SEQUENCE IF NOT EXISTS budget_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS worker_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS project_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS customer_seq   START 1;

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
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login      TIMESTAMPTZ,
  last_login_ip   TEXT
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;

CREATE TABLE IF NOT EXISTS user_permissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module       TEXT        NOT NULL,
  access_level TEXT        NOT NULL DEFAULT 'none' CHECK (access_level IN (
    'none','submit_only','view_own','view_all','view_with_details',
    'report_view','report_with_details','full_control'
  )),
  granted_by   UUID,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module)
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT    NOT NULL,
  code      TEXT    UNIQUE,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS expenses (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  form_number       TEXT          UNIQUE NOT NULL,
  submitted_by      UUID          NOT NULL REFERENCES users(id),
  submitted_by_name TEXT          NOT NULL,
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  project_name      TEXT,
  project_location  TEXT,
  category_id       UUID,
  notes             TEXT,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  media_urls        JSONB         DEFAULT '[]',
  status            TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by       UUID,
  reviewed_by_name  TEXT,
  reviewed_at       TIMESTAMPTZ,
  review_comment    TEXT
);

CREATE TABLE IF NOT EXISTS expense_line_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  description  TEXT          NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent  NUMERIC(5,2)  NOT NULL DEFAULT 15,
  subtotal     NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total        NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   TEXT          UNIQUE NOT NULL,
  submitted_by     UUID          NOT NULL REFERENCES users(id),
  submitted_by_name TEXT         NOT NULL,
  submitted_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  client_name      TEXT          NOT NULL,
  client_vat       TEXT,
  client_address   TEXT,
  project_name     TEXT,
  due_date         DATE,
  notes            TEXT,
  total_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total      NUMERIC(14,2) NOT NULL DEFAULT 0,
  status           TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  reviewed_by      UUID,
  reviewed_by_name TEXT,
  reviewed_at      TIMESTAMPTZ,
  review_comment   TEXT
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  TEXT          NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent  NUMERIC(5,2)  NOT NULL DEFAULT 15,
  subtotal     NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total        NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assets (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number   TEXT          UNIQUE NOT NULL,
  name           TEXT          NOT NULL,
  category       TEXT          DEFAULT 'Equipment',
  description    TEXT,
  serial_number  TEXT,
  location       TEXT,
  purchase_date  DATE,
  purchase_price NUMERIC(14,2) DEFAULT 0,
  current_value  NUMERIC(14,2) DEFAULT 0,
  condition      TEXT          DEFAULT 'Good',
  status         TEXT          DEFAULT 'in_use' CHECK (status IN ('in_use','available','maintenance','disposed')),
  assigned_to    TEXT,
  media_urls     JSONB         DEFAULT '[]',
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT          UNIQUE NOT NULL,
  title            TEXT          NOT NULL,
  type             TEXT          DEFAULT 'Real Estate',
  amount_invested  NUMERIC(14,2) DEFAULT 0,
  current_value    NUMERIC(14,2) DEFAULT 0,
  roi_percent      NUMERIC(6,2)  DEFAULT 0,
  start_date       DATE,
  maturity_date    DATE,
  status           TEXT          DEFAULT 'active' CHECK (status IN ('active','sold','pending','cancelled')),
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liabilities (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT          UNIQUE NOT NULL,
  title            TEXT          NOT NULL,
  type             TEXT          DEFAULT 'Loan',
  principal        NUMERIC(14,2) DEFAULT 0,
  remaining        NUMERIC(14,2) DEFAULT 0,
  interest_rate    NUMERIC(6,2)  DEFAULT 0,
  start_date       DATE,
  due_date         DATE,
  creditor         TEXT,
  status           TEXT          DEFAULT 'active' CHECK (status IN ('active','paid','overdue','restructured')),
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_number  TEXT          UNIQUE NOT NULL,
  title          TEXT          NOT NULL,
  fiscal_year    INTEGER       NOT NULL,
  quarter        INTEGER,
  department     TEXT,
  category       TEXT,
  allocated      NUMERIC(14,2) DEFAULT 0,
  spent          NUMERIC(14,2) DEFAULT 0,
  remaining      NUMERIC(14,2) GENERATED ALWAYS AS (allocated - spent) STORED,
  status         TEXT          DEFAULT 'active' CHECK (status IN ('active','closed','draft')),
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_uploads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT        NOT NULL,
  filename    TEXT,
  size_bytes  INTEGER,
  mime_type   TEXT,
  storage     TEXT        DEFAULT 'imgbb',
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  user_name   TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT 'null',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             TEXT          UNIQUE NOT NULL,
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
  phone                   TEXT          NOT NULL,
  phone2                  TEXT,
  email                   TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  position                TEXT          DEFAULT 'Worker',
  department              TEXT          DEFAULT 'Operations',
  project_assignment      TEXT,
  hire_date               DATE,
  contract_end_date       DATE,
  basic_salary            NUMERIC(10,2) DEFAULT 0,
  housing_allowance       NUMERIC(10,2) DEFAULT 0,
  transport_allowance     NUMERIC(10,2) DEFAULT 0,
  other_allowances        NUMERIC(10,2) DEFAULT 0,
  status                  TEXT          DEFAULT 'active' CHECK (status IN ('active','inactive','terminated','on_leave')),
  notes                   TEXT,
  avatar_url              TEXT,
  passport_photo_url      TEXT,
  iqama_photo_url         TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_records (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id         UUID          NOT NULL REFERENCES workers(id),
  worker_name       TEXT          NOT NULL,
  period_year       INTEGER       NOT NULL,
  period_month      INTEGER       NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  basic_salary      NUMERIC(10,2) DEFAULT 0,
  housing_allowance NUMERIC(10,2) DEFAULT 0,
  transport_allowance NUMERIC(10,2) DEFAULT 0,
  other_allowances  NUMERIC(10,2) DEFAULT 0,
  overtime_hours    NUMERIC(6,2)  DEFAULT 0,
  overtime_amount   NUMERIC(10,2) DEFAULT 0,
  deductions        NUMERIC(10,2) DEFAULT 0,
  gosi_deduction    NUMERIC(10,2) DEFAULT 0,
  net_salary        NUMERIC(10,2) DEFAULT 0,
  paid_date         DATE,
  payment_method    TEXT          DEFAULT 'bank',
  status            TEXT          DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  notes             TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, period_year, period_month)
);

CREATE TABLE IF NOT EXISTS attendance (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    UUID        REFERENCES workers(id),
  worker_name  TEXT        NOT NULL,
  date         DATE        NOT NULL,
  check_in     TIME,
  check_out    TIME,
  hours_worked NUMERIC(5,2) DEFAULT 0,
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status       TEXT        DEFAULT 'present' CHECK (status IN ('present','absent','half_day','leave','holiday')),
  notes        TEXT,
  recorded_by  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_forms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  schema      JSONB       NOT NULL DEFAULT '{"fields":[]}',
  is_active   BOOLEAN     DEFAULT true,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT        UNIQUE NOT NULL,
  label       TEXT        NOT NULL,
  email_subj  TEXT,
  email_body  TEXT,
  wa_body     TEXT,
  is_active   BOOLEAN     DEFAULT true
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name      TEXT        NOT NULL DEFAULT 'Starter',
  status         TEXT        NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','expired','cancelled')),
  billing_cycle  TEXT        DEFAULT 'monthly',
  trial_ends_at  TIMESTAMPTZ,
  starts_at      TIMESTAMPTZ DEFAULT NOW(),
  ends_at        TIMESTAMPTZ,
  price_paid     NUMERIC(12,2) DEFAULT 0,
  max_users      INTEGER       DEFAULT 5,
  max_storage_gb INTEGER       DEFAULT 10,
  contact_email  TEXT,
  contact_phone  TEXT,
  notes          TEXT,
  updated_by     UUID,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- CRM Module
CREATE TABLE IF NOT EXISTS customers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number TEXT       UNIQUE NOT NULL,
  company_name   TEXT        NOT NULL,
  contact_name   TEXT,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  city           TEXT,
  country        TEXT        DEFAULT 'Saudi Arabia',
  vat_number     TEXT,
  cr_number      TEXT,
  industry       TEXT,
  customer_type  TEXT        DEFAULT 'business' CHECK (customer_type IN ('business','individual','government')),
  status         TEXT        DEFAULT 'active' CHECK (status IN ('active','inactive','prospect')),
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number   TEXT        UNIQUE NOT NULL,
  title         TEXT        NOT NULL,
  company_name  TEXT,
  contact_name  TEXT        NOT NULL,
  email         TEXT,
  phone         TEXT,
  source        TEXT        DEFAULT 'website',
  status        TEXT        DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','proposal','won','lost')),
  value         NUMERIC(14,2) DEFAULT 0,
  probability   INTEGER     DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_close DATE,
  assigned_to   UUID        REFERENCES users(id),
  notes         TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects & Tasks
CREATE TABLE IF NOT EXISTS projects (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number TEXT        UNIQUE NOT NULL,
  name           TEXT        NOT NULL,
  description    TEXT,
  client_id      UUID        REFERENCES customers(id),
  client_name    TEXT,
  status         TEXT        DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  priority       TEXT        DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  start_date     DATE,
  end_date       DATE,
  budget         NUMERIC(14,2) DEFAULT 0,
  spent          NUMERIC(14,2) DEFAULT 0,
  progress       INTEGER     DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  manager_id     UUID        REFERENCES users(id),
  manager_name   TEXT,
  location       TEXT,
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        REFERENCES projects(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','cancelled')),
  priority     TEXT        DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  assigned_to  UUID        REFERENCES users(id),
  assigned_name TEXT,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC(6,2) DEFAULT 0,
  actual_hours NUMERIC(6,2) DEFAULT 0,
  tags         TEXT[],
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW user_wallet_balance AS
SELECT
  u.id AS user_id, u.full_name,
  COALESCE((SELECT SUM(grand_total) FROM expenses WHERE submitted_by=u.id AND status='approved'),0) AS total_expenses,
  COALESCE((SELECT SUM(grand_total) FROM invoices  WHERE submitted_by=u.id AND status='approved'),0) AS total_invoiced,
  COALESCE((SELECT SUM(grand_total) FROM invoices  WHERE submitted_by=u.id AND status='approved'),0)
  - COALESCE((SELECT SUM(grand_total) FROM expenses WHERE submitted_by=u.id AND status='approved'),0) AS balance
FROM users u;

CREATE INDEX IF NOT EXISTS idx_expenses_sub      ON expenses(submitted_by, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_invoices_sub      ON invoices(submitted_by, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user        ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workers_status    ON workers(status);
CREATE INDEX IF NOT EXISTS idx_salary_period     ON salary_records(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_assets_status     ON assets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_year      ON budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project     ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned    ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads(status);
CREATE INDEX IF NOT EXISTS idx_customers_status  ON customers(status)
`;

export async function seedData(sql) {
  const seeds = [
    `INSERT INTO expense_categories (name, code) VALUES
      ('Materials & Supplies','MAT'),('Labour & Wages','LAB'),
      ('Equipment & Tools','EQP'),('Transport & Fuel','TRN'),
      ('Utilities','UTL'),('Office & Admin','OFC'),
      ('Maintenance & Repairs','MNT'),('Safety & PPE','SAF'),
      ('Miscellaneous','MSC')
    ON CONFLICT (code) DO NOTHING`,

    `INSERT INTO users (username,email,password_hash,full_name,role,is_active)
    VALUES ('admin','admin@alpha-erp.local',
      '6f2cb9dd8f4b65e24e1c3f3fa5bc57982349237f11abceacd45bbcb74d621c25',
      'System Administrator','superuser',true)
    ON CONFLICT (username) DO UPDATE SET
      password_hash='6f2cb9dd8f4b65e24e1c3f3fa5bc57982349237f11abceacd45bbcb74d621c25',
      role='superuser', is_active=true`,

    `INSERT INTO system_settings (key,value) VALUES
      ('company_name','"Alpha Ultimate ERP"'),
      ('company_cr','"1234567890"'),
      ('company_vat','"300000000000003"'),
      ('company_address','"Riyadh, Saudi Arabia"'),
      ('company_phone','"966-11-0000000"'),
      ('company_email','"erp@company.com"'),
      ('company_website','"https://www.company.com"'),
      ('currency','"SAR"'),
      ('vat_rate','"15"'),
      ('fiscal_year_start','"01"'),
      ('timezone','"Asia/Riyadh"'),
      ('date_format','"DD/MM/YYYY"'),
      ('week_start','"sat"'),
      ('report_title','"Alpha Ultimate ERP"'),
      ('report_subtitle','"Construction & Services | Riyadh, KSA"'),
      ('report_footer','"Alpha Ultimate ERP — Computer Generated Document"'),
      ('report_show_logo','true'),
      ('salary_gosi_rate','"10"'),
      ('salary_ot_rate','"25"'),
      ('working_days_month','"26"'),
      ('notif_whatsapp_enabled','false'),
      ('notif_whatsapp_token','"\"'),
      ('notif_whatsapp_phone_id','"\"'),
      ('notif_email_enabled','false'),
      ('notif_email_smtp_host','"\"'),
      ('notif_email_smtp_port','"587"'),
      ('notif_email_user','"\"'),
      ('notif_email_pass','"\"'),
      ('notif_email_from','"noreply@company.com"'),
      ('notif_inapp_enabled','true'),
      ('notif_templates','{}')
    ON CONFLICT (key) DO NOTHING`,

    `INSERT INTO notification_templates (event_name,label,email_subj,wa_body) VALUES
      ('expense_submitted','Expense Submitted','New Expense — {{form_number}}','📋 *New Expense*\nForm: {{form_number}}\nBy: {{submitted_by}}\nAmount: SAR {{amount}}'),
      ('expense_approved','Expense Approved','Expense Approved ✓','✅ *Expense Approved*\nForm: {{form_number}}'),
      ('expense_rejected','Expense Rejected','Expense Rejected','❌ *Expense Rejected*\nForm: {{form_number}}\nReason: {{comment}}'),
      ('invoice_submitted','Invoice Submitted','New Invoice — {{invoice_number}}','🧾 *New Invoice*\nInvoice: {{invoice_number}}\nAmount: SAR {{amount}}'),
      ('invoice_approved','Invoice Approved','Invoice Approved ✓','✅ *Invoice Approved*\nInvoice: {{invoice_number}}')
    ON CONFLICT (event_name) DO NOTHING`,

    `INSERT INTO subscriptions (plan_name,status,billing_cycle,max_users,max_storage_gb,trial_ends_at)
    SELECT 'Enterprise','active','yearly',50,100,NOW()+INTERVAL '365 days'
    WHERE NOT EXISTS (SELECT 1 FROM subscriptions)`
  ];

  for (const s of seeds) {
    try { await sql.unsafe(s); } catch(e) { /* ignore seed conflicts */ }
  }
}
