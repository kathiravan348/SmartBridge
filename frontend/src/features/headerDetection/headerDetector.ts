export type CellType = 'empty' | 'number' | 'date' | 'string';

export function getCellType(val: any): CellType {
  if (val === null || val === undefined || val === '') {
    return 'empty';
  }

  const valStr = String(val).trim();
  if (valStr === '') {
    return 'empty';
  }

  // Number check
  if (!isNaN(Number(valStr)) && valStr !== '') {
    return 'number';
  }

  // Date check (simple regex for common formats like YYYY-MM-DD or MM/DD/YYYY)
  const dateRegex = /^(\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}[-/]\d{1,2}[-/]\d{1,4})$/;
  if (dateRegex.test(valStr)) {
    return 'date';
  }

  return 'string';
}

export function scoreRowContextually(rowIndex: number, allRows: any[][], checkPivoted: boolean = true): number {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) {
    return 0;
  }

  let score = 0;
  let filledCells = 0;
  let numericCells = 0;
  let stringCells = 0;

  const uniqueValues = new Set<string>();
  let duplicates = 0;

  // Pre-calculate cell counts to identify unique cells in the row
  const cellCounts = new Map<string, number>();
  row.forEach(cell => {
    if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
      const key = String(cell).trim().toLowerCase();
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    }
  });

  // Extract numeric/date values to check for horizontal monotonicity and pivoted headers
  const numericValues: number[] = [];
  let hasDateCell = false;
  row.forEach(cell => {
    const cType = getCellType(cell);
    if (cType === 'number') {
      const valNum = Number(String(cell).trim());
      if (!isNaN(valNum)) {
        numericValues.push(valNum);
      }
    } else if (cType === 'date') {
      hasDateCell = true;
      const valDate = Date.parse(String(cell).trim());
      if (!isNaN(valDate)) {
        numericValues.push(valDate);
      }
    }
  });

  let isPivotedHeader = false;
  if (checkPivoted && numericValues.length >= 3) {
    let increasing = true;
    let decreasing = true;
    let strictlyConsecutive = true;

    for (let i = 1; i < numericValues.length; i++) {
      const diff = numericValues[i] - numericValues[i - 1];
      if (diff > 0) {
        decreasing = false;
      } else if (diff < 0) {
        increasing = false;
      } else {
        increasing = false;
        decreasing = false;
      }

      if (Math.abs(diff) !== 1) {
        strictlyConsecutive = false;
      }
    }

    const isMonotonic = increasing || decreasing;

    if (isMonotonic) {
      const allInYearRange = numericValues.every(v => Number.isInteger(v) && v >= 1900 && v <= 2100);
      const allInMonthRange = numericValues.every(v => Number.isInteger(v) && v >= 1 && v <= 12);

      if (hasDateCell || strictlyConsecutive || allInYearRange || allInMonthRange) {
        isPivotedHeader = true;
      }
    }
  }

  // Context rows (next 5)
  const contextRows = allRows.slice(rowIndex + 1, rowIndex + 6);
  const contextScale = contextRows.length < 3 ? 0.6 : 1.0;

  row.forEach((cell, colIndex) => {
    const cType = getCellType(cell);
    if (cType !== 'empty') {
      filledCells += 1;
      score += 2; // Density bonus

      const cellStr = String(cell).trim().toLowerCase();
      if (uniqueValues.has(cellStr)) {
        duplicates += 1;
      } else {
        uniqueValues.add(cellStr);
      }
    }

    if (cType === 'number' || cType === 'date') {
      numericCells += 1;

      // Analyze context below for consistent numeric/date data (pivoted columns)
      let belowNumericOrDate = 0;
      let belowEmpty = 0;
      let totalValidContext = 0;

      for (const contextRow of contextRows) {
        if (colIndex < contextRow.length) {
          totalValidContext += 1;
          const belowType = getCellType(contextRow[colIndex]);
          if (belowType === 'number' || belowType === 'date') {
            belowNumericOrDate += 1;
          } else if (belowType === 'empty') {
            belowEmpty += 1;
          }
        }
      }

      if (isPivotedHeader && totalValidContext > 0 && (belowNumericOrDate / totalValidContext) >= 0.6) {
        const cellKey = String(cell).trim().toLowerCase();
        const isCellUnique = cellCounts.get(cellKey) === 1;
        if (isCellUnique) {
          score += Math.round(10 * contextScale); // Consistent Numeric Column Signal
        }
      }
    }

    if (cType === 'string') {
      stringCells += 1;

      // Analyze context below
      let belowNumericOrDate = 0;
      let belowString = 0;

      for (const contextRow of contextRows) {
        if (colIndex < contextRow.length) {
          const belowType = getCellType(contextRow[colIndex]);
          if (belowType === 'number' || belowType === 'date') {
            belowNumericOrDate += 1;
          } else if (belowType === 'string') {
            belowString += 1;
          }
        }
      }

      const totalContext = belowNumericOrDate + belowString;
      if (totalContext > 0) {
        if (belowNumericOrDate > belowString) {
          // Check if the cell directly below is a number/date/empty to qualify as a true boundary
          const firstBelowCell = contextRows[0] && colIndex < contextRows[0].length ? contextRows[0][colIndex] : null;
          const firstBelowType = getCellType(firstBelowCell);
          if (firstBelowType === 'number' || firstBelowType === 'date' || firstBelowType === 'empty') {
            score += Math.round(15 * contextScale); // Data Boundary Signal
          } else {
            score += Math.round(5 * contextScale); // Consistent String Signal (fell back due to no direct boundary)
          }
        } else if (belowString >= belowNumericOrDate) {
          score += Math.round(5 * contextScale); // Consistent String Signal
        }
      }
    }
  });

  // Pure Data Penalty
  if (!isPivotedHeader && filledCells > 0 && (numericCells / filledCells) > 0.5) {
    score -= 50;
  }

  // Numeric Data Penalty: If a row contains numeric cells and is not a pivoted header series
  if (!isPivotedHeader && numericCells > 0) {
    score -= 20;
  }

  // Pivoted Header Series Bonus
  if (isPivotedHeader) {
    score += 25;
  }

  // 100% String Bonus
  if (filledCells > 0 && stringCells === filledCells) {
    score += 10;
  }

  // Unique values
  if (duplicates > 0) {
    score -= (duplicates * 5);
  } else if (filledCells > 1 && duplicates === 0) {
    score += 5;
  }

  // Orphan Header Penalty
  let hasDataBelow = false;
  for (const contextRow of contextRows) {
    for (const c of contextRow) {
      if (getCellType(c) !== 'empty') {
        hasDataBelow = true;
        break;
      }
    }
    if (hasDataBelow) break;
  }

  if (filledCells > 0 && !hasDataBelow) {
    score -= 50;
  }

  return score;
}

