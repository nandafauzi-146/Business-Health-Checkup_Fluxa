'use client'

import { useState } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { FormatRupiah, SectionCard } from '@/components/ui/Cards'
import { getUserFacingError } from '@/lib/user-facing-error'
import { useRefundRequests } from '@/lib/hooks/use-refund-requests'

export default function PendingRefundRequests() {
  const { data, error: loadError, isLoading, mutate } = useRefundRequests()
  const requests = data?.requests.filter(request => request.status === 'pending') || []
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const decideRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId)
    setNotice('')
    try {
      const response = await fetch('/api/admin/refund-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action }),
      })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Keputusan refund belum dapat disimpan.')

      void mutate()
      setNotice(action === 'approve'
        ? 'Refund disetujui dan transaksi telah dibatalkan.'
        : 'Pengajuan refund ditolak.')
    } catch (decisionError) {
      console.error('Unable to process refund request from admin dashboard:', decisionError)
      setError(getUserFacingError(decisionError, 'Keputusan refund belum dapat disimpan. Silakan coba lagi.'))
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <SectionCard title={`Pengajuan Refund Menunggu Persetujuan (${requests.length})`}>
      {notice && (
        <div role="status" style={{ marginBottom: 12, color: 'var(--ok)', fontSize: 12.5, fontWeight: 600 }}>
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" style={{ marginBottom: 12, color: 'var(--bad)', fontSize: 12.5 }}>
          {error}
        </div>
      )}
      {loadError && (
        <div role="alert" style={{ marginBottom: 12, color: 'var(--bad)', fontSize: 12.5 }}>
          {getUserFacingError(loadError, 'Pengajuan refund belum dapat dimuat. Silakan coba lagi.')}
        </div>
      )}
      {isLoading ? (
        <div style={{ padding: '12px 0', color: 'var(--mute)', fontSize: 12.5 }}>
          Memuat pengajuan refund...
        </div>
      ) : requests.length === 0 ? (
        <div style={{ padding: '12px 0', color: 'var(--mute)', fontSize: 12.5 }}>
          Tidak ada pengajuan refund yang menunggu persetujuan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map(request => (
            <div
              key={request.id}
              style={{
                padding: '12px 14px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderLeft: '3px solid var(--warn)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: 'var(--ink)' }}>
                    {request.sale?.invoice_number || 'Transaksi'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 3 }}>
                    Kasir: {request.requester?.full_name || 'Kasir'} · {new Date(request.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--body)', marginTop: 7 }}>
                    Alasan: {request.reason}
                  </div>
                </div>
                {request.sale && (
                  <strong style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    <FormatRupiah amount={request.sale.final_amount} />
                  </strong>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={processingId === request.id}
                  onClick={() => void decideRequest(request.id, 'reject')}
                  style={{ padding: '6px 10px', fontSize: 12 }}
                >
                  <X size={13} /> Tolak
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={processingId === request.id}
                  onClick={() => void decideRequest(request.id, 'approve')}
                  style={{ padding: '6px 10px', fontSize: 12 }}
                >
                  <Check size={13} /> {processingId === request.id ? 'Memproses...' : 'Setujui & Batalkan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => void mutate()}
        disabled={isLoading}
        className="btn btn-secondary"
        style={{ marginTop: 12, padding: '6px 10px', fontSize: 11.5 }}
      >
        <RefreshCw size={13} /> Segarkan Pengajuan
      </button>
    </SectionCard>
  )
}
