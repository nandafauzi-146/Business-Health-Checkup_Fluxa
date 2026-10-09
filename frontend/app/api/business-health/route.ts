import { NextResponse } from 'next/server';
import { evaluateBusinessHealth, generateAiHealthInsights, FinancialHealthInput } from '@intelligence/index';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body: FinancialHealthInput & { apiKey?: string; saveToDb?: boolean } = await request.json();

    if (!body || typeof body.revenue !== 'number') {
      return NextResponse.json(
        { error: 'Input data finansial tidak lengkap atau tidak valid.' },
        { status: 400 }
      );
    }

    // 1. Evaluasi rasio akuntansi & 6 dimensi
    const diagnosis = evaluateBusinessHealth(body);

    // 2. Hubungkan ke Google Gemini AI (atau fallback cerdas jika key belum ada)
    const aiResult = await generateAiHealthInsights(body, diagnosis.metrics, body.apiKey);

    // 3. Simpan riwayat diagnosis ke Supabase `checkups` jika diminta
    if (body.saveToDb !== false) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          await supabase.from('checkups').insert({
            period_start: body.period_start || new Date().toISOString().split('T')[0],
            period_end: body.period_end || new Date().toISOString().split('T')[0],
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
        }
      } catch (dbErr) {
        console.warn('Could not save checkup to database:', dbErr);
      }
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
  } catch (error: any) {
    console.error('Error calculating business health:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan dalam diagnosis kesehatan bisnis: ' + error.message },
      { status: 500 }
    );
  }
}
