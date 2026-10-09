'use client'

import {
  Bell, Search, Moon, Sun, RotateCcw, Package, Tag, Clock,
  Activity, TrendingUp, ShieldAlert, CheckCheck, X, ChevronRight,
  Receipt, CreditCard, Sparkles, Check
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
}

interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  role?: 'kasir' | 'admin' | 'owner'
}

function getDefaultNotifications(role: 'kasir' | 'admin' | 'owner'): NotificationItem[] {
  if (role === 'kasir') {
    return [
      {
        id: 'notif-k-1',
        title: 'Voucher & Diskon Baru Aktif',
        message: 'Admin telah merilis promo HEMAT10 & FLUXA20K. Tawarkan kepada pelanggan untuk mendongkrak penjualan kasir.',
        time: '10 mnt lalu',
        type: 'promo',
        badge: 'Diskon Kasir',
        badgeColor: 'var(--acc)',
        badgeBg: 'var(--accs)',
        link: '/kasir',
        actionLabel: 'Buka POS & Terapkan',
        read: false,
        isReport: false,
      },
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
        id: 'notif-a-1',
        title: 'Laporan Refund Kasir (Perlu Audit)',
        message: 'Kasir baru saja membatalkan transaksi INV-2026-003 (Rp75.000). Alasan: Salah input barang. Segera audit verifikasi.',
        time: 'Baru saja',
        type: 'refund',
        badge: 'Laporan Kasir',
        badgeColor: 'var(--bad)',
        badgeBg: 'var(--bads)',
        link: '/admin/transaksi',
        actionLabel: 'Audit Transaksi',
        read: false,
        isReport: true,
      },
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
        title: 'Laporan Kasbon & Piutang Pelanggan',
        message: 'Total 3 kasbon belum lunas (Rp350.000). Kasbon atas nama Budi Santoso mendekati batas tempo 7 hari.',
        time: '1 hari lalu',
        type: 'kasbon',
        badge: 'Piutang Kasbon',
        badgeColor: 'var(--warn)',
        badgeBg: 'var(--warns)',
        link: '/admin/kasbon',
        actionLabel: 'Cek Piutang',
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

export default function Topbar({ title, subtitle, actions, role }: TopbarProps) {
  const pathname = usePathname()
  const [dark, setDark] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'reports'>('all')
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  // Tentukan role efektif
  const effectiveRole: 'kasir' | 'admin' | 'owner' = useMemo(() => {
    if (role) return role
    if (pathname?.startsWith('/owner')) return 'owner'
    if (pathname?.startsWith('/admin')) return 'admin'
    return 'kasir'
  }, [role, pathname])

  // Inisialisasi tema & klik luar dropdown
  useEffect(() => {
    setMounted(true)
    const isDark = document.documentElement.classList.contains('dark') ||
      localStorage.getItem('fluxa-theme') === 'dark'
    setDark(isDark)
    if (isDark) {
      document.documentElement.classList.add('dark')
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
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
        setNotifications(JSON.parse(saved))
      } else {
        setNotifications(defaults)
      }
    } catch {
      setNotifications(defaults)
    }

    // Dengarkan event refund kasir baru (sinkronisasi laporan refund ke Admin & Owner)
    const handleRefundCreated = (e: any) => {
      const refund = e.detail
      if (!refund) return

      if (effectiveRole === 'admin' || effectiveRole === 'owner') {
        setNotifications(prev => {
          const newNotif: NotificationItem = {
            id: `refund-${Date.now()}`,
            title: effectiveRole === 'admin' ? '🚨 Laporan Refund Kasir Baru!' : '🛡️ Audit: Pembatalan Transaksi Kasir',
            message: `Kasir membatalkan transaksi ${refund.invoice || 'penjualan'} (Rp${new Intl.NumberFormat('id-ID').format(refund.amount || 0)}). Alasan: ${refund.reason || 'Refund kasir'}.`,
            time: 'Baru saja',
            type: 'refund',
            badge: effectiveRole === 'admin' ? 'Laporan Kasir' : 'Audit Integritas',
            badgeColor: 'var(--bad)',
            badgeBg: 'var(--bads)',
            link: effectiveRole === 'admin' ? '/admin/transaksi' : '/owner/transaksi',
            actionLabel: 'Audit Transaksi',
            read: false,
            isReport: true,
          }
          const updated = [newNotif, ...prev]
          try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
          return updated
        })
      }
    }

    window.addEventListener('fluxa_refund_created', handleRefundCreated)
    return () => window.removeEventListener('fluxa_refund_created', handleRefundCreated)
  }, [effectiveRole])

  const toggleTheme = () => {
    const nextDark = !dark
    setDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('fluxa-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('fluxa-theme', 'light')
    }
  }

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
    kasir: { label: 'KASIR', color: 'var(--ok)', bg: 'var(--oks)', title: 'Pusat Notifikasi Kasir' },
    admin: { label: 'ADMIN', color: 'var(--acc)', bg: 'var(--accs)', title: 'Pusat Notifikasi & Laporan Admin' },
    owner: { label: 'OWNER', color: 'var(--warn)', bg: 'var(--warns)', title: 'Pusat Laporan & Intelijen Bisnis Owner' },
  }[effectiveRole]

  return (
    <div className="topbar">
      {/* Search */}
      <div className="search-pill" style={{ flex: 1, maxWidth: 340 }}>
        <Search size={14} color="var(--mute)" />
        <input placeholder="Cari... ⌘K" aria-label="Cari" />
      </div>

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        {/* Theme Toggle */}
        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label="Toggle tema"
          id="theme-toggle"
          title={dark ? 'Mode Terang' : 'Mode Gelap'}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

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
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 390,
                maxWidth: '92vw',
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
                zIndex: 9999,
                overflow: 'hidden',
                animation: 'fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header Dropdown */}
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--line)',
                  background: 'var(--panel)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--mute)', fontSize: 13, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}
