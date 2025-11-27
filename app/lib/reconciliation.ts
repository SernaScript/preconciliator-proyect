import { BankTransaction, ERPTransaction } from './fileParser';

export interface IndexedTransaction {
  index: string;
  transaction: BankTransaction | ERPTransaction;
}

export interface ReconciliationMatch {
  bankTransaction: BankTransaction;
  erpTransaction: ERPTransaction;
  difference: number;
}

export interface ReconciliationResult {
  matched: ReconciliationMatch[];
  unmatchedBank: BankTransaction[];
  unmatchedERP: ERPTransaction[];
  stats: {
    totalBank: number;
    totalERP: number;
    matched: number;
    unmatchedBank: number;
    unmatchedERP: number;
    matchPercentage: number;
  };
}

/**
 * Crea índices para transacciones agrupadas por valor
 * Formato: valor-1, valor-2, valor-3, etc.
 */
export function indexByValue(transactions: (BankTransaction | ERPTransaction)[]): IndexedTransaction[] {
  // Agrupar por valor
  const valueMap = new Map<number, (BankTransaction | ERPTransaction)[]>();
  
  transactions.forEach(transaction => {
    const value = Math.abs(transaction.valor);
    if (!valueMap.has(value)) {
      valueMap.set(value, []);
    }
    valueMap.get(value)!.push(transaction);
  });
  
  // Crear índices
  const indexed: IndexedTransaction[] = [];
  
  valueMap.forEach((transactions, value) => {
    transactions.forEach((transaction, idx) => {
      indexed.push({
        index: `${value}-${idx + 1}`, // Índices empiezan desde 1
        transaction,
      });
    });
  });
  
  return indexed;
}

/**
 * Crea índices para transacciones agrupadas por fecha y valor
 * Formato: DD/MM/YYYY-valor-1, DD/MM/YYYY-valor-2, etc.
 */
export function indexByValueAndDate(transactions: (BankTransaction | ERPTransaction)[]): IndexedTransaction[] {
  // Agrupar por fecha y valor
  const dateValueMap = new Map<string, (BankTransaction | ERPTransaction)[]>();
  
  transactions.forEach(transaction => {
    const fecha = 'fecha' in transaction ? transaction.fecha : transaction.fechaElaboracion;
    
    const dateStr = formatDate(fecha);
    const value = Math.abs(transaction.valor);
    const key = `${dateStr}-${value}`;
    
    if (!dateValueMap.has(key)) {
      dateValueMap.set(key, []);
    }
    dateValueMap.get(key)!.push(transaction);
  });
  
  // Crear índices
  const indexed: IndexedTransaction[] = [];
  
  dateValueMap.forEach((transactions, key) => {
    transactions.forEach((transaction, idx) => {
      indexed.push({
        index: `${key}-${idx + 1}`, // Índices empiezan desde 1
        transaction,
      });
    });
  });
  
  return indexed;
}

/**
 * Formatea una fecha a DD/MM/YYYY
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Realiza la conciliación entre transacciones bancarias y del ERP
 * @param bankTransactions Transacciones del extracto bancario
 * @param erpTransactions Transacciones del ERP
 * @param useDate Si true, concilia por fecha y valor; si false, solo por valor
 * @param tolerance Tolerancia permitida para diferencias (diferencia absoluta)
 */
export function reconcile(
  bankTransactions: BankTransaction[],
  erpTransactions: ERPTransaction[],
  useDate: boolean,
  tolerance: number = 0
): ReconciliationResult {
  // Crear índices según el modo
  const bankIndexed = useDate 
    ? indexByValueAndDate(bankTransactions)
    : indexByValue(bankTransactions);
  
  const erpIndexed = useDate
    ? indexByValueAndDate(erpTransactions)
    : indexByValue(erpTransactions);
  
  // Crear mapas para búsqueda rápida
  const bankMap = new Map<string, BankTransaction[]>();
  bankIndexed.forEach(({ index, transaction }) => {
    const key = extractKeyFromIndex(index, useDate);
    if (!bankMap.has(key)) {
      bankMap.set(key, []);
    }
    bankMap.get(key)!.push(transaction as BankTransaction);
  });
  
  const erpMap = new Map<string, ERPTransaction[]>();
  erpIndexed.forEach(({ index, transaction }) => {
    const key = extractKeyFromIndex(index, useDate);
    if (!erpMap.has(key)) {
      erpMap.set(key, []);
    }
    erpMap.get(key)!.push(transaction as ERPTransaction);
  });
  
  // Realizar conciliación
  const matched: ReconciliationMatch[] = [];
  const matchedBankIndices = new Set<number>();
  const matchedERPIndices = new Set<number>();
  
  // Iterar sobre las transacciones bancarias
  bankMap.forEach((bankTrans, key) => {
    const erpTrans = erpMap.get(key);
    
    if (erpTrans && erpTrans.length > 0) {
      // Intentar hacer match
      for (const bankT of bankTrans) {
        if (matchedBankIndices.has(bankT.originalIndex)) {
          continue; // Ya fue conciliada
        }
        
        let bestMatch: ERPTransaction | null = null;
        let minDifference = Infinity;
        
        for (const erpT of erpTrans) {
          if (matchedERPIndices.has(erpT.originalIndex)) {
            continue; // Ya fue conciliada
          }
          
          const difference = Math.abs(Math.abs(bankT.valor) - Math.abs(erpT.valor));
          
          if (difference <= tolerance && difference < minDifference) {
            minDifference = difference;
            bestMatch = erpT;
          }
        }
        
        if (bestMatch) {
          matched.push({
            bankTransaction: bankT,
            erpTransaction: bestMatch,
            difference: minDifference,
          });
          matchedBankIndices.add(bankT.originalIndex);
          matchedERPIndices.add(bestMatch.originalIndex);
        }
      }
    }
  });
  
  // Obtener transacciones no conciliadas
  const unmatchedBank = bankTransactions.filter(
    t => !matchedBankIndices.has(t.originalIndex)
  );
  
  const unmatchedERP = erpTransactions.filter(
    t => !matchedERPIndices.has(t.originalIndex)
  );
  
  // Calcular estadísticas
  const totalBank = bankTransactions.length;
  const totalERP = erpTransactions.length;
  const matchedCount = matched.length;
  const unmatchedBankCount = unmatchedBank.length;
  const unmatchedERPCount = unmatchedERP.length;
  const matchPercentage = totalBank > 0 
    ? (matchedCount / totalBank) * 100 
    : 0;
  
  return {
    matched,
    unmatchedBank,
    unmatchedERP,
    stats: {
      totalBank,
      totalERP,
      matched: matchedCount,
      unmatchedBank: unmatchedBankCount,
      unmatchedERP: unmatchedERPCount,
      matchPercentage: Math.round(matchPercentage * 100) / 100,
    },
  };
}

/**
 * Extrae la clave de búsqueda del índice
 * Para modo solo valor: extrae el valor (ej: "100-1" -> "100")
 * Para modo fecha+valor: extrae fecha-valor (ej: "01/01/2025-100-1" -> "01/01/2025-100")
 */
function extractKeyFromIndex(index: string, useDate: boolean): string {
  if (useDate) {
    // Formato: DD/MM/YYYY-valor-índice
    const parts = index.split('-');
    if (parts.length >= 3) {
      // Tomar fecha y valor, excluir el índice final
      return parts.slice(0, -1).join('-');
    }
    return index;
  } else {
    // Formato: valor-índice
    const parts = index.split('-');
    if (parts.length >= 2) {
      return parts[0]; // Solo el valor
    }
    return index;
  }
}

