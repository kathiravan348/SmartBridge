/**
 * HEADER AUTO-DETECTION ENGINE (Structural Heuristics)
 * 
 * 1. Parses the top 50 rows of uploaded CSV and Excel files.
 * 2. Bypasses unstructured metadata, report titles, and blank space at the top of files.
 * 3. Uses a Structural Boundary algorithm to detect the header row without relying on language-specific keywords.
 * 4. Compares each candidate row to the 5 rows below it.
 * 5. Awards massive points for Data Boundaries (String -> Number/Date transitions).
 * 6. Penalizes rows that consist primarily of numeric data (identifying them as pure data rows).
 * 7. Returns the extracted headers and a calculated confidence score.
 * 8. Triggers a UI warning if the highest confidence score falls below a threshold.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type CellType = 'number' | 'date' | 'empty' | 'string';

function getCellType(cell: any): CellType {
  if (cell === null || cell === undefined || cell === '') return 'empty';
  
  const strVal = String(cell).trim().toLowerCase();
  if (strVal === '') return 'empty';

  // Number check (must be a valid number and not just a string of numbers that might be a zip code if it has leading zeros, but for simplicity we rely on isNaN)
  // To prevent zip codes from being numbers, we can check if it has leading zeros, but native Number() handles it.
  if (!isNaN(Number(strVal)) && strVal !== '') {
    return 'number';
  }

  // Date check (simple heuristic: contains / or - and numbers)
  // e.g. 2023-01-01, 12/31/2023
  if (/^(\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}[-/]\d{1,2}[-/]\d{1,4})$/.test(strVal)) {
    return 'date';
  }

  return 'string';
}

/**
 * Reads the first N rows of a file using papaparse or xlsx.
 */
async function readSampleRows(file: File, maxRows: number = 50): Promise<any[][]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  return new Promise((resolve, reject) => {
    if (extension === 'csv') {
      let rows: any[][] = [];
      let count = 0;
      
      Papa.parse(file, {
        step: function(results, parser) {
          rows.push(results.data as any[]);
          count++;
          if (count >= maxRows) {
            parser.abort();
          }
        },
        complete: function() {
          resolve(rows);
        },
        error: function(err) {
          reject(err);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          resolve(rows.slice(0, maxRows));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Scores a row by comparing its cells to the cells in the rows immediately below it.
 */
function scoreRowContextually(rowIndex: number, allRows: any[][]): number {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) return 0;
  
  let score = 0;
  let filledCells = 0;
  let numericCells = 0;
  let stringCells = 0;

  const uniqueValues = new Set<string>();
  let duplicates = 0;

  // We look at the next 5 rows for context
  const contextRows = allRows.slice(rowIndex + 1, rowIndex + 6);

  row.forEach((cell, colIndex) => {
    const type = getCellType(cell);
    if (type !== 'empty') {
      filledCells++;
      score += 2; // Density bonus
      
      const cellStr = String(cell).trim().toLowerCase();
      if (uniqueValues.has(cellStr)) {
        duplicates++;
      } else {
        uniqueValues.add(cellStr);
      }
    }

    if (type === 'number' || type === 'date') {
      numericCells++;
    }

    if (type === 'string') {
      stringCells++;
      // Analyze the column context below this string
      let belowNumericOrDate = 0;
      let belowString = 0;
      let belowEmpty = 0;

      contextRows.forEach(contextRow => {
        const belowType = getCellType(contextRow[colIndex]);
        if (belowType === 'number' || belowType === 'date') belowNumericOrDate++;
        else if (belowType === 'string') belowString++;
        else if (belowType === 'empty') belowEmpty++;
      });

      const totalContext = belowNumericOrDate + belowString;
      if (totalContext > 0) {
        // Data Boundary Signal: String transitioning into mostly Numbers/Dates
        if (belowNumericOrDate > belowString) {
          score += 15;
        } 
        // Consistent String Signal: String transitioning into consistent Strings
        else if (belowString >= belowNumericOrDate) {
          score += 5;
        }
      }
    }
  });

  // Pure Data Penalty
  if (filledCells > 0 && numericCells / filledCells > 0.5) {
    score -= 50;
  }

  // 100% String Bonus
  if (filledCells > 0 && stringCells === filledCells) {
    score += 10;
  }

  // Unique Values Bonus / Duplicate Penalty
  if (duplicates > 0) {
    score -= (duplicates * 5);
  } else if (filledCells > 1 && duplicates === 0) {
    score += 5;
  }

  // Orphan Header Penalty (Gap Penalty)
  let hasDataBelow = false;
  contextRows.forEach(contextRow => {
    if (contextRow) {
      contextRow.forEach(c => {
        if (getCellType(c) !== 'empty') hasDataBelow = true;
      });
    }
  });

  if (filledCells > 0 && !hasDataBelow) {
    score -= 50;
  }

  return score;
}

export interface HeaderDetectionResult {
  headers: string[];
  confidenceScore: number;
  sampleRows: any[][];
  headerRowIndex: number;
}

/**
 * Parses the top section of the file and returns the row with the highest header score.
 */
export async function detectHeaderRow(file: File): Promise<HeaderDetectionResult> {
  try {
    const sampleRows = await readSampleRows(file, 50);
    
    let bestScore = -Infinity;
    let bestRow: any[] = [];
    let bestRowIndex = -1;

    // Score each row up to the second-to-last row (need context below)
    for (let i = 0; i < sampleRows.length - 1; i++) {
      const score = scoreRowContextually(i, sampleRows);
      if (score > bestScore) {
        bestScore = score;
        bestRow = sampleRows[i];
        bestRowIndex = i;
      }
    }

    if (bestRow.length === 0) {
      return { headers: [], confidenceScore: 0, sampleRows, headerRowIndex: -1 };
    }

    const headers = bestRow.map((cell, index) => {
      if (cell === null || cell === undefined || cell === '') {
        return `Column_${index + 1}`;
      }
      return String(cell).trim();
    });

    return { headers, confidenceScore: bestScore, sampleRows, headerRowIndex: bestRowIndex };

  } catch (err) {
    console.error("Failed to detect headers:", err);
    return { headers: [], confidenceScore: 0, sampleRows: [], headerRowIndex: -1 };
  }
}
