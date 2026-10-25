import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import ChatAI from '@/components/owner/ChatAI'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-next-url') || headersList.get('x-invoke-path') || ''
  const isSubscriptionPage = pathname.includes('/owner/langganan')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, approval_status, registration_path, trial_started_at, trial_ends_at')
    .eq('id', user.id)
    .single()

  // Allow pending owners on subscribe path to access the subscription page only
  const isPendingSubscriber = profile?.role === 'owner' &&
    profile?.approval_status === 'pending' &&
    profile?.registration_path === 'subscribe'

  if (profile?.role !== 'owner') redirect('/login')

  if (profile?.approval_status !== 'approved' && !isPendingSubscriber) redirect('/login')

  // Pending subscribers can only access the subscription page
  if (isPendingSubscriber && !isSubscriptionPage) redirect('/owner/langganan?onboard=1')

  const { data: ownerHasAccess, error: accessError } = await supabase.rpc('is_owner')
  if (accessError) throw new Error('Status subscription belum dapat diperiksa. Jalankan migrasi subscription terlebih dahulu.')
  const accessLocked = !ownerHasAccess

  // Check paid subscription entitlement for AI Agent (trial excluded from AI Agent)
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('owner_id', user.id)
    .maybeSingle()

  const hasPaidSubscription = Boolean(
    subscription &&
    ['active', 'cancelled'].includes(subscription.status) &&
    new Date(subscription.current_period_end).getTime() > Date.now()
  )

  return (
    <div className="app-layout" data-role="owner">
      <Sidebar role="owner" userName={profile.full_name || 'Owner'} />
      <div className="main-area">
        <Topbar title="" role="owner" />
        <div className="content-area">
          {accessLocked && !isSubscriptionPage ? (
            <div className="owner-subscription-lock-container" style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
              <section className="owner-subscription-lock__card" role="alert" aria-live="assertive" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: '16px', padding: '36px 28px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', display: 'block', marginBottom: '8px' }}>AKSES OPERASIONAL DIJEDA</span>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', margin: '0 0 12px' }}>Masa Percobaan atau Langganan Berakhir</h1>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--sub, #64748b)', margin: '0 0 24px' }}>
                  Data dan konfigurasi usaha Anda tetap tersimpan dengan aman. Pilih paket langganan dan selesaikan pembayaran untuk memulihkan akses operasional penuh.
                </p>
                <a
                  href="/owner/langganan"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '14px',
                    textDecoration: 'none',
                    transition: 'background-color 0.2s',
                  }}
                >
                  Pilih Paket & Berlangganan Sekarang
                </a>
              </section>
            </div>
          ) : children}
        </div>
      </div>
      {/* FluxAI Chat Widget — hanya aktif jika akses operasional terbuka dan memiliki langganan berbayar */}
      {!accessLocked && hasPaidSubscription && <ChatAI />}
    </div>
  )
}
