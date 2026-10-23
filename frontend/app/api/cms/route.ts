import { NextResponse } from 'next/server'
import { getLandingCMSContent } from '@/lib/cms'

export async function GET() {
  try {
    const content = await getLandingCMSContent()
    return NextResponse.json(content, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Failed to get public CMS content:', error)
    return NextResponse.json({ error: 'Gagal memuat konten landing page.' }, { status: 500 })
  }
}
