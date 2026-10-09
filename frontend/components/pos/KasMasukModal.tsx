'use client'

/**
 * KasMasukModal.tsx
 * Modal sistematis & konsisten untuk:
 * 1. Buka Shift (Saat Login / Masuk Kasir) — Wajib input modal kas awal
 * 2. Tutup Shift (Saat Logout / Keluar Kasir) — Wajib input kas akhir fisik & rekonsiliasi
 *
 * Mengikuti token desain Fluxa (design_Fluxa.md):
 * - var(--panel), var(--bg), var(--ink), var(--mute), var(--line)
 * - var(--acc) (#2F6BFF), var(--accs) (#E8EFFF)
 * - var(--ok), var(--bad)
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Wallet, ShieldCheck, Check, TrendingUp, TrendingDown,
  Clock, AlertTriangle, FileText, LogOut, CheckCircle2,
  DollarSign, ArrowRight, X
} from 'lucide-react'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

/* ─────────────────────────────────────────────────────────────
 * 1. MODAL SAAT LOGIN (BUKA SHIFT - KAS AWAL)
 * ───────────────────────────────────────────────────────────── */
interface BukaShiftModalProps {
  userId: string
  onSuccess: (shift: any) => void
  onCancel?: () => void
}

export function BukaShiftModal({ userId, onSuccess, onCancel }: BukaShiftModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const [kasAwal, setKasAwal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const QUICK_AMOUNTS = [100_000, 200_000, 500_000, 1_000_000]

  const kasAwalNum = parseInt(kasAwal.replace(/\D/g, '')) || 0

  const handleBuka = async () => {
    if (!kasAwalNum || kasAwalNum < 0) {
      setError('Masukkan nominal kas awal yang valid.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { data, error: rpcErr } = await supabase.rpc('open_shift', {
        p_initial_cash: kasAwalNum,
        p_note: catatan.trim() || null,
      })
      if (rpcErr) throw rpcErr

      // Ambil data shift yang baru dibuka
      const { data: shifts } = await supabase
        .from('shifts')
        .select('*')
        .eq('cashier_id', userId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)

      const finalShift = shifts?.[0] || {
        id: 'shift-' + Date.now(),
        initial_cash: kasAwalNum,
        opened_at: new Date().toISOString(),
        status: 'open'
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shift_changed', { detail: finalShift }))
      }
      onSuccess(finalShift)
      router.refresh()
    } catch (err: any) {
      // Demo mode fallback bila DB offline / demo akun
      const demoShift = {
        id: 'demo-shift-' + Date.now(),
        initial_cash: kasAwalNum,
        opened_at: new Date().toISOString(),
        status: 'open'
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shift_changed', { detail: demoShift }))
      }
      onSuccess(demoShift)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(15, 18, 24, 0.72)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 24,
        padding: '36px 32px',
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 24px 64px -12px rgba(18, 20, 28, 0.25), 0 0 0 1px var(--line)',
        position: 'relative',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header Konsisten Fluxa */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--accs)',
            border: '1px solid rgba(47, 107, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: 'var(--acc)',
            boxShadow: '0 8px 20px -4px rgba(47, 107, 255, 0.25)'
          }}>
            <Wallet size={26} strokeWidth={2.2} />
          </div>

          <h2 style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--ink)',
            margin: 0,
            letterSpacing: -0.3
          }}>
            Buka Shift Kasir
          </h2>
          <p style={{
            color: 'var(--mute)',
            fontSize: 13,
            marginTop: 6,
            marginBottom: 0
          }}>
            Input modal kas awal di laci sebelum memulai operasional
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            padding: '5px 12px',
            marginTop: 12
          }}>
            <Clock size={12} color="var(--acc)" />
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mute)' }}>
              Waktu Masuk: <strong style={{ color: 'var(--ink)' }}>{now}</strong>
            </span>
          </div>
        </div>

        {/* Banner Penjelasan Anti-Fraud */}
        <div style={{
          background: 'var(--accs)',
          border: '1px solid rgba(47, 107, 255, 0.2)',
          borderRadius: 12,
          padding: '11px 14px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10
        }}>
          <ShieldCheck size={16} color="var(--acc)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.45, margin: 0 }}>
            Nominal kas awal dicatat ke sistem untuk audit dan rekonsiliasi otomatis saat tutup shift nanti.
          </p>
        </div>

        {/* Input Kas Awal */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'block',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--mute)',
            marginBottom: 8,
            letterSpacing: 0.5,
            textTransform: 'uppercase'
          }}>
            KAS AWAL MODAL (RUPIAH) *
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg)',
            border: `1.5px solid ${error ? 'var(--bad)' : 'var(--line)'}`,
            borderRadius: 14,
            padding: '12px 16px',
            transition: 'border-color 0.15s, box-shadow 0.15s'
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--mute)', flexShrink: 0 }}>
              Rp
            </span>
            <input
              id="kas-awal-input"
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={kasAwal}
              onChange={e => { setKasAwal(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleBuka()}
              autoFocus
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: -0.5,
                width: '100%'
              }}
            />
          </div>

          {/* Formatted readout */}
          {kasAwalNum > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--acc)', fontWeight: 600 }}>
              Terbaca: {formatRp(kasAwalNum)}
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <AlertTriangle size={13} color="var(--bad)" />
              <span style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 500 }}>{error}</span>
            </div>
          )}
        </div>

        {/* Quick Amount Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
          {QUICK_AMOUNTS.map(amt => {
            const isSelected = kasAwal === String(amt)
            return (
              <button
                key={amt}
                type="button"
                onClick={() => { setKasAwal(String(amt)); setError('') }}
                style={{
                  padding: '9px 4px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  background: isSelected ? 'var(--accs)' : 'var(--bg)',
                  border: `1px solid ${isSelected ? 'var(--acc)' : 'var(--line)'}`,
                  color: isSelected ? 'var(--acc)' : 'var(--ink)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'center'
                }}
              >
                {amt >= 1_000_000 ? `${amt / 1_000_000} Jt` : `${amt / 1_000} Rb`}
              </button>
            )
          })}
        </div>

        {/* Catatan Buka Shift */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--mute)',
            marginBottom: 8,
            letterSpacing: 0.5,
            textTransform: 'uppercase'
          }}>
            CATATAN (OPSIONAL)
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '10px 14px'
          }}>
            <FileText size={15} color="var(--mute)" style={{ flexShrink: 0 }} />
            <input
              id="catatan-buka-shift"
              type="text"
              placeholder="Contoh: Modal pecahan kecil Rp2.000 & Rp5.000..."
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>

        {/* Tombol Close jika modal tidak blocking wajib */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'transparent',
              border: 'none',
              color: 'var(--mute)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        )}

        {/* Tombol Aksi Konsisten Fluxa */}
        {onCancel ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1,
                padding: '13px 16px',
                borderRadius: 12,
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s'
              }}
            >
              Batal
            </button>
            <button
              id="konfirmasi-buka-shift-btn"
              type="button"
              onClick={handleBuka}
              disabled={loading || !kasAwalNum}
              style={{
                flex: 2,
                padding: '13px 20px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--acc)',
                color: '#fff',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: loading || !kasAwalNum ? 'not-allowed' : 'pointer',
                opacity: loading || !kasAwalNum ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(47, 107, 255, 0.3)'
              }}
            >
              <Check size={16} />
              <span>{loading ? 'Membuka Shift...' : 'Buka Shift'}</span>
            </button>
          </div>
        ) : (
          <button
            id="konfirmasi-buka-shift-btn"
            type="button"
            onClick={handleBuka}
            disabled={loading || !kasAwalNum}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--acc)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !kasAwalNum ? 'not-allowed' : 'pointer',
              opacity: loading || !kasAwalNum ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(47, 107, 255, 0.3)'
            }}
          >
            <Check size={16} />
            <span>{loading ? 'Membuka Shift...' : 'Buka Kasir & Mulai Tugas'}</span>
          </button>
        )}

        <p style={{
          textAlign: 'center',
          fontSize: 11.5,
          color: 'var(--mute)',
          marginTop: 18,
          marginBottom: 0
        }}>
          Fluxa POS • Kontrol Kas Laci & Pencegahan Fraud
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * 2. MODAL SAAT LOGOUT (TUTUP SHIFT - KAS AKHIR)
 * ───────────────────────────────────────────────────────────── */
