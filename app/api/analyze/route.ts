import { NextRequest, NextResponse } from 'next/server';
import { ReconciliationResult } from '@/app/lib/reconciliation';
import { analyzeReconciliationDeviations } from '@/app/lib/aiAnalysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result: ReconciliationResult = body.result;

    if (!result) {
      return NextResponse.json(
        { error: 'Se requiere un resultado de conciliación' },
        { status: 400 }
      );
    }

    // Verificar que haya desviaciones para analizar
    const hasDeviations = result.matched.some(m => m.difference > 0) || 
                         result.unmatchedBank.length > 0 || 
                         result.unmatchedERP.length > 0;

    if (!hasDeviations) {
      return NextResponse.json(
        { error: 'No hay desviaciones para analizar. La conciliación está completa.' },
        { status: 400 }
      );
    }

    // Ejecutar análisis de IA
    const aiAnalysis = await analyzeReconciliationDeviations(result);

    // Actualizar el resultado con el análisis
    result.aiAnalysis = aiAnalysis;

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error al analizar con IA:', error);
    return NextResponse.json(
      { 
        error: 'Error al procesar el análisis de IA',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}





