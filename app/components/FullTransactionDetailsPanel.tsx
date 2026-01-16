'use client';

import { useState } from 'react';
import { ReconciliationResult } from '@/app/lib/reconciliation';
import { BankTransaction, ERPTransaction } from '@/app/lib/fileParser';

interface FullTransactionDetailsPanelProps {
  result: ReconciliationResult;
}

export default function FullTransactionDetailsPanel({ result }: FullTransactionDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<'bank' | 'erp'>('bank');

  // Combinar todas las transacciones del banco (conciliadas + no conciliadas)
  const allBankTransactions = [
    ...result.matched.map(m => ({ ...m.bankTransaction, isMatched: true, difference: m.difference })),
    ...result.unmatchedBank.map(t => ({ ...t, isMatched: false, difference: 0 }))
  ].sort((a, b) => {
    const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
    const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
    return dateA.getTime() - dateB.getTime();
  });

  // Combinar todas las transacciones del ERP (conciliadas + no conciliadas)
  const allERPTransactions = [
    ...result.matched.map(m => ({ ...m.erpTransaction, isMatched: true, difference: m.difference })),
    ...result.unmatchedERP.map(t => ({ ...t, isMatched: false, difference: 0 }))
  ].sort((a, b) => {
    const dateA = a.fechaElaboracion instanceof Date ? a.fechaElaboracion : new Date(a.fechaElaboracion);
    const dateB = b.fechaElaboracion instanceof Date ? b.fechaElaboracion : new Date(b.fechaElaboracion);
    return dateA.getTime() - dateB.getTime();
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
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
          <div>
            <h2 className="text-xl font-bold text-white">
              Detalles Completos de Transacciones
            </h2>
            <p className="text-sm text-white/90">
              Revisa todos los campos de todas las transacciones (conciliadas y no conciliadas)
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('bank')}
            className={`
              px-6 py-4 text-sm font-medium border-b-2 transition-colors
              ${
                activeTab === 'bank'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Movimientos Banco ({allBankTransactions.length})
          </button>
          <button
            onClick={() => setActiveTab('erp')}
            className={`
              px-6 py-4 text-sm font-medium border-b-2 transition-colors
              ${
                activeTab === 'erp'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Documentos ERP ({allERPTransactions.length})
          </button>
        </nav>
      </div>

      <div className="p-6">
        {/* Tab: Movimientos Banco */}
        {activeTab === 'bank' && (
          <div>
            <div className="mb-4 flex gap-4 text-sm">
              <p className="text-gray-600">
                Total de movimientos: <span className="font-semibold">{allBankTransactions.length}</span>
              </p>
              <p className="text-gray-600">
                Conciliados: <span className="font-semibold text-green-600">{result.matched.length}</span>
              </p>
              <p className="text-gray-600">
                No conciliados: <span className="font-semibold text-red-600">{result.unmatchedBank.length}</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cuenta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Iniciales
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diferencia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gasto Bancario
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allBankTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                        No hay movimientos bancarios
                      </td>
                    </tr>
                  ) : (
                    allBankTransactions.map((transaction, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-gray-50 transition-colors ${
                          transaction.isMatched ? 'bg-green-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {transaction.isMatched ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Conciliado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(transaction.fecha)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {transaction.cuenta}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {transaction.iniciales || '-'}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                          transaction.valor < 0 ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {formatCurrency(transaction.valor)}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${
                          transaction.difference > 0 ? 'text-orange-700 font-semibold' : 'text-gray-500'
                        }`}>
                          {transaction.difference > 0 ? formatCurrency(transaction.difference) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {transaction.codigo || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                          <div className="truncate" title={transaction.descripcion}>
                            {transaction.descripcion}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {transaction.isBankExpense ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Sí
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {allBankTransactions.length > 0 && (
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900">
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        {formatCurrency(
                          allBankTransactions.reduce((sum, t) => sum + t.valor, 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-orange-700">
                        {formatCurrency(
                          allBankTransactions.reduce((sum, t) => sum + (t.difference || 0), 0)
                        )}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Tab: Documentos ERP */}
        {activeTab === 'erp' && (
          <div>
            <div className="mb-4 flex gap-4 text-sm">
              <p className="text-gray-600">
                Total de documentos: <span className="font-semibold">{allERPTransactions.length}</span>
              </p>
              <p className="text-gray-600">
                Conciliados: <span className="font-semibold text-green-600">{result.matched.length}</span>
              </p>
              <p className="text-gray-600">
                No conciliados: <span className="font-semibold text-red-600">{result.unmatchedERP.length}</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Elaboración
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comprobante
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tercero
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Débito
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Crédito
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Neto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diferencia
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allERPTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        No hay documentos ERP
                      </td>
                    </tr>
                  ) : (
                    allERPTransactions.map((transaction, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-gray-50 transition-colors ${
                          transaction.isMatched ? 'bg-green-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {transaction.isMatched ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Conciliado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(transaction.fechaElaboracion)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {transaction.comprobante}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                          <div className="truncate" title={transaction.nombreTercero}>
                            {transaction.nombreTercero}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-700">
                          {transaction.debito > 0 ? formatCurrency(transaction.debito) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-700">
                          {transaction.credito > 0 ? formatCurrency(transaction.credito) : '-'}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                          transaction.valor < 0 ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {formatCurrency(transaction.valor)}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${
                          transaction.difference > 0 ? 'text-orange-700 font-semibold' : 'text-gray-500'
                        }`}>
                          {transaction.difference > 0 ? formatCurrency(transaction.difference) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {allERPTransactions.length > 0 && (
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900">
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-red-700">
                        {formatCurrency(
                          allERPTransactions.reduce((sum, t) => sum + t.debito, 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-700">
                        {formatCurrency(
                          allERPTransactions.reduce((sum, t) => sum + t.credito, 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        {formatCurrency(
                          allERPTransactions.reduce((sum, t) => sum + t.valor, 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-orange-700">
                        {formatCurrency(
                          allERPTransactions.reduce((sum, t) => sum + (t.difference || 0), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