export interface HeaderDetectionResult {
  detected_headers: string[];
  confidence_score: number;
  sample_rows: any[][];
  header_row_index: number;
  is_pivoted?: boolean;
}

export function detectHeaderRow(sampleRows: any[][]): HeaderDetectionResult {
  try {
    // Stage 1: Standard Header Detection (checkPivoted = false)
    let bestScore = -Infinity;
    let bestRow: any[] = [];
    let bestRowIndex = -1;

    for (let i = 0; i < sampleRows.length - 1; i++) {
      const score = scoreRowContextually(i, sampleRows, false);
      if (score > bestScore) {
        bestScore = score;
        bestRow = sampleRows[i];
        bestRowIndex = i;
      }
    }

    // If we have a confident standard header row (score >= 50), return it immediately.
    if (bestScore >= 50 && bestRowIndex !== -1) {
      const headers = bestRow.map((cell, index) => {
        if (cell === null || cell === undefined || String(cell).trim() === '') {
          return `Column_${index + 1}`;
        }
        return String(cell).trim();
      });

      return {
        detected_headers: headers,
        confidence_score: bestScore,
        sample_rows: sampleRows,
        header_row_index: bestRowIndex,
        is_pivoted: false
      };
    }

    // Stage 2: Fallback Pivoted Header Detection (checkPivoted = true)
    let bestPivotedScore = -Infinity;
    let bestPivotedRow: any[] = [];
    let bestPivotedRowIndex = -1;

    for (let i = 0; i < sampleRows.length - 1; i++) {
      const score = scoreRowContextually(i, sampleRows, true);
      if (score > bestPivotedScore) {
        bestPivotedScore = score;
        bestPivotedRow = sampleRows[i];
        bestPivotedRowIndex = i;
      }
    }

    // If the best pivoted score is confident (>= 50) and it is higher than the standard score (which means it got the pivoted series bonus/waiver)
    if (bestPivotedScore >= 50 && bestPivotedScore > bestScore && bestPivotedRowIndex !== -1) {
      const headers = bestPivotedRow.map((cell, index) => {
        if (cell === null || cell === undefined || String(cell).trim() === '') {
          return `Column_${index + 1}`;
        }
        return String(cell).trim();
      });

      return {
        detected_headers: headers,
        confidence_score: bestPivotedScore,
        sample_rows: sampleRows,
        header_row_index: bestPivotedRowIndex,
        is_pivoted: true
      };
    }

    // Fallback if no confident row is found (or pivoted check did not score >= 50), return best standard row
    if (!bestRow || bestRow.length === 0) {
      return {
        detected_headers: [],
        confidence_score: 0,
        sample_rows: sampleRows,
        header_row_index: -1,
        is_pivoted: false
      };
    }

    const headers = bestRow.map((cell, index) => {
      if (cell === null || cell === undefined || String(cell).trim() === '') {
        return `Column_${index + 1}`;
      }
      return String(cell).trim();
    });

    return {
      detected_headers: headers,
      confidence_score: bestScore,
      sample_rows: sampleRows,
      header_row_index: bestRowIndex,
      is_pivoted: false
    };
  } catch (err) {
    console.error("Error detecting header:", err);
    return {
      detected_headers: [],
      confidence_score: 0,
      sample_rows: sampleRows,
      header_row_index: -1,
      is_pivoted: false
    };
  }
}
