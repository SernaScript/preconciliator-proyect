import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface BankTransaction {
  cuenta: string;
  iniciales: string;
  fecha: Date;
  valor: number;
  codigo: string;
  descripcion: string;
  originalIndex: number;
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
 * Formato: cuenta, iniciales, , fecha(YYYYMMDD), , valor, código, descripción, verificado
 * Posiciones: [0]=cuenta, [1]=iniciales, [3]=fecha, [5]=valor, [6]=código, [7]=descripción
 */
export async function parseCSV(file: File): Promise<BankTransaction[]> {
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
            
            results.data.forEach((row: any, index: number) => {
              if (!Array.isArray(row) || row.length < 8) {
                return; // Saltar filas inválidas
              }

              const cuenta = String(row[0] || '').trim();
              const iniciales = String(row[1] || '').trim();
              const fechaStr = String(row[3] || '').trim();
              const valorStr = String(row[5] || '').trim();
              const codigo = String(row[6] || '').trim();
              const descripcion = String(row[7] || '').trim();

              // Validar que tengamos los campos esenciales
              if (!fechaStr || !valorStr) {
                return;
              }

              // Parsear fecha YYYYMMDD
              let fecha: Date;
              try {
                const year = parseInt(fechaStr.substring(0, 4));
                const month = parseInt(fechaStr.substring(4, 6)) - 1; // Mes es 0-indexed
                const day = parseInt(fechaStr.substring(6, 8));
                fecha = new Date(year, month, day);
                
                if (isNaN(fecha.getTime())) {
                  return; // Fecha inválida
                }
              } catch {
                return; // Error al parsear fecha
              }

              // Parsear valor
              const valor = parseFloat(valorStr.replace(/,/g, ''));
              if (isNaN(valor)) {
                return; // Valor inválido
              }

              transactions.push({
                cuenta,
                iniciales,
                fecha,
                valor,
                codigo,
                descripcion,
                originalIndex: index,
              });
            });

            resolve(transactions);
          } catch (error) {
            const errorMessage = `Error al parsear CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`;
            console.error(errorMessage, error);
            reject(new Error(errorMessage));
          }
        },
        error: (error) => {
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
      const dataRow = row.map(cell => {
        // Si la celda es un objeto (fecha de Excel), convertirla
        if (cell && typeof cell === 'object') {
          // Intentar obtener el valor como string
          return String(cell.w || cell.v || cell || '').trim();
        }
        return String(cell || '').trim();
      });
      
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
      const fechaElaboracionStr = dataRow[4]?.trim() || '';
      const comprobante = dataRow[2]?.trim() || '';
      const nombreTercero = dataRow[7]?.trim() || '';
      const debitoStr = dataRow[12]?.trim() || '0';
      const creditoStr = dataRow[13]?.trim() || '0';
      
      // Validar campos esenciales
      if (!fechaElaboracionStr) {
        rowsWithErrors++;
        if (rowsWithErrors <= 3) {
          errors.push(`Fila ${i + 1}: Falta la fecha de elaboración (columna 5).`);
        }
        continue;
      }
      
      // Parsear fecha (puede venir en varios formatos)
      let fechaElaboracion: Date;
      try {
        // Intentar parsear como fecha
        const fechaParsed = new Date(fechaElaboracionStr);
        if (!isNaN(fechaParsed.getTime())) {
          fechaElaboracion = fechaParsed;
        } else {
          // Intentar formato YYYYMMDD
          if (fechaElaboracionStr.length === 8 && /^\d+$/.test(fechaElaboracionStr)) {
            const year = parseInt(fechaElaboracionStr.substring(0, 4));
            const month = parseInt(fechaElaboracionStr.substring(4, 6)) - 1;
            const day = parseInt(fechaElaboracionStr.substring(6, 8));
            fechaElaboracion = new Date(year, month, day);
          } else {
            rowsWithInvalidDate++;
            if (rowsWithInvalidDate <= 3) {
              errors.push(`Fila ${i + 1}: Fecha inválida "${fechaElaboracionStr}". Se espera formato de fecha válido o YYYYMMDD.`);
            }
            continue; // Fecha inválida
          }
        }
      } catch {
        rowsWithInvalidDate++;
        if (rowsWithInvalidDate <= 3) {
          errors.push(`Fila ${i + 1}: Error al parsear la fecha "${fechaElaboracionStr}".`);
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

