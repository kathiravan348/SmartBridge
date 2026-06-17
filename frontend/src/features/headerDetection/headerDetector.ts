import englishKeys from '../mappingReview/possible_english_keys.json';

const knownKeywords = new Set<string>();
Object.values(englishKeys).forEach((aliases: any) => {
  aliases.forEach((alias: string) => knownKeywords.add(alias.toLowerCase()));
});

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

export function scoreRowContextually(rowIndex: number, allRows: any[][], checkPivoted: boolean = true): { score: number, breakdown: { name: string, score: number }[] } {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) return { score: 0, breakdown: [] };

  const maxFileWidth = allRows.reduce((max, r) => Math.max(max, r.filter(c => getCellType(c) !== 'empty').length), 1);
  const breakdown: { name: string; score: number }[] = [];
  
  let filledCells = 0;
  let numericCells = 0;
  let stringCells = 0;
  let consistentColumns = 0;
  let dataBoundaryColumns = 0;

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
      const cellStr = String(cell).trim().toLowerCase();
      if (uniqueValues.has(cellStr)) {
        duplicates += 1;
      } else {
        uniqueValues.add(cellStr);
      }
    }

    if (cType === 'number' || cType === 'date') {
      numericCells += 1;
      let belowNumericOrDate = 0;
      let totalValidContext = 0;

      for (const contextRow of contextRows) {
        if (colIndex < contextRow.length) {
          totalValidContext += 1;
          const belowType = getCellType(contextRow[colIndex]);
          if (belowType === 'number' || belowType === 'date') {
            belowNumericOrDate += 1;
          }
        }
      }

      if (isPivotedHeader && totalValidContext > 0 && (belowNumericOrDate / totalValidContext) >= 0.6) {
        const cellKey = String(cell).trim().toLowerCase();
        if (cellCounts.get(cellKey) === 1) {
          consistentColumns += 1;
        }
      }
    }

    if (cType === 'string') {
      stringCells += 1;
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

      if (belowNumericOrDate + belowString > 0) {
        if (belowNumericOrDate > belowString) {
          const firstBelowCell = contextRows[0] && colIndex < contextRows[0].length ? contextRows[0][colIndex] : null;
          const firstBelowType = getCellType(firstBelowCell);
          if (firstBelowType === 'number' || firstBelowType === 'date' || firstBelowType === 'empty') {
            dataBoundaryColumns += 1;
          } else {
            consistentColumns += 1;
          }
        } else if (belowString >= belowNumericOrDate) {
          consistentColumns += 1;
        }
      }
    }
  });

  if (filledCells === 0) return { score: 0, breakdown: [] };

  // Pillar 1: Base Density (Max 20%)
  const densityScore = Math.round((filledCells / maxFileWidth) * 20);
  if (densityScore > 0) breakdown.push({ name: `Pillar 1: Base Density (${filledCells} cells)`, score: densityScore });

  // Pillar 2: Data Boundary Signal (Max 100%)
  const boundaryScore = Math.round((dataBoundaryColumns / filledCells) * 100 * contextScale);
  if (boundaryScore > 0) breakdown.push({ name: `Pillar 2: Data Boundary Signal (${dataBoundaryColumns} columns)`, score: boundaryScore });

  // Pillar 3: Data Consistency (Max 35%)
  const consistencyScore = Math.round((consistentColumns / filledCells) * 35 * contextScale);
  if (consistencyScore > 0) breakdown.push({ name: `Pillar 3: Data Consistency (${consistentColumns} columns)`, score: consistencyScore });

  // Pillar 4: Header Traits
  const stringBonus = (stringCells === filledCells) ? 10 : 0;
  if (stringBonus > 0) breakdown.push({ name: `Pillar 4: 100% String Bonus`, score: stringBonus });

  const uniqueBonus = (filledCells > 1 && duplicates === 0) ? 5 : 0;
  if (uniqueBonus > 0) breakdown.push({ name: `Pillar 4: Uniqueness Bonus`, score: uniqueBonus });

  const pivotedBonus = isPivotedHeader ? 20 : 0; // Search booster, nullified later
  if (pivotedBonus > 0) breakdown.push({ name: `Search Booster (Pivoted Series)`, score: pivotedBonus });

  let totalScore = densityScore + boundaryScore + consistencyScore + stringBonus + uniqueBonus + pivotedBonus;

  // Penalties
  if (!isPivotedHeader && (numericCells / filledCells) >= 0.5) {
    totalScore -= 100; // Pure Data Penalty
    breakdown.push({ name: `Critical Penalty: Pure Data Row`, score: -100 });
  }

  if (!isPivotedHeader && numericCells > 0 && (numericCells / filledCells) < 0.5) {
    totalScore -= 30; // Mixed Numeric Penalty
    breakdown.push({ name: `Critical Penalty: Mixed Numeric Data`, score: -30 });
  }

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

  if (!hasDataBelow) {
    totalScore -= 100; // Orphan Header Penalty
    breakdown.push({ name: `Critical Penalty: Orphan Header (No Data Below)`, score: -100 });
  }

  if (duplicates > 0) {
    const dupPenalty = duplicates * 5;
    totalScore -= dupPenalty; // Duplicate Penalty
    breakdown.push({ name: `Critical Penalty: Duplicated Header Names`, score: -dupPenalty });
  }

  return { score: totalScore, breakdown };
}

