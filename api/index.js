// api/index.js — Alpha Ultimate ERP v13 — UNIFIED ROUTER
// Domain: www.alpha-01.info | Vercel Serverless
import { getDb, seedData } from './_db.js';
import { requireAuth, corsHeaders, hashPassword, signJWT } from './_auth.js';

let _seeded = false;
async function ensureSeeded(sql) {
  if (_seeded) return;
  _seeded = true;
  try { await seedData(sql); } catch(e) { console.warn('Seed warn:', e.message); }
}

function isSu(user) { return user.role === 'superuser'; }
function getPerm(user, module) {
  if (isSu(user)) return 'full_control';
  return user.permissions?.[module] ?? 'none';
}
function canAccess(user, module)       { return getPerm(user, module) !== 'none'; }
function canSubmit(user, module='finance') {
  const l = getPerm(user, module);
  return isSu(user) || ['submit_only','view_own','view_all','view_with_details','report_view','report_with_details','full_control'].includes(l);
}
function canView(user, module='finance') {
  const l = getPerm(user, module);
  return isSu(user) || ['view_own','view_all','view_with_details','report_view','report_with_details','full_control'].includes(l);
}
function canViewAll(user, module='finance') {
  const l = getPerm(user, module);
  return isSu(user) || ['view_all','view_with_details','report_view','report_with_details','full_control'].includes(l);
}
function canViewReports(user, module='reports') {
  const l = getPerm(user, module);
  return isSu(user) || ['report_view','report_with_details','full_control'].includes(l);
}
function canFullControl(user, module) {
  return isSu(user) || getPerm(user, module) === 'full_control';
}

function calcTotals(lineItems) {
  let total_amount = 0, tax_total = 0;
  for (const li of lineItems) {
    const sub = parseFloat(li.quantity) * parseFloat(li.unit_price);
    const tax = sub * (parseFloat(li.tax_percent ?? 15) / 100);
    if (isNaN(sub) || isNaN(tax)) return null;
    total_amount += sub; tax_total += tax;
  }
  return { total_amount, tax_total, grand_total: total_amount + tax_total };
}

async function notify(sql, userId, title, body, entityType, entityId) {
  try {
    await sql`INSERT INTO notifications (user_id, title, body, entity_type, entity_id)
              VALUES (${userId}, ${title}, ${body}, ${entityType}, ${entityId})`;
  } catch (e) { console.warn('Notify failed:', e.message); }
}

async function audit(sql, user, action, entityType, entityId, details, ip) {
  try {
    await sql`INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, ip_address)
              VALUES (${user.sub}, ${user.full_name}, ${action}, ${entityType}, ${entityId},
                      ${JSON.stringify(details)}::jsonb, ${ip})`;
  } catch (e) { console.warn('Audit failed:', e.message); }
}

async function sendWhatsApp(sql, phone, message) {
  try {
    const rows = await sql`SELECT key, value FROM system_settings WHERE key IN ('notif_whatsapp_enabled','notif_whatsapp_token','notif_whatsapp_phone_id')`;
    const cfg = {};
    rows.forEach(r => { try { cfg[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value; } catch { cfg[r.key] = r.value; } });
    if (!cfg['notif_whatsapp_enabled']) return;
    const token = cfg['notif_whatsapp_token'];
    const phoneId = cfg['notif_whatsapp_phone_id'];
    if (!token || !phoneId) return;
    await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: String(phone).replace(/[^0-9]/g,''), type: 'text', text: { body: message } })
    });
  } catch (e) { console.warn('WhatsApp send failed:', e.message); }
}

