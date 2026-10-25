import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createMidtransPaymentLink,
  deleteMidtransPaymentLink,
  getMidtransConfig,
  type MidtransPaymentLinkPayload,
} from './midtrans'

export type PlanPaymentLinkInfo = {
  payment_link_url: string | null
  payment_link_id: string | null
  payment_link_order_id: string | null
  payment_link_status: 'synced' | 'failed' | 'unlinked'
  payment_link_updated_at: string | null
  payment_link_error?: string | null
}

const DEFAULT_TITLE = 'Fluxa - Business Health Checkup'

/**
 * Retrieve stored payment links for all subscription plans from Supabase.
 * Checks both subscription_plans columns (if present) and landing_cms_content.
 */
export async function getStoredPaymentLinks(
  admin: SupabaseClient
): Promise<Record<string, PlanPaymentLinkInfo>> {
  const result: Record<string, PlanPaymentLinkInfo> = {}

  // 1. Try reading from landing_cms_content (durable JSON storage)
  try {
    const { data: cms } = await admin
      .from('landing_cms_content')
      .select('content')
      .eq('id', 'default')
      .maybeSingle()

    const storedMap = (cms?.content as Record<string, unknown> | undefined)?.payment_links as
      | Record<string, PlanPaymentLinkInfo>
      | undefined

    if (storedMap && typeof storedMap === 'object') {
      for (const [planId, info] of Object.entries(storedMap)) {
        if (info && typeof info === 'object') {
          result[planId] = {
            payment_link_url: info.payment_link_url ?? null,
            payment_link_id: info.payment_link_id ?? null,
            payment_link_order_id: info.payment_link_order_id ?? null,
            payment_link_status: info.payment_link_status ?? 'unlinked',
            payment_link_updated_at: info.payment_link_updated_at ?? null,
            payment_link_error: info.payment_link_error ?? null,
          }
        }
      }
    }
  } catch (err) {
    console.warn('Unable to read payment links from landing_cms_content:', err)
  }

  // 2. Try checking if subscription_plans table has payment_link columns directly
  try {
    const { data: plans } = await admin
      .from('subscription_plans')
      .select('id, payment_link_url, payment_link_id, payment_link_order_id, payment_link_status, payment_link_updated_at')

    if (Array.isArray(plans)) {
      for (const p of plans) {
        if (p.payment_link_url || p.payment_link_status) {
          result[p.id] = {
            payment_link_url: p.payment_link_url ?? null,
            payment_link_id: p.payment_link_id ?? null,
            payment_link_order_id: p.payment_link_order_id ?? null,
            payment_link_status: (p.payment_link_status as PlanPaymentLinkInfo['payment_link_status']) ?? 'unlinked',
            payment_link_updated_at: p.payment_link_updated_at ?? null,
          }
        }
      }
    }
  } catch {
    // Columns might not exist in schema yet; landing_cms_content is the authoritative fallback
  }

  return result
}

/**
 * Persist payment link information for a plan to Supabase.
 */
async function persistPlanPaymentLink(
  admin: SupabaseClient,
  planId: string,
  info: PlanPaymentLinkInfo
): Promise<void> {
  // 1. Persist to landing_cms_content (guaranteed to exist & succeed)
  try {
    const { data: cms } = await admin
      .from('landing_cms_content')
      .select('content')
      .eq('id', 'default')
      .maybeSingle()

    const currentContent = (cms?.content && typeof cms.content === 'object' ? cms.content : {}) as Record<string, unknown>
    const currentMap = ((currentContent.payment_links && typeof currentContent.payment_links === 'object'
      ? currentContent.payment_links
      : {}) as Record<string, PlanPaymentLinkInfo>)

    currentMap[planId] = info
    currentContent.payment_links = currentMap

    await admin.from('landing_cms_content').upsert({
      id: 'default',
      content: currentContent,
      updated_at: new Date().toISOString(),
    })
  } catch (cmsErr) {
    console.error('Failed to persist payment link to landing_cms_content:', cmsErr)
  }

  // 2. Also try updating subscription_plans columns if they exist
  try {
    await admin
      .from('subscription_plans')
      .update({
        payment_link_url: info.payment_link_url,
        payment_link_id: info.payment_link_id,
        payment_link_order_id: info.payment_link_order_id,
        payment_link_status: info.payment_link_status,
        payment_link_updated_at: info.payment_link_updated_at,
      })
      .eq('id', planId)
  } catch {
    // Ignore schema cache errors if migration hasn't been executed
  }
}

/**
 * Authoritatively creates or regenerates a Midtrans Payment Link for a subscription plan.
 * Conforms strictly to paymentLink-creation.md requirements:
 * - Product Name: plan.name
 * - Product ID: plan.id (UUID)
 * - Quantity: 1
 * - Price: plan.price (authoritative from DB)
 * - Title: "Fluxa - Business Health Checkup"
 * - Email: empty (no prefilled email)
 * - Expiry: 1 day after creation
 * - Usage Limit: exactly 1 use
 * - Payment methods: all enabled (omitted in payload so Midtrans activates all)
 * - Customer Details: customer_required = true
 */
