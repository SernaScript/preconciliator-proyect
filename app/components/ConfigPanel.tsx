'use client';

interface ConfigPanelProps {
  useDate: boolean;
  onUseDateChange: (useDate: boolean) => void;
  tolerance: number;
  onToleranceChange: (tolerance: number) => void;
}

export default function ConfigPanel({
  useDate,
  onUseDateChange,
  tolerance,
  onToleranceChange,
}: ConfigPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Configuración de Conciliación
      </h3>
      
      <div className="space-y-6">
        {/* Modo de conciliación */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Modo de Conciliación
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => onUseDateChange(false)}
              className={`
                flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200
                ${
                  !useDate
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              Solo Valores
            </button>
            <button
              onClick={() => onUseDateChange(true)}
              className={`
                flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200
                ${
                  useDate
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              Valores + Fechas
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {useDate
              ? 'La conciliación considerará fecha y valor para hacer el match'
              : 'La conciliación solo considerará el valor para hacer el match'}
          </p>
        </div>

        {/* Tolerancia */}
        <div>
          <label
            htmlFor="tolerance"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Tolerancia de Diferencias
          </label>
          <div className="relative">
            <input
              type="number"
              id="tolerance"
              min="0"
              step="0.01"
              value={tolerance}
              onChange={(e) => onToleranceChange(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="0.00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
              unidades
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Permite diferencias de hasta {tolerance} unidades entre valores (ej: 0.10 para 10 centavos, 1 para 1 peso)
          </p>
        </div>
      </div>
    </div>
  );
}

