import type { SupabaseClient } from '@supabase/supabase-js'

export interface ApplyPaymentParams {
  orderId: string
  status: 'pending' | 'success' | 'failed' | 'expired' | 'cancelled' | 'refunded' | string
  transactionId?: string | null
  paidAt?: string | null
}

/**
 * Authoritatively applies subscription payment status to database.
 * Attempts Postgres RPC first; falls back gracefully to direct Supabase service-role updates
 * if the RPC function is not found in the database schema cache.
 */
export async function applySubscriptionPayment(
  admin: SupabaseClient,
  params: ApplyPaymentParams
): Promise<{ success: boolean; error?: string }> {
  const { orderId, status, transactionId = null, paidAt = null } = params

  // 1. First, attempt to call the RPC if it exists in Supabase
  try {
    const { error: rpcError } = await admin.rpc('apply_midtrans_subscription_payment', {
      p_order_id: orderId,
      p_status: status,
      p_transaction_id: transactionId,
      p_paid_at: paidAt,
    })

    if (!rpcError) {
      return { success: true }
    }

    // If RPC failed (e.g. PGRST202 function not found), fall back to direct DB updates below
    console.warn('RPC apply_midtrans_subscription_payment failed, using direct DB sync fallback:', rpcError.message || rpcError)
  } catch (err) {
    console.warn('RPC apply_midtrans_subscription_payment threw, using direct DB sync fallback:', err)
  }

  // 2. Direct database updates via service-role Supabase client
  try {
    const { data: payment, error: pError } = await admin
      .from('subscription_payments')
      .select('id, order_id, owner_id, plan_id, duration_days, amount, status, gateway_transaction_id, paid_at')
      .eq('order_id', orderId)
      .maybeSingle()

    if (pError || !payment) {
      console.error('Payment record not found for orderId:', orderId, pError)
      return { success: false, error: 'Tagihan tidak ditemukan.' }
    }

    if (payment.status === 'refunded' || (payment.status === 'success' && status !== 'refunded')) {
      // Already successfully processed or refunded
      return { success: true }
    }

    // Update subscription_payments record
    const updatePayload: Record<string, unknown> = {
      status,
      gateway_transaction_id: transactionId || payment.gateway_transaction_id,
      updated_at: new Date().toISOString(),
    }
    if (status === 'success') {
      updatePayload.paid_at = paidAt || new Date().toISOString()
    }

    const { error: updatePaymentErr } = await admin
      .from('subscription_payments')
      .update(updatePayload)
      .eq('id', payment.id)

    if (updatePaymentErr) {
      console.error('Error updating subscription_payments:', updatePaymentErr)
    }

    // Insert into webhook events ledger if table exists
    try {
      const eventHash = `${orderId}:${status}:${transactionId || ''}`
      await admin.from('midtrans_webhook_events').insert({
        event_hash: eventHash,
        order_id: orderId,
        transaction_status: status,
        transaction_id: transactionId,
      })
    } catch {
      // Non-critical, ignore if table doesn't exist
    }

    if (status === 'refunded') {
      await admin
        .from('subscriptions')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('owner_id', payment.owner_id)
      return { success: true }
    }

    if (status !== 'success') {
      return { success: true }
    }

    // === SUCCESS HANDLING ===
    // 1. Auto-approve owner in profiles table
    try {
      await admin
        .from('profiles')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          trial_ends_at: new Date().toISOString(),
        })
        .eq('id', payment.owner_id)
        .eq('approval_status', 'pending')
    } catch (profileErr) {
      console.warn('Failed to auto-approve profile:', profileErr)
    }

    // 2. Compute subscription dates
    const { data: currentSub } = await admin
      .from('subscriptions')
      .select('id, current_period_end')
      .eq('owner_id', payment.owner_id)
      .maybeSingle()

    const now = new Date()
    let nextStart = now
    if (currentSub?.current_period_end) {
      const existingEnd = new Date(currentSub.current_period_end)
      if (existingEnd > now) {
        nextStart = existingEnd
      }
    }
    const durationDays = payment.duration_days || 30
    const nextEnd = new Date(nextStart.getTime() + durationDays * 24 * 60 * 60 * 1000)

    // 3. Upsert subscriptions row
    const subPayload = {
      owner_id: payment.owner_id,
      plan_id: payment.plan_id,
      status: 'active',
      current_period_start: nextStart.toISOString(),
      current_period_end: nextEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }

    const { data: upsertedSub, error: subErr } = await admin
      .from('subscriptions')
      .upsert(subPayload, { onConflict: 'owner_id' })
      .select('id')
      .maybeSingle()

    if (subErr) {
      console.error('Error upserting subscription:', subErr)
    } else if (upsertedSub?.id) {
      // Link subscription_id to payment
      await admin
        .from('subscription_payments')
        .update({ subscription_id: upsertedSub.id })
        .eq('id', payment.id)
    }

    // 4. Try platform_ledger_entries (non-critical)
    try {
      await admin.from('platform_ledger_entries').insert({
        entry_type: 'subscription_payment',
        direction: 'credit',
        amount: payment.amount,
        source_type: 'subscription_payment',
        source_id: payment.id,
      })
    } catch {
      // Ignore if table or constraint differs
    }

    return { success: true }
  } catch (err) {
    console.error('Fatal error in direct subscription payment apply:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Gagal memproses pembayaran' }
  }
}

