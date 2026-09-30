import { NextResponse } from 'next/server';
import { evaluateBusinessHealth, generateAiHealthInsights, FinancialHealthInput } from '@intelligence/index';

export async function POST(request: Request) {
  try {
    const body: FinancialHealthInput = await request.json();

    if (!body || typeof body.revenue !== 'number') {
      return NextResponse.json(
        { error: 'Input data finansial tidak lengkap atau tidak valid.' },
        { status: 400 }
      );
    }

    const diagnosis = evaluateBusinessHealth(body);
    const aiResult = await generateAiHealthInsights(body, diagnosis.metrics);

    return NextResponse.json({
      success: true,
      data: {
        ...diagnosis,
        ai_insights: aiResult.insights,
        source: aiResult.source,
      },
    });
  } catch (error) {
    console.error('Error calculating business health:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan dalam diagnosis kesehatan bisnis.' },
      { status: 500 }
    );
  }
}
