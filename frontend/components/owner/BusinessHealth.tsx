'use client'

import { useState, useCallback } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Sparkles, RefreshCw, Key, CheckCircle, AlertTriangle, Bot, Activity, Layers, ArrowUpRight, Check, DollarSign, Calendar, Users, FileText } from 'lucide-react'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { PageHeader } from '@/components/layout/Topbar'
import { FinancialHealthInput, BusinessHealthDiagnosis } from '@intelligence/index'

interface Props {
  initialInput: FinancialHealthInput
  initialDiagnosis: BusinessHealthDiagnosis
  pastCheckups: any[]
}

// Markdown formatter yang rapi dan elegan untuk narasi AI Gemini
function FormattedAiNarration({ text }: { text: string }) {
  if (!text) return null

  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} style={{ height: 6 }} />

        // Heading 2
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} style={{
              fontSize: 17, fontWeight: 800, color: 'var(--ink)', margin: '14px 0 4px',
              borderBottom: '2px solid var(--line)', paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 8
            }}>
              {trimmed.replace('## ', '')}
            </h3>
          )
        }

        // Heading 3
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} style={{
              fontSize: 15, fontWeight: 700, color: 'var(--acc)', margin: '10px 0 2px'
            }}>
              {trimmed.replace('### ', '')}
            </h4>
          )
        }

        // Bullet point
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const content = trimmed.substring(2)
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingLeft: 4 }}>
              <span style={{ color: 'var(--acc)', fontWeight: 800, marginTop: 2 }}>•</span>
              <div dangerouslySetInnerHTML={{
                __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              }} />
            </div>
          )
        }

        // Numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s(.*)/)
          if (match) {
            return (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingLeft: 4 }}>
                <span style={{ color: 'var(--acc)', fontWeight: 800, minWidth: 20 }}>{match[1]}</span>
                <div dangerouslySetInnerHTML={{
                  __html: match[2].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }} />
              </div>
            )
          }
        }

        // Regular paragraph with bold support
        return (
          <p key={idx} style={{ margin: 0 }} dangerouslySetInnerHTML={{
            __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          }} />
        )
      })}
    </div>
  )
}

