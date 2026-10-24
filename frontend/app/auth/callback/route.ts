import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Konfigurasi Supabase server belum lengkap.')
  }

  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const errorDescription = requestUrl.searchParams.get('error_description')

  if (errorDescription) {
    console.error('OAuth provider error:', errorDescription)
    return NextResponse.redirect(
      `${origin}/register?error=${encodeURIComponent('Pendaftaran dengan Google dibatalkan atau mengalami kendala.')}`
    )
  }

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth exchange error:', error)
        return NextResponse.redirect(
          `${origin}/register?error=${encodeURIComponent('Gagal memverifikasi sesi Google. Silakan coba lagi.')}`
        )
      }

      const user = data.user
      if (user) {
        const adminClient = getAdminClient()

        // Periksa apakah profil pengguna sudah ada
        const { data: existingProfile, error: profileQueryError } = await adminClient
          .from('profiles')
          .select('id, full_name, role, approval_status, email')
          .eq('id', user.id)
          .maybeSingle()

        if (profileQueryError) {
          console.error('Error fetching profile in OAuth callback:', profileQueryError)
        }

        if (!existingProfile) {
          // Pendaftar baru dari Google OAuth di halaman registrasi
          const fullName =
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            user.email?.split('@')[0] ||
            'Pemilik Bisnis'

          const userEmail = user.email || ''
          const phone = (user.user_metadata?.phone as string | undefined) || null

          const { error: insertError } = await adminClient.from('profiles').insert({
            id: user.id,
            full_name: fullName.trim(),
            role: 'owner',
            phone,
            email: userEmail,
            approval_status: 'pending',
            registration_path: 'trial',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          if (insertError) {
            console.error('Error creating profile for Google OAuth user:', insertError)
          }

          // Arahkan ke layar pengajuan trial diterima
          return NextResponse.redirect(
            `${origin}/register?step=trial_submitted&name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(userEmail)}`
          )
        }

        // Pengguna sudah memiliki profil
        if (existingProfile.approval_status === 'pending') {
          return NextResponse.redirect(
            `${origin}/register?step=trial_submitted&name=${encodeURIComponent(existingProfile.full_name || '')}&email=${encodeURIComponent(existingProfile.email || user.email || '')}`
          )
        }

        if (existingProfile.approval_status === 'rejected') {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?status=rejected`)
        }

        // Akun sudah disetujui: arahkan ke portal sesuai role
        const roleDestinations: Record<string, string> = {
          owner: '/owner',
          admin: '/admin',
          kasir: '/kasir',
          super_admin: '/super-admin',
        }

        const destination = roleDestinations[existingProfile.role] || '/owner'
        return NextResponse.redirect(`${origin}${destination}`)
      }
    } catch (err) {
      console.error('Unexpected error during OAuth callback:', err)
      return NextResponse.redirect(
        `${origin}/register?error=${encodeURIComponent('Terjadi kendala saat memproses login Google.')}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/register`)
}
