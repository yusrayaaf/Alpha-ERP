// src/pages/NotificationSettingsPage.tsx — Notification Settings with SMS/WhatsApp
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface NotifSettings {
  sms_enabled: boolean
  sms_provider: string
  sms_api_key: string
  sms_from: string
  whatsapp_enabled: boolean
  whatsapp_token: string
  whatsapp_phone_id: string
  email_enabled: boolean
  email_smtp_host: string
  email_smtp_port: string
  email_smtp_user: string
  email_smtp_pass: string
  email_from: string
  inapp_enabled: boolean
  telegram_enabled: boolean
  telegram_bot_token: string
  telegram_chat_id: string
  templates: Record<string, unknown>
}

const EVENTS = [
  { key: 'expense_submitted', label: '📋 Expense Submitted', vars: ['{user_name}', '{expense_id}', '{amount}', '{project}'] },
  { key: 'expense_approved', label: '✅ Expense Approved', vars: ['{user_name}', '{expense_id}', '{amount}', '{approver}'] },
  { key: 'expense_rejected', label: '❌ Expense Rejected', vars: ['{user_name}', '{expense_id}', '{comment}'] },
  { key: 'invoice_approved', label: '✅ Invoice Approved', vars: ['{user_name}', '{invoice_id}', '{client}', '{amount}'] },
  { key: 'user_created', label: '👤 User Created', vars: ['{user_name}', '{email}', '{role}'] },
  { key: 'asset_added', label: '🏗️ Asset Added', vars: ['{asset_name}', '{asset_id}', '{category}'] },
  { key: 'liability_overdue', label: '⚠️ Liability Overdue', vars: ['{liability_id}', '{amount}', '{lender}', '{due_date}'] },
  { key: 'investment_return', label: '💰 Investment Return Due', vars: ['{investment_id}', '{amount}', '{due_date}'] },
  { key: 'low_balance', label: '💸 Low Wallet Balance', vars: ['{user_name}', '{balance}'] },
]

const DEFAULT_TEMPLATES: Record<string, any> = {
  expense_submitted: {
    sms: 'Alpha Ultimate ERP: {user_name} submitted expense {expense_id} for SAR {amount}. Project: {project}. Review in dashboard.',
    whatsapp: '🏢 *Alpha Ultimate ERP*\n\n📋 New expense submitted\n👤 By: {user_name}\n🔖 Ref: {expense_id}\n💰 Amount: SAR {amount}\n📍 Project: {project}\n\nPlease review in the ERP dashboard.',
    email_subject: 'New Expense Pending Review — {expense_id}',
    email_body: 'Dear Admin,\n\n{user_name} has submitted a new expense ({expense_id}) for SAR {amount} under project "{project}".\n\nPlease review and approve/reject via the ERP dashboard.\n\nRegards,\nAlpha Ultimate ERP',
  },
  expense_approved: {
    sms: 'Alpha Ultimate: Your expense {expense_id} (SAR {amount}) has been APPROVED by {approver}.',
    whatsapp: '✅ *Expense Approved*\n\n🔖 {expense_id}\n💰 SAR {amount}\n👤 Approved by: {approver}\n\nThank you!',
    email_subject: 'Expense Approved — {expense_id}',
    email_body: 'Dear {user_name},\n\nYour expense {expense_id} for SAR {amount} has been approved by {approver}.\n\nRegards,\nAlpha Ultimate ERP',
  },
  expense_rejected: {
    sms: 'Alpha Ultimate: Your expense {expense_id} has been REJECTED. Reason: {comment}',
    whatsapp: '❌ *Expense Rejected*\n\n🔖 {expense_id}\n📝 Reason: {comment}\n\nPlease contact admin for further info.',
    email_subject: 'Expense Rejected — {expense_id}',
    email_body: 'Dear {user_name},\n\nYour expense {expense_id} has been rejected.\n\nReason: {comment}\n\nRegards,\nAlpha Ultimate ERP',
  },
}

