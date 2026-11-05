const actionLabels: Record<string, string> = {
  CREATE_SALE: 'Penjualan dicatat',
  VOID_SALE: 'Transaksi dibatalkan',
  ADJUST_STOCK: 'Stok barang diperbarui',
  CREATE_EXPENSE: 'Biaya operasional dicatat',
  CREATE_DEBT: 'Utang usaha dicatat',
  CREATE_RECEIVABLE: 'Piutang usaha dicatat',
  RECORD_DEBT_PAYMENT: 'Pembayaran utang dicatat',
  UPDATE_PRODUCT: 'Informasi barang diperbarui',
  OPEN_SHIFT: 'Shift kasir dibuka',
  CLOSE_SHIFT: 'Shift kasir ditutup',
  SUBSCRIPTION_CORE_CHARGE_CREATED: 'Tagihan langganan dibuat',
  SUBSCRIPTION_PAYMENT_ORDER_CREATED: 'Tagihan langganan dibuat',
  SUBSCRIPTION_STATUS_SYNCHRONIZED: 'Status pembayaran diperbarui',
  SUBSCRIPTION_PAYMENT_CANCELLED: 'Tagihan langganan dibatalkan',
  MIDTRANS_WEBHOOK_PROCESSED: 'Pembayaran diperbarui',
  SUPER_ADMIN_USER_CREATED: 'Akun pengguna dibuat',
  SUPER_ADMIN_USER_EDIT: 'Informasi akun diperbarui',
  SUPER_ADMIN_ROLE_CHANGE: 'Hak akses akun diubah',
  SUPER_ADMIN_ACCOUNT_ACTIVATED: 'Akun diaktifkan',
  SUPER_ADMIN_ACCOUNT_DEACTIVATED: 'Akun dinonaktifkan',
  SUPER_ADMIN_REGISTRATION_APPROVED: 'Pendaftaran disetujui',
  SUPER_ADMIN_REGISTRATION_REJECTED: 'Pendaftaran ditolak',
  SUPER_ADMIN_PROFILE_UPDATED: 'Profil diperbarui',
  SUPER_ADMIN_CREDENTIALS_UPDATED: 'Informasi login diperbarui',
  SUPER_ADMIN_PLAN_CREATED: 'Paket langganan dibuat',
  SUPER_ADMIN_PLAN_UPDATED: 'Paket langganan diperbarui',
  SUPER_ADMIN_TRIAL_EXTENDED: 'Masa uji coba diperpanjang',
  SUPER_ADMIN_TRIAL_ENDED: 'Masa uji coba diakhiri',
  SUPER_ADMIN_PAYMENT_LINK_SYNCED: 'Tautan pembayaran diperbarui',
  SUPER_ADMIN_PAYMENT_LINK_SYNC_FAILED: 'Tautan pembayaran gagal diperbarui',
}

const tableLabels: Record<string, string> = {
  sales: 'Penjualan',
  sale_items: 'Rincian barang belanja',
  products: 'Daftar barang dan stok',
  shifts: 'Shift kasir',
  expenses: 'Biaya operasional',
  supplier_payables: 'Utang usaha',
  supplier_payments: 'Pembayaran utang',
  receivables: 'Piutang pelanggan',
  receivable_payments: 'Pembayaran piutang',
  debt_categories: 'Kategori utang dan piutang',
  subscription_payments: 'Tagihan langganan',
  subscriptions: 'Langganan',
  subscription_plans: 'Paket langganan',
  platform_withdrawals: 'Penarikan dana platform',
  platform_ledger_entries: 'Catatan keuangan platform',
  profiles: 'Akun pengguna',
  businesses: 'Informasi usaha',
  audit_logs: 'Catatan aktivitas',
}

const fieldLabels: Record<string, string> = {
  amount: 'Nominal',
  total_amount: 'Total tagihan',
  final_amount: 'Total pembayaran',
  gross_amount: 'Total pembayaran',
  plan_name: 'Paket langganan',
  order_id: 'Nomor tagihan',
  invoice_number: 'Nomor transaksi',
  payment_method: 'Cara pembayaran',
  payment_type: 'Cara pembayaran',
  bank: 'Bank',
  status: 'Status pembayaran',
  expires_at: 'Batas waktu pembayaran',
  paid_at: 'Waktu pembayaran',
  duration_days: 'Lama berlangganan',
  full_name: 'Nama pengguna',
  email: 'Email',
  phone: 'Nomor telepon',
  role: 'Hak akses',
  approval_status: 'Status pendaftaran',
  is_active: 'Status akun',
  name: 'Nama',
  description: 'Keterangan',
  reason: 'Alasan',
  payment_url: 'Tautan pembayaran',
  currency: 'Mata uang',
}

const ignoredFields = new Set([
  'id',
  'record_id',
  'owner_id',
  'business_id',
  'user_id',
  'created_by',
  'updated_by',
  'transaction_id',
  'gateway_transaction_id',
  'snap_token',
  'ip_address',
  'token',
  'secret',
])

const paymentStatuses: Record<string, string> = {
  pending: 'Menunggu pembayaran',
  success: 'Berhasil',
  paid: 'Lunas',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
  partial: 'Dibayar sebagian',
  unpaid: 'Belum dibayar',
}

export function auditActionLabel(action: string) {
  return actionLabels[action] ?? action
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function auditTableLabel(tableName: string) {
  return tableLabels[tableName] ?? tableName
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function auditFieldLabel(key: string) {
  return fieldLabels[key] ?? key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || ignoredFields.has(key)) return null
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (typeof value === 'number') {
    if (key.includes('amount') || key.includes('price')) {
      return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`
    }
    if (key === 'duration_days') return `${value} hari`
    return new Intl.NumberFormat('id-ID').format(value)
  }
  if (typeof value === 'string') {
    if (key === 'status') return paymentStatuses[value.toLowerCase()] ?? value
    if (key === 'payment_method' || key === 'payment_type') {
      const methods: Record<string, string> = {
        bank_transfer: 'Transfer bank',
        transfer: 'Transfer bank',
        qris: 'QRIS',
        cash: 'Tunai',
        non_cash: 'Non-tunai',
      }
      return methods[value.toLowerCase()] ?? value
    }
    if (key === 'role') {
      const roles: Record<string, string> = {
        owner: 'Pemilik usaha',
        admin: 'Admin',
        kasir: 'Kasir',
        super_admin: 'Super Admin',
      }
      return roles[value] ?? value
    }
    if (key === 'approval_status') {
      const statuses: Record<string, string> = {
        approved: 'Disetujui',
        pending: 'Menunggu',
        rejected: 'Ditolak',
      }
      return statuses[value] ?? value
    }
    if (key.endsWith('_at') && !Number.isNaN(Date.parse(value))) {
      return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(value))
    }
    if (/^https?:\/\//i.test(value)) return 'Tautan tersedia'
    return value.length > 100 ? `${value.slice(0, 97)}...` : value
  }
  return null
}

export function summarizeAuditData(value: unknown, limit = 4) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []

  return Object.entries(value)
    .filter(([key]) => !ignoredFields.has(key) && !/password|secret|token|key/i.test(key))
    .map(([key, item]) => {
      const formatted = formatValue(key, item)
      return formatted ? `${auditFieldLabel(key)}: ${formatted}` : null
    })
    .filter((entry): entry is string => entry !== null)
    .slice(0, limit)
}
