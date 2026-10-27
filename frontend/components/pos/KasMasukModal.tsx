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
import { getUserFacingError } from '@/lib/user-facing-error'
import {
  Wallet, ShieldCheck, Check, TrendingUp, TrendingDown,
  Clock, AlertTriangle, FileText, LogOut, CheckCircle2,
  DollarSign, ArrowRight, X, Plus, ChevronUp, ChevronDown,
  Tag, UploadCloud, RefreshCw, Loader2, User
} from 'lucide-react'
import { cleanUUID, submitCashierExpense, fetchShiftExpenses } from '@/lib/cash-reconciliation'

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

export function BukaShiftModal({ onSuccess, onCancel }: BukaShiftModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const [kasAwal, setKasAwal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const QUICK_AMOUNTS = [0, 100_000, 200_000, 500_000, 1_000_000]

  const hasInvalidLeadingZero = /^0\d+/.test(kasAwal.trim())
  const isValidKasAwal = kasAwal.trim() !== '' && !hasInvalidLeadingZero && /^\d+$/.test(kasAwal.trim())
  const kasAwalNum = isValidKasAwal ? parseInt(kasAwal.trim(), 10) : 0

  const handleKasAwalChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '')

    if (cleaned === '') {
      setKasAwal('')
      setError('')
      return
    }

    // Jika nilai sebelumnya '0' dan kasir mengetik angka di belakang '0' (contoh: ketik 8 jadi 08)
    if (kasAwal === '0') {
      if (cleaned === '00') return
      setError('Tidak boleh ada angka di belakang angka 0 (contoh: 08889). Hapus angka 0 terlebih dahulu untuk menginput nominal lain.')
      return
    }

    // Cek jika diawali 0 diikuti digit lain (contoh: '08889' dari paste/ketik cepat)
    if (/^0\d+/.test(cleaned)) {
      setKasAwal(cleaned)
      setError('Tidak boleh ada angka di belakang angka 0 (contoh: 08889). Silakan hapus angka 0 di depan atau masukkan 0 saja.')
      return
    }

    setKasAwal(cleaned)
    setError('')
  }

  const handleBuka = async () => {
    if (!kasAwal.trim()) {
      setError('Masukkan nominal kas awal modal.')
      return
    }
    if (hasInvalidLeadingZero) {
      setError('Tidak boleh ada angka di belakang angka 0 (contoh: 08889). Masukkan nominal 0 atau nominal tanpa awalan 0.')
      return
    }
    if (!isValidKasAwal || kasAwalNum < 0) {
      setError('Masukkan nominal kas awal yang valid.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const notePayload = catatan.trim() ? `[Pembukaan]: ${catatan.trim()}` : null
      const { data: shiftId, error: rpcErr } = await supabase.rpc('open_shift', {
        p_initial_cash: kasAwalNum,
        p_note: notePayload,
      })
      if (rpcErr) throw rpcErr

      // Ambil data shift yang baru dibuka
      if (!shiftId) throw new Error('Database tidak mengembalikan ID shift.')
      const { data: finalShift, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .single()
      if (shiftError) throw shiftError
      if (!finalShift) throw new Error('Shift berhasil dibuka tetapi datanya gagal dimuat.')

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shift_changed', { detail: finalShift }))
      }
      onSuccess(finalShift)
      router.refresh()
    } catch (err) {
      setError(getUserFacingError(err, 'Shift belum dapat dibuka. Periksa kembali nominal kas awal dan coba lagi.'))
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
        padding: 'clamp(20px, 5vw, 36px) clamp(16px, 5vw, 32px)',
        width: '100%',
        maxWidth: 480,
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
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
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={kasAwal}
              onChange={e => handleKasAwalChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && isValidKasAwal && handleBuka()}
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
          {isValidKasAwal && (
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: 8, marginBottom: 18 }}>
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
                {amt === 0 ? 'Rp0' : amt >= 1_000_000 ? `${amt / 1_000_000} Jt` : `${amt / 1_000} Rb`}
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
            CATATAN PEMBUKAAN (OPSIONAL)
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
              disabled={loading || !isValidKasAwal}
              style={{
                flex: 2,
                padding: '13px 20px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--acc)',
                color: '#fff',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: loading || !isValidKasAwal ? 'not-allowed' : 'pointer',
                opacity: loading || !isValidKasAwal ? 0.5 : 1,
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
            disabled={loading || !isValidKasAwal}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--acc)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !isValidKasAwal ? 'not-allowed' : 'pointer',
              opacity: loading || !isValidKasAwal ? 0.5 : 1,
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
  const [activeUserId, setActiveUserId] = useState<string>(userId || activeShift?.cashier_id || '')
  const [cashierName, setCashierName] = useState<string>('')
  const [kasAkhir, setKasAkhir] = useState('')
  const [catatan, setCatatan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cashSales, setCashSales] = useState<number>(0)
  const [nonCashSales, setNonCashSales] = useState<number>(0)
  const [salesCount, setSalesCount] = useState<number>(0)
  const [salesLoaded, setSalesLoaded] = useState(false)
  const [shiftExpenses, setShiftExpenses] = useState<number>(0)
  const [expensesCount, setExpensesCount] = useState<number>(0)

  const kasAwal = activeShift?.initial_cash || 0

  // Resolve user id & nama penginput (Siapa yang mencatat pengeluaran)
  useEffect(() => {
    async function resolveCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id || activeUserId || userId || activeShift?.cashier_id
        if (user?.id && !activeUserId) setActiveUserId(user.id)
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', uid)
            .single()
          if (prof?.full_name) {
            setCashierName(prof.full_name)
          } else if (prof?.email || user?.email) {
            setCashierName(prof?.email || user?.email || 'Kasir')
          }
        }
      } catch {
        setCashierName('Kasir')
      }
    }
    void resolveCurrentUser()
  }, [activeUserId, userId, activeShift?.cashier_id, supabase])

  // State Form Pengeluaran Inline (UIUX-FORM-PENGELUARAN.md)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseCashImpact, setExpenseCashImpact] = useState(true)
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoriesError, setCategoriesError] = useState('')
  const [submittingExpense, setSubmittingExpense] = useState(false)
  const [expenseError, setExpenseError] = useState('')
  const [expenseSuccessMsg, setExpenseSuccessMsg] = useState('')

  // Ambil daftar kategori dari sumber data yang sama dengan modul Pengeluaran Admin (expense_categories)
  const fetchCategories = async () => {
    setLoadingCategories(true)
    setCategoriesError('')
    try {
      // 1. Coba query langsung dari Supabase
      const { data, error: catErr } = await supabase
        .from('expense_categories')
        .select('id, name')
        .order('name')

      if (!catErr && data && data.length > 0) {
        setCategories(data)
        setExpenseCategory(prev => prev || data[0].id)
        return
      }

      // 2. Jika RLS membatasi pembacaan kasir, ambil melalui endpoint server API Admin
      const res = await fetch('/api/pos/expense-categories')
      if (res.ok) {
        const json = await res.json()
        if (json.categories && json.categories.length > 0) {
          setCategories(json.categories)
          setExpenseCategory(prev => prev || json.categories[0].id)
          return
        }
      }

      // 3. Fallback konsisten dengan 4 kategori default admin Fluxa di database
      const defaultCategories = [
        { id: 'b53d1826-e768-4c5d-87bb-24261d466537', name: 'Bahan Baku & Restok' },
        { id: 'b456eda6-9485-47bc-9dbf-fd121f60c955', name: 'Gaji & Upah Kasir' },
        { id: '069eeac1-a1ab-4b48-9e02-f89352f2b046', name: 'Listrik & Utilitas' },
        { id: '2fe00b40-e325-4896-8b1b-32ae9a1fc727', name: 'Sewa Tempat & Kebersihan' },
      ]
      setCategories(defaultCategories)
      setExpenseCategory(prev => prev || defaultCategories[0].id)
    } catch (err) {
      console.warn('Gagal memuat kategori pengeluaran, menggunakan kategori standar:', err)
      const defaultCategories = [
        { id: 'b53d1826-e768-4c5d-87bb-24261d466537', name: 'Bahan Baku & Restok' },
        { id: 'b456eda6-9485-47bc-9dbf-fd121f60c955', name: 'Gaji & Upah Kasir' },
        { id: '069eeac1-a1ab-4b48-9e02-f89352f2b046', name: 'Listrik & Utilitas' },
        { id: '2fe00b40-e325-4896-8b1b-32ae9a1fc727', name: 'Sewa Tempat & Kebersihan' },
      ]
      setCategories(defaultCategories)
      setExpenseCategory(prev => prev || defaultCategories[0].id)
    } finally {
      setLoadingCategories(false)
    }
  }

  useEffect(() => {
    void fetchCategories()
  }, [])

  // Simpan Pengeluaran Kasir secara Inline
  const handleSaveExpense = async () => {
    if (submittingExpense) return

    const amountNum = parseInt(expenseAmount.replace(/\D/g, '')) || 0
    if (!amountNum || amountNum <= 0) {
      setExpenseError('Nominal pengeluaran harus lebih besar dari Rp0.')
      return
    }
    if (!expenseDesc.trim()) {
      setExpenseError('Keterangan atau alasan pengeluaran wajib diisi.')
      return
    }

    setExpenseError('')
    setSubmittingExpense(true)

    try {
      let receiptUrl: string | null = null
      if (expenseReceiptFile) {
        if (expenseReceiptFile.size > 5 * 1024 * 1024) {
          setExpenseError('Ukuran file bukti tidak boleh melebihi 5MB.')
          setSubmittingExpense(false)
          return
        }
        try {
          const fileExt = expenseReceiptFile.name.split('.').pop()
          const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('expenses')
            .upload(fileName, expenseReceiptFile)
          if (!uploadErr && uploadData?.path) {
            const { data: publicUrlData } = supabase.storage
              .from('expenses')
              .getPublicUrl(uploadData.path)
            receiptUrl = publicUrlData?.publicUrl || uploadData.path
          }
        } catch {
          // Jika storage belum dikonfigurasi, lanjutkan pencatatan pengeluaran
        }
      }

      const validCategoryId = cleanUUID(expenseCategory) || cleanUUID(categories[0]?.id)
      const validShiftId = cleanUUID(activeShift?.id)
      const validUserId = cleanUUID(activeUserId) || cleanUUID(userId) || cleanUUID(activeShift?.cashier_id)

      const res = await submitCashierExpense(supabase, {
        amount: amountNum,
        description: expenseDesc.trim(),
        categoryId: validCategoryId,
        shiftId: validShiftId,
        cashImpact: expenseCashImpact,
        receiptUrl,
        userId: validUserId || '',
      })

      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan pengeluaran toko.')
      }

      // Perbarui ringkasan kas laci secara live
      setShiftExpenses(prev => prev + amountNum)
      setExpensesCount(prev => prev + 1)
      setExpenseSuccessMsg(`Pengeluaran ${formatRp(amountNum)} berhasil dicatat oleh ${cashierName || 'Kasir'} & saldo sistem diperbarui.`)

      // Reset field form
      setExpenseAmount('')
      setExpenseDesc('')
      setExpenseReceiptFile(null)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shift_expense_added', {
          detail: { amount: amountNum, description: expenseDesc.trim() }
        }))
      }

      // Sembunyikan form setelah delay sejenak agar feedback terbaca
      setTimeout(() => {
        setShowExpenseForm(false)
        setExpenseSuccessMsg('')
      }, 1600)
    } catch (err: any) {
      setExpenseError(err?.message || 'Pengeluaran belum dapat disimpan. Coba lagi.')
    } finally {
      setSubmittingExpense(false)
    }
  }

  // Ambil total penjualan kas tunai dan pengeluaran operasional selama shift aktif
  useEffect(() => {
    async function fetchShiftData() {
      const validShiftId = cleanUUID(activeShift?.id)
      const validUserId = cleanUUID(activeUserId) || cleanUUID(userId) || cleanUUID(activeShift?.cashier_id)

      if (!validShiftId) {
        setSalesLoaded(true)
        return
      }
      try {
        const [salesRes, expenseRes] = await Promise.all([
          supabase
            .from('sales')
            .select('final_amount, payment_method, status')
            .eq('shift_id', validShiftId)
            .eq('status', 'completed'),
          fetchShiftExpenses(supabase, validShiftId, validUserId, activeShift?.opened_at)
        ])

        if (salesRes.data && salesRes.data.length > 0) {
          const cash = salesRes.data.filter(d => d.payment_method === 'cash').reduce((acc, curr) => acc + (curr.final_amount || 0), 0)
          const nonCash = salesRes.data.filter(d => d.payment_method !== 'cash').reduce((acc, curr) => acc + (curr.final_amount || 0), 0)
          setCashSales(cash)
          setNonCashSales(nonCash)
          setSalesCount(salesRes.data.length)
        }

        setShiftExpenses(expenseRes.totalExpense)
        setExpensesCount(expenseRes.expenses.length)
      } catch (err) {
        console.warn('Gagal memuat aktivitas kas shift:', err)
      } finally {
        setSalesLoaded(true)
      }
    }

    void fetchShiftData()
  }, [activeShift?.id, activeShift?.opened_at, userId, supabase])

  // Formula Resmi: Kas yang Diharapkan = Kas Awal + Penjualan Tunai - Pengeluaran Kas Laci
  const estimasiKasSistem = Math.max(0, kasAwal + cashSales - shiftExpenses)

  const hasInvalidLeadingZeroAkhir = /^0\d+/.test(kasAkhir.trim())
  const isValidKasAkhir = kasAkhir.trim() !== '' && !hasInvalidLeadingZeroAkhir && /^\d+$/.test(kasAkhir.trim())
  const kasAkhirNum = isValidKasAkhir ? parseInt(kasAkhir.trim(), 10) : 0
  const selisih = kasAkhirNum - estimasiKasSistem

  const openedAt = activeShift?.opened_at
    ? new Date(activeShift.opened_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const handleKasAkhirChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '')

    if (cleaned === '') {
      setKasAkhir('')
      setError('')
      return
    }

    // Jika nilai sebelumnya '0' dan kasir mengetik angka di belakang '0'
    if (kasAkhir === '0') {
      if (cleaned === '00') return
      setError('Tidak boleh ada angka di belakang angka 0 (contoh: 08889). Hapus angka 0 terlebih dahulu untuk menginput nominal lain.')
      return
    }

    // Cek jika diawali 0 diikuti digit lain (contoh: '08889')
    if (/^0\d+/.test(cleaned)) {
      setKasAkhir(cleaned)
      setError('Tidak boleh ada angka di belakang angka 0 (contoh: 08889). Silakan hapus angka 0 di depan atau masukkan 0 saja.')
      return
    }

    setKasAkhir(cleaned)
    setError('')
  }

  const handleTutup = async () => {
    if (!kasAkhir.trim()) {
      setError('Masukkan nominal kas akhir fisik hasil hitung laci.')
      return
    }
    if (hasInvalidLeadingZeroAkhir) {
      setError('Tidak boleh ada angka di belakang angka 0 (contoh: 08889). Masukkan nominal 0 atau nominal tanpa awalan 0.')
      return
    }
    if (!isValidKasAkhir || kasAkhirNum < 0) {
      setError('Masukkan nominal kas akhir fisik yang valid.')
      return
    }

    const validShiftId = cleanUUID(activeShift?.id)
    if (!validShiftId) {
      setError('ID Shift tidak valid atau shift belum dimulai.')
      return
    }

    setError('')
    setLoading(true)

    const existingNote = activeShift?.note || ''
    const closingFormatted = catatan.trim() ? `[Penutupan]: ${catatan.trim()}` : ''
    let combinedNote: string | null = null
    if (existingNote && closingFormatted) {
      combinedNote = `${existingNote}\n${closingFormatted}`
    } else if (closingFormatted) {
      combinedNote = closingFormatted
    } else if (existingNote) {
      combinedNote = existingNote
    }

    try {
      const { error: rpcErr } = await supabase.rpc('close_shift', {
        p_shift_id: validShiftId,
        p_final_cash: kasAkhirNum,
        p_note: combinedNote,
      })
      if (rpcErr) throw rpcErr

      // Sinkronkan pembaruan expected_cash, difference, dan note
      await supabase
        .from('shifts')
        .update({
          expected_cash: estimasiKasSistem,
          difference: selisih,
          note: combinedNote,
        })
        .eq('id', validShiftId)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shift_changed', { detail: null }))
      }
      onSuccess()
      router.refresh()
    } catch (err) {
      setError(getUserFacingError(err, 'Shift belum dapat ditutup. Silakan periksa data kas dan coba lagi.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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
        padding: 'clamp(20px, 5vw, 36px) clamp(16px, 5vw, 32px)',
        width: '100%',
        maxWidth: 480,
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
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
              Penjualan
            </div>
            {!salesLoaded ? (
              <div style={{ fontSize: 13, color: 'var(--mute)', fontStyle: 'italic' }}>Memuat...</div>
            ) : salesCount === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--mute)', fontWeight: 500 }}>Belum ada transaksi</div>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ok)' }}>
                +{formatRp(cashSales + nonCashSales)}{' '}
                <span style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 500 }}>({salesCount} Trx)</span>
              </div>
            )}
          </div>
          {shiftExpenses > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mute)', marginBottom: 3, textTransform: 'uppercase' }}>
                Biaya Kas Toko
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--bad)' }}>
                -{formatRp(shiftExpenses)} {expensesCount > 0 && <span style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 500 }}>({expensesCount} Pos)</span>}
              </div>
            </div>
          )}

          {salesLoaded && salesCount > 0 && (
            <div style={{
              gridColumn: '1 / -1',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 11px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11.5, color: 'var(--mute)' }}>Tunai</span>
                <strong style={{ fontSize: 12, color: cashSales > 0 ? 'var(--ok)' : 'var(--mute)' }}>
                  {cashSales > 0 ? formatRp(cashSales) : '—'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 11px' }}>
                <span style={{ fontSize: 11.5, color: 'var(--mute)' }}>Non-Tunai </span>
                <strong style={{ fontSize: 12, color: nonCashSales > 0 ? 'var(--acc)' : 'var(--mute)' }}>
                  {nonCashSales > 0 ? formatRp(nonCashSales) : '—'}
                </strong>
              </div>
            </div>
          )}
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
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={kasAkhir}
              onChange={e => handleKasAkhirChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && isValidKasAkhir && handleTutup()}
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
          {isValidKasAkhir && (
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
        {isValidKasAkhir && (
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

        {/* Tombol Catat Pengeluaran Toko (Toggle Inline Form) */}
        <button
          id="btn-toggle-pengeluaran-inline"
          type="button"
          onClick={() => {
            setShowExpenseForm(prev => !prev)
            setExpenseError('')
            setExpenseSuccessMsg('')
          }}
          disabled={loading || submittingExpense}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            padding: '11px 16px',
            marginBottom: showExpenseForm ? 12 : 14,
            borderRadius: 12,
            border: showExpenseForm ? '1px solid var(--line)' : '1.5px dashed var(--bad)',
            background: showExpenseForm ? 'var(--bg)' : 'var(--bads)',
            color: showExpenseForm ? 'var(--ink)' : 'var(--bad)',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || submittingExpense ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {showExpenseForm ? (
            <>
              <ChevronUp size={15} />
              <span>Tutup Form Pengeluaran</span>
            </>
          ) : (
            <>
              <Plus size={15} />
              <span>Catat Pengeluaran Toko</span>
            </>
          )}
        </button>

        {/* Form Pengeluaran Toko Inline (Sesuai UIUX-FORM-PENGELUARAN.md) */}
        {showExpenseForm && (
          <div
            id="form-pengeluaran-inline"
            style={{
              background: 'var(--bg)',
              border: '1.5px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 16,
              padding: '16px',
              marginBottom: 16,
              animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Context Header: Nama Shift & Siapa yang Menginput */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderBottom: '1px solid var(--line)',
              paddingBottom: 10,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'var(--warns)',
                    color: 'var(--warn)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <TrendingDown size={14} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    Form Pengeluaran Toko
                  </span>
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--mute)',
                  background: 'var(--panel)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                }}>
                  Shift #{activeShift?.id ? String(activeShift.id).slice(0, 8) : '—'}
                </span>
              </div>

              {/* Siapa & Kapan Input Pengeluaran */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 11.5,
                background: 'var(--panel)',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink)' }}>
                  <User size={13} color="var(--acc)" />
                  <span style={{ color: 'var(--mute)' }}>Diinput oleh:</span>
                  <strong style={{ fontWeight: 600 }}>{cashierName || 'Kasir'}</strong>
                </div>
                <span style={{ color: 'var(--line)' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink)' }}>
                  <Clock size={13} color="var(--acc)" />
                  <span style={{ color: 'var(--mute)' }}>Waktu:</span>
                  <strong style={{ fontWeight: 600 }}>
                    {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                  </strong>
                </div>
              </div>
            </div>

            {/* A. Dropdown Kategori Pengeluaran (Sumber sama dengan Admin) */}
            {/* A. Dropdown Kategori Pengeluaran (Samakan persis dengan Kategori Biaya di Admin) */}
            <div>
              <label
                htmlFor="exp-cat"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--mute)',
                  marginBottom: 6,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                <span>Kategori Biaya *</span>
                {loadingCategories && (
                  <span style={{ fontSize: 10, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none' }}>
                    <Loader2 size={10} className="animate-spin" /> Memuat dari Admin...
                  </span>
                )}
              </label>

              {categoriesError ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'var(--bads)',
                  color: 'var(--bad)',
                  fontSize: 12,
                }}>
                  <span>{categoriesError}</span>
                  <button
                    type="button"
                    onClick={fetchCategories}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--bad)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={12} /> Coba Lagi
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '8px 12px',
                }}>
                  <Tag size={14} color="var(--mute)" style={{ flexShrink: 0 }} />
                  <select
                    id="exp-cat"
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    disabled={loadingCategories || categories.length === 0}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    {categories.length === 0 ? (
                      <option value="" disabled>
                        {loadingCategories ? 'Memuat kategori...' : 'Tidak ada kategori tersedia'}
                      </option>
                    ) : (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.id} style={{ background: 'var(--panel)', color: 'var(--ink)' }}>
                          {cat.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* B. Nominal Pengeluaran */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--mute)',
                marginBottom: 6,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                Nominal Pengeluaran (Rupiah) *
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '8px 12px',
              }}>
                <DollarSign size={15} color="var(--mute)" style={{ flexShrink: 0 }} />
                <input
                  id="nominal-pengeluaran-input"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={expenseAmount}
                  onChange={e => {
                    setExpenseAmount(e.target.value)
                    setExpenseError('')
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    width: '100%',
                  }}
                />
              </div>

              {/* Quick Amount Chips */}
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {[10000, 25000, 50000, 100000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setExpenseAmount(String(val))
                      setExpenseError('')
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--line)',
                      background: 'var(--panel)',
                      color: 'var(--ink)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    +{formatRp(val)}
                  </button>
                ))}
              </div>

              {parseInt(expenseAmount.replace(/\D/g, '')) > 0 && (
                <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--warn)', fontWeight: 600 }}>
                  Terbaca: {formatRp(parseInt(expenseAmount.replace(/\D/g, '')))}
                </div>
              )}
            </div>

            {/* C. Keterangan Pengeluaran */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--mute)',
                marginBottom: 6,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                Keterangan / Keperluan *
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '8px 12px',
              }}>
                <FileText size={14} color="var(--mute)" style={{ flexShrink: 0 }} />
                <input
                  id="keterangan-pengeluaran-input"
                  type="text"
                  placeholder="Contoh: Beli sapu, kresek, galon air..."
                  value={expenseDesc}
                  onChange={e => {
                    setExpenseDesc(e.target.value)
                    setExpenseError('')
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 12.5,
                    color: 'var(--ink)',
                  }}
                />
              </div>
            </div>

            {/* D. Bukti Pengeluaran (Opsional) */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--mute)',
                marginBottom: 6,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                Bukti / Nota Transaksi (Opsional)
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--panel)',
                border: '1px dashed var(--line)',
                borderRadius: 10,
                padding: '7px 12px',
                fontSize: 12,
              }}>
                <UploadCloud size={14} color="var(--mute)" style={{ flexShrink: 0 }} />
                <input
                  id="bukti-pengeluaran-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0]
                      if (file.size > 5 * 1024 * 1024) {
                        setExpenseError('Ukuran file maksimal 5MB.')
                        return
                      }
                      setExpenseReceiptFile(file)
                    }
                  }}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: 'var(--ink)',
                  }}
                />
                {expenseReceiptFile && (
                  <button
                    type="button"
                    onClick={() => setExpenseReceiptFile(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--mute)',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    title="Hapus file"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Context & Info Pencatatan Langsung (Tanpa Verifikasi Admin) */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              background: 'var(--accs)',
              border: '1px solid rgba(47, 107, 255, 0.25)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 11,
              color: 'var(--ink)',
              lineHeight: 1.4,
            }}>
              <CheckCircle2 size={13} color="var(--acc)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Pengeluaran memotong saldo kas laci (<strong>masuk laporan admin</strong>). Identitas penginput (<strong>{cashierName || 'Kasir'}</strong>) dan waktu pencatatan tersimpan otomatis.
              </span>
            </div>

            {/* Error & Success Messages */}
            {expenseError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bads)',
                border: '1px solid var(--bad)',
                borderRadius: 8,
                padding: '8px 10px',
                color: 'var(--bad)',
                fontSize: 12,
              }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                <span>{expenseError}</span>
              </div>
            )}

            {expenseSuccessMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--oks)',
                border: '1px solid var(--ok)',
                borderRadius: 8,
                padding: '8px 10px',
                color: 'var(--ok)',
                fontSize: 12,
              }}>
                <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                <span>{expenseSuccessMsg}</span>
              </div>
            )}

            {/* Tombol Simpan Pengeluaran & Batal */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setShowExpenseForm(false)
                  setExpenseError('')
                }}
                disabled={submittingExpense}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--panel)',
                  color: 'var(--ink)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: submittingExpense ? 'not-allowed' : 'pointer',
                }}
              >
                Batal
              </button>
              <button
                id="btn-simpan-pengeluaran-inline"
                type="button"
                onClick={handleSaveExpense}
                disabled={submittingExpense || !parseInt(expenseAmount.replace(/\D/g, '')) || !expenseDesc.trim()}
                style={{
                  flex: 2,
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--warn)',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: submittingExpense || !parseInt(expenseAmount.replace(/\D/g, '')) || !expenseDesc.trim() ? 'not-allowed' : 'pointer',
                  opacity: submittingExpense || !parseInt(expenseAmount.replace(/\D/g, '')) || !expenseDesc.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'opacity 0.2s',
                }}
              >
                {submittingExpense ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Simpan Pengeluaran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

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
            disabled={loading || !isValidKasAkhir}
            style={{
              flex: 2,
              padding: '13px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--acc)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: loading || !isValidKasAkhir ? 'not-allowed' : 'pointer',
              opacity: loading || !isValidKasAkhir ? 0.5 : 1,
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
    </>
  )
}
