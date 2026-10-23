import { NextResponse } from 'next/server'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'
import {
  getLandingCMSContent,
  saveLandingCMSContent,
  resetLandingCMSContent,
  type LandingCMSContent,
} from '@/lib/cms'

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response

    const content = await getLandingCMSContent()
    return NextResponse.json({ content })
  } catch (error) {
    console.error('Super Admin CMS GET error:', error)
    return NextResponse.json({ error: 'Gagal memuat data CMS landing page.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body = await request.json()
    if (!body || typeof body !== 'object' || !body.content) {
      return NextResponse.json({ error: 'Data CMS tidak valid.' }, { status: 400 })
    }

    const newContent = body.content as LandingCMSContent

    // Basic structure validation
    if (!newContent.hero?.title || !newContent.hero?.description) {
      return NextResponse.json({ error: 'Judul dan deskripsi Hero wajib diisi.' }, { status: 400 })
    }

    const previousContent = await getLandingCMSContent()
    const result = await saveLandingCMSContent(newContent, auth.actorId)

    // Write audit log
    try {
      const admin = getSuperAdminServiceClient()
      await writeSuperAdminAudit(
        admin,
        auth.actorId,
        'update_landing_cms',
        'default',
        { hero_title: previousContent.hero.title, updated_at: previousContent.updatedAt || null },
        { hero_title: newContent.hero.title, updated_at: result.data.updatedAt || null },
        'landing_cms_content'
      )
    } catch (auditErr) {
      console.warn('CMS audit log write error (non-fatal):', auditErr)
    }

    return NextResponse.json({
      message: 'Konten Landing Page berhasil disimpan.',
      content: result.data,
    })
  } catch (error) {
    console.error('Super Admin CMS PUT error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan perubahan CMS landing page.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body = await request.json()
    if (body?.action === 'reset') {
      const previousContent = await getLandingCMSContent()
      const result = await resetLandingCMSContent(auth.actorId)

      try {
        const admin = getSuperAdminServiceClient()
        await writeSuperAdminAudit(
          admin,
          auth.actorId,
          'reset_landing_cms',
          'default',
          { hero_title: previousContent.hero.title },
          { hero_title: result.data.hero.title, reset: 'true' },
          'landing_cms_content'
        )
      } catch (auditErr) {
        console.warn('CMS audit log write error (non-fatal):', auditErr)
      }

      return NextResponse.json({
        message: 'Konten Landing Page berhasil direset ke pengaturan bawaan.',
        content: result.data,
      })
    }

    return NextResponse.json({ error: 'Aksi tidak didukung.' }, { status: 400 })
  } catch (error) {
    console.error('Super Admin CMS POST error:', error)
    return NextResponse.json({ error: 'Gagal mereset CMS landing page.' }, { status: 500 })
  }
}
