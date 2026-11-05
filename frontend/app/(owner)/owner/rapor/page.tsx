import { createClient } from '@/lib/supabase/server'
import BusinessHealthClient from '@/components/owner/BusinessHealth'
import { evaluateBusinessHealth } from '@intelligence/index'
import { loadOwnerBusinessHealthData } from '@/lib/business-health-data'

export const metadata = {
  title: 'Fluxa | AI Insight',
}

export default async function RaporPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sesi Owner tidak ditemukan.')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id, full_name, role, approval_status')
    .eq('id', user.id)
    .single()
  if (profileError) throw new Error(`Gagal memuat profil Owner: ${profileError.message}`)
  if (profile.role !== 'owner' || profile.approval_status !== 'approved' || !profile.business_id) {
    throw new Error('Akun Owner belum terhubung ke bisnis yang aktif.')
  }

  const now = new Date()
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = Number(dateParts.find(part => part.type === 'year')?.value)
  const month = Number(dateParts.find(part => part.type === 'month')?.value)
  const day = Number(dateParts.find(part => part.type === 'day')?.value)
  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const { input, pastCheckups } = await loadOwnerBusinessHealthData(
    supabase,
    {
      businessId: profile.business_id,
      ownerName: profile.full_name || 'Pemilik',
    },
    { periodStart: startOfMonth, periodEnd: todayStr }
  )

  // Kalkulasi awal berbasis engine scoring deterministik
  const initialDiagnosis = evaluateBusinessHealth(input)

  return (
    <BusinessHealthClient
      key={user.id}
      initialInput={input}
      initialDiagnosis={initialDiagnosis}
      pastCheckups={pastCheckups}
      ownerId={user.id}
    />
  )
}
