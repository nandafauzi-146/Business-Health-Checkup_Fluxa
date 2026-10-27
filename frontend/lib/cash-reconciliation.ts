/**
 * frontend/lib/cash-reconciliation.ts
 * Logika dan Utilitas Rekonsiliasi Kas Laci & Pengeluaran Kasir Sesuai AUDIT-REKONSILIASI-KASIR.md
 *
 * Standar Rumus Bisnis:
 * Kas yang Diharapkan (Expected Cash) = Saldo Awal (Modal) + Penjualan Tunai Bersih - Pengeluaran Kas Laci
 * Selisih Kas (Difference) = Kas Fisik Aktual - Kas yang Diharapkan
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ShiftExpenseItem {
  id: string
  shift_id?: string | null
  amount: number
  description: string
  expense_date: string
  created_at: string
  category_id?: string | null
  category_name?: string
  status?: 'pending' | 'approved' | 'rejected' | 'clarification'
  cash_impact?: boolean
  created_by?: string
  creator_name?: string
  rejection_reason?: string | null
}

export interface ShiftReconciliationSummary {
  initialCash: number
  cashSales: number
  nonCashSales: number
  totalSalesCount: number
  shiftExpenses: number
  shiftExpenseCount: number
  pendingExpenseCount: number
  expectedCash: number
  finalCash: number | null
  difference: number | null
}

/**
 * Hitung rekonsiliasi kas berdasarkan formula resmi audit
 */
export function calculateExpectedCash(initialCash: number, cashSales: number, cashExpenses: number): number {
  return Math.max(0, initialCash + cashSales - cashExpenses)
}

export function calculateDifference(finalCash: number, expectedCash: number): number {
  return finalCash - expectedCash
}

/**
 * Sanitasi nilai UUID: jika null, undefined, "", atau format bukan UUID valid, kembalikan null.
 * Menghindari PostgreSQL error "invalid input syntax for type uuid: """
 */
export function cleanUUID(val: any): string | null {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(trimmed) ? trimmed : null
}

/**
 * Ambil daftar pengeluaran kas yang terjadi selama shift berlangsung dengan fallback resilient
 */
