'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BrandLogo from '@/components/ui/BrandLogo'
import {
  LogOut, ChevronRight, ChevronDown, AlertCircle, Menu, PanelLeftClose, PanelLeftOpen, X
} from 'lucide-react'
import { TutupShiftModal } from '@/components/pos/KasMasukModal'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { menuByRole, type NavItem, type UserRole } from '@/components/layout/role-navigation'

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
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingRefundCount, setPendingRefundCount] = useState(0)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const hoverCloseTimer = useRef<number | null>(null)
  const keyboardNavigationRef = useRef(false)
  const isExpanded = pinnedOpen || hoverOpen

  useEffect(() => {
    if (role !== 'admin') return

    let active = true
    const loadPendingRefundCount = async () => {
      try {
        const response = await fetch('/api/admin/refund-requests', { cache: 'no-store' })
        const result: { requests?: { status: string }[] } = await response.json()
        if (!response.ok || !Array.isArray(result.requests) || !active) return
        setPendingRefundCount(result.requests.filter(request => request.status === 'pending').length)
      } catch (error) {
        console.error('Unable to refresh pending refund count in sidebar:', error)
      }
    }

    void loadPendingRefundCount()
    const intervalId = window.setInterval(() => void loadPendingRefundCount(), 30_000)
    window.addEventListener('focus', loadPendingRefundCount)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadPendingRefundCount)
    }
  }, [role])

  useEffect(() => () => {
    if (hoverCloseTimer.current !== null) window.clearTimeout(hoverCloseTimer.current)
  }, [])

  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key === 'Tab') keyboardNavigationRef.current = true
    }
    const handlePointerNavigation = () => {
      keyboardNavigationRef.current = false
    }
    document.addEventListener('keydown', handleKeyboardNavigation)
    document.addEventListener('pointerdown', handlePointerNavigation)
    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation)
      document.removeEventListener('pointerdown', handlePointerNavigation)
    }
  }, [])

  // State untuk modal Tutup Shift (hanya kasir)
  const [showTutupModal, setShowTutupModal] = useState(false)
  const [currentShift, setCurrentShift] = useState<any>(initialShift || null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // 1. Sync jika initialShift dari server berubah
  useEffect(() => {
    if (initialShift !== undefined) {
      setCurrentShift(initialShift)
      if (initialShift?.cashier_id) {
        setCurrentUserId(initialShift.cashier_id)
      }
    }
  }, [initialShift])

  // 2. Sync realtime dari custom event 'shift_changed' & cek database saat mount
  useEffect(() => {
    const handleShiftEvent = (e: any) => {
      setCurrentShift(e.detail || null)
      if (e.detail?.cashier_id) {
        setCurrentUserId(e.detail.cashier_id)
      }
    }
    window.addEventListener('shift_changed', handleShiftEvent)

    const fetchActiveShift = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          if (role === 'kasir') {
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
        }
      } catch (e) {
        // ignore error
      }
    }
    fetchActiveShift()

    return () => {
      window.removeEventListener('shift_changed', handleShiftEvent)
    }
  }, [role, supabase])

  useEffect(() => {
    if (!mobileOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        mobileTriggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [mobileOpen])

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
      // Tidak ada shift aktif → tampilkan konfirmasi logout
    }
    setShowLogoutConfirm(true)
  }

  const groups = menuByRole[role] || menuByRole.kasir

  // Cek apakah sebuah menu (atau submenu) sedang aktif.
  // Cocokkan secara persis, atau sebagai prefiks direktori (href + '/')
  // agar '/admin/hutang-piutang' tidak ikut aktif saat berada di '/admin/hutang-piutang/kategori'.
  const isItemActive = (href: string, siblings: NavItem[] = []) => {
    if (pathname === href) return true
    const rootHref = role === 'super_admin' ? '/super-admin' : '/' + role
    if (href === rootHref) return false

    const betterMatch = siblings.some(s =>
      s.href !== href &&
      (pathname === s.href || pathname.startsWith(s.href + '/')) &&
      s.href.length > href.length
    )
    if (betterMatch) return false

    return pathname.startsWith(href + '/')
  }

  const groupHasActiveChild = (item: NavItem) =>
    (item.children ?? []).some(child => isItemActive(child.href, item.children))

  // Grup tetap terbuka saat salah satu submenu aktif, selain itu mengikuti toggle pengguna.
  const isGroupOpen = (item: NavItem) => groupHasActiveChild(item) || !!openGroups[item.href]

  const toggleGroup = (item: NavItem) => {
    setOpenGroups(prev => ({ ...prev, [item.href]: !(prev[item.href] ?? groupHasActiveChild(item)) }))
  }

  const roleLabel = role === 'kasir'
    ? 'Kasir'
    : role === 'admin'
      ? 'Admin'
      : role === 'owner'
        ? 'Owner'
        : 'Super Admin'
  const dashboardHref = role === 'super_admin' ? '/super-admin' : role === 'kasir' ? '/kasir' : `/${role}`
  const roleColor = 'var(--acc)'
  const closeMobileSidebar = () => {
    setMobileOpen(false)
    if (window.matchMedia('(max-width: 860px)').matches) {
      mobileTriggerRef.current?.focus()
    }
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-trigger"
        ref={mobileTriggerRef}
        aria-controls="fluxa-sidebar"
        aria-label="Buka navigasi"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={21} />
      </button>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-mobile-backdrop"
          aria-label="Tutup navigasi"
          onClick={closeMobileSidebar}
        />
      )}
      {/* Modal Tutup Shift — muncul di atas sidebar saat kasir mau logout */}
      {showTutupModal && currentShift && (
        <TutupShiftModal
          activeShift={currentShift}
          userId={currentUserId || currentShift?.cashier_id || ''}
          onSuccess={() => {
            setShowTutupModal(false)
            setCurrentShift(null)
            doLogout()
          }}
          onCancel={() => setShowTutupModal(false)}
        />
      )}

      <ConfirmationDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={doLogout}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari akun Anda?"
        confirmLabel="Keluar"
        cancelLabel="Batal"
        variant="danger"
        icon="logout"
        isLoading={loggingOut}
      />

      <aside
        id="fluxa-sidebar"
        className={`sidebar${isExpanded ? ' sidebar-expanded' : ''}${pinnedOpen ? ' sidebar-pinned' : ''}${mobileOpen ? ' sidebar-mobile-open' : ''}`}
        aria-label="Navigasi utama"
        onMouseEnter={() => {
          if (hoverCloseTimer.current !== null) window.clearTimeout(hoverCloseTimer.current)
          hoverCloseTimer.current = null
          setHoverOpen(true)
        }}
        onMouseLeave={() => {
          if (hoverCloseTimer.current !== null) window.clearTimeout(hoverCloseTimer.current)
          hoverCloseTimer.current = window.setTimeout(() => {
            setHoverOpen(false)
            hoverCloseTimer.current = null
          }, 120)
        }}
        onFocusCapture={() => {
          if (keyboardNavigationRef.current) setHoverOpen(true)
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setHoverOpen(false)
          }
        }}
      >
        {/* Logo + User */}
        <div className="sidebar-identity">
          <div className="sidebar-brand-row">
            <Link className="sidebar-brand" href={dashboardHref} aria-label="Fluxa, dashboard">
              <BrandLogo size={32} />
              <span className="sidebar-label sidebar-brand-name">Fluxa</span>
            </Link>
            <button
              type="button"
              className="sidebar-expand-toggle"
              aria-label={pinnedOpen ? 'Ciutkan sidebar' : 'Perluas dan sematkan sidebar'}
              aria-expanded={isExpanded}
              onClick={() => setPinnedOpen((pinned) => !pinned)}
            >
              {pinnedOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <button
              type="button"
              className="sidebar-mobile-close"
              aria-label="Tutup navigasi"
              onClick={closeMobileSidebar}
            >
              <X size={20} />
            </button>
          </div>

          {/* User info */}
          <div className="sidebar-user sidebar-label" style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '10px',
            background: 'var(--bg)', borderRadius: 12, marginBottom: 4
          }}>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600 }} className="sidebar-role-label">{roleLabel}</div>
            </div>
          </div>

          {/* Shift indicator untuk kasir */}
          {role === 'kasir' && currentShift && (
            <div className="sidebar-shift sidebar-label" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              background: 'var(--oks)', borderRadius: 8, marginTop: 6, marginBottom: 4
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>Shift Aktif</span>
            </div>
          )}
          {role === 'kasir' && !currentShift && (
            <div className="sidebar-shift sidebar-label" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              background: 'var(--warns)', borderRadius: 8, marginTop: 6, marginBottom: 4
            }}>
              <AlertCircle size={10} color="var(--warn)" />
              <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 600 }}>Shift Belum Dibuka</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-navigation" aria-label="Menu aplikasi">
          {groups.map(group => (
            <div className="sidebar-nav-group" key={group.label}>
              <div className="nav-group-label sidebar-label">{group.label}</div>
              {group.items.map(item => {
                const rootHref = role === 'super_admin' ? '/super-admin' : '/' + role
                const badge = role === 'admin' && item.href === '/admin/transaksi'
                  ? pendingRefundCount
                  : item.badge

                // Menu induk (memiliki submenu) — dapat dibuka/ditutup.
                if (item.children && item.children.length > 0) {
                  const childActive = groupHasActiveChild(item)
                  const open = isGroupOpen(item)
                  return (
                    <div className="sidebar-submenu-block" key={item.href}>
                      <button
                        type="button"
                        className="nav-item sidebar-link sidebar-parent"
                        aria-label={item.label}
                        aria-expanded={open}
                        title={isExpanded ? undefined : item.label}
                        onClick={() => toggleGroup(item)}
                      >
                        <span style={{ color: childActive ? 'var(--acc)' : 'var(--mute)', flexShrink: 0 }}>
                          {item.icon}
                        </span>
                        <span className="sidebar-label sidebar-link-label">{item.label}</span>
                        <ChevronDown
                          className="sidebar-parent-chevron sidebar-label"
                          size={14}
                          style={{
                            marginLeft: 'auto',
                            color: childActive ? 'var(--acc)' : 'var(--mute)',
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 180ms ease'
                          }}
                        />
                      </button>
                      {open && (
                        <div className="sidebar-submenu">
                          {item.children.map(child => {
                            const childIsActive = isItemActive(child.href, item.children)
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={`nav-item sidebar-link sidebar-sublink ${childIsActive ? 'active' : ''}`}
                                aria-label={child.label}
                                aria-current={childIsActive ? 'page' : undefined}
                                title={isExpanded ? undefined : child.label}
                                onClick={closeMobileSidebar}
                              >
                                <span style={{ color: childIsActive ? 'var(--acc)' : 'var(--mute)', flexShrink: 0 }}>
                                  {child.icon}
                                </span>
                                <span className="sidebar-label sidebar-link-label">{child.label}</span>
                                {child.badge !== undefined && (
                                  <span className="nav-badge sidebar-label">{child.badge}</span>
                                )}
                                {childIsActive && <ChevronRight className="sidebar-active-chevron sidebar-label" size={13} style={{ marginLeft: 'auto', color: 'var(--acc)' }} />}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                const isActive = isItemActive(item.href, group.items)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item sidebar-link ${isActive ? 'active' : ''}`}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    title={isExpanded ? undefined : item.label}
                    onClick={closeMobileSidebar}
                  >
                    <span style={{ color: isActive ? 'var(--acc)' : 'var(--mute)', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    <span className="sidebar-label sidebar-link-label">{item.label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span className="nav-badge sidebar-label" aria-label={`${badge} pengajuan refund menunggu persetujuan`}>
                        {badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="sidebar-active-chevron sidebar-label" size={13} style={{ marginLeft: 'auto', color: 'var(--acc)' }} />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="sidebar-logout">
          <button
            id="logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            className="nav-item"
            aria-label={loggingOut ? 'Sedang keluar' : role === 'kasir' && currentShift ? 'Tutup Shift dan Keluar' : 'Keluar'}
            title={isExpanded ? undefined : 'Keluar'}
          >
            <LogOut size={16} />
            <span className="sidebar-label sidebar-link-label">
              {loggingOut ? 'Keluar...' : role === 'kasir' && currentShift ? 'Tutup Shift & Keluar' : 'Keluar'}
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}
