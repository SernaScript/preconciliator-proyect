'use client';

import { BankType } from '@/app/lib/fileParser';

interface BankSelectorProps {
  selectedBank: BankType;
  onBankChange: (bank: BankType) => void;
}

const BANKS: { value: BankType; label: string }[] = [
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'banco_occidente', label: 'Banco de Occidente' },
  { value: 'banco_bogota', label: 'Banco de Bogotá' },
  { value: 'davivienda', label: 'Davivienda' },
];

export default function BankSelector({ selectedBank, onBankChange }: BankSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Seleccionar Banco
      </h3>
      
      <div className="space-y-3">
        {BANKS.map((bank) => (
          <button
            key={bank.value}
            onClick={() => onBankChange(bank.value)}
            className={`
              w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 text-left
              flex items-center gap-3
              ${
                selectedBank === bank.value
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <div
              className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${
                  selectedBank === bank.value
                    ? 'border-white'
                    : 'border-gray-400'
                }
              `}
            >
              {selectedBank === bank.value && (
                <div className="w-3 h-3 rounded-full bg-white" />
              )}
            </div>
            <span>{bank.label}</span>
          </button>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Selecciona el banco del extracto bancario que vas a conciliar
        </p>
      </div>
    </div>
  );
}

