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
        // Si el error contiene saltos de línea, formatearlo mejor
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

    // Importar xlsx dinámicamente
    import('xlsx').then((XLSX) => {
      const workbook = XLSX.utils.book_new();

      // Hoja de conciliados
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

      // Hoja de pendientes banco
      const unmatchedBankData = result.unmatchedBank.map((t) => ({
        'Fecha': new Date(t.fecha).toLocaleDateString('es-ES'),
        'Valor': t.valor,
        'Cuenta': t.cuenta,
        'Descripción': t.descripcion,
        'Código': t.codigo,
      }));
      const unmatchedBankSheet = XLSX.utils.json_to_sheet(unmatchedBankData);
      XLSX.utils.book_append_sheet(workbook, unmatchedBankSheet, 'Pendientes Banco');

      // Hoja de pendientes ERP
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

      // Hoja de gastos bancarios
      const bankExpensesData = result.bankExpenses.map((expense) => ({
        'Fecha': new Date(expense.fecha).toLocaleDateString('es-ES'),
        'Concepto': expense.concepto,
        'Descripción': expense.descripcion,
        'Valor': expense.valor,
        'Cuenta': expense.cuenta,
      }));
      
      // Agregar fila de total
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

      // Hoja de estadísticas
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

      // Descargar archivo
      const fileName = `conciliacion_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            Sistema de Conciliación Bancaria
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Concilia extractos bancarios con movimientos contables de forma rápida y precisa
          </p>
        </div>

        {/* File Upload Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
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
        <div className="mb-6">
          <ConfigPanel
            useDate={useDate}
            onUseDateChange={setUseDate}
            tolerance={tolerance}
            onToleranceChange={setTolerance}
          />
        </div>

        {/* Action Button */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={handleReconcile}
            disabled={loading || !csvFile || !excelFile}
            className={`
              px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200
              ${
                loading || !csvFile || !excelFile
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2">
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
              </span>
            ) : (
              'Ejecutar Conciliación'
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
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
                <p className="text-red-800 dark:text-red-300 font-semibold mb-2">Error al procesar los archivos</p>
                <div className="text-red-700 dark:text-red-400 text-sm whitespace-pre-line">
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
            <div className="mb-6">
              <StatsPanel stats={result.stats} />
            </div>

            {/* Export Button */}
            <div className="mb-6 flex justify-end">
              <button
                onClick={handleExport}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
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
    </div>
  );
}
