// src/components/erp/CameraUploadForm.tsx — Alpha ERP v12
// Supports Cloudflare R2 (primary) + ImgBB (fallback) via /api/uploads/imgbb
import { useRef, useState, ChangeEvent } from 'react'
import { api } from '../../lib/api'

interface UploadedFile { id: string; name: string; url: string; thumb_url?: string; type: string }
interface Props { entityType?: string; entityId?: string; onUploaded?: (files: UploadedFile[]) => void }

const MAX_MB = 32
const TOT_MB = 100

export default function CameraUploadForm({ entityType, entityId, onUploaded }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [staged,    setStaged]    = useState<{ name: string; size: number; dataUrl: string; type: string }[]>([])
  const [uploaded,  setUploaded]  = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    setError('')
    const files = Array.from(e.target.files ?? []) as File[]
    if (!files.length) return

    let totalMB = staged.reduce((a, f) => a + f.size / 1024 / 1024, 0)
    const toAdd: typeof staged = []

    for (const f of files) {
      const mb = f.size / 1024 / 1024
      if (mb > MAX_MB) { setError(`"${f.name}" exceeds ${MAX_MB} MB.`); return }
      if (totalMB + mb > TOT_MB) { setError(`Total exceeds ${TOT_MB} MB.`); return }
      totalMB += mb
      toAdd.push({ name: f.name, size: f.size, dataUrl: '', type: f.type })

      const reader = new FileReader()
      const idx = staged.length + toAdd.length - 1
      reader.onload = () => {
        setStaged(p => {
          const copy = [...p]
          if (copy[idx]) copy[idx] = { ...copy[idx], dataUrl: reader.result as string }
          return copy
        })
      }
      reader.readAsDataURL(f)
    }
    setStaged(p => [...p, ...toAdd])
    if (ref.current) ref.current.value = ''
  }

  async function upload() {
    const ready = staged.filter(f => f.dataUrl)
    if (!ready.length) { setError('Files still loading — please wait.'); return }
    setError(''); setSuccess(''); setUploading(true); setProgress(0)
    try {
      const result = await api.post<{ uploaded: UploadedFile[]; count: number; storage?: string }>(
        '/uploads/imgbb',
        {
          files: ready.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            data: f.dataUrl.split(',')[1],
          })),
          entity_type: entityType,
          entity_id:   entityId,
        }
      )
      setUploaded(p => [...p, ...result.uploaded])
      setStaged([])
      const storageLabel = result.storage === 'r2' ? 'Cloudflare R2' : 'ImgBB'
      setSuccess(`${result.count} file(s) uploaded to ${storageLabel}.`)
      onUploaded?.(result.uploaded)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

  return (
    <div>
      <input
        ref={ref} id="cam-upload" type="file"
        accept="image/*,video/*,.pdf,.docx,.xlsx,.csv,.txt,.zip,.rar"
        multiple
        onChange={onFiles}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <label htmlFor="cam-upload" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          📎 Choose Files / Photos
        </label>
        <label
          onClick={() => {
            if (ref.current) {
              ref.current.setAttribute('capture', 'environment')
              ref.current.click()
            }
          }}
          className="btn btn-secondary"
          style={{ cursor: 'pointer' }}
        >
          📷 Camera
        </label>
        {staged.length > 0 && (
          <button
            className="btn btn-primary"
            onClick={upload}
            disabled={uploading || staged.some(f => !f.dataUrl)}
          >
            {uploading ? `Uploading… ${progress > 0 ? progress + '%' : ''}` : `⬆ Upload ${staged.length} file${staged.length > 1 ? 's' : ''}`}
          </button>
        )}
        {staged.length > 0 && !uploading && (
          <button className="btn btn-danger btn-sm" onClick={() => setStaged([])}>Clear</button>
        )}
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '0 0 0.75rem' }}>
        Max {MAX_MB} MB per file · {TOT_MB} MB total · All file types supported
      </p>

      {error   && <div className="alert-error"  style={{ marginBottom: '0.75rem' }}>{error}</div>}
      {success && <div className="alert-success" style={{ marginBottom: '0.75rem' }}>{success}</div>}

      {/* Staged previews */}
      {staged.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Staged for upload
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            {staged.map((f, i) => (
              <div key={i} style={{ position: 'relative', width: 86 }}>
                {f.dataUrl && f.type.startsWith('image/') ? (
                  <img src={f.dataUrl} alt={f.name}
                    style={{ width: 86, height: 86, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 86, height: 86, background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '1.6rem' }}>
                      {f.type.includes('pdf') ? '📄' : f.type.includes('video') ? '🎥' : f.type.includes('zip') ? '🗜️' : '📎'}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text2)', textAlign: 'center', padding: '0 4px', wordBreak: 'break-all', marginTop: '0.2rem' }}>
                      {f.name.length > 12 ? f.name.slice(0, 10) + '…' : f.name}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textAlign: 'center', marginTop: '0.2rem' }}>{fmtSize(f.size)}</div>
                <button
                  onClick={() => setStaged(p => p.filter((_, idx) => idx !== i))}
                  style={{ position: 'absolute', top: -5, right: -5, background: 'var(--error)', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded files */}
      {uploaded.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Uploaded ({uploaded.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            {uploaded.map((u, i) => (
              <a key={i} href={u.url} target="_blank" rel="noreferrer" title={u.name} style={{ textDecoration: 'none' }}>
                {u.thumb_url && u.type?.startsWith('image/') ? (
                  <img src={u.thumb_url} alt={u.name}
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,212,255,0.35)' }} />
                ) : (
                  <div style={{ width: 80, height: 80, background: 'var(--card)', borderRadius: 8, border: '1px solid rgba(0,212,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                    {u.type?.includes('pdf') ? '📄' : u.type?.includes('video') ? '🎥' : '📎'}
                  </div>
                )}
                <div style={{ fontSize: '0.6rem', color: 'var(--cyan)', textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.2rem' }}>{u.name}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
