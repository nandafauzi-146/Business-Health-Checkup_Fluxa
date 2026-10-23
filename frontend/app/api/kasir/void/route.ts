import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Silakan login terlebih dahulu.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.approval_status !== 'approved' || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Hanya Admin atau Owner yang disetujui dapat membatalkan transaksi.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { sale_id, reason } = body

    if (typeof sale_id !== 'string' || !sale_id) {
      return NextResponse.json(
        { error: 'ID transaksi wajib disertakan.' },
        { status: 400 }
      )
    }

    if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
      return NextResponse.json(
        { error: 'Alasan pembatalan wajib diisi (3–500 karakter).' },
        { status: 400 }
      )
    }

    const { error: rpcError } = await supabase.rpc('void_sale', {
      p_sale_id: sale_id,
      p_reason: reason.trim()
    })

    if (rpcError) {
      console.error('Unable to void sale through the atomic RPC:', rpcError)
      return NextResponse.json(
        { error: 'Transaksi belum dapat dibatalkan. Silakan periksa data dan coba lagi.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Transaksi berhasil dibatalkan. Stok produk telah dikembalikan.'
    })
  } catch (error: unknown) {
    console.error('Error voiding sale via kasir API:', error)
    return NextResponse.json(
      { error: 'Transaksi belum dapat dibatalkan. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}
