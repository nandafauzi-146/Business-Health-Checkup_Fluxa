'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog'
import { ErrorBox, Empty, Loading } from './SuperAdminOverview'
import styles from './super-admin-content.module.css'

type UserRow = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: UserRole
  approval_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  trial_started_at: string | null
  trial_ends_at: string | null
  isActive: boolean
}

type UserResponse = { users: UserRow[]; total: number; page: number; pageSize: number }
const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' })
const roleLabel: Record<UserRole, string> = { super_admin: 'Super Admin', admin: 'Admin', owner: 'Owner', kasir: 'Kasir' }
const statusLabel = { approved: 'Disetujui', pending: 'Menunggu', rejected: 'Ditolak' }

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [role, setRole] = useState('')
  const [approvalStatus, setApprovalStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', email: '', phone: '', password: '', role: 'owner' })
  const [detailUser, setDetailUser] = useState<UserRow | null>(null)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', role: 'owner' as UserRole })
  const [savingEdit, setSavingEdit] = useState(false)
  const [pendingUserChange, setPendingUserChange] = useState<{
    user: UserRow
    change: { role?: UserRole; active?: boolean }
  } | null>(null)

  const fetchUsers = useCallback(async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search: searchTerm })
      if (role) params.set('role', role)
      if (approvalStatus) params.set('approvalStatus', approvalStatus)
      const response = await fetch(`/api/super-admin/users?${params}`, { cache: 'no-store' })
      const result = await response.json() as UserResponse & { error?: string }
      if (!response.ok) throw new Error(result.error || 'Daftar pengguna belum dapat dimuat.')
      return result
  }, [page, pageSize, searchTerm, role, approvalStatus])

  useEffect(() => {
    let cancelled = false
    async function loadUsers() {
      try {
        const result = await fetchUsers()
        if (cancelled) return
        setUsers(result.users)
        setTotal(result.total)
        setError('')
      } catch (loadError) {
        console.error('Unable to load Super Admin users.', loadError)
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Daftar pengguna belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadUsers()
    return () => { cancelled = true }
  }, [fetchUsers])

  const load = async () => {
    setLoading(true)
    try {
      const result = await fetchUsers()
      setUsers(result.users)
      setTotal(result.total)
      setError('')
    } catch (loadError) {
      console.error('Unable to load Super Admin users.', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Daftar pengguna belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearchTerm(search.trim())
    setLoading(true)
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/super-admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Akun belum dapat dibuat.')
      setNotice('Akun berhasil dibuat. Kata sandi awal tidak ditampilkan kembali setelah proses ini.')
      setSearch(newUser.email)
      setSearchTerm(newUser.email)
      setRole('')
      setApprovalStatus('')
      setPage(1)
      setNewUser({ full_name: '', email: '', phone: '', password: '', role: 'owner' })
      setCreateOpen(false)
    } catch (createError) {
      console.error('Unable to create Super Admin account.', createError)
      setError(createError instanceof Error ? createError.message : 'Akun belum dapat dibuat.')
    } finally {
      setCreating(false)
    }
  }

  async function updateUser(user: UserRow, change: { role?: UserRole; active?: boolean }) {
    setProcessing(user.id)
    setError('')
    try {
      const response = await fetch('/api/super-admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, ...change }),
      })
      const result = await response.json() as { error?: string; auditRecorded?: boolean }
      if (!response.ok) throw new Error(result.error || 'Perubahan pengguna gagal.')
      setNotice(result.auditRecorded === false ? 'Perubahan berhasil, tetapi belum tercatat di audit log.' : 'Perubahan pengguna berhasil dan dicatat.')
      await load()
    } catch (updateError) {
      console.error('Unable to update Super Admin user.', updateError)
      setError(updateError instanceof Error ? updateError.message : 'Perubahan pengguna gagal.')
    } finally {
      setProcessing(null)
      setPendingUserChange(null)
    }
  }

  function openEdit(user: UserRow) {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name,
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.role,
    })
    setError('')
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingUser) return

    setSavingEdit(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/super-admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingUser.id, ...editForm }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Perubahan pengguna gagal.')
      setNotice('Data pengguna berhasil diperbarui dan dicatat di audit log.')
      setEditingUser(null)
      await load()
    } catch (saveError) {
      console.error('Unable to edit Super Admin user.', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Perubahan pengguna gagal.')
    } finally {
      setSavingEdit(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div><span className={styles.eyebrow}>AKUN PLATFORM</span><h1>Manajemen Pengguna</h1><p>Cari akun, tinjau akses, ubah role, dan blokir atau pulihkan kemampuan login akun.</p></div>
        <div className={styles.filters}>
          <button className={styles.primaryButton} type="button" onClick={() => setCreateOpen(true)}><Plus size={14} /> Tambah akun</button>
          <button className={styles.secondaryButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Muat ulang</button>
        </div>
      </div>
      {createOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setCreateOpen(false) }}>
          <form className={`${styles.panel} ${styles.userDialog} ${styles.userForm}`} onSubmit={createUser} role="dialog" aria-modal="true" aria-labelledby="user-create-title">
            <div className={styles.modalHeading}>
              <div className={styles.modalHeadingIcon}><Plus size={18} /></div>
              <div className={styles.modalHeadingCopy}><h2 id="user-create-title">Buat akun pengguna</h2><p>Akun dibuat aktif; Owner mendapatkan trial awal tujuh hari.</p></div>
              <button className={styles.modalClose} type="button" onClick={() => setCreateOpen(false)} aria-label="Tutup form" disabled={creating}><X size={17} /></button>
            </div>
            {error && <div className={styles.errorBox} role="alert">{error}</div>}
            <div className={styles.userFormGrid}>
              <label>Nama lengkap<input required minLength={2} maxLength={120} autoComplete="name" value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} /></label>
              <label>Email<input required type="email" maxLength={254} autoComplete="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></label>
              <label>Telepon<input type="tel" maxLength={32} autoComplete="tel" value={newUser.phone} onChange={(event) => setNewUser({ ...newUser, phone: event.target.value })} /></label>
              <label>Role akun
                <select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                  <option value="owner">Owner</option><option value="admin">Admin</option><option value="kasir">Kasir</option>
                </select>
              </label>
              <label className={styles.userFormFullWidth}>Kata sandi awal
                <input required type="password" minLength={12} maxLength={72} autoComplete="new-password" aria-label="Kata sandi awal minimal 12 karakter" placeholder="Minimal 12 karakter" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => setCreateOpen(false)} disabled={creating}>Batal</button>
              <button className={styles.primaryButton} type="submit" disabled={creating}>{creating ? 'Membuat...' : 'Buat akun'}</button>
            </div>
          </form>
        </div>
      )}
      <form className={styles.filters} onSubmit={submitSearch}>
        <input aria-label="Cari nama atau email" placeholder="Cari nama atau email..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filter role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); setLoading(true) }}>
          <option value="">Semua role</option><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="owner">Owner</option><option value="kasir">Kasir</option>
        </select>
        <select aria-label="Filter status" value={approvalStatus} onChange={(event) => { setApprovalStatus(event.target.value); setPage(1); setLoading(true) }}>
          <option value="">Semua status</option><option value="approved">Disetujui</option><option value="pending">Menunggu</option><option value="rejected">Ditolak</option>
        </select>
        <button className={styles.primaryButton} type="submit"><Search size={14} /> Cari</button>
      </form>
      {notice && <p className={styles.infoBox} role="status">{notice}</p>}
      {error && <ErrorBox message={error} retry={() => void load()} />}
      {loading ? <Loading /> : users.length === 0 ? <Empty text="Tidak ada pengguna yang sesuai dengan pencarian." /> : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Pengguna</th><th>Telepon</th><th>Role</th><th>Status</th><th>Registrasi</th><th>Trial berakhir</th><th>Akun</th><th>Aksi</th></tr></thead>
              <tbody>{users.map((user) => {
                const isSuperAdmin = user.role === 'super_admin'
                return (
                  <tr key={user.id}>
                    <td><strong>{user.full_name}</strong><small>{user.email || 'Email tidak tersedia'}</small></td>
                    <td>{user.phone || 'Tidak dicantumkan'}</td>
                    <td>{isSuperAdmin ? roleLabel[user.role] : (
                      <select aria-label={`Role ${user.full_name}`} value={user.role} disabled={processing === user.id} onChange={(event) => setPendingUserChange({ user, change: { role: event.target.value as UserRole } })}>
                        <option value="kasir">Kasir</option><option value="admin">Admin</option><option value="owner">Owner</option>
                      </select>
                    )}</td>
                    <td><span className={`${styles.badge} ${styles[`status_${user.approval_status}`]}`}>{statusLabel[user.approval_status]}</span></td>
                    <td>{dateFormat.format(new Date(user.created_at))}</td>
                    <td>{user.trial_ends_at ? dateFormat.format(new Date(user.trial_ends_at)) : 'Belum ada tanggal'}</td>
                    <td><span className={`${styles.badge} ${user.isActive ? styles.status_active : styles.status_inactive}`}>{isSuperAdmin ? 'Dilindungi' : user.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td>
                      <div className={styles.userActions}>
                        <button className={styles.secondaryButton} type="button" onClick={() => setDetailUser(user)}><Eye size={13} /> Detail</button>
                        {!isSuperAdmin && <>
                          <button className={styles.secondaryButton} type="button" onClick={() => openEdit(user)}><Pencil size={13} /> Edit</button>
                          {user.isActive ? (
                            <button className={styles.dangerButton} type="button" disabled={processing === user.id} onClick={() => setPendingUserChange({ user, change: { active: false } })}>
                              <Trash2 size={13} /> {processing === user.id ? 'Memproses...' : 'Hapus'}
                            </button>
                          ) : user.approval_status === 'approved' ? (
                            <button className={styles.primaryButton} type="button" disabled={processing === user.id} onClick={() => setPendingUserChange({ user, change: { active: true } })}>
                              {processing === user.id ? 'Memproses...' : 'Aktifkan'}
                            </button>
                          ) : null}
                        </>}
                      </div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
          <div className={styles.pager}>
            <span>Menampilkan {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} dari {total} pengguna</span>
            <div><button className={styles.secondaryButton} disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1) }} type="button"><ChevronLeft size={14} /> Sebelumnya</button><button className={styles.secondaryButton} disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((current) => current + 1) }} type="button">Berikutnya <ChevronRight size={14} /></button></div>
          </div>
        </>
      )}
      {detailUser && (
        <div className={styles.modalBackdrop} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDetailUser(null) }}>
          <section className={`${styles.panel} ${styles.userDialog}`} role="dialog" aria-modal="true" aria-labelledby="user-detail-title">
            <div className={styles.panelHeading}>
              <div><h2 id="user-detail-title">Detail Pengguna</h2><p>Informasi akun dan status akses.</p></div>
              <button className={styles.secondaryButton} type="button" onClick={() => setDetailUser(null)} aria-label="Tutup detail"><X size={14} /></button>
            </div>
            <dl className={styles.userDetails}>
              <dt>Nama lengkap</dt><dd>{detailUser.full_name}</dd>
              <dt>Email</dt><dd>{detailUser.email || 'Tidak tersedia'}</dd>
              <dt>Telepon</dt><dd>{detailUser.phone || 'Tidak dicantumkan'}</dd>
              <dt>Role</dt><dd>{roleLabel[detailUser.role]}</dd>
              <dt>Status persetujuan</dt><dd>{statusLabel[detailUser.approval_status]}</dd>
              <dt>Status akun</dt><dd>{detailUser.isActive ? 'Aktif' : 'Nonaktif'}</dd>
              <dt>ID akun</dt><dd>{detailUser.id}</dd>
              <dt>Terdaftar</dt><dd>{dateFormat.format(new Date(detailUser.created_at))}</dd>
              <dt>Trial dimulai</dt><dd>{detailUser.trial_started_at ? dateFormat.format(new Date(detailUser.trial_started_at)) : 'Tidak ada'}</dd>
              <dt>Trial berakhir</dt><dd>{detailUser.trial_ends_at ? dateFormat.format(new Date(detailUser.trial_ends_at)) : 'Tidak ada'}</dd>
            </dl>
          </section>
        </div>
      )}
      {editingUser && (
        <div className={styles.modalBackdrop} role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !savingEdit) setEditingUser(null) }}>
          <form className={`${styles.panel} ${styles.userDialog} ${styles.userEditForm}`} onSubmit={saveEdit} role="dialog" aria-modal="true" aria-labelledby="user-edit-title">
            <div className={styles.panelHeading}>
              <div><h2 id="user-edit-title">Edit Pengguna</h2><p>Perubahan email juga diperbarui pada akun login.</p></div>
              <button className={styles.secondaryButton} type="button" onClick={() => setEditingUser(null)} aria-label="Tutup form edit" disabled={savingEdit}><X size={14} /></button>
            </div>
            <label>Nama lengkap<input required minLength={2} maxLength={120} value={editForm.full_name} onChange={(event) => setEditForm({ ...editForm, full_name: event.target.value })} /></label>
            <label>Email<input required type="email" maxLength={254} value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /></label>
            <label>Telepon<input type="tel" maxLength={32} value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} /></label>
            {editingUser.role !== 'super_admin' && (
              <label>Role<select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as UserRole })}>
                <option value="kasir">Kasir</option><option value="admin">Admin</option><option value="owner">Owner</option>
              </select></label>
            )}
            <div className={styles.userActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => setEditingUser(null)} disabled={savingEdit}>Batal</button>
              <button className={styles.primaryButton} type="submit" disabled={savingEdit}>{savingEdit ? 'Menyimpan...' : 'Simpan perubahan'}</button>
            </div>
          </form>
        </div>
      )}
      {pendingUserChange && (
        <ConfirmationDialog
          isOpen
          onClose={() => setPendingUserChange(null)}
          onConfirm={() => updateUser(pendingUserChange.user, pendingUserChange.change)}
          title={pendingUserChange.change.role ? 'Konfirmasi perubahan role' : pendingUserChange.change.active ? 'Aktifkan akun?' : 'Nonaktifkan akun?'}
          message={pendingUserChange.change.role
            ? `Ubah role ${pendingUserChange.user.full_name} dari ${roleLabel[pendingUserChange.user.role]} menjadi ${roleLabel[pendingUserChange.change.role]}?`
            : pendingUserChange.change.active
              ? `Aktifkan kembali akun ${pendingUserChange.user.full_name}?`
              : <>Akun <strong>{pendingUserChange.user.full_name}</strong> tidak dapat login setelah dinonaktifkan. Data akun dan bisnis tidak dihapus permanen.</>}
          confirmLabel={pendingUserChange.change.role ? 'Ubah role' : pendingUserChange.change.active ? 'Aktifkan' : 'Nonaktifkan'}
          variant={pendingUserChange.change.active === false ? 'danger' : 'primary'}
          icon={pendingUserChange.change.active === false ? 'delete' : 'warning'}
          isLoading={processing === pendingUserChange.user.id}
        />
      )}
    </section>
  )
}
