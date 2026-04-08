'use client';

import { useState } from 'react';
import { ReconciliationResult } from '@/app/lib/reconciliation';
import { DeviationAnalysis } from '@/app/lib/aiAnalysis';

interface AIAnalysisPanelProps {
  result: ReconciliationResult;
}

export default function AIAnalysisPanel({ result }: AIAnalysisPanelProps) {
  const [generatingPDF, setGeneratingPDF] = useState(false);

  if (!result.aiAnalysis) {
    return null;
  }

  const { summary, totalDifference, deviations, recommendations } = result.aiAnalysis;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'high':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'low':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleDownloadPDF = async () => {
    if (!result.aiAnalysis) return;

    setGeneratingPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      let yPosition = 20;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const maxWidth = doc.internal.pageSize.width - 2 * margin;

      // Función para agregar nueva página si es necesario
      const checkPageBreak = (requiredSpace: number = 20) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPosition = 20;
        }
      };

      // Título
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Análisis de Desviaciones - Conciliación Bancaria', margin, yPosition);
      yPosition += 10;

      // Fecha de generación
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generado el: ${fechaGeneracion}`, margin, yPosition);
      yPosition += 15;

      // Resumen Ejecutivo
      checkPageBreak(30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen Ejecutivo', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(result.aiAnalysis.summary, maxWidth);
      summaryLines.forEach((line: string) => {
        checkPageBreak(8);
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      
      // Diferencia total si está disponible
      if (result.aiAnalysis.totalDifference !== undefined) {
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        doc.text(`Diferencia Total Acumulada: ${formatCurrency(result.aiAnalysis.totalDifference)}`, margin, yPosition);
        yPosition += 8;
      } else {
        yPosition += 10;
      }

      // Desviaciones
      if (result.aiAnalysis.deviations && result.aiAnalysis.deviations.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Desviaciones Identificadas (${result.aiAnalysis.deviations.length})`, margin, yPosition);
        yPosition += 10;

        result.aiAnalysis.deviations.forEach((deviation: DeviationAnalysis, index: number) => {
          checkPageBreak(40);
          
          // Número y tipo de desviación
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`Desviación ${index + 1}:`, margin, yPosition);
          yPosition += 7;

          // Tipo y severidad
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const typeLabels: Record<string, string> = {
            'difference': 'Diferencia en Valores',
            'unmatched': 'Transacción No Conciliada',
            'unmatched_bank': 'Transacción Banco Sin Coincidencia',
            'unmatched_erp': 'Transaccion Contabilidad Sin Coincidencia',
            'distributed_payment': 'Pago Distribuido (Banco ↔ Contabilidad)',
            'summary': 'Resumen'
          };
          const severityLabels: Record<string, string> = {
            'critical': 'CRÍTICA',
            'high': 'ALTA',
            'medium': 'MEDIA',
            'low': 'BAJA'
          };
          
          doc.text(`Tipo: ${typeLabels[deviation.type] || deviation.type}`, margin, yPosition);
          doc.text(`Severidad: ${severityLabels[deviation.severity] || deviation.severity}`, margin + 80, yPosition);
          yPosition += 7;

          // Descripción
          doc.setFont('helvetica', 'bold');
          doc.text('Descripción:', margin, yPosition);
          yPosition += 6;
          doc.setFont('helvetica', 'normal');
          const descLines = doc.splitTextToSize(deviation.description, maxWidth);
          descLines.forEach((line: string) => {
            checkPageBreak(6);
            doc.text(line, margin, yPosition);
            yPosition += 5;
          });
          yPosition += 5;

          // Posibles causas
          if (deviation.possibleCauses && deviation.possibleCauses.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text('Posibles causas:', margin, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            deviation.possibleCauses.forEach((cause: string) => {
              checkPageBreak(6);
              doc.text(`• ${cause}`, margin + 5, yPosition);
              yPosition += 5;
            });
            yPosition += 3;
          }

          // Total del grupo y cantidad
          if (deviation.groupTotal !== undefined) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Total del grupo: ${formatCurrency(deviation.groupTotal)}`, margin, yPosition);
            yPosition += 6;
          }
          if (deviation.count !== undefined) {
            doc.setFont('helvetica', 'normal');
            doc.text(`Cantidad de casos: ${deviation.count}`, margin, yPosition);
            yPosition += 6;
          }

          // Recomendación
          if (deviation.recommendation) {
            doc.setFont('helvetica', 'bold');
            doc.text('Recomendación:', margin, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            const recLines = doc.splitTextToSize(deviation.recommendation, maxWidth);
            recLines.forEach((line: string) => {
              checkPageBreak(6);
              doc.text(line, margin, yPosition);
              yPosition += 5;
            });
            yPosition += 5;
          }

          // Detalles de transacción si existen
          if (deviation.details?.transaction) {
            const trans = deviation.details.transaction;
            doc.setFont('helvetica', 'bold');
            doc.text('Detalles de la Transacción:', margin, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            
            if (trans.bankValue !== undefined) {
              doc.text(`Valor Banco: ${formatCurrency(trans.bankValue)}`, margin, yPosition);
              yPosition += 5;
            }
            if (trans.erpValue !== undefined) {
              doc.text(`Valor Contabilidad: ${formatCurrency(trans.erpValue)}`, margin, yPosition);
              yPosition += 5;
            }
            if (trans.difference !== undefined) {
              doc.text(`Diferencia: ${formatCurrency(trans.difference)}`, margin, yPosition);
              yPosition += 5;
            }
            if (trans.date) {
              doc.text(`Fecha: ${trans.date}`, margin, yPosition);
              yPosition += 5;
            }
            yPosition += 5;
          }

          // Línea separadora
          yPosition += 3;
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPosition, doc.internal.pageSize.width - margin, yPosition);
          yPosition += 8;
        });
      }

      // Recomendaciones Generales
      if (result.aiAnalysis.recommendations && result.aiAnalysis.recommendations.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Recomendaciones Generales', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        result.aiAnalysis.recommendations.forEach((rec: string, index: number) => {
          checkPageBreak(15);
          doc.setFont('helvetica', 'bold');
          doc.text(`${index + 1}.`, margin, yPosition);
          doc.setFont('helvetica', 'normal');
          const recLines = doc.splitTextToSize(rec, maxWidth - 10);
          recLines.forEach((line: string, lineIndex: number) => {
            doc.text(line, margin + 8, yPosition + (lineIndex * 5));
          });
          yPosition += recLines.length * 5 + 5;
        });
      }

      // Pie de página en cada página
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Página ${i} de ${totalPages} - Sistema de Conciliación Bancaria`,
          margin,
          pageHeight - 10
        );
      }

      // Guardar PDF
      const fileName = `analisis_desviaciones_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF. Por favor, intenta nuevamente.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Análisis de Desviaciones por IA
              </h2>
              <p className="text-sm text-white/90">
                Análisis experto de conciliación contable
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2
              ${
                generatingPDF
                  ? 'bg-white/20 text-white/70 cursor-not-allowed'
                  : 'bg-white text-purple-600 hover:bg-white/90 shadow-md hover:shadow-lg'
              }
            `}
          >
            {generatingPDF ? (
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
                Generando PDF...
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
                Descargar PDF
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Resumen Ejecutivo */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
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
            Resumen Ejecutivo
          </h3>
          <p className="text-gray-700 leading-relaxed mb-3">{summary}</p>
          {totalDifference !== undefined && (
            <div className="mt-3 pt-3 border-t border-blue-300">
              <p className="text-sm font-semibold text-gray-800">
                Diferencia Total Acumulada: <span className="text-blue-700">{formatCurrency(totalDifference)}</span>
              </p>
            </div>
          )}
        </div>

        {/* Desviaciones */}
        {deviations && deviations.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Desviaciones Identificadas ({deviations.length})
            </h3>
            <div className="space-y-4">
              {deviations.map((deviation, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-5 ${getSeverityColor(deviation.severity)}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getSeverityIcon(deviation.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded">
                          {deviation.severity === 'critical' && 'CRÍTICA'}
                          {deviation.severity === 'high' && 'ALTA'}
                          {deviation.severity === 'medium' && 'MEDIA'}
                          {deviation.severity === 'low' && 'BAJA'}
                        </span>
                        <span className="text-xs font-medium opacity-75">
                          {deviation.type === 'difference' && 'Diferencia en Valores'}
                          {deviation.type === 'unmatched' && 'Transacción No Conciliada'}
                          {deviation.type === 'unmatched_bank' && 'Transacción Banco Sin Coincidencia'}
                          {deviation.type === 'unmatched_erp' && 'Transaccion Contabilidad Sin Coincidencia'}
                          {deviation.type === 'distributed_payment' && 'Pago Distribuido (Banco ↔ Contabilidad)'}
                          {deviation.type === 'summary' && 'Resumen'}
                        </span>
                        {deviation.count !== undefined && (
                          <span className="text-xs font-medium opacity-75">
                            ({deviation.count} {deviation.count === 1 ? 'caso' : 'casos'})
                          </span>
                        )}
                      </div>
                      <p className="font-medium mb-2">{deviation.description}</p>
                      {deviation.possibleCauses && deviation.possibleCauses.length > 0 && (
                        <div className="mt-2 mb-3">
                          <p className="text-xs font-semibold mb-1">Posibles causas:</p>
                          <ul className="text-xs space-y-1">
                            {deviation.possibleCauses.map((cause, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-gray-500">•</span>
                                <span>{cause}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {deviation.groupTotal !== undefined && (
                        <div className="mt-2 mb-3 text-sm">
                          <span className="font-semibold">Total del grupo:</span>{' '}
                          <span className="font-mono">{formatCurrency(deviation.groupTotal)}</span>
                        </div>
                      )}
                      {deviation.details?.transaction && (
                        <div className="mt-3 pt-3 border-t border-current/20 text-sm space-y-1">
                          {deviation.details.transaction.bankValue !== undefined && (
                            <div>
                              <span className="font-medium">Valor Banco:</span>{' '}
                              {formatCurrency(deviation.details.transaction.bankValue)}
                            </div>
                          )}
                          {deviation.details.transaction.erpValue !== undefined && (
                            <div>
                              <span className="font-medium">Valor Contabilidad:</span>{' '}
                              {formatCurrency(deviation.details.transaction.erpValue)}
                            </div>
                          )}
                          {deviation.details.transaction.difference !== undefined && (
                            <div>
                              <span className="font-medium">Diferencia:</span>{' '}
                              {formatCurrency(deviation.details.transaction.difference)}
                            </div>
                          )}
                          {deviation.details.transaction.date && (
                            <div>
                              <span className="font-medium">Fecha:</span>{' '}
                              {deviation.details.transaction.date}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {deviation.recommendation && (
                    <div className="mt-3 pt-3 border-t border-current/20">
                      <p className="text-sm">
                        <span className="font-semibold">Recomendación:</span>{' '}
                        {deviation.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recomendaciones Generales */}
        {recommendations && recommendations.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600"
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
              Recomendaciones Generales
            </h3>
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-gray-700">
                  <span className="text-green-600 font-bold mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

