'use client';

import { useState } from 'react';
import FileUpload from './components/FileUpload';
import ConfigPanel from './components/ConfigPanel';
import StatsPanel from './components/StatsPanel';
import ReconciliationTable from './components/ReconciliationTable';
import { ReconciliationResult } from './lib/reconciliation';

export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [useDate, setUseDate] = useState(false);
  const [tolerance, setTolerance] = useState(0);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconcile = async () => {
    if (!csvFile || !excelFile) {
      setError('Por favor, sube ambos archivos (CSV y Excel)');
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

      const response = await fetch('/api/reconcile', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Error al procesar la conciliación';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;

    import('xlsx').then((XLSX) => {
      const workbook = XLSX.utils.book_new();

      const matchedData = result.matched.map((match) => ({
        'Fecha Banco': new Date(match.bankTransaction.fecha).toLocaleDateString('es-ES'),
        'Valor Banco': match.bankTransaction.valor,
        'Descripción Banco': match.bankTransaction.descripcion,
        'Fecha ERP': new Date(match.erpTransaction.fechaElaboracion).toLocaleDateString('es-ES'),
        'Valor ERP': match.erpTransaction.valor,
        'Tercero ERP': match.erpTransaction.nombreTercero,
        'Comprobante': match.erpTransaction.comprobante,
        'Diferencia': match.difference,
      }));
      const matchedSheet = XLSX.utils.json_to_sheet(matchedData);
      XLSX.utils.book_append_sheet(workbook, matchedSheet, 'Conciliados');

      const unmatchedBankData = result.unmatchedBank.map((t) => ({
        'Fecha': new Date(t.fecha).toLocaleDateString('es-ES'),
        'Valor': t.valor,
        'Cuenta': t.cuenta,
        'Descripción': t.descripcion,
        'Código': t.codigo,
      }));
      const unmatchedBankSheet = XLSX.utils.json_to_sheet(unmatchedBankData);
      XLSX.utils.book_append_sheet(workbook, unmatchedBankSheet, 'Pendientes Banco');

      const unmatchedERPData = result.unmatchedERP.map((t) => ({
        'Fecha': new Date(t.fechaElaboracion).toLocaleDateString('es-ES'),
        'Valor': t.valor,
        'Comprobante': t.comprobante,
        'Tercero': t.nombreTercero,
        'Débito': t.debito,
        'Crédito': t.credito,
      }));
      const unmatchedERPSheet = XLSX.utils.json_to_sheet(unmatchedERPData);
      XLSX.utils.book_append_sheet(workbook, unmatchedERPSheet, 'Pendientes ERP');

      const bankExpensesData = result.bankExpenses.map((expense) => ({
        'Fecha': new Date(expense.fecha).toLocaleDateString('es-ES'),
        'Concepto': expense.concepto,
        'Descripción': expense.descripcion,
        'Valor': expense.valor,
        'Cuenta': expense.cuenta,
      }));
      
      if (bankExpensesData.length > 0) {
        bankExpensesData.push({
          'Fecha': '',
          'Concepto': 'TOTAL',
          'Descripción': '',
          'Valor': result.bankExpenses.reduce((sum, expense) => sum + Math.abs(expense.valor), 0),
          'Cuenta': '',
        });
      }
      
      const bankExpensesSheet = XLSX.utils.json_to_sheet(bankExpensesData);
      XLSX.utils.book_append_sheet(workbook, bankExpensesSheet, 'Gastos Bancarios');

      const statsData = [
        { 'Métrica': 'Total Extracto Bancario', 'Valor': result.stats.totalBank },
        { 'Métrica': 'Total ERP', 'Valor': result.stats.totalERP },
        { 'Métrica': 'Conciliados', 'Valor': result.stats.matched },
        { 'Métrica': 'Pendientes Banco', 'Valor': result.stats.unmatchedBank },
        { 'Métrica': 'Pendientes ERP', 'Valor': result.stats.unmatchedERP },
        { 'Métrica': 'Gastos Bancarios', 'Valor': result.stats.bankExpenses || 0 },
        { 'Métrica': 'Total Gastos Bancarios', 'Valor': result.stats.bankExpensesTotal || 0 },
        { 'Métrica': 'Porcentaje de Conciliación', 'Valor': `${result.stats.matchPercentage}%` },
      ];
      const statsSheet = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estadísticas');

      const fileName = `conciliacion_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span className="text-2xl font-semibold text-gray-800">Conciliador</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 text-sm">Sistema de Conciliación</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Sistema de Conciliación Bancaria
          </div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="text-gray-800">Portal de </span>
            <span className="text-orange-500">Conciliación</span>
          </h1>

          {/* Description */}
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Plataforma para conciliar extractos bancarios con movimientos contables de forma rápida, 
            precisa y automatizada. Gestiona tus conciliaciones, identifica diferencias y exporta 
            resultados detallados.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto">
          {/* File Upload Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <FileUpload
              label="Extracto Bancario (CSV)"
              accept=".csv"
              file={csvFile}
              onFileChange={setCsvFile}
              error={error && !csvFile ? error : undefined}
            />
            <FileUpload
              label="Movimientos ERP (Excel)"
              accept=".xlsx,.xls"
              file={excelFile}
              onFileChange={setExcelFile}
              error={error && !excelFile ? error : undefined}
            />
          </div>

          {/* Configuration Panel */}
          <div className="mb-8">
            <ConfigPanel
              useDate={useDate}
              onUseDateChange={setUseDate}
              tolerance={tolerance}
              onToleranceChange={setTolerance}
            />
          </div>

          {/* Action Button */}
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleReconcile}
              disabled={loading || !csvFile || !excelFile}
              className={`
                px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 flex items-center gap-2
                ${
                  loading || !csvFile || !excelFile
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white shadow-md hover:shadow-lg hover:bg-orange-600'
                }
              `}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Procesando...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Ejecutar Conciliación
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-red-800 font-semibold mb-2">Error al procesar los archivos</p>
                  <div className="text-red-700 text-sm whitespace-pre-line">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Section */}
          {result && (
            <>
              {/* Statistics Panel */}
              <div className="mb-8">
                <StatsPanel stats={result.stats} />
              </div>

              {/* Export Button */}
              <div className="mb-8 flex justify-end">
                <button
                  onClick={handleExport}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Exportar a Excel
                </button>
              </div>

              {/* Reconciliation Table */}
              <ReconciliationTable result={result} />
            </>
          )}
        </div>

        {/* Features Section */}
        {!result && (
          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Funcionalidades del Portal
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-12">
              Herramientas para gestionar eficientemente tus conciliaciones bancarias
            </p>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg
                    className="w-6 h-6 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">Conciliación Automática</h3>
                <p className="text-sm text-gray-600">
                  Concilia por valores o por valores y fechas con tolerancia configurable
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg
                    className="w-6 h-6 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">Gastos Bancarios</h3>
                <p className="text-sm text-gray-600">
                  Identifica y consolida automáticamente los gastos bancarios
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg
                    className="w-6 h-6 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">Exportación a Excel</h3>
                <p className="text-sm text-gray-600">
                  Exporta resultados completos con múltiples hojas organizadas
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
