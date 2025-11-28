import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type BankType = 'bancolombia' | 'banco_occidente' | 'banco_bogota' | 'davivienda';

export interface BankTransaction {
  cuenta: string;
  iniciales: string;
  fecha: Date;
  valor: number;
  codigo: string;
  descripcion: string;
  originalIndex: number;
  isBankExpense?: boolean; // Indica si es un gasto bancario
}

// Lista de conceptos de gastos bancarios
export const BANK_EXPENSE_CONCEPTS = [
  'ABONO INTERESES AHORROS',
  'COBRO IVA PAGOS AUTOMATICOS',
  'COMIS TRASLADO EN SUCURSAL',
  'CUOTA MANEJO CUPO ROTATIVO',
  'CUOTA PLAN CANAL NEGOCIOS',
  'CXC IMPTO GOBIERNO 4X1000 MON',
  'IMPTO GOBIERNO 4X1000',
  'IVA CUOTA MANEJO CUPO ROTATIVO',
  'IVA CUOTA PLAN CANAL NEGOCIOS',
  'PAGO CXC DESDE CTA 39900001230',
  'SERVICIO PAGO A OTROS BANCOS',
  'SERVICIO PAGO A PROVEEDORES',
  'VALOR IVA',
];

/**
 * Verifica si una transacción bancaria es un gasto bancario
 * basándose en la descripción
 */
export function isBankExpense(transaction: BankTransaction): boolean {
  const descripcion = transaction.descripcion.toUpperCase().trim();
  return BANK_EXPENSE_CONCEPTS.some(concept => descripcion.includes(concept));
}

export interface ERPTransaction {
  fechaElaboracion: Date;
  comprobante: string;
  nombreTercero: string;
  debito: number;
  credito: number;
  valor: number; // Calculado: Débito - Crédito
  originalIndex: number;
}

/**
 * Parsea un archivo CSV del extracto bancario
 * Formato Bancolombia: cuenta, iniciales, , fecha(YYYYMMDD), , valor, código, descripción, verificado
 * Posiciones: [0]=cuenta, [1]=iniciales, [3]=fecha, [5]=valor, [6]=código, [7]=descripción
 */
