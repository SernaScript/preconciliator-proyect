'use client';

import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ConfigPanel from './components/ConfigPanel';
import StatsPanel from './components/StatsPanel';
import ReconciliationTable from './components/ReconciliationTable';
import BankSelector from './components/BankSelector';
import { ReconciliationResult } from './lib/reconciliation';
import { BankType } from './lib/fileParser';

export default function Home() {
  const [selectedBank, setSelectedBank] = useState<BankType>('bancolombia');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [useDate, setUseDate] = useState(false);
  const [tolerance, setTolerance] = useState(0);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpiar archivo del banco cuando cambia el banco seleccionado
  useEffect(() => {
    setCsvFile(null);
    setResult(null);
    setError(null);
  }, [selectedBank]);

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
      formData.append('bankType', selectedBank);

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
        

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Left Sidebar - Bank Selector */}
          <div className="lg:col-span-1">
            <BankSelector
              selectedBank={selectedBank}
              onBankChange={setSelectedBank}
            />
          </div>

          {/* Right Content */}
          <div className="lg:col-span-3">
            {/* File Upload Section */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
            <FileUpload
              label={
                selectedBank === 'davivienda'
                  ? 'Extracto Bancario (Excel)'
                  : selectedBank === 'banco_bogota'
                  ? 'Extracto Bancario (CSV o TXT)'
                  : 'Extracto Bancario (CSV)'
              }
              accept={selectedBank === 'davivienda' ? '.xlsx,.xls' : '.csv'}
              file={csvFile}
              onFileChange={setCsvFile}
              error={error && !csvFile ? error : undefined}
              bankType={selectedBank}
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
        </div>

        {/* Guía de Conciliación */}
        {!result && (
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
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
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Guía de Conciliación
                </h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Selecciona el Banco
                    </h3>
                    <p className="text-sm text-gray-600">
                      Elige el banco del extracto bancario que vas a conciliar (Bancolombia, Banco de Occidente, Banco de Bogotá o Davivienda).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Sube los Archivos
                    </h3>
                    <p className="text-sm text-gray-600">
                      Carga el extracto bancario en formato CSV (o TXT para Banco de Bogotá, Excel para Davivienda) y el archivo de movimientos del ERP en formato Excel (.xlsx o .xls).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Configura la Conciliación
                    </h3>
                    <p className="text-sm text-gray-600">
                      Elige el modo de conciliación: <strong>Solo Valores</strong> (concilia únicamente por monto) o <strong>Valores + Fechas</strong> (requiere coincidencia de monto y fecha). Establece una tolerancia si necesitas permitir pequeñas diferencias.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Ejecuta la Conciliación
                    </h3>
                    <p className="text-sm text-gray-600">
                      Haz clic en "Ejecutar Conciliación" para procesar los archivos. El sistema identificará automáticamente las transacciones conciliadas, pendientes y gastos bancarios.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    5
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Revisa y Exporta
                    </h3>
                    <p className="text-sm text-gray-600">
                      Revisa los resultados en las tablas y exporta el reporte completo a Excel con todas las hojas: conciliados, pendientes del banco, pendientes del ERP y gastos bancarios.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
