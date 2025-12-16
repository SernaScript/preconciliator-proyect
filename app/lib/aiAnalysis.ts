import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReconciliationResult, ReconciliationMatch } from './reconciliation';

export interface DeviationAnalysis {
    type: 'difference' | 'unmatched' | 'summary' | 'distributed_payment';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
    details?: {
        transaction?: {
            bankValue?: number;
            erpValue?: number;
            difference?: number;
            bankDescription?: string;
            erpDescription?: string;
            date?: string;
        };
    };
}

export interface AIAnalysisResult {
    summary: string;
    deviations: DeviationAnalysis[];
    recommendations: string[];
}

/**
 * Analiza las desviaciones de una conciliación usando Gemini como analista contable experto
 */
/**
 * Lista los modelos disponibles para el usuario usando la API REST directamente
 */
async function listAvailableModels(apiKey: string): Promise<string[]> {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            console.error('Error al listar modelos:', response.status, response.statusText);
            return [];
        }
        const data = await response.json();
        if (data.models) {
            const modelNames = data.models
                .map((model: any) => model.name?.replace('models/', '') || '')
                .filter((name: string) => name);
            console.log('Modelos disponibles desde API:', modelNames);
            return modelNames;
        }
        return [];
    } catch (error) {
        console.error('Error al listar modelos:', error);
        return [];
    }
}

