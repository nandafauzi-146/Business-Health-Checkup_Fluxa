'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, X, Check, Wallet, ArrowRight, Tag, ChevronDown, Percent, DollarSign as DollarIcon, Flame, Zap, Sparkles, Printer, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BukaShiftModal } from '@/components/pos/KasMasukModal'
import { fetchShiftExpenses } from '@/lib/cash-reconciliation'
import { getUserFacingError } from '@/lib/user-facing-error'
import { fetchActivePromotions } from '@/lib/active-promotions'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

function getCheckoutErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined

  if (code === 'PGRST202' || code === '42883') {
    return 'Transaksi tidak dapat diproses saat ini. Silakan coba lagi dalam beberapa saat.'
  }
  if (code === '23514') {
    return 'Metode pembayaran tidak tersedia untuk transaksi saat ini. Silakan pilih metode lain atau coba lagi.'
  }

  return getUserFacingError(error, 'Transaksi gagal disimpan. Silakan coba lagi.')
}

function isLegacyCheckoutSignatureError(error: unknown) {
  if (!error || typeof error !== 'object' || Reflect.get(error, 'code') !== 'PGRST202') {
    return false
  }

  const description = ['message', 'details', 'hint']
    .map(key => Reflect.get(error, key))
    .filter((value): value is string => typeof value === 'string')
    .join(' ')

  return description.includes('public.create_sale') && description.includes('p_customer_id')
}

const EMOJI_MAP: Record<string, string> = {
  'Minuman': '☕', 'Bahan Baku': '🧂', 'Makanan': '🍞', 'Lainnya': '📦'
}

type PayMethod = 'cash' | 'non_cash'

interface CartItem {
  product_id: string
  name: string
  sell_price: number
  quantity: number
  stock: number
  unit: string
  image_url?: string | null
}

interface CompletedReceipt {
  transactionNumber: string | null
  cashierName: string
  createdAt: string
  cart: CartItem[]
  subtotal: number
  discount: number
  total: number
  payMethod: PayMethod
  cashReceived: number | null
  change: number
}

interface Promotion {
  id: string
  code: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase: number
  max_discount?: number | null
  is_active: boolean
  description?: string | null
}

interface Props {
  products: any[]
  productsError: string | null
  activeShift: any
  userId: string
  cashierName: string
}