export default async function handler(req, res) {
  const sql = await getDb();
  await ensureSeeded(sql);
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown';

  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── HEALTH / MIGRATION ────────────────────────────────────────────────────
  const route = (req.query?.r ?? req.query?.route ?? '').replace(/^\/+/, '');

  // ── HEALTH CHECK ─────────────────────────────────────────────────────────
  if (route === 'health' && req.method === 'GET') {
    try {
      const [r] = await sql`SELECT NOW()::text AS time, current_database() AS db`;
      return res.status(200).json({ status: 'ok', time: r.time, db: r.db, version: "13" });
    } catch(e) { return res.status(500).json({ status: 'error', error: e.message }); }
  }

  // ── MIGRATE (public, idempotent) ──────────────────────────────────────────
  if (route === 'migrate' && req.method === 'POST') {
    try {
      await ensureSeeded(sql);
      // Also ensure r2_key column exists on media_uploads
      await sql.unsafe('ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS r2_key TEXT');
      return res.status(200).json({ ok: true, message: 'Migration and seed complete.' });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (route === 'auth/login' && req.method === 'POST') {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
      const [u] = await sql`SELECT * FROM users WHERE (username=${username} OR email=${username}) AND is_active=true LIMIT 1`;
      if (!u || u.password_hash !== hashPassword(password)) return res.status(401).json({ error: 'Invalid credentials.' });
      const permsRows = await sql`SELECT module, access_level FROM user_permissions WHERE user_id=${u.id}`;
      const permissions = {};
      permsRows.forEach(p => { permissions[p.module] = p.access_level; });
      try {
        await sql`UPDATE users SET last_login=NOW(), last_login_ip=${ip} WHERE id=${u.id}`;
      } catch {
        try {
          await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT`;
          await sql`UPDATE users SET last_login=NOW(), last_login_ip=${ip} WHERE id=${u.id}`;
        } catch {
          await sql`UPDATE users SET last_login=NOW() WHERE id=${u.id}`;
        }
      }
      const token = signJWT({ sub: u.id, username: u.username, full_name: u.full_name, role: u.role, email: u.email, department: u.department, permissions });
      return res.status(200).json({ token, user: { id: u.id, username: u.username, full_name: u.full_name, role: u.role, email: u.email, department: u.department, avatar_url: u.avatar_url, permissions } });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'auth/me' && req.method === 'GET') {
    try {
      const user = requireAuth(req);
      const [u] = await sql`SELECT id, username, full_name, role, email, department, phone, whatsapp_number, avatar_url, id_photo_url, id_number, nationality FROM users WHERE id=${user.sub}`;
      if (!u) return res.status(404).json({ error: 'User not found' });
      const permsRows = await sql`SELECT module, access_level FROM user_permissions WHERE user_id=${user.sub}`;
      const permissions = {};
      permsRows.forEach(p => { permissions[p.module] = p.access_level; });
      return res.status(200).json({ user: { ...u, permissions } });
    } catch (err) { return res.status(401).json({ error: err.message }); }
  }

  let user;
  try { user = requireAuth(req); } catch (e) { return res.status(401).json({ error: 'Unauthorized' }); }

  // ── CATEGORIES ────────────────────────────────────────────────────────────
  if (route === 'categories' && req.method === 'GET') {
    try {
      const cats = await sql`SELECT id, name, code FROM expense_categories WHERE is_active=true ORDER BY name`;
      return res.status(200).json({ categories: cats });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── USERS ─────────────────────────────────────────────────────────────────
  if (route === 'users') {
    if (req.method === 'GET') {
      if (!canAccess(user, 'users') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const users = await sql`SELECT id, username, email, full_name, role, department, phone, whatsapp_number, avatar_url, id_photo_url, is_active, created_at, last_login FROM users ORDER BY full_name`;
        return res.status(200).json({ users });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
      try {
        const { username, email, password, full_name, role, department, phone, whatsapp_number } = req.body || {};
        if (!username || !email || !password || !full_name) return res.status(400).json({ error: 'username, email, password, full_name required' });
        const [u] = await sql`INSERT INTO users (username, email, password_hash, full_name, role, department, phone, whatsapp_number, created_by)
          VALUES (${username}, ${email}, ${hashPassword(password)}, ${full_name}, ${role||'staff'}, ${department||null}, ${phone||null}, ${whatsapp_number||null}, ${user.sub})
          RETURNING id, username, email, full_name, role, department`;
        await audit(sql, user, 'CREATE_USER', 'users', u.id, { username, role }, ip);
        return res.status(201).json({ user: u });
      } catch (err) {
        if (err.message.includes('unique') || err.message.includes('duplicate')) return res.status(409).json({ error: 'Username or email already exists.' });
        return res.status(500).json({ error: err.message });
      }
    }
  }

  if (route === 'users/update' && req.method === 'PATCH') {
    try {
      const { id, full_name, email, role, department, phone, whatsapp_number, is_active, avatar_url, id_photo_url } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      if (id !== user.sub && !isSu(user)) return res.status(403).json({ error: 'Forbidden' });
      const fields = {};
      if (full_name !== undefined)       fields.full_name = full_name;
      if (email !== undefined)           fields.email = email;
      if (department !== undefined)      fields.department = department;
      if (phone !== undefined)           fields.phone = phone;
      if (whatsapp_number !== undefined) fields.whatsapp_number = whatsapp_number;
      if (avatar_url !== undefined)      fields.avatar_url = avatar_url;
      if (id_photo_url !== undefined)    fields.id_photo_url = id_photo_url;
      if (isSu(user)) {
        if (role !== undefined)      fields.role = role;
        if (is_active !== undefined) fields.is_active = is_active;
      }
      const [u] = await sql`UPDATE users SET ${sql(fields)}, updated_at=NOW() WHERE id=${id} RETURNING id, username, full_name, role, email, department, avatar_url, id_photo_url`;
      return res.status(200).json({ user: u });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'users/delete' && req.method === 'POST') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { id } = req.body || {};
      if (id === user.sub) return res.status(400).json({ error: 'Cannot delete yourself.' });
      await sql`UPDATE users SET is_active=false WHERE id=${id}`;
      await audit(sql, user, 'DELETE_USER', 'users', id, {}, ip);
      return res.status(200).json({ ok: true });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'users/change-password' && req.method === 'POST') {
    try {
      const { current_password, new_password, target_user_id } = req.body || {};
      if (target_user_id && target_user_id !== user.sub) {
        if (!isSu(user)) return res.status(403).json({ error: 'Superuser only can reset others passwords.' });
        if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Minimum 8 characters.' });
        await sql`UPDATE users SET password_hash=${hashPassword(new_password)}, updated_at=NOW() WHERE id=${target_user_id}`;
        await audit(sql, user, 'RESET_USER_PASSWORD', 'users', target_user_id, {}, ip);
        return res.status(200).json({ ok: true, message: 'Password reset successfully.' });
      }
      if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password required.' });
      if (new_password.length < 8) return res.status(400).json({ error: 'Minimum 8 characters.' });
      const [check] = await sql`SELECT id FROM users WHERE id=${user.sub} AND password_hash=${hashPassword(current_password)}`;
      if (!check) return res.status(401).json({ error: 'Current password incorrect.' });
      await sql`UPDATE users SET password_hash=${hashPassword(new_password)}, updated_at=NOW() WHERE id=${user.sub}`;
      await audit(sql, user, 'CHANGE_PASSWORD', 'users', user.sub, {}, ip);
      return res.status(200).json({ ok: true, message: 'Password changed successfully.' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── PERMISSIONS ───────────────────────────────────────────────────────────
  if (route === 'permissions') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    if (req.method === 'GET') {
      try {
        const users_list = await sql`SELECT id, full_name, username, role, department FROM users WHERE is_active=true ORDER BY full_name`;
        const perms = await sql`SELECT user_id, module, access_level FROM user_permissions`;
        const matrix = {};
        perms.forEach(p => { if (!matrix[p.user_id]) matrix[p.user_id] = {}; matrix[p.user_id][p.module] = p.access_level; });
        return res.status(200).json({ users: users_list, matrix });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'PUT') {
      try {
        const { userId, permissions } = req.body || {};
        if (!userId || !permissions) return res.status(400).json({ error: 'userId and permissions required' });
        for (const [module, access_level] of Object.entries(permissions)) {
          await sql`INSERT INTO user_permissions (user_id, module, access_level, granted_by, updated_at)
            VALUES (${userId}, ${module}, ${access_level}, ${user.sub}, NOW())
            ON CONFLICT (user_id, module) DO UPDATE SET access_level=${access_level}, granted_by=${user.sub}, updated_at=NOW()`;
        }
        await audit(sql, user, 'UPDATE_PERMISSIONS', 'users', userId, permissions, ip);
        return res.status(200).json({ ok: true });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  if (route === 'expenses') {
    if (req.method === 'GET') {
      if (!canView(user, 'finance') && !canSubmit(user, 'finance')) return res.status(403).json({ error: 'No access' });
      try {
        const rows = canViewAll(user, 'finance')
          ? await sql`SELECT e.*, ec.name AS category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id=e.category_id ORDER BY e.submitted_at DESC LIMIT 500`
          : await sql`SELECT e.*, ec.name AS category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id=e.category_id WHERE e.submitted_by=${user.sub} ORDER BY e.submitted_at DESC LIMIT 200`;
        return res.status(200).json({ expenses: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user, 'finance')) return res.status(403).json({ error: 'No permission to submit expenses.' });
      try {
        const { project_name, project_location, category_id, notes, line_items, media_urls } = req.body || {};
        if (!line_items?.length) return res.status(400).json({ error: 'At least one line item is required.' });
        const totals = calcTotals(line_items);
        if (!totals) return res.status(400).json({ error: 'Invalid numeric values in line items.' });
        let resolvedCatId = null;
        if (category_id) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category_id);
          if (isUuid) {
            resolvedCatId = category_id;
          } else {
            try {
              const [cat] = await sql`SELECT id FROM expense_categories WHERE UPPER(code)=UPPER(${category_id}) LIMIT 1`;
              resolvedCatId = cat?.id ?? null;
            } catch { resolvedCatId = null; }
          }
        }
        const [seq] = await sql`SELECT nextval('expense_seq') AS n`;
        const form_number = `EXP-${new Date().getFullYear()}-${String(seq.n).padStart(5,'0')}`;
        const [expense] = await sql`
          INSERT INTO expenses (form_number, submitted_by, submitted_by_name, project_name, project_location, category_id, notes, total_amount, tax_total, grand_total, media_urls, is_locked, status)
          VALUES (${form_number}, ${user.sub}, ${user.full_name}, ${project_name||null}, ${project_location||null}, ${resolvedCatId}, ${notes||null}, ${totals.total_amount}, ${totals.tax_total}, ${totals.grand_total}, ${JSON.stringify(media_urls||[])}::jsonb, true, 'pending')
          RETURNING id, form_number, status, submitted_at`;
        for (let i = 0; i < line_items.length; i++) {
          const li = line_items[i];
          await sql`INSERT INTO expense_line_items (expense_id, description, quantity, unit, unit_price, tax_percent, sort_order)
            VALUES (${expense.id}, ${li.description}, ${parseFloat(li.quantity)||1}, ${li.unit||null}, ${parseFloat(li.unit_price)||0}, ${parseFloat(li.tax_percent)||15}, ${i})`;
        }
        const suUsers = await sql`SELECT id, whatsapp_number FROM users WHERE role='superuser' AND is_active=true`;
        for (const su of suUsers) {
          await notify(sql, su.id, `New Expense Pending — ${form_number}`, `${user.full_name} submitted ${form_number} for SAR ${totals.grand_total.toFixed(2)}`, 'expenses', expense.id);
          if (su.whatsapp_number) await sendWhatsApp(sql, su.whatsapp_number, `📋 *New Expense Submitted*\nForm: ${form_number}\nBy: ${user.full_name}\nAmount: SAR ${totals.grand_total.toFixed(2)}`);
        }
        await audit(sql, user, 'SUBMIT_EXPENSE', 'expenses', expense.id, { form_number, grand_total: totals.grand_total }, ip);
        return res.status(201).json({ expense });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route.match(/^expenses\/[0-9a-f-]{36}$/) && req.method === 'GET') {
    const expenseId = route.split('/')[1];
    try {
      const [expense] = isSu(user) || canViewAll(user,'finance')
        ? await sql`SELECT e.*, ec.name AS category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id=e.category_id WHERE e.id=${expenseId}`
        : await sql`SELECT e.*, ec.name AS category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id=e.category_id WHERE e.id=${expenseId} AND e.submitted_by=${user.sub}`;
      if (!expense) return res.status(404).json({ error: 'Not found' });
      const line_items = await sql`SELECT * FROM expense_line_items WHERE expense_id=${expenseId} ORDER BY sort_order`;
      return res.status(200).json({ expense: { ...expense, line_items } });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'expenses/approve' && req.method === 'POST') {
    if (!isSu(user) && !canFullControl(user,'approvals')) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { expense_id, action, comment } = req.body || {};
      if (!expense_id || !action) return res.status(400).json({ error: 'expense_id and action required' });
      if (!['approve','reject','hold'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
      if (action === 'reject' && !comment?.trim()) return res.status(400).json({ error: 'Rejection requires a comment.' });
      const statusMap = { approve:'approved', reject:'rejected', hold:'hold' };
      const [expense] = await sql`UPDATE expenses SET status=${statusMap[action]}, approved_by=${user.sub}, approved_at=NOW(), rejection_comment=${comment||null}
        WHERE id=${expense_id} AND status IN ('pending','hold') RETURNING id, form_number, status, submitted_by, grand_total, project_name`;
      if (!expense) return res.status(404).json({ error: 'Not found or already processed.' });
      const [submitter] = await sql`SELECT whatsapp_number FROM users WHERE id=${expense.submitted_by}`;
      const actionEmoji = action==='approve' ? '✅' : action==='reject' ? '❌' : '⏸️';
      if (submitter?.whatsapp_number) await sendWhatsApp(sql, submitter.whatsapp_number, `${actionEmoji} *Expense ${statusMap[action].toUpperCase()}*\nForm: ${expense.form_number}\nAmount: SAR ${parseFloat(expense.grand_total).toFixed(2)}${action==='reject'?`\nReason: ${comment}`:''}`);
      await notify(sql, expense.submitted_by, `${actionEmoji} ${expense.form_number} ${statusMap[action]}`, action==='reject'?`Rejected: ${comment}`:`Status: ${statusMap[action]}`, 'expenses', expense.id);
      await audit(sql, user, action.toUpperCase()+'_EXPENSE', 'expenses', expense_id, { action, comment: comment||null }, ip);
      return res.status(200).json({ expense });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── INVOICES ──────────────────────────────────────────────────────────────
  if (route === 'invoices') {
    if (req.method === 'GET') {
      if (!canView(user,'finance') && !canSubmit(user,'finance')) return res.status(403).json({ error: 'No access' });
      try {
        const rows = canViewAll(user,'finance')
          ? await sql`SELECT * FROM invoices ORDER BY submitted_at DESC LIMIT 500`
          : await sql`SELECT * FROM invoices WHERE submitted_by=${user.sub} ORDER BY submitted_at DESC LIMIT 200`;
        return res.status(200).json({ invoices: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'finance')) return res.status(403).json({ error: 'No permission' });
      try {
        const { client_name, client_address, client_vat_number, project_name, po_number, notes, line_items, media_urls } = req.body || {};
        if (!client_name?.trim()) return res.status(400).json({ error: 'client_name required' });
        if (!line_items?.length) return res.status(400).json({ error: 'At least one line item required' });
        const totals = calcTotals(line_items);
        if (!totals) return res.status(400).json({ error: 'Invalid line items' });
        const [seq] = await sql`SELECT nextval('invoice_seq') AS n`;
        const invoice_number = `INV-${new Date().getFullYear()}-${String(seq.n).padStart(5,'0')}`;
        const [invoice] = await sql`
          INSERT INTO invoices (invoice_number, submitted_by, submitted_by_name, client_name, client_address, client_vat_number, project_name, po_number, notes, total_amount, tax_total, grand_total, media_urls, is_locked, status)
          VALUES (${invoice_number}, ${user.sub}, ${user.full_name}, ${client_name}, ${client_address||null}, ${client_vat_number||null}, ${project_name||null}, ${po_number||null}, ${notes||null}, ${totals.total_amount}, ${totals.tax_total}, ${totals.grand_total}, ${JSON.stringify(media_urls||[])}::jsonb, true, 'pending')
          RETURNING id, invoice_number, status`;
        for (let i=0; i<line_items.length; i++) {
          const li = line_items[i];
          await sql`INSERT INTO invoice_line_items (invoice_id, description, quantity, unit, unit_price, tax_percent, sort_order)
            VALUES (${invoice.id}, ${li.description}, ${parseFloat(li.quantity)||1}, ${li.unit||null}, ${parseFloat(li.unit_price)||0}, ${parseFloat(li.tax_percent)||15}, ${i})`;
        }
        const suUsers = await sql`SELECT id FROM users WHERE role='superuser' AND is_active=true`;
        for (const su of suUsers) await notify(sql, su.id, `New Invoice — ${invoice_number}`, `${user.full_name} submitted invoice for SAR ${totals.grand_total.toFixed(2)}`, 'invoices', invoice.id);
        await audit(sql, user, 'SUBMIT_INVOICE', 'invoices', invoice.id, { invoice_number }, ip);
        return res.status(201).json({ invoice });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route.match(/^invoices\/[0-9a-f-]{36}$/) && req.method === 'GET') {
    const invoiceId = route.split('/')[1];
    try {
      const [invoice] = isSu(user) || canViewAll(user,'finance')
        ? await sql`SELECT * FROM invoices WHERE id=${invoiceId}`
        : await sql`SELECT * FROM invoices WHERE id=${invoiceId} AND submitted_by=${user.sub}`;
      if (!invoice) return res.status(404).json({ error: 'Not found' });
      const line_items = await sql`SELECT * FROM invoice_line_items WHERE invoice_id=${invoiceId} ORDER BY sort_order`;
      return res.status(200).json({ invoice: { ...invoice, line_items } });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'invoices/approve' && req.method === 'POST') {
    if (!isSu(user) && !canFullControl(user,'approvals')) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { invoice_id, action, comment } = req.body || {};
      if (!invoice_id || !action) return res.status(400).json({ error: 'invoice_id and action required' });
      if (action === 'reject' && !comment?.trim()) return res.status(400).json({ error: 'Rejection requires a comment.' });
      const statusMap = { approve:'approved', reject:'rejected', hold:'hold' };
      const [invoice] = await sql`UPDATE invoices SET status=${statusMap[action]}, approved_by=${user.sub}, approved_at=NOW(), rejection_comment=${comment||null}
        WHERE id=${invoice_id} AND status IN ('pending','hold') RETURNING id, invoice_number, status, submitted_by, grand_total`;
      if (!invoice) return res.status(404).json({ error: 'Not found or already processed.' });
      const [submitter] = await sql`SELECT whatsapp_number FROM users WHERE id=${invoice.submitted_by}`;
      if (submitter?.whatsapp_number) await sendWhatsApp(sql, submitter.whatsapp_number, `${action==='approve'?'✅':'❌'} *Invoice ${statusMap[action].toUpperCase()}*\nInvoice: ${invoice.invoice_number}\nAmount: SAR ${parseFloat(invoice.grand_total).toFixed(2)}`);
      await notify(sql, invoice.submitted_by, `${action==='approve'?'✅':'❌'} Invoice ${statusMap[action]}`, `Invoice ${invoice.invoice_number}: ${statusMap[action]}`, 'invoices', invoice.id);
      await audit(sql, user, action.toUpperCase()+'_INVOICE', 'invoices', invoice_id, { action }, ip);
      return res.status(200).json({ invoice });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── FILE UPLOAD ───────────────────────────────────────────────────────────
  // ── FILE UPLOAD (ImgBB fallback + Cloudflare R2 primary) ─────────────────
  if (route === 'uploads/imgbb' && req.method === 'POST') {
    const CF_ACCOUNT_ID    = process.env.CF_ACCOUNT_ID;
    const CF_ACCESS_KEY_ID = process.env.CF_ACCESS_KEY_ID;
    const CF_SECRET_KEY    = process.env.CF_SECRET_ACCESS_KEY;
    const CF_BUCKET        = process.env.CF_R2_BUCKET || 'alpha-erp-uploads';
    const CF_PUBLIC_URL    = process.env.CF_R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev or custom domain
    const IMGBB_KEY        = process.env.IMGBB_API_KEY;

    const useR2 = CF_ACCOUNT_ID && CF_ACCESS_KEY_ID && CF_SECRET_KEY;
    if (!useR2 && !IMGBB_KEY) return res.status(500).json({ error: 'No upload service configured. Set CF_ACCOUNT_ID + CF_ACCESS_KEY_ID + CF_SECRET_ACCESS_KEY (Cloudflare R2) or IMGBB_API_KEY.' });
    try {
      const { files, entity_type, entity_id } = req.body || {};
      if (!files?.length) return res.status(400).json({ error: 'No files provided.' });
      if (files.length > 10) return res.status(400).json({ error: 'Maximum 10 files per upload.' });
      const MAX_BYTES = 32 * 1024 * 1024; // 32MB per file

      const uploaded = [];

      for (const file of files) {
        if (!file.data) return res.status(400).json({ error: `File "${file.name}" missing base64 data.` });
        const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data;
        const rawBytes = Buffer.from(base64Data, 'base64');
        if (rawBytes.length > MAX_BYTES) return res.status(400).json({ error: `"${file.name}" exceeds 32MB limit.` });

        let url = null, thumb_url = null, delete_url = null, r2_key = null;

        if (useR2) {
          // ── Cloudflare R2 via S3-compatible API ──────────────────────────
          const ext = (file.name||'upload').split('.').pop().toLowerCase();
          const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          r2_key = key;
          const endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
          const bucketUrl = `${endpoint}/${CF_BUCKET}/${key}`;

          // AWS Signature V4 for R2
          const crypto = await import('crypto');
          const now = new Date();
          const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
          const dateStamp = amzDate.slice(0, 8);
          const contentType = file.type || 'application/octet-stream';

          const canonicalHeaders = `content-type:${contentType}\nhost:${CF_ACCOUNT_ID}.r2.cloudflarestorage.com\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`;
          const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
          const canonicalRequest = `PUT\n/${CF_BUCKET}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
          const credScope = `${dateStamp}/auto/s3/aws4_request`;
          const strToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

          const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
          const sigKey = hmac(hmac(hmac(hmac('AWS4' + CF_SECRET_KEY, dateStamp), 'auto'), 's3'), 'aws4_request');
          const signature = hmac(sigKey, strToSign).toString('hex');
          const authHeader = `AWS4-HMAC-SHA256 Credential=${CF_ACCESS_KEY_ID}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

          const r2Res = await fetch(bucketUrl, {
            method: 'PUT',
            headers: {
              'Authorization': authHeader,
              'Content-Type': contentType,
              'x-amz-date': amzDate,
              'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
            },
            body: rawBytes,
          });

          if (!r2Res.ok) {
            const errText = await r2Res.text();
            return res.status(502).json({ error: `R2 upload failed: ${r2Res.status} ${errText.slice(0,200)}` });
          }

          url = CF_PUBLIC_URL
            ? `${CF_PUBLIC_URL.replace(/\/$/, '')}/${key}`
            : `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_BUCKET}/${key}`;
          thumb_url = url; // R2 serves the file directly

        } else {
          // ── ImgBB fallback ───────────────────────────────────────────────
          const form = new URLSearchParams();
          form.append('key', IMGBB_KEY);
          form.append('image', base64Data);
          form.append('name', (file.name||'upload').replace(/\.[^.]+$/, '').slice(0, 60));
          const imgRes  = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
          });
          const imgData = await imgRes.json();
          if (!imgData.success) return res.status(502).json({ error: `ImgBB error: ${imgData?.error?.message ?? JSON.stringify(imgData)}` });
          url = imgData.data.url;
          thumb_url = imgData.data.thumb?.url ?? null;
          delete_url = imgData.data.delete_url ?? null;
        }

        let dbId = null;
        try {
          const [row] = await sql`
            INSERT INTO media_uploads (uploaded_by, entity_type, entity_id, file_name, file_type, file_size, cdn_url, thumb_url, delete_url, r2_key)
            VALUES (${user.sub}, ${entity_type||null}, ${entity_id||null}, ${file.name||'upload'}, ${file.type||'application/octet-stream'}, ${rawBytes.length}, ${url}, ${thumb_url}, ${delete_url||null}, ${r2_key||null})
            RETURNING id`;
          dbId = row?.id ?? null;
        } catch (e) { console.warn('DB media insert failed:', e.message); }

        uploaded.push({ id: dbId, name: file.name, url, thumb_url, type: file.type });
      }
      return res.status(200).json({ uploaded, count: uploaded.length, storage: useR2 ? 'r2' : 'imgbb' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── ASSETS ────────────────────────────────────────────────────────────────
  // FIXED: columns match schema v10 (useful_life_years, salvage_value, depreciation_method)
  if (route === 'assets') {
    if (req.method === 'GET') {
      if (!canAccess(user,'assets') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const rows = await sql`
          SELECT id, asset_number, name, category, description, location,
                 COALESCE(project_branch,'') AS project_branch,
                 purchase_date,
                 COALESCE(purchase_cost,0) AS purchase_cost,
                 COALESCE(current_value,0) AS current_value,
                 COALESCE(useful_life_years,5) AS useful_life_years,
                 COALESCE(salvage_value,0) AS salvage_value,
                 COALESCE(depreciation_method,'straight_line') AS depreciation_method,
                 vendor, warranty_expiry, serial_number,
                 COALESCE(media_urls,'[]'::jsonb) AS media_urls,
                 status, notes,
                 COALESCE(submitted_by_name,'') AS submitted_by_name,
                 COALESCE(internal_owner_name,'') AS internal_owner_name,
                 submitted_by, created_at AS submitted_at, updated_at
          FROM assets ORDER BY created_at DESC LIMIT 500`;
        return res.status(200).json({ assets: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'assets') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { name, category, description, location, project_branch,
                purchase_date, purchase_cost, useful_life_years, salvage_value,
                depreciation_method, vendor, warranty_expiry, status, notes, media_urls } = req.body || {};
        if (!name?.trim()) return res.status(400).json({ error: 'name required' });
        const [seq] = await sql`SELECT nextval('asset_seq') AS n`;
        const asset_number = `AST-${new Date().getFullYear()}-${String(seq.n).padStart(4,'0')}`;
        const [asset] = await sql`
          INSERT INTO assets (asset_number, name, category, description, location, project_branch,
                              purchase_date, purchase_cost, current_value, useful_life_years,
                              salvage_value, depreciation_method, vendor, warranty_expiry,
                              serial_number, media_urls, status, notes, submitted_by, submitted_by_name)
          VALUES (${asset_number}, ${name}, ${category||'equipment'}, ${description||null},
                  ${location||null}, ${project_branch||null},
                  ${purchase_date||null}, ${parseFloat(purchase_cost)||0},
                  ${parseFloat(purchase_cost)||0},
                  ${parseInt(useful_life_years)||5}, ${parseFloat(salvage_value)||0},
                  ${depreciation_method||'straight_line'}, ${vendor||null}, ${warranty_expiry||null},
                  null, ${JSON.stringify(media_urls||[])}::jsonb,
                  ${status||'in_use'}, ${notes||null}, ${user.sub}, ${user.full_name})
          RETURNING id, asset_number, name, status`;
        await audit(sql, user, 'CREATE_ASSET', 'assets', asset.id, { asset_number, name }, ip);
        return res.status(201).json({ asset });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'assets/update' && req.method === 'PATCH') {
    if (!isSu(user) && !canFullControl(user,'assets')) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const allowed = ['name','category','description','location','project_branch','status',
                       'current_value','useful_life_years','salvage_value','depreciation_method',
                       'notes','media_urls','internal_owner_name'];
      const update = {};
      allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
      if (update.media_urls) update.media_urls = JSON.stringify(update.media_urls);
      const [asset] = await sql`UPDATE assets SET ${sql(update)}, updated_at=NOW() WHERE id=${id} RETURNING id, name, status`;
      if (!asset) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ asset });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── INVESTMENTS ───────────────────────────────────────────────────────────
  // FIXED: columns match schema v10 (principal, expected_roi_pct, payment_frequency, etc.)
  if (route === 'investments') {
    if (req.method === 'GET') {
      if (!canAccess(user,'investments') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const rows = await sql`SELECT * FROM investments ORDER BY created_at DESC`;
        return res.status(200).json({ investments: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'investments') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { title, type, project_branch, start_date, end_date, principal, currency,
                expected_roi_pct, payment_frequency, risk_level, investor_name,
                investor_contact, status, notes, media_urls } = req.body || {};
        if (!title?.trim()) return res.status(400).json({ error: 'title required' });
        if (!principal)     return res.status(400).json({ error: 'principal amount required' });
        const [seq] = await sql`SELECT nextval('investment_seq') AS n`;
        const inv_number = `INV-${new Date().getFullYear()}-${String(seq.n).padStart(4,'0')}`;
        const [inv] = await sql`
          INSERT INTO investments (inv_number, title, type, project_branch, start_date, end_date,
                                   principal, currency, expected_roi_pct, payment_frequency,
                                   risk_level, investor_name, investor_contact, status,
                                   notes, media_urls, submitted_by)
          VALUES (${inv_number}, ${title}, ${type||'equity'}, ${project_branch||null},
                  ${start_date||null}, ${end_date||null},
                  ${parseFloat(principal)}, ${currency||'SAR'},
                  ${parseFloat(expected_roi_pct)||0}, ${payment_frequency||'yearly'},
                  ${risk_level||'medium'}, ${investor_name||null}, ${investor_contact||null},
                  ${status||'draft'}, ${notes||null}, ${JSON.stringify(media_urls||[])}::jsonb, ${user.sub})
          RETURNING id, inv_number, title, status`;
        await audit(sql, user, 'CREATE_INVESTMENT', 'investments', inv.id, { inv_number, title }, ip);
        return res.status(201).json({ investment: inv });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'investments/update' && req.method === 'PATCH') {
    if (!isSu(user) && !canFullControl(user,'investments')) return res.status(403).json({ error: 'No permission' });
    try {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const allowed = ['title','type','project_branch','start_date','end_date','principal',
                       'currency','expected_roi_pct','payment_frequency','risk_level',
                       'investor_name','investor_contact','status','notes','media_urls'];
      const update = {};
      allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
      if (update.media_urls) update.media_urls = JSON.stringify(update.media_urls);
      const [inv] = await sql`UPDATE investments SET ${sql(update)}, updated_at=NOW() WHERE id=${id} RETURNING id, inv_number, title, status`;
      if (!inv) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ investment: inv });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── LIABILITIES ───────────────────────────────────────────────────────────
  // FIXED: columns match schema v10 (lender_supplier, maturity_date, installment_amt)
  if (route === 'liabilities') {
    if (req.method === 'GET') {
      if (!canAccess(user,'liabilities') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const rows = await sql`SELECT * FROM liabilities ORDER BY created_at DESC`;
        return res.status(200).json({ liabilities: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'liabilities') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { type, lender_supplier, project_branch, principal, interest_rate,
                start_date, maturity_date, installment_amt, frequency, status, notes, media_urls } = req.body || {};
        if (!lender_supplier?.trim()) return res.status(400).json({ error: 'lender_supplier required' });
        if (!principal) return res.status(400).json({ error: 'principal required' });
        const [seq] = await sql`SELECT nextval('liability_seq') AS n`;
        const lib_number = `LIB-${new Date().getFullYear()}-${String(seq.n).padStart(4,'0')}`;
        const [lib] = await sql`
          INSERT INTO liabilities (lib_number, type, lender_supplier, project_branch,
                                   principal, interest_rate, start_date, maturity_date,
                                   installment_amt, frequency, outstanding, status,
                                   notes, media_urls, submitted_by)
          VALUES (${lib_number}, ${type||'bank_loan'}, ${lender_supplier}, ${project_branch||null},
                  ${parseFloat(principal)}, ${parseFloat(interest_rate)||0},
                  ${start_date||null}, ${maturity_date||null},
                  ${parseFloat(installment_amt)||0}, ${frequency||'monthly'},
                  ${parseFloat(principal)}, ${status||'active'},
                  ${notes||null}, ${JSON.stringify(media_urls||[])}::jsonb, ${user.sub})
          RETURNING id, lib_number, lender_supplier, status`;
        await audit(sql, user, 'CREATE_LIABILITY', 'liabilities', lib.id, { lib_number, lender_supplier }, ip);
        return res.status(201).json({ liability: lib });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'liabilities/update' && req.method === 'PATCH') {
    if (!isSu(user) && !canFullControl(user,'liabilities')) return res.status(403).json({ error: 'No permission' });
    try {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const allowed = ['type','lender_supplier','project_branch','principal','interest_rate',
                       'start_date','maturity_date','installment_amt','frequency',
                       'outstanding','status','notes','media_urls'];
      const update = {};
      allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
      if (update.media_urls) update.media_urls = JSON.stringify(update.media_urls);
      const [lib] = await sql`UPDATE liabilities SET ${sql(update)}, updated_at=NOW() WHERE id=${id} RETURNING id, lib_number, lender_supplier, status`;
      if (!lib) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ liability: lib });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── BUDGETS ───────────────────────────────────────────────────────────────
  // FIXED: columns match schema v10 (name, total_budget, fiscal_year, fiscal_quarter)
  if (route === 'budgets') {
    if (req.method === 'GET') {
      try {
        const rows = isSu(user) || canViewAll(user,'budget')
          ? await sql`SELECT *, COALESCE(created_by_name,'') AS created_by_name FROM budgets ORDER BY fiscal_year DESC, fiscal_quarter DESC, created_at DESC`
          : await sql`SELECT *, COALESCE(created_by_name,'') AS created_by_name FROM budgets WHERE submitted_by=${user.sub} ORDER BY created_at DESC`;
        return res.status(200).json({ budgets: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      try {
        const { name, category, fiscal_year, fiscal_quarter, total_budget, project_branch, notes, status } = req.body || {};
        if (!name?.trim()) return res.status(400).json({ error: 'Budget name required' });
        if (!total_budget) return res.status(400).json({ error: 'total_budget required' });
        const [seq] = await sql`SELECT nextval('budget_seq') AS n`;
        const fy = parseInt(fiscal_year) || new Date().getFullYear();
        const budget_number = `BUD-${fy}-${String(seq.n).padStart(4,'0')}`;
        const [b] = await sql`
          INSERT INTO budgets (budget_number, name, category, fiscal_year, fiscal_quarter,
                               total_budget, spent_amount, committed_amount,
                               project_branch, status, notes, submitted_by, created_by_name)
          VALUES (${budget_number}, ${name}, ${category||'operations'}, ${fy},
                  ${parseInt(fiscal_quarter)||1},
                  ${parseFloat(total_budget)}, 0, 0,
                  ${project_branch||null}, ${status||'active'}, ${notes||null},
                  ${user.sub}, ${user.full_name})
          RETURNING id, budget_number, name, fiscal_year, fiscal_quarter, total_budget, status`;
        await audit(sql, user, 'CREATE_BUDGET', 'budgets', b.id, { budget_number, name, total_budget }, ip);
        return res.status(201).json({ budget: b });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'budgets/update' && req.method === 'PATCH') {
    if (!isSu(user) && !canFullControl(user,'budget')) return res.status(403).json({ error: 'No permission' });
    try {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const allowed = ['name','category','fiscal_year','fiscal_quarter','total_budget',
                       'spent_amount','committed_amount','project_branch','status','notes'];
      const update = {};
      allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
      const [b] = await sql`UPDATE budgets SET ${sql(update)}, updated_at=NOW() WHERE id=${id} RETURNING id, budget_number, name, status`;
      if (!b) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ budget: b });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── WORKERS ───────────────────────────────────────────────────────────────
  // FIXED: columns match schema v10 AND WorkersPage.tsx form exactly
  if (route === 'workers') {
    if (req.method === 'GET') {
      if (!canAccess(user,'workers') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const rows = await sql`SELECT * FROM workers ORDER BY full_name`;
        return res.status(200).json({ workers: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'workers') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { full_name, arabic_name, nationality, national_id, passport_number,
                iqama_number, iqama_expiry, date_of_birth, gender, marital_status,
                phone, phone2, email, emergency_contact_name, emergency_contact_phone,
                position, department, project_assignment, join_date, contract_type,
                contract_end, basic_salary, housing_allowance, transport_allowance,
                other_allowance, bank_name, bank_iban, photo_url, id_photo_url,
                passport_photo_url, iqama_photo_url, notes } = req.body || {};
        if (!full_name?.trim()) return res.status(400).json({ error: 'full_name required' });
        if (!phone?.trim())     return res.status(400).json({ error: 'phone required' });
        const [seq] = await sql`SELECT nextval('worker_seq') AS n`;
        const employee_id = `EMP-${new Date().getFullYear()}-${String(seq.n).padStart(4,'0')}`;
        const [w] = await sql`
          INSERT INTO workers (
            employee_id, full_name, arabic_name, nationality, national_id, passport_number,
            iqama_number, iqama_expiry, date_of_birth, gender, marital_status,
            phone, phone2, email, emergency_contact_name, emergency_contact_phone,
            position, department, project_assignment, join_date, contract_type, contract_end,
            basic_salary, housing_allowance, transport_allowance, other_allowance,
            bank_name, bank_iban, photo_url, id_photo_url, passport_photo_url, iqama_photo_url,
            notes, created_by
          ) VALUES (
            ${employee_id}, ${full_name}, ${arabic_name||null}, ${nationality||'Saudi'},
            ${national_id||null}, ${passport_number||null},
            ${iqama_number||null}, ${iqama_expiry||null},
            ${date_of_birth||null}, ${gender||'Male'}, ${marital_status||'Single'},
            ${phone}, ${phone2||null}, ${email||null},
            ${emergency_contact_name||null}, ${emergency_contact_phone||null},
            ${position||'Worker'}, ${department||'Operations'},
            ${project_assignment||null}, ${join_date||null},
            ${contract_type||'Full-time'}, ${contract_end||null},
            ${parseFloat(basic_salary)||0}, ${parseFloat(housing_allowance)||0},
            ${parseFloat(transport_allowance)||0}, ${parseFloat(other_allowance)||0},
            ${bank_name||null}, ${bank_iban||null},
            ${photo_url||null}, ${id_photo_url||null},
            ${passport_photo_url||null}, ${iqama_photo_url||null},
            ${notes||null}, ${user.sub}
          ) RETURNING id, employee_id, full_name, status`;
        await audit(sql, user, 'CREATE_WORKER', 'workers', w.id, { employee_id, full_name }, ip);
        return res.status(201).json({ worker: w });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'workers/update' && req.method === 'POST') {
    if (!canFullControl(user,'workers') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
    try {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const allowed = ['full_name','arabic_name','nationality','national_id','passport_number',
                       'iqama_number','iqama_expiry','date_of_birth','gender','marital_status',
                       'phone','phone2','email','emergency_contact_name','emergency_contact_phone',
                       'position','department','project_assignment','join_date','contract_type',
                       'contract_end','basic_salary','housing_allowance','transport_allowance',
                       'other_allowance','bank_name','bank_iban','photo_url','id_photo_url',
                       'passport_photo_url','iqama_photo_url','status','notes'];
      const update = {};
      allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
      const [w] = await sql`UPDATE workers SET ${sql(update)}, updated_at=NOW() WHERE id=${id} RETURNING id, employee_id, full_name, status`;
      if (!w) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ worker: w });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── SALARY ────────────────────────────────────────────────────────────────
  if (route === 'salary') {
    if (req.method === 'GET') {
      if (!canAccess(user,'salary') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const { month, year, worker_id } = req.query;
        let rows;
        if (month && year) {
          rows = await sql`SELECT sr.*, w.photo_url FROM salary_records sr LEFT JOIN workers w ON w.id=sr.worker_id WHERE sr.period_month=${parseInt(month)} AND sr.period_year=${parseInt(year)} ORDER BY sr.worker_name`;
        } else if (worker_id) {
          rows = await sql`SELECT * FROM salary_records WHERE worker_id=${worker_id} ORDER BY period_year DESC, period_month DESC`;
        } else {
          rows = await sql`SELECT sr.*, w.photo_url FROM salary_records sr LEFT JOIN workers w ON w.id=sr.worker_id ORDER BY sr.created_at DESC LIMIT 200`;
        }
        return res.status(200).json({ salary_records: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'salary') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { worker_id, period_month, period_year, basic_salary, housing_allowance,
                transport_allowance, other_allowance, overtime_hours, overtime_rate,
                deductions, deduction_reason, bonus, bonus_reason, working_days,
                absent_days, leave_days, payment_method, payment_date, notes } = req.body || {};
        if (!worker_id || !period_month || !period_year) return res.status(400).json({ error: 'worker_id, period_month, period_year required' });
        const [w] = await sql`SELECT full_name FROM workers WHERE id=${worker_id}`;
        if (!w) return res.status(404).json({ error: 'Worker not found' });
        const bs = parseFloat(basic_salary)||0, ha = parseFloat(housing_allowance)||0;
        const ta = parseFloat(transport_allowance)||0, oa = parseFloat(other_allowance)||0;
        const ot_h = parseFloat(overtime_hours)||0, ot_r = parseFloat(overtime_rate)||25;
        const ot_pay = ot_h * ot_r;
        const gosiEmp = bs * 0.10, gosiEmpr = bs * 0.12;
        const deduct = parseFloat(deductions)||0, bon = parseFloat(bonus)||0;
        const wd = parseInt(working_days)||26, abd = parseInt(absent_days)||0;
        const absentDeduct = wd > 0 ? (bs / wd) * abd : 0;
        const gross = bs + ha + ta + oa + ot_pay + bon;
        const net = gross - deduct - gosiEmp - absentDeduct;
        const [rec] = await sql`
          INSERT INTO salary_records (worker_id, worker_name, period_month, period_year,
            basic_salary, housing_allowance, transport_allowance, other_allowance,
            overtime_hours, overtime_rate, overtime_pay, deductions, deduction_reason,
            bonus, bonus_reason, gross_salary, net_salary, gosi_employee, gosi_employer,
            working_days, absent_days, leave_days, payment_method, payment_date,
            notes, created_by, created_by_name)
          VALUES (${worker_id}, ${w.full_name}, ${parseInt(period_month)}, ${parseInt(period_year)},
            ${bs}, ${ha}, ${ta}, ${oa}, ${ot_h}, ${ot_r}, ${ot_pay}, ${deduct},
            ${deduction_reason||null}, ${bon}, ${bonus_reason||null},
            ${gross}, ${net}, ${gosiEmp}, ${gosiEmpr}, ${wd}, ${abd},
            ${parseInt(leave_days)||0}, ${payment_method||'bank_transfer'},
            ${payment_date||null}, ${notes||null}, ${user.sub}, ${user.full_name})
          ON CONFLICT (worker_id, period_month, period_year) DO UPDATE
            SET basic_salary=${bs}, housing_allowance=${ha}, transport_allowance=${ta},
                other_allowance=${oa}, overtime_hours=${ot_h}, overtime_pay=${ot_pay},
                deductions=${deduct}, bonus=${bon}, gross_salary=${gross}, net_salary=${net},
                gosi_employee=${gosiEmp}, gosi_employer=${gosiEmpr}, working_days=${wd},
                absent_days=${abd}, payment_method=${payment_method||'bank_transfer'}
          RETURNING id, worker_name, period_month, period_year, net_salary, status`;
        return res.status(201).json({ salary_record: rec });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'salary/pay' && req.method === 'POST') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const [rec] = await sql`UPDATE salary_records SET status='paid', payment_date=COALESCE(payment_date, NOW()::date) WHERE id=${id} RETURNING id, worker_name, status`;
      if (!rec) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ salary_record: rec });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  if (route === 'attendance') {
    if (req.method === 'GET') {
      if (!canAccess(user,'timesheet') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const { worker_id, month, year, date } = req.query;
        let rows;
        if (worker_id && month && year) {
          rows = await sql`SELECT * FROM attendance WHERE worker_id=${worker_id} AND EXTRACT(MONTH FROM date)=${parseInt(month)} AND EXTRACT(YEAR FROM date)=${parseInt(year)} ORDER BY date`;
        } else if (month && year) {
          rows = await sql`SELECT a.*, w.photo_url FROM attendance a LEFT JOIN workers w ON w.id=a.worker_id WHERE EXTRACT(MONTH FROM a.date)=${parseInt(month)} AND EXTRACT(YEAR FROM a.date)=${parseInt(year)} ORDER BY a.date DESC, a.worker_name`;
        } else if (date) {
          rows = await sql`SELECT * FROM attendance WHERE date=${date} ORDER BY worker_name`;
        } else {
          rows = await sql`SELECT * FROM attendance ORDER BY date DESC, worker_name LIMIT 500`;
        }
        return res.status(200).json({ attendance: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'timesheet') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { records } = req.body || {};
        if (!records?.length) return res.status(400).json({ error: 'records array required' });
        const inserted = [];
        for (const rec of records) {
          const { worker_id, date, status, check_in, check_out, hours_worked, overtime_hours, project, location, notes } = rec;
          if (!worker_id || !date) continue;
          const [w] = await sql`SELECT full_name FROM workers WHERE id=${worker_id}`;
          if (!w) continue;
          const [att] = await sql`
            INSERT INTO attendance (worker_id, worker_name, date, status, check_in, check_out, hours_worked, overtime_hours, project, location, notes, created_by)
            VALUES (${worker_id}, ${w.full_name}, ${date}, ${status||'present'}, ${check_in||null}, ${check_out||null}, ${parseFloat(hours_worked)||0}, ${parseFloat(overtime_hours)||0}, ${project||null}, ${location||null}, ${notes||null}, ${user.sub})
            ON CONFLICT (worker_id, date) DO UPDATE
              SET status=${status||'present'}, check_in=COALESCE(${check_in||null},attendance.check_in),
                  check_out=COALESCE(${check_out||null},attendance.check_out),
                  hours_worked=${parseFloat(hours_worked)||0}, updated_at=NOW()
            RETURNING id`;
          if (att) inserted.push(att.id);
        }
        return res.status(201).json({ inserted: inserted.length });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  if (route === 'notifications' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM notifications WHERE user_id=${user.sub} ORDER BY created_at DESC LIMIT 50`;
      const [{ count }] = await sql`SELECT COUNT(*) AS count FROM notifications WHERE user_id=${user.sub} AND is_read=false`;
      return res.status(200).json({ notifications: rows, unread: parseInt(count) });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'notifications/read' && req.method === 'POST') {
    try {
      const { notification_id } = req.body || {};
      if (notification_id) {
        await sql`UPDATE notifications SET is_read=true WHERE id=${notification_id} AND user_id=${user.sub}`;
      } else {
        await sql`UPDATE notifications SET is_read=true WHERE user_id=${user.sub}`;
      }
      return res.status(200).json({ ok: true });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'notifications/templates') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    if (req.method === 'GET') {
      try {
        const templates = await sql`SELECT * FROM notification_templates ORDER BY label`;
        return res.status(200).json({ templates });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      try {
        const { event_name, email_subj, email_body, wa_body, is_active } = req.body || {};
        if (!event_name) return res.status(400).json({ error: 'event_name required' });
        const [t] = await sql`UPDATE notification_templates SET email_subj=${email_subj||null}, email_body=${email_body||null}, wa_body=${wa_body||null}, is_active=${is_active??true}, updated_by=${user.sub}, updated_at=NOW() WHERE event_name=${event_name} RETURNING id, event_name, label`;
        if (!t) return res.status(404).json({ error: 'Template not found' });
        return res.status(200).json({ template: t });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'notifications/whatsapp' && req.method === 'POST') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { phone, message } = req.body || {};
      if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
      await sendWhatsApp(sql, phone, message);
      return res.status(200).json({ ok: true });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  if (route === 'settings') {
    if (req.method === 'GET') {
      try {
        const rows = await sql`SELECT key, value FROM system_settings ORDER BY key`;
        const settings = {};
        rows.forEach(r => { try { settings[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value; } catch { settings[r.key] = r.value; } });
        return res.status(200).json({ settings });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
      try {
        const { settings } = req.body || {};
        if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
        for (const [key, val] of Object.entries(settings)) {
          await sql`INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (${key}, ${JSON.stringify(val)}::jsonb, ${user.sub}, NOW()) ON CONFLICT (key) DO UPDATE SET value=${JSON.stringify(val)}::jsonb, updated_at=NOW(), updated_by=${user.sub}`;
        }
        return res.status(200).json({ ok: true });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── FORM BUILDER ──────────────────────────────────────────────────────────
  if (route === 'forms') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    if (req.method === 'GET') {
      try {
        const forms = await sql`SELECT * FROM custom_forms ORDER BY created_at DESC`;
        return res.status(200).json({ forms });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      try {
        const { name, description, module, fields, settings, status } = req.body || {};
        if (!name?.trim()) return res.status(400).json({ error: 'Form name required' });
        const [form] = await sql`INSERT INTO custom_forms (name, description, module, fields, settings, status, created_by)
          VALUES (${name.trim()}, ${description||null}, ${module||'general'}, ${JSON.stringify(fields||[])}::jsonb, ${JSON.stringify(settings||{})}::jsonb, ${status||'active'}, ${user.sub})
          RETURNING id, name, status, created_at`;
        return res.status(201).json({ form });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  if (route === 'forms/update' && req.method === 'POST') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { id, name, description, status } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const [form] = await sql`UPDATE custom_forms SET
        name=COALESCE(${name||null},name),
        description=COALESCE(${description||null},description),
        status=COALESCE(${status||null},status),
        updated_at=NOW()
        WHERE id=${id} RETURNING id, name, status`;
      if (!form) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ form });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  // FIXED: asset stats use correct column name (current_value) and safe fallback
  if (route === 'reports/dashboard' && req.method === 'GET') {
    try {
      const [expenseStats] = isSu(user) || canViewAll(user,'reports')
        ? await sql`SELECT COUNT(*) AS total_count,
            COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total,
            COUNT(*) FILTER (WHERE status='pending')  AS pending_count,
            COUNT(*) FILTER (WHERE status='approved') AS approved_count,
            COUNT(*) FILTER (WHERE status='rejected') AS rejected_count FROM expenses`
        : await sql`SELECT COUNT(*) AS total_count,
            COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total,
            COUNT(*) FILTER (WHERE status='pending')  AS pending_count,
            COUNT(*) FILTER (WHERE status='approved') AS approved_count,
            COUNT(*) FILTER (WHERE status='rejected') AS rejected_count FROM expenses WHERE submitted_by=${user.sub}`;

      const [invoiceStats] = isSu(user) || canViewAll(user,'reports')
        ? await sql`SELECT COUNT(*) AS total_count,
            COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total,
            COUNT(*) FILTER (WHERE status='pending')  AS pending_count,
            COUNT(*) FILTER (WHERE status='approved') AS approved_count FROM invoices`
        : await sql`SELECT COUNT(*) AS total_count,
            COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total,
            COUNT(*) FILTER (WHERE status='pending')  AS pending_count,
            COUNT(*) FILTER (WHERE status='approved') AS approved_count FROM invoices WHERE submitted_by=${user.sub}`;

      let pendingApprovals = 0;
      if (isSu(user)) {
        try {
          const [pc] = await sql`SELECT (
            (SELECT COUNT(*) FROM expenses WHERE status='pending') +
            (SELECT COUNT(*) FROM invoices  WHERE status='pending')
          ) AS total_pending`;
          pendingApprovals = Number(pc.total_pending);
        } catch { pendingApprovals = 0; }
      }

      const monthlyTrend = await sql`
        SELECT TO_CHAR(submitted_at,'Mon YY') AS month,
               TO_CHAR(submitted_at,'YYYY-MM') AS month_key,
               COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS total
        FROM expenses WHERE submitted_at >= NOW()-INTERVAL '6 months'
        GROUP BY month, month_key ORDER BY month_key`;

      const [walletBalance] = await sql`SELECT * FROM user_wallet_balance WHERE user_id=${user.sub}`;

      // Safe — won't crash if columns missing on old DB
      let assetStats = { total: 0, total_value: 0 };
      try {
        const [a] = await sql`SELECT COUNT(*) AS total, COALESCE(SUM(current_value),0) AS total_value FROM assets WHERE status='in_use'`;
        assetStats = a;
      } catch { /* table or column missing on old DB */ }

      let workerStats = { total: 0 };
      try {
        const [w] = await sql`SELECT COUNT(*) AS total FROM workers WHERE status='active'`;
        workerStats = w;
      } catch { /* table missing on old DB */ }

      return res.status(200).json({
        expenses: expenseStats, invoices: invoiceStats,
        pending_approvals: pendingApprovals, monthly_trend: monthlyTrend,
      let crmStats = { customers: 0, leads: 0, leads_won: 0 };
      try {
        const [cs] = await sql`SELECT COUNT(*) AS total FROM customers WHERE status='active'`;
        const [ls] = await sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='won') AS won FROM leads`;
        crmStats = { customers: Number(cs.total), leads: Number(ls.total), leads_won: Number(ls.won) };
      } catch {}
      let projectStats = { total: 0, active: 0, tasks_total: 0, tasks_done: 0 };
      try {
        const [ps] = await sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='active') AS active FROM projects`;
        const [ts] = await sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='done') AS done FROM tasks`;
        projectStats = { total: Number(ps.total), active: Number(ps.active), tasks_total: Number(ts.total), tasks_done: Number(ts.done) };
      } catch {}
        wallet: walletBalance || null, assets: assetStats, workers: workerStats,
        crm: crmStats, projects: projectStats,
      });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'reports/workers' && req.method === 'GET') {
    if (!canViewReports(user,'reports') && !isSu(user)) return res.status(403).json({ error: 'No access' });
    try {
      const rows = await sql`SELECT w.*,
        (SELECT COUNT(*) FROM attendance WHERE worker_id=w.id AND status='present') AS days_present,
        (SELECT COUNT(*) FROM attendance WHERE worker_id=w.id AND status='absent')  AS days_absent
        FROM workers w ORDER BY w.full_name`;
      return res.status(200).json({ workers: rows });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'reports/salary-summary' && req.method === 'GET') {
    if (!canViewReports(user,'reports') && !isSu(user)) return res.status(403).json({ error: 'No access' });
    try {
      const { year } = req.query;
      const yr = parseInt(year) || new Date().getFullYear();
      const rows = await sql`SELECT period_month, COUNT(*) AS worker_count,
        SUM(gross_salary) AS total_gross, SUM(net_salary) AS total_net,
        SUM(gosi_employer) AS total_gosi FROM salary_records
        WHERE period_year=${yr} GROUP BY period_month ORDER BY period_month`;
      return res.status(200).json({ summary: rows });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'reports/wallet' && req.method === 'GET') {
    try {
      const rows = isSu(user) || canViewAll(user,'reports')
        ? await sql`SELECT * FROM user_wallet_balance ORDER BY full_name`
        : await sql`SELECT * FROM user_wallet_balance WHERE user_id=${user.sub}`;
      return res.status(200).json({ wallets: rows });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────
  if (route === 'audit-log' && req.method === 'GET') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const rows = await sql`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200`;
      return res.status(200).json({ logs: rows });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ── SUBSCRIPTION ──────────────────────────────────────────────────────────
  if (route === 'subscription') {
    if (req.method === 'GET') {
      try {
        await sql`CREATE TABLE IF NOT EXISTS subscriptions (
          id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          plan_name       TEXT        NOT NULL DEFAULT 'Starter',
          status          TEXT        NOT NULL DEFAULT 'trial' CHECK (status IN ('active','trial','suspended','expired','cancelled')),
          started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at      TIMESTAMPTZ,
          trial_ends_at   TIMESTAMPTZ,
          billing_cycle   TEXT        NOT NULL DEFAULT 'monthly',
          price_paid      NUMERIC(12,2) DEFAULT 0,
          max_users       INTEGER     DEFAULT 5,
          max_storage_gb  INTEGER     DEFAULT 5,
          contact_email   TEXT,
          contact_phone   TEXT,
          notes           TEXT,
          updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
        // current_users from live count
        const [row] = await sql`SELECT s.*,
          (SELECT COUNT(*) FROM users WHERE is_active=true) AS current_users
          FROM subscriptions s ORDER BY started_at DESC LIMIT 1`;
        return res.status(200).json({ subscription: row || null });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
      try {
        const { plan_name, status, billing_cycle, price_paid, max_users, max_storage_gb, expires_at, trial_ends_at, notes, contact_email, contact_phone } = req.body || {};
        await sql`CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          plan_name TEXT NOT NULL DEFAULT 'Starter',
          status TEXT NOT NULL DEFAULT 'trial',
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ, trial_ends_at TIMESTAMPTZ,
          billing_cycle TEXT NOT NULL DEFAULT 'monthly',
          price_paid NUMERIC(12,2) DEFAULT 0, max_users INTEGER DEFAULT 5,
          max_storage_gb INTEGER DEFAULT 5, contact_email TEXT, contact_phone TEXT,
          notes TEXT, updated_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
        const [existing] = await sql`SELECT id FROM subscriptions LIMIT 1`;
        let sub;
        if (existing) {
          [sub] = await sql`UPDATE subscriptions SET
            plan_name=COALESCE(${plan_name||null},plan_name),
            status=COALESCE(${status||null},status),
            billing_cycle=COALESCE(${billing_cycle||null},billing_cycle),
            price_paid=COALESCE(${price_paid ? parseFloat(price_paid) : null},price_paid),
            max_users=COALESCE(${max_users ? parseInt(max_users) : null},max_users),
            max_storage_gb=COALESCE(${max_storage_gb ? parseInt(max_storage_gb) : null},max_storage_gb),
            expires_at=COALESCE(${expires_at||null},expires_at),
            trial_ends_at=COALESCE(${trial_ends_at||null},trial_ends_at),
            contact_email=COALESCE(${contact_email||null},contact_email),
            contact_phone=COALESCE(${contact_phone||null},contact_phone),
            notes=COALESCE(${notes||null},notes),
            updated_by=${user.sub}, updated_at=NOW()
            WHERE id=${existing.id} RETURNING *`;
        } else {
          [sub] = await sql`INSERT INTO subscriptions (plan_name,status,billing_cycle,price_paid,max_users,max_storage_gb,expires_at,trial_ends_at,contact_email,contact_phone,notes,updated_by)
            VALUES (${plan_name||'Starter'},${status||'active'},${billing_cycle||'monthly'},${parseFloat(price_paid||'0')},${parseInt(max_users||'5')},${parseInt(max_storage_gb||'5')},${expires_at||null},${trial_ends_at||null},${contact_email||null},${contact_phone||null},${notes||null},${user.sub})
            RETURNING *`;
        }
        const cu = await sql`SELECT COUNT(*) AS c FROM users WHERE is_active=true`;
        return res.status(200).json({ subscription: { ...sub, current_users: parseInt(cu[0].c) } });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── CREATOR PANEL ─────────────────────────────────────────────────────────
  if (route === 'creator/stats' && req.method === 'GET') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const [ut] = await sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active=true) AS active FROM users`;
      const [et] = await sql`SELECT COUNT(*) AS total FROM expenses`;
      const [it] = await sql`SELECT COUNT(*) AS total FROM invoices`;
      const [pa] = await sql`SELECT (
        (SELECT COUNT(*) FROM expenses WHERE status='pending') +
        (SELECT COUNT(*) FROM invoices WHERE status='pending')
      ) AS total`;
      let at = { total:0 }; try { [at] = await sql`SELECT COUNT(*) AS total FROM assets WHERE status='in_use'`; } catch {}
      let wt = { total:0 }; try { [wt] = await sql`SELECT COUNT(*) AS total FROM workers WHERE status='active'`; } catch {}
      let al = { total:0 }; try { [al] = await sql`SELECT COUNT(*) AS total FROM audit_log`; } catch {}
      return res.status(200).json({
        stats: {
          users_total: parseInt(ut.total), users_active: parseInt(ut.active),
          expenses_total: parseInt(et.total), invoices_total: parseInt(it.total),
          pending_approvals: parseInt(pa.total), assets_total: parseInt(at.total),
          workers_total: parseInt(wt.total), audit_logs_count: parseInt(al.total),
        }
      });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'creator/ping' && req.method === 'GET') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const [r] = await sql`SELECT NOW()::text AS time`;
      return res.status(200).json({ time: r.time, status: 'ok' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'creator/reset-password' && req.method === 'POST') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { user_id, new_password } = req.body || {};
      if (!user_id || !new_password) return res.status(400).json({ error: 'user_id and new_password required' });
      if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const hash = hashPassword(new_password);
      const [updated] = await sql`UPDATE users SET password_hash=${hash}, updated_at=NOW() WHERE id=${user_id} RETURNING id, username, full_name`;
      if (!updated) return res.status(404).json({ error: 'User not found' });
      await audit(sql, user, 'force_reset_password', 'user', user_id, { target: updated.username }, ip);
      return res.status(200).json({ ok: true, message: `Password reset for ${updated.full_name}` });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }


  // ── CRM: CUSTOMERS ─────────────────────────────────────────────────────────
  if (route === 'customers') {
    if (req.method === 'GET') {
      if (!canAccess(user,'crm') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const { search, status, page = '1', limit = '50' } = req.query;
        const offset = (parseInt(page)-1) * parseInt(limit);
        let rows;
        if (search) {
          rows = await sql`SELECT * FROM customers WHERE (company_name ILIKE ${'%'+search+'%'} OR contact_name ILIKE ${'%'+search+'%'} OR email ILIKE ${'%'+search+'%'}) ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
        } else if (status) {
          rows = await sql`SELECT * FROM customers WHERE status=${status} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
        } else {
          rows = await sql`SELECT * FROM customers ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
        }
        const [{ total }] = await sql`SELECT COUNT(*) AS total FROM customers`;
        return res.status(200).json({ customers: rows, total: parseInt(total) });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canFullControl(user,'crm') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { company_name, contact_name, email, phone, address, city, country, vat_number, cr_number, industry, customer_type, status, notes } = req.body || {};
        if (!company_name) return res.status(400).json({ error: 'company_name required' });
        const num = 'CUST-' + String(await sql`SELECT nextval('customer_seq') AS n`.then(r=>r[0].n)).padStart(5,'0');
        const [row] = await sql`INSERT INTO customers (customer_number,company_name,contact_name,email,phone,address,city,country,vat_number,cr_number,industry,customer_type,status,notes,created_by)
          VALUES (${num},${company_name},${contact_name||null},${email||null},${phone||null},${address||null},${city||null},${country||'Saudi Arabia'},${vat_number||null},${cr_number||null},${industry||null},${customer_type||'business'},${status||'active'},${notes||null},${user.sub})
          RETURNING *`;
        await audit(sql, user, 'create_customer', 'customer', row.id, { company_name }, ip);
        return res.status(201).json({ customer: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'PUT') {
      if (!canFullControl(user,'crm') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { id, company_name, contact_name, email, phone, address, city, country, vat_number, cr_number, industry, customer_type, status, notes } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const [row] = await sql`UPDATE customers SET company_name=${company_name},contact_name=${contact_name||null},email=${email||null},phone=${phone||null},address=${address||null},city=${city||null},country=${country||'Saudi Arabia'},vat_number=${vat_number||null},cr_number=${cr_number||null},industry=${industry||null},customer_type=${customer_type||'business'},status=${status||'active'},notes=${notes||null},updated_at=NOW() WHERE id=${id} RETURNING *`;
        return res.status(200).json({ customer: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'DELETE') {
      if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
      try {
        const { id } = req.body || {};
        await sql`DELETE FROM customers WHERE id=${id}`;
        return res.status(200).json({ ok: true });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── CRM: LEADS ─────────────────────────────────────────────────────────────
  if (route === 'leads') {
    if (req.method === 'GET') {
      if (!canAccess(user,'crm') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const { status, search } = req.query;
        let rows;
        if (search) {
          rows = await sql`SELECT l.*, u.full_name AS assigned_name FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE (l.title ILIKE ${'%'+search+'%'} OR l.contact_name ILIKE ${'%'+search+'%'} OR l.company_name ILIKE ${'%'+search+'%'}) ORDER BY l.created_at DESC`;
        } else if (status) {
          rows = await sql`SELECT l.*, u.full_name AS assigned_name FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.status=${status} ORDER BY l.created_at DESC`;
        } else {
          rows = await sql`SELECT l.*, u.full_name AS assigned_name FROM leads l LEFT JOIN users u ON u.id=l.assigned_to ORDER BY l.created_at DESC`;
        }
        return res.status(200).json({ leads: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'crm') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { title, company_name, contact_name, email, phone, source, status, value, probability, expected_close, assigned_to, notes } = req.body || {};
        if (!title || !contact_name) return res.status(400).json({ error: 'title and contact_name required' });
        const num = 'LEAD-' + Date.now().toString(36).toUpperCase();
        const [row] = await sql`INSERT INTO leads (lead_number,title,company_name,contact_name,email,phone,source,status,value,probability,expected_close,assigned_to,notes,created_by)
          VALUES (${num},${title},${company_name||null},${contact_name},${email||null},${phone||null},${source||'website'},${status||'new'},${value||0},${probability||0},${expected_close||null},${assigned_to||null},${notes||null},${user.sub})
          RETURNING *`;
        await audit(sql, user, 'create_lead', 'lead', row.id, { title }, ip);
        return res.status(201).json({ lead: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'PUT') {
      if (!canSubmit(user,'crm') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { id, title, company_name, contact_name, email, phone, source, status, value, probability, expected_close, assigned_to, notes } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const [row] = await sql`UPDATE leads SET title=${title},company_name=${company_name||null},contact_name=${contact_name},email=${email||null},phone=${phone||null},source=${source||'website'},status=${status},value=${value||0},probability=${probability||0},expected_close=${expected_close||null},assigned_to=${assigned_to||null},notes=${notes||null},updated_at=NOW() WHERE id=${id} RETURNING *`;
        return res.status(200).json({ lead: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'DELETE') {
      if (!canFullControl(user,'crm') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { id } = req.body || {};
        await sql`DELETE FROM leads WHERE id=${id}`;
        return res.status(200).json({ ok: true });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── PROJECTS ───────────────────────────────────────────────────────────────
  if (route === 'projects') {
    if (req.method === 'GET') {
      if (!canAccess(user,'projects') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const { status, search } = req.query;
        let rows;
        if (search) {
          rows = await sql`SELECT p.*, u.full_name AS manager_name FROM projects p LEFT JOIN users u ON u.id=p.manager_id WHERE (p.name ILIKE ${'%'+search+'%'} OR p.client_name ILIKE ${'%'+search+'%'}) ORDER BY p.created_at DESC`;
        } else if (status) {
          rows = await sql`SELECT p.*, u.full_name AS manager_name FROM projects p LEFT JOIN users u ON u.id=p.manager_id WHERE p.status=${status} ORDER BY p.created_at DESC`;
        } else {
          rows = await sql`SELECT p.*, u.full_name AS manager_name FROM projects p LEFT JOIN users u ON u.id=p.manager_id ORDER BY p.created_at DESC`;
        }
        return res.status(200).json({ projects: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'projects') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { name, description, client_id, client_name, status, priority, start_date, end_date, budget, progress, manager_id, location, notes } = req.body || {};
        if (!name) return res.status(400).json({ error: 'name required' });
        const num = 'PROJ-' + String(await sql`SELECT nextval('project_seq') AS n`.then(r=>r[0].n)).padStart(4,'0');
        const mgr = manager_id || user.sub;
        const mgrName = await sql`SELECT full_name FROM users WHERE id=${mgr}`.then(r=>r[0]?.full_name||'');
        const [row] = await sql`INSERT INTO projects (project_number,name,description,client_id,client_name,status,priority,start_date,end_date,budget,progress,manager_id,manager_name,location,notes,created_by)
          VALUES (${num},${name},${description||null},${client_id||null},${client_name||null},${status||'planning'},${priority||'medium'},${start_date||null},${end_date||null},${budget||0},${progress||0},${mgr},${mgrName},${location||null},${notes||null},${user.sub})
          RETURNING *`;
        await audit(sql, user, 'create_project', 'project', row.id, { name }, ip);
        return res.status(201).json({ project: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'PUT') {
      if (!canSubmit(user,'projects') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { id, name, description, client_id, client_name, status, priority, start_date, end_date, budget, spent, progress, manager_id, location, notes } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const [row] = await sql`UPDATE projects SET name=${name},description=${description||null},client_id=${client_id||null},client_name=${client_name||null},status=${status},priority=${priority||'medium'},start_date=${start_date||null},end_date=${end_date||null},budget=${budget||0},spent=${spent||0},progress=${progress||0},manager_id=${manager_id||null},location=${location||null},notes=${notes||null},updated_at=NOW() WHERE id=${id} RETURNING *`;
        return res.status(200).json({ project: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'DELETE') {
      if (!isSu(user)) return res.status(403).json({ error: 'Superuser only' });
      try {
        const { id } = req.body || {};
        await sql`DELETE FROM projects WHERE id=${id}`;
        return res.status(200).json({ ok: true });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── TASKS ──────────────────────────────────────────────────────────────────
  if (route === 'tasks') {
    if (req.method === 'GET') {
      if (!canAccess(user,'projects') && !isSu(user)) return res.status(403).json({ error: 'No access' });
      try {
        const { project_id, status, assigned_to } = req.query;
        let rows;
        if (project_id) {
          rows = await sql`SELECT t.*, u.full_name AS assigned_name, p.name AS project_name FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN projects p ON p.id=t.project_id WHERE t.project_id=${project_id} ORDER BY t.created_at DESC`;
        } else if (assigned_to) {
          rows = await sql`SELECT t.*, u.full_name AS assigned_name, p.name AS project_name FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN projects p ON p.id=t.project_id WHERE t.assigned_to=${assigned_to} ORDER BY t.created_at DESC`;
        } else if (status) {
          rows = await sql`SELECT t.*, u.full_name AS assigned_name, p.name AS project_name FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN projects p ON p.id=t.project_id WHERE t.status=${status} ORDER BY t.created_at DESC`;
        } else {
          rows = await sql`SELECT t.*, u.full_name AS assigned_name, p.name AS project_name FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN projects p ON p.id=t.project_id ORDER BY t.created_at DESC LIMIT 200`;
        }
        return res.status(200).json({ tasks: rows });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'POST') {
      if (!canSubmit(user,'projects') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { project_id, title, description, status, priority, assigned_to, due_date, estimated_hours, notes } = req.body || {};
        if (!title) return res.status(400).json({ error: 'title required' });
        const assignedName = assigned_to ? await sql`SELECT full_name FROM users WHERE id=${assigned_to}`.then(r=>r[0]?.full_name||'') : null;
        const [row] = await sql`INSERT INTO tasks (project_id,title,description,status,priority,assigned_to,assigned_name,due_date,estimated_hours,notes,created_by)
          VALUES (${project_id||null},${title},${description||null},${status||'todo'},${priority||'medium'},${assigned_to||null},${assignedName},${due_date||null},${estimated_hours||0},${notes||null},${user.sub})
          RETURNING *`;
        await audit(sql, user, 'create_task', 'task', row.id, { title }, ip);
        return res.status(201).json({ task: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'PUT') {
      if (!canSubmit(user,'projects') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { id, project_id, title, description, status, priority, assigned_to, due_date, estimated_hours, actual_hours, notes } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const completed_at = status === 'done' ? sql`NOW()` : null;
        const assignedName = assigned_to ? await sql`SELECT full_name FROM users WHERE id=${assigned_to}`.then(r=>r[0]?.full_name||'') : null;
        const [row] = await sql`UPDATE tasks SET project_id=${project_id||null},title=${title},description=${description||null},status=${status},priority=${priority||'medium'},assigned_to=${assigned_to||null},assigned_name=${assignedName},due_date=${due_date||null},estimated_hours=${estimated_hours||0},actual_hours=${actual_hours||0},notes=${notes||null},updated_at=NOW() WHERE id=${id} RETURNING *`;
        return res.status(200).json({ task: row });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
    if (req.method === 'DELETE') {
      if (!canFullControl(user,'projects') && !isSu(user)) return res.status(403).json({ error: 'No permission' });
      try {
        const { id } = req.body || {};
        await sql`DELETE FROM tasks WHERE id=${id}`;
        return res.status(200).json({ ok: true });
      } catch (err) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── REPORTS: CRM & PROJECTS ────────────────────────────────────────────────
  if (route === 'reports/crm' && req.method === 'GET') {
    if (!canViewReports(user,'reports') && !isSu(user)) return res.status(403).json({ error: 'No access' });
    try {
      const [cs] = await sql`SELECT COUNT(*) FILTER (WHERE status='active') AS active, COUNT(*) AS total FROM customers`;
      const [ls] = await sql`SELECT
        COUNT(*) FILTER (WHERE status='won') AS won,
        COUNT(*) FILTER (WHERE status='lost') AS lost,
        COUNT(*) FILTER (WHERE status='new') AS new_leads,
        COUNT(*) AS total,
        COALESCE(SUM(value) FILTER (WHERE status='won'),0) AS won_value
        FROM leads`;
      return res.status(200).json({ customers: cs, leads: ls });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (route === 'reports/projects' && req.method === 'GET') {
    if (!canViewReports(user,'reports') && !isSu(user)) return res.status(403).json({ error: 'No access' });
    try {
      const [ps] = await sql`SELECT
        COUNT(*) FILTER (WHERE status='active') AS active,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='planning') AS planning,
        COUNT(*) AS total,
        COALESCE(SUM(budget),0) AS total_budget,
        COALESCE(SUM(spent),0) AS total_spent
        FROM projects`;
      const [ts] = await sql`SELECT
        COUNT(*) FILTER (WHERE status='done') AS done,
        COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status='todo') AS todo,
        COUNT(*) AS total
        FROM tasks`;
      return res.status(200).json({ projects: ps, tasks: ts });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  return res.status(404).json({ error: `Unknown route: ${route}` });
}