export async function analyzeReconciliationDeviations(
    result: ReconciliationResult
): Promise<AIAnalysisResult> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Intentar listar modelos disponibles primero
    let availableModels: string[] = [];
    try {
        availableModels = await listAvailableModels(apiKey);
        console.log('Modelos disponibles encontrados:', availableModels);
    } catch (error) {
        console.log('No se pudieron listar modelos, continuando con lista predeterminada');
    }

    // Filtrar solo modelos de generación de texto (excluir embeddings, imágenes, etc.)
    const textGenerationModels = availableModels.filter(model =>
        model.includes('gemini') &&
        !model.includes('embedding') &&
        !model.includes('imagen') &&
        !model.includes('veo') &&
        !model.includes('gemma') &&
        !model.includes('aqa')
    );

    // Priorizar modelos recomendados en orden de preferencia
    const preferredModels = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-flash-latest',
        'gemini-pro-latest',
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-2.5-flash-lite'
    ];

    // Construir lista de modelos: primero los preferidos que estén disponibles, luego los demás disponibles
    let modelsToTry: string[] = [];

    // Agregar modelos preferidos que estén disponibles
    for (const preferred of preferredModels) {
        if (textGenerationModels.includes(preferred)) {
            modelsToTry.push(preferred);
        }
    }

    // Agregar el resto de modelos disponibles que no estén en la lista preferida
    for (const model of textGenerationModels) {
        if (!modelsToTry.includes(model)) {
            modelsToTry.push(model);
        }
    }

    // Si no hay modelos disponibles, usar lista de respaldo
    if (modelsToTry.length === 0) {
        console.log('No se encontraron modelos disponibles, usando lista de respaldo');
        modelsToTry = [
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-flash-latest',
            'gemini-pro-latest',
            'gemini-2.0-flash'
        ];
    }

    console.log('Modelos a probar:', modelsToTry);

    // Preparar datos para el análisis
    const analysisData = prepareAnalysisData(result);

    // ====================================================================
    // PROMPT DEL SISTEMA - Puedes modificar este prompt para personalizar
    // el comportamiento del analista de IA. Este prompt se encuentra en:
    // app/lib/aiAnalysis.ts (líneas 45-92)
    // ====================================================================
    const prompt = `Eres un analista contable experto en conciliación bancaria. Analiza las siguientes desviaciones encontradas en una conciliación y proporciona un análisis detallado.

DATOS DE LA CONCILIACIÓN:
${analysisData}

INSTRUCCIONES:
1. Analiza cada desviación identificada (diferencias en pesos/centavos, transacciones no coincidentes)

2. CASO ESPECIAL - PAGOS A PEXTO COLOMBIA (PSE):
   IMPORTANTE: Cuando en el extracto bancario aparece un pago a "PEXTO COLOMBIA" o "PSE" (Pago Seguro en Línea), este puede corresponder a MÚLTIPLES pagos distribuidos en contabilidad.
   
   Ejemplo:
   - Banco: Un pago de $30.000.000 a Pexto Colombia
   - Contabilidad: Puede estar distribuido como:
     * $5.000.000 a Proveedor A
     * $10.000.000 a Proveedor B
     * $15.000.000 a Proveedor C
   
   En este caso:
   - Si encuentras una transacción no conciliada del banco que sea un pago a Pexto Colombia/PSE
   - Y hay múltiples transacciones no conciliadas del ERP que sumen un valor similar o igual
   - Debes identificar esta situación y recomendar verificar si corresponden al mismo pago distribuido
   - La suma de los pagos del ERP debe coincidir con el pago único del banco

3. Clasifica la severidad de cada desviación:
   - CRITICAL: Valores que no coinciden para nada o diferencias muy grandes
   - HIGH: Diferencias significativas en pesos
   - MEDIUM: Diferencias menores en centavos o pesos pequeños
   - LOW: Diferencias mínimas que pueden ser redondeos o casos de pagos distribuidos (Pexto Colombia)

4. Para cada desviación, proporciona:
   - Tipo: "difference" (diferencia en valores conciliados), "unmatched" (transacción sin coincidencia), "distributed_payment" (pago distribuido como Pexto Colombia)
   - Severidad: low, medium, high, critical
   - Descripción: Explicación clara del problema, incluyendo si es un posible caso de pago distribuido
   - Recomendación: Qué acción tomar para resolverlo (si es pago distribuido, indicar que se debe verificar la suma de los pagos del ERP)

5. Proporciona un resumen ejecutivo general

6. Lista las recomendaciones principales, prestando especial atención a posibles casos de pagos distribuidos a Pexto Colombia

Responde SOLO con un JSON válido en el siguiente formato:
{
  "summary": "Resumen ejecutivo general de las desviaciones encontradas",
  "deviations": [
    {
      "type": "difference" | "unmatched" | "distributed_payment",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Descripción detallada de la desviación. Si es un pago distribuido a Pexto Colombia, indica el valor total del banco y la suma de los pagos del ERP.",
      "recommendation": "Recomendación específica para resolver esta desviación. Si es pago distribuido, indicar que se debe verificar que la suma de los pagos del ERP coincida con el pago único del banco.",
      "details": {
        "transaction": {
          "bankValue": número,
          "erpValue": número,
          "difference": número,
          "bankDescription": "string",
          "erpDescription": "string",
          "date": "DD/MM/YYYY"
        }
      }
    }
  ],
  "recommendations": [
    "Recomendación general 1",
    "Recomendación general 2"
  ]
}

IMPORTANTE: Responde ÚNICAMENTE con el JSON, sin texto adicional antes o después.`;

    let lastError: Error | null = null;

    // Intentar con cada modelo hasta que uno funcione
    for (const modelName of modelsToTry) {
        try {
            console.log(`Intentando con modelo: ${modelName}`);
            const testModel = genAI.getGenerativeModel({ model: modelName });
            const response = await testModel.generateContent(prompt);
            const responseText = response.response.text();

            // Limpiar la respuesta (puede venir con markdown code blocks)
            let jsonText = responseText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '').trim();
            }

            const analysis: AIAnalysisResult = JSON.parse(jsonText);
            console.log(`Modelo ${modelName} funcionó correctamente`);
            return analysis;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.log(`Modelo ${modelName} falló:`, lastError.message);
            // Continuar con el siguiente modelo
            continue;
        }
    }

    // Si todos los modelos fallaron, lanzar el último error
    console.error('Todos los modelos fallaron. Último error:', lastError);
    throw new Error(
        `Error al analizar desviaciones. Ningún modelo de Gemini está disponible. ` +
        `Último error: ${lastError?.message || 'Error desconocido'}. ` +
        `Verifica tu API key y que los modelos estén disponibles en tu región.`
    );
}

/**
 * Prepara los datos de la conciliación en formato legible para el análisis
 */
