'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FileUpload from '../components/FileUpload';
import ConfigPanel from '../components/ConfigPanel';
import StatsPanel from '../components/StatsPanel';
import ReconciliationTable from '../components/ReconciliationTable';
import AIAnalysisPanel from '../components/AIAnalysisPanel';
import DeviationTimelinePanel from '../components/DeviationTimelinePanel';
import FullTransactionDetailsPanel from '../components/FullTransactionDetailsPanel';
import { ReconciliationResult } from '../lib/reconciliation';
import { BankType } from '../lib/fileParser';

const BANK_LABELS: Record<BankType, string> = {
  bancolombia: 'Bancolombia',
  banco_occidente: 'Banco de Occidente',
  banco_bogota: 'Banco de Bogota',
  davivienda: 'Davivienda',
};

const isValidBankType = (value: string | null): value is BankType =>
  value === 'bancolombia' || value === 'banco_occidente' || value === 'banco_bogota' || value === 'davivienda';

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsibleSection({ title, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm md:text-base font-semibold text-gray-800">{title}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-5 border-t border-gray-200">{children}</div>}
    </div>
  );
}

export default function ConciliarPage() {
  const searchParams = useSearchParams();
  const [selectedBank, setSelectedBank] = useState<BankType>('bancolombia');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [useDate, setUseDate] = useState(false);
  const [tolerance, setTolerance] = useState(0);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    stats: false,
    ai: false,
    timeline: false,
    details: false,
    table: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const bankFromQuery = searchParams.get('bank');
    if (isValidBankType(bankFromQuery)) {
      setSelectedBank(bankFromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    if (csvFile) {
      const fileName = csvFile.name.toLowerCase();
      const isCsvOrTxt = fileName.endsWith('.csv') || fileName.endsWith('.txt');
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      if ((selectedBank === 'davivienda' || selectedBank === 'banco_occidente') && !isExcel) {
        setCsvFile(null);
      } else if (selectedBank === 'banco_bogota' && !isCsvOrTxt) {
        setCsvFile(null);
      } else if (selectedBank === 'bancolombia' && !fileName.endsWith('.csv')) {
        setCsvFile(null);
      }
    }
    setResult(null);
    setError(null);
  }, [selectedBank, csvFile]);

  const handleReconcile = async () => {
    if (!csvFile || !excelFile) {
      setError('Por favor, sube ambos archivos (extracto bancario y contabilidad)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', csvFile);
      formData.append('excelFile', excelFile);
      formData.append('useDate', String(useDate));
      formData.append('tolerance', String(tolerance));
      formData.append('bankType', selectedBank);

      const response = await fetch('/api/reconcile', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar la conciliacion');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!result) {
      setError('Primero debes ejecutar una conciliacion');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ result }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el analisis de IA');
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al analizar con IA');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (!result) return;

    import('xlsx').then((XLSX) => {
      const workbook = XLSX.utils.book_new();

      const matchedData = result.matched.map((match) => ({
        'Fecha Banco': new Date(match.bankTransaction.fecha).toLocaleDateString('es-ES'),
        'Valor Banco': match.bankTransaction.valor,
        'Descripcion Banco': match.bankTransaction.descripcion,
        'Fecha Contabilidad': new Date(match.erpTransaction.fechaElaboracion).toLocaleDateString('es-ES'),
        'Valor Contabilidad': match.erpTransaction.valor,
        'Tercero Contabilidad': match.erpTransaction.nombreTercero,
        Comprobante: match.erpTransaction.comprobante,
        Diferencia: match.difference,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(matchedData), 'Conciliados');

      const unmatchedBankData = result.unmatchedBank.map((t) => ({
        Fecha: new Date(t.fecha).toLocaleDateString('es-ES'),
        Valor: t.valor,
        Cuenta: t.cuenta,
        Descripcion: t.descripcion,
        Codigo: t.codigo,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(unmatchedBankData), 'Pendientes Banco');

      const unmatchedAccountingData = result.unmatchedERP.map((t) => ({
        Fecha: new Date(t.fechaElaboracion).toLocaleDateString('es-ES'),
        Valor: t.valor,
        Comprobante: t.comprobante,
        Tercero: t.nombreTercero,
        Debito: t.debito,
        Credito: t.credito,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(unmatchedAccountingData), 'Pendientes Contabilidad');

      const fileName = `conciliacion_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4 max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Conciliacion - {BANK_LABELS[selectedBank]}</h1>
            <p className="text-sm text-gray-600">Carga archivos y ejecuta la conciliacion</p>
          </div>
          <Link href="/" className="text-sm font-medium text-orange-600 hover:text-orange-700">
            Cambiar banco
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <FileUpload
            label={
              selectedBank === 'davivienda' || selectedBank === 'banco_occidente'
                ? 'Extracto Bancario (Excel)'
                : selectedBank === 'banco_bogota'
                  ? 'Extracto Bancario (CSV o TXT)'
                  : 'Extracto Bancario (CSV)'
            }
            accept={(selectedBank === 'davivienda' || selectedBank === 'banco_occidente') ? '.xlsx,.xls' : '.csv'}
            file={csvFile}
            onFileChange={setCsvFile}
            error={error && !csvFile ? error : undefined}
            bankType={selectedBank}
          />
          <FileUpload
            label="Movimientos de Contabilidad (Excel)"
            accept=".xlsx,.xls"
            file={excelFile}
            onFileChange={setExcelFile}
            error={error && !excelFile ? error : undefined}
          />
        </div>

        <div className="mb-8">
          <ConfigPanel
            useDate={useDate}
            onUseDateChange={setUseDate}
            tolerance={tolerance}
            onToleranceChange={setTolerance}
          />
        </div>

        <div className="mb-8 flex justify-center">
          <button
            onClick={handleReconcile}
            disabled={loading || !csvFile || !excelFile}
            className={`px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 ${
              loading || !csvFile || !excelFile
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-orange-500 text-white shadow-md hover:shadow-lg hover:bg-orange-600'
            }`}
          >
            {loading ? 'Procesando...' : 'Ejecutar Conciliacion'}
          </button>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-5 text-red-700 text-sm whitespace-pre-line">
            {error}
          </div>
        )}

        {result && (
          <>
            <CollapsibleSection
              title="Resumen de conciliacion"
              isOpen={openSections.stats}
              onToggle={() => toggleSection('stats')}
            >
              <StatsPanel stats={result.stats} />
            </CollapsibleSection>

            {!result.aiAnalysis && (
              <div className="mb-8 flex justify-center">
                <button
                  onClick={handleAnalyzeWithAI}
                  disabled={analyzing}
                  className={`px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 ${
                    analyzing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {analyzing ? 'Analizando con IA...' : 'Analizar con IA'}
                </button>
              </div>
            )}

            {result.aiAnalysis && (
              <CollapsibleSection
                title="Analisis con IA"
                isOpen={openSections.ai}
                onToggle={() => toggleSection('ai')}
              >
                <AIAnalysisPanel result={result} />
              </CollapsibleSection>
            )}

            {(result.unmatchedBank.length > 0 || result.unmatchedERP.length > 0 || result.matched.some((m) => m.difference > 0)) && (
              <CollapsibleSection
                title="Analisis Temporal de Transacciones"
                isOpen={openSections.timeline}
                onToggle={() => toggleSection('timeline')}
              >
                <DeviationTimelinePanel result={result} />
              </CollapsibleSection>
            )}

            {(result.unmatchedBank.length > 0 || result.unmatchedERP.length > 0) && (
              <CollapsibleSection
                title="Detalles Completos de Transacciones"
                isOpen={openSections.details}
                onToggle={() => toggleSection('details')}
              >
                <FullTransactionDetailsPanel result={result} />
              </CollapsibleSection>
            )}

            <CollapsibleSection
              title="Detalle completo y exportable a Excel"
              isOpen={openSections.table}
              onToggle={() => toggleSection('table')}
            >
              <div className="mb-6 flex justify-end">
                <button
                  onClick={handleExport}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Exportar a Excel
                </button>
              </div>
              <ReconciliationTable result={result} />
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
}
