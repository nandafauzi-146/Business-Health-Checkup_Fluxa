'use client'

import { useState, useEffect } from 'react'
import { Search, AlertTriangle, CheckCircle, XCircle, Eye, RefreshCw, X, ShieldAlert, Receipt, Calendar, User, CreditCard, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'
import PendingRefundRequests from '@/components/admin/PendingRefundRequests'
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
  items?: SaleItem[]
}

const paymentLabels: Record<string, { label: string; color: string; bg: string }> = {
  cash: { label: 'Tunai', color: 'var(--ok)', bg: 'var(--oks)' },
  non_cash: { label: 'Non-Tunai', color: 'var(--acc)', bg: 'var(--accs)' },
  qris: { label: 'Non-Tunai', color: 'var(--acc)', bg: 'var(--accs)' },
  transfer: { label: 'Non-Tunai', color: 'var(--acc)', bg: 'var(--accs)' },
  credit: { label: 'Kasbon', color: 'var(--warn)', bg: 'var(--warns)' }
}

export default function AdminTransactionsClient({ initialSales }: { initialSales: Sale[] }) {
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentYearMonth())
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const supabase = createClient()

  // Muat transaksi sesuai periode bulan yang dipilih
  useEffect(() => {
    let isMounted = true

    const fetchMonthSales = async () => {
      try {
        setLoadingMonth(true)
        const [year, month] = selectedMonth.split('-').map(Number)
        const startISO = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString()
        const endISO = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString()

        const { data, error } = await supabase
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
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching sales for month:', error)
          return
        }

        if (isMounted && data) {
          const formatted = data.map((s: any) => ({
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
            items: (s.sale_items || []).map((item: any) => ({
              id: item.id,
              product_name: item.products?.name || 'Produk',
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
            }))
          }))
          setSales(formatted)
        }
      } catch (err) {
        console.error('Error loading month sales:', err)
      } finally {
        if (isMounted) setLoadingMonth(false)
      }
    }

    fetchMonthSales()

    return () => {
      isMounted = false
    }
  }, [selectedMonth])

  useEffect(() => {
    if (!selectedSale && !voidDialogOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (voidDialogOpen) {
          setVoidDialogOpen(false)
        } else if (selectedSale) {
          setSelectedSale(null)
        }
      }
    }

    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = origOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedSale, voidDialogOpen])

  const filteredSales = sales.filter(s => {
    const inMonth = s.created_at ? s.created_at.slice(0, 7) === selectedMonth : true
    const matchesSearch = s.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.payment_method?.toLowerCase().includes(search.toLowerCase()) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(search.toLowerCase()))

    const matchesStatus = statusFilter === 'all' ? true : s.status === statusFilter
    return inMonth && matchesSearch && matchesStatus
  })

  const showNotification = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleVoidSale = async () => {
    if (!selectedSale || !voidReason.trim()) return
    setIsSubmitting(true)

    try {
      // Panggil RPC void_sale sesuai AGENTS.md & 0006_business_functions.sql
      const { error } = await supabase.rpc('void_sale', {
        p_sale_id: selectedSale.id,
        p_reason: voidReason.trim()
      })

      if (error) throw error

      showNotification(`Transaksi ${selectedSale.invoice_number} berhasil dibatalkan (void).`, 'ok')
      setSales(prev => prev.map(s => s.id === selectedSale.id ? { ...s, status: 'voided' } : s))
      setSelectedSale(prev => prev ? { ...prev, status: 'voided' } : null)
      setVoidDialogOpen(false)
      setVoidReason('')
    } catch (err: unknown) {
      console.error('Error voiding sale:', err)
      showNotification(getUserFacingError(err, 'Transaksi belum dapat dibatalkan. Silakan coba lagi.'), 'bad')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Daftar Transaksi Kasir"
        subtitle="Monitoring transaksi penjualan POS, rincian produk, dan pembatalan (void) yang aman"
      />

      <div style={{ marginBottom: 18 }}>
        <PendingRefundRequests />
      </div>

      {notification && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: notification.type === 'ok' ? 'var(--oks)' : 'var(--bads)',
          color: notification.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          fontWeight: 600,
          fontSize: 13,
          border: `1px solid ${notification.type === 'ok' ? 'var(--ok)' : 'var(--bad)'}`
        }}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
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
              Periode Transaksi
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--mute)' }}>
              {loadingMonth ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Loader2 size={11} className="spin" /> Memuat data {formatMonthIndo(selectedMonth)}...
                </span>
              ) : (
                `Menampilkan riwayat bulan ${formatMonthIndo(selectedMonth)}`
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

      {/* KPI Ringkasan Transaksi & Laporan Refund */}
      <div className="responsive-kpi">
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--ok)' }}>
          <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>Total Transaksi Selesai</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>
            {sales.filter(s => s.status === 'completed').length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)' }}>Transaksi</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>Periode {formatMonthIndo(selectedMonth)}</div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--acc)' }}>
          <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>Omzet Penjualan Sah</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--acc)', marginTop: 4 }}>
            <FormatRupiah amount={sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.final_amount, 0)} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>Periode {formatMonthIndo(selectedMonth)}</div>
        </div>

        <div className="card" style={{
          padding: '14px 16px',
          borderLeft: '4px solid var(--bad)',
          background: sales.some(s => s.status === 'voided') ? 'var(--bads)' : 'var(--panel)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={14} /> Laporan Refund / Void
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bad)', marginTop: 4 }}>
            {sales.filter(s => s.status === 'voided').length} <span style={{ fontSize: 13, fontWeight: 500 }}>Dibatalkan</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2 }}>
            Dana ter-refund: <strong style={{ color: 'var(--bad)' }}><FormatRupiah amount={sales.filter(s => s.status === 'voided').reduce((sum, s) => sum + s.final_amount, 0)} /></strong>
          </div>
        </div>
      </div>

      {/* Tabel Transaksi Full Width */}
      <SectionCard
        title={`Riwayat Transaksi — ${formatMonthIndo(selectedMonth)} (${filteredSales.length})`}
        action={
          loadingMonth ? (
            <span style={{ fontSize: 12, color: 'var(--mute)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={13} className="spin" /> Memperbarui...
            </span>
          ) : undefined
        }
      >
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 'min(260px, 100%)' }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari nomor transaksi atau metode pembayaran..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-tabs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
            >
              Semua ({sales.length})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`filter-tab ${statusFilter === 'completed' ? 'active' : ''}`}
            >
              Selesai ({sales.filter(s => s.status === 'completed').length})
            </button>
            <button
              onClick={() => setStatusFilter('voided')}
              className={`filter-tab ${statusFilter === 'voided' ? 'active' : ''}`}
              style={{
                color: statusFilter === 'voided' ? '#fff' : 'var(--bad)',
                background: statusFilter === 'voided' ? 'var(--bad)' : undefined,
                fontWeight: 700
              }}
            >
              Dibatalkan / Refund ({sales.filter(s => s.status === 'voided').length})
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Waktu</th>
                <th>Pelanggan</th>
                <th>Metode</th>
                <th>Total Belanja</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Tidak ada transaksi yang cocok dengan kriteria pencarian
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => {
                  const pay = paymentLabels[sale.payment_method] || { label: sale.payment_method, color: 'var(--ink)', bg: 'var(--bg)' }

                  return (
                    <tr key={sale.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Receipt size={14} color="var(--acc)" />
                          <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13, color: 'var(--ink)' }}>
                            {sale.invoice_number}
                          </span>
                        </div>
                        {sale.status === 'voided' && (
                          <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={11} /> {sale.void_reason || 'Refund Kasir'}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--mute)', whiteSpace: 'nowrap' }}>
                        {new Date(sale.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {sale.customer_name ? (
                          <span style={{ fontWeight: 500 }}>{sale.customer_name}</span>
                        ) : (
                          <span style={{ color: 'var(--mute)', fontStyle: 'italic' }}>Umum</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: pay.bg,
                          color: pay.color
                        }}>
                          {pay.label}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 13.5 }}>
                        <FormatRupiah amount={sale.final_amount} />
                      </td>
                      <td>
                        <StatusTag
                          type={sale.status === 'completed' ? 'ok' : 'bad'}
                          label={sale.status === 'completed' ? 'Selesai' : 'Void'}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '6px 12px' }}
                          title="Lihat Rincian Transaksi"
                        >
                          <Eye size={12} /> Rincian
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal Popup Rincian Transaksi (Muncul di Tengah) */}
      {selectedSale && (
        <div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setSelectedSale(null)}
          style={{ zIndex: 1100 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-rincian-title"
        >
          <div
            className="modal-content"
            style={{
              maxWidth: 540,
              width: '100%',
              padding: 'clamp(16px, 4vw, 24px)',
              maxHeight: 'min(90vh, 90dvh)',
              overflowY: 'auto',
              borderRadius: 18,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28)'
            }}
          >
            {/* Header Popup */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--accs)',
                  color: 'var(--acc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 id="modal-rincian-title" style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    Rincian Transaksi
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'monospace', marginTop: 2 }}>
                    {selectedSale.invoice_number}
                  </div>
                </div>
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

            {/* Status Banner */}
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: selectedSale.status === 'completed' ? 'var(--oks)' : 'var(--bads)',
              color: selectedSale.status === 'completed' ? 'var(--ok)' : 'var(--bad)',
              fontWeight: 600,
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <span>Status: {selectedSale.status === 'completed' ? 'Transaksi Sah (Selesai)' : 'Transaksi Dibatalkan (Void)'}</span>
              <StatusTag
                type={selectedSale.status === 'completed' ? 'ok' : 'bad'}
                label={selectedSale.status === 'completed' ? 'Selesai' : 'Void'}
              />
            </div>

            {/* Laporan Refund / Pembatalan Kasir Banner */}
            {selectedSale.status === 'voided' && (
              <div style={{
                background: 'var(--bads)',
                border: '1px solid var(--bad)',
                color: 'var(--bad)',
                padding: '12px 14px',
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 12.5
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                  <AlertTriangle size={15} />
                  <span>LAPORAN REFUND / PEMBATALAN TRANSAKSI</span>
                </div>
                <div>Alasan: <strong>{selectedSale.void_reason || 'Pembatalan transaksi oleh kasir'}</strong></div>
                {selectedSale.voided_at && (
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
                    Waktu Refund: {new Date(selectedSale.voided_at).toLocaleString('id-ID')}
                  </div>
                )}
              </div>
            )}

            {/* Transaction Meta */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
              padding: '12px 14px',
              background: 'var(--bg)',
              borderRadius: 12,
              border: '1px solid var(--line)',
              marginBottom: 16,
              fontSize: 12
            }}>
              <div>
                <span style={{ color: 'var(--mute)', display: 'block', marginBottom: 2 }}>Waktu Transaksi:</span>
                <strong style={{ color: 'var(--ink)' }}>{new Date(selectedSale.created_at).toLocaleString('id-ID')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--mute)', display: 'block', marginBottom: 2 }}>Metode Pembayaran:</span>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: paymentLabels[selectedSale.payment_method]?.bg || 'var(--panel)',
                  color: paymentLabels[selectedSale.payment_method]?.color || 'var(--ink)'
                }}>
                  {paymentLabels[selectedSale.payment_method]?.label || selectedSale.payment_method}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--mute)', display: 'block', marginBottom: 2 }}>Pelanggan:</span>
                <strong style={{ color: 'var(--ink)' }}>{selectedSale.customer_name || 'Umum'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--mute)', display: 'block', marginBottom: 2 }}>Kasir:</span>
                <strong style={{ color: 'var(--ink)' }}>{selectedSale.cashier_name || 'Kasir Toko'}</strong>
              </div>
            </div>

            {/* Purchased items list */}
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', color: 'var(--ink)' }}>
              Daftar Produk Dibeli:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
              {selectedSale.items && selectedSale.items.length > 0 ? (
                selectedSale.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--bg)',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      fontSize: 12.5
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.product_name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mute)', marginTop: 4 }}>
                      <span>{item.quantity} × <FormatRupiah amount={item.unit_price} /></span>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}><FormatRupiah amount={item.subtotal} /></span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: 'var(--mute)', fontStyle: 'italic', padding: '8px 0' }}>
                  Item produk tercatat dalam ringkasan POS
                </div>
              )}
            </div>

            {/* Amount Breakdown */}
            <div style={{
              background: 'var(--bg)',
              borderRadius: 12,
              padding: '12px 14px',
              border: '1px solid var(--line)',
              marginBottom: 18
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--mute)' }}>Subtotal Produk</span>
                <span><FormatRupiah amount={selectedSale.subtotal || selectedSale.final_amount} /></span>
              </div>
              {selectedSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--bad)', marginBottom: 6 }}>
                  <span>Potongan Diskon</span>
                  <span>-<FormatRupiah amount={selectedSale.discount} /></span>
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                borderTop: '1px dashed var(--line)',
                paddingTop: 8,
                marginTop: 4
              }}>
                <span>Total Bayar</span>
                <span style={{ color: 'var(--acc)' }}><FormatRupiah amount={selectedSale.final_amount} /></span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="btn btn-secondary"
                style={{ padding: '9px 18px' }}
              >
                Tutup
              </button>
              {selectedSale.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => setVoidDialogOpen(true)}
                  className="btn btn-danger"
                  style={{ padding: '9px 16px' }}
                >
                  <ShieldAlert size={15} /> Batalkan Transaksi (Void)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Void */}
      {voidDialogOpen && selectedSale && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && setVoidDialogOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bad)' }}>
                <ShieldAlert size={22} />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Konfirmasi Void Transaksi</h3>
              </div>
              <button className="icon-btn" onClick={() => setVoidDialogOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--bads)',
              border: '1px solid var(--bad)',
              color: 'var(--bad)',
              fontSize: 12.5,
              lineHeight: 1.5,
              marginBottom: 16
            }}>
              <strong>Peringatan Keamanan & Audit:</strong> Membatalkan transaksi{' '}
              <strong>{selectedSale.invoice_number}</strong> senilai{' '}
              <strong><FormatRupiah amount={selectedSale.final_amount} /></strong> akan secara otomatis:
              <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                <li>Mengembalikan seluruh stok barang ke inventaris.</li>
                <li>Mencatat tindakan ini di audit log sistem untuk akuntabilitas.</li>
              </ul>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="label" htmlFor="void-reason">
                Alasan Pembatalan (Wajib Diisi) *
              </label>
              <textarea
                id="void-reason"
                className="input"
                rows={3}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Contoh: Salah pilih produk kasir, pelanggan membatalkan pesanan..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVoidDialogOpen(false)}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleVoidSale}
                className="btn btn-danger"
                disabled={isSubmitting || !voidReason.trim()}
                style={{ background: 'var(--bad)', color: '#fff', border: 'none' }}
              >
                {isSubmitting ? 'Memproses Void...' : 'Ya, Batalkan Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { AdminTransactionsClient as TransactionsClient }
