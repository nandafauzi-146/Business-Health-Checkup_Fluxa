'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Clock, DollarSign, Check, X, TrendingUp, TrendingDown,
  AlertCircle, Users, Activity, ShieldCheck, Search,
  Calendar, Eye, Receipt, Printer, ArrowRight, Sparkles,
  CheckCircle2, AlertTriangle, Layers, RefreshCw, ShoppingCart
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, KpiCard } from '@/components/ui/Cards'
import { BukaShiftModal, TutupShiftModal } from '@/components/pos/KasMasukModal'
import { cleanUUID, fetchShiftExpenses, ShiftExpenseItem } from '@/lib/cash-reconciliation'
import MonthNavigator, { getCurrentYearMonth, formatMonthIndo } from '@/components/ui/MonthNavigator'

export interface ShiftSaleItem {
  id: string
  invoice_number: string
  created_at: string
  total_amount: number
  discount: number
  final_amount: number
  payment_method: string
  payment_status: string
  status: string
}

function formatRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function calculateDuration(start: string, end?: string | null) {
  const startTime = new Date(start).getTime()
  const endTime = end ? new Date(end).getTime() : Date.now()
  const diffMs = Math.max(0, endTime - startTime)
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (hours === 0) return `${minutes} menit`
  return `${hours} jam ${minutes} mnt`
}

export function parseShiftNotes(rawNote?: string | null) {
  if (!rawNote || !rawNote.trim()) {
    return { openingNote: '—', closingNote: '—' }
  }

  const text = rawNote.trim()
  const bukaMatch = text.match(/\[(?:Buka|Pembukaan)\]:\s*([\s\S]*?)(?=\[(?:Tutup|Penutupan)\]:|$)/i)
  const tutupMatch = text.match(/\[(?:Tutup|Penutupan)\]:\s*([\s\S]*?)$/i)

  if (bukaMatch || tutupMatch) {
    return {
      openingNote: bukaMatch && bukaMatch[1].trim() ? bukaMatch[1].trim() : '—',
      closingNote: tutupMatch && tutupMatch[1].trim() ? tutupMatch[1].trim() : '—'
    }
  }

  return {
    openingNote: text,
    closingNote: '—'
  }
}

export interface ShiftItem {
  id: string
  cashier_id?: string
  cashier_name?: string
  opened_at: string
  closed_at?: string | null
  initial_cash: number
  expected_cash?: number | null
  final_cash?: number | null
  difference?: number | null
  note?: string | null
  status: 'open' | 'closed'
}

interface Props {
  activeShift?: ShiftItem | null
  allActiveShifts?: ShiftItem[]
  recentShifts: ShiftItem[]
  userId: string
  role?: 'kasir' | 'admin' | 'owner'
  loadError?: string | null
}

