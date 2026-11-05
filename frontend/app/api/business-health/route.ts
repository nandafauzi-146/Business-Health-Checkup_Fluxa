import { NextResponse } from 'next/server';
import { evaluateBusinessHealth, generateAiHealthInsights } from '@intelligence/index';
import { createClient } from '@/lib/supabase/server';
import { loadOwnerBusinessHealthData } from '@/lib/business-health-data';

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status, business_id, full_name')
      .eq('id', user.id)
      .single()
    if (profileError) throw profileError
    if (profile.role !== 'owner' || profile.approval_status !== 'approved' || !profile.business_id) {
      return NextResponse.json({ error: 'Fitur ini hanya tersedia untuk Owner yang disetujui.' }, { status: 403 })
    }

    let body: { period_start?: unknown; period_end?: unknown; saveToDb?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 })
    }

    const isValidDate = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    if (!body || !isValidDate(body.period_start) || !isValidDate(body.period_end) || body.period_start > body.period_end) {
      return NextResponse.json({ error: 'Periode diagnosis tidak valid.' }, { status: 400 })
    }

    const { input } = await loadOwnerBusinessHealthData(
      supabase,
      {
        businessId: profile.business_id,
        ownerName: profile.full_name || 'Pemilik',
      },
      { periodStart: body.period_start, periodEnd: body.period_end }
    )

    // 1. Evaluasi rasio akuntansi & 6 dimensi
    const diagnosis = evaluateBusinessHealth(input);

    // 2. Hubungkan ke Google Gemini AI (atau fallback cerdas jika key belum ada)
    const aiResult = await generateAiHealthInsights(input, diagnosis.metrics);

    if (body.saveToDb !== false) {
      // Riwayat ditulis ke tenant yang sama dengan sumber data analisis.
      const { error: saveError } = await supabase.from('checkups').insert({
        business_id: profile.business_id,
        period_start: input.period_start,
        period_end: input.period_end,
        overall_score: diagnosis.metrics.health_score,
        health_status: diagnosis.metrics.status.toLowerCase(),
        revenue: input.revenue,
        cogs: input.cogs,
        gross_profit: diagnosis.metrics.gross_profit,
        operating_expenses: input.operating_expenses,
        net_profit: diagnosis.metrics.net_profit,
        metrics: diagnosis.metrics,
        ai_recommendations: aiResult.insights,
        created_by: user.id
      });
      if (saveError) throw saveError
    }

    return NextResponse.json({
      success: true,
      data: {
        ...diagnosis,
        ai_insights: aiResult.insights,
        source: aiResult.source,
        model: aiResult.model,
        error: aiResult.error
      },
    });
  } catch (error: unknown) {
    console.error('Error calculating business health:', error);
    return NextResponse.json(
      { error: 'Diagnosis kesehatan bisnis belum dapat dibuat. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}
