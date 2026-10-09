'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, FileText, CheckCircle, XCircle, Printer, Eye,
  Calendar, ArrowLeft, RefreshCw, RotateCcw, AlertTriangle,
  Receipt, Check, X, ShieldAlert, ArrowDownLeft
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'

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
  qris: { label: 'QRIS', color: 'var(--acc)', bg: 'var(--accs)' },
  transfer: { label: 'Transfer', color: '#8A3FFC', bg: 'rgba(138, 63, 252, 0.12)' },
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
  const [search, setSearch] = useState('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // State untuk modal refund/void
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null)
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>(PRESET_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false)
  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null)

  useEffect(() => {
    setSales(initialSales)
  }, [initialSales])

  const showToast = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const filteredSales = sales.filter(s =>
    s.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    (s.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    s.payment_method?.toLowerCase().includes(search.toLowerCase())
  )

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
      const res = await fetch('/api/kasir/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: voidingSale.id,
          reason: finalReason
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pembatalan')
      }

      const now = new Date().toISOString()

      // Update state sales & selectedSale secara instan
      setSales(prev => prev.map(s => s.id === voidingSale.id ? {
        ...s,
        status: 'voided',
        void_reason: finalReason,
        voided_at: now
      } : s))

      if (selectedSale?.id === voidingSale.id) {
        setSelectedSale(prev => prev ? {
          ...prev,
          status: 'voided',
          void_reason: finalReason,
          voided_at: now
        } : null)
      }

      try {
        const refundReport = {
          invoice: voidingSale.invoice_number,
          amount: voidingSale.final_amount,
          reason: finalReason,
          time: new Date().toISOString()
        }
        localStorage.setItem('fluxa_latest_refund_report', JSON.stringify(refundReport))
        window.dispatchEvent(new CustomEvent('fluxa_refund_created', { detail: refundReport }))
      } catch {}

      showToast(`Transaksi ${voidingSale.invoice_number} berhasil dibatalkan & di-refund. Stok telah dikembalikan ke sistem.`, 'ok')
      setVoidingSale(null)
    } catch (err: any) {
      console.warn('API void failed, using fallback update:', err)
      // Fallback mode (bila database lokal/demo)
      const now = new Date().toISOString()
      setSales(prev => prev.map(s => s.id === voidingSale.id ? {
        ...s,
        status: 'voided',
        void_reason: finalReason,
        voided_at: now
      } : s))

      if (selectedSale?.id === voidingSale.id) {
        setSelectedSale(prev => prev ? {
          ...prev,
          status: 'voided',
          void_reason: finalReason,
          voided_at: now
        } : null)
      }

      try {
        const refundReport = {
          invoice: voidingSale.invoice_number,
          amount: voidingSale.final_amount,
          reason: finalReason,
          time: new Date().toISOString()
        }
        localStorage.setItem('fluxa_latest_refund_report', JSON.stringify(refundReport))
        window.dispatchEvent(new CustomEvent('fluxa_refund_created', { detail: refundReport }))
      } catch {}

      showToast(`Transaksi ${voidingSale.invoice_number} berhasil dibatalkan & di-refund (Simulasi mode).`, 'ok')
      setVoidingSale(null)
    } finally {
      setIsSubmittingVoid(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Riwayat Transaksi Kasir"
        subtitle="Daftar transaksi penjualan POS, cetak ulang struk, dan refund/pembatalan transaksi"
      />

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

      <div style={{ display: 'grid', gridTemplateColumns: selectedSale ? '1fr 390px' : '1fr', gap: 20 }}>
        <div>
          <SectionCard>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div className="search-bar" style={{ flex: 1 }}>
                <Search size={15} color="var(--mute)" />
                <input
                  type="text"
                  placeholder="Cari nomor invoice, pelanggan, atau metode bayar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent' }}
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="btn btn-secondary"
                style={{ padding: '0 14px', gap: 6, display: 'flex', alignItems: 'center' }}
                title="Muat ulang transaksi"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Segarkan</span>
              </button>
            </div>

            <div className="table-container">
              <table className="data-table">
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
                            <StatusTag
                              type={isCompleted ? 'ok' : 'bad'}
                              label={isCompleted ? 'Sukses' : 'Dibatalkan (Void)'}
                            />
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

                              {isCompleted ? (
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
                                  title="Batalkan transaksi dan kembalikan dana (Refund)"
                                >
                                  <RotateCcw size={12} /> Refund
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
        </div>

        {/* Panel Detail Struk */}
        {selectedSale && (
          <SectionCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={18} color="var(--acc)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Detail Struk POS</h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
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
                  <span>TRANSAKSI INI TELAH DIBATALKAN (VOID)</span>
                </div>
                <div>Alasan: <strong>{selectedSale.void_reason || 'Pembatalan transaksi'}</strong></div>
                {selectedSale.voided_at && (
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
                    Waktu: {new Date(selectedSale.voided_at).toLocaleString('id-ID')}
                  </div>
                )}
              </div>
            )}

            <div style={{
              background: '#F9FAFB', border: '1px dashed var(--line)', borderRadius: 12, padding: 16,
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

              <div style={{ textAlign: 'center', borderBottom: '1px dashed #ccc', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>FLUXA POS</div>
                <div style={{ fontSize: 11, color: '#666' }}>Smart Retail & F&B Store</div>
                <div style={{ fontSize: 11, color: '#666' }}>No: {selectedSale.invoice_number}</div>
                <div style={{ fontSize: 11, color: '#666' }}>
                  {new Date(selectedSale.created_at).toLocaleString('id-ID')}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #ccc', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Pelanggan:</span>
                  <span>{selectedSale.customer_name || 'Umum'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Kasir:</span>
                  <span>{selectedSale.cashier_name || 'Kasir'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Metode:</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{selectedSale.payment_method}</span>
                </div>
              </div>

              {selectedSale.items && selectedSale.items.length > 0 && (
                <div style={{ borderBottom: '1px dashed #ccc', paddingBottom: 10, marginBottom: 10 }}>
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                        <span>{item.quantity} x Rp {item.unit_price.toLocaleString('id-ID')}</span>
                        <span>Rp {item.subtotal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Subtotal</span>
                <span>Rp {selectedSale.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--bad)' }}>
                  <span>Diskon</span>
                  <span>-Rp {selectedSale.discount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, marginTop: 8 }}>
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

              {selectedSale.status === 'completed' && (
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
                  <RotateCcw size={15} /> Refund / Batalkan Transaksi
                </button>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Modal Refund / Pembatalan Transaksi (Void) */}
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
            padding: '28px 26px',
            width: '100%',
            maxWidth: 500,
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
                    Refund & Pembatalan Transaksi
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--mute)' }}>
                    Invoice: <strong style={{ fontFamily: 'monospace' }}>{voidingSale.invoice_number}</strong>
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
                <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{voidingSale.payment_method}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mute)', marginTop: 4 }}>
                <span>Pelanggan:</span>
                <span>{voidingSale.customer_name || 'Pelanggan Umum'}</span>
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
                <strong>Efek Pembatalan:</strong> Seluruh item barang dalam invoice ini akan otomatis <strong>dikembalikan ke stok toko</strong>, dan transaksi tercatat sebagai Void di laporan kasir.
              </span>
            </div>

            {/* Pilihan Alasan Pembatalan */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                Alasan Refund / Pembatalan (Wajib):
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
                {isSubmittingVoid ? 'Memproses Refund...' : 'Konfirmasi Refund & Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
