'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, FileText, CheckCircle, XCircle, Printer, Eye,
  Calendar, ArrowLeft, RefreshCw, RotateCcw, AlertTriangle,
  Receipt, Check, X, ShieldAlert, ArrowDownLeft,
  ShoppingCart, CreditCard, TrendingUp, Wallet
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { getUserFacingError } from '@/lib/user-facing-error'
import { createClient } from '@/lib/supabase/client'
import MonthNavigator, { getCurrentYearMonth, formatMonthIndo } from '@/components/ui/MonthNavigator'

interface SaleItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface Sale {
  id: string
  invoice_number: string
  created_at: string
  payment_method: string
  subtotal: number
  discount: number
  final_amount: number
  status: string
  void_reason?: string
  voided_at?: string
  cashier_name?: string
  customer_name?: string
  refund_status?: 'pending' | 'approved' | 'rejected'
  refund_approver_name?: string | null
  items?: SaleItem[]
}

interface RefundRequest {
  sale_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewer?: { full_name: string } | null
}

const paymentLabels: Record<string, { label: string; color: string; bg: string }> = {
  cash: { label: 'Tunai', color: 'var(--ok)', bg: 'var(--oks)' },
  non_cash: { label: 'Non-Tunai', color: 'var(--acc)', bg: 'var(--accs)' },
  qris: { label: 'Non-Tunai', color: 'var(--acc)', bg: 'var(--accs)' },
  transfer: { label: 'Non-Tunai', color: 'var(--acc)', bg: 'var(--accs)' },
  credit: { label: 'Kasbon', color: 'var(--warn)', bg: 'var(--warns)' }
}

const PRESET_REASONS = [
  'Salah input barang atau jumlah pesanan',
  'Pelanggan membatalkan pesanan',
  'Barang rusak / komplain produk dari pelanggan',
  'Salah metode pembayaran / transaksi ganda'
]

