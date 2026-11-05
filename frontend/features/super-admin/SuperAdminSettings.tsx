'use client'

import { useEffect, useState } from 'react'
import { Check, Clock, RefreshCw, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react'
import styles from './super-admin-content.module.css'

interface ExtensionRecord {
  id: string
  user_id: string
  previous_duration_days: number
  new_duration_days: number
  additional_days: number
  config_version: string
  created_at: string
}

interface SettingsResponse {
  success: boolean
  trialDurationDays: number
  updatedAt: string | null
  updatedBy: string | null
  activeTrialsCount: number
  recentExtensions: ExtensionRecord[]
}

export default function SuperAdminSettings() {
  const [trialDuration, setTrialDuration] = useState<string>('7')
  const [currentSavedDuration, setCurrentSavedDuration] = useState<number>(7)
  const [activeTrialsCount, setActiveTrialsCount] = useState<number>(0)
  const [recentExtensions, setRecentExtensions] = useState<ExtensionRecord[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [extensionSummary, setExtensionSummary] = useState<{
    usersExtended: number
    additionalDays: number
  } | null>(null)

  // Fetch current settings on mount
  useEffect(() => {
    let cancelled = false
    async function loadSettings() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/super-admin/settings', { cache: 'no-store' })
        const data = await res.json() as SettingsResponse & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Gagal memuat pengaturan sistem.')

        if (!cancelled) {
          setTrialDuration(String(data.trialDurationDays ?? 7))
          setCurrentSavedDuration(data.trialDurationDays ?? 7)
          setActiveTrialsCount(data.activeTrialsCount ?? 0)
          setRecentExtensions(data.recentExtensions ?? [])
          setLastUpdated(data.updatedAt)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat pengaturan sistem.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSettings()
    return () => { cancelled = true }
  }, [])

  const handleSaveTrialDuration = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setExtensionSummary(null)

    const parsedDays = parseInt(trialDuration.trim(), 10)
    if (isNaN(parsedDays) || parsedDays <= 0 || !Number.isInteger(parsedDays)) {
      setError('Initial Trial Duration harus berupa bilangan bulat lebih dari 0.')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/super-admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trial_duration_days: parsedDays }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menyimpan pengaturan durasi trial.')

      setCurrentSavedDuration(parsedDays)
      setSuccessMessage(`Initial Trial Duration berhasil diperbarui menjadi ${parsedDays} hari.`)

      if (result.usersExtended > 0) {
        setExtensionSummary({
          usersExtended: result.usersExtended,
          additionalDays: result.additionalDays,
        })
      }

      // Refresh list
      const refreshRes = await fetch('/api/super-admin/settings', { cache: 'no-store' })
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()
        setRecentExtensions(refreshData.recentExtensions ?? [])
        setLastUpdated(refreshData.updatedAt ?? new Date().toISOString())
        setActiveTrialsCount(refreshData.activeTrialsCount ?? 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pengaturan.')
    } finally {
      setSaving(false)
    }
  }

  const dateFormat = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  })

  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>KONFIGURASI PLATFORM</span>
          <h1>Pengaturan Sistem</h1>
          <p>Kelola konfigurasi platform, kebijakan trial, dan parameter operasional sistem FLUXA.</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className={styles.errorBox} role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            style={{ minHeight: 28, padding: '0 8px', fontSize: 11 }}
            onClick={() => setError(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div style={{
          padding: '14px 16px',
          background: 'var(--oks)',
          border: '1px solid var(--ok)',
          borderRadius: 12,
          color: 'var(--ok)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <Check size={16} />
            <span>{successMessage}</span>
          </div>
          {extensionSummary && extensionSummary.usersExtended > 0 && (
            <div style={{ fontSize: 12, paddingLeft: 24, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} color="var(--ok)" aria-hidden="true" />
              <span><strong>{extensionSummary.usersExtended} akun Owner trial aktif</strong> telah diperpanjang otomatis sebesar <strong>+{extensionSummary.additionalDays} hari</strong> dari tanggal kedaluwarsa sebelumnya.</span>
            </div>
          )}
        </div>
      )}

      {/* Section: Initial Trial Configuration */}
      <div className={styles.panel} style={{ position: 'relative' }}>
        <div className={styles.panelHeading} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: 'var(--acc)' }} />
              Initial Trial Configuration
            </h2>
            <p style={{ marginTop: 4 }}>
              Atur durasi masa coba gratis (trial) awal untuk pendaftaran akun Owner baru di platform.
            </p>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--mute)'
          }}>
            Status Aktif: <strong style={{ color: 'var(--ink)' }}>{currentSavedDuration} Hari</strong>
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <span /><span /><span /><span />
          </div>
        ) : (
          <form onSubmit={handleSaveTrialDuration} style={{ display: 'grid', gap: 18, marginTop: 16 }}>
            <div style={{ maxWidth: 420 }}>
              <label
                htmlFor="initial-trial-duration"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  marginBottom: 6
                }}
              >
                Initial Trial Duration
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="initial-trial-duration"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={trialDuration}
                    onChange={e => setTrialDuration(e.target.value)}
                    placeholder="7"
                    disabled={saving}
                    className="input"
                    style={{
                      width: '100%',
                      paddingRight: 60,
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 12,
                    color: 'var(--mute)',
                    pointerEvents: 'none',
                    fontWeight: 600
                  }}>
                    Days
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={saving || !trialDuration || parseInt(trialDuration, 10) <= 0}
                  className={styles.primaryButton}
                  style={{ minWidth: 140 }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Simpan Pengaturan</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 8, lineHeight: 1.5 }}>
                Nilai aktif saat ini: <strong>{currentSavedDuration} hari</strong>.
                {lastUpdated && ` (Terakhir disimpan: ${dateFormat.format(new Date(lastUpdated))})`}
              </div>
            </div>

            {/* Rule Explanations / Info Box */}
            <div className={styles.infoBox} style={{ borderLeftColor: 'var(--acc)' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="var(--acc)" />
                Aturan Otomatis Perpanjangan Trial (Business Rules):
              </strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--mute)', fontSize: 11, lineHeight: 1.7 }}>
                <li><strong>Pendaftaran Baru:</strong> Otomatis memperoleh durasi trial aktif saat disetujui server ({currentSavedDuration} hari).</li>
                <li><strong>Kenaikan Durasi:</strong> Pengguna trial aktif ({activeTrialsCount} akun terdeteksi) akan otomatis menerima tambahan selisih hari pada tanggal kedaluwarsa mereka.</li>
                <li><strong>Penurunan Durasi:</strong> Mengurangi durasi tidak akan memotong atau mempersingkat masa trial pengguna yang sudah berjalan.</li>
                <li><strong>Pengecualian:</strong> Akun yang sudah kedaluwarsa atau telah berlangganan berbayar tidak akan menerima perpanjangan otomatis.</li>
              </ul>
            </div>
          </form>
        )}
      </div>

      {/* Extension History Snapshot Table */}
      {recentExtensions.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>Riwayat Perpanjangan Otomatis (Trial Extension History)</h2>
              <p>Log mutasi perpanjangan otomatis akibat perubahan konfigurasi durasi trial.</p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Perubahan Durasi</th>
                  <th>Tambahan Hari</th>
                  <th>ID Pengguna</th>
                  <th>Config Version / Batch</th>
                </tr>
              </thead>
              <tbody>
                {recentExtensions.slice(0, 8).map((record) => (
                  <tr key={record.id}>
                    <td>{dateFormat.format(new Date(record.created_at))}</td>
                    <td>
                      <span className={styles.badge} style={{ color: 'var(--ink)' }}>
                        {record.previous_duration_days} hari ➔ {record.new_duration_days} hari
                      </span>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ color: 'var(--ok)', background: 'var(--oks)', fontWeight: 700 }}>
                        +{record.additional_days} hari
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: 10, color: 'var(--mute)' }}>{record.user_id.slice(0, 8)}...</code>
                    </td>
                    <td>
                      <code style={{ fontSize: 10, color: 'var(--mute)' }}>{record.config_version ? `${record.config_version.slice(0, 8)}...` : '—'}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Informative Callout */}
      <div className={styles.callout}>
        <h2><ShieldCheck size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} /> Keamanan &amp; Audit Pengaturan</h2>
        <p>
          Konfigurasi durasi trial awal disimpan secara persisten di basis data sistem FLUXA. Setiap perubahan nilai dicatat secara mendalam pada sistem <strong>Audit Logs</strong> dengan metadata aktor, selisih hari, dan jumlah akun yang terpengaruh.
        </p>
        <p>
          Pengaturan trial per individu (perpanjangan khusus atau pengakhiran sepihak) tetap dapat dikontrol melalui menu <strong>Trial &amp; Langganan</strong>.
        </p>
      </div>
    </section>
  )
}