export async function syncPlanPaymentLink(
  admin: SupabaseClient,
  planId: string,
  options?: { forceNew?: boolean }
): Promise<PlanPaymentLinkInfo> {
  // 1. Authoritative plan lookup from Supabase
  const { data: plan, error: planError } = await admin
    .from('subscription_plans')
    .select('id, name, description, price, duration_days, is_active')
    .eq('id', planId)
    .maybeSingle()

  if (planError || !plan) {
    const errorMsg = 'Paket subscription tidak ditemukan di database.'
    const failedInfo: PlanPaymentLinkInfo = {
      payment_link_url: null,
      payment_link_id: null,
      payment_link_order_id: null,
      payment_link_status: 'failed',
      payment_link_updated_at: new Date().toISOString(),
      payment_link_error: errorMsg,
    }
    await persistPlanPaymentLink(admin, planId, failedInfo)
    return failedInfo
  }

  // 2. Validate price: free plans do not need payment links
  if (!Number.isSafeInteger(plan.price) || plan.price <= 0) {
    const unlinkedInfo: PlanPaymentLinkInfo = {
      payment_link_url: null,
      payment_link_id: null,
      payment_link_order_id: null,
      payment_link_status: 'unlinked',
      payment_link_updated_at: new Date().toISOString(),
      payment_link_error: 'Paket gratis (Rp 0) tidak memerlukan link pembayaran.',
    }
    await persistPlanPaymentLink(admin, planId, unlinkedInfo)
    return unlinkedInfo
  }

  // 3. Check for existing payment link
  const storedLinks = await getStoredPaymentLinks(admin)
  const existing = storedLinks[planId]

  // If already synced and forceNew is not requested, return existing
  if (!options?.forceNew && existing?.payment_link_status === 'synced' && existing.payment_link_url) {
    return existing
  }

  // If replacing an existing link, attempt to cleanly delete the old one in Midtrans
  if (existing?.payment_link_order_id) {
    try {
      await deleteMidtransPaymentLink(existing.payment_link_order_id)
    } catch {
      // Non-fatal, proceed with creating new link
    }
  }

  // 4. Construct Midtrans Payment Link payload
  // Unique order_id format: PL-<planId-prefix>-<timestamp>
  const uniqueOrderId = `PL-${plan.id.slice(0, 8)}-${Date.now()}`

  const payload: MidtransPaymentLinkPayload = {
    transaction_details: {
      order_id: uniqueOrderId,
      gross_amount: plan.price,
    },
    title: DEFAULT_TITLE,
    item_details: [
      {
        id: plan.id,
        name: plan.name.slice(0, 50),
        price: plan.price,
        quantity: 1,
      },
    ],
    usage_limit: 1, // Exactly one use
    expiry: {
      duration: 1,
      unit: 'days', // Expiry: one day after creation
    },
    customer_required: true, // Require customer to provide details
    // Do not set customer_details: email is empty, do not prefill any address
    // Do not set enabled_payments: omitting enables all active payment methods
  }

  // 5. Call Midtrans Payment Link API
  let config
  try {
    config = getMidtransConfig()
  } catch (cfgErr) {
    const errorMsg = cfgErr instanceof Error ? cfgErr.message : 'MIDTRANS_SERVER_KEY belum dikonfigurasi.'
    const failedInfo: PlanPaymentLinkInfo = {
      payment_link_url: null,
      payment_link_id: null,
      payment_link_order_id: null,
      payment_link_status: 'failed',
      payment_link_updated_at: new Date().toISOString(),
      payment_link_error: errorMsg,
    }
    await persistPlanPaymentLink(admin, planId, failedInfo)
    return failedInfo
  }

  const result = await createMidtransPaymentLink(payload, config)

  if (!result.ok || !result.paymentUrl) {
    const failedInfo: PlanPaymentLinkInfo = {
      payment_link_url: null,
      payment_link_id: null,
      payment_link_order_id: null,
      payment_link_status: 'failed',
      payment_link_updated_at: new Date().toISOString(),
      payment_link_error: result.errorMessage || 'Gagal membuat Midtrans Payment Link.',
    }
    await persistPlanPaymentLink(admin, planId, failedInfo)
    return failedInfo
  }

  // 6. Successful creation
  const syncedInfo: PlanPaymentLinkInfo = {
    payment_link_url: result.paymentUrl,
    payment_link_id: result.orderId ?? uniqueOrderId,
    payment_link_order_id: result.orderId ?? uniqueOrderId,
    payment_link_status: 'synced',
    payment_link_updated_at: new Date().toISOString(),
  }

  await persistPlanPaymentLink(admin, planId, syncedInfo)
  return syncedInfo
}
