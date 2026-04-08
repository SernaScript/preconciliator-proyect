'use client';

import Link from 'next/link';
import { BankType } from './lib/fileParser';

const BANK_OPTIONS: { value: BankType; label: string; hint: string }[] = [
  { value: 'bancolombia', label: 'Bancolombia', hint: 'Extracto bancario en CSV' },
  { value: 'banco_occidente', label: 'Banco de Occidente', hint: 'Extracto bancario en Excel' },
  { value: 'banco_bogota', label: 'Banco de Bogota', hint: 'Extracto bancario en CSV o TXT' },
  { value: 'davivienda', label: 'Davivienda', hint: 'Extracto bancario en Excel' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4 max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Conciliador</h1>
              <p className="text-sm text-gray-600">Selecciona el banco para iniciar la conciliacion</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-5xl">
        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Que banco quieres conciliar?</h2>
          <p className="text-gray-600 mb-6">
            Elige una opcion y te llevamos a la pantalla de carga de archivos.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {BANK_OPTIONS.map((bank) => (
              <Link
                key={bank.value}
                href={`/conciliar?bank=${bank.value}`}
                className="group rounded-lg border border-gray-200 p-4 hover:border-orange-400 hover:bg-orange-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">{bank.label}</p>
                  <span className="text-orange-500 group-hover:translate-x-1 transition-transform">{'->'}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{bank.hint}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
