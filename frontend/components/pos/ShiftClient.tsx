'use client'

import { useState, useMemo } from 'react'
import {
  Clock, DollarSign, Check, X, TrendingUp, TrendingDown,
  AlertCircle, Users, Activity, ShieldCheck, Search,
  Calendar, Eye, Receipt, Printer, ArrowRight, Sparkles,
  CheckCircle2, AlertTriangle, Layers, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, KpiCard } from '@/components/ui/Cards'
import { BukaShiftModal, TutupShiftModal } from '@/components/pos/KasMasukModal'

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

const DEFAULT_DEMO_SHIFTS: ShiftItem[] = [
  {
    id: 's-demo-1',
    cashier_id: 'c1',
    cashier_name: 'Budi Santoso',
    opened_at: '2026-10-08T07:30:00Z',
    closed_at: '2026-10-08T15:30:00Z',
    initial_cash: 500000,
    expected_cash: 3850000,
    final_cash: 3850000,
    difference: 0,
    status: 'closed',
    note: 'Kas cocok sempurna, sesi shift pagi lancar'
  },
  {
    id: 's-demo-2',
    cashier_id: 'c2',
    cashier_name: 'Siti Rahma',
    opened_at: '2026-10-07T14:00:00Z',
    closed_at: '2026-10-07T22:00:00Z',
    initial_cash: 500000,
    expected_cash: 4250000,
    final_cash: 4230000,
    difference: -20000,
    status: 'closed',
    note: 'Selisih Rp20.000 terpakai untuk pembulatan kembalian receh'
  },
  {
    id: 's-demo-3',
    cashier_id: 'c1',
    cashier_name: 'Budi Santoso',
    opened_at: '2026-10-07T07:30:00Z',
    closed_at: '2026-10-07T15:30:00Z',
    initial_cash: 500000,
    expected_cash: 3600000,
    final_cash: 3625000,
    difference: 25000,
    status: 'closed',
    note: 'Kelebihan kas tip sukarela pelanggan umum'
  },
  {
    id: 's-demo-4',
    cashier_id: 'c3',
    cashier_name: 'Ahmad Fauzi',
    opened_at: '2026-10-06T14:00:00Z',
    closed_at: '2026-10-06T22:00:00Z',
    initial_cash: 500000,
    expected_cash: 5120000,
    final_cash: 5120000,
    difference: 0,
    status: 'closed',
    note: 'Rekonsiliasi seimbang dan tercatat akurat'
  }
]

interface Props {
  activeShift?: ShiftItem | null
  allActiveShifts?: ShiftItem[]
  recentShifts: ShiftItem[]
  userId: string
  role?: 'kasir' | 'admin' | 'owner'
}

export default function ShiftClient({
  activeShift: initialShift,
  allActiveShifts: initialAllActive = [],
  recentShifts: initialRecent = [],
  userId,
  role = 'admin'
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
  const [recentShifts, setRecentShifts] = useState<ShiftItem[]>(
    initialRecent.length > 0 ? initialRecent : DEFAULT_DEMO_SHIFTS
  )

  const [toast, setToast] = useState('')
  const [openModal, setOpenModal] = useState(false)
  const [closingShift, setClosingShift] = useState<ShiftItem | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<ShiftItem | null>(null)
  const [searchCashier, setSearchCashier] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'closed' | 'discrepancy'>('all')

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

  // Filter daftar riwayat shift
  const filteredShifts = useMemo(() => {
    return recentShifts.filter(s => {
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
  }, [recentShifts, filterTab, searchCashier])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
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

      {/* 4 Kartu KPI Interaktif */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
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
                    gridTemplateColumns: '1fr 1fr',
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

      {/* SECTION: Riwayat Shift & Audit Rekonsiliasi Kas */}
      <SectionCard
        title="Riwayat Sesi Shift & Rekonsiliasi Kas"
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
            <div className="search-pill" style={{ width: 220, padding: '5px 12px' }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KASIR</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>DURASI SESI</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KAS AWAL</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KAS SISTEM</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KAS FISIK (AKHIR)</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>SELISIH</th>
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
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 18, 24, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            padding: '28px 26px',
            width: '100%',
            maxWidth: 480,
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
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: 'var(--mute)' }}>Kas Modal Awal:</span>
                <span style={{ fontWeight: 600 }}>{formatRp(selectedDetail.initial_cash || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: 'var(--mute)' }}>Estimasi Kas Sistem:</span>
                <span style={{ fontWeight: 600, color: 'var(--acc)' }}>{formatRp(selectedDetail.expected_cash || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Kas Fisik Terhitung:</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{formatRp(selectedDetail.final_cash || 0)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 10,
                background: (selectedDetail.difference || 0) === 0 ? 'var(--oks)' : (selectedDetail.difference || 0) > 0 ? 'var(--accs)' : 'var(--bads)',
                color: (selectedDetail.difference || 0) === 0 ? 'var(--ok)' : (selectedDetail.difference || 0) > 0 ? 'var(--acc)' : 'var(--bad)',
                fontWeight: 700,
                fontSize: 14
              }}>
                <span>Selisih Rekonsiliasi:</span>
                <span>{(selectedDetail.difference || 0) >= 0 ? '+' : ''}{formatRp(selectedDetail.difference || 0)}</span>
              </div>
            </div>

            {selectedDetail.note && (
              <div style={{
                fontSize: 12.5,
                background: 'var(--bg)',
                padding: '10px 12px',
                borderRadius: 10,
                color: 'var(--mute)',
                marginBottom: 18
              }}>
                <strong>Catatan Kasir:</strong> {selectedDetail.note}
              </div>
            )}

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
