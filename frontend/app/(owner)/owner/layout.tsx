import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import ChatAI from '@/components/owner/ChatAI'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, approval_status, trial_started_at, trial_ends_at')
    .eq('id', user.id)
    .single()

  if (profile?.approval_status !== 'approved' || profile?.role !== 'owner') redirect('/login')

  const { data: ownerHasAccess, error: accessError } = await supabase.rpc('is_owner')
  if (accessError) throw new Error('Status subscription belum dapat diperiksa. Jalankan migrasi subscription terlebih dahulu.')
  const accessLocked = !ownerHasAccess

  return (
    <div className="app-layout" data-role="owner">
      <Sidebar role="owner" userName={profile.full_name || 'Owner'} />
      <div className="main-area">
        <Topbar title="" role="owner" />
        <div className="content-area">
          {accessLocked ? (
            <div className="owner-subscription-lock-container">
              <div className="owner-subscription-lock__blurred" aria-hidden="true" tabIndex={-1}>
                {children}
              </div>
              <div className="owner-subscription-lock__overlay">
                <section className="owner-subscription-lock__card" role="alert" aria-live="assertive">
                  <span>AKSES OPERASIONAL DIJEDA (FR-09)</span>
                  <h1>Masa trial telah berakhir</h1>
                  <p>
                    Data dan konfigurasi usaha Anda tetap tersimpan dengan aman. Pilih paket langganan dan selesaikan pembayaran untuk memulihkan akses operasional penuh.
                  </p>
                  <a href="/langganan">Pilih Paket & Berlangganan Sekarang</a>
                </section>
              </div>
            </div>
          ) : children}
        </div>
      </div>
      {/* FluxAI Chat Widget — hanya aktif jika akses operasional terbuka */}
      {!accessLocked && <ChatAI />}
    </div>
  )
}
