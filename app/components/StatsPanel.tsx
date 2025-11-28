'use client';

import { ReconciliationResult } from '@/app/lib/reconciliation';

interface StatsPanelProps {
  stats: ReconciliationResult['stats'] | null;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) {
    return null;
  }

  const statsItems = [
    {
      label: 'Total Extracto Bancario',
      value: stats.totalBank,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Total ERP',
      value: stats.totalERP,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: 'Conciliados',
      value: stats.matched,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Pendientes Banco',
      value: stats.unmatchedBank,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      label: 'Pendientes ERP',
      value: stats.unmatchedERP,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      label: 'Gastos Bancarios',
      value: stats.bankExpenses || 0,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Estadísticas de Conciliación
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsItems.map((item, index) => (
          <div
            key={index}
            className={`${item.bgColor} rounded-lg p-4 text-center transition-transform hover:scale-105`}
          >
            <p className={`text-2xl font-bold ${item.color} mb-1`}>{item.value}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Porcentaje de Conciliación
          </span>
          <div className="flex items-center gap-3">
            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-500"
                style={{ width: `${stats.matchPercentage}%` }}
              />
            </div>
            <span className="text-lg font-bold text-gray-800">
              {stats.matchPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
        {stats.bankExpensesTotal !== undefined && stats.bankExpensesTotal > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Total Gastos Bancarios
              </span>
              <span className="text-lg font-bold text-orange-500">
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 2,
                }).format(stats.bankExpensesTotal)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