function prepareAnalysisData(result: ReconciliationResult): string {
    const lines: string[] = [];

    // Estadísticas generales
    lines.push('=== ESTADÍSTICAS GENERALES ===');
    lines.push(`Total transacciones banco: ${result.stats.totalBank}`);
    lines.push(`Total transacciones ERP: ${result.stats.totalERP}`);
    lines.push(`Transacciones conciliadas: ${result.stats.matched}`);
    lines.push(`Transacciones pendientes banco: ${result.stats.unmatchedBank}`);
    lines.push(`Transacciones pendientes ERP: ${result.stats.unmatchedERP}`);
    lines.push(`Porcentaje de conciliación: ${result.stats.matchPercentage}%`);
    lines.push('');

    // Transacciones conciliadas con diferencias
    const matchesWithDifferences = result.matched.filter(m => m.difference > 0);
    if (matchesWithDifferences.length > 0) {
        lines.push('=== TRANSACCIONES CONCILIADAS CON DIFERENCIAS ===');
        matchesWithDifferences.slice(0, 20).forEach((match, idx) => {
            lines.push(`\nDiferencia ${idx + 1}:`);
            lines.push(`  Fecha banco: ${formatDate(match.bankTransaction.fecha)}`);
            lines.push(`  Fecha ERP: ${formatDate(match.erpTransaction.fechaElaboracion)}`);
            lines.push(`  Valor banco: ${formatCurrency(match.bankTransaction.valor)}`);
            lines.push(`  Valor ERP: ${formatCurrency(match.erpTransaction.valor)}`);
            lines.push(`  Diferencia: ${formatCurrency(match.difference)}`);
            lines.push(`  Descripción banco: ${match.bankTransaction.descripcion}`);
            lines.push(`  Tercero ERP: ${match.erpTransaction.nombreTercero}`);
        });
        if (matchesWithDifferences.length > 20) {
            lines.push(`\n... y ${matchesWithDifferences.length - 20} diferencias más`);
        }
        lines.push('');
    }

    // Transacciones no conciliadas del banco
    if (result.unmatchedBank.length > 0) {
        lines.push('=== TRANSACCIONES PENDIENTES DEL BANCO ===');
        lines.push(`Total: ${result.unmatchedBank.length}`);
        result.unmatchedBank.slice(0, 15).forEach((trans, idx) => {
            lines.push(`\nPendiente banco ${idx + 1}:`);
            lines.push(`  Fecha: ${formatDate(trans.fecha)}`);
            lines.push(`  Valor: ${formatCurrency(trans.valor)}`);
            lines.push(`  Descripción: ${trans.descripcion}`);
            lines.push(`  Cuenta: ${trans.cuenta}`);
        });
        if (result.unmatchedBank.length > 15) {
            lines.push(`\n... y ${result.unmatchedBank.length - 15} transacciones más`);
        }
        lines.push('');
    }

    // Transacciones no conciliadas del ERP
    if (result.unmatchedERP.length > 0) {
        lines.push('=== TRANSACCIONES PENDIENTES DEL ERP ===');
        lines.push(`Total: ${result.unmatchedERP.length}`);
        result.unmatchedERP.slice(0, 15).forEach((trans, idx) => {
            lines.push(`\nPendiente ERP ${idx + 1}:`);
            lines.push(`  Fecha: ${formatDate(trans.fechaElaboracion)}`);
            lines.push(`  Valor: ${formatCurrency(trans.valor)}`);
            lines.push(`  Comprobante: ${trans.comprobante}`);
            lines.push(`  Tercero: ${trans.nombreTercero}`);
        });
        if (result.unmatchedERP.length > 15) {
            lines.push(`\n... y ${result.unmatchedERP.length - 15} transacciones más`);
        }
        lines.push('');
    }

    // Gastos bancarios
    if (result.bankExpenses.length > 0) {
        lines.push('=== GASTOS BANCARIOS IDENTIFICADOS ===');
        lines.push(`Total: ${result.bankExpenses.length}`);
        lines.push(`Monto total: ${formatCurrency(result.stats.bankExpensesTotal)}`);
        lines.push('');
    }

    return lines.join('\n');
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2,
    }).format(value);
}

