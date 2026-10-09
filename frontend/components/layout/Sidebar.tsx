'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, ShoppingCart, Package, Users, DollarSign,
  CreditCard, BarChart3, FileText, Activity, LogOut,
  ChevronRight, Sparkles, Bell, TrendingUp, ClipboardList,
  Layers, Settings, AlertCircle, Tag
} from 'lucide-react'
import { TutupShiftModal } from '@/components/pos/KasMasukModal'

type UserRole = 'kasir' | 'admin' | 'owner'

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const menuByRole: Record<UserRole, NavGroup[]> = {
  kasir: [
    {
      label: 'Utama',
      items: [
        { icon: <ShoppingCart size={16} />, label: 'Kasir / POS', href: '/kasir' },
        { icon: <FileText size={16} />, label: 'Riwayat Transaksi', href: '/kasir/riwayat' },
      ]
    }
  ],
  admin: [
    {
      label: 'Utama',
      items: [
        { icon: <LayoutDashboard size={16} />, label: 'Dashboard', href: '/admin' },
        { icon: <ShoppingCart size={16} />, label: 'Transaksi', href: '/admin/transaksi' },
        { icon: <Activity size={16} />, label: 'Buka / Tutup Shift', href: '/admin/shift' },
      ]
    },
    {
      label: 'Produk',
      items: [
        { icon: <Package size={16} />, label: 'Kelola Produk', href: '/admin/produk' },
        { icon: <Layers size={16} />, label: 'Stok & Kartu Stok', href: '/admin/stok' },
        { icon: <ClipboardList size={16} />, label: 'Kategori', href: '/admin/kategori' },
      ]
    },
    {
      label: 'Keuangan',
      items: [
        { icon: <Tag size={16} />, label: 'Diskon & Promo', href: '/admin/diskon' },
        { icon: <DollarSign size={16} />, label: 'Biaya Operasional', href: '/admin/biaya' },
        { icon: <CreditCard size={16} />, label: 'Kasbon & Piutang', href: '/admin/kasbon' },
      ]
    },
    {
      label: 'Akun',
      items: [
        { icon: <Users size={16} />, label: 'Kelola Kasir', href: '/admin/pengguna' },
      ]
    }
  ],
  owner: [
    {
      label: 'Utama',
      items: [
        { icon: <LayoutDashboard size={16} />, label: 'Dashboard', href: '/owner' },
        { icon: <Sparkles size={16} />, label: 'Business Health', href: '/owner/rapor' },
      ]
    },
    {
      label: 'Laporan',
      items: [
        { icon: <TrendingUp size={16} />, label: 'Cashflow', href: '/owner/cashflow' },
        { icon: <BarChart3 size={16} />, label: 'Laporan Bulanan', href: '/owner/laporan' },
        { icon: <CreditCard size={16} />, label: 'Hutang & Piutang', href: '/owner/hutang-piutang' },
      ]
    },
    {
      label: 'Operasional',
      items: [
        { icon: <Activity size={16} />, label: 'Buka / Tutup Shift', href: '/owner/shift' },
        { icon: <Package size={16} />, label: 'Monitoring Stok', href: '/owner/stok' },
        { icon: <Users size={16} />, label: 'Kelola Pengguna', href: '/owner/pengguna' },
        { icon: <FileText size={16} />, label: 'Audit Log', href: '/owner/audit' },
      ]
    }
  ]
}

interface SidebarProps {
  role: UserRole
  userName: string
  activeShift?: any   // Hanya dipass untuk kasir — dipakai untuk cek shift sebelum logout
}