export default function POSClient({ products: initialProducts, productsError: initialProductsError, activeShift: initialShift, userId, cashierName }: Props) {
  const supabase = createClient()
  const [products, setProducts] = useState<any[]>(initialProducts)
  const [productsError, setProductsError] = useState<string | null>(initialProductsError)

  // Shift state — dikelola di sini agar BukaShiftModal bisa update tanpa reload
  const [activeShift, setActiveShift] = useState<any>(initialShift)

  // Sinkronisasi dengan Sidebar via custom event shift_changed
  useEffect(() => {
    const handleShiftEvent = (e: any) => {
      setActiveShift(e.detail || null)
    }
    window.addEventListener('shift_changed', handleShiftEvent)
    return () => window.removeEventListener('shift_changed', handleShiftEvent)
  }, [])

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [discount, setDiscount] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [cashInput, setCashInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<CompletedReceipt | null>(null)
  const [toast, setToast] = useState('')

  // State Pengeluaran Operasional Kasir
  const [shiftExpenseTotal, setShiftExpenseTotal] = useState(0)

  useEffect(() => {
    async function loadExpenses() {
      if (!activeShift?.id) {
        setShiftExpenseTotal(0)
        return
      }
      const { totalExpense } = await fetchShiftExpenses(
        supabase,
        activeShift.id,
        userId,
        activeShift.opened_at
      )
      setShiftExpenseTotal(totalExpense)
    }

    void loadExpenses()

    const handleExpenseAdded = () => {
      void loadExpenses()
    }

    window.addEventListener('shift_expense_added', handleExpenseAdded)
    return () => window.removeEventListener('shift_expense_added', handleExpenseAdded)
  }, [activeShift?.id, activeShift?.opened_at, userId, supabase])

  const refreshProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Could not refresh products for POS:', error)
      setProductsError('Produk belum dapat dimuat. Silakan coba lagi.')
      return
    }
    setProducts(data || [])
    setProductsError(null)
  }

  useEffect(() => {
    const handleRefresh = () => { void refreshProducts() }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleRefresh()
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'fluxa_products_updated') handleRefresh()
    }
    const refreshInterval = window.setInterval(handleRefresh, 30_000)
    window.addEventListener('focus', handleRefresh)
    window.addEventListener('fluxa_products_updated', handleRefresh)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('fluxa_products_updated', handleRefresh)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Promo state
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [promoLoadError, setPromoLoadError] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoError, setPromoError] = useState('')
  const [showPromoDropdown, setShowPromoDropdown] = useState(false)
  const [showPromoAlert, setShowPromoAlert] = useState(true)

  const marqueePromos = useMemo(() => {
    if (promotions.length === 0) return []
    if (promotions.length === 1) return [promotions[0], promotions[0], promotions[0], promotions[0]]
    if (promotions.length === 2) return [...promotions, ...promotions, ...promotions]
    return [...promotions, ...promotions]
  }, [promotions])

  const handleSelectPromoFromBanner = (promo: Promotion) => {
    if (cart.length === 0) {
      setPromoCode(promo.code)
      showToast(`💡 Kode ${promo.code} dipilih! Tambahkan produk ke keranjang.`)
      return
    }
    if (subtotal < promo.min_purchase) {
      setPromoCode(promo.code)
      const diff = promo.min_purchase - subtotal
      showToast(`💡 Promo ${promo.code} butuh min. belanja ${formatRp(promo.min_purchase)} (kurang ${formatRp(diff)})`)
      return
    }
    applyPromo(promo)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // Fetch promo aktif dari admin
  const fetchPromos = async () => {
    try {
      const promos: Promotion[] = await fetchActivePromotions(supabase)
      setPromotions(promos)
      setPromoLoadError('')
      localStorage.setItem('fluxa_active_promotions', JSON.stringify(promos))
    } catch (err) {
      const message = getUserFacingError(err, 'Promo belum dapat dimuat. Silakan coba lagi.')
      console.warn('Could not refresh active promotions; keeping the last available list:', message)
      setPromoLoadError(message)
      try {
        const cachedPromotions: unknown = JSON.parse(localStorage.getItem('fluxa_active_promotions') || '[]')
        if (Array.isArray(cachedPromotions)) {
          setPromotions(current => current.length > 0 ? current : cachedPromotions)
        }
      } catch (cacheError) {
        console.error('Could not restore cached promotions:', cacheError)
      }
    }
  }

  useEffect(() => {
    setIsMounted(true)
    fetchPromos()

    // Listen perubahan dari admin (localStorage event lintas tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fluxa_active_promotions') {
        try {
          setPromotions(e.newValue ? JSON.parse(e.newValue) : [])
        } catch (err) {
          console.error('Could not sync cached promotions:', err)
        }
      }
    }

    // Listen event custom di window yang sama
    const handleCustomUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setPromotions(e.detail)
      } else {
        fetchPromos()
      }
    }

    // Refresh promo saat kasir membuka kembali tab kasir
    const handleFocus = () => {
      fetchPromos()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPromos()
    }
    const refreshInterval = window.setInterval(fetchPromos, 30_000)

    window.addEventListener('storage', handleStorage)
    window.addEventListener('fluxa_promotions_updated', handleCustomUpdate)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(refreshInterval)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('fluxa_promotions_updated', handleCustomUpdate)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Hitung diskon dari promo terpilih
  const applyPromo = (promo: Promotion | null) => {
    if (!promo) {
      setSelectedPromo(null)
      setDiscount('')
      setPromoError('')
      return
    }
    if (subtotal < promo.min_purchase) {
      setPromoError(`Promo ${promo.code} butuh min. belanja ${formatRp(promo.min_purchase)}`)
      return
    }
    let discAmt = 0
    if (promo.type === 'percentage') {
      discAmt = Math.floor(subtotal * promo.value / 100)
      if (promo.max_discount) discAmt = Math.min(discAmt, promo.max_discount)
    } else {
      discAmt = promo.value
    }
    discAmt = Math.min(subtotal, discAmt)
    setSelectedPromo(promo)
    setDiscount(String(discAmt))
    setPromoError('')
    setShowPromoDropdown(false)
    showToast(`✅ Promo ${promo.code} diterapkan! Hemat ${formatRp(discAmt)}`)
  }

  const handleApplyPromoCode = () => {
    const code = promoCode.trim().toUpperCase()
    const found = promotions.find(p => p.code === code)
    if (!found) {
      setPromoError(`Kode promo "${code}" tidak ditemukan atau tidak aktif`)
      return
    }
    applyPromo(found)
    setPromoCode('')
  }

  const removePromo = () => {
    setSelectedPromo(null)
    setDiscount('')
    setPromoError('')
    setPromoCode('')
  }

  const categories = useMemo(() => {
    const cats = ['Semua', ...Array.from(new Set(products.map((p: any) => p.categories?.name || 'Lainnya')))]
    return cats
  }, [products])

  const filtered = useMemo(() => products.filter((p: any) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    const matchCat = selectedCategory === 'Semua' || (p.categories?.name || 'Lainnya') === selectedCategory
    return matchSearch && matchCat
  }), [products, search, selectedCategory])

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) { showToast('Stok tidak mencukupi!'); return prev }
        return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      if (product.stock <= 0) { showToast('Stok habis!'); return prev }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        sell_price: product.sell_price,
        quantity: 1,
        stock: product.stock,
        unit: product.unit,
        image_url: product.image_url || null
      }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== id) return c
      const newQty = c.quantity + delta
      if (newQty <= 0) return { ...c, quantity: 0 }
      if (newQty > c.stock) { showToast('Stok tidak mencukupi!'); return c }
      return { ...c, quantity: newQty }
    }).filter(c => c.quantity > 0))
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.product_id !== id))

  const subtotal = cart.reduce((s, c) => s + c.sell_price * c.quantity, 0)
  const discountAmount = parseInt(discount) || 0
  const total = Math.max(0, subtotal - discountAmount)
  const parsedCash = cashInput ? parseInt(cashInput, 10) : 0
  const isCashMissing = payMethod === 'cash' && (!cashInput || parsedCash <= 0)
  const isCashUnder = payMethod === 'cash' && parsedCash > 0 && parsedCash < total
  const isCashInvalid = payMethod === 'cash' && (isCashMissing || isCashUnder)
  const cashChange = payMethod === 'cash' && parsedCash >= total ? parsedCash - total : 0

  const quickCashOptions = useMemo(() => {
    if (total <= 0) return []
    const opts = new Set<number>()
    opts.add(total) // Uang pas

    const denominations = [10000, 20000, 50000, 100000, 200000, 500000]
    for (const d of denominations) {
      if (d > total) {
        opts.add(d)
      }
    }
    const next50k = Math.ceil(total / 50000) * 50000
    if (next50k > total) opts.add(next50k)
    const next100k = Math.ceil(total / 100000) * 100000
    if (next100k > total) opts.add(next100k)

    return Array.from(opts).sort((a, b) => a - b).slice(0, 4)
  }, [total])

  // Re-validasi promo jika subtotal berubah (item dihapus/ditambah)
  useEffect(() => {
    if (selectedPromo && subtotal < selectedPromo.min_purchase) {
      setPromoError(`Promo ${selectedPromo.code} tidak berlaku lagi (total kurang dari minimum)`)
      setSelectedPromo(null)
      setDiscount('')
    }
  }, [subtotal])

  const handleCheckout = async () => {
    if (cart.length === 0) { showToast('Keranjang kosong!'); return }
    if (!activeShift) { showToast('Buka shift terlebih dahulu!'); return }

    if (payMethod === 'cash') {
      const val = cashInput ? parseInt(cashInput, 10) : 0
      if (!cashInput || val <= 0) {
        showToast('Uang diterima (Rp) wajib diisi untuk transaksi tunai!')
        return
      }
      if (val < total) {
        showToast(`Uang diterima kurang! Kurang ${formatRp(total - val)}`)
        return
      }
    }

    setProcessing(true)
    try {
      const saleArgs = {
        p_shift_id: activeShift.id,
        p_payment_method: payMethod,
        p_discount: discountAmount,
        p_items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity }))
      }
      let { data, error } = await supabase.rpc('create_sale', saleArgs)
      if (isLegacyCheckoutSignatureError(error)) {
        const legacyArgs = {
          ...saleArgs,
          p_customer_id: null,
        }
        const legacyResult = await supabase.rpc('create_sale', legacyArgs)
        data = legacyResult.data
        error = legacyResult.error
      }
      if (error) throw error
      if (!data) throw new Error('Database tidak mengembalikan ID transaksi.')
      const { data: savedSale, error: saleLookupError } = await supabase
        .from('sales')
        .select('invoice_number')
        .eq('id', data)
        .single()
      if (saleLookupError) {
        console.error('Checkout succeeded, but the transaction number could not be loaded:', saleLookupError.message)
      }
      setReceipt({
        transactionNumber: savedSale?.invoice_number ?? null,
        cashierName,
        createdAt: new Date().toISOString(),
        cart: [...cart],
        subtotal,
        discount: discountAmount,
        total,
        payMethod,
        cashReceived: payMethod === 'cash' && cashInput ? Number(cashInput) : null,
        change: cashChange,
      })
      setCart([])
      setDiscount('')
      setSelectedPromo(null)
      setCashInput('')
      setShowCheckout(false)
    } catch (err: unknown) {
      const errorDetails = err && typeof err === 'object'
        ? Object.fromEntries(
            [...new Set([...Object.getOwnPropertyNames(err), 'code', 'message', 'details', 'hint'])]
              .map(key => [key, Reflect.get(err, key)])
              .filter(([, value]) => value !== undefined)
          )
        : { message: err instanceof Error ? err.message : String(err) }
      console.error('Checkout failed:', JSON.stringify(errorDetails))
      showToast(getCheckoutErrorMessage(err))
    } finally {
      setProcessing(false)
    }
  }

  const payMethodOptions: { key: PayMethod, label: string, icon: React.ReactNode }[] = [
    { key: 'cash', label: 'Tunai', icon: <Wallet size={15} /> },
    { key: 'non_cash', label: 'Non-Tunai', icon: <CreditCard size={15} /> },
  ]

  // Jika belum ada shift aktif, tampilkan modal Buka Shift (blocking fullscreen)
  if (!activeShift) {
    return (
      <BukaShiftModal
        userId={userId}
        onSuccess={(shift) => setActiveShift(shift)}
      />
    )
  }

  return (
    <div className="cashier-dashboard role-dashboard-enter pos-shell">
      {/* Product panel */}
      <div className="pos-products">
        {/* Card Pemberitahuan Promo Muncul (Di Atas) */}
        {isMounted && showPromoAlert && promotions.length > 0 && (
          <div className="promo-top-card" id="promo-top-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>
                  <Sparkles size={14} />
                </div>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                    Promo Kasir Tersedia!
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--mute)', marginLeft: 8 }}>
                    • {promotions.length} promo aktif dari Admin
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPromoAlert(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--mute)', padding: 4, display: 'flex', borderRadius: 4
                }}
                title="Tutup Notifikasi"
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--mute)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
              Klik salah satu voucher di bawah atau pada banner berjalan untuk langsung menerapkan diskon ke transaksi kasir:
            </p>

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              {promotions.map(p => {
                const isSelected = selectedPromo?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPromoFromBanner(p)}
                    style={{
                      background: isSelected ? 'var(--oks)' : 'var(--accs)',
                      border: `1px solid ${isSelected ? 'var(--ok)' : 'var(--acc)'}`,
                      borderRadius: 7, padding: '4px 10px', fontSize: 11.5,
                      color: isSelected ? 'var(--ok)' : 'var(--acc)',
                      fontWeight: 600, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      transition: 'all 0.15s ease'
                    }}
                    title="Klik untuk gunakan diskon"
                  >
                    <Tag size={11} />
                    <span><strong>{p.code}</strong> — {p.type === 'percentage' ? `Diskon ${p.value}%` : `Potongan ${formatRp(p.value)}`}</span>
                    {p.min_purchase > 0 && <span style={{ opacity: 0.8, fontSize: 10.5 }}>(Min. {formatRp(p.min_purchase)})</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Kasir / POS</h1>
          {/* Search */}
          <div className="search-pill" style={{ maxWidth: 'min(400px, 100%)' }}>
            <Search size={14} color="var(--mute)" />
            <input
              placeholder="Cari produk atau SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="search-produk-pos"
              style={{ width: '100%' }}
            />
          </div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: '1px solid var(--line)', cursor: 'pointer', transition: 'all 0.15s',
                  background: selectedCategory === cat ? 'var(--acc)' : 'var(--panel)',
                  color: selectedCategory === cat ? '#fff' : 'var(--ink)'
                }}
              >
                {EMOJI_MAP[cat] || '📦'} {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Shift badge aktif & Quick Action Pengeluaran */}
        <div style={{
          background: 'var(--oks)',
          padding: '8px 12px',
          borderRadius: 10,
          marginBottom: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600 }}>Shift Aktif</span>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--ok)', opacity: 0.9 }}>
              Kas Awal: <strong>{formatRp(activeShift.initial_cash || 0)}</strong>
            </span>
            {shiftExpenseTotal > 0 && (
              <span style={{
                fontSize: 11,
                color: 'var(--bad)',
                background: 'var(--bads)',
                padding: '2px 7px',
                borderRadius: 6,
                fontWeight: 600,
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                Biaya Toko: -{formatRp(shiftExpenseTotal)}
              </span>
            )}
          </div>
        </div>

        {isMounted && promoLoadError && (
          <div role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, color: 'var(--bad)', background: 'var(--bads)', fontSize: 12 }}>
            {promoLoadError}
          </div>
        )}

        {/* Banner Promo Berjalan (Running Cards Marquee) */}
        {isMounted && promotions.length > 0 && (
          <div className="promo-running-bar" id="promo-running-ticker">
            {/* Tag Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.25)',
                letterSpacing: '0.3px'
              }}>
                <Flame size={12} />
                <span>PROMO HARI INI</span>
              </div>
            </div>

            {/* Marquee Track */}
            <div className="promo-marquee-container" title="Arahkan kursor untuk jeda, klik untuk terapkan diskon">
              <div className="promo-marquee-track">
                {marqueePromos.map((promo, idx) => {
                  const isSelected = selectedPromo?.id === promo.id
                  return (
                    <div
                      key={`${promo.id}-${idx}`}
                      className="promo-runner-card"
                      onClick={() => handleSelectPromoFromBanner(promo)}
                      style={{
                        borderColor: isSelected ? 'var(--ok)' : undefined,
                        background: isSelected ? 'var(--oks)' : undefined,
                      }}
                    >
                      <span style={{
                        background: isSelected ? 'var(--ok)' : 'var(--acc)',
                        color: '#fff',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 5,
                        fontSize: 11,
                        fontFamily: 'monospace'
                      }}>
                        {promo.code}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {promo.type === 'percentage' ? `Diskon ${promo.value}%` : `Potongan ${formatRp(promo.value)}`}
                      </span>
                      {promo.min_purchase > 0 && (
                        <span style={{ color: 'var(--mute)', fontSize: 11 }}>
                          (Min. {formatRp(promo.min_purchase)})
                        </span>
                      )}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        color: isSelected ? 'var(--ok)' : 'var(--acc)',
                        fontWeight: 700, fontSize: 11, marginLeft: 2
                      }}>
                        <Zap size={11} /> {isSelected ? 'Dipakai' : 'Pakai'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Product grid */}
        <div className="pos-products-scroll">
          {productsError && products.length === 0 ? (
            <div role="alert" style={{ padding: 18, borderRadius: 10, color: 'var(--bad)', background: 'var(--bads)' }}>
              Produk belum dapat dimuat. Silakan muat ulang halaman atau hubungi Admin.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--mute)' }}>
              {products.length === 0 ? 'Belum ada produk aktif. Tambahkan atau aktifkan produk dari halaman admin.' : 'Produk tidak ditemukan.'}
            </div>
          ) : (
            <div className="product-grid">
              {filtered.map(p => {
              const cartItem = cart.find(c => c.product_id === p.id)
              const cat = p.categories?.name || 'Lainnya'
              return (
                <div
                  key={p.id}
                  className="product-card"
                  id={`product-${p.id}`}
                  onClick={() => addToCart(p)}
                  style={{ opacity: p.stock <= 0 ? 0.5 : 1, position: 'relative' }}
                >
                  {cartItem && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6, width: 22, height: 22,
                      background: 'var(--acc)', color: '#fff', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 3
                    }}>
                      {cartItem.quantity}
                    </div>
                  )}
                  {p.image_url ? (
                    <div className="product-image-container">
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="product-card-img"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          const fallback = (e.target as HTMLElement).nextElementSibling;
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }}
                      />
                      <div
                        style={{
                          display: 'none',
                          width: '100%',
                          height: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--accs)',
                          fontSize: 24
                        }}
                      >
                        {EMOJI_MAP[cat] || '📦'}
                      </div>
                    </div>
                  ) : (
                    <div className="product-thumb">{EMOJI_MAP[cat] || '📦'}</div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2, lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--acc)' }}>{formatRp(p.sell_price)}</div>
                  <div style={{ fontSize: 10, color: p.stock < p.min_stock ? 'var(--warn)' : 'var(--mute)', marginTop: 2 }}>
                    Stok: {p.stock} {p.unit}
                  </div>
                </div>
              )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="pos-cart">
        {/* Cart header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} color="var(--acc)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Keranjang</span>
            {cart.length > 0 && (
              <span style={{ background: 'var(--acc)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
            <button
              onClick={fetchPromos}
              title="Refresh promo dari admin"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
            >
              <ArrowRight size={11} style={{ transform: 'rotate(90deg)' }} />
              {promotions.length > 0 ? <span style={{ color: 'var(--ok)' }}>{promotions.length} promo</span> : <span>Refresh promo</span>}
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--mute)' }}>
              <ShoppingCart size={40} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>Keranjang kosong</p>
              <p style={{ fontSize: 12 }}>Klik produk untuk menambahkan</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cart.map(item => (
                <div key={item.product_id} style={{ padding: '10px', background: 'var(--bg)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--line)' }}
                        />
                      ) : null}
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.product_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', padding: 2, flexShrink: 0 }} aria-label={`Hapus ${item.name}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => updateQty(item.product_id, -1)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label={`Kurangi ${item.name}`}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product_id, 1)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label={`Tambah ${item.name}`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--acc)' }}>
                      {formatRp(item.sell_price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart footer / checkout */}
        {cart.length > 0 && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)' }}>

            {/* PROMO PICKER */}
            <div style={{ marginBottom: 10 }}>
              {selectedPromo ? (
                /* Promo terpilih */
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 10,
                  background: 'var(--oks)', border: '1px solid var(--ok)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Tag size={13} color="var(--ok)" />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ok)' }}>{selectedPromo.code}</div>
                      <div style={{ fontSize: 11, color: 'var(--ok)', opacity: 0.8 }}>{selectedPromo.name}</div>
                    </div>
                  </div>
                  <button
                    onClick={removePromo}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ok)', fontSize: 13, padding: 4 }}
                    title="Hapus promo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                /* Promo picker */
                <div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 6, fontWeight: 600 }}>Promo / Voucher:</div>

                  {/* Input kode promo */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      id="promo-code-input"
                      className="input"
                      placeholder="Masukkan kode promo..."
                      value={promoCode}
                      onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleApplyPromoCode()}
                      style={{ padding: '6px 10px', fontSize: 12, fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={handleApplyPromoCode}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
                    >
                      Terapkan
                    </button>
                  </div>

                  {/* Dropdown promo aktif */}
                  {promotions.length > 0 && (
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowPromoDropdown(v => !v)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)',
                          background: 'var(--bg)', cursor: 'pointer', fontSize: 12, color: 'var(--mute)'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Tag size={12} /> Pilih dari promo aktif ({promotions.length})
                        </span>
                        <ChevronDown size={12} style={{ transform: showPromoDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>

                      {showPromoDropdown && (
                        <div style={{
                          position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 100,
                          background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10,
                          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)', marginBottom: 4,
                          maxHeight: 200, overflowY: 'auto'
                        }}>
                          {promotions.map(promo => {
                            const eligible = subtotal >= promo.min_purchase
                            return (
                              <button
                                key={promo.id}
                                onClick={() => applyPromo(promo)}
                                disabled={!eligible}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 14px', border: 'none', background: 'none',
                                  cursor: eligible ? 'pointer' : 'not-allowed',
                                  opacity: eligible ? 1 : 0.45,
                                  borderBottom: '1px solid var(--line)'
                                }}
                              >
                                <div style={{ textAlign: 'left' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{
                                      fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                                      padding: '2px 7px', borderRadius: 5,
                                      background: 'var(--bg)', border: '1px solid var(--line)'
                                    }}>{promo.code}</span>
                                    {promo.type === 'percentage'
                                      ? <Percent size={11} color="var(--acc)" />
                                      : <DollarIcon size={11} color="#8B5CF6" />
                                    }
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{promo.name}</div>
                                  {!eligible && <div style={{ fontSize: 10.5, color: 'var(--warn)', marginTop: 1 }}>Min. {formatRp(promo.min_purchase)}</div>}
                                </div>
                                <span style={{
                                  fontSize: 12, fontWeight: 700,
                                  color: promo.type === 'percentage' ? 'var(--acc)' : '#8B5CF6'
                                }}>
                                  {promo.type === 'percentage' ? `${promo.value}%` : formatRp(promo.value)}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {promoError && (
                    <div style={{ fontSize: 11.5, color: 'var(--bad)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⚠ {promoError}
                    </div>
                  )}

                  {/* Fallback manual diskon */}
                  {!selectedPromo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <label style={{ fontSize: 11.5, color: 'var(--mute)', flexShrink: 0 }}>Diskon manual (Rp):</label>
                      <input
                        id="discount-input"
                        className="input"
                        type="number"
                        placeholder="0"
                        value={discount}
                        onChange={e => setDiscount(e.target.value)}
                        style={{ padding: '5px 10px', fontSize: 12 }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mute)', marginBottom: 4 }}>
                <span>Subtotal</span><span>{formatRp(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ok)', marginBottom: 4 }}>
                  <span>Diskon</span><span>- {formatRp(discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--ink)', paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 4 }}>
                <span>Total</span><span style={{ color: 'var(--acc)' }}>{formatRp(total)}</span>
              </div>
            </div>

            <button
              id="checkout-btn"
              className="btn btn-primary"
              onClick={() => setShowCheckout(true)}
              style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14 }}
            >
              <CreditCard size={16} /> Bayar {formatRp(total)}
            </button>
          </div>
        )}
      </div>

      {/* Checkout dialog */}
      {showCheckout && (
        <div className="dialog-overlay">
          <div className="dialog" style={{ maxWidth: 420, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Konfirmasi Pembayaran</h2>
              <button className="icon-btn" onClick={() => setShowCheckout(false)} aria-label="Tutup"><X size={16} /></button>
            </div>

            {/* Cart summary */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 16, maxHeight: 160, overflowY: 'auto' }}>
              {cart.map(c => (
                <div key={c.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <span>{c.name} × {c.quantity}</span>
                  <span style={{ fontWeight: 600 }}>{formatRp(c.sell_price * c.quantity)}</span>
                </div>
              ))}
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ok)', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--line)' }}>
                  <span>Diskon</span><span>- {formatRp(discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', color: 'var(--acc)' }}>
                <span>Total</span><span>{formatRp(total)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: 14 }}>
              <label className="label">Metode pembayaran</label>
              <div className="pay-method-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {payMethodOptions.map(opt => (
                  <button
                    key={opt.key}
                    id={`pay-${opt.key}`}
                    onClick={() => setPayMethod(opt.key)}
                    style={{
                      padding: '10px', border: `2px solid ${payMethod === opt.key ? 'var(--acc)' : 'var(--line)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      background: payMethod === opt.key ? 'var(--accs)' : 'var(--panel)',
                      color: payMethod === opt.key ? 'var(--acc)' : 'var(--ink)',
                      display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600,
                      transition: 'all 0.15s'
                    }}
                  >
                    {opt.icon}{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'cash' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="label" htmlFor="cash-input" style={{ margin: 0, fontWeight: 600 }}>
                    Uang diterima (Rp) <span style={{ color: 'var(--err)', fontWeight: 700 }}>*wajib diisi</span>
                  </label>
                  <span style={{ fontSize: 11, color: 'var(--mute)' }}>
                    Tagihan: <strong>{formatRp(total)}</strong>
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    id="cash-input"
                    className="input"
                    type="text"
                    inputMode="numeric"
                    placeholder={`Min. ${formatRp(total)}`}
                    value={cashInput ? new Intl.NumberFormat('id-ID').format(Number(cashInput)) : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '')
                      setCashInput(raw)
                    }}
                    autoFocus
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      paddingLeft: 38,
                      borderColor: !cashInput
                        ? 'var(--line)'
                        : parsedCash < total
                        ? 'var(--err)'
                        : 'var(--ok)',
                      background: !cashInput
                        ? 'var(--panel)'
                        : parsedCash < total
                        ? 'rgba(239, 68, 68, 0.05)'
                        : 'rgba(34, 197, 94, 0.05)',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--mute)',
                    pointerEvents: 'none'
                  }}>
                    Rp
                  </span>
                </div>

                {/* Quick Cash Presets */}
                {quickCashOptions.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {quickCashOptions.map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCashInput(String(amount))}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: Number(cashInput) === amount ? '1.5px solid var(--acc)' : '1px solid var(--line)',
                          background: Number(cashInput) === amount ? 'var(--accs)' : 'var(--bg)',
                          color: Number(cashInput) === amount ? 'var(--acc)' : 'var(--ink)',
                          transition: 'all 0.12s'
                        }}
                      >
                        {amount === total ? 'Uang Pas' : formatRp(amount)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Validation Status */}
                {isCashMissing && (
                  <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, fontSize: 12, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>Uang diterima wajib diisi sebelum pembayaran dapat diproses.</span>
                  </div>
                )}

                {isCashUnder && (
                  <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>Uang kurang {formatRp(total - parsedCash)}</span>
                  </div>
                )}

                {!isCashMissing && !isCashUnder && parsedCash >= total && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--oks)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--ok)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Kembalian:</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatRp(parsedCash - total)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="modal-footer-sticky" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCheckout(false)}>Batal</button>
              <button
                id="confirm-payment-btn"
                className="btn btn-primary"
                style={{
                  flex: 2,
                  justifyContent: 'center',
                  opacity: (processing || isCashInvalid) ? 0.6 : 1,
                  cursor: (processing || isCashInvalid) ? 'not-allowed' : 'pointer'
                }}
                onClick={handleCheckout}
                disabled={processing || isCashInvalid}
              >
                <Check size={15} />
                {processing ? 'Memproses...' : `Bayar ${formatRp(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt dialog */}
      {receipt && (
        <div className="dialog-overlay">
          <div className="dialog pos-receipt-dialog" style={{ maxWidth: 380, textAlign: 'center', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div className="pos-receipt-success">
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Transaksi Berhasil!</h2>
              <p style={{ color: 'var(--mute)', fontSize: 13, marginBottom: 16 }}>
                No. Transaksi:{' '}
                {receipt.transactionNumber
                  ? <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{receipt.transactionNumber}</code>
                  : <span role="status">Belum tersedia, periksa Riwayat Transaksi.</span>}
              </p>
              <p style={{ color: 'var(--mute)', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
                Kasir: <strong style={{ color: 'var(--ink)' }}>{receipt.cashierName}</strong>
              </p>

              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px', marginBottom: 16, textAlign: 'left' }}>
                {receipt.cart.map(item => (
                  <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{item.name} × {item.quantity}</span>
                    <span style={{ fontWeight: 600 }}>{formatRp(item.sell_price * item.quantity)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: 'var(--acc)' }}>
                  <span>Total</span><span>{formatRp(receipt.total)}</span>
                </div>
                {receipt.change > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ok)', marginTop: 4 }}>
                    <span>Kembalian</span><span style={{ fontWeight: 700 }}>{formatRp(receipt.change)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pos-receipt-actions">
              <button id="print-receipt-btn" className="btn btn-secondary" onClick={() => window.print()} disabled={!receipt.transactionNumber} style={{ flex: 1, justifyContent: 'center', height: 42 }}>
                <Printer size={15} /> Cetak Struk
              </button>
              <button id="new-transaction-btn" className="btn btn-primary" onClick={() => setReceipt(null)} style={{ flex: 1, justifyContent: 'center', height: 42 }}>
                <ShoppingCart size={15} /> Transaksi Baru
              </button>
            </div>
          </div>
          <div className="thermal-receipt" aria-hidden="true">
            <header>
              <strong>FLUXA POS</strong>
              <span>Bukti Pembayaran</span>
            </header>
            <div className="thermal-receipt-meta">
              <div>No. Transaksi: {receipt.transactionNumber || 'Belum tersedia'}</div>
              <div>{new Date(receipt.createdAt).toLocaleString('id-ID')}</div>
              <div>Kasir: {receipt.cashierName}</div>
            </div>
            <div className="thermal-receipt-items">
              {receipt.cart.map(item => (
                <div className="thermal-receipt-item" key={item.product_id}>
                  <div>{item.name}</div>
                  <div className="thermal-receipt-line">
                    <span>{item.quantity} x {formatRp(item.sell_price)}</span>
                    <span>{formatRp(item.sell_price * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="thermal-receipt-totals">
              <div><span>Subtotal</span><span>{formatRp(receipt.subtotal)}</span></div>
              {receipt.discount > 0 && <div><span>Diskon</span><span>-{formatRp(receipt.discount)}</span></div>}
              <div className="thermal-receipt-total"><strong>TOTAL</strong><strong>{formatRp(receipt.total)}</strong></div>
              <div><span>Metode</span><span>{receipt.payMethod === 'cash' ? 'Tunai' : 'Non-Tunai'}</span></div>
              {receipt.cashReceived !== null && <div><span>Uang diterima</span><span>{formatRp(receipt.cashReceived)}</span></div>}
              {receipt.cashReceived !== null && <div><span>Kembalian</span><span>{formatRp(receipt.change)}</span></div>}
            </div>
            <footer>Terima kasih atas kunjungan Anda</footer>
          </div>
        </div>
      )}


      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
