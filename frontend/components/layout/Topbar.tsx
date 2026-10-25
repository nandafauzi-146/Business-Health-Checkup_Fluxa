'use client'

import {
  Bell, Search, Moon, Sun, RotateCcw, Package, Tag, Clock,
  Activity, TrendingUp, ShieldAlert, CheckCheck, X, ChevronRight,
  Receipt, CreditCard, Sparkles, Check
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from '@/components/layout/ThemeProvider'
import { menuByRole } from '@/components/layout/role-navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchActivePromotions } from '@/lib/active-promotions'

export interface NotificationItem {
  id: string
  title: string
  message: string
  time: string
  type: 'promo' | 'shift' | 'refund' | 'stok' | 'checkup' | 'finansial' | 'audit' | 'biaya' | 'kasbon'
  badge: string
  badgeColor: string
  badgeBg: string
  link: string
  actionLabel: string
  read: boolean
  isReport: boolean
  timestamp?: string
}

interface ActivePromotion {
  id: string
  code: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase: number
  max_discount: number | null
  created_at: string
  updated_at: string
}

interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  role?: 'kasir' | 'admin' | 'owner' | 'super_admin'
}

function getDefaultNotifications(role: 'kasir' | 'admin' | 'owner' | 'super_admin'): NotificationItem[] {
  if (role === 'super_admin') return []
  if (role === 'kasir') {
    return [
      {
        id: 'notif-k-2',
        title: 'Pengingat Shift Kasir',
        message: 'Shift aktif sedang berjalan. Pastikan hitung fisik uang kas laci sebelum melakukan penutupan shift.',
        time: '1 jam lalu',
        type: 'shift',
        badge: 'Operasional',
        badgeColor: 'var(--ok)',
        badgeBg: 'var(--oks)',
        link: '/kasir/shift',
        actionLabel: 'Kelola Shift',
        read: false,
        isReport: false,
      },
      {
        id: 'notif-k-3',
        title: 'Status Pembatalan / Refund Transaksi',
        message: 'Transaksi void terakhir berhasil dicatat ke sistem audit. Stok barang telah otomatis dikembalikan.',
        time: '3 jam lalu',
        type: 'refund',
        badge: 'Laporan Void',
        badgeColor: 'var(--bad)',
        badgeBg: 'var(--bads)',
        link: '/kasir/riwayat',
        actionLabel: 'Riwayat Transaksi',
        read: true,
        isReport: true,
      },
      {
        id: 'notif-k-4',
        title: 'Peringatan Stok Tipis Saat Transaksi',
        message: 'Roti Tawar (8 pcs) & Minyak Goreng sisa terbatas. Beritahu pembeli jika kuota produk hampir habis.',
        time: '5 jam lalu',
        type: 'stok',
        badge: 'Perhatian Stok',
        badgeColor: 'var(--warn)',
        badgeBg: 'var(--warns)',
        link: '/kasir',
        actionLabel: 'Lihat Katalog',
        read: true,
        isReport: false,
      },
    ]
  }

  if (role === 'admin') {
    return [
      {
        id: 'notif-a-2',
        title: 'Peringatan Stok Kritis & Restock',
        message: '3 produk berada di bawah batas minimum stok (Roti Tawar, Minyak Goreng, Kopi Arabika). Buat pesanan pengadaan supplier.',
        time: '25 mnt lalu',
        type: 'stok',
        badge: 'Pengadaan Stok',
        badgeColor: 'var(--warn)',
        badgeBg: 'var(--warns)',
        link: '/admin/stok',
        actionLabel: 'Kelola Stok',
        read: false,
        isReport: true,
      },
      {
        id: 'notif-a-3',
        title: 'Laporan Sesi Shift Kasir',
        message: 'Kasir aktif memulai shift baru dengan modal kas awal Rp100.000. Rekonsiliasi kas terpantau normal.',
        time: '2 jam lalu',
        type: 'shift',
        badge: 'Shift Kasir',
        badgeColor: 'var(--ok)',
        badgeBg: 'var(--oks)',
        link: '/admin/shift',
        actionLabel: 'Pantau Shift',
        read: false,
        isReport: true,
      },
      {
        id: 'notif-a-4',
        title: 'Status Voucher & Promo Aktif',
        message: 'Voucher HEMAT10 telah digunakan pada 8 transaksi hari ini dengan akumulasi diskon Rp80.000.',
        time: '4 jam lalu',
        type: 'promo',
        badge: 'Performa Promo',
        badgeColor: 'var(--acc)',
        badgeBg: 'var(--accs)',
        link: '/admin/diskon',
        actionLabel: 'Kelola Diskon',
        read: true,
        isReport: false,
      },
      {
        id: 'notif-a-5',
        title: 'Pengingat Hutang & Piutang Usaha',
        message: 'Terdapat tagihan operasional dan supplier yang mendekati jatuh tempo dalam 3 hari.',
        time: '1 hari lalu',
        type: 'kasbon',
        badge: 'Hutang & Piutang',
        badgeColor: 'var(--warn)',
        badgeBg: 'var(--warns)',
        link: '/admin/hutang-piutang',
        actionLabel: 'Cek Tagihan',
        read: true,
        isReport: true,
      },
    ]
  }

  // Role: OWNER
  return [
    {
      id: 'notif-o-1',
      title: 'Rapor Diagnosis Kesehatan Bisnis (GTNIC)',
      message: 'Kalkulasi diagnosis terbaru selesai: Skor 86/100 (Kategori: SEHAT). Indeks efisiensi kas dan margin laba bersih meningkat 4.2%.',
      time: 'Baru saja',
      type: 'checkup',
      badge: 'Diagnosis GTNIC',
      badgeColor: 'var(--ok)',
      badgeBg: 'var(--oks)',
      link: '/owner/checkup',
      actionLabel: 'Buka Rapor AI',
      read: false,
      isReport: true,
    },
    {
      id: 'notif-o-2',
      title: 'Laporan Omzet & Margin Keuangan Hari Ini',
      message: 'Penjualan hari ini mencapai Rp1.450.000 dari 14 transaksi kasir. Estimasi laba kotor: Rp420.000 (margin kotor 29%).',
      time: '45 mnt lalu',
      type: 'finansial',
      badge: 'Finansial & Omzet',
      badgeColor: 'var(--acc)',
      badgeBg: 'var(--accs)',
      link: '/owner/laporan',
      actionLabel: 'Laporan Finansial',
      read: false,
      isReport: true,
    },
    {
      id: 'notif-o-3',
      title: 'Audit Keamanan: Pembatalan Transaksi Kasir',
      message: 'Tercatat 1 transaksi void (Rp75.000) oleh kasir hari ini. Log audit integritas telah disimpan secara otomatis.',
      time: '2 jam lalu',
      type: 'audit',
      badge: 'Audit Integritas',
      badgeColor: 'var(--bad)',
      badgeBg: 'var(--bads)',
      link: '/owner/transaksi',
      actionLabel: 'Buka Log Audit',
      read: false,
      isReport: true,
    },
    {
      id: 'notif-o-4',
      title: 'Laporan Arus Kas & Pengeluaran Beban',
      message: 'Total pengeluaran operasional bulan ini Rp1.250.000 (26% dari target pendapatan). Arus kas UMKM berada pada zona aman.',
      time: '1 hari lalu',
      type: 'biaya',
      badge: 'Arus Kas & Biaya',
      badgeColor: 'var(--warn)',
      badgeBg: 'var(--warns)',
      link: '/owner/biaya',
      actionLabel: 'Analisis Biaya',
      read: true,
      isReport: true,
    },
  ]
}