export async function parseCSV(file: File, bankType: BankType = 'bancolombia'): Promise<BankTransaction[]> {
  try {
    // Convertir File a texto para usar en Node.js
    const text = await file.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions: BankTransaction[] = [];
            
            // Seleccionar el parser según el banco
            const parseRow = getBankParser(bankType);
            
            results.data.forEach((row: any, index: number) => {
              const transaction = parseRow(row, index);
              if (transaction) {
                transactions.push(transaction);
              }
            });

            resolve(transactions);
          } catch (error) {
            const errorMessage = `Error al parsear CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`;
            console.error(errorMessage, error);
            reject(new Error(errorMessage));
          }
        },
        error: (error: Error) => {
          const errorMessage = `Error al leer CSV: ${error.message}`;
          console.error(errorMessage, error);
          reject(new Error(errorMessage));
        },
      });
    });
  } catch (error) {
    const errorMessage = `Error al leer archivo CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}

/**
 * Obtiene el parser específico para cada banco
 */
function getBankParser(bankType: BankType) {
  switch (bankType) {
    case 'bancolombia':
      return parseBancolombiaRow;
    case 'banco_occidente':
      return parseBancoOccidenteRow;
    case 'banco_bogota':
      return parseBancoBogotaRow;
    case 'davivienda':
      return parseDaviviendaRow;
    default:
      return parseBancolombiaRow;
  }
}

/**
 * Parsea una fila del formato Bancolombia
 * Formato: cuenta, iniciales, , fecha(YYYYMMDD), , valor, código, descripción, verificado
 * Posiciones: [0]=cuenta, [1]=iniciales, [3]=fecha, [5]=valor, [6]=código, [7]=descripción
 */
function parseBancolombiaRow(row: any, index: number): BankTransaction | null {
  if (!Array.isArray(row) || row.length < 8) {
    return null; // Saltar filas inválidas
  }

  const cuenta = String(row[0] || '').trim();
  const iniciales = String(row[1] || '').trim();
  const fechaStr = String(row[3] || '').trim();
  const valorStr = String(row[5] || '').trim();
  const codigo = String(row[6] || '').trim();
  const descripcion = String(row[7] || '').trim();

  // Validar que tengamos los campos esenciales
  if (!fechaStr || !valorStr) {
    return null;
  }

  // Parsear fecha YYYYMMDD
  let fecha: Date;
  try {
    const year = parseInt(fechaStr.substring(0, 4));
    const month = parseInt(fechaStr.substring(4, 6)) - 1; // Mes es 0-indexed
    const day = parseInt(fechaStr.substring(6, 8));
    fecha = new Date(year, month, day);
    
    if (isNaN(fecha.getTime())) {
      return null; // Fecha inválida
    }
  } catch {
    return null; // Error al parsear fecha
  }

  // Parsear valor
  const valor = parseFloat(valorStr.replace(/,/g, ''));
  if (isNaN(valor)) {
    return null; // Valor inválido
  }

  const transaction: BankTransaction = {
    cuenta,
    iniciales,
    fecha,
    valor,
    codigo,
    descripcion,
    originalIndex: index,
  };
  
  // Marcar si es un gasto bancario
  transaction.isBankExpense = isBankExpense(transaction);
  
  return transaction;
}

/**
 * Parsea una fila del formato Banco de Occidente
 * TODO: Implementar cuando se conozca el formato específico
 */
function parseBancoOccidenteRow(row: any, index: number): BankTransaction | null {
  // Por ahora, usar el mismo formato que Bancolombia
  // TODO: Ajustar según el formato real del Banco de Occidente
  return parseBancolombiaRow(row, index);
}

/**
 * Parsea una fila del formato Banco de Bogotá
 * TODO: Implementar cuando se conozca el formato específico
 */
function parseBancoBogotaRow(row: any, index: number): BankTransaction | null {
  // Por ahora, usar el mismo formato que Bancolombia
  // TODO: Ajustar según el formato real del Banco de Bogotá
  return parseBancolombiaRow(row, index);
}

/**
 * Parsea una fila del formato Davivienda
 * TODO: Implementar cuando se conozca el formato específico
 */
function parseDaviviendaRow(row: any, index: number): BankTransaction | null {
  // Por ahora, usar el mismo formato que Bancolombia
  // TODO: Ajustar según el formato real de Davivienda
  return parseBancolombiaRow(row, index);
}

/**
 * Parsea un archivo Excel del ERP
 * Columnas separadas por "/": "Código contable/Cuenta contable/Comprobante/Secuencia/Fecha elaboración/Identificación/Sucursal/Nombre del tercero/Descripción/Detalle/Centro de costo/Saldo inicial/Débito/Crédito/Saldo Movimiento/Saldo total cuenta"
 * Extrae: Fecha elaboración (índice 4), Comprobante (índice 2), Nombre del tercero (índice 7), Débito (índice 12), Crédito (índice 13)
 * Calcula: Valor = Débito - Crédito
 */
export async function parseExcel(file: File): Promise<ERPTransaction[]> {
  const errors: string[] = [];
  
  try {
    // Convertir File a ArrayBuffer para usar en Node.js
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (error) {
      const errorMsg = 'No se pudo leer el archivo Excel. Verifica que el archivo no esté corrupto.';
      console.error(errorMsg, error);
      throw new Error(errorMsg);
    }
    
    const data = new Uint8Array(arrayBuffer);
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(data, { type: 'array' });
    } catch (error) {
      const errorMsg = 'El archivo Excel no es válido o está corrupto. Verifica que sea un archivo .xlsx o .xls válido.';
      console.error(errorMsg, error);
      throw new Error(errorMsg);
    }
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      const errorMsg = 'El archivo Excel no contiene hojas. Verifica que el archivo tenga al menos una hoja con datos.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Obtener la primera hoja
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    if (!worksheet) {
      const errorMsg = `No se pudo leer la hoja "${firstSheetName}". Verifica que la hoja contenga datos.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Convertir a JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    if (!jsonData || jsonData.length === 0) {
      const errorMsg = 'El archivo Excel está vacío. Verifica que contenga datos.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const transactions: ERPTransaction[] = [];
    
    // Buscar la fila de encabezados
    let headerRowIndex = -1;
    let headerRowContent = '';
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (Array.isArray(row) && row.length > 0) {
        const firstCell = String(row[0] || '').trim();
        if (firstCell.includes('/') || firstCell.includes('Código contable')) {
          headerRowIndex = i;
          headerRowContent = firstCell;
          break;
        }
      }
    }
    
    if (headerRowIndex === -1) {
      const errorMsg = `No se encontró la fila de encabezados en el archivo Excel. Se esperaba encontrar una fila que contenga "/" o "Código contable" en las primeras 10 filas. Verifica que el formato del archivo sea correcto.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Obtener los encabezados para entender la estructura
    const headerRow = jsonData[headerRowIndex] as any[];
    let headerColumns: string[] = [];
    
    // Si el encabezado está en una celda con "/", dividirlo
    if (Array.isArray(headerRow) && headerRow.length > 0) {
      const firstHeaderCell = String(headerRow[0] || '').trim();
      if (firstHeaderCell.includes('/')) {
        headerColumns = firstHeaderCell.split('/').map(s => s.trim());
      } else {
        // Si no está en una celda, usar todas las celdas de la fila
        headerColumns = headerRow.map(cell => String(cell || '').trim());
      }
    }
    
    console.log('Encabezados encontrados:', headerColumns);
    console.log('Número de columnas en encabezado:', headerColumns.length);
    
    // Procesar filas de datos (empezar después de los encabezados)
    let rowsWithErrors = 0;
    let rowsWithInsufficientColumns = 0;
    let rowsWithInvalidDate = 0;
    
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!Array.isArray(row) || row.length === 0) {
        continue;
      }
      
      // Leer todas las columnas de la fila directamente
      // Cada columna del Excel corresponde a una posición en el array
      const dataRow: (string | Date)[] = [];
      
      for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
        const cell = row[cellIndex];
        
        // Si es la columna de fecha (índice 4), manejar especialmente
        if (cellIndex === 4) {
          // Si es un número serial de Excel (fecha), convertirla
          if (typeof cell === 'number') {
            // Excel almacena fechas como números seriales desde 1900-01-01
            const excelEpoch = new Date(1899, 11, 30); // 30 de diciembre de 1899
            const date = new Date(excelEpoch.getTime() + cell * 86400000);
            if (!isNaN(date.getTime())) {
              dataRow.push(date); // Guardar como Date para parsear después
              continue;
            }
          }
          // Si es un objeto Date
          if (cell instanceof Date) {
            dataRow.push(cell);
            continue;
          }
        }
        
        // Si la celda es un objeto, intentar obtener el valor como string
        if (cell && typeof cell === 'object' && !(cell instanceof Date)) {
          dataRow.push(String(cell.w || cell.v || cell || '').trim());
        } else {
          dataRow.push(String(cell || '').trim());
        }
      }
      
      // Validar que tengamos suficientes columnas
      if (dataRow.length < 14) {
        rowsWithInsufficientColumns++;
        if (rowsWithInsufficientColumns <= 3) {
          errors.push(`Fila ${i + 1}: Insuficientes columnas (se encontraron ${dataRow.length}, se esperaban al menos 14). Verifica el formato de la fila.`);
        }
        continue;
      }
      
      // Extraer las columnas según los índices esperados
      // Índices: 0=Código contable, 1=Cuenta contable, 2=Comprobante, 3=Secuencia, 4=Fecha elaboración, 
      // 5=Identificación, 6=Sucursal, 7=Nombre del tercero, 8=Descripción, 9=Detalle, 
      // 10=Centro de costo, 11=Saldo inicial, 12=Débito, 13=Crédito, 14=Saldo Movimiento, 15=Saldo total cuenta
      const fechaElaboracionValue = dataRow[4];
      const comprobante = String(dataRow[2] || '').trim();
      const nombreTercero = String(dataRow[7] || '').trim();
      const debitoStr = String(dataRow[12] || '0').trim();
      const creditoStr = String(dataRow[13] || '0').trim();
      
      // Validar campos esenciales
      if (!fechaElaboracionValue) {
        rowsWithErrors++;
        if (rowsWithErrors <= 3) {
          errors.push(`Fila ${i + 1}: Falta la fecha de elaboración (columna 5).`);
        }
        continue;
      }
      
      // Parsear fecha (formato esperado: dd/mm/yyyy o Date object)
      let fechaElaboracion: Date;
      try {
        // Si ya es un objeto Date, usarlo directamente
        if (fechaElaboracionValue instanceof Date) {
          fechaElaboracion = fechaElaboracionValue;
        } else {
          // Convertir a string para parsear
          const fechaElaboracionStr = String(fechaElaboracionValue).trim();
          
          // Primero intentar parsear formato dd/mm/yyyy
          const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
          const match = fechaElaboracionStr.match(datePattern);
          
          if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // Mes es 0-indexed en JavaScript
            const year = parseInt(match[3], 10);
            fechaElaboracion = new Date(year, month, day);
            
            // Validar que la fecha sea válida
            if (isNaN(fechaElaboracion.getTime()) || 
                fechaElaboracion.getDate() !== day || 
                fechaElaboracion.getMonth() !== month || 
                fechaElaboracion.getFullYear() !== year) {
              throw new Error('Fecha inválida');
            }
          } else {
            // Si no coincide con dd/mm/yyyy, intentar otros formatos
            // Intentar parsear como fecha estándar
            const fechaParsed = new Date(fechaElaboracionStr);
            if (!isNaN(fechaParsed.getTime())) {
              fechaElaboracion = fechaParsed;
            } else {
              // Intentar formato YYYYMMDD como último recurso
              if (fechaElaboracionStr.length === 8 && /^\d+$/.test(fechaElaboracionStr)) {
                const year = parseInt(fechaElaboracionStr.substring(0, 4));
                const month = parseInt(fechaElaboracionStr.substring(4, 6)) - 1;
                const day = parseInt(fechaElaboracionStr.substring(6, 8));
                fechaElaboracion = new Date(year, month, day);
              } else {
                throw new Error('Formato de fecha no reconocido');
              }
            }
          }
        }
      } catch (error) {
        rowsWithInvalidDate++;
        if (rowsWithInvalidDate <= 3) {
          const fechaStr = fechaElaboracionValue instanceof Date 
            ? fechaElaboracionValue.toLocaleDateString('es-ES')
            : String(fechaElaboracionValue);
          errors.push(`Fila ${i + 1}: Fecha inválida "${fechaStr}". Se espera formato dd/mm/yyyy.`);
        }
        continue; // Error al parsear fecha
      }
      
      // Parsear Débito y Crédito
      const debito = parseFloat(String(debitoStr).replace(/,/g, '')) || 0;
      const credito = parseFloat(String(creditoStr).replace(/,/g, '')) || 0;
      
      // Calcular Valor = Débito - Crédito
      const valor = debito - credito;
      
      transactions.push({
        fechaElaboracion,
        comprobante,
        nombreTercero,
        debito,
        credito,
        valor,
        originalIndex: i,
      });
    }
    
    // Agregar resumen de errores si hay muchos
    if (rowsWithInsufficientColumns > 3) {
      errors.push(`... y ${rowsWithInsufficientColumns - 3} filas más con columnas insuficientes.`);
    }
    if (rowsWithInvalidDate > 3) {
      errors.push(`... y ${rowsWithInvalidDate - 3} filas más con fechas inválidas.`);
    }
    if (rowsWithErrors > 3) {
      errors.push(`... y ${rowsWithErrors - 3} filas más sin fecha de elaboración.`);
    }
    
    // Si no se encontraron transacciones válidas, lanzar error con detalles
    if (transactions.length === 0) {
      let errorMsg = 'No se encontraron transacciones válidas en el archivo Excel.';
      if (errors.length > 0) {
        errorMsg += '\n\nErrores encontrados:\n' + errors.slice(0, 5).join('\n');
        if (errors.length > 5) {
          errorMsg += `\n... y ${errors.length - 5} errores más.`;
        }
      } else {
        errorMsg += ' Verifica que el archivo tenga el formato correcto con columnas separadas por "/".';
      }
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Si hay errores pero se encontraron algunas transacciones, solo mostrar advertencias
    if (errors.length > 0) {
      console.warn('Advertencias al procesar Excel:', errors);
    }
    
    return transactions;
  } catch (error) {
    const errorMessage = `Error al parsear Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}