export default function Sidebar({ role, userName, activeShift: initialShift }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [loggingOut, setLoggingOut] = useState(false)

  // State untuk modal Tutup Shift (hanya kasir)
  const [showTutupModal, setShowTutupModal] = useState(false)
  const [currentShift, setCurrentShift] = useState<any>(initialShift || null)

  // 1. Sync jika initialShift dari server berubah
  useEffect(() => {
    if (initialShift !== undefined) {
      setCurrentShift(initialShift)
    }
  }, [initialShift])

  // 2. Sync realtime dari custom event 'shift_changed' & cek database saat mount
  useEffect(() => {
    const handleShiftEvent = (e: any) => {
      setCurrentShift(e.detail || null)
    }
    window.addEventListener('shift_changed', handleShiftEvent)

    if (role === 'kasir') {
      const fetchActiveShift = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: shifts } = await supabase
              .from('shifts')
              .select('*')
              .eq('cashier_id', user.id)
              .eq('status', 'open')
              .order('opened_at', { ascending: false })
              .limit(1)
            if (shifts && shifts.length > 0) {
              setCurrentShift(shifts[0])
            }
          }
        } catch (e) {
          // ignore error
        }
      }
      fetchActiveShift()
    }

    return () => {
      window.removeEventListener('shift_changed', handleShiftEvent)
    }
  }, [role, supabase])

  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const doLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleLogout = async () => {
    if (role === 'kasir') {
      // Cek apakah ada shift aktif yang sedang berjalan
      let shift = currentShift
      if (!shift) {
        // Coba ambil dari DB jika belum ada
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: shifts } = await supabase
              .from('shifts')
              .select('*')
              .eq('cashier_id', user.id)
              .eq('status', 'open')
              .limit(1)
            shift = shifts?.[0] || null
          }
        } catch { /* demo mode */ }
      }

      if (shift) {
        // Ada shift aktif → wajib tutup shift dulu
        setCurrentShift(shift)
        setShowTutupModal(true)
        return
      }
      // Tidak ada shift aktif → langsung logout
    }
    doLogout()
  }

  const groups = menuByRole[role] || menuByRole.kasir

  const roleLabel = role === 'kasir' ? 'Kasir' : role === 'admin' ? 'Admin' : 'Owner'
  const roleColor = role === 'kasir' ? '#B26A00' : role === 'admin' ? '#2F6BFF' : '#1F9D63'

  return (
    <>
      {/* Modal Tutup Shift — muncul di atas sidebar saat kasir mau logout */}
      {showTutupModal && currentShift && (
        <TutupShiftModal
          activeShift={currentShift}
          userId=""
          onSuccess={() => {
            setShowTutupModal(false)
            setCurrentShift(null)
            doLogout()
          }}
          onCancel={() => setShowTutupModal(false)}
        />
      )}

      <aside className="sidebar">
        {/* Logo + User */}
        <div style={{ padding: '16px 12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #2F6BFF, #1636A8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <BarChart3 size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Fluxa</span>
          </div>

          {/* User info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '10px',
            background: 'var(--bg)', borderRadius: 12, marginBottom: 4
          }}>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: roleColor }}>{roleLabel}</div>
            </div>
          </div>

          {/* Shift indicator untuk kasir */}
          {role === 'kasir' && currentShift && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              background: 'var(--oks)', borderRadius: 8, marginTop: 6, marginBottom: 4
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>Shift Aktif</span>
            </div>
          )}
          {role === 'kasir' && !currentShift && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              background: 'var(--warns)', borderRadius: 8, marginTop: 6, marginBottom: 4
            }}>
              <AlertCircle size={10} color="var(--warn)" />
              <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 600 }}>Shift Belum Dibuka</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ padding: '8px 8px', flex: 1 }}>
          {groups.map(group => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(item => {
                const isActive = pathname === item.href || (item.href !== '/' + role && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span style={{ color: isActive ? 'var(--acc)' : 'var(--mute)', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {item.label}
                    {item.badge !== undefined && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                    {isActive && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--acc)' }} />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Promo card (admin/kasir) */}
        {role !== 'owner' && (
          <div className="promo-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={14} color="#fff" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Business Health AI</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 10 }}>
              Rapor kesehatan bisnis otomatis tersedia untuk Owner.
            </p>
            <Link href="/owner/rapor" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--acc)', color: '#fff', padding: '5px 12px',
              borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none'
            }}>
              <BarChart3 size={12} /> Lihat Rapor
            </Link>
          </div>
        )}

        {/* Logout */}
        <div style={{ padding: '8px 8px 16px' }}>
          <button
            id="logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            className="nav-item"
            style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--bad)' }}
          >
            <LogOut size={16} style={{ color: 'var(--bad)' }} />
            {loggingOut ? 'Keluar...' : role === 'kasir' && currentShift ? 'Tutup Shift & Keluar' : 'Keluar'}
          </button>
        </div>
      </aside>
    </>
  )
}
