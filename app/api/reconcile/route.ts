import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, parseExcel, parseExcelBank, BankType } from '@/app/lib/fileParser';
import { reconcile, ReconciliationResult } from '@/app/lib/reconciliation';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const csvFile = formData.get('csvFile') as File;
    const excelFile = formData.get('excelFile') as File;
    const useDate = formData.get('useDate') === 'true';
    const tolerance = parseFloat(formData.get('tolerance') as string) || 0;
    const bankType = (formData.get('bankType') as BankType) || 'bancolombia';
    
    if (!csvFile || !excelFile) {
      const error = 'Se requieren ambos archivos (CSV y Excel)';
      console.error(error);
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }
    
    // Validar tipos de archivo según el banco
    const bankFileName = csvFile.name.toLowerCase();
    let isValidBankFile = false;
    let bankFileError = '';
    
    if (bankType === 'davivienda' || bankType === 'banco_occidente') {
      // Davivienda y Banco de Occidente usan Excel
      isValidBankFile = bankFileName.endsWith('.xlsx') || bankFileName.endsWith('.xls');
      bankFileError = `El archivo del extracto bancario de ${bankType === 'davivienda' ? 'Davivienda' : 'Banco de Occidente'} debe ser Excel (.xlsx o .xls)`;
    } else if (bankType === 'banco_bogota') {
      // Banco de Bogotá usa CSV o TXT
      isValidBankFile = bankFileName.endsWith('.csv') || bankFileName.endsWith('.txt');
      bankFileError = 'El archivo del extracto bancario debe ser CSV o TXT';
    } else {
      // Otros bancos usan CSV
      isValidBankFile = bankFileName.endsWith('.csv');
      bankFileError = 'El archivo del extracto bancario debe ser CSV';
    }
    
    if (!isValidBankFile) {
      console.error(bankFileError);
      return NextResponse.json(
        { error: bankFileError },
        { status: 400 }
      );
    }
    
    if (!excelFile.name.match(/\.(xlsx|xls)$/i)) {
      const error = 'El archivo del ERP debe ser Excel (.xlsx o .xls)';
      console.error(error);
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }
    
    // Parsear archivos
    let bankTransactions;
    let erpTransactions;
    
    try {
      // Davivienda y Banco de Occidente usan Excel, los demás usan CSV
      if (bankType === 'davivienda' || bankType === 'banco_occidente') {
        bankTransactions = await parseExcelBank(csvFile, bankType);
      } else {
        bankTransactions = await parseCSV(csvFile, bankType);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al procesar archivo del banco';
      console.error('Error al parsear archivo del banco:', errorMsg);
      const fileType = (bankType === 'davivienda' || bankType === 'banco_occidente') ? 'Excel' : 'CSV';
      return NextResponse.json(
        { error: `Error en archivo ${fileType} del banco: ${errorMsg}` },
        { status: 400 }
      );
    }
    
    try {
      erpTransactions = await parseExcel(excelFile);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al procesar Excel';
      console.error('Error al parsear Excel:', errorMsg);
      return NextResponse.json(
        { error: `Error en archivo Excel: ${errorMsg}` },
        { status: 400 }
      );
    }
    
    if (bankTransactions.length === 0) {
      const fileType = (bankType === 'davivienda' || bankType === 'banco_occidente') ? 'Excel' : 'CSV';
      const error = `No se encontraron transacciones válidas en el archivo ${fileType} del banco`;
      console.error(error);
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }
    
    if (erpTransactions.length === 0) {
      const error = 'No se encontraron transacciones válidas en el archivo Excel';
      console.error(error);
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }
    
    // Ejecutar conciliación
    const result: ReconciliationResult = reconcile(
      bankTransactions,
      erpTransactions,
      useDate,
      tolerance,
      bankType
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en conciliación:', error);
    return NextResponse.json(
      { 
        error: 'Error al procesar la conciliación',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

