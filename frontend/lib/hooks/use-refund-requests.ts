'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export interface RefundRequest {
  id: string
  sale_id: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  sale: {
    invoice_number: string
    final_amount: number
  } | null
  requester: {
    full_name: string
  } | null
  reviewer?: {
    full_name: string
  } | null
}

interface RefundRequestsResponse {
  requests: RefundRequest[]
}

async function fetchRefundRequests(url: string): Promise<RefundRequestsResponse> {
  let response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })

  if (response.status === 401) {
    const { data, error } = await createClient().auth.refreshSession()
    if (!error && data.session) {
      response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
    }
  }

  const result = await response.json() as RefundRequestsResponse & { error?: string }
  if (!response.ok || !Array.isArray(result.requests)) {
    throw new Error(result.error || 'Pengajuan refund belum dapat dimuat.')
  }
  return result
}

export function useRefundRequests(enabled = true) {
  return useSWR<RefundRequestsResponse, Error>(
    enabled ? '/api/admin/refund-requests' : null,
    fetchRefundRequests,
    {
      refreshInterval: 30_000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
      shouldRetryOnError: false,
    }
  )
}
