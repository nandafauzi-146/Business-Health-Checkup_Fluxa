'use client'

import { useState } from 'react'
import { Users, Search, Shield, Phone, Mail, UserCheck, ShieldCheck, UserCog, Plus, Edit, Trash2, X, Check, Lock, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag } from '@/components/ui/Cards'

interface Profile {
  id: string
  full_name: string
  role: 'kasir' | 'admin' | 'owner'
  phone: string | null
  created_at: string
  email?: string
}

interface Props {
  initialUsers: Profile[]
  roleScope?: 'kasir' | 'all'
  currentUserId?: string
}

const roleBadges: Record<string, { label: string; bg: string; color: string; icon: any }> = {
  owner: { label: 'Owner', bg: 'var(--oks)', color: 'var(--ok)', icon: ShieldCheck },
  admin: { label: 'Admin', bg: 'var(--accs)', color: 'var(--acc)', icon: Shield },
  kasir: { label: 'Kasir', bg: 'var(--warns)', color: 'var(--warn)', icon: UserCog }
}

export default function UsersManagementClient({ initialUsers, roleScope = 'all', currentUserId }: Props) {
  const isKasirOnly = roleScope === 'kasir'

  // Jika di halaman admin, filter strictly hanya akun kasir
  const [users, setUsers] = useState<Profile[]>(() => {
    if (isKasirOnly) {
      return initialUsers.filter(u => u.role === 'kasir')
    }
    return initialUsers
  })

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'kasir' | 'admin' | 'owner'>('all')

  // Modal State Tambah User
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: isKasirOnly ? 'kasir' : 'kasir'
  })

  // Modal State Edit User
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: 'kasir',
    password: ''
  })

  // Modal State Hapus User
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const showNotification = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3500)
  }

  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone && u.phone.includes(search))
    const matchRole = isKasirOnly ? u.role === 'kasir' : (roleFilter === 'all' ? true : u.role === roleFilter)
    return matchSearch && matchRole
  })

  // 1. Handle Tambah User
  const handleOpenAdd = () => {
    setAddForm({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      role: 'kasir'
    })
    setAddModalOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.full_name.trim() || !addForm.email.trim() || !addForm.password) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: addForm.full_name.trim(),
          email: addForm.email.trim().toLowerCase(),
          password: addForm.password,
          phone: addForm.phone.trim() || null,
          role: isKasirOnly ? 'kasir' : addForm.role
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menambahkan pengguna baru.')

      setUsers(prev => [json.user, ...prev])
      showNotification(`Akun ${json.user.full_name} (${json.user.role.toUpperCase()}) berhasil dibuat.`, 'ok')
      setAddModalOpen(false)
    } catch (err: any) {
      console.error('Error create user:', err)
      showNotification(err.message || 'Gagal menambahkan pengguna.', 'bad')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Handle Edit User
  const handleOpenEdit = (user: Profile) => {
    // Admin hanya boleh edit akun kasir
    if (isKasirOnly && user.role !== 'kasir') {
      alert('Anda hanya berwenang mengedit akun kasir.')
      return
    }

    setEditingUser(user)
    setEditForm({
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
      password: ''
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser || !editForm.full_name.trim()) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          role: isKasirOnly ? undefined : editForm.role,
          password: editForm.password ? editForm.password : undefined
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui data pengguna.')

      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        role: (!isKasirOnly && editForm.role) ? (editForm.role as any) : u.role
      } : u))

      showNotification(`Data ${editForm.full_name} berhasil diperbarui.`, 'ok')
      setEditModalOpen(false)
    } catch (err: any) {
      console.error('Error update user:', err)
      showNotification(err.message || 'Gagal memperbarui data pengguna.', 'bad')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. Handle Hapus User
  const handleOpenDelete = (user: Profile) => {
    if (isKasirOnly && user.role !== 'kasir') {
      alert('Anda hanya berwenang menghapus akun kasir.')
      return
    }

    if (currentUserId && user.id === currentUserId) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.')
      return
    }

    setDeletingUser(user)
    setDeleteModalOpen(true)
  }

  const handleDeleteSubmit = async () => {
    if (!deletingUser) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users?id=${deletingUser.id}`, {
        method: 'DELETE'
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus akun.')

      setUsers(prev => prev.filter(u => u.id !== deletingUser.id))
      showNotification(`Akun ${deletingUser.full_name} berhasil dihapus.`, 'ok')
      setDeleteModalOpen(false)
    } catch (err: any) {
      console.error('Error delete user:', err)
      showNotification(err.message || 'Gagal menghapus akun.', 'bad')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isKasirOnly ? 'Kelola Akun Kasir' : 'Daftar Pengguna & Staf'}
        subtitle={isKasirOnly
          ? 'Manajemen tim kasir yang bertugas di sistem kasir/POS (tambah, edit profil, dan hapus akun kasir)'
          : 'Manajemen akun tim kasir, administrator, dan pemilik bisnis beserta kontrol penuh (tambah, edit, dan hapus)'
        }
        actions={
          <button onClick={handleOpenAdd} className="btn btn-primary" id="tambah-user-btn">
            <Plus size={15} /> {isKasirOnly ? 'Tambah Kasir Baru' : 'Tambah Staf Baru'}
          </button>
        }
      />

      {notification && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: notification.type === 'ok' ? 'var(--oks)' : 'var(--bads)',
          color: notification.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          fontWeight: 600,
          fontSize: 13,
          border: `1px solid ${notification.type === 'ok' ? 'var(--ok)' : 'var(--bad)'}`
        }}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      <SectionCard title={isKasirOnly ? `Daftar Staf Kasir (${filtered.length})` : `Daftar Seluruh Pengguna & Staf (${filtered.length})`}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder={isKasirOnly ? 'Cari nama kasir atau no telepon...' : 'Cari nama staf atau no telepon...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
              </button>
            )}
          </div>

          {!isKasirOnly && (
            <div className="filter-tabs">
              {(['all', 'kasir', 'admin', 'owner'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRoleFilter(tab)}
                  className={`filter-tab ${roleFilter === tab ? 'active' : ''}`}
                >
                  {tab === 'all' ? `Semua (${users.length})` : tab === 'kasir' ? `Kasir (${users.filter(u => u.role === 'kasir').length})` : tab === 'admin' ? `Admin (${users.filter(u => u.role === 'admin').length})` : `Owner (${users.filter(u => u.role === 'owner').length})`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Peran / Role</th>
                <th>No. Telepon</th>
                <th>Terdaftar Sejak</th>
                <th>Status Akses</th>
                <th style={{ textAlign: 'right' }}>Aksi Kelola</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    {isKasirOnly ? 'Belum ada akun kasir terdaftar atau cocok dengan pencarian' : 'Tidak ada staf yang sesuai'}
                  </td>
                </tr>
              ) : (
                filtered.map(u => {
                  const roleCfg = roleBadges[u.role] || { label: u.role, bg: 'var(--bg)', color: 'var(--ink)', icon: Users }
                  const RoleIcon = roleCfg.icon
                  const isSelf = currentUserId && u.id === currentUserId

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="avatar" style={{
                            width: 36,
                            height: 36,
                            fontSize: 13,
                            background: u.role === 'owner' ? '#1F9D63' : u.role === 'admin' ? '#2F6BFF' : '#B26A00'
                          }}>
                            {u.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{u.full_name}</span>
                              {isSelf && (
                                <span style={{
                                  fontSize: 10,
                                  background: 'var(--accs)',
                                  color: 'var(--acc)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontWeight: 700
                                }}>
                                  Anda
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'monospace' }}>
                              ID: {u.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: roleCfg.bg,
                          color: roleCfg.color
                        }}>
                          <RoleIcon size={12} />
                          {roleCfg.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--mute)' }}>
                        {u.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)' }}>
                            <Phone size={13} color="var(--mute)" />
                            {u.phone}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--mute)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--mute)' }}>
                        {new Date(u.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                      </td>
                      <td>
                        <StatusTag type="ok" label="Aktif" />
                      </td>

                      {/* Kolom Aksi Kelola untuk Admin dan Owner */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="btn btn-secondary btn-sm"
                            title={`Edit ${u.full_name}`}
                          >
                            <Edit size={12} /> Edit
                          </button>

                          {isSelf ? (
                            <span style={{
                              fontSize: 11,
                              color: 'var(--mute)',
                              padding: '4px 8px',
                              fontStyle: 'italic'
                            }}>
                              Aktif
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenDelete(u)}
                              className="btn btn-sm"
                              style={{ background: 'var(--bads)', color: 'var(--bad)', border: 'none' }}
                              title={`Hapus ${u.full_name}`}
                            >
                              <Trash2 size={12} /> Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal Tambah Pengguna Baru */}
      {addModalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAddModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCog size={18} color="var(--acc)" /> {isKasirOnly ? 'Tambah Akun Kasir Baru' : 'Tambah Staf / Pengguna Baru'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  {isKasirOnly ? 'Buat kredensial login kasir untuk bertugas di meja POS' : 'Buat akun baru untuk tim kasir, admin, atau owner'}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setAddModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="user-name">Nama Lengkap *</label>
                  <input
                    id="user-name"
                    required
                    type="text"
                    className="input"
                    placeholder="Contoh: Siti Rahmawati"
                    value={addForm.full_name}
                    onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="user-email">Email Login *</label>
                  <input
                    id="user-email"
                    required
                    type="email"
                    className="input"
                    placeholder="Contoh: staf@fluxa.local"
                    value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="user-pwd">Password Login (min. 6 karakter) *</label>
                  <input
                    id="user-pwd"
                    required
                    type="password"
                    minLength={6}
                    className="input"
                    placeholder="••••••••"
                    value={addForm.password}
                    onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="user-phone">Nomor Telepon / WhatsApp (Opsional)</label>
                  <input
                    id="user-phone"
                    type="tel"
                    className="input"
                    placeholder="Contoh: 081234567890"
                    value={addForm.phone}
                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                {!isKasirOnly ? (
                  <div>
                    <label className="label" htmlFor="user-role">Peran / Hak Akses Akun *</label>
                    <select
                      id="user-role"
                      className="input"
                      value={addForm.role}
                      onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="kasir">Kasir (Hanya akses meja kasir / POS)</option>
                      <option value="admin">Admin (Kelola produk, stok, biaya, piutang, kasir)</option>
                      <option value="owner">Owner (Akses penuh seluruh laporan & AI)</option>
                    </select>
                  </div>
                ) : (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12.5
                  }}>
                    <span style={{ color: 'var(--mute)' }}>Peran Pengguna:</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--warns)',
                      color: 'var(--warn)',
                      fontWeight: 700
                    }}>
                      KASIR (Otomatis)
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !addForm.full_name || !addForm.email || !addForm.password}
                >
                  <Check size={14} /> {isSubmitting ? 'Membuat Akun...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Pengguna */}
      {editModalOpen && editingUser && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit size={18} color="var(--acc)" /> Edit Akun Pengguna
                </h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Perbarui profil, hak akses peran, atau reset kata sandi
                </p>
              </div>
              <button className="icon-btn" onClick={() => setEditModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="edit-name">Nama Lengkap *</label>
                  <input
                    id="edit-name"
                    required
                    type="text"
                    className="input"
                    value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-phone">Nomor Telepon</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    className="input"
                    placeholder="Contoh: 081234567890"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                {!isKasirOnly && (
                  <div>
                    <label className="label" htmlFor="edit-role">Peran / Hak Akses (Role)</label>
                    <select
                      id="edit-role"
                      className="input"
                      value={editForm.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="kasir">Kasir</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="edit-pwd">Ganti Password (Kosongkan jika tidak ingin diubah)</label>
                  <input
                    id="edit-pwd"
                    type="password"
                    minLength={6}
                    className="input"
                    placeholder="Masukkan password baru (opsional)"
                    value={editForm.password}
                    onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !editForm.full_name.trim()}
                >
                  <Check size={14} /> {isSubmitting ? 'Menyimpan...' : 'Perbarui Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pengguna */}
      {deleteModalOpen && deletingUser && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bad)' }}>
                <AlertTriangle size={22} />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Hapus Akun Pengguna</h3>
              </div>
              <button className="icon-btn" onClick={() => setDeleteModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5, marginBottom: 18 }}>
              Apakah Anda yakin ingin menghapus akun <strong>{deletingUser.full_name}</strong> ({deletingUser.role.toUpperCase()})? Setelah dihapus, pengguna ini tidak akan dapat login lagi ke sistem Fluxa.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="btn btn-danger"
                disabled={isSubmitting}
                style={{ background: 'var(--bad)', color: '#fff', border: 'none' }}
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