export default function NotificationSettingsPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)
  const [settings, setSettings] = useState<NotifSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'channels' | 'templates'>('channels')
  const [activeEvent, setActiveEvent] = useState(EVENTS[0].key)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    // Load from /settings - all notif keys are stored there prefixed with notif_
    api.get<{ settings: Record<string, unknown> }>('/settings')
      .then(d => {
        const s = d.settings || {}
        setSettings({
          sms_enabled:        Boolean(s['notif_sms_enabled']        ?? false),
          sms_provider:       String(s['notif_sms_provider']        ?? 'custom'),
          sms_api_key:        String(s['notif_sms_api_key']         ?? ''),
          sms_from:           String(s['notif_sms_from']            ?? ''),
          whatsapp_enabled:   Boolean(s['notif_whatsapp_enabled']   ?? false),
          whatsapp_token:     String(s['notif_whatsapp_token']      ?? ''),
          whatsapp_phone_id:  String(s['notif_whatsapp_phone_id']   ?? ''),
          email_enabled:      Boolean(s['notif_email_enabled']      ?? false),
          email_smtp_host:    String(s['notif_email_smtp_host']     ?? ''),
          email_smtp_port:    String(s['notif_email_smtp_port']     ?? '587'),
          email_smtp_user:    String(s['notif_email_user']          ?? ''),
          email_smtp_pass:    String(s['notif_email_pass']          ?? ''),
          email_from:         String(s['notif_email_from']          ?? ''),
          inapp_enabled:      Boolean(s['notif_inapp_enabled']      ?? true),
          telegram_enabled:   Boolean(s['notif_telegram_enabled']   ?? false),
          telegram_bot_token: String(s['notif_telegram_bot_token']  ?? ''),
          telegram_chat_id:   String(s['notif_telegram_chat_id']    ?? ''),
          templates:          (s['notif_templates'] as Record<string, unknown>) ?? DEFAULT_TEMPLATES,
        })
      })
      .catch(() => {
        setSettings({
          sms_enabled: false, sms_provider: 'custom', sms_api_key: '', sms_from: '',
          whatsapp_enabled: false, whatsapp_token: '', whatsapp_phone_id: '',
          email_enabled: false, email_smtp_host: '', email_smtp_port: '587',
          email_smtp_user: '', email_smtp_pass: '', email_from: '',
          inapp_enabled: true, telegram_enabled: false, telegram_bot_token: '', telegram_chat_id: '',
          templates: DEFAULT_TEMPLATES as Record<string, unknown>,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!settings) return
    setSaving(true); setError(''); setSuccess('')
    try {
      // Save all notification settings under namespaced keys in system_settings
      await api.post('/settings', { settings: {
        notif_sms_enabled:        settings.sms_enabled,
        notif_sms_provider:       settings.sms_provider,
        notif_sms_api_key:        settings.sms_api_key,
        notif_sms_from:           settings.sms_from,
        notif_whatsapp_enabled:   settings.whatsapp_enabled,
        notif_whatsapp_token:     settings.whatsapp_token,
        notif_whatsapp_phone_id:  settings.whatsapp_phone_id,
        notif_email_enabled:      settings.email_enabled,
        notif_email_smtp_host:    settings.email_smtp_host,
        notif_email_smtp_port:    settings.email_smtp_port,
        notif_email_user:         settings.email_smtp_user,
        notif_email_pass:         settings.email_smtp_pass,
        notif_email_from:         settings.email_from,
        notif_inapp_enabled:      settings.inapp_enabled,
        notif_telegram_enabled:   settings.telegram_enabled,
        notif_telegram_bot_token: settings.telegram_bot_token,
        notif_telegram_chat_id:   settings.telegram_chat_id,
        notif_templates:          settings.templates,
      }})
      setSuccess('Notification settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const sendTest = async () => {
    if (!testPhone.trim()) return setError('Enter a phone number for test')
    setSending(true); setError('')
    try {
      // Use the real WhatsApp send endpoint
      await api.post('/notifications/whatsapp', { phone: testPhone, message: '🔔 Test message from Alpha Ultimate ERP — WhatsApp notifications are working!' })
      setSuccess('Test WhatsApp message sent!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Send failed') }
    finally { setSending(false) }
  }

  const updateTemplate = (event: string, field: string, val: string) => {
    setSettings(prev => prev ? {
      ...prev,
      templates: {
        ...prev.templates,
        [event]: { ...(prev.templates?.[event] || {}), [field]: val }
      }
    } : prev)
  }

  if (!su) return <div className="alert-error">Superuser access required</div>
  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border2)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!settings) return null

  const currentEvent = EVENTS.find(e => e.key === activeEvent)!
  const tmpl = settings.templates?.[activeEvent] || { sms: '', whatsapp: '', email_subject: '', email_body: '' }

  return (
    <div style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)', margin: 0 }}>🔔 Notification Settings</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', marginTop: 2 }}>Configure SMS, WhatsApp, Email & In-App notifications</div>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ fontSize: '0.85rem' }}>
          {saving ? 'Saving…' : '💾 Save Settings'}
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(0,255,179,0.1)', border: '1px solid rgba(0,255,179,0.4)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', color: '#00ffb3', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {(['channels', 'templates'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1.2rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem',
              fontFamily: 'var(--font)', fontWeight: 700,
              background: activeTab === tab ? 'var(--blue)' : 'var(--card)',
              color: activeTab === tab ? '#07061a' : 'var(--muted)',
              border: `1px solid ${activeTab === tab ? 'var(--blue)' : 'var(--border)'}`,
            }}
          >{tab === 'channels' ? '📡 Channels' : '📝 Templates'}</button>
        ))}
      </div>

      {activeTab === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* SMS */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>📱 SMS Notifications</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: 2 }}>Send text messages to user mobile numbers</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <div onClick={() => setSettings(p => p ? { ...p, sms_enabled: !p.sms_enabled } : p)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, transition: 'all 0.2s', cursor: 'pointer',
                    background: settings.sms_enabled ? 'var(--blue)' : 'var(--border2)',
                    position: 'relative',
                  }}>
                  <div style={{ position: 'absolute', top: 3, left: settings.sms_enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: settings.sms_enabled ? 'var(--blue)' : 'var(--muted)' }}>
                  {settings.sms_enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </label>
            </div>

            {settings.sms_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">SMS Provider</label>
                  <select className="form-select" value={settings.sms_provider}
                    onChange={e => setSettings(p => p ? { ...p, sms_provider: e.target.value } : p)}>
                    <option value="custom">Custom HTTP API</option>
                    <option value="twilio">Twilio</option>
                    <option value="vonage">Vonage</option>
                    <option value="unifonic">Unifonic (Saudi)</option>
                    <option value="msegat">Msegat (Saudi)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">API Key</label>
                  <input className="form-input" type="password" value={settings.sms_api_key}
                    onChange={e => setSettings(p => p ? { ...p, sms_api_key: e.target.value } : p)}
                    placeholder="Your SMS API key" />
                </div>
                <div>
                  <label className="form-label">From Number / Sender ID</label>
                  <input className="form-input" value={settings.sms_from}
                    onChange={e => setSettings(p => p ? { ...p, sms_from: e.target.value } : p)}
                    placeholder="+966XXXXXXXXX or ALPHAERP" />
                </div>
                <div>
                  <label className="form-label">Test SMS</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input className="form-input" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+966XXXXXXXXX" style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={sendTest} disabled={sending} style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '0.4rem 0.7rem' }}>
                      {sending ? '…' : '📤 Send'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>💬 WhatsApp Notifications</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: 2 }}>Send WhatsApp messages via Meta Business API (free tier available)</div>
              </div>
              <div onClick={() => setSettings(p => p ? { ...p, whatsapp_enabled: !p.whatsapp_enabled } : p)}
                style={{
                  width: 44, height: 24, borderRadius: 12, transition: 'all 0.2s', cursor: 'pointer',
                  background: settings.whatsapp_enabled ? '#25d366' : 'var(--border2)', position: 'relative',
                }}>
                <div style={{ position: 'absolute', top: 3, left: settings.whatsapp_enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            {settings.whatsapp_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">WhatsApp Business API Token</label>
                  <input className="form-input" type="password" value={settings.whatsapp_token}
                    onChange={e => setSettings(p => p ? { ...p, whatsapp_token: e.target.value } : p)}
                    placeholder="Meta Business API Bearer Token" />
                </div>
                <div>
                  <label className="form-label">Phone Number ID</label>
                  <input className="form-input" value={settings.whatsapp_phone_id}
                    onChange={e => setSettings(p => p ? { ...p, whatsapp_phone_id: e.target.value } : p)}
                    placeholder="Meta Phone Number ID" />
                </div>
              </div>
            )}
          </div>

          {/* Telegram */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>✈️ Telegram Notifications</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: 2 }}>100% free — no credit card required</div>
              </div>
              <div onClick={() => setSettings(p => p ? { ...p, telegram_enabled: !p.telegram_enabled } : p)}
                style={{
                  width: 44, height: 24, borderRadius: 12, transition: 'all 0.2s', cursor: 'pointer',
                  background: settings.telegram_enabled ? '#0088cc' : 'var(--border2)', position: 'relative',
                }}>
                <div style={{ position: 'absolute', top: 3, left: settings.telegram_enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            {settings.telegram_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Bot Token</label>
                  <input className="form-input" type="password" value={settings.telegram_bot_token}
                    onChange={e => setSettings(p => p ? { ...p, telegram_bot_token: e.target.value } : p)}
                    placeholder="Bot token from @BotFather" />
                </div>
                <div>
                  <label className="form-label">Chat ID</label>
                  <input className="form-input" value={settings.telegram_chat_id}
                    onChange={e => setSettings(p => p ? { ...p, telegram_chat_id: e.target.value } : p)}
                    placeholder="Group or channel chat ID" />
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>📧 Email Notifications (SMTP)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: 2 }}>Works with IONOS, Gmail, any SMTP provider</div>
              </div>
              <div onClick={() => setSettings(p => p ? { ...p, email_enabled: !p.email_enabled } : p)}
                style={{
                  width: 44, height: 24, borderRadius: 12, transition: 'all 0.2s', cursor: 'pointer',
                  background: settings.email_enabled ? 'var(--blue)' : 'var(--border2)', position: 'relative',
                }}>
                <div style={{ position: 'absolute', top: 3, left: settings.email_enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            {settings.email_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">SMTP Host</label>
                  <input className="form-input" value={settings.email_smtp_host}
                    onChange={e => setSettings(p => p ? { ...p, email_smtp_host: e.target.value } : p)}
                    placeholder="smtp.ionos.com" />
                </div>
                <div>
                  <label className="form-label">SMTP Port</label>
                  <input className="form-input" value={settings.email_smtp_port}
                    onChange={e => setSettings(p => p ? { ...p, email_smtp_port: e.target.value } : p)}
                    placeholder="587" />
                </div>
                <div>
                  <label className="form-label">SMTP Username</label>
                  <input className="form-input" value={settings.email_smtp_user}
                    onChange={e => setSettings(p => p ? { ...p, email_smtp_user: e.target.value } : p)}
                    placeholder="noreply@alpha-ultimate.com" />
                </div>
                <div>
                  <label className="form-label">SMTP Password</label>
                  <input className="form-input" type="password" value={settings.email_smtp_pass}
                    onChange={e => setSettings(p => p ? { ...p, email_smtp_pass: e.target.value } : p)}
                    placeholder="SMTP password" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">From Email</label>
                  <input className="form-input" value={settings.email_from}
                    onChange={e => setSettings(p => p ? { ...p, email_from: e.target.value } : p)}
                    placeholder="Alpha Ultimate ERP <noreply@alpha-ultimate.com>" />
                </div>
              </div>
            )}
          </div>

          {/* In-App */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>🔔 In-App Notifications</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: 2 }}>Bell icon notifications inside the ERP dashboard (always recommended)</div>
              </div>
              <div onClick={() => setSettings(p => p ? { ...p, inapp_enabled: !p.inapp_enabled } : p)}
                style={{
                  width: 44, height: 24, borderRadius: 12, transition: 'all 0.2s', cursor: 'pointer',
                  background: settings.inapp_enabled ? 'var(--blue)' : 'var(--border2)', position: 'relative',
                }}>
                <div style={{ position: 'absolute', top: 3, left: settings.inapp_enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div style={{ display: 'flex', gap: '1rem', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
          {/* Event list */}
          <div style={{ width: window.innerWidth < 768 ? '100%' : 200, flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.6rem', letterSpacing: '0.07em' }}>EVENTS</div>
            {EVENTS.map(evt => (
              <button key={evt.key} onClick={() => setActiveEvent(evt.key)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                  border: 'none', fontFamily: 'var(--font)', fontWeight: 600, fontSize: '0.8rem',
                  background: activeEvent === evt.key ? 'rgba(79,140,255,0.14)' : 'transparent',
                  color: activeEvent === evt.key ? 'var(--blue)' : 'var(--text2)',
                  borderLeft: `2px solid ${activeEvent === evt.key ? 'var(--blue)' : 'transparent'}`,
                  display: 'block', marginBottom: 2,
                }}>
                {evt.label}
              </button>
            ))}
          </div>

          {/* Template editor */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.4rem' }}>{currentEvent.label}</div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>AVAILABLE VARIABLES</div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {currentEvent.vars.map(v => (
                  <span key={v} style={{ padding: '0.1rem 0.5rem', background: 'rgba(79,140,255,0.12)', border: '1px solid rgba(79,140,255,0.3)', borderRadius: 20, fontSize: '0.65rem', color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>{v}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {settings.sms_enabled && (
                <div>
                  <label className="form-label">📱 SMS Template</label>
                  <textarea className="form-input" value={tmpl.sms || ''} onChange={e => updateTemplate(activeEvent, 'sms', e.target.value)} rows={3} style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} placeholder="SMS message template..." />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: (tmpl.sms || '').length > 160 ? '#ff3cac' : 'var(--muted)', marginTop: 2 }}>
                    {(tmpl.sms || '').length}/160 chars {(tmpl.sms || '').length > 160 && `— ${Math.ceil((tmpl.sms || '').length / 160)} SMS parts`}
                  </div>
                </div>
              )}

              {settings.whatsapp_enabled && (
                <div>
                  <label className="form-label">💬 WhatsApp Template</label>
                  <textarea className="form-input" value={tmpl.whatsapp || ''} onChange={e => updateTemplate(activeEvent, 'whatsapp', e.target.value)} rows={5} style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} placeholder="WhatsApp message (supports *bold*, _italic_, emojis)..." />
                </div>
              )}

              {settings.email_enabled && (
                <>
                  <div>
                    <label className="form-label">📧 Email Subject</label>
                    <input className="form-input" value={tmpl.email_subject || ''} onChange={e => updateTemplate(activeEvent, 'email_subject', e.target.value)} placeholder="Email subject line..." />
                  </div>
                  <div>
                    <label className="form-label">📧 Email Body</label>
                    <textarea className="form-input" value={tmpl.email_body || ''} onChange={e => updateTemplate(activeEvent, 'email_body', e.target.value)} rows={8} style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} placeholder="Email body text..." />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
