import { NextResponse } from 'next/server';
import { evaluateBusinessHealth, generateAiHealthInsights, FinancialHealthInput } from '@intelligence/index';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'owner' || profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Fitur ini hanya tersedia untuk Owner yang disetujui.' }, { status: 403 })
    }

    const body = await request.json() as FinancialHealthInput & { apiKey?: string; saveToDb?: boolean }
    const financialValues = [
      body?.revenue,
      body?.cogs,
      body?.operating_expenses,
      body?.cash_on_hand,
      body?.inventory_value,
      body?.receivables,
      body?.payables,
    ]
    if (!body || !financialValues.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
      return NextResponse.json(
        { error: 'Semua nilai finansial wajib berupa angka terbatas nol atau lebih.' },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.period_start) || !/^\d{4}-\d{2}-\d{2}$/.test(body.period_end) || body.period_start > body.period_end) {
      return NextResponse.json({ error: 'Periode diagnosis tidak valid.' }, { status: 400 })
    }

    // 1. Evaluasi rasio akuntansi & 6 dimensi
    const diagnosis = evaluateBusinessHealth(body);

    // 2. Hubungkan ke Google Gemini AI (atau fallback cerdas jika key belum ada)
    const aiResult = await generateAiHealthInsights(body, diagnosis.metrics, body.apiKey);

    // 3. Simpan riwayat diagnosis ke Supabase `checkups` jika diminta
    if (body.saveToDb !== false) {
      const { error: saveError } = await supabase.from('checkups').insert({
        period_start: body.period_start,
        period_end: body.period_end,
        overall_score: diagnosis.metrics.health_score,
        health_status: diagnosis.metrics.status.toLowerCase(),
        revenue: body.revenue,
        cogs: body.cogs,
        gross_profit: diagnosis.metrics.gross_profit,
        operating_expenses: body.operating_expenses,
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
