'use client';

import { useState } from 'react';
import { ReconciliationResult } from '@/app/lib/reconciliation';
import { BankTransaction, ERPTransaction } from '@/app/lib/fileParser';

interface DeviationTimelinePanelProps {
  result: ReconciliationResult;
}

interface DayDeviation {
  date: string;
  dateObj: Date;
  bankDebits: number;
  bankCredits: number;
  erpDebits: number;
  erpCredits: number;
  unmatchedBankCount: number;
  unmatchedERPCount: number;
  totalDifference: number;
  unmatchedBankTotal: number;
  unmatchedERPTotal: number;
}

interface WeekDeviation {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  bankDebits: number;
  bankCredits: number;
  erpDebits: number;
  erpCredits: number;
  unmatchedBankCount: number;
  unmatchedERPCount: number;
  totalDifference: number;
  unmatchedBankTotal: number;
  unmatchedERPTotal: number;
  days: DayDeviation[];
}

export default function DeviationTimelinePanel({ result }: DeviationTimelinePanelProps) {
  const [downloading, setDownloading] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  // Función helper para asegurar que siempre tengamos un objeto Date
  const ensureDate = (date: Date | string): Date => {
    if (date instanceof Date) {
      return date;
    }
    if (typeof date === 'string') {
      return new Date(date);
    }
    return new Date();
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que la semana empiece en lunes
    return new Date(d.setDate(diff));
  };

  const getWeekEnd = (date: Date): Date => {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return weekEnd;
  };

  // Agrupar TODAS las transacciones por día (conciliadas y no conciliadas)
  const dayDeviations = new Map<string, DayDeviation>();

  // Procesar TODAS las transacciones del banco (conciliadas + no conciliadas)
  // Primero las conciliadas
  result.matched.forEach((match) => {
    const trans = match.bankTransaction;
    const dateObj = ensureDate(trans.fecha);
    const dateKey = formatDate(dateObj);
    if (!dayDeviations.has(dateKey)) {
      dayDeviations.set(dateKey, {
        date: dateKey,
        dateObj: dateObj,
        bankDebits: 0,
        bankCredits: 0,
        erpDebits: 0,
        erpCredits: 0,
        unmatchedBankCount: 0,
        unmatchedERPCount: 0,
        totalDifference: 0,
        unmatchedBankTotal: 0,
        unmatchedERPTotal: 0,
      });
    }
    const day = dayDeviations.get(dateKey)!;
    if (trans.valor < 0) {
      day.bankDebits += Math.abs(trans.valor);
    } else {
      day.bankCredits += trans.valor;
    }
    // Agregar diferencia si existe
    if (match.difference > 0) {
      day.totalDifference += match.difference;
    }
  });

  // Luego las no conciliadas del banco
  result.unmatchedBank.forEach((trans) => {
    const dateObj = ensureDate(trans.fecha);
    const dateKey = formatDate(dateObj);
    if (!dayDeviations.has(dateKey)) {
      dayDeviations.set(dateKey, {
        date: dateKey,
        dateObj: dateObj,
        bankDebits: 0,
        bankCredits: 0,
        erpDebits: 0,
        erpCredits: 0,
        unmatchedBankCount: 0,
        unmatchedERPCount: 0,
        totalDifference: 0,
        unmatchedBankTotal: 0,
        unmatchedERPTotal: 0,
      });
    }
    const day = dayDeviations.get(dateKey)!;
    if (trans.valor < 0) {
      day.bankDebits += Math.abs(trans.valor);
    } else {
      day.bankCredits += trans.valor;
    }
    day.unmatchedBankCount++;
    day.unmatchedBankTotal += Math.abs(trans.valor);
  });

  // Procesar TODAS las transacciones del ERP (conciliadas + no conciliadas)
  // Primero las conciliadas
  result.matched.forEach((match) => {
    const trans = match.erpTransaction;
    const dateObj = ensureDate(trans.fechaElaboracion);
    const dateKey = formatDate(dateObj);
    if (!dayDeviations.has(dateKey)) {
      dayDeviations.set(dateKey, {
        date: dateKey,
        dateObj: dateObj,
        bankDebits: 0,
        bankCredits: 0,
        erpDebits: 0,
        erpCredits: 0,
        unmatchedBankCount: 0,
        unmatchedERPCount: 0,
        totalDifference: 0,
        unmatchedBankTotal: 0,
        unmatchedERPTotal: 0,
      });
    }
    const day = dayDeviations.get(dateKey)!;
    if (trans.valor < 0) {
      day.erpDebits += Math.abs(trans.valor);
    } else {
      day.erpCredits += trans.valor;
    }
  });

  // Luego las no conciliadas del ERP
  result.unmatchedERP.forEach((trans) => {
    const dateObj = ensureDate(trans.fechaElaboracion);
    const dateKey = formatDate(dateObj);
    if (!dayDeviations.has(dateKey)) {
      dayDeviations.set(dateKey, {
        date: dateKey,
        dateObj: dateObj,
        bankDebits: 0,
        bankCredits: 0,
        erpDebits: 0,
        erpCredits: 0,
        unmatchedBankCount: 0,
        unmatchedERPCount: 0,
        totalDifference: 0,
        unmatchedBankTotal: 0,
        unmatchedERPTotal: 0,
      });
    }
    const day = dayDeviations.get(dateKey)!;
    if (trans.valor < 0) {
      day.erpDebits += Math.abs(trans.valor);
    } else {
      day.erpCredits += trans.valor;
    }
    day.unmatchedERPCount++;
    day.unmatchedERPTotal += Math.abs(trans.valor);
  });

  // Calcular diferencia total por día (incluye diferencias de transacciones no conciliadas)
  dayDeviations.forEach((day) => {
    // Agregar la diferencia entre pendientes del banco y ERP
    const unmatchedDifference = Math.abs(day.unmatchedBankTotal - day.unmatchedERPTotal);
    day.totalDifference += unmatchedDifference;
  });

  // Convertir a array y ordenar por fecha
  const dayDeviationsArray = Array.from(dayDeviations.values())
    .map(day => ({
      ...day,
      dateObj: ensureDate(day.dateObj) // Asegurar que dateObj sea siempre un Date válido
    }))
    .sort(
      (a, b) => {
        const timeA = a.dateObj.getTime();
        const timeB = b.dateObj.getTime();
        if (isNaN(timeA) || isNaN(timeB)) {
          return 0; // Si alguna fecha es inválida, mantener el orden original
        }
        return timeA - timeB;
      }
    );

  // Agrupar por semana
  const weekDeviations = new Map<string, WeekDeviation>();

  dayDeviationsArray.forEach((day) => {
    const weekStart = getWeekStart(day.dateObj);
    const weekEnd = getWeekEnd(day.dateObj);
    const weekKey = `${formatDate(weekStart)}_${formatDate(weekEnd)}`;

    if (!weekDeviations.has(weekKey)) {
      weekDeviations.set(weekKey, {
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(weekEnd),
        weekNumber: getWeekNumber(day.dateObj),
        bankDebits: 0,
        bankCredits: 0,
        erpDebits: 0,
        erpCredits: 0,
        unmatchedBankCount: 0,
        unmatchedERPCount: 0,
        totalDifference: 0,
        unmatchedBankTotal: 0,
        unmatchedERPTotal: 0,
        days: [],
      });
    }

    const week = weekDeviations.get(weekKey)!;
    week.bankDebits += day.bankDebits;
    week.bankCredits += day.bankCredits;
    week.erpDebits += day.erpDebits;
    week.erpCredits += day.erpCredits;
    week.unmatchedBankCount += day.unmatchedBankCount;
    week.unmatchedERPCount += day.unmatchedERPCount;
    week.totalDifference += day.totalDifference;
    week.unmatchedBankTotal += day.unmatchedBankTotal;
    week.unmatchedERPTotal += day.unmatchedERPTotal;
    week.days.push(day);
  });

  const weekDeviationsArray = Array.from(weekDeviations.values()).sort(
    (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  );

  const getSeverityColor = (difference: number) => {
    if (difference === 0) return 'bg-green-50 border-green-200';
    if (difference < 100000) return 'bg-blue-50 border-blue-200';
    if (difference < 1000000) return 'bg-yellow-50 border-yellow-200';
    if (difference < 10000000) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getSeverityText = (difference: number) => {
    if (difference === 0) return 'text-green-700';
    if (difference < 100000) return 'text-blue-700';
    if (difference < 1000000) return 'text-yellow-700';
    if (difference < 10000000) return 'text-orange-700';
    return 'text-red-700';
  };

  // Calcular totales para la tabla de días
  const dayTotals = dayDeviationsArray.reduce(
    (acc, day) => ({
      bankDebits: acc.bankDebits + day.bankDebits,
      bankCredits: acc.bankCredits + day.bankCredits,
      erpDebits: acc.erpDebits + day.erpDebits,
      erpCredits: acc.erpCredits + day.erpCredits,
      unmatchedBankTotal: acc.unmatchedBankTotal + day.unmatchedBankTotal,
      unmatchedERPTotal: acc.unmatchedERPTotal + day.unmatchedERPTotal,
      totalDifference: acc.totalDifference + day.totalDifference,
      unmatchedBankCount: acc.unmatchedBankCount + day.unmatchedBankCount,
      unmatchedERPCount: acc.unmatchedERPCount + day.unmatchedERPCount,
    }),
    {
      bankDebits: 0,
      bankCredits: 0,
      erpDebits: 0,
      erpCredits: 0,
      unmatchedBankTotal: 0,
      unmatchedERPTotal: 0,
      totalDifference: 0,
      unmatchedBankCount: 0,
      unmatchedERPCount: 0,
    }
  );

  const handleDownloadExcel = () => {
    setDownloading(true);
    import('xlsx').then((XLSX) => {
      try {
        const workbook = XLSX.utils.book_new();

        // Preparar datos para la hoja de semanas
        const weekData = weekDeviationsArray.map((week) => ({
          'Semana': week.weekNumber,
          'Fecha Inicio': week.weekStart,
          'Fecha Fin': week.weekEnd,
          'Débito Banco': week.bankDebits,
          'Débito ERP': week.erpDebits,
          'Crédito Banco': week.bankCredits,
          'Crédito ERP': week.erpCredits,
          'Diferencia Débito': week.bankDebits - week.erpDebits,
          'Diferencia Crédito': week.bankCredits - week.erpCredits,
          'Pendientes Banco': week.unmatchedBankTotal,
          'Pendientes ERP': week.unmatchedERPTotal,
          'Cantidad Banco': week.unmatchedBankCount,
          'Cantidad ERP': week.unmatchedERPCount,
          'Diferencia Total': week.totalDifference,
        }));

        // Preparar datos para la hoja de días
        const dayData = dayDeviationsArray.map((day) => ({
          'Fecha': day.date,
          'Débito Banco': day.bankDebits,
          'Débito ERP': day.erpDebits,
          'Crédito Banco': day.bankCredits,
          'Crédito ERP': day.erpCredits,
          'Diferencia Débito': day.bankDebits - day.erpDebits,
          'Diferencia Crédito': day.bankCredits - day.erpCredits,
          'Pendientes Banco': day.unmatchedBankTotal,
          'Pendientes ERP': day.unmatchedERPTotal,
          'Cantidad Banco': day.unmatchedBankCount,
          'Cantidad ERP': day.unmatchedERPCount,
          'Diferencia Total': day.totalDifference,
        }));

        // Crear hojas
        const weekSheet = XLSX.utils.json_to_sheet(weekData);
        const daySheet = XLSX.utils.json_to_sheet(dayData);

        // Ajustar anchos de columna para la hoja de semanas
        const weekColWidths = [
          { wch: 8 },  // Semana
          { wch: 12 }, // Fecha Inicio
          { wch: 12 }, // Fecha Fin
          { wch: 15 }, // Débito Banco
          { wch: 15 }, // Débito ERP
          { wch: 15 }, // Crédito Banco
          { wch: 15 }, // Crédito ERP
          { wch: 18 }, // Diferencia Débito
          { wch: 18 }, // Diferencia Crédito
          { wch: 18 }, // Pendientes Banco
          { wch: 18 }, // Pendientes ERP
          { wch: 15 }, // Cantidad Banco
          { wch: 15 }, // Cantidad ERP
          { wch: 18 }, // Diferencia Total
        ];
        weekSheet['!cols'] = weekColWidths;

        // Ajustar anchos de columna para la hoja de días
        const dayColWidths = [
          { wch: 12 }, // Fecha
          { wch: 15 }, // Débito Banco
          { wch: 15 }, // Débito ERP
          { wch: 15 }, // Crédito Banco
          { wch: 15 }, // Crédito ERP
          { wch: 18 }, // Diferencia Débito
          { wch: 18 }, // Diferencia Crédito
          { wch: 18 }, // Pendientes Banco
          { wch: 18 }, // Pendientes ERP
          { wch: 15 }, // Cantidad Banco
          { wch: 15 }, // Cantidad ERP
          { wch: 18 }, // Diferencia Total
        ];
        daySheet['!cols'] = dayColWidths;

        // Agregar hojas al workbook
        XLSX.utils.book_append_sheet(workbook, weekSheet, 'Desviaciones por Semana');
        XLSX.utils.book_append_sheet(workbook, daySheet, 'Desviaciones por Día');

        // Generar nombre de archivo con fecha
        const fileName = `desviaciones_temporales_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        setDownloading(false);
      } catch (error) {
        console.error('Error al generar Excel:', error);
        alert('Error al generar el archivo Excel. Por favor, intenta nuevamente.');
        setDownloading(false);
      }
    }).catch((error) => {
      console.error('Error al cargar módulo xlsx:', error);
      alert('Error al cargar el módulo Excel. Por favor, intenta nuevamente.');
      setDownloading(false);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
            <h2 className="text-xl font-bold text-white">
              Análisis Temporal de Transacciones
            </h2>
            <p className="text-sm text-white/90">
              Todas las transacciones (conciliadas y no conciliadas) agrupadas por día y semana
            </p>
            </div>
          </div>
          <button
            onClick={handleDownloadExcel}
            disabled={downloading}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2
              ${
                downloading
                  ? 'bg-white/20 text-white/70 cursor-not-allowed'
                  : 'bg-white text-indigo-600 hover:bg-white/90 shadow-md hover:shadow-lg'
              }
            `}
          >
            {downloading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
                Generando...
              </>
            ) : (
              <>
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
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Descargar Excel
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Vista por Semana */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Vista por Semana
          </h3>
          <div className="space-y-3">
            {weekDeviationsArray.map((week, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-4 ${getSeverityColor(week.totalDifference)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      Semana {week.weekNumber} ({week.weekStart} - {week.weekEnd})
                    </h4>
                    <p className="text-sm font-bold text-black">
                      Diferencia Total: {formatCurrency(week.totalDifference)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-600">
                      Banco: {week.unmatchedBankCount} | ERP: {week.unmatchedERPCount}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                  <div>
                    <span className="text-gray-600">Débitos Banco:</span>
                    <p className="font-semibold text-red-700">{formatCurrency(week.bankDebits)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Créditos Banco:</span>
                    <p className="font-semibold text-green-700">{formatCurrency(week.bankCredits)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Débitos ERP:</span>
                    <p className="font-semibold text-red-700">{formatCurrency(week.erpDebits)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Créditos ERP:</span>
                    <p className="font-semibold text-green-700">{formatCurrency(week.erpCredits)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm pb-3 border-b border-gray-300">
                  <div>
                    <span className="text-gray-700 font-medium">Diferencia Débito:</span>
                    <p className="font-bold text-orange-700">{formatCurrency(week.bankDebits - week.erpDebits)}</p>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Diferencia Crédito:</span>
                    <p className="font-bold text-orange-700">{formatCurrency(week.bankCredits - week.erpCredits)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-700 font-medium">Pendientes Banco:</span>
                      <p className="font-bold text-gray-900">{formatCurrency(week.unmatchedBankTotal)}</p>
                    </div>
                    <div>
                      <span className="text-gray-700 font-medium">Pendientes ERP:</span>
                      <p className="font-bold text-gray-900">{formatCurrency(week.unmatchedERPTotal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vista por Día */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Vista por Día
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Déb. Banco
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Déb. ERP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créd. Banco
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créd. ERP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dif. Déb.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dif. Créd.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pend. Banco
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pend. ERP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diferencia
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Casos
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dayDeviationsArray.map((day, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50 ${getSeverityColor(day.totalDifference)}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {day.date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-700">
                      {day.bankDebits > 0 ? formatCurrency(day.bankDebits) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-700">
                      {day.erpDebits > 0 ? formatCurrency(day.erpDebits) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-700">
                      {day.bankCredits > 0 ? formatCurrency(day.bankCredits) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-700">
                      {day.erpCredits > 0 ? formatCurrency(day.erpCredits) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-700">
                      {formatCurrency(day.bankDebits - day.erpDebits)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-700">
                      {formatCurrency(day.bankCredits - day.erpCredits)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                      {day.unmatchedBankTotal > 0 ? formatCurrency(day.unmatchedBankTotal) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                      {day.unmatchedERPTotal > 0 ? formatCurrency(day.unmatchedERPTotal) : '-'}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${getSeverityText(day.totalDifference)}`}>
                      {formatCurrency(day.totalDifference)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-600">
                      <div className="flex flex-col gap-1">
                        {day.unmatchedBankCount > 0 && (
                          <span className="text-xs">B: {day.unmatchedBankCount}</span>
                        )}
                        {day.unmatchedERPCount > 0 && (
                          <span className="text-xs">E: {day.unmatchedERPCount}</span>
                        )}
                        {day.unmatchedBankCount === 0 && day.unmatchedERPCount === 0 && '-'}
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Fila de Totales */}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-700 font-bold">
                    {formatCurrency(dayTotals.bankDebits)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-700 font-bold">
                    {formatCurrency(dayTotals.erpDebits)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-700 font-bold">
                    {formatCurrency(dayTotals.bankCredits)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-700 font-bold">
                    {formatCurrency(dayTotals.erpCredits)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-700 font-bold">
                    {formatCurrency(dayTotals.bankDebits - dayTotals.erpDebits)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-700 font-bold">
                    {formatCurrency(dayTotals.bankCredits - dayTotals.erpCredits)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700 font-bold">
                    {formatCurrency(dayTotals.unmatchedBankTotal)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700 font-bold">
                    {formatCurrency(dayTotals.unmatchedERPTotal)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${getSeverityText(dayTotals.totalDifference)}`}>
                    {formatCurrency(dayTotals.totalDifference)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700 font-bold">
                    <div className="flex flex-col gap-1">
                      {dayTotals.unmatchedBankCount > 0 && (
                        <span className="text-xs">B: {dayTotals.unmatchedBankCount}</span>
                      )}
                      {dayTotals.unmatchedERPCount > 0 && (
                        <span className="text-xs">E: {dayTotals.unmatchedERPCount}</span>
                      )}
                      {dayTotals.unmatchedBankCount === 0 && dayTotals.unmatchedERPCount === 0 && '-'}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