export function scoreRowKeywords(row: any[]): { score: number, breakdown: { name: string, score: number }[] } {
  if (!row || row.length === 0) return { score: 0, breakdown: [] };
  
  let filledCells = 0;
  let matchCount = 0;
  
  row.forEach(cell => {
    const cType = getCellType(cell);
    if (cType !== 'empty') {
      filledCells += 1;
      const cellStr = String(cell).trim().toLowerCase();
      if (knownKeywords.has(cellStr)) {
        matchCount += 1;
      }
    }
  });

  if (filledCells === 0) return { score: 0, breakdown: [] };

  const keywordScore = Math.round((matchCount / filledCells) * 100);
  const breakdown = [{ name: `Keyword Matches (${matchCount}/${filledCells})`, score: keywordScore }];

  return { score: keywordScore, breakdown };
}

export function scoreRowKeywordsPivoted(row: any[]): { score: number, breakdown: { name: string, score: number }[] } {
  if (!row || row.length === 0) return { score: 0, breakdown: [] };
  
  let matchCount = 0;
  
  row.forEach(cell => {
    const cType = getCellType(cell);
    if (cType !== 'empty') {
      const cellStr = String(cell).trim().toLowerCase();
      if (knownKeywords.has(cellStr)) {
        matchCount += 1;
      }
    }
  });

  if (matchCount === 0) {
    return { score: 0, breakdown: [{ name: `Pivoted Keyword Matches (0 absolute matches)`, score: 0 }] };
  }

  const keywordScore = matchCount >= 2 ? 100 : 50;
  const breakdown = [{ name: `Pivoted Keyword Matches (${matchCount} absolute matches)`, score: keywordScore }];

  return { score: keywordScore, breakdown };
}

export interface HeaderDetectionResult {
  detected_headers: string[];
  confidence_score: number;
  keyword_confidence_score: number;
  keyword_breakdown: { name: string, score: number }[];
  sample_rows: any[][];
  header_row_index: number;
  is_pivoted?: boolean;
}

export function detectHeaderRow(sampleRows: any[][]): HeaderDetectionResult {
  try {
    // Stage 1: Standard Header Detection (checkPivoted = false)
    let bestScore = -Infinity;
    let bestRowIndex = -1;
    let bestRow = null;

    for (let i = 0; i < sampleRows.length - 1; i++) {
      const structRes = scoreRowContextually(i, sampleRows, false);
      if (structRes.score > bestScore) {
        bestScore = structRes.score;
        bestRow = sampleRows[i];
        bestRowIndex = i;
      }
    }

    // Stage 2: Fallback Pivoted Header Detection (checkPivoted = true)
    let bestPivotedScore = -Infinity;
    let bestPivotedRowIndex = -1;
    let bestPivotedRow = null;

    for (let i = 0; i < Math.min(sampleRows.length - 1, 20); i++) {
      const structRes = scoreRowContextually(i, sampleRows, true);
      if (structRes.score > bestPivotedScore) {
        bestPivotedScore = structRes.score;
        bestPivotedRow = sampleRows[i];
        bestPivotedRowIndex = i;
      }
    }

    // Determine target row based entirely on Structural score
    let isPivoted = false;
    let targetRowIndex = bestRowIndex;
    let targetRow = bestRow;
    let targetStructScore = bestScore;

    // If the best pivoted score is confident (>= 50) and it is higher than the standard score
    if (bestPivotedScore >= 50 && bestPivotedScore > bestScore && bestPivotedRowIndex !== -1) {
      isPivoted = true;
      targetRowIndex = bestPivotedRowIndex;
      targetRow = bestPivotedRow;
      targetStructScore = bestPivotedScore - 100; // Apply massive pivoted penalty
    }

    // Fallback if no confident row is found
    if (!targetRow || targetRow.length === 0) {
      return {
        detected_headers: [],
        confidence_score: 0,
        keyword_confidence_score: 0,
        keyword_breakdown: [],
        sample_rows: sampleRows,
        header_row_index: -1,
        is_pivoted: false
      };
    }

    // Calculate baseline keywords for the selected target row
    let targetKeywordRes = scoreRowKeywords(targetRow);
    let finalStructScore = Math.min(100, Math.max(0, targetStructScore));
    let finalKeywordScore = targetKeywordRes.score;
    let keywordBreakdown = targetKeywordRes.breakdown;

    // Apply Keyword Validation rules unconditionally
    if (finalStructScore >= 50 && finalKeywordScore < 50) {
      // Validation Rule 1: Structural success, Keyword failure. Check if it's a pivoted table.
      const pivKwRes = scoreRowKeywordsPivoted(targetRow);
      if (pivKwRes.score >= 50) {
        isPivoted = true; // Marks it as pivoted, triggering UI error state
        finalKeywordScore = pivKwRes.score;
        keywordBreakdown = pivKwRes.breakdown;
      }
    } 
    // Rule 2 is implicitly handled: if finalStructScore < 50 and finalKeywordScore >= 50,
    // it already triggers an error state in the UI because finalStructScore < 50.

    const headers = targetRow.map((cell, index) => {
      if (cell === null || cell === undefined || String(cell).trim() === '') {
        return `Column_${index + 1}`;
      }
      return String(cell).trim();
    });

    return {
      detected_headers: headers,
      confidence_score: finalStructScore,
      keyword_confidence_score: Math.min(100, Math.max(0, finalKeywordScore)),
      keyword_breakdown: keywordBreakdown,
      sample_rows: sampleRows,
      header_row_index: targetRowIndex,
      is_pivoted: isPivoted
    };
  } catch (err) {
    console.error("Error detecting header:", err);
    return {
      detected_headers: [],
      confidence_score: 0,
      keyword_confidence_score: 0,
      keyword_breakdown: [],
      sample_rows: sampleRows,
      header_row_index: -1,
      is_pivoted: false
    };
  }
}