export async function fetchShiftExpenses(
  supabase: SupabaseClient,
  shiftId?: string | null,
  cashierId?: string | null,
  openedAt?: string | null,
  closedAt?: string | null
): Promise<{ expenses: ShiftExpenseItem[]; totalExpense: number }> {
  const validShiftId = cleanUUID(shiftId)
  const validCashierId = cleanUUID(cashierId)

  if (!validShiftId && (!validCashierId || !openedAt)) {
    return { expenses: [], totalExpense: 0 }
  }

  try {
    // 1. Coba query berdasarkan shift_id
    if (validShiftId) {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          shift_id,
          amount,
          description,
          expense_date,
          created_at,
          category_id,
          status,
          cash_impact,
          created_by,
          rejection_reason,
          expense_categories (name),
          profiles:created_by (full_name)
        `)
        .eq('shift_id', validShiftId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        const formatted = data.map((e: any) => ({
          id: e.id,
          shift_id: e.shift_id,
          amount: e.amount || 0,
          description: e.description || '',
          expense_date: e.expense_date,
          created_at: e.created_at,
          category_id: e.category_id,
          category_name: e.expense_categories?.name || 'Operasional',
          status: e.status || 'approved',
          cash_impact: e.cash_impact ?? true,
          created_by: e.created_by,
          creator_name: e.profiles?.full_name || 'Kasir',
          rejection_reason: e.rejection_reason,
        }))

        // Pengeluaran fisik yang belum ditolak mengurangi kas laci
        const validExpenses = formatted.filter(e => e.cash_impact !== false && e.status !== 'rejected')
        const total = validExpenses.reduce((acc, curr) => acc + curr.amount, 0)
        return { expenses: formatted, totalExpense: total }
      }
    }

    // 2. Fallback jika shift_id unlinked atau kolom belum ada
    if (validCashierId && openedAt) {
      let query = supabase
        .from('expenses')
        .select(`
          id,
          amount,
          description,
          expense_date,
          created_at,
          category_id,
          created_by,
          expense_categories (name),
          profiles:created_by (full_name)
        `)
        .eq('created_by', validCashierId)
        .gte('created_at', openedAt)

      if (closedAt) {
        query = query.lte('created_at', closedAt)
      }

      const { data: fallbackData } = await query.order('created_at', { ascending: false })
      if (fallbackData) {
        const formatted = fallbackData.map((e: any) => ({
          id: e.id,
          amount: e.amount || 0,
          description: e.description || '',
          expense_date: e.expense_date,
          created_at: e.created_at,
          category_id: e.category_id,
          category_name: e.expense_categories?.name || 'Operasional',
          status: 'approved' as const,
          cash_impact: true,
          created_by: e.created_by,
          creator_name: e.profiles?.full_name || 'Kasir',
        }))
        const total = formatted.reduce((acc, curr) => acc + curr.amount, 0)
        return { expenses: formatted, totalExpense: total }
      }
    }
  } catch (err) {
    console.warn('Gagal memuat pengeluaran kas shift:', err)
  }

  return { expenses: [], totalExpense: 0 }
}

/**
 * Kasir mengajukan pengeluaran operasional toko dari laci kasir
 */
export async function submitCashierExpense(
  supabase: SupabaseClient,
  params: {
    amount: number
    description: string
    categoryId?: string | null
    shiftId?: string | null
    cashImpact?: boolean
    receiptUrl?: string | null
    userId: string
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { amount, description, categoryId, shiftId, cashImpact = true, receiptUrl, userId } = params

  if (!amount || amount <= 0) {
    return { success: false, error: 'Nominal pengeluaran harus lebih besar dari Rp0.' }
  }
  if (!description.trim()) {
    return { success: false, error: 'Keterangan atau alasan pengeluaran wajib diisi.' }
  }

  const validCategoryId = cleanUUID(categoryId)
  const validShiftId = cleanUUID(shiftId)
  const validUserId = cleanUUID(userId)

  // 1. Prioritaskan API route server-side (/api/pos/expense) agar terhindar dari RLS browser
  try {
    const res = await fetch('/api/pos/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        description: description.trim(),
        categoryId: validCategoryId,
        shiftId: validShiftId,
        cashImpact,
        receiptUrl: receiptUrl || null,
      }),
    })

    const json = await res.json()
    if (res.ok && json.success) {
      return { success: true, id: json.id }
    }
    if (!res.ok && json.error) {
      return { success: false, error: json.error }
    }
  } catch (apiErr) {
    console.warn('API route /api/pos/expense tidak dapat diakses, mencoba direct client fallback:', apiErr)
  }

  try {
    // 2. Client fallback lewat RPC submit_cashier_expense
    const { data: rpcId, error: rpcErr } = await supabase.rpc('submit_cashier_expense', {
      p_amount: amount,
      p_description: description.trim(),
      p_category_id: validCategoryId,
      p_shift_id: validShiftId,
      p_cash_impact: cashImpact,
      p_receipt_url: receiptUrl || null,
    })

    if (!rpcErr && rpcId) {
      return { success: true, id: rpcId }
    }

    // 3. Fallback: insert langsung ke tabel expenses
    const insertPayload: any = {
      category_id: validCategoryId,
      amount,
      description: description.trim(),
      expense_date: new Date().toISOString().split('T')[0],
      created_by: validUserId || (await supabase.auth.getUser()).data.user?.id,
      receipt_url: receiptUrl || null,
    }

    if (validShiftId) {
      insertPayload.shift_id = validShiftId
      insertPayload.status = 'pending'
      insertPayload.cash_impact = cashImpact
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('expenses')
      .insert(insertPayload)
      .select('id')
      .single()

    if (!insertErr && inserted) {
      return { success: true, id: inserted.id }
    }

    // 4. Fallback jika kolom shift_id/status belum ada di DB
    if (insertErr && (insertErr.code === 'PGRST204' || insertErr.message?.includes('shift_id'))) {
      const basicPayload = {
        category_id: validCategoryId,
        amount,
        description: `[Shift Operasional] ${description.trim()}`,
        expense_date: new Date().toISOString().split('T')[0],
        created_by: validUserId || (await supabase.auth.getUser()).data.user?.id,
      }
      const { data: basicInserted, error: basicErr } = await supabase
        .from('expenses')
        .insert(basicPayload)
        .select('id')
        .single()

      if (basicErr) throw basicErr
      return { success: true, id: basicInserted?.id }
    }

    if (insertErr) throw insertErr
    return { success: false, error: 'Gagal mencatat pengeluaran.' }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Pengeluaran belum dapat disimpan.' }
  }
}

/**
 * Admin / Owner memverifikasi pengeluaran kasir (Approve / Reject / Clarification)
 */
export async function verifyExpenseAction(
  supabase: SupabaseClient,
  expenseId: string,
  action: 'approve' | 'reject' | 'clarification',
  reason?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Coba lewat RPC
    const { error: rpcErr } = await supabase.rpc('verify_cashier_expense', {
      p_expense_id: expenseId,
      p_action: action,
      p_reason: reason || null,
    })

    if (!rpcErr) return { success: true }

    // 2. Fallback update tabel
    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'clarification'
    const { error: updateErr } = await supabase
      .from('expenses')
      .update({
        status: newStatus,
        rejection_reason: action === 'approve' ? null : reason,
      })
      .eq('id', expenseId)

    if (updateErr) throw updateErr
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Verifikasi pengeluaran gagal diproses.' }
  }
}