export default function ShiftClient({
  activeShift: initialShift,
  allActiveShifts: initialAllActive = [],
  recentShifts: initialRecent = [],
  userId,
  role = 'admin',
  loadError,
}: Props) {
  const supabase = createClient()
  const [activeShift, setActiveShift] = useState<ShiftItem | null>(initialShift || null)
  const [allActive, setAllActive] = useState<ShiftItem[]>(
    initialAllActive.length > 0
      ? initialAllActive
      : initialShift
      ? [initialShift]
      : []
  )
  const [recentShifts, setRecentShifts] = useState<ShiftItem[]>(initialRecent)

  const [toast, setToast] = useState('')
  const [openModal, setOpenModal] = useState(false)
  const [closingShift, setClosingShift] = useState<ShiftItem | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<ShiftItem | null>(null)
  const [searchCashier, setSearchCashier] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'closed' | 'discrepancy'>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentYearMonth())
  const [loadingMonth, setLoadingMonth] = useState(false)

  const [shiftSales, setShiftSales] = useState<ShiftSaleItem[]>([])
  const [shiftExpenses, setShiftExpenses] = useState<ShiftExpenseItem[]>([])
  const [loadingSales, setLoadingSales] = useState(false)

  // Kunci scroll halaman saat modal detail rekonsiliasi aktif
  useEffect(() => {
    if (!selectedDetail) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDetail(null)
    }
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = origOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDetail])

  // Muat riwayat shift sesuai periode bulan yang dipilih
  useEffect(() => {
    let isMounted = true

    const fetchMonthShifts = async () => {
      try {
        setLoadingMonth(true)
        const [year, month] = selectedMonth.split('-').map(Number)
        const startISO = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString()
        const endISO = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString()

        const [shiftsRes, profilesRes] = await Promise.all([
          supabase
            .from('shifts')
            .select('*')
            .gte('opened_at', startISO)
            .lt('opened_at', endISO)
            .order('opened_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id, full_name, role')
        ])

        if (shiftsRes.error) {
          console.error('Error fetching month shifts:', shiftsRes.error)
          return
        }

        const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]))
        const loaded: ShiftItem[] = (shiftsRes.data || []).map((s: any) => ({
          id: s.id,
          cashier_id: s.cashier_id,
          cashier_name: profileMap.get(s.cashier_id) || 'Kasir',
          opened_at: s.opened_at,
          closed_at: s.closed_at,
          initial_cash: s.initial_cash || 0,
          expected_cash: s.expected_cash || 0,
          final_cash: s.final_cash || 0,
          difference: s.difference || 0,
          note: s.note,
          status: s.status,
        }))

        if (isMounted) {
          setRecentShifts(loaded.filter(s => s.status === 'closed'))
        }
      } catch (err) {
        console.error('Error loading shifts for month:', err)
      } finally {
        if (isMounted) setLoadingMonth(false)
      }
    }

    fetchMonthShifts()

    return () => {
      isMounted = false
    }
  }, [selectedMonth, supabase])

  useEffect(() => {
    if (!selectedDetail?.id) {
      setShiftSales([])
      setLoadingSales(false)
      return
    }

    let isMounted = true
    const fetchSalesAndExpenses = async () => {
      setLoadingSales(true)
      try {
        const validShiftId = cleanUUID(selectedDetail?.id)
        const validCashierId = cleanUUID(selectedDetail?.cashier_id)

        const salesPromise = validShiftId
          ? supabase
              .from('sales')
              .select('id, invoice_number, created_at, total_amount, discount, final_amount, payment_method, payment_status, status')
              .eq('shift_id', validShiftId)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null })

        const [salesRes, expenseRes] = await Promise.all([
          salesPromise,
          fetchShiftExpenses(
            supabase,
            validShiftId,
            validCashierId,
            selectedDetail?.opened_at,
            selectedDetail?.closed_at
          )
        ])

        if (!isMounted) return

        if (!salesRes.error && salesRes.data && salesRes.data.length > 0) {
          setShiftSales(salesRes.data as ShiftSaleItem[])
        } else {
          // Fallback: match by cashier and time range if shift_id was unlinked
          if (selectedDetail.cashier_id && selectedDetail.opened_at) {
            let query = supabase
              .from('sales')
              .select('id, invoice_number, created_at, total_amount, discount, final_amount, payment_method, payment_status, status')
              .eq('cashier_id', selectedDetail.cashier_id)
              .gte('created_at', selectedDetail.opened_at)

            if (selectedDetail.closed_at) {
              query = query.lte('created_at', selectedDetail.closed_at)
            }
            const fallbackRes = await query.order('created_at', { ascending: false })
            if (isMounted && fallbackRes.data) {
              setShiftSales(fallbackRes.data as ShiftSaleItem[])
            } else {
              setShiftSales([])
            }
          } else {
            setShiftSales([])
          }
        }

        setShiftExpenses(expenseRes.expenses)
      } catch (err) {
        console.warn('Gagal memuat transaksi/biaya shift:', err)
        if (isMounted) {
          setShiftSales([])
          setShiftExpenses([])
        }
      } finally {
        if (isMounted) setLoadingSales(false)
      }
    }

    void fetchSalesAndExpenses()
    return () => {
      isMounted = false
    }
  }, [selectedDetail?.id, selectedDetail?.cashier_id, selectedDetail?.opened_at, selectedDetail?.closed_at, supabase])

  const shiftSalesSummary = useMemo(() => {
    const completed = shiftSales.filter(s => s.status === 'completed')
    const totalTransactions = completed.length
    const totalOmzet = completed.reduce((acc, s) => acc + (s.final_amount || 0), 0)
    const cashTotal = completed.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + (s.final_amount || 0), 0)
    const nonCashTotal = completed.filter(s => s.payment_method !== 'cash').reduce((acc, s) => acc + (s.final_amount || 0), 0)
    const voidCount = shiftSales.filter(s => s.status === 'voided').length

    return {
      totalTransactions,
      totalOmzet,
      cashTotal,
      nonCashTotal,
      voidCount
    }
  }, [shiftSales])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleShiftClosed = (closedShiftId: string) => {
    const target = allActive.find(s => s.id === closedShiftId)
    setAllActive(prev => prev.filter(s => s.id !== closedShiftId))
    if (activeShift?.id === closedShiftId) {
      setActiveShift(null)
    }

    if (target) {
      const closedRecord: ShiftItem = {
        ...target,
        closed_at: new Date().toISOString(),
        status: 'closed',
        final_cash: target.expected_cash || target.initial_cash,
        difference: 0,
        note: 'Ditutup melalui rekonsiliasi manual oleh ' + role
      }
      setRecentShifts(prev => [closedRecord, ...prev])
    }

    showToast('Shift berhasil ditutup dan direkonsiliasi!')
    setClosingShift(null)
  }

  const handleShiftOpened = (newShift: any) => {
    setAllActive(prev => [newShift, ...prev])
    if (newShift.cashier_id === userId) {
      setActiveShift(newShift)
    }
    setOpenModal(false)
    showToast('Shift baru berhasil dibuka!')
  }

  // Ringkasan Statistik & KPI Rekonsiliasi
  const stats = useMemo(() => {
    const totalClosed = recentShifts.length
    const totalDiff = recentShifts.reduce((acc, s) => acc + (s.difference || 0), 0)
    const balancedCount = recentShifts.filter(s => (s.difference || 0) === 0).length
    const discrepancyCount = recentShifts.filter(s => (s.difference || 0) !== 0).length
    const totalExpected = recentShifts.reduce((acc, s) => acc + (s.expected_cash || 0), 0)
    const accuracyRate = totalClosed > 0 ? ((balancedCount / totalClosed) * 100).toFixed(1) : '100'

    return {
      activeCount: allActive.length,
      totalClosed,
      totalDiff,
      balancedCount,
      discrepancyCount,
      totalExpected,
      accuracyRate
    }
  }, [allActive, recentShifts])

  // Filter daftar riwayat shift berdasarkan periode bulan, tab, dan pencarian
  const filteredShifts = useMemo(() => {
    return recentShifts.filter(s => {
      // Filter periode bulan
      if (s.opened_at && s.opened_at.slice(0, 7) !== selectedMonth) return false

      // Tab filter
      if (filterTab === 'closed' && s.status !== 'closed') return false
      if (filterTab === 'discrepancy' && (s.difference || 0) === 0) return false

      // Search filter
      if (searchCashier) {
        const q = searchCashier.toLowerCase()
        const matchesName = (s.cashier_name || '').toLowerCase().includes(q)
        const matchesNote = (s.note || '').toLowerCase().includes(q)
        const matchesId = (s.id || '').toLowerCase().includes(q)
        return matchesName || matchesNote || matchesId
      }
      return true
    })
  }, [recentShifts, selectedMonth, filterTab, searchCashier])

  return (
    <div>
      {/* Header Utama dengan Badge Subtitle */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 20,
        borderBottom: '1px solid var(--line)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--accs)', color: 'var(--acc)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Activity size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>
              Buka / Tutup Shift
            </h1>
            <span style={{
              padding: '3px 10px', borderRadius: 99,
              fontSize: 11, fontWeight: 700,
              background: 'var(--accs)', color: 'var(--acc)',
              textTransform: 'uppercase', letterSpacing: 0.5
            }}>
              {role === 'owner' ? 'Owner Audit' : 'Admin Sesi Kasir'}
            </span>
          </div>
          <p style={{ color: 'var(--mute)', fontSize: 13.5, margin: 0 }}>
            Kelola sesi kerja kasir dan rekonsiliasi kas riil toko
          </p>
        </div>

        {/* Action Button: Hanya Kasir yang Membuka Shift */}
        {role === 'kasir' && (
          <button
            id="buka-shift-btn"
            className="btn btn-primary"
            onClick={() => setOpenModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, boxShadow: '0 4px 14px rgba(47, 107, 255, 0.25)' }}
          >
            <Clock size={16} /> Buka Shift Baru
          </button>
        )}
      </div>

      {loadError && (
        <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: 'var(--bad)', background: 'var(--bads)' }}>
          Data shift belum dapat dimuat. Silakan coba lagi.
        </div>
      )}

      {/* 4 Kartu KPI Interaktif */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
        gap: 16,
        marginBottom: 28
      }}>
        {/* Card 1: Kasir Bertugas */}
        <div className="card" style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)',
          borderLeft: '4px solid var(--ok)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Kasir Bertugas Saat Ini</span>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--oks)', color: 'var(--ok)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{stats.activeCount}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              background: stats.activeCount > 0 ? 'var(--oks)' : 'var(--line)',
              color: stats.activeCount > 0 ? 'var(--ok)' : 'var(--mute)',
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>
              {stats.activeCount > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse-dot 1.5s infinite' }} />}
              {stats.activeCount > 0 ? 'Live Aktif' : 'Semua Tutup'}
            </span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Sesi POS kasir yang sedang melayani
          </span>
        </div>

        {/* Card 2: Total Sesi Selesai */}
        <div className="card" style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)',
          borderLeft: '4px solid var(--acc)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Sesi Shift Ditutup</span>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accs)', color: 'var(--acc)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{stats.totalClosed}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mute)' }}>Riwayat Sesi</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Rekonsiliasi shift yang telah diaudit
          </span>
        </div>

        {/* Card 3: Total Kas Sistem */}
        <div className="card" style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)',
          borderLeft: '4px solid #8B5CF6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Total Kas Sistem Terekam</span>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{formatRp(stats.totalExpected)}</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Nilai akumulasi kas dalam sistem
          </span>
        </div>

        {/* Card 4: Net Selisih & Akurasi */}
        <div className="card" style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)',
          borderLeft: `4px solid ${stats.totalDiff >= 0 ? 'var(--ok)' : 'var(--bad)'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Net Selisih Rekonsiliasi</span>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: stats.totalDiff >= 0 ? 'var(--oks)' : 'var(--bads)',
              color: stats.totalDiff >= 0 ? 'var(--ok)' : 'var(--bad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {stats.totalDiff >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 22,
              fontWeight: 800,
              color: stats.totalDiff >= 0 ? 'var(--ok)' : 'var(--bad)'
            }}>
              {stats.totalDiff >= 0 ? '+' : ''}{formatRp(stats.totalDiff)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: stats.totalDiff === 0 ? 'var(--ok)' : stats.totalDiff > 0 ? 'var(--acc)' : 'var(--bad)'
            }}>
              {stats.accuracyRate}% Akurasi Seimbang
            </span>
            <span style={{ fontSize: 11, color: 'var(--mute)' }}>({stats.discrepancyCount} ada selisih)</span>
          </div>
        </div>
      </div>

      {/* SECTION: Shift Kasir Sedang Berjalan (Active Shifts Hero Grid) */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              Shift Kasir Sedang Berjalan
            </h2>
            <span style={{
              fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              background: 'var(--oks)', color: 'var(--ok)'
            }}>
              {allActive.length} Kasir Aktif
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--mute)' }}>
            Realtime sesi kasir POS
          </span>
        </div>

        {allActive.length === 0 ? (
          <div className="card" style={{
            textAlign: 'center', padding: '36px 20px',
            border: '1.5px dashed var(--line)', background: 'var(--panel)',
            borderRadius: 16
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'var(--bg)', color: 'var(--mute)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <Clock size={24} />
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>
              Tidak Ada Shift Kasir yang Sedang Berjalan
            </p>
            <p style={{ fontSize: 13, color: 'var(--mute)', maxWidth: 440, margin: '0 auto' }}>
              Saat ini semua kasir dalam status offline atau belum membuka shift kerja baru di terminal POS.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))',
            gap: 16
          }}>
            {allActive.map(shift => {
              const estimatedSysCash = shift.expected_cash || (shift.initial_cash + 2750000)
              const duration = calculateDuration(shift.opened_at)

              return (
                <div
                  key={shift.id}
                  className="card"
                  style={{
                    position: 'relative',
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    padding: '20px 22px',
                    background: 'var(--panel)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16
                  }}
                >
                  {/* Top: Avatar, Nama Kasir, Status Pill */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: 'linear-gradient(135deg, #2F6BFF 0%, #1A4ED8 100%)',
                        color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 16,
                        boxShadow: '0 4px 10px rgba(47, 107, 255, 0.25)'
                      }}>
                        {(shift.cashier_name || 'K')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                          {shift.cashier_name || 'Kasir Bertugas'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Clock size={12} /> Dibuka: {formatDate(shift.opened_at)}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      padding: '4px 10px', borderRadius: 99,
                      background: 'var(--oks)', color: 'var(--ok)',
                      fontSize: 11.5, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 5
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse-dot 1.5s infinite' }} />
                      {duration}
                    </span>
                  </div>

                  {/* Middle: Cash Details Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'var(--bg)',
                    borderRadius: 12,
                    border: '1px solid var(--line)'
                  }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>Kas Modal Awal</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
                        {formatRp(shift.initial_cash || 0)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>Estimasi Kas Sistem</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--acc)', marginTop: 2 }}>
                        {formatRp(estimatedSysCash)}
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Action Button Tutup & Rekonsiliasi */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      id={`tutup-shift-${shift.id}`}
                      onClick={() => setClosingShift(shift)}
                      className="btn btn-danger"
                      style={{
                        flex: 1,
                        padding: '9px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        justifyContent: 'center',
                        borderRadius: 10
                      }}
                    >
                      <X size={15} /> Tutup & Rekonsiliasi Shift
                    </button>
                    <button
                      onClick={() => setSelectedDetail(shift)}
                      className="btn btn-secondary"
                      style={{ padding: '9px 12px', fontSize: 13, borderRadius: 10 }}
                      title="Lihat Detail Sesi"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Riwayat Shift — Toolbar Periode Bulanan */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        padding: '12px 16px',
        background: 'var(--panel)',
        borderRadius: 14,
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-soft)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--accs)', color: 'var(--acc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              Periode Riwayat Shift
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--mute)' }}>
              {loadingMonth ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={11} className="spin" /> Memuat shift {formatMonthIndo(selectedMonth)}...
                </span>
              ) : (
                `Menampilkan sesi shift bulan ${formatMonthIndo(selectedMonth)}`
              )}
            </div>
          </div>
        </div>

        <MonthNavigator
          selectedMonth={selectedMonth}
          onChange={setSelectedMonth}
          label="Pilih Periode"
        />
      </div>

      {/* SECTION: Riwayat Shift & Audit Rekonsiliasi Kas */}
      <SectionCard
        title={`Riwayat Sesi Shift — ${formatMonthIndo(selectedMonth)} (${filteredShifts.length})`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Filter Tabs */}
            <div style={{
              display: 'flex',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: 2
            }}>
              {(['all', 'closed', 'discrepancy'] as const).map(tab => {
                const labels = {
                  all: 'Semua',
                  closed: 'Selesai',
                  discrepancy: 'Ada Selisih'
                }
                const active = filterTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    style={{
                      background: active ? 'var(--panel)' : 'transparent',
                      color: active ? 'var(--ink)' : 'var(--mute)',
                      fontWeight: active ? 700 : 500,
                      border: 'none',
                      borderRadius: 8,
                      padding: '5px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            {/* Search Pill */}
            <div className="search-pill" style={{ width: 'min(220px, 100%)', padding: '5px 12px' }}>
              <Search size={14} color="var(--mute)" />
              <input
                placeholder="Cari kasir / catatan..."
                value={searchCashier}
                onChange={e => setSearchCashier(e.target.value)}
                style={{ fontSize: 12.5 }}
              />
            </div>
          </div>
        }
      >
        {filteredShifts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--mute)' }}>
            <Search size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <p style={{ fontWeight: 600, fontSize: 14 }}>Tidak ada data riwayat shift yang cocok</p>
            <p style={{ fontSize: 12.5, marginTop: 2 }}>Coba ubah kata kunci pencarian atau tab filter di atas</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KASIR</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>DURASI SESI</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KAS AWAL</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KAS SISTEM</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KAS FISIK (AKHIR)</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>SELISIH</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)', minWidth: 170 }}>CATATAN PEMBUKAAN (OPSIONAL)</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)', minWidth: 170 }}>CATATAN PENUTUPAN (OPSIONAL)</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>STATUS</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((s, idx) => {
                  const diff = s.difference || 0
                  const isBalanced = diff === 0
                  const isSurplus = diff > 0

                  return (
                    <tr
                      key={s.id || idx}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        transition: 'background-color 0.15s'
                      }}
                      className="hover-row"
                    >
                      {/* Kasir */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 10,
                            background: 'var(--accs)', color: 'var(--acc)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 12
                          }}>
                            {(s.cashier_name || 'K')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
                              {s.cashier_name || 'Kasir'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                              ID: {s.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Durasi Sesi */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>
                          {formatDate(s.opened_at)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>
                          {s.closed_at ? `s/d ${formatDate(s.closed_at)}` : 'Sedang berjalan'} • {calculateDuration(s.opened_at, s.closed_at)}
                        </div>
                      </td>

                      {/* Kas Awal */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                        {formatRp(s.initial_cash || 0)}
                      </td>

                      {/* Kas Sistem */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 500, fontSize: 13, color: 'var(--mute)' }}>
                        {formatRp(s.expected_cash || 0)}
                      </td>

                      {/* Kas Fisik Akhir */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
                        {formatRp(s.final_cash || 0)}
                      </td>

                      {/* Selisih */}
                      <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 12,
                          background: isBalanced ? 'var(--oks)' : isSurplus ? 'var(--accs)' : 'var(--bads)',
                          color: isBalanced ? 'var(--ok)' : isSurplus ? 'var(--acc)' : 'var(--bad)'
                        }}>
                          {isBalanced ? (
                            <CheckCircle2 size={12} />
                          ) : isSurplus ? (
                            <TrendingUp size={12} />
                          ) : (
                            <TrendingDown size={12} />
                          )}
                          {isBalanced ? 'Cocok (Rp 0)' : `${isSurplus ? '+' : ''}${formatRp(diff)}`}
                        </span>
                      </td>

                      {/* Catatan Pembukaan (Opsional) */}
                      {(() => {
                        const { openingNote, closingNote } = parseShiftNotes(s.note)
                        return (
                          <>
                            <td style={{ padding: '14px 14px', fontSize: 12.5, maxWidth: 200 }}>
                              <div style={{ color: openingNote !== '—' ? 'var(--ink)' : 'var(--mute)', fontWeight: openingNote !== '—' ? 500 : 400 }}>
                                {openingNote}
                              </div>
                            </td>

                            {/* Catatan Penutupan (Opsional) */}
                            <td style={{ padding: '14px 14px', fontSize: 12.5, maxWidth: 200 }}>
                              <div style={{ color: closingNote !== '—' ? 'var(--ink)' : 'var(--mute)', fontWeight: closingNote !== '—' ? 500 : 400 }}>
                                {closingNote}
                              </div>
                            </td>
                          </>
                        )
                      })()}

                      {/* Status */}
                      <td style={{ padding: '14px 14px' }}>
                        <StatusTag
                          type={s.status === 'closed' ? 'ok' : 'info'}
                          label={s.status === 'closed' ? 'Selesai' : 'Aktif'}
                        />
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedDetail(s)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 10px', fontSize: 12 }}
                        >
                          <Eye size={13} /> Rincian
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Modal Detail Rekonsiliasi Struk Kasir */}
      {selectedDetail && (
        <div
          onClick={e => e.target === e.currentTarget && setSelectedDetail(null)}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 18, 24, 0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, animation: 'fadeIn 0.2s ease'
          }}
        >
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            padding: 'clamp(18px, 4vw, 24px) clamp(16px, 4vw, 22px)',
            width: '100%',
            maxWidth: 540,
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={20} color="var(--acc)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                  Rincian Rekonsiliasi Kas Shift
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Info Petugas & Waktu */}
            <div style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: 14,
              marginBottom: 14,
              border: '1px solid var(--line)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--mute)' }}>Kasir Petugas:</span>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{selectedDetail.cashier_name || 'Kasir'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--mute)' }}>Waktu Mulai:</span>
                <span style={{ fontWeight: 600 }}>{formatDate(selectedDetail.opened_at)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--mute)' }}>Waktu Selesai:</span>
                <span style={{ fontWeight: 600 }}>
                  {selectedDetail.closed_at ? formatDate(selectedDetail.closed_at) : 'Masih Berjalan'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--mute)' }}>Durasi Kerja:</span>
                <span style={{ fontWeight: 600 }}>{calculateDuration(selectedDetail.opened_at, selectedDetail.closed_at)}</span>
              </div>
            </div>

            {/* Rekonsiliasi Kas Laci */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: 'var(--mute)' }}>Kas Modal Awal:</span>
                <span style={{ fontWeight: 600 }}>{formatRp(selectedDetail.initial_cash || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: 'var(--mute)' }}>Penjualan Tunai Bersih:</span>
                <span style={{ fontWeight: 600, color: 'var(--ok)' }}>+{formatRp(shiftSalesSummary.cashTotal)}</span>
              </div>
              {shiftExpenses.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--mute)' }}>Pengeluaran Kas Laci ({shiftExpenses.length} pos):</span>
                  <span style={{ fontWeight: 600, color: 'var(--bad)' }}>
                    -{formatRp(shiftExpenses.filter(e => e.cash_impact !== false && e.status !== 'rejected').reduce((s, c) => s + c.amount, 0))}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, borderTop: '1px solid var(--line)', paddingTop: 7 }}>
                <span style={{ color: 'var(--mute)' }}>Estimasi Kas Sistem (Seharusnya):</span>
                <span style={{ fontWeight: 700, color: 'var(--acc)' }}>{formatRp(selectedDetail.expected_cash || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px dashed var(--line)', paddingTop: 9 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Kas Fisik Terhitung:</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{formatRp(selectedDetail.final_cash || 0)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 10,
                background: (selectedDetail.difference || 0) === 0 ? 'var(--oks)' : (selectedDetail.difference || 0) > 0 ? 'var(--accs)' : 'var(--bads)',
                color: (selectedDetail.difference || 0) === 0 ? 'var(--ok)' : (selectedDetail.difference || 0) > 0 ? 'var(--acc)' : 'var(--bad)',
                fontWeight: 700,
                fontSize: 13.5
              }}>
                <span>Selisih Rekonsiliasi:</span>
                <span>{(selectedDetail.difference || 0) >= 0 ? '+' : ''}{formatRp(selectedDetail.difference || 0)}</span>
              </div>
            </div>

            {/* Rincian Transaksi Penjualan Shift */}
            <div style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              border: '1px solid var(--line)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingCart size={15} color="var(--acc)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    Rincian Transaksi Penjualan
                  </span>
                </div>
                {!loadingSales && (
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: shiftSalesSummary.totalTransactions > 0 ? 'var(--oks)' : 'var(--panel)',
                    color: shiftSalesSummary.totalTransactions > 0 ? 'var(--ok)' : 'var(--mute)'
                  }}>
                    {shiftSalesSummary.totalTransactions} Transaksi
                  </span>
                )}
              </div>

              {loadingSales ? (
                <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 12.5, color: 'var(--mute)' }}>
                  Memuat data transaksi shift...
                </div>
              ) : shiftSales.length === 0 ? (
                <div style={{
                  padding: '12px',
                  borderRadius: 8,
                  background: 'var(--panel)',
                  border: '1px dashed var(--line)',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--mute)'
                }}>
                  Belum ada transaksi penjualan pada sesi shift ini.
                </div>
              ) : (
                <>
                  {/* Grid Ringkasan Omzet & Cara Bayar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                    marginBottom: 10
                  }}>
                    <div style={{ background: 'var(--panel)', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600, marginBottom: 2 }}>Tunai (Masuk Kas Laci)</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>
                        +{formatRp(shiftSalesSummary.cashTotal)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--panel)', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600, marginBottom: 2 }}>Non-Tunai / QRIS / TF</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--acc)' }}>
                        {formatRp(shiftSalesSummary.nonCashTotal)}
                      </div>
                    </div>
                  </div>

                  {/* List Transaksi */}
                  <div style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    paddingRight: 2
                  }}>
                    {shiftSales.map((sale) => (
                      <div
                        key={sale.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '7px 9px',
                          borderRadius: 8,
                          background: 'var(--panel)',
                          border: '1px solid var(--line)',
                          fontSize: 12
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12 }}>
                            {sale.invoice_number || 'INV-DRAFT'}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--mute)', marginTop: 1 }}>
                            {new Date(sale.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} •{' '}
                            <span style={{
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              color: sale.payment_method === 'cash' ? 'var(--ok)' : 'var(--acc)'
                            }}>
                              {sale.payment_method === 'cash' ? 'Tunai' : sale.payment_method.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontWeight: 700,
                            color: sale.status === 'voided' ? 'var(--mute)' : 'var(--ink)',
                            textDecoration: sale.status === 'voided' ? 'line-through' : 'none'
                          }}>
                            {formatRp(sale.final_amount || 0)}
                          </div>
                          {sale.status === 'voided' ? (
                            <span style={{ fontSize: 9.5, color: 'var(--bad)', fontWeight: 600 }}>VOID</span>
                          ) : (
                            <span style={{ fontSize: 9.5, color: 'var(--ok)', fontWeight: 600 }}>LUNAS</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Rincian Pengeluaran Kas Laci Shift */}
            {shiftExpenses.length > 0 && (
              <div style={{
                background: 'var(--bg)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
                border: '1px solid var(--line)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingDown size={15} color="var(--bad)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                      Pengeluaran Kas Laci Shift
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'var(--bads)',
                    color: 'var(--bad)'
                  }}>
                    {shiftExpenses.length} Pos
                  </span>
                </div>

                <div style={{
                  maxHeight: 160,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  {shiftExpenses.map(exp => (
                    <div
                      key={exp.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{exp.description}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--mute)', display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                          <span>{exp.category_name || 'Operasional'}</span>
                          <span>•</span>
                          <span style={{
                            padding: '1px 5px',
                            borderRadius: 4,
                            fontWeight: 600,
                            fontSize: 10,
                            background: exp.status === 'approved' ? 'var(--oks)' : exp.status === 'rejected' ? 'var(--bads)' : 'var(--warns)',
                            color: exp.status === 'approved' ? 'var(--ok)' : exp.status === 'rejected' ? 'var(--bad)' : 'var(--warn)'
                          }}>
                            {exp.status === 'rejected' ? 'Ditolak' : 'Tercatat'}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--bad)', fontSize: 12.5, flexShrink: 0 }}>
                        -{formatRp(exp.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tampilan Khusus: Catatan Pembukaan & Penutupan */}
            {(() => {
              const notes = parseShiftNotes(selectedDetail.note)
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    fontSize: 12.5,
                    background: 'var(--bg)',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', marginBottom: 4 }}>
                      CATATAN PEMBUKAAN (OPSIONAL)
                    </div>
                    <div style={{ color: notes.openingNote !== '—' ? 'var(--ink)' : 'var(--mute)', fontWeight: notes.openingNote !== '—' ? 600 : 400 }}>
                      {notes.openingNote}
                    </div>
                  </div>

                  <div style={{
                    fontSize: 12.5,
                    background: 'var(--bg)',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', marginBottom: 4 }}>
                      CATATAN PENUTUPAN (OPSIONAL)
                    </div>
                    <div style={{ color: notes.closingNote !== '—' ? 'var(--ink)' : 'var(--mute)', fontWeight: notes.closingNote !== '—' ? 600 : 400 }}>
                      {notes.closingNote}
                    </div>
                  </div>
                </div>
              )
            })()}

            <button
              onClick={() => setSelectedDetail(null)}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px 0', borderRadius: 10 }}
            >
              Tutup Rincian
            </button>
          </div>
        </div>
      )}

      {/* Modal Buka Shift (Hanya jika role Kasir) */}
      {openModal && role === 'kasir' && (
        <BukaShiftModal
          userId={userId}
          onSuccess={handleShiftOpened}
          onCancel={() => setOpenModal(false)}
        />
      )}

      {/* Modal Tutup Shift & Rekonsiliasi */}
      {closingShift && (
        <TutupShiftModal
          activeShift={closingShift}
          userId={closingShift.cashier_id || userId}
          onSuccess={() => handleShiftClosed(closingShift.id)}
          onCancel={() => setClosingShift(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        .hover-row:hover {
          background-color: var(--bg);
        }
      `}</style>
    </div>
  )
}
