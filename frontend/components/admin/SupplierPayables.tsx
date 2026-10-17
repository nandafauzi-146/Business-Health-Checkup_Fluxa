'use client'

import { useState } from 'react'
import { Plus, Search, Building2, AlertCircle, CheckCircle, Clock, Calendar, X, Check, CreditCard, ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'

interface SupplierPayable {
  id: string
  supplier_name: string
  description: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  due_date: string | null
  status: 'unpaid' | 'partial' | 'paid'
  note: string | null
  created_at: string
}

const DEMO_DATA: SupplierPayable[] = [
  {
    id: 'd1', supplier_name: 'CV Maju Jaya', description: 'Beli tepung terigu 100kg', total_amount: 1500000, paid_amount: 500000, remaining_amount: 1000000,
    due_date: '2026-10-30', status: 'partial', note: null, created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'd2', supplier_name: 'UD Sumber Rezeki', description: 'Beli gula pasir 50kg', total_amount: 800000, paid_amount: 0, remaining_amount: 800000,
    due_date: '2026-10-20', status: 'unpaid', note: 'Bayar setelah panen', created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'd3', supplier_name: 'Toko Bahan Mas Budi', description: 'Minyak goreng 20 liter', total_amount: 600000, paid_amount: 600000, remaining_amount: 0,
    due_date: null, status: 'paid', note: null, created_at: new Date(Date.now() - 86400000 * 10).toISOString()
  },
]

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SupplierPayablesClient({
  initialData,
}: {
  initialData: SupplierPayable[]
}) {
  const supabase = createClient()
  const [data, setData] = useState<SupplierPayable[]>(initialData.length > 0 ? initialData : DEMO_DATA)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all')

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ supplier_name: '', description: '', total_amount: '', due_date: '', note: '' })

  // Pay modal
  const [payOpen, setPayOpen] = useState(false)
  const [selected, setSelected] = useState<SupplierPayable | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'qris' | 'transfer'>('cash')
  const [payNote, setPayNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'bad'; msg: string } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const getErrMsg = (err: any): string => {
    if (!err) return 'Terjadi kesalahan'
    if (err.message) return err.message
    return JSON.stringify(err)
  }

  const totalUnpaid = data.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)
  const totalPaid   = data.reduce((s, d) => s + d.paid_amount, 0)
  const totalAll    = data.reduce((s, d) => s + d.total_amount, 0)

  const filtered = data.filter(d => {
    const matchSearch = d.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' ? true : d.status === statusFilter
    return matchSearch && matchStatus
  })

  // ── Tambah Hutang ──────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseInt(form.total_amount.replace(/\D/g, ''))
    if (!form.supplier_name || !form.description || !amount) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Belum login')

      const { data: row, error } = await supabase
        .from('supplier_payables')
        .insert({
          supplier_name: form.supplier_name.trim(),
          description: form.description.trim(),
          total_amount: amount,
          paid_amount: 0,
          due_date: form.due_date || null,
          status: 'unpaid',
          note: form.note.trim() || null,
          created_by: user.id,
        })
        .select('*')
        .single()

      if (error) throw error

      const newRow: SupplierPayable = { ...row, remaining_amount: row.total_amount - row.paid_amount }
      setData(prev => [newRow, ...prev])
      showToast(`Hutang ke ${form.supplier_name} sebesar ${formatRp(amount)} berhasil dicatat.`, 'ok')
    } catch (err: any) {
      // Demo fallback
      const dummy: SupplierPayable = {
        id: Math.random().toString(),
        supplier_name: form.supplier_name,
        description: form.description,
        total_amount: amount,
        paid_amount: 0,
        remaining_amount: amount,
        due_date: form.due_date || null,
        status: 'unpaid',
        note: form.note || null,
        created_at: new Date().toISOString(),
      }
      setData(prev => [dummy, ...prev])
      const msg = getErrMsg(err)
      showToast(msg && msg !== '{}' ? `Gagal simpan: ${msg}` : `Hutang ke ${form.supplier_name} dicatat (mode demo).`, msg && msg !== '{}' ? 'bad' : 'ok')
    } finally {
      setSaving(false)
      setAddOpen(false)
      setForm({ supplier_name: '', description: '', total_amount: '', due_date: '', note: '' })
    }
  }

  // ── Bayar Hutang ──────────────────────────────────────────────
  const handleOpenPay = (row: SupplierPayable) => {
    setSelected(row)
    setPayAmount((row.total_amount - row.paid_amount).toLocaleString('id-ID'))
    setPayMethod('cash')
    setPayNote('')
    setPayOpen(true)
  }

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    const amount = parseInt(payAmount.replace(/\D/g, ''))
    const remaining = selected.total_amount - selected.paid_amount
    if (!amount || amount <= 0) return
    if (amount > remaining) {
      showToast(`Nominal melebihi sisa hutang (${formatRp(remaining)})`, 'bad')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Belum login')

      const { error: payErr } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_payable_id: selected.id,
          amount,
          payment_method: payMethod,
          note: payNote.trim() || null,
          created_by: user.id,
        })
      if (payErr) throw payErr

      const newPaid = selected.paid_amount + amount
      const newStatus = newPaid >= selected.total_amount ? 'paid' : 'partial'
      const { error: updErr } = await supabase
        .from('supplier_payables')
        .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selected.id)
      if (updErr) throw updErr

      setData(prev => prev.map(r => r.id === selected.id ? {
        ...r, paid_amount: newPaid, remaining_amount: r.total_amount - newPaid, status: newStatus as any
      } : r))
      showToast(`Pembayaran ${formatRp(amount)} ke ${selected.supplier_name} berhasil.`, 'ok')
    } catch (err: any) {
      // Demo fallback
      const newPaid = selected.paid_amount + amount
      const newStatus = newPaid >= selected.total_amount ? 'paid' : 'partial'
      setData(prev => prev.map(r => r.id === selected.id ? {
        ...r, paid_amount: newPaid, remaining_amount: r.total_amount - newPaid, status: newStatus as any
      } : r))
      const msg = getErrMsg(err)
      showToast(msg && msg !== '{}' ? `Gagal: ${msg}` : `Pembayaran dicatat (mode demo).`, msg && msg !== '{}' ? 'bad' : 'ok')
    } finally {
      setSaving(false)
      setPayOpen(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  const statusColor = (s: string) => s === 'paid' ? 'var(--ok)' : s === 'partial' ? 'var(--warn)' : 'var(--bad)'
  const statusBg    = (s: string) => s === 'paid' ? 'var(--oks)' : s === 'partial' ? 'var(--warns)' : 'var(--bads)'
  const statusLabel = (s: string) => s === 'paid' ? 'Lunas' : s === 'partial' ? 'Sebagian' : 'Belum Bayar'
  const StatusIcon  = ({ s }: { s: string }) =>
    s === 'paid' ? <CheckCircle size={13} /> : s === 'partial' ? <Clock size={13} /> : <AlertCircle size={13} />

  return (
    <div>
      <PageHeader
        title="Hutang ke Supplier"
        subtitle="Catat pembelian bahan baku / barang yang dibayar belakangan ke pemasok"
        actions={
          <button id="tambah-hutang-btn" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Catat Hutang Baru
          </button>
        }
      />

      {/* Ringkasan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Hutang Beredar', val: totalUnpaid, color: 'var(--bad)', bg: 'var(--bads)' },
          { label: 'Total Sudah Dibayar', val: totalPaid, color: 'var(--ok)', bg: 'var(--oks)' },
          { label: 'Total Semua Tagihan', val: totalAll, color: 'var(--acc)', bg: 'var(--accs)' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 14, padding: '14px 18px', border: `1.5px solid ${color}22` }}>
            <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{formatRp(val)}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
          <Search size={14} color="var(--mute)" />
          <input
            placeholder="Cari supplier atau keterangan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {(['all', 'unpaid', 'partial', 'paid'] as const).map(s => (
            <button key={s} className={`filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Semua' : statusLabel(s)}
              {' '}({s === 'all' ? data.length : data.filter(d => d.status === s).length})
            </button>
          ))}
        </div>
      </div>

      {/* Tabel */}
      <SectionCard title={`Daftar Hutang Supplier (${filtered.length})`}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier / Pemasok</th>
                <th>Keterangan Pembelian</th>
                <th>Total Hutang</th>
                <th>Sudah Dibayar</th>
                <th>Sisa Hutang</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    <Building2 size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                    Belum ada data hutang supplier
                  </td>
                </tr>
              ) : filtered.map(row => {
                const overdue = row.status !== 'paid' && row.due_date && new Date(row.due_date) < new Date()
                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, background: 'var(--accs)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Building2 size={16} color="var(--acc)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.supplier_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mute)' }}>{formatDate(row.created_at)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</div>
                      {row.note && <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{row.note}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatRp(row.total_amount)}</td>
                    <td style={{ color: 'var(--ok)', fontWeight: 600 }}>{formatRp(row.paid_amount)}</td>
                    <td style={{ fontWeight: 700, color: row.remaining_amount > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                      {formatRp(row.total_amount - row.paid_amount)}
                    </td>
                    <td>
                      {row.due_date ? (
                        <span style={{ fontSize: 12, color: overdue ? 'var(--bad)' : 'var(--ink)', fontWeight: overdue ? 700 : 400 }}>
                          {overdue && '⚠ '}{formatDate(row.due_date)}
                        </span>
                      ) : <span style={{ color: 'var(--mute)' }}>—</span>}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: statusBg(row.status), color: statusColor(row.status)
                      }}>
                        <StatusIcon s={row.status} /> {statusLabel(row.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.status !== 'paid' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenPay(row)}
                          id={`bayar-hutang-${row.id}`}
                        >
                          <CreditCard size={12} /> Bayar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal Tambah Hutang */}
      {addOpen && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div className="dialog">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Catat Hutang ke Supplier</h2>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Pembelian bahan baku / barang yang dibayar belakangan
                </p>
              </div>
              <button className="icon-btn" onClick={() => setAddOpen(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Nama Supplier / Pemasok *</label>
                <input
                  className="input"
                  required
                  placeholder="Contoh: CV Maju Jaya, Toko Pak Budi..."
                  value={form.supplier_name}
                  onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Keterangan Pembelian *</label>
                <input
                  className="input"
                  required
                  placeholder="Contoh: Beli tepung terigu 100kg untuk produksi"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Total Hutang (Rp) *</label>
                  <input
                    className="input"
                    required
                    type="number"
                    placeholder="0"
                    value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Jatuh Tempo</label>
                  <input
                    className="input"
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Catatan (opsional)</label>
                <input
                  className="input"
                  placeholder="Keterangan tambahan..."
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={14} /> {saving ? 'Menyimpan...' : 'Simpan Hutang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bayar Hutang */}
      {payOpen && selected && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setPayOpen(false)}>
          <div className="dialog" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Catat Pembayaran Hutang</h2>
              <button className="icon-btn" onClick={() => setPayOpen(false)}><X size={16} /></button>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.supplier_name}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{selected.description}</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--mute)' }}>Total Hutang</div>
                  <div style={{ fontWeight: 700 }}>{formatRp(selected.total_amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--mute)' }}>Sudah Dibayar</div>
                  <div style={{ fontWeight: 700, color: 'var(--ok)' }}>{formatRp(selected.paid_amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--mute)' }}>Sisa Hutang</div>
                  <div style={{ fontWeight: 700, color: 'var(--bad)' }}>{formatRp(selected.total_amount - selected.paid_amount)}</div>
                </div>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Nominal Dibayar (Rp) *</label>
                <input
                  className="input"
                  required
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Metode Pembayaran</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['cash', 'qris', 'transfer'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 10, border: '2px solid',
                        borderColor: payMethod === m ? 'var(--acc)' : 'var(--line)',
                        background: payMethod === m ? 'var(--accs)' : 'var(--panel)',
                        color: payMethod === m ? 'var(--acc)' : 'var(--ink)',
                        fontWeight: 600, fontSize: 12, cursor: 'pointer'
                      }}
                    >
                      {m === 'cash' ? '💵 Tunai' : m === 'qris' ? '📱 QRIS' : '🏦 Transfer'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Catatan</label>
                <input
                  className="input"
                  placeholder="Opsional..."
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPayOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={14} /> {saving ? 'Menyimpan...' : 'Konfirmasi Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast" style={{ background: toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)', color: '#fff' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
