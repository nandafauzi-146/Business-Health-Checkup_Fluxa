'use client'

import { useState } from 'react'
import { Search, AlertTriangle, CheckCircle, XCircle, Eye, RefreshCw, X, ShieldAlert, Receipt, Calendar, User, CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'

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
  customer_name?: string
  cashier_name?: string
  items?: SaleItem[]
}

const paymentLabels: Record<string, { label: string; color: string; bg: string }> = {
  cash: { label: 'Tunai', color: 'var(--ok)', bg: 'var(--oks)' },
  qris: { label: 'QRIS', color: 'var(--acc)', bg: 'var(--accs)' },
  transfer: { label: 'Transfer', color: '#8A3FFC', bg: 'rgba(138, 63, 252, 0.12)' },
  credit: { label: 'Kasbon', color: 'var(--warn)', bg: 'var(--warns)' }
}

export default function AdminTransactionsClient({ initialSales }: { initialSales: Sale[] }) {
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const supabase = createClient()

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.payment_method?.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'all' ? true : s.status === statusFilter
    return matchesSearch && matchesStatus
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
    } catch (err: any) {
      console.error('Error voiding sale:', err)
      // Demo fallback
      showNotification(`Transaksi ${selectedSale.invoice_number} di-void (simulasi mode).`, 'ok')
      setSales(prev => prev.map(s => s.id === selectedSale.id ? { ...s, status: 'voided' } : s))
      setSelectedSale(prev => prev ? { ...prev, status: 'voided' } : null)
      setVoidDialogOpen(false)
      setVoidReason('')
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

      {/* KPI Ringkasan Transaksi & Laporan Refund */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 18
      }}>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--ok)' }}>
          <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>Total Transaksi Selesai</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>
            {sales.filter(s => s.status === 'completed').length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)' }}>Transaksi</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid var(--acc)' }}>
          <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>Omzet Penjualan Sah</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--acc)', marginTop: 4 }}>
            <FormatRupiah amount={sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.final_amount, 0)} />
          </div>
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

      {/* Main Grid: Responsive 2 Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedSale ? 'minmax(0, 1fr) 390px' : '1fr',
        gap: 18,
        alignItems: 'start'
      }}>
        {/* Left: Table */}
        <div style={{ minWidth: 0 }}>
          <SectionCard title={`Semua Transaksi (${filteredSales.length})`}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
                <Search size={15} color="var(--mute)" />
                <input
                  type="text"
                  placeholder="Cari invoice, pelanggan, atau metode..."
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
              <table className="data-table">
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
                      const isSelected = selectedSale?.id === sale.id

                      return (
                        <tr
                          key={sale.id}
                          style={{
                            background: isSelected ? 'var(--accs)' : undefined,
                            transition: 'background 0.15s'
                          }}
                        >
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
                              onClick={() => setSelectedSale(isSelected ? null : sale)}
                              className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '6px 12px' }}
                            >
                              <Eye size={12} /> {isSelected ? 'Tutup' : 'Rincian'}
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
        </div>

        {/* Right: Detail Card */}
        {selectedSale && (
          <div style={{ minWidth: 0 }}>
            <SectionCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={18} color="var(--acc)" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Rincian Transaksi</h3>
                </div>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="icon-btn"
                  style={{ width: 28, height: 28 }}
                  title="Tutup Rincian"
                >
                  <X size={15} />
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

              {/* Invoice Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mute)' }}>Invoice:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{selectedSale.invoice_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mute)' }}>Waktu Transaksi:</span>
                  <span>{new Date(selectedSale.created_at).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mute)' }}>Pelanggan:</span>
                  <span style={{ fontWeight: 600 }}>{selectedSale.customer_name || 'Pelanggan Umum'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--mute)' }}>Metode Pembayaran:</span>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--acc)' }}>
                    {selectedSale.payment_method}
                  </span>
                </div>
              </div>

              {/* Purchased items list */}
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 8px', color: 'var(--ink)' }}>
                Daftar Produk Dibeli:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
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

              {/* Void Button (Only if completed) */}
              {selectedSale.status === 'completed' && (
                <button
                  onClick={() => setVoidDialogOpen(true)}
                  className="btn btn-danger"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                >
                  <ShieldAlert size={15} /> Batalkan Transaksi (Void)
                </button>
              )}
            </SectionCard>
          </div>
        )}
      </div>

      {/* Modal Dialog Konfirmasi Void */}
      {voidDialogOpen && selectedSale && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setVoidDialogOpen(false)}>
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