export default function SalesHistoryClient({ initialSales }: { initialSales: Sale[] }) {
  const router = useRouter()
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentYearMonth())
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'cash' | 'non_cash' | 'refund'>('all')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const supabase = createClient()

  // State untuk modal refund/void
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null)
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>(PRESET_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false)
  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null)

  const [prevInitialSales, setPrevInitialSales] = useState(initialSales)
  if (initialSales !== prevInitialSales) {
    setPrevInitialSales(initialSales)
    setSales(initialSales)
  }

  // Kunci scroll halaman saat modal detail transaksi / void aktif
  useEffect(() => {
    if (!selectedSale && !voidingSale) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (voidingSale) setVoidingSale(null)
        else setSelectedSale(null)
      }
    }
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = origOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedSale, voidingSale])

  // Muat riwayat transaksi sesuai periode bulan yang dipilih
  useEffect(() => {
    let isMounted = true

    const fetchMonthSales = async () => {
      try {
        setLoadingMonth(true)
        const [year, month] = selectedMonth.split('-').map(Number)
        const startISO = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString()
        const endISO = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString()

        const [salesRes, refundsRes] = await Promise.all([
          supabase
            .from('sales')
            .select(`
              id,
              invoice_number,
              created_at,
              payment_method,
              total_amount,
              discount,
              final_amount,
              status,
              void_reason,
              voided_at,
              profiles:cashier_id (full_name),
              sale_items (
                id,
                quantity,
                unit_price,
                subtotal,
                products (name)
              )
            `)
            .gte('created_at', startISO)
            .lt('created_at', endISO)
            .order('created_at', { ascending: false }),
          supabase
            .from('refund_requests')
            .select('sale_id, status, created_at, reviewer:reviewed_by(full_name)')
        ])

        if (salesRes.error) {
          console.error('Error fetching sales history for month:', salesRes.error)
          return
        }

        const refundMap = new Map((refundsRes.data || []).map((r: any) => [
          r.sale_id,
          {
            status: r.status,
            approverName: r.reviewer?.full_name || null
          }
        ]))

        const formatted = (salesRes.data || []).map((s: any) => {
          const ref = refundMap.get(s.id)
          return {
            id: s.id,
            invoice_number: s.invoice_number,
            created_at: s.created_at,
            payment_method: s.payment_method,
            subtotal: s.total_amount,
            discount: s.discount,
            final_amount: s.final_amount,
            status: s.status,
            void_reason: s.void_reason,
            voided_at: s.voided_at,
            cashier_name: s.profiles?.full_name || null,
            refund_status: ref?.status,
            refund_approver_name: ref?.approverName,
            items: (s.sale_items || []).map((item: any) => ({
              id: item.id,
              product_name: item.products?.name || 'Produk',
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
            }))
          }
        })

        if (isMounted) {
          setSales(formatted)
        }
      } catch (err) {
        console.error('Error loading month sales:', err)
      } finally {
        if (isMounted) setLoadingMonth(false)
      }
    }

    fetchMonthSales()

    return () => { isMounted = false }
  }, [selectedMonth, supabase])

  const showToast = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  const refreshRefundStatuses = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/refund-requests', { cache: 'no-store' })
      const result: { requests?: RefundRequest[] } = await response.json()
      if (!response.ok || !Array.isArray(result.requests)) {
        throw new Error('Refund statuses could not be loaded.')
      }

      const latestBySale = new Map<string, RefundRequest>()
      for (const request of result.requests) {
        const existing = latestBySale.get(request.sale_id)
        if (!existing || request.created_at > existing.created_at) {
          latestBySale.set(request.sale_id, request)
        }
      }
      const statusBySale = new Map(
        [...latestBySale].map(([saleId, request]) => [saleId, request.status] as const),
      )
      const approverBySale = new Map(
        [...latestBySale].map(([saleId, request]) => [
          saleId,
          request.status === 'approved' ? request.reviewer?.full_name || null : null,
        ] as const),
      )

      setSales(current => current.map(sale => ({
        ...sale,
        refund_status: statusBySale.get(sale.id),
        refund_approver_name: approverBySale.get(sale.id),
      })))
      setSelectedSale(current => current
        ? {
            ...current,
            refund_status: statusBySale.get(current.id),
            refund_approver_name: approverBySale.get(current.id),
          }
        : null)
    } catch (error) {
      console.warn('Could not refresh cashier refund statuses:', error)
    }
  }, [])

  useEffect(() => {
    void refreshRefundStatuses()
    const intervalId = window.setInterval(() => void refreshRefundStatuses(), 30_000)
    window.addEventListener('focus', refreshRefundStatuses)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshRefundStatuses)
    }
  }, [initialSales, refreshRefundStatuses])

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    void refreshRefundStatuses()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const setRefundStatus = (saleId: string, status: Sale['refund_status']) => {
    setSales(current => current.map(sale => sale.id === saleId
      ? { ...sale, refund_status: status }
      : sale))
    setSelectedSale(current => current?.id === saleId
      ? { ...current, refund_status: status }
      : current)
  }

  const stats = useMemo(() => {
    const monthSales = sales.filter(s => !s.created_at || s.created_at.slice(0, 7) === selectedMonth)
    const totalCount = monthSales.length
    const completed = monthSales.filter(s => s.status === 'completed')
    const totalRevenue = completed.reduce((sum, s) => sum + (s.final_amount || 0), 0)
    const cashCount = completed.filter(s => s.payment_method === 'cash').length
    const nonCashCount = completed.filter(s => s.payment_method !== 'cash' && s.payment_method !== 'credit').length
    const refundPendingCount = monthSales.filter(s => s.refund_status === 'pending').length
    const voidedCount = monthSales.filter(s => s.status === 'voided').length
    return {
      totalCount,
      completedCount: completed.length,
      totalRevenue,
      cashCount,
      nonCashCount,
      refundPendingCount,
      voidedCount,
      totalRefundAction: refundPendingCount + voidedCount
    }
  }, [sales, selectedMonth])

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // Filter periode bulan
      if (s.created_at && s.created_at.slice(0, 7) !== selectedMonth) return false

      const q = search.trim().toLowerCase()
      const matchesSearch = !q ||
        s.invoice_number?.toLowerCase().includes(q) ||
        s.payment_method?.toLowerCase().includes(q) ||
        (s.cashier_name && s.cashier_name.toLowerCase().includes(q)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q))

      if (!matchesSearch) return false

      if (filterTab === 'cash') return s.payment_method === 'cash' && s.status === 'completed'
      if (filterTab === 'non_cash') return s.payment_method !== 'cash' && s.payment_method !== 'credit' && s.status === 'completed'
      if (filterTab === 'refund') return s.refund_status === 'pending' || s.status === 'voided'
      return true
    })
  }, [sales, selectedMonth, search, filterTab])

  const printReceipt = () => {
    window.print()
  }

  const openVoidModal = (sale: Sale) => {
    setVoidingSale(sale)
    setSelectedPresetReason(PRESET_REASONS[0])
    setCustomReason('')
  }

  const handleConfirmVoid = async () => {
    if (!voidingSale) return
    setIsSubmittingVoid(true)

    const finalReason = customReason.trim()
      ? `${selectedPresetReason}: ${customReason.trim()}`
      : selectedPresetReason

    try {
      const res = await fetch('/api/admin/refund-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: voidingSale.id,
          reason: finalReason
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pengajuan refund')
      }

      showToast(`Pengajuan refund ${voidingSale.invoice_number} dikirim dan menunggu persetujuan Admin.`, 'ok')
      setRefundStatus(voidingSale.id, 'pending')
      setVoidingSale(null)
    } catch (err: unknown) {
      showToast(getUserFacingError(err, 'Pengajuan pembatalan belum dapat dikirim. Silakan coba lagi.'), 'bad')
    } finally {
      setIsSubmittingVoid(false)
    }
  }

  return (
    <div className="sales-history-page">
      <PageHeader
        title="Riwayat Transaksi Kasir"
        subtitle="Daftar transaksi penjualan POS, cetak ulang struk, dan ajukan refund untuk ditinjau Admin"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10 }}
              title="Segarkan data transaksi"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
            <button
              onClick={() => router.push('/kasir')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10 }}
              title="Kembali ke layar kasir POS"
            >
              <ShoppingCart size={15} />
              <span>Buka Kasir POS</span>
            </button>
          </div>
        }
      />

      {/* Toolbar Pemilih Periode Bulanan */}
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
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--accs)',
            color: 'var(--acc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              Periode Riwayat Transaksi
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--mute)' }}>
              {loadingMonth ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={11} className="spin" /> Memuat transaksi {formatMonthIndo(selectedMonth)}...
                </span>
              ) : (
                `Menampilkan riwayat kasir bulan ${formatMonthIndo(selectedMonth)}`
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

      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
        gap: 14,
        marginBottom: 20
      }}>
        {/* Total Transaksi */}
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--acc)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--mute)', fontWeight: 600 }}>Total Transaksi</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accs)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={15} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginTop: 6 }}>
            {stats.totalCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)' }}>struk</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            {stats.completedCount} transaksi sukses tercatat
          </span>
        </div>

        {/* Total Omzet Penjualan */}
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--ok)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--mute)', fontWeight: 600 }}>Total Penjualan POS</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--oks)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={15} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ok)', marginTop: 6 }}>
            <FormatRupiah amount={stats.totalRevenue} />
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Akumulasi omzet kasir
          </span>
        </div>

        {/* Metode Pembayaran */}
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--mute)', fontWeight: 600 }}>Metode Transaksi</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={15} />
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span><strong style={{ color: 'var(--ok)' }}>{stats.cashCount}</strong> Tunai</span>
            <span style={{ color: 'var(--mute)' }}>•</span>
            <span><strong style={{ color: 'var(--acc)' }}>{stats.nonCashCount}</strong> Non-Tunai</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Rasio pembayaran pelanggan
          </span>
        </div>

        {/* Status Refund */}
        <div className="card" style={{
          padding: '14px 18px',
          borderLeft: `4px solid ${stats.totalRefundAction > 0 ? 'var(--bad)' : 'var(--line)'}`,
          background: stats.refundPendingCount > 0 ? 'var(--bads)' : 'var(--panel)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: stats.totalRefundAction > 0 ? 'var(--bad)' : 'var(--mute)'
            }}>
              Pengajuan Retur / Void
            </span>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: stats.totalRefundAction > 0 ? 'var(--bads)' : 'var(--bg)',
              color: stats.totalRefundAction > 0 ? 'var(--bad)' : 'var(--mute)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <RotateCcw size={15} />
            </div>
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: 800,
            color: stats.totalRefundAction > 0 ? 'var(--bad)' : 'var(--ink)',
            marginTop: 6
          }}>
            {stats.refundPendingCount > 0
              ? `${stats.refundPendingCount} Menunggu Admin`
              : stats.voidedCount > 0
              ? `${stats.voidedCount} Dibatalkan`
              : 'Tidak Ada Retur'}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            {stats.refundPendingCount > 0 ? 'Segera tinjau persetujuan Admin' : 'Riwayat retur aman'}
          </span>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: toast.type === 'ok' ? 'var(--oks)' : 'var(--bads)',
          color: toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          fontWeight: 600,
          fontSize: 13,
          border: `1px solid ${toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{toast.text}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      <SectionCard
        title={`Riwayat Transaksi — ${formatMonthIndo(selectedMonth)} (${filteredSales.length})`}
        action={
          loadingMonth ? (
            <span style={{ fontSize: 12, color: 'var(--mute)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} className="spin" /> Memperbarui...
            </span>
          ) : undefined
        }
      >
            {/* Filter Tabs & Search Row */}
            <div style={{
              display: 'flex',
              gap: 12,
              marginBottom: 18,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {/* Segmented Filter Tabs */}
              <div style={{
                display: 'inline-flex',
                background: 'var(--bg)',
                padding: 4,
                borderRadius: 10,
                border: '1px solid var(--line)',
                gap: 4,
                maxWidth: '100%',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch'
              }}>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: filterTab === 'all' ? 'var(--panel)' : 'transparent',
                    color: filterTab === 'all' ? 'var(--ink)' : 'var(--mute)',
                    boxShadow: filterTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Semua ({stats.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('cash')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: filterTab === 'cash' ? 'var(--panel)' : 'transparent',
                    color: filterTab === 'cash' ? 'var(--ok)' : 'var(--mute)',
                    boxShadow: filterTab === 'cash' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Tunai ({stats.cashCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('non_cash')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 7,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: filterTab === 'non_cash' ? 'var(--panel)' : 'transparent',
                    color: filterTab === 'non_cash' ? 'var(--acc)' : 'var(--mute)',
                    boxShadow: filterTab === 'non_cash' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Non-Tunai ({stats.nonCashCount})
                </button>
                {stats.totalRefundAction > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab('refund')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 7,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: filterTab === 'refund' ? 'var(--panel)' : 'transparent',
                      color: filterTab === 'refund' ? 'var(--bad)' : 'var(--mute)',
                      boxShadow: filterTab === 'refund' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Retur / Void ({stats.totalRefundAction})
                  </button>
                )}
              </div>

              {/* Search Bar */}
              <div className="search-bar" style={{ minWidth: 'min(220px, 100%)', flex: '1 1 220px', maxWidth: 420 }}>
                <Search size={15} color="var(--mute)" />
                <input
                  type="text"
                  placeholder="Cari nomor invoice, metode, atau pelanggan..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent' }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: '0 4px', fontSize: 13 }}
                    title="Hapus pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="table-container">
              <table className="data-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Waktu</th>
                    <th>Kasir</th>
                    <th>Pelanggan</th>
                    <th>Metode</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                        Belum ada riwayat transaksi ditemukan
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(sale => {
                      const pm = paymentLabels[sale.payment_method] || { label: sale.payment_method.toUpperCase(), color: 'var(--mute)', bg: 'var(--border)' }
                      const isCompleted = sale.status === 'completed'
                      const refundPending = sale.refund_status === 'pending'

                      return (
                        <tr key={sale.id} style={{ background: selectedSale?.id === sale.id ? 'var(--accs)' : undefined }}>
                          <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{sale.invoice_number}</td>
                          <td style={{ fontSize: 13, color: 'var(--mute)' }}>
                            {new Date(sale.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--body)' }}>{sale.cashier_name || 'Kasir'}</td>
                          <td>{sale.customer_name || 'Umum'}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              color: pm.color,
                              background: pm.bg
                            }}>
                              {pm.label}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            <FormatRupiah amount={sale.final_amount} />
                          </td>
                          <td>
                            {refundPending ? (
                              <StatusTag type="warn" label="Refund Dalam Proses" />
                            ) : (
                              <StatusTag
                                type={isCompleted ? 'ok' : 'bad'}
                                label={isCompleted ? sale.refund_status === 'rejected' ? 'Refund Ditolak' : 'Sukses' : 'Refund'}
                              />
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => setSelectedSale(sale)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: 12 }}
                                title="Lihat Struk Transaksi"
                              >
                                <Eye size={13} /> Detail
                              </button>

                              {isCompleted && refundPending ? (
                                <button
                                  type="button"
                                  disabled
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: 12, cursor: 'default', opacity: 0.8 }}
                                  aria-label="Refund sedang menunggu persetujuan Admin"
                                >
                                  <RotateCcw size={12} /> Refund Dalam Proses
                                </button>
                              ) : isCompleted ? (
                                <button
                                  id={`refund-btn-${sale.id}`}
                                  onClick={() => openVoidModal(sale)}
                                  className="btn btn-danger"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: 12,
                                    background: 'var(--bads)',
                                    borderColor: 'var(--bad)',
                                    color: 'var(--bad)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Ajukan refund untuk ditinjau Admin"
                                >
                                  <RotateCcw size={12} /> Ajukan Refund
                                </button>
                              ) : (
                                <span style={{
                                  fontSize: 11,
                                  color: 'var(--mute)',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  background: 'var(--bg)'
                                }}>
                                  Voided
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

      {/* Modal Popup Detail Transaksi di Tengah Layar */}
      {selectedSale && (
        <div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setSelectedSale(null)}
          style={{ zIndex: 1100 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-pos-detail-title"
        >
          <div
            className="modal-content"
            style={{
              maxWidth: 520,
              width: '100%',
              padding: 'clamp(16px, 4vw, 24px)',
              maxHeight: 'min(90vh, 90dvh, calc(100dvh - 32px))',
              overflowY: 'auto',
              borderRadius: 18,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={18} color="var(--acc)" />
                <h3 id="modal-pos-detail-title" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                  Detail Struk Transaksi
                </h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="icon-btn"
                style={{ width: 32, height: 32, borderRadius: 8 }}
                title="Tutup Rincian"
                aria-label="Tutup Rincian Transaksi"
              >
                <X size={16} />
              </button>
            </div>

            {/* Banner Khusus Transaksi Void */}
            {selectedSale.status === 'voided' && (
              <div style={{
                background: 'var(--bads)',
                border: '1px solid var(--bad)',
                color: 'var(--bad)',
                padding: '12px 14px',
                borderRadius: 10,
                marginBottom: 14,
                fontSize: 12.5
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                  <AlertTriangle size={15} />
                  <span>TRANSAKSI INI TELAH DIBATALKAN (REFUND)</span>
                </div>
                <div>Alasan: <strong>{selectedSale.void_reason || 'Pembatalan transaksi'}</strong></div>
                {selectedSale.voided_at && (
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
                    Waktu: {new Date(selectedSale.voided_at).toLocaleString('id-ID')}
                  </div>
                )}
                {selectedSale.refund_status === 'approved' && (
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
                    Disetujui oleh: <strong>{selectedSale.refund_approver_name || 'Admin'}</strong>
                  </div>
                )}
              </div>
            )}

            <div style={{
              background: 'var(--bg)', border: '1px dashed var(--line)', borderRadius: 12, padding: 16,
              fontFamily: 'monospace', fontSize: 13, marginBottom: 16,
              position: 'relative'
            }}>
              {selectedSale.status === 'voided' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none', opacity: 0.12,
                  fontWeight: 900, fontSize: 38, color: 'var(--bad)',
                  transform: 'rotate(-25deg)', letterSpacing: 4
                }}>
                  VOID / REFUND
                </div>
              )}

              <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--line)', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>FLUXA POS</div>
                <div style={{ fontSize: 11, color: 'var(--mute)' }}>Smart Retail & F&B Store</div>
                <div style={{ fontSize: 11, color: 'var(--mute)' }}>No. Transaksi: {selectedSale.invoice_number}</div>
                <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                  {new Date(selectedSale.created_at).toLocaleString('id-ID')}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--mute)' }}>Kasir:</span>
                  <span style={{ color: 'var(--ink)' }}>{selectedSale.cashier_name || 'Kasir'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--mute)' }}>Metode:</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{paymentLabels[selectedSale.payment_method]?.label || selectedSale.payment_method}</span>
                </div>
              </div>

              {selectedSale.items && selectedSale.items.length > 0 && (
                <div style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 10, marginBottom: 10 }}>
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.product_name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mute)', fontSize: 12 }}>
                        <span>{item.quantity} x Rp {item.unit_price.toLocaleString('id-ID')}</span>
                        <span style={{ color: 'var(--ink)' }}>Rp {item.subtotal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--ink)' }}>
                <span style={{ color: 'var(--mute)' }}>Subtotal</span>
                <span>Rp {selectedSale.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--bad)' }}>
                  <span>Diskon</span>
                  <span>-Rp {selectedSale.discount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginTop: 8, color: 'var(--ink)' }}>
                <span>TOTAL</span>
                <span style={{ textDecoration: selectedSale.status === 'voided' ? 'line-through' : 'none' }}>
                  Rp {selectedSale.final_amount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={printReceipt}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Printer size={15} /> Cetak Struk
              </button>

              {selectedSale.status === 'completed' && selectedSale.refund_status === 'pending' ? (
                <button
                  type="button"
                  disabled
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', cursor: 'default', opacity: 0.8 }}
                >
                  <RotateCcw size={15} /> Refund Dalam Proses
                </button>
              ) : selectedSale.status === 'completed' && (
                <button
                  onClick={() => openVoidModal(selectedSale)}
                  className="btn btn-danger"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    background: 'var(--bads)',
                    borderColor: 'var(--bad)',
                    color: 'var(--bad)',
                    fontWeight: 600
                  }}
                >
                  <RotateCcw size={15} /> Ajukan Refund
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Struk thermal untuk window.print() */}
      {selectedSale && (
        <div className="thermal-receipt" aria-hidden="true">
          <header>
            <strong>FLUXA POS</strong>
            <span>{selectedSale.status === 'voided' ? 'Bukti Transaksi Dibatalkan' : 'Bukti Pembayaran'}</span>
          </header>
          {selectedSale.status === 'voided' && (
            <div className="thermal-receipt-meta"><strong>TRANSAKSI VOID / REFUND</strong></div>
          )}
          <div className="thermal-receipt-meta">
            <div>No. Transaksi: {selectedSale.invoice_number}</div>
            <div>{new Date(selectedSale.created_at).toLocaleString('id-ID')}</div>
            <div>Kasir: {selectedSale.cashier_name || 'Kasir'}</div>
            <div>Metode: {paymentLabels[selectedSale.payment_method]?.label || selectedSale.payment_method}</div>
          </div>
          <div className="thermal-receipt-items">
            {(selectedSale.items || []).map(item => (
              <div className="thermal-receipt-item" key={item.id}>
                <div>{item.product_name}</div>
                <div className="thermal-receipt-line">
                  <span>{item.quantity} x Rp {item.unit_price.toLocaleString('id-ID')}</span>
                  <span>Rp {item.subtotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="thermal-receipt-totals">
            <div>
              <span>Subtotal</span>
              <span>Rp {selectedSale.subtotal.toLocaleString('id-ID')}</span>
            </div>
            {selectedSale.discount > 0 && (
              <div>
                <span>Diskon</span>
                <span>-Rp {selectedSale.discount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="thermal-receipt-total">
              <strong>TOTAL</strong>
              <strong>Rp {selectedSale.final_amount.toLocaleString('id-ID')}</strong>
            </div>
          </div>
          {selectedSale.status === 'voided' && selectedSale.void_reason && (
            <div className="thermal-receipt-meta">Alasan void: {selectedSale.void_reason}</div>
          )}
          <footer>Terima kasih atas kunjungan Anda</footer>
        </div>
      )}

      {/* Modal pengajuan refund untuk persetujuan Admin */}
      {voidingSale && (
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
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            padding: 'clamp(18px, 4vw, 28px) clamp(16px, 4vw, 26px)',
            width: '100%',
            maxWidth: 500,
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            position: 'relative'
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'var(--bads)', color: 'var(--bad)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    Ajukan Refund Transaksi
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--mute)' }}>
                    No. Transaksi: <strong style={{ fontFamily: 'monospace' }}>{voidingSale.invoice_number}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setVoidingSale(null)}
                disabled={isSubmittingVoid}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Rincian Finansial & Pengembalian Dana */}
            <div style={{
              background: 'var(--bg)',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 16,
              border: '1px solid var(--line)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--mute)' }}>Nilai Pengembalian Dana:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--bad)' }}>
                  Rp {voidingSale.final_amount.toLocaleString('id-ID')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mute)' }}>
                <span>Metode Pembayaran Asal:</span>
                <span style={{ fontWeight: 600 }}>{paymentLabels[voidingSale.payment_method]?.label || voidingSale.payment_method}</span>
              </div>
            </div>

            {/* Peringatan Stok */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--warns)',
              color: 'var(--warn)',
              fontSize: 12,
              marginBottom: 16
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>Efek Pembatalan:</strong> Seluruh item barang dalam transaksi ini akan otomatis <strong>dikembalikan ke stok toko</strong>, dan transaksi tercatat sebagai Refund/Batal di laporan kasir.
              </span>
            </div>

            {/* Pilihan Alasan Pembatalan */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                Alasan Refund (Wajib):
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {PRESET_REASONS.map(reason => (
                  <label
                    key={reason}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12.5,
                      color: 'var(--ink)',
                      padding: '7px 10px',
                      borderRadius: 8,
                      background: selectedPresetReason === reason ? 'var(--accs)' : 'transparent',
                      cursor: 'pointer',
                      border: selectedPresetReason === reason ? '1px solid var(--acc)' : '1px solid transparent'
                    }}
                  >
                    <input
                      type="radio"
                      name="void_reason_preset"
                      checked={selectedPresetReason === reason}
                      onChange={() => setSelectedPresetReason(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {/* Input Catatan Tambahan */}
              <input
                type="text"
                placeholder="Catatan tambahan kasir (opsional)..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  fontSize: 12.5,
                  color: 'var(--ink)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Tombol Aksi */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setVoidingSale(null)}
                disabled={isSubmittingVoid}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '11px 0' }}
              >
                Batal
              </button>
              <button
                type="button"
                id="konfirmasi-refund-submit-btn"
                onClick={handleConfirmVoid}
                disabled={isSubmittingVoid}
                className="btn"
                style={{
                  flex: 2,
                  justifyContent: 'center',
                  background: 'var(--bad)',
                  color: '#fff',
                  fontWeight: 600,
                  padding: '11px 0',
                  boxShadow: '0 4px 14px rgba(229, 72, 77, 0.3)'
                }}
              >
                {isSubmittingVoid ? 'Mengirim pengajuan...' : 'Kirim Pengajuan Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