function formatRelativeTime(timestamp?: string) {
  if (!timestamp) return 'Waktu tidak tersedia'
  const elapsed = Math.max(0, Date.now() - new Date(timestamp).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

function describePromotion(promotion: ActivePromotion) {
  const discount = promotion.type === 'percentage'
    ? `${promotion.value}%${promotion.max_discount ? ` (maks. Rp${new Intl.NumberFormat('id-ID').format(promotion.max_discount)})` : ''}`
    : `Rp${new Intl.NumberFormat('id-ID').format(promotion.value)}`
  const minimum = promotion.min_purchase > 0
    ? `, min. belanja Rp${new Intl.NumberFormat('id-ID').format(promotion.min_purchase)}`
    : ''
  return `${promotion.name} (${promotion.code}) — ${discount}${minimum}`
}

export default function Topbar({ title, subtitle, actions, role }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [notifOpen, setNotifOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'reports'>('all')
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const appearanceRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { preference, isDark, setPreference } = useTheme()

  // Tentukan role efektif
  const effectiveRole: 'kasir' | 'admin' | 'owner' | 'super_admin' = useMemo(() => {
    if (role) return role
    if (pathname?.startsWith('/super-admin')) return 'super_admin'
    if (pathname?.startsWith('/owner')) return 'owner'
    if (pathname?.startsWith('/admin')) return 'admin'
    return 'kasir'
  }, [role, pathname])
  const isDashboardPage = pathname === '/admin' || pathname === '/owner' || pathname === '/kasir' || pathname === '/super-admin'
  const isSearchPending = searchQuery !== deferredSearchQuery
  const searchableMenuItems = useMemo(
    () => menuByRole[effectiveRole].flatMap(group =>
      group.items.map(item => ({ label: item.label, href: item.href, group: group.label }))
    ),
    [effectiveRole]
  )
  const filteredSearchItems = useMemo(() => {
    const query = deferredSearchQuery.trim().toLocaleLowerCase('id-ID')
    if (!query) return []
    return searchableMenuItems.filter(item =>
      `${item.label} ${item.group}`.toLocaleLowerCase('id-ID').includes(query)
    )
  }, [deferredSearchQuery, searchableMenuItems])

  const navigateToSearchResult = (href: string) => {
    setSearchOpen(false)
    setSearchQuery('')
    setActiveSearchIndex(-1)
    router.push(href)
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearchOpen(false)
      setActiveSearchIndex(-1)
    } else if (event.key === 'ArrowDown' && !isSearchPending && filteredSearchItems.length > 0) {
      event.preventDefault()
      setSearchOpen(true)
      setActiveSearchIndex(index => (index + 1) % filteredSearchItems.length)
    } else if (event.key === 'ArrowUp' && !isSearchPending && filteredSearchItems.length > 0) {
      event.preventDefault()
      setSearchOpen(true)
      setActiveSearchIndex(index => index <= 0 ? filteredSearchItems.length - 1 : index - 1)
    } else if (event.key === 'Enter' && searchOpen && !isSearchPending && filteredSearchItems.length > 0) {
      event.preventDefault()
      const selected = filteredSearchItems[activeSearchIndex >= 0 ? activeSearchIndex : 0]
      navigateToSearchResult(selected.href)
    }
  }

  // Close popovers when clicking outside.
  useEffect(() => {
    setMounted(true)
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false)
      if (appearanceRef.current && !appearanceRef.current.contains(target)) setAppearanceOpen(false)
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Muat notifikasi sesuai role & dengarkan update dinamis
  useEffect(() => {
    const storageKey = `fluxa_notifications_${effectiveRole}`
    const defaults = getDefaultNotifications(effectiveRole)
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const storedNotifications: NotificationItem[] = JSON.parse(saved)
        const cleanedNotifications = effectiveRole === 'kasir'
          ? storedNotifications.filter(item => item.type !== 'promo' && item.id !== 'notif-k-1')
          : storedNotifications
        setNotifications(cleanedNotifications)
        if (cleanedNotifications.length !== storedNotifications.length) {
          localStorage.setItem(storageKey, JSON.stringify(cleanedNotifications))
        }
      } else {
        setNotifications(defaults)
      }
    } catch {
      setNotifications(defaults)
    }

    return undefined
  }, [effectiveRole])

  useEffect(() => {
    if (effectiveRole !== 'admin') return

    let active = true
    let refreshing = false
    const storageKey = 'fluxa_notifications_admin'

    const refreshRefundNotifications = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const response = await fetch('/api/admin/refund-requests', { cache: 'no-store' })
        const result: {
          requests?: {
            id: string
            status: string
            sale?: { invoice_number?: string; final_amount?: number } | null
            requester?: { full_name?: string } | null
            reason?: string
            created_at: string
          }[]
        } = await response.json()
        if (!response.ok || !Array.isArray(result.requests) || !active) return

        setNotifications(previous => {
          const existingById = new Map(previous.map(notification => [notification.id, notification]))
          const pendingNotifications: NotificationItem[] = result.requests!
            .filter(request => request.status === 'pending')
            .map(request => {
              const id = `refund-request-${request.id}`
              const existing = existingById.get(id)
              const invoice = request.sale?.invoice_number || 'Transaksi'
              const amount = typeof request.sale?.final_amount === 'number'
                ? ` (Rp${new Intl.NumberFormat('id-ID').format(request.sale.final_amount)})`
                : ''
              return {
                id,
                title: 'Pengajuan Refund Menunggu Persetujuan',
                message: `${request.requester?.full_name || 'Kasir'} mengajukan refund ${invoice}${amount}. Alasan: ${request.reason || 'Tidak dicantumkan'}.`,
                time: formatRelativeTime(request.created_at),
                timestamp: request.created_at,
                type: 'refund',
                badge: 'Perlu Persetujuan',
                badgeColor: 'var(--bad)',
                badgeBg: 'var(--bads)',
                link: '/admin/transaksi',
                actionLabel: 'Tinjau Pengajuan',
                read: existing?.read ?? false,
                isReport: true,
              }
            })
          const retained = previous.filter(notification => notification.type !== 'refund')
          const updated = [...pendingNotifications, ...retained]
          try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
          return updated
        })
      } catch (error) {
        console.error('Could not refresh admin refund notifications:', error)
      } finally {
        refreshing = false
      }
    }

    void refreshRefundNotifications()
    const intervalId = window.setInterval(() => void refreshRefundNotifications(), 30_000)
    window.addEventListener('focus', refreshRefundNotifications)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshRefundNotifications)
    }
  }, [effectiveRole])

  useEffect(() => {
    if (effectiveRole !== 'kasir') return

    const supabase = createClient()
    const storageKey = 'fluxa_notifications_kasir'
    let isMounted = true
    let refreshTimer: number | undefined
    let isRefreshing = false

    const refreshPromotionNotification = async () => {
      if (isRefreshing) return
      isRefreshing = true
      try {
        const activePromotions = await fetchActivePromotions(supabase)
        if (!isMounted) return

        window.dispatchEvent(new CustomEvent('fluxa_promotions_updated', { detail: activePromotions }))
        const lastChangedPromotion = [...activePromotions]
          .sort((first, second) => {
            const firstTime = new Date(first.updated_at || first.created_at).getTime()
            const secondTime = new Date(second.updated_at || second.created_at).getTime()
            return secondTime - firstTime
          })[0]
        const signature = activePromotions
          .map(promotion => `${promotion.id}:${promotion.code}:${promotion.name}:${promotion.type}:${promotion.value}:${promotion.min_purchase}:${promotion.max_discount ?? ''}`)
          .sort()
          .join('|')

        setNotifications(previous => {
          const existingNotification = previous.find(notification => notification.id === `promo-active-${signature}`)
          const retained = previous.filter(notification =>
            notification.type !== 'promo' && notification.id !== 'notif-k-1'
          )
          if (activePromotions.length === 0) {
            localStorage.setItem(storageKey, JSON.stringify(retained))
            return retained
          }

          const newNotification: NotificationItem = {
            id: `promo-active-${signature}`,
            title: 'Voucher & Diskon Aktif di Kasir',
            message: `Promo yang saat ini tersedia di Kasir: ${activePromotions.map(describePromotion).join('; ')}.`,
            time: formatRelativeTime(lastChangedPromotion?.updated_at || lastChangedPromotion?.created_at),
            timestamp: lastChangedPromotion?.updated_at || lastChangedPromotion?.created_at,
            type: 'promo',
            badge: 'Diskon Kasir',
            badgeColor: 'var(--acc)',
            badgeBg: 'var(--accs)',
            link: '/kasir',
            actionLabel: 'Buka POS & Terapkan',
            read: existingNotification?.read ?? false,
            isReport: false,
          }
          const updated = [newNotification, ...retained]
          localStorage.setItem(storageKey, JSON.stringify(updated))
          return updated
        })

        if (activePromotions.length > 0) {
          localStorage.setItem('fluxa_active_promotions', JSON.stringify(activePromotions))
        } else {
          localStorage.removeItem('fluxa_active_promotions')
        }
      } catch (error) {
        console.error('Could not synchronize cashier promotions and notifications:', error)
      } finally {
        isRefreshing = false
      }
    }

    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => void refreshPromotionNotification(), 150)
    }
    const channel = supabase
      .channel('cashier-promotion-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, scheduleRefresh)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void refreshPromotionNotification()
      })
    const pollingTimer = window.setInterval(() => void refreshPromotionNotification(), 30_000)
    const handleFocus = () => void refreshPromotionNotification()
    window.addEventListener('focus', handleFocus)
    void refreshPromotionNotification()

    return () => {
      isMounted = false
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      window.clearInterval(pollingTimer)
      window.removeEventListener('focus', handleFocus)
      void supabase.removeChannel(channel)
    }
  }, [effectiveRole])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNotifications(previous => previous.map(notification => notification.timestamp
        ? { ...notification, time: formatRelativeTime(notification.timestamp) }
        : notification
      ))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Tandai 1 notifikasi telah dibaca
  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      try { localStorage.setItem(`fluxa_notifications_${effectiveRole}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  // Tandai semua notifikasi telah dibaca
  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      try { localStorage.setItem(`fluxa_notifications_${effectiveRole}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  // Hapus 1 notifikasi
  const deleteNotif = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      try { localStorage.setItem(`fluxa_notifications_${effectiveRole}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const reportCount = notifications.filter(n => n.isReport).length

  // Filter notifikasi berdasarkan tab
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') return notifications.filter(n => !n.read)
    if (activeFilter === 'reports') return notifications.filter(n => n.isReport)
    return notifications
  }, [notifications, activeFilter])

  // Render icon notifikasi berdasarkan tipe
  const renderNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'refund':
        return <RotateCcw size={15} />
      case 'stok':
        return <Package size={15} />
      case 'promo':
        return <Tag size={15} />
      case 'shift':
        return <Clock size={15} />
      case 'checkup':
        return <Activity size={15} />
      case 'finansial':
        return <TrendingUp size={15} />
      case 'audit':
        return <ShieldAlert size={15} />
      case 'biaya':
        return <Receipt size={15} />
      case 'kasbon':
        return <CreditCard size={15} />
      default:
        return <Bell size={15} />
    }
  }

  // Label & warna role
  const roleMeta = {
    kasir: { label: 'KASIR', color: 'var(--acc)', bg: 'var(--accs)', title: 'Pusat Notifikasi Kasir' },
    admin: { label: 'ADMIN', color: 'var(--acc)', bg: 'var(--accs)', title: 'Pusat Notifikasi & Laporan Admin' },
    owner: { label: 'OWNER', color: 'var(--acc)', bg: 'var(--accs)', title: 'Pusat Laporan & Intelijen Bisnis Owner' },
    super_admin: { label: 'SUPER ADMIN', color: 'var(--acc)', bg: 'var(--accs)', title: 'Pusat Notifikasi Super Admin' },
  }[effectiveRole]

  return (
    <div className="topbar">
      {isDashboardPage && (
        <div ref={searchRef} className="dashboard-search-wrap">
          <div className="search-pill">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              role="combobox"
              aria-label="Cari menu dashboard"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={searchOpen}
              aria-controls="dashboard-search-results"
              aria-activedescendant={
                searchOpen && activeSearchIndex >= 0
                  ? `dashboard-search-option-${activeSearchIndex}`
                  : undefined
              }
              placeholder="Cari menu..."
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={event => {
                setSearchQuery(event.target.value)
                setSearchOpen(true)
                setActiveSearchIndex(-1)
              }}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery && (
              <button
                type="button"
                className="dashboard-search-clear"
                aria-label="Hapus pencarian"
                onClick={() => {
                  setSearchQuery('')
                  setActiveSearchIndex(-1)
                  setSearchOpen(true)
                  searchInputRef.current?.focus()
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
          {searchOpen && (
            <div
              id="dashboard-search-results"
              className="dashboard-search-results"
              role="listbox"
              aria-label="Hasil pencarian menu"
            >
              {isSearchPending ? (
                <p className="dashboard-search-empty" role="status">Mencari menu...</p>
              ) : searchQuery.trim() ? (
                filteredSearchItems.length > 0 ? (
                  filteredSearchItems.map((item, index) => (
                    <button
                      key={item.href}
                      id={`dashboard-search-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeSearchIndex === index}
                      className={`dashboard-search-result${activeSearchIndex === index ? ' is-active' : ''}`}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onClick={() => navigateToSearchResult(item.href)}
                    >
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.group}</small>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))
                ) : (
                  <p className="dashboard-search-empty" role="status">Menu tidak ditemukan.</p>
                )
              ) : (
                <p className="dashboard-search-empty">Ketik nama menu untuk mencari.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right side */}
      <div className="topbar-actions">
        {/* Appearance menu */}
        <div ref={appearanceRef} className="appearance-menu">
          <button
            className="icon-btn"
            onClick={() => setAppearanceOpen((open) => !open)}
            aria-label="Appearance"
            aria-expanded={appearanceOpen}
            aria-haspopup="menu"
            id="theme-toggle"
            title="Appearance"
          >
            {isDark ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          {appearanceOpen && (
            <div className="appearance-popover" role="menu" aria-label="Appearance">
              <strong>Appearance</strong>
              {([
                ['light', 'Light'],
                ['dark', 'Dark'],
                ['system', 'System'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="appearance-option"
                  role="menuitemradio"
                  aria-checked={preference === value}
                  onClick={() => {
                    setPreference(value)
                    setAppearanceOpen(false)
                  }}
                >
                  <span className="appearance-radio" aria-hidden="true">
                    {preference === value && <span />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifikasi Lonceng */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifikasi"
            id="notif-btn"
            style={{ position: 'relative' }}
            title={roleMeta.title}
          >
            <Bell size={16} />
            {mounted && unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  background: 'var(--bad)',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid var(--panel)',
                  boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Notifikasi & Laporan */}
          {notifOpen && (
            <div className="notif-dropdown">
              {/* Header Dropdown */}
              <div className="notif-dropdown-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
                    Pusat Notifikasi & Laporan
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: roleMeta.bg,
                      color: roleMeta.color,
                      border: `1px solid ${roleMeta.color}30`,
                      letterSpacing: '0.4px',
                    }}
                  >
                    {roleMeta.label}
                  </span>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--acc)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                    title="Tandai semua telah dibaca"
                  >
                    <CheckCheck size={13} />
                    <span>Tandai Dibaca</span>
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: 'flex',
                  padding: '8px 12px',
                  gap: 6,
                  borderBottom: '1px solid var(--line)',
                  background: 'var(--bg)',
                }}
              >
                <button
                  onClick={() => setActiveFilter('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: activeFilter === 'all' ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeFilter === 'all' ? 'var(--panel)' : 'transparent',
                    color: activeFilter === 'all' ? 'var(--ink)' : 'var(--mute)',
                    boxShadow: activeFilter === 'all' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Semua ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveFilter('unread')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: activeFilter === 'unread' ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeFilter === 'unread' ? 'var(--panel)' : 'transparent',
                    color: activeFilter === 'unread' ? 'var(--bad)' : 'var(--mute)',
                    boxShadow: activeFilter === 'unread' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Belum Dibaca ({unreadCount})
                </button>
                <button
                  onClick={() => setActiveFilter('reports')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: activeFilter === 'reports' ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeFilter === 'reports' ? 'var(--panel)' : 'transparent',
                    color: activeFilter === 'reports' ? 'var(--acc)' : 'var(--mute)',
                    boxShadow: activeFilter === 'reports' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Laporan ({reportCount})
                </button>
              </div>

              {/* List Notifikasi */}
              <div
                style={{
                  maxHeight: 390,
                  overflowY: 'auto',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {filteredNotifications.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      color: 'var(--mute)',
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 6 }}>✨</div>
                    <div style={{ fontWeight: 600 }}>Tidak ada notifikasi</div>
                    <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 2 }}>
                      Semua laporan dan aktivitas telah ditinjau.
                    </div>
                  </div>
                ) : (
                  filteredNotifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: n.read ? 'var(--panel)' : 'var(--bg)',
                        border: `1px solid ${n.read ? 'var(--line)' : 'var(--line)'}`,
                        borderLeft: n.read ? '1px solid var(--line)' : `3.5px solid ${n.badgeColor}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Baris Atas: Icon + Judul + Waktu + Hapus */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: n.badgeBg,
                              color: n.badgeColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {renderNotifIcon(n.type)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'var(--ink)',
                                  lineHeight: 1.3,
                                }}
                              >
                                {n.title}
                              </span>
                              {!n.read && (
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: 'var(--bad)',
                                    display: 'inline-block',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: n.badgeColor,
                                  background: n.badgeBg,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                {n.badge}
                              </span>
                              <span style={{ fontSize: 10.5, color: 'var(--mute)' }}>
                                • {n.time}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tombol Hapus */}
                        <button
                          onClick={(e) => deleteNotif(n.id, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--mute)',
                            padding: 2,
                            borderRadius: 4,
                            display: 'flex',
                          }}
                          title="Hapus notifikasi"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      {/* Pesan Notifikasi */}
                      <p
                        style={{
                          fontSize: 11.5,
                          color: 'var(--ink)',
                          margin: '2px 0 4px 0',
                          lineHeight: 1.45,
                          opacity: n.read ? 0.75 : 0.95,
                        }}
                      >
                        {n.message}
                      </p>

                      {/* Tombol Tindakan Cepat */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                        <Link
                          href={n.link}
                          onClick={() => {
                            markAsRead(n.id)
                            setNotifOpen(false)
                          }}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--acc)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'var(--accs)',
                          }}
                        >
                          <span>{n.actionLabel}</span>
                          <ChevronRight size={11} />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer info role */}
              <div
                style={{
                  padding: '9px 14px',
                  background: 'var(--panel)',
                  borderTop: '1px solid var(--line)',
                  fontSize: 11,
                  color: 'var(--mute)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Notifikasi terhubung sistem real-time Fluxa POS</span>
                <span style={{ fontWeight: 600, color: roleMeta.color }}>● Role {roleMeta.label}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page title (shown in mobile-friendly topbar) */}
      {(title || actions) && (
        <div style={{ display: 'none' }}>{title}</div>
      )}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: TopbarProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