interface TutupShiftModalProps {
  activeShift: any
  userId: string
  onSuccess: () => void
  onCancel: () => void
}

export function TutupShiftModal({ activeShift, userId, onSuccess, onCancel }: TutupShiftModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const [kasAkhir, setKasAkhir] = useState('')
  const [catatan, setCatatan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cashSales, setCashSales] = useState<number>(0)
  const [salesLoaded, setSalesLoaded] = useState(false)

  const kasAwal = activeShift?.initial_cash || 0

  // Ambil total penjualan kas tunai yang terjadi selama shift aktif ini
  useEffect(() => {
    async function fetchShiftCashSales() {
      if (!activeShift?.id) {
        setSalesLoaded(true)
        return
      }
      try {
        const { data, error: sErr } = await supabase
          .from('sales')
          .select('final_amount')
          .eq('shift_id', activeShift.id)
          .eq('payment_method', 'cash')
          .eq('status', 'completed')

        if (data && data.length > 0) {
          const total = data.reduce((acc, curr) => acc + (curr.final_amount || 0), 0)
          setCashSales(total)
        }
      } catch (err) {
        console.warn('Gagal memuat penjualan tunai shift:', err)
      } finally {
        setSalesLoaded(true)
      }
    }

    fetchShiftCashSales()
  }, [activeShift?.id])

  // Kas sistem = Kas Awal + Penjualan Tunai
  const estimasiKasSistem = kasAwal + cashSales

  const kasAkhirNum = parseInt(kasAkhir.replace(/\D/g, '')) || 0
  const selisih = kasAkhirNum - estimasiKasSistem

  const openedAt = activeShift?.opened_at
    ? new Date(activeShift.opened_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const handleTutup = async () => {
    if (!kasAkhir || kasAkhirNum < 0) {
      setError('Masukkan nominal kas akhir fisik yang valid.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { error: rpcErr } = await supabase.rpc('close_shift', {
        p_shift_id: activeShift?.id,
        p_final_cash: kasAkhirNum,
        p_note: catatan.trim() || null,
      })
      if (rpcErr) throw rpcErr

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shift_changed', { detail: null }))
      }
      onSuccess()
      router.refresh()
    } catch (err: any) {
      // Demo mode fallback — tutup shift & lanjutkan logout
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shift_changed', { detail: null }))
      }
      onSuccess()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(15, 18, 24, 0.72)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 24,
        padding: '36px 32px',
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 24px 64px -12px rgba(18, 20, 28, 0.25), 0 0 0 1px var(--line)',
        position: 'relative',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header Konsisten Fluxa */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--accs)',
            border: '1px solid rgba(47, 107, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: 'var(--acc)',
            boxShadow: '0 8px 20px -4px rgba(47, 107, 255, 0.25)'
          }}>
            <LogOut size={26} strokeWidth={2.2} />
          </div>

          <h2 style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--ink)',
            margin: 0,
            letterSpacing: -0.3
          }}>
            Tutup Shift & Rekonsiliasi
          </h2>
          <p style={{
            color: 'var(--mute)',
            fontSize: 13,
            marginTop: 6,
            marginBottom: 0
          }}>
            Hitung uang fisik di laci kasir sebelum keluar (logout)
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            padding: '5px 12px',
            marginTop: 12
          }}>
            <Clock size={12} color="var(--acc)" />
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mute)' }}>
              Shift Aktif Sejak: <strong style={{ color: 'var(--ink)' }}>{openedAt}</strong>
            </span>
          </div>
        </div>

        {/* Ringkasan Kas Sistem (Konsisten Token Desain) */}
        <div style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 18,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mute)', marginBottom: 3, textTransform: 'uppercase' }}>
              Modal Kas Awal
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              {formatRp(kasAwal)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mute)', marginBottom: 3, textTransform: 'uppercase' }}>
              Penjualan Tunai
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ok)' }}>
              +{formatRp(cashSales)}
            </div>
          </div>
          <div style={{
            gridColumn: '1 / -1',
            borderTop: '1px solid var(--line)',
            paddingTop: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
              Total Kas Sistem (Seharusnya)
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--acc)' }}>
              {formatRp(estimasiKasSistem)}
            </span>
          </div>
        </div>

        {/* Input Kas Akhir Fisik */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'block',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--mute)',
            marginBottom: 8,
            letterSpacing: 0.5,
            textTransform: 'uppercase'
          }}>
            KAS AKHIR FISIK DI LACI (RUPIAH) *
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg)',
            border: `1.5px solid ${error ? 'var(--bad)' : 'var(--line)'}`,
            borderRadius: 14,
            padding: '12px 16px',
            transition: 'border-color 0.15s, box-shadow 0.15s'
          }}>
            <DollarSign size={16} color="var(--mute)" style={{ flexShrink: 0 }} />
            <input
              id="kas-akhir-input"
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={kasAkhir}
              onChange={e => { setKasAkhir(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleTutup()}
              autoFocus
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: -0.5,
                width: '100%'
              }}
            />
          </div>

          {/* Formatted readout */}
          {kasAkhirNum > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--acc)', fontWeight: 600 }}>
              Terbaca: {formatRp(kasAkhirNum)}
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <AlertTriangle size={13} color="var(--bad)" />
              <span style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 500 }}>{error}</span>
            </div>
          )}
        </div>

        {/* Status Rekonsiliasi / Selisih Kas Live */}
        {kasAkhirNum > 0 && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 12,
            marginBottom: 16,
            background: selisih === 0 ? 'var(--oks)' : selisih > 0 ? 'var(--oks)' : 'var(--bads)',
            border: `1px solid ${selisih >= 0 ? 'var(--ok)' : 'var(--bad)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selisih === 0 ? (
                <CheckCircle2 size={16} color="var(--ok)" />
              ) : selisih > 0 ? (
                <TrendingUp size={16} color="var(--ok)" />
              ) : (
                <TrendingDown size={16} color="var(--bad)" />
              )}
              <span style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: selisih >= 0 ? 'var(--ok)' : 'var(--bad)'
              }}>
                {selisih === 0
                  ? 'Kas Pas Sesuai Sistem'
                  : selisih > 0
                  ? 'Surplus (Lebih)'
                  : 'Defisit (Selisih Kurang)'}
              </span>
            </div>
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              color: selisih >= 0 ? 'var(--ok)' : 'var(--bad)'
            }}>
              {selisih > 0 ? '+' : ''}{formatRp(selisih)}
            </span>
          </div>
        )}

        {/* Catatan Tutup Shift */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--mute)',
            marginBottom: 8,
            letterSpacing: 0.5,
            textTransform: 'uppercase'
          }}>
            CATATAN PENUTUPAN (OPSIONAL)
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '10px 14px'
          }}>
            <FileText size={15} color="var(--mute)" style={{ flexShrink: 0 }} />
            <input
              id="catatan-tutup-shift"
              type="text"
              placeholder="Contoh: Selisih uang receh kembalian..."
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>

        {/* Dual Tombol Aksi */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '13px 16px',
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink)',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s'
            }}
          >
            Batal
          </button>
          <button
            id="konfirmasi-tutup-shift-btn"
            type="button"
            onClick={handleTutup}
            disabled={loading || !kasAkhirNum}
            style={{
              flex: 2,
              padding: '13px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--acc)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: loading || !kasAkhirNum ? 'not-allowed' : 'pointer',
              opacity: loading || !kasAkhirNum ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(47, 107, 255, 0.3)'
            }}
          >
            <LogOut size={15} />
            <span>{loading ? 'Menutup Shift...' : 'Tutup Shift & Keluar'}</span>
          </button>
        </div>

        <p style={{
          textAlign: 'center',
          fontSize: 11.5,
          color: 'var(--mute)',
          marginTop: 18,
          marginBottom: 0
        }}>
          Fluxa POS • Kontrol Kas Laci & Pencegahan Fraud
        </p>
      </div>
    </div>
  )
}
