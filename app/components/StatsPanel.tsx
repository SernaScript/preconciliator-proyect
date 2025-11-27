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
  ];

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Estadísticas de Conciliación
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statsItems.map((item, index) => (
          <div
            key={index}
            className={`${item.bgColor} rounded-lg p-4 text-center transition-transform hover:scale-105`}
          >
            <p className="text-2xl font-bold ${item.color} mb-1">{item.value}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Porcentaje de Conciliación
          </span>
          <div className="flex items-center gap-3">
            <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                style={{ width: `${stats.matchPercentage}%` }}
              />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats.matchPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

