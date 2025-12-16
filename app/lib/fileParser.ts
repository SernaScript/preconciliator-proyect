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

// Lista de conceptos de gastos bancarios por banco
export const BANK_EXPENSE_CONCEPTS: Record<BankType, string[]> = {
  bancolombia: [
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
  ],
  banco_occidente: [
    'IVA COBRADO',
    'GMF',
    'COMISION', // Cualquier descripción que incluya la palabra "COMISION"
  ],
  banco_bogota: [
    'Comision transferencia canal electronico',
    'Gravamen Movimientos Financieros',
    'Cargo IVA',
    'Comision dispersion pago de nomina',
    'Intereses por sobregiro',
    'Recobro de Comision',
    'Comision dispersion'
    
  ],
  davivienda: [
    'Gmf Gravamen Mvto Financiero - Nota Débito',
    'Pagos Servicios Corporativos - Nota Débito',
    'Intereses De Sobregiro - Nota Débito',
    "Cobro IVA Servicios Financieros - Nota Débito",
    "Cobro Servicio Manejo Portal - Nota Débito"
  ],
};

/**
 * Verifica si una transacción bancaria es un gasto bancario
 * basándose en la descripción y el banco
 */
export function isBankExpense(transaction: BankTransaction, bankType: BankType = 'bancolombia'): boolean {
  const descripcion = transaction.descripcion.toUpperCase().trim();
  const concepts = BANK_EXPENSE_CONCEPTS[bankType] || BANK_EXPENSE_CONCEPTS.bancolombia;
  
  // Para Banco de Occidente, también verificar si contiene "COMISION"
  if (bankType === 'banco_occidente') {
    if (descripcion.includes('COMISION')) {
      return true;
    }
  }
  
  return concepts.some(concept => descripcion.includes(concept.toUpperCase()));
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
    
    // Banco de Bogotá usa encabezados, los demás no
    const hasHeaders = bankType === 'banco_bogota';
    // Banco de Occidente comienza en la fila 7 (índice 6)
    const startRow = bankType === 'banco_occidente' ? 6 : 0;
    
    console.log('=== INICIO PARSE CSV ===');
    console.log('Banco seleccionado:', bankType);
    console.log('Usa encabezados:', hasHeaders);
    console.log('Fila de inicio:', startRow === 0 ? 'Desde el inicio' : `Fila ${startRow + 1}`);
    console.log('Tamaño del archivo:', text.length, 'caracteres');
    console.log('Primeras 500 caracteres del archivo:', text.substring(0, 500));
    
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: hasHeaders,
        skipEmptyLines: true,
        delimiter: ',', // Forzar delimitador de coma
        quoteChar: '"', // Caracter de comillas
        escapeChar: '"', // Caracter de escape
        transformHeader: hasHeaders ? (header: string) => {
          // Normalizar nombres de encabezados: eliminar espacios y normalizar
          return header.trim().replace(/\s+/g, ' ');
        } : undefined,
        complete: (results) => {
          try {
            console.log('=== RESULTADOS DEL PARSING ===');
            console.log('Total de filas parseadas:', results.data.length);
            console.log('Errores de parsing:', results.errors);
            
            if (hasHeaders && results.data.length > 0) {
              console.log('Primera fila (con encabezados):', results.data[0]);
              console.log('Claves de la primera fila:', Object.keys(results.data[0] || {}));
              console.log('Meta información (encabezados detectados):', results.meta);
              if (results.meta && results.meta.fields) {
                console.log('Nombres de columnas detectados por Papa.parse:', results.meta.fields);
              }
              // Mostrar todos los valores de la primera fila
              const firstRow = results.data[0] as any;
              if (firstRow) {
                console.log('Valores de la primera fila:');
                Object.keys(firstRow).forEach(key => {
                  console.log(`  "${key}": "${firstRow[key]}"`);
                });
              }
            } else if (!hasHeaders && results.data.length > 0) {
              console.log('Primera fila (sin encabezados):', results.data[0]);
            }
            
            const transactions: BankTransaction[] = [];
            let rowsProcessed = 0;
            let rowsRejected = 0;
            
            // Seleccionar el parser según el banco
            const parseRow = getBankParser(bankType);
            
            if (hasHeaders) {
              // Para formato con encabezados (Banco de Bogotá)
              results.data.forEach((row: any, index: number) => {
                rowsProcessed++;
                if (index < 3) {
                  console.log(`Fila ${index + 1}:`, row);
                }
                const transaction = parseRow(row, index);
                if (transaction) {
                  transactions.push(transaction);
                } else {
                  rowsRejected++;
                  if (rowsRejected <= 5) {
                    console.log(`Fila ${index + 1} rechazada:`, row);
                  }
                }
              });
            } else {
              // Para formato sin encabezados (Bancolombia, Banco de Occidente, etc.)
              results.data.forEach((row: any, index: number) => {
                // Para Banco de Occidente, saltar las primeras 6 filas (índices 0-5)
                if (bankType === 'banco_occidente' && index < startRow) {
                  return; // Saltar esta fila
                }
                
                rowsProcessed++;
                // Ajustar el índice para Banco de Occidente (restar las filas saltadas)
                const adjustedIndex = bankType === 'banco_occidente' ? index - startRow : index;
                const transaction = parseRow(row, adjustedIndex);
                if (transaction) {
                  transactions.push(transaction);
                } else {
                  rowsRejected++;
                  if (rowsRejected <= 5 && bankType === 'banco_occidente') {
                    console.log(`Fila ${index + 1} (ajustada: ${adjustedIndex + 1}) rechazada:`, row);
                  }
                }
              });
            }

            console.log('=== RESUMEN ===');
            console.log('Filas procesadas:', rowsProcessed);
            console.log('Filas rechazadas:', rowsRejected);
            console.log('Transacciones válidas:', transactions.length);
            
            if (transactions.length === 0) {
              let errorMsg = '⚠️ No se encontraron transacciones válidas';
              if (hasHeaders && results.data.length > 0) {
                errorMsg += '\n\nEjemplo de fila rechazada:';
                console.error(errorMsg, results.data[0]);
                if (results.meta && results.meta.fields) {
                  console.error('Encabezados detectados:', results.meta.fields);
                }
              } else if (!hasHeaders && results.data.length > 0) {
                console.error(errorMsg);
                console.error('Primera fila (sin encabezados):', results.data[0]);
              }
              
              // Lanzar error más descriptivo
              const detailedError = `No se encontraron transacciones válidas en el archivo. Se procesaron ${rowsProcessed} filas pero todas fueron rechazadas. Verifica que el archivo tenga el formato correcto.`;
              reject(new Error(detailedError));
              return;
            }

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
 * Retorna una función que recibe (row, index, bankType)
 */
function getBankParser(bankType: BankType) {
  switch (bankType) {
    case 'bancolombia':
      return (row: any, index: number) => parseBancolombiaRow(row, index, bankType);
    case 'banco_occidente':
      return (row: any, index: number) => parseBancoOccidenteRow(row, index, bankType);
    case 'banco_bogota':
      return (row: any, index: number) => parseBancoBogotaRow(row, index, bankType);
    case 'davivienda':
      return (row: any, index: number) => parseDaviviendaRow(row, index, bankType);
    default:
      return (row: any, index: number) => parseBancolombiaRow(row, index, bankType);
  }
}

/**
 * Parsea una fila del formato Bancolombia
 * Formato: cuenta, iniciales, , fecha(YYYYMMDD), , valor, código, descripción, verificado
 * Posiciones: [0]=cuenta, [1]=iniciales, [3]=fecha, [5]=valor, [6]=código, [7]=descripción
 */
function parseBancolombiaRow(row: any, index: number, bankType: BankType = 'bancolombia'): BankTransaction | null {
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
  transaction.isBankExpense = isBankExpense(transaction, bankType);
  
  return transaction;
}

/**
 * Parsea una fila del formato Banco de Occidente
 * Formato: Los datos comienzan en la fila 7 (índice 6)
 * Columnas por posición (11 columnas totales):
 * - Columna 1 (índice 0): Fecha en formato yyyy/mm/dd
 * - Columna 3 (índice 2): Nombre de transacción
 * - Columna 4 (índice 3): Número de documento
 * - Columna 5 (índice 4): Débito (string con formato "$ 111.827,59")
 * - Columna 6 (índice 5): Crédito (string con formato "$ 111.827,59")
 * Calcula: Valor = Débito - Crédito
 */
function parseBancoOccidenteRow(row: any, index: number, bankType: BankType = 'banco_occidente'): BankTransaction | null {
  // Validar que row sea un array con al menos 6 columnas
  if (!Array.isArray(row) || row.length < 6) {
    if (index < 3) {
      console.log(`[Banco Occidente] Fila ${index + 1}: Row inválido o insuficientes columnas (${row.length} encontradas, se esperaban al menos 6)`);
    }
    return null; // Saltar filas inválidas
  }

  // Extraer valores por posición (índices)
  const fechaStr = String(row[0] || '').trim(); // Columna 1 (índice 0): Fecha
  const nombreTransaccion = String(row[2] || '').trim(); // Columna 3 (índice 2): Nombre de transacción
  const numeroDocumento = String(row[3] || '').trim(); // Columna 4 (índice 3): Número de documento
  const debitoStr = String(row[4] || '').trim(); // Columna 5 (índice 4): Débito
  const creditoStr = String(row[5] || '').trim(); // Columna 6 (índice 5): Crédito

  if (index < 3) {
    console.log(`[Banco Occidente] Fila ${index + 1} - Valores extraídos:`, {
      fechaStr,
      nombreTransaccion,
      numeroDocumento,
      debitoStr,
      creditoStr
    });
  }

  // Validar que tengamos los campos esenciales
  if (!fechaStr) {
    if (index < 3) {
      console.log(`[Banco Occidente] Fila ${index + 1} rechazada: Fecha vacía`);
    }
    return null;
  }

  // Parsear fecha (formato yyyy/mm/dd)
  let fecha: Date;
  try {
    const fechaStrClean = fechaStr.replace(/['"]/g, '').trim(); // Eliminar comillas si las hay
    
    if (index < 3) {
      console.log(`[Banco Occidente] Fila ${index + 1} - Parseando fecha: "${fechaStrClean}"`);
    }
    
    // Formato yyyy/mm/dd
    const datePattern = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
    const match = fechaStrClean.match(datePattern);
    
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Mes es 0-indexed
      const day = parseInt(match[3], 10);
      fecha = new Date(year, month, day);
      
      // Validar que la fecha sea válida
      if (isNaN(fecha.getTime()) || 
          fecha.getDate() !== day || 
          fecha.getMonth() !== month || 
          fecha.getFullYear() !== year) {
        throw new Error('Fecha inválida');
      }
      
      if (index < 3) {
        console.log(`[Banco Occidente] Fila ${index + 1} - Fecha parseada (yyyy/mm/dd):`, fecha);
      }
    } else {
      // Intentar parsear como fecha estándar
      fecha = new Date(fechaStrClean);
      if (isNaN(fecha.getTime())) {
        throw new Error('Formato de fecha no reconocido');
      }
      if (index < 3) {
        console.log(`[Banco Occidente] Fila ${index + 1} - Fecha parseada (estándar):`, fecha);
      }
    }
  } catch (error) {
    if (index < 3) {
      console.log(`[Banco Occidente] Fila ${index + 1} rechazada: Error al parsear fecha "${fechaStr}":`, error);
    }
    return null; // Error al parsear fecha
  }

  // Función auxiliar para limpiar y parsear valores monetarios
  // Formato: "$ 111.827,59" donde punto es miles y coma es decimal
  const parseMonetaryValue = (valueStr: string): number => {
    if (!valueStr || valueStr.trim() === '') {
      return 0;
    }
    
    // Limpiar el valor: eliminar espacios, signos de peso ($), puntos (miles) y convertir coma (decimal) a punto
    let cleaned = valueStr.trim();
    
    // Eliminar espacios
    cleaned = cleaned.replace(/\s+/g, '');
    
    // Eliminar signos de peso ($)
    cleaned = cleaned.replace(/\$/g, '');
    
    // Eliminar puntos (separadores de miles)
    cleaned = cleaned.replace(/\./g, '');
    
    // Reemplazar coma (separador decimal) por punto para parseFloat
    cleaned = cleaned.replace(/,/g, '.');
    
    // Parsear el valor
    const parsed = parseFloat(cleaned) || 0;
    
    if (index < 3) {
      console.log(`[Banco Occidente] Fila ${index + 1} - Valor original: "${valueStr}", Limpiado: "${cleaned}", Parseado: ${parsed}`);
    }
    
    return parsed;
  };

  // Parsear Débito y Crédito
  const debito = parseMonetaryValue(debitoStr);
  const credito = parseMonetaryValue(creditoStr);

  if (index < 3) {
    console.log(`[Banco Occidente] Fila ${index + 1} - Débito: ${debito}, Crédito: ${credito}`);
  }

  // Calcular Valor = Débito - Crédito
  const valor = debito - credito;

  // Validar que al menos uno de los valores (débito o crédito) sea diferente de cero
  if (debito === 0 && credito === 0) {
    if (index < 3) {
      console.log(`[Banco Occidente] Fila ${index + 1} rechazada: Transacción sin valor (débito y crédito en 0)`);
    }
    return null; // Transacción sin valor
  }

  if (index < 3) {
    console.log(`[Banco Occidente] Fila ${index + 1} - Valor calculado: ${valor}`);
  }

  const transaction: BankTransaction = {
    cuenta: '', // No disponible en este formato
    iniciales: '', // No disponible en este formato
    fecha,
    valor,
    codigo: numeroDocumento || '', // Usar número de documento como código
    descripcion: nombreTransaccion || 'Sin descripción', // Usar nombre de transacción como descripción
    originalIndex: index,
  };
  
  // Marcar si es un gasto bancario
  transaction.isBankExpense = isBankExpense(transaction, bankType);
  
  return transaction;
}

/**
 * Parsea una fila del formato Banco de Bogotá
 * Formato CSV/TXT con encabezados: "Fecha", "Transacción", "Oficina", "Documento", "Débito", "Crédito"
 * Calcula: Valor = Débito - Crédito
 */
function parseBancoBogotaRow(row: any, index: number, bankType: BankType = 'banco_bogota'): BankTransaction | null {
  // El row es un objeto con las propiedades del encabezado cuando se usa header: true
  if (!row || typeof row !== 'object') {
    if (index < 3) {
      console.log(`[Banco Bogotá] Fila ${index + 1}: Row inválido o no es objeto:`, row);
    }
    return null; // Saltar filas inválidas
  }

  if (index < 3) {
    console.log(`[Banco Bogotá] Fila ${index + 1} - Claves disponibles:`, Object.keys(row));
    console.log(`[Banco Bogotá] Fila ${index + 1} - Datos completos:`, row);
    // Mostrar cada clave con su valor exacto
    Object.keys(row).forEach(key => {
      console.log(`  Clave: "${key}" (tipo: ${typeof key}), Valor: "${row[key]}" (tipo: ${typeof row[key]})`);
    });
  }

  // Extraer valores del objeto - buscar todas las variaciones posibles de nombres de columnas
  // Papa.parse puede normalizar los nombres, así que buscamos con y sin espacios, con y sin acentos
  // También maneja caracteres mal codificados
  const getValue = (variations: string[]): string => {
    const rowAny = row as any; // Type assertion para permitir indexación dinámica
    const rowKeys = Object.keys(row);
    
    // Primero intentar búsqueda exacta
    for (const variation of variations) {
      if (rowAny[variation] !== undefined && rowAny[variation] !== null) {
        const value = String(rowAny[variation]).trim();
        if (index < 3) {
          console.log(`  ✓ Encontrado (exacto) "${variation}": "${value}"`);
        }
        return value;
      }
    }
    
    // Función para normalizar strings (eliminar acentos, espacios, case-insensitive)
    const normalize = (str: string): string => {
      return str.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        // Reemplazar caracteres mal codificados comunes (caracteres de reemplazo Unicode)
        .replace(/\uFFFD/g, '') // Caracter de reemplazo Unicode
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/[ñ]/g, 'n');
    };
    
    // Luego buscar case-insensitive y con normalización
    for (const variation of variations) {
      const normalizedVariation = normalize(variation);
      
      for (const key of rowKeys) {
        const normalizedKey = normalize(key);
        
        // Buscar coincidencia exacta después de normalización
        if (normalizedKey === normalizedVariation) {
          const value = String(rowAny[key]).trim();
          if (index < 3) {
            console.log(`  ✓ Encontrado (normalizado) "${key}" (buscaba "${variation}"): "${value}"`);
          }
          return value;
        }
        
        // Buscar si la clave contiene la variación o viceversa (después de normalizar)
        if (normalizedKey.includes(normalizedVariation) || normalizedVariation.includes(normalizedKey)) {
          const value = String(rowAny[key]).trim();
          if (index < 3) {
            console.log(`  ✓ Encontrado (parcial normalizado) "${key}" (buscaba "${variation}"): "${value}"`);
          }
          return value;
        }
      }
    }
    
    if (index < 3) {
      console.log(`  ✗ No encontrado en variaciones:`, variations);
      console.log(`  Claves disponibles en la fila:`, rowKeys);
      // Mostrar claves normalizadas para debugging
      console.log(`  Claves normalizadas:`, rowKeys.map(k => `${k} -> ${normalize(k)}`));
    }
    return '';
  };

  const fechaStr = getValue([
    'Fecha', 'fecha', 'FECHA',
    ' Fecha', ' Fecha ', 'Fecha '
  ]);
  
  // Buscar "Transacción" con y sin acentos, y también con caracteres mal codificados
  const transaccion = getValue([
    'Transacción', 'Transaccion', 'transacción', 'transaccion', 'TRANSACCIÓN', 'TRANSACCION',
    ' Transacción', ' Transaccion', 'Transacción ', 'Transaccion ',
    // Manejar caracteres mal codificados ()
    'Transaccin', 'Transaccion', 'TRANSACCIN', 'TRANSACCION'
  ]);
  
  const oficina = getValue([
    'Oficina', 'oficina', 'OFICINA',
    ' Oficina', ' Oficina ', 'Oficina '
  ]);
  
  const documento = getValue([
    'Documento', 'documento', 'DOCUMENTO',
    ' Documento', ' Documento ', 'Documento '
  ]);
  
  // Buscar "Débito" con y sin acentos, y también con caracteres mal codificados
  const debitoStr = getValue([
    'Débito', 'Debito', 'débito', 'debito', 'DÉBITO', 'DEBITO',
    ' Débito', ' Debito', 'Débito ', 'Debito ',
    // Manejar caracteres mal codificados ()
    'Dbito', 'Debito', 'DBITO', 'DEBITO'
  ]) || '0';
  
  // Buscar "Crédito" con y sin acentos, y también con caracteres mal codificados
  const creditoStr = getValue([
    'Crédito', 'Credito', 'crédito', 'credito', 'CRÉDITO', 'CREDITO',
    ' Crédito', ' Credito', 'Crédito ', 'Credito ',
    // Manejar caracteres mal codificados ()
    'Crdito', 'Credito', 'CRDITO', 'CREDITO'
  ]) || '0';

  if (index < 3) {
    console.log(`[Banco Bogotá] Fila ${index + 1} - Valores extraídos:`, {
      fechaStr,
      transaccion,
      oficina,
      documento,
      debitoStr,
      creditoStr
    });
  }

  // Validar que tengamos los campos esenciales
  if (!fechaStr) {
    if (index < 10) { // Aumentar el número de filas con logging detallado
      console.log(`[Banco Bogotá] Fila ${index + 1} rechazada: Fecha vacía`);
      console.log(`  Fecha encontrada: "${fechaStr}"`);
      console.log(`  Transacción: "${transaccion}"`);
      console.log(`  Débito: "${debitoStr}", Crédito: "${creditoStr}"`);
    }
    return null;
  }

  // Parsear fecha (formato mm/dd, año 2025)
  let fecha: Date;
  try {
    // Limpiar la fecha: eliminar comillas si las hay
    const fechaStrClean = fechaStr.replace(/['"]/g, '').trim();
    
    if (index < 3) {
      console.log(`[Banco Bogotá] Fila ${index + 1} - Parseando fecha: "${fechaStrClean}"`);
    }
    
    // Formato MM/DD (mes/día) - Banco de Bogotá usa este formato, año es 2025
    const datePatternMMDD = /^(\d{1,2})\/(\d{1,2})$/;
    const matchMMDD = fechaStrClean.match(datePatternMMDD);
    
    if (matchMMDD) {
      const month = parseInt(matchMMDD[1], 10) - 1; // Mes es 0-indexed
      const day = parseInt(matchMMDD[2], 10);
      const year = 2025; // Año fijo 2025
      fecha = new Date(year, month, day);
      
      // Validar que la fecha sea válida
      if (isNaN(fecha.getTime()) || 
          fecha.getDate() !== day || 
          fecha.getMonth() !== month || 
          fecha.getFullYear() !== year) {
        throw new Error('Fecha inválida');
      }
      
      if (index < 3) {
        console.log(`[Banco Bogotá] Fila ${index + 1} - Fecha parseada (MM/DD, año 2025):`, fecha);
      }
    } else {
      // Formato dd/mm/yyyy
      const datePattern1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match1 = fechaStrClean.match(datePattern1);
      
      if (match1) {
        const day = parseInt(match1[1], 10);
        const month = parseInt(match1[2], 10) - 1; // Mes es 0-indexed
        const year = parseInt(match1[3], 10);
        fecha = new Date(year, month, day);
        if (index < 3) {
          console.log(`[Banco Bogotá] Fila ${index + 1} - Fecha parseada (dd/mm/yyyy):`, fecha);
        }
      } else {
        // Formato yyyy-mm-dd
        const datePattern2 = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
        const match2 = fechaStrClean.match(datePattern2);
        
        if (match2) {
          const year = parseInt(match2[1], 10);
          const month = parseInt(match2[2], 10) - 1;
          const day = parseInt(match2[3], 10);
          fecha = new Date(year, month, day);
          if (index < 3) {
            console.log(`[Banco Bogotá] Fila ${index + 1} - Fecha parseada (yyyy-mm-dd):`, fecha);
          }
        } else {
          // Intentar parsear como fecha estándar
          fecha = new Date(fechaStrClean);
          if (index < 3) {
            console.log(`[Banco Bogotá] Fila ${index + 1} - Fecha parseada (estándar):`, fecha);
          }
        }
      }
    }
    
    if (isNaN(fecha.getTime())) {
      if (index < 3) {
        console.log(`[Banco Bogotá] Fila ${index + 1} rechazada: Fecha inválida "${fechaStrClean}"`);
      }
      return null; // Fecha inválida
    }
  } catch (error) {
    if (index < 3) {
      console.log(`[Banco Bogotá] Fila ${index + 1} rechazada: Error al parsear fecha:`, error);
    }
    return null; // Error al parsear fecha
  }

  // Parsear Débito y Crédito
  // Formato: puede venir como "385.00" (punto decimal) o vacío ""
  // Limpiar: eliminar comillas, manejar punto como separador decimal
  const parseMonetaryValue = (valueStr: string): number => {
    if (!valueStr || valueStr.trim() === '') {
      return 0;
    }
    
    // Limpiar: eliminar comillas y espacios
    let cleaned = valueStr.replace(/['"]/g, '').trim();
    
    // Si está vacío después de limpiar, retornar 0
    if (cleaned === '') {
      return 0;
    }
    
    // El formato puede ser con punto decimal (ej: "385.00")
    // Parsear directamente con parseFloat
    const parsed = parseFloat(cleaned) || 0;
    
    if (index < 3) {
      console.log(`[Banco Bogotá] Fila ${index + 1} - Valor original: "${valueStr}", Limpiado: "${cleaned}", Parseado: ${parsed}`);
    }
    
    return parsed;
  };
  
  const debito = parseMonetaryValue(debitoStr);
  const credito = parseMonetaryValue(creditoStr);

  if (index < 3) {
    console.log(`[Banco Bogotá] Fila ${index + 1} - Débito: ${debito}, Crédito: ${credito}`);
  }

  // Calcular Valor = Débito - Crédito
  const valor = debito - credito;

  // Validar que al menos uno de los valores (débito o crédito) sea diferente de cero
  if (debito === 0 && credito === 0) {
    if (index < 10) { // Aumentar el número de filas con logging detallado
      console.log(`[Banco Bogotá] Fila ${index + 1} rechazada: Transacción sin valor (débito y crédito en 0)`);
      console.log(`  Débito original: "${debitoStr}" -> ${debito}`);
      console.log(`  Crédito original: "${creditoStr}" -> ${credito}`);
    }
    return null; // Transacción sin valor
  }

  if (index < 3) {
    console.log(`[Banco Bogotá] Fila ${index + 1} - Valor calculado: ${valor}`);
  }

  const transaction: BankTransaction = {
    cuenta: oficina || '', // Usar oficina como cuenta
    iniciales: '', // No disponible en este formato
    fecha,
    valor,
    codigo: documento || '', // Usar documento como código
    descripcion: transaccion || '', // Usar transacción como descripción
    originalIndex: index,
  };
  
  // Marcar si es un gasto bancario
  transaction.isBankExpense = isBankExpense(transaction, bankType);
  
  return transaction;
}

/**
 * Parsea una fila del formato Davivienda
 * TODO: Implementar cuando se conozca el formato específico
 */
function parseDaviviendaRow(row: any, index: number, bankType: BankType = 'davivienda'): BankTransaction | null {
  // Por ahora, usar el mismo formato que Bancolombia
  // TODO: Ajustar según el formato real de Davivienda
  return parseBancolombiaRow(row, index, bankType);
}

/**
 * Parsea un archivo Excel del banco (para bancos que usan Excel como Davivienda y Banco de Occidente)
 */
export async function parseExcelBank(file: File, bankType: BankType): Promise<BankTransaction[]> {
  if (bankType === 'davivienda') {
    return parseExcelDavivienda(file);
  }
  if (bankType === 'banco_occidente') {
    return parseExcelBancoOccidente(file);
  }
  throw new Error(`El banco ${bankType} no usa archivos Excel para extractos bancarios`);
}

/**
 * Parsea un archivo Excel de Banco de Occidente
 * Los datos comienzan en la fila 7 (índice 6)
 * Columnas por posición (11 columnas totales):
 * - Columna 1 (índice 0): Fecha en formato yyyy/mm/dd
 * - Columna 3 (índice 2): Nombre de transacción
 * - Columna 4 (índice 3): Número de documento
 * - Columna 5 (índice 4): Débito (string con formato "$ 111.827,59")
 * - Columna 6 (índice 5): Crédito (string con formato "$ 111.827,59")
 * Calcula: Valor = Débito - Crédito
 */
async function parseExcelBancoOccidente(file: File): Promise<BankTransaction[]> {
  const errors: string[] = [];
  
  try {
    // Convertir File a ArrayBuffer
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
    
    console.log('=== PARSE EXCEL BANCO OCCIDENTE ===');
    console.log('Total de filas:', jsonData.length);
    
    const transactions: BankTransaction[] = [];
    
    // Los datos comienzan en la fila 7 (índice 6)
    const startRowIndex = 6;
    
    if (jsonData.length <= startRowIndex) {
      const errorMsg = `El archivo Excel no tiene suficientes filas. Se esperaba que los datos comenzaran en la fila 7 (índice ${startRowIndex}), pero el archivo solo tiene ${jsonData.length} filas.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Procesar filas de datos (empezar desde la fila 7)
    let rowsProcessed = 0;
    let rowsRejected = 0;
    
    for (let i = startRowIndex; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!Array.isArray(row) || row.length === 0) {
        continue;
      }
      
      rowsProcessed++;
      
      // Usar la función parseBancoOccidenteRow que ya existe
      // Ajustar el índice para que sea relativo a las filas de datos (empezando desde 0)
      const adjustedIndex = i - startRowIndex;
      const transaction = parseBancoOccidenteRow(row, adjustedIndex, 'banco_occidente');
      
      if (transaction) {
        transactions.push(transaction);
      } else {
        rowsRejected++;
        if (rowsRejected <= 5) {
          console.log(`Fila ${i + 1} (ajustada: ${adjustedIndex + 1}) rechazada:`, row);
        }
      }
    }
    
    console.log('=== RESUMEN BANCO OCCIDENTE ===');
    console.log('Filas procesadas:', rowsProcessed);
    console.log('Filas rechazadas:', rowsRejected);
    console.log('Transacciones válidas:', transactions.length);
    
    if (transactions.length === 0) {
      let errorMsg = 'No se encontraron transacciones válidas en el archivo Excel de Banco de Occidente.';
      if (errors.length > 0) {
        errorMsg += '\n\nErrores encontrados:\n' + errors.slice(0, 5).join('\n');
        if (errors.length > 5) {
          errorMsg += `\n... y ${errors.length - 5} errores más.`;
        }
      }
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (errors.length > 0) {
      console.warn('Advertencias al procesar Banco de Occidente:', errors);
    }
    
    return transactions;
  } catch (error) {
    const errorMessage = `Error al parsear Excel de Banco de Occidente: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}

/**
 * Parsea un archivo Excel de Davivienda
 * Columnas: "Fecha de Sistema", "Documento", "Descripción motivo", "Transacción", "Oficina de Recaudo", 
 * "ID Origen/Destino", "Valor Cheque", "Valor Total", "Referencia 1", "Referencia 2"
 * El valor ya está en su naturaleza (positivo/negativo) en "Valor Total"
 * Las fechas ya vienen formateadas en el Excel
 */
async function parseExcelDavivienda(file: File): Promise<BankTransaction[]> {
  const errors: string[] = [];
  
  try {
    // Convertir File a ArrayBuffer
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
    
    console.log('=== PARSE EXCEL DAVIVIENDA ===');
    console.log('Total de filas:', jsonData.length);
    
    const transactions: BankTransaction[] = [];
    
    // Buscar la fila de encabezados (buscar "Fecha de Sistema" u otros nombres de columnas)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (Array.isArray(row) && row.length > 0) {
        // Buscar en todas las celdas de la fila
        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] || '').trim();
          if (cell.includes('Fecha de Sistema') || cell.includes('Valor Total') || cell.includes('Documento')) {
            headerRowIndex = i;
            break;
          }
        }
        if (headerRowIndex !== -1) break;
      }
    }
    
    if (headerRowIndex === -1) {
      const errorMsg = `No se encontró la fila de encabezados en el archivo Excel de Davivienda. Se esperaba encontrar una fila que contenga "Fecha de Sistema" o "Valor Total" en las primeras 10 filas.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Obtener los encabezados (cada celda es una columna)
    const headerRow = jsonData[headerRowIndex] as any[];
    const headerColumns: string[] = headerRow.map(cell => String(cell || '').trim());
    
    console.log('Encabezados encontrados:', headerColumns);
    console.log('Número de columnas:', headerColumns.length);
    
    // Mapear nombres de columnas a índices (búsqueda flexible)
    const getColumnIndex = (searchTerms: string[]): number => {
      for (const term of searchTerms) {
        const lowerTerm = term.toLowerCase();
        const index = headerColumns.findIndex(col => {
          const lowerCol = col.toLowerCase();
          return lowerCol.includes(lowerTerm) || lowerTerm.includes(lowerCol);
        });
        if (index !== -1) return index;
      }
      return -1;
    };
    
    const fechaIndex = getColumnIndex(['Fecha de Sistema', 'Fecha', 'fecha']);
    const documentoIndex = getColumnIndex(['Documento', 'documento']);
    const descripcionIndex = getColumnIndex(['Descripción motivo', 'Descripción', 'descripcion motivo', 'descripcion']);
    const transaccionIndex = getColumnIndex(['Transacción', 'Transaccion', 'transacción', 'transaccion']);
    const oficinaIndex = getColumnIndex(['Oficina de Recaudo', 'Oficina', 'oficina de recaudo', 'oficina']);
    const valorTotalIndex = getColumnIndex(['Valor Total', 'valor total', 'Valor', 'valor']);
    
    console.log('Índices de columnas:', {
      fecha: fechaIndex,
      documento: documentoIndex,
      descripcion: descripcionIndex,
      transaccion: transaccionIndex,
      oficina: oficinaIndex,
      valorTotal: valorTotalIndex
    });
    
    if (fechaIndex === -1 || valorTotalIndex === -1) {
      const errorMsg = `No se encontraron las columnas requeridas. Se esperaba "Fecha de Sistema" y "Valor Total".`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Procesar filas de datos
    let rowsProcessed = 0;
    let rowsRejected = 0;
    
    // Variable para logging (índice relativo a filas de datos)
    let dataRowIndex = 0;
    
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!Array.isArray(row) || row.length === 0) {
        continue;
      }
      
      rowsProcessed++;
      dataRowIndex++;
      
      // Extraer valores
      const fechaValue = row[fechaIndex];
      const documento = String(row[documentoIndex] || '').trim();
      const descripcion = String(row[descripcionIndex] || '').trim();
      const transaccion = String(row[transaccionIndex] || '').trim();
      const oficina = String(row[oficinaIndex] || '').trim();
      const valorTotalValue = row[valorTotalIndex];
      
      // Validar fecha
      if (!fechaValue) {
        rowsRejected++;
        if (rowsRejected <= 3) {
          errors.push(`Fila ${i + 1}: Falta la fecha.`);
        }
        continue;
      }
      
      // Parsear fecha (formato dd/mm/yyyy en Davivienda)
      let fecha: Date;
      try {
        if (fechaValue instanceof Date) {
          fecha = fechaValue;
        } else if (typeof fechaValue === 'number') {
          // Si es un número serial de Excel
          const excelEpoch = new Date(1899, 11, 30);
          fecha = new Date(excelEpoch.getTime() + fechaValue * 86400000);
        } else {
          // Intentar parsear como string en formato dd/mm/yyyy
          const fechaStr = String(fechaValue).trim();
          
          // Formato dd/mm/yyyy
          const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
          const match = fechaStr.match(datePattern);
          
          if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // Mes es 0-indexed
            const year = parseInt(match[3], 10);
            fecha = new Date(year, month, day);
            
            // Validar que la fecha sea válida
            if (isNaN(fecha.getTime()) || 
                fecha.getDate() !== day || 
                fecha.getMonth() !== month || 
                fecha.getFullYear() !== year) {
              throw new Error('Fecha inválida');
            }
          } else {
            // Si no coincide con dd/mm/yyyy, intentar parsear como fecha estándar
            fecha = new Date(fechaStr);
            if (isNaN(fecha.getTime())) {
              throw new Error('Fecha inválida');
            }
          }
        }
        
        if (isNaN(fecha.getTime())) {
          throw new Error('Fecha inválida');
        }
      } catch (error) {
        rowsRejected++;
        if (rowsRejected <= 3) {
          errors.push(`Fila ${i + 1}: Fecha inválida "${fechaValue}". Se espera formato dd/mm/yyyy.`);
        }
        continue;
      }
      
      // Parsear valor total (ya viene con su naturaleza)
      // Formato: "$ 111.827,59" donde punto es miles y coma es decimal
      // Limpiar: eliminar espacios, signos de peso ($), puntos (miles) y convertir coma (decimal) a punto
      let valor = 0;
      try {
        if (typeof valorTotalValue === 'number') {
          valor = valorTotalValue;
        } else {
          // Limpiar el valor: formato "$ 111.827,59"
          let valorStr = String(valorTotalValue || '0').trim();
          
          if (dataRowIndex < 3) {
            console.log(`[Davivienda] Fila ${i + 1} - Valor original: "${valorTotalValue}"`);
          }
          
          // Eliminar espacios
          valorStr = valorStr.replace(/\s+/g, '');
          
          // Eliminar signos de peso ($)
          valorStr = valorStr.replace(/\$/g, '');
          
          // Eliminar puntos (separadores de miles)
          valorStr = valorStr.replace(/\./g, '');
          
          // Reemplazar coma (separador decimal) por punto para parseFloat
          valorStr = valorStr.replace(/,/g, '.');
          
          // Parsear el valor
          valor = parseFloat(valorStr) || 0;
          
          if (dataRowIndex < 3) {
            console.log(`[Davivienda] Fila ${i + 1} - Limpiado: "${valorStr}", Parseado: ${valor}`);
          }
        }
      } catch (error) {
        rowsRejected++;
        if (rowsRejected <= 3) {
          errors.push(`Fila ${i + 1}: Valor Total inválido "${valorTotalValue}".`);
        }
        continue;
      }
      
      // Validar que tenga valor
      if (valor === 0) {
        rowsRejected++;
        if (rowsRejected <= 3) {
          errors.push(`Fila ${i + 1}: Valor Total es cero.`);
        }
        continue;
      }
      
      // Combinar descripción y transacción
      const descripcionCompleta = [descripcion, transaccion].filter(s => s).join(' - ') || '';
      
      const transaction: BankTransaction = {
        cuenta: oficina || '',
        iniciales: '',
        fecha,
        valor,
        codigo: documento || '',
        descripcion: descripcionCompleta || 'Sin descripción',
        originalIndex: i - headerRowIndex - 1, // Índice relativo a las filas de datos
      };
      
      // Marcar si es un gasto bancario
      transaction.isBankExpense = isBankExpense(transaction, 'davivienda');
      
      transactions.push(transaction);
    }
    
    console.log('=== RESUMEN DAVIVIENDA ===');
    console.log('Filas procesadas:', rowsProcessed);
    console.log('Filas rechazadas:', rowsRejected);
    console.log('Transacciones válidas:', transactions.length);
    
    if (transactions.length === 0) {
      let errorMsg = 'No se encontraron transacciones válidas en el archivo Excel de Davivienda.';
      if (errors.length > 0) {
        errorMsg += '\n\nErrores encontrados:\n' + errors.slice(0, 5).join('\n');
        if (errors.length > 5) {
          errorMsg += `\n... y ${errors.length - 5} errores más.`;
        }
      }
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (errors.length > 0) {
      console.warn('Advertencias al procesar Davivienda:', errors);
    }
    
    return transactions;
  } catch (error) {
    const errorMessage = `Error al parsear Excel de Davivienda: ${error instanceof Error ? error.message : 'Error desconocido'}`;
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
          errors.push(`Fila ${i + 1}: Falta la Fecha elaboración (columna 5).`);
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
      errors.push(`... y ${rowsWithErrors - 3} filas más sin Fecha elaboración.`);
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