export default function BusinessHealthClient({
  initialInput,
  initialDiagnosis,
  pastCheckups
}: Props) {
  const CACHE_KEY = 'fluxa_ai_narration_cache'

  const [input] = useState<FinancialHealthInput>(initialInput)
  const [diagnosis, setDiagnosis] = useState<BusinessHealthDiagnosis>(initialDiagnosis)
  const [loading, setLoading] = useState(false)

  // Restore AI narration dari sessionStorage agar tidak hilang saat navigasi halaman
  const [aiNarration, setAiNarration] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          return parsed.narration || initialDiagnosis.ai_insights || initialDiagnosis.summary || ''
        } catch { /* ignore */ }
      }
    }
    return initialDiagnosis.ai_insights || initialDiagnosis.summary || ''
  })
  const [aiSource, setAiSource] = useState<'ai_llm' | 'heuristic_engine'>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        try { return JSON.parse(cached).source || 'heuristic_engine' } catch { /* ignore */ }
      }
    }
    return 'heuristic_engine'
  })
  const [aiModel, setAiModel] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        try { return JSON.parse(cached).model || null } catch { /* ignore */ }
      }
    }
    return null
  })
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fluxa_gemini_key') || ''
    }
    return ''
  })
  const [tempApiKey, setTempApiKey] = useState(apiKey)
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false)

  // Simpan ke sessionStorage setiap kali narasi/source/model berubah
  const persistCache = useCallback((narration: string, source: string, model: string | null) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ narration, source, model }))
    }
  }, [])

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault()
    setApiKey(tempApiKey.trim())
    if (typeof window !== 'undefined') {
      localStorage.setItem('fluxa_gemini_key', tempApiKey.trim())
    }
    setApiSaveSuccess(true)
    setTimeout(() => {
      setApiSaveSuccess(false)
      setApiKeyModalOpen(false)
    }, 1200)
  }

  const handleGenerate = async () => {
    // Hapus cache lama sebelum generate ulang
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CACHE_KEY)
    }
    setLoading(true)
    try {
      const res = await fetch('/api/business-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          apiKey: apiKey.trim() || undefined,
          saveToDb: true
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal generate diagnosis')

      if (data.data) {
        const newNarration = data.data.ai_insights || data.data.summary
        const newSource = data.data.source
        const newModel = data.data.model || null
        setDiagnosis(data.data)
        setAiNarration(newNarration)
        setAiSource(newSource)
        setAiModel(newModel)
        // Simpan ke cache agar tidak hilang saat navigasi
        persistCache(newNarration, newSource, newModel)
      }
    } catch (err: any) {
      console.error('Error generating AI checkup:', err)
      alert('Error memproses rapor AI: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const { metrics } = diagnosis
  const overallScore = metrics.health_score
  const dimensions = metrics.dimension_scores || []

  const radarData = dimensions.map(d => ({
    subject: d.dimension,
    score: d.score,
    fullMark: 100
  }))

  const scoreColor = (score: number) =>
    score >= 70 ? 'var(--ok)' : score >= 45 ? 'var(--warn)' : 'var(--bad)'

  return (
    <div>
      <PageHeader
        title="AI Business Health Checkup"
        subtitle="Diagnosis kesehatan finansial UMKM berbasis data transaksi riil kasir & Google Gemini AI"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                setTempApiKey(apiKey)
                setApiKeyModalOpen(true)
              }}
              className="btn btn-secondary"
              style={{ gap: 6 }}
            >
              <Key size={14} />
              {apiKey ? 'Ganti Gemini API Key' : 'Set Gemini API Key'}
            </button>

            <button
              id="generate-checkup-btn"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading}
              style={{ gap: 6 }}
            >
              {loading ? (
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Sparkles size={14} />
              )}
              {loading ? 'Menghubungkan ke Gemini AI...' : 'Generate Rapor AI (Live)'}
            </button>
          </div>
        }
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Banner Status Integrasi AI */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        gap: 12, padding: '12px 18px', background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 12, marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: aiSource === 'ai_llm' ? 'var(--oks)' : 'var(--accs)',
            color: aiSource === 'ai_llm' ? 'var(--ok)' : 'var(--acc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Bot size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              Engine Analisis: {aiSource === 'ai_llm' ? (aiModel || 'Google Gemini AI (Live API)') : 'Deterministic Financial Engine (Standar Akuntansi UMKM)'}
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                background: aiSource === 'ai_llm' ? 'var(--oks)' : 'var(--accs)',
                color: aiSource === 'ai_llm' ? 'var(--ok)' : 'var(--acc)'
              }}>
                {aiSource === 'ai_llm' ? '● Real AI Live' : '● Rule-Based Engine'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mute)' }}>
              Sumber data transaksi: Supabase DB ({input.period_start} s/d {input.period_end}) • Omzet: <FormatRupiah amount={input.revenue} /> • Piutang Riil: <FormatRupiah amount={input.receivables} />
            </div>
          </div>
        </div>

        <button
          id="re-analyze-btn"
          onClick={handleGenerate}
          disabled={loading}
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '5px 12px' }}
        >
          <RefreshCw size={12} /> Refresh Analisis AI
        </button>
      </div>

      {/* Skor Keseluruhan & Radar Chart 6 Dimensi */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 20 }}>
        {/* Gauge Score */}
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Skor Kesehatan Komposit</div>
          <div style={{
            width: 130, height: 130, borderRadius: '50%',
            background: `conic-gradient(${scoreColor(overallScore)} 0% ${overallScore}%, var(--line) ${overallScore}% 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ width: 104, height: 104, borderRadius: '50%', background: 'var(--panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: scoreColor(overallScore), lineHeight: 1 }}>{overallScore}</span>
              <span style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>/ 100</span>
            </div>
          </div>
          <StatusTag status={metrics.status.toLowerCase()} label={`STATUS ${metrics.status}`} />
          <p style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.5, maxWidth: 220, margin: 0 }}>
            {metrics.status === 'SEHAT'
              ? 'Bisnis memiliki margin positif dan cadangan kas memadai.'
              : metrics.status === 'WASPADA'
              ? 'Terdapat area berisiko tinggi yang perlu tindakan segera.'
              : 'Bisnis mengalami krisis likuiditas atau defisit operasional.'}
          </p>
        </div>

        {/* Radar Chart 6 Dimensi */}
        <SectionCard title="Radar 6 Dimensi Kesehatan Bisnis">
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#ECEEF4" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#7B8194', fontWeight: 600 }} />
                <Radar name="Skor" dataKey="score" stroke="#2F6BFF" fill="#2F6BFF" fillOpacity={0.25} />
                <Tooltip
                  formatter={(val: any) => [`${val}/100`, 'Skor']}
                  contentStyle={{ background: '#fff', borderRadius: 8, border: '1px solid #ECEEF4', fontSize: 12 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Narasi AI Gemini / Advisor Eksekutif */}
      <div style={{ marginBottom: 20 }}>
        <SectionCard
          title={aiSource === 'ai_llm' ? `Analisis Eksekutif dari ${aiModel || 'Gemini AI'}` : 'Diagnosis Finansial Eksekutif'}
          action={
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
              background: aiSource === 'ai_llm' ? 'var(--oks)' : 'var(--bg)',
              color: aiSource === 'ai_llm' ? 'var(--ok)' : 'var(--ink)'
            }}>
              {aiSource === 'ai_llm' ? '✓ Terverifikasi AI Gemini Live' : 'Rule Engine'}
            </span>
          }
        >
          {/* FluxAI Intro Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0f1a3e 0%, #1a2d6b 45%, #0d3b6e 100%)',
            borderRadius: 14, padding: '20px 24px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 18, position: 'relative', overflow: 'hidden'
          }}>
            {/* Decorative glow blobs */}
            <div style={{
              position: 'absolute', top: -30, right: -30, width: 120, height: 120,
              borderRadius: '50%', background: 'rgba(47,107,255,0.25)', filter: 'blur(40px)', pointerEvents: 'none'
            }} />
            <div style={{
              position: 'absolute', bottom: -20, left: '40%', width: 80, height: 80,
              borderRadius: '50%', background: 'rgba(99,179,237,0.15)', filter: 'blur(28px)', pointerEvents: 'none'
            }} />

            {/* Avatar icon */}
            <div style={{
              width: 54, height: 54, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(135deg, #2F6BFF, #63b3ed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(47,107,255,0.55)'
            }}>
              <Bot size={26} color="#fff" />
            </div>

            {/* Text */}
            <div style={{ zIndex: 1 }}>
              <div style={{
                fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px',
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
              }}>
                Halo, saya{' '}
                <span style={{
                  background: 'linear-gradient(90deg, #63b3ed, #90cdf4, #63b3ed)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text', fontWeight: 900
                }}>
                  FluxAI
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: 0 }}>
                  — AI Business Health Checkup
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.5 }}>
                Saya menganalisis data keuangan toko Anda secara real-time dari database
                dan menyajikan diagnosis bisnis yang terukur, konkret, dan bebas rekayasa.
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg)', borderRadius: 12, padding: '20px 24px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <FormattedAiNarration text={aiNarration} />
          </div>
        </SectionCard>
      </div>

      {/* Audit Data Konkret dari Database (Bukti Transparansi) */}
      <div style={{ marginBottom: 20 }}>
        <SectionCard title="Audit Bukti Database: Rincian Piutang / Kasbon & Beban Riil yang Dianalisis AI">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginTop: 10 }}>
            {/* Tabel Piutang Riil */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={15} color="var(--warn)" />
                Kasbon / Piutang Pelanggan di Database ({input.receivable_details?.length || 0})
              </div>
              <div className="table-container">
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Pelanggan</th>
                      <th>Tgl Buat</th>
                      <th>Jatuh Tempo</th>
                      <th>Sisa Tagihan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {input.receivable_details && input.receivable_details.length > 0 ? (
                      input.receivable_details.map((r, i) => {
                        const isOverdue = r.due_date && new Date(r.due_date) < new Date()
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                            <td style={{ color: 'var(--mute)' }}>{r.created_at.split('T')[0]}</td>
                            <td style={{ color: isOverdue ? 'var(--bad)' : 'var(--ink)', fontWeight: isOverdue ? 700 : 400 }}>
                              {r.due_date || '-'} {isOverdue && <span style={{ color: 'var(--bad)', fontSize: 10 }}>[LEWAT]</span>}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--warn)' }}>
                              <FormatRupiah amount={r.remaining_amount} />
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--mute)' }}>Tidak ada piutang</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabel Biaya Riil */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={15} color="var(--bad)" />
                Beban Operasional di Database ({input.expense_details?.length || 0})
              </div>
              <div className="table-container">
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Deskripsi Pos</th>
                      <th>Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {input.expense_details && input.expense_details.length > 0 ? (
                      input.expense_details.map((e, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--mute)' }}>{e.expense_date}</td>
                          <td style={{ fontWeight: 600 }}>{e.description}</td>
                          <td style={{ fontWeight: 700, color: 'var(--bad)' }}>
                            <FormatRupiah amount={e.amount} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--mute)' }}>Tidak ada biaya</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Rincian Evaluasi 6 Dimensi */}
      <SectionCard title="Evaluasi Dimensi & Rencana Aksi Prioritas">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {dimensions.map(dim => (
            <div
              key={dim.dimension}
              style={{
                border: '1px solid var(--line)', borderRadius: 12, padding: 16,
                background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: 8
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{dim.dimension}</span>
                <span style={{
                  fontWeight: 800, fontSize: 14, color: scoreColor(dim.score),
                  background: 'var(--bg)', padding: '2px 8px', borderRadius: 6
                }}>
                  {dim.score} / 100
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, width: '100%', background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${dim.score}%`,
                  background: scoreColor(dim.score), borderRadius: 3
                }} />
              </div>

              <div style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.5, marginTop: 4 }}>
                <strong>Penyebab:</strong> {dim.cause}
              </div>

              <div style={{
                fontSize: 12, color: 'var(--ink)', background: 'var(--bg)',
                padding: '8px 10px', borderRadius: 8, marginTop: 'auto', borderLeft: `3px solid ${scoreColor(dim.score)}`
              }}>
                <strong>Aksi:</strong> {dim.action}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Modal Pengaturan Gemini API Key */}
      {apiKeyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={18} color="var(--acc)" /> Konfigurasi Google Gemini API Key
              </h3>
              <button onClick={() => setApiKeyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5, marginBottom: 14 }}>
              Masukkan Google Gemini API Key Anda. API key disimpan secara aman di browser lokal Anda serta di <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 4 }}>.env.local</code> sebagai <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 4 }}>GEMINI_API_KEY</code>.
            </p>

            <form onSubmit={handleSaveApiKey}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Gemini API Key:
                </label>
                <input
                  type="password"
                  placeholder="AQ.Ab8..."
                  value={tempApiKey}
                  onChange={e => setTempApiKey(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)',
                    fontSize: 13, outline: 'none', fontFamily: 'monospace'
                  }}
                />
              </div>

              {apiSaveSuccess && (
                <div style={{
                  padding: '8px 12px', background: 'var(--oks)', color: 'var(--ok)',
                  borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <Check size={14} /> API Key berhasil disimpan!
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setApiKeyModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Simpan & Terapkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
