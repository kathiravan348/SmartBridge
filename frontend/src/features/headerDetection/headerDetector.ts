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

// ============================================================================
// Layer 1: Structural Detection
// ============================================================================
export function calculateStructuralScore(rowIndex: number, allRows: any[][]): { score: number, breakdown: { name: string, score: number }[] } {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) return { score: 0, breakdown: [] };

  const maxFileWidth = allRows.reduce((max, r) => Math.max(max, r.filter(c => getCellType(c) !== 'empty').length), 1);
  const breakdown: { name: string; score: number }[] = [];
  
  let filledCells = 0;
  let numericCells = 0;

  // Track unique values to calculate traits score later
  const valueCounts = new Map<string, number>();
  row.forEach(cell => {
    const cType = getCellType(cell);
    if (cType !== 'empty') {
      filledCells += 1;
      if (cType === 'number' || cType === 'date') {
        numericCells += 1;
      }
      const cellStr = String(cell).trim().toLowerCase();
      valueCounts.set(cellStr, (valueCounts.get(cellStr) || 0) + 1);
    }
  });

  if (filledCells === 0) return { score: 0, breakdown: [] };

  // Context rows (next 5)
  const contextRows = allRows.slice(rowIndex + 1, rowIndex + 6);

  let totalColumnScore = 0;

  for (let colIndex = 0; colIndex < maxFileWidth; colIndex++) {
    const cell = colIndex < row.length ? row[colIndex] : null;
    const cType = getCellType(cell);

    if (cType === 'empty') continue;

    let colScore = 0;
    
    // 1. Cell Presence (+20 pts)
    colScore += 20;

    // 2. Header Traits (Up to +20 pts)
    if (cType === 'string') {
      colScore += 10;
      const cellStr = String(cell).trim().toLowerCase();
      if (valueCounts.get(cellStr) === 1) {
        colScore += 10; // Unique across the row
      }
    }

    // 3. Data Relationship (Up to +60 pts)
    let hasBoundary = false;
    let isConsistent = false;

    if (cType === 'string') {
      // Find the first non-empty cell directly below this column in the context window
      for (const contextRow of contextRows) {
        if (colIndex < contextRow.length) {
          const belowType = getCellType(contextRow[colIndex]);
          if (belowType !== 'empty') {
            if (belowType === 'number' || belowType === 'date') {
              hasBoundary = true;
            } else if (belowType === 'string') {
              isConsistent = true;
            }
            break; // Stop at the first non-empty cell below
          }
        }
      }

      if (hasBoundary) {
        colScore += 60;
      } else if (isConsistent) {
        colScore += 40;
      }
    }

    totalColumnScore += colScore;
  }

  // Preliminary Average Score
  const preliminaryScore = totalColumnScore / maxFileWidth;
  breakdown.push({ name: `Base Average Score (${filledCells}/${maxFileWidth} cols)`, score: Math.round(preliminaryScore) });

  let currentScore = preliminaryScore;

  // Context Scaling has been intentionally removed; relying purely on density and data-presence.

  // Numeric Penalties
  if ((numericCells / filledCells) >= 0.5) {
    const penalty = currentScore;
    currentScore *= 0.0;
    if (penalty > 0) breakdown.push({ name: `Critical Penalty: Pure Data Row (0.0x)`, score: -Math.round(penalty) });
  } else if (numericCells > 0) {
    const penalty = currentScore * 0.5;
    currentScore *= 0.5;
    if (penalty > 0) breakdown.push({ name: `Critical Penalty: Mixed Numeric Data (0.5x)`, score: -Math.round(penalty) });
  }

  // Orphan Penalty
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
    const penalty = currentScore;
    currentScore *= 0.0;
    if (penalty > 0) breakdown.push({ name: `Critical Penalty: Orphan Header / No Data Below (0.0x)`, score: -Math.round(penalty) });
  }

  const finalScore = Math.min(100, Math.round(currentScore));

  return { score: finalScore, breakdown };
}

// ============================================================================
// Layer 2: Keyword Scoring
// ============================================================================
export function calculateKeywordScore(row: any[]): { score: number, breakdown: { name: string, score: number }[], contiguousBlockLength: number } {
  if (!row || row.length === 0) return { score: 0, breakdown: [], contiguousBlockLength: 0 };
  
  let filledCells = 0;
  let matchCount = 0;
  
  // Contiguous Column Scan: halt at the first empty cell
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    const cType = getCellType(cell);
    if (cType === 'empty') {
      break;
    }
    
    filledCells += 1;
    const cellStr = String(cell).trim().toLowerCase();
    if (knownKeywords.has(cellStr)) {
      matchCount += 1;
    }
  }

  if (filledCells === 0) return { score: 0, breakdown: [], contiguousBlockLength: 0 };

  const keywordScore = Math.round((matchCount / filledCells) * 100);
  const breakdown = [{ name: `Contiguous Keyword Matches (${matchCount}/${filledCells})`, score: keywordScore }];

  return { score: keywordScore, breakdown, contiguousBlockLength: filledCells };
}

// ============================================================================
// Layer 3: Validation Layer
// ============================================================================
export function verifyFinalHeader(allRows: any[][], headerRowIndex: number, keywordScore: number): { isPivoted: boolean, verticalKeywordScore: number } {
  if (!allRows || allRows.length === 0 || headerRowIndex < 0) return { isPivoted: false, verticalKeywordScore: 0 };
  
  // Only check for pivoted table if horizontal keyword match score < 50
  if (keywordScore < 50) {
    let verticalFilledCells = 0;
    let verticalMatchCount = 0;
    const uniqueValues = new Set<string>();
    let duplicates = 0;

    // Scan vertically down the first column (index 0) starting from the header row
    // End at the first empty cell, or at a maximum of 200 rows (whichever comes first)
    const maxScanRows = Math.min(allRows.length, headerRowIndex + 200);

    for (let i = headerRowIndex; i < maxScanRows; i++) {
      const cell = allRows[i][0];
      const cType = getCellType(cell);
      
      // Stop at the first empty cell in the first column
      if (cType === 'empty') {
        break;
      }

      verticalFilledCells += 1;
      const cellStr = String(cell).trim().toLowerCase();
      
      if (uniqueValues.has(cellStr)) {
        duplicates += 1;
      } else {
        uniqueValues.add(cellStr);
      }

      if (knownKeywords.has(cellStr)) {
        verticalMatchCount += 1;
      }
    }

    if (verticalFilledCells === 0) return { isPivoted: false, verticalKeywordScore: 0 };

    const verticalKeywordScore = Math.round((verticalMatchCount / verticalFilledCells) * 100);

    // The Unique Header Condition: all vertical labels must be unique
    if (duplicates > 0) {
      return { isPivoted: false, verticalKeywordScore }; // Not a valid pivoted table if there are duplicate vertical headers
    }

    // If vertical keyword score >= 50%, it's a pivoted table
    if (verticalKeywordScore >= 50) {
      return { isPivoted: true, verticalKeywordScore }; // isPivoted = true
    }
    
    return { isPivoted: false, verticalKeywordScore };
  }
  
  return { isPivoted: false, verticalKeywordScore: 0 };
}

export interface HeaderDetectionResult {
  detected_headers: string[];
  confidence_score: number;
  keyword_confidence_score: number;
  keyword_breakdown: { name: string, score: number }[];
  sample_rows: any[][];
  header_row_index: number;
  is_pivoted?: boolean;
  vertical_keyword_score?: number;
}

// ============================================================================
// Main Orchestrator
// ============================================================================
export function detectHeaderRow(sampleRows: any[][]): HeaderDetectionResult {
  try {
    let bestScore = -Infinity;
    let bestRowIndex = -1;
    let bestRow = null;

    // Run Layer 1: Structural Detection
    for (let i = 0; i < sampleRows.length - 1; i++) {
      const structRes = calculateStructuralScore(i, sampleRows);
      if (structRes.score > bestScore) {
        bestScore = structRes.score;
        bestRow = sampleRows[i];
        bestRowIndex = i;
      }
    }

    if (!bestRow || bestRow.length === 0) {
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

    // Run Layer 2: Keyword Scoring
    const keywordRes = calculateKeywordScore(bestRow);
    const finalStructScore = Math.min(100, Math.max(0, bestScore));
    let finalKeywordScore = keywordRes.score;
    let keywordBreakdown = keywordRes.breakdown;

    // Run Layer 3: Validation Layer
    let isPivoted = false;
    let verticalKeywordScore: number | undefined = undefined;
    // Only apply validation trap if it was deemed structurally confident (>= 50)
    if (finalStructScore >= 50 && finalKeywordScore < 50) {
      const valRes = verifyFinalHeader(sampleRows, bestRowIndex, finalKeywordScore);
      isPivoted = valRes.isPivoted;
      verticalKeywordScore = valRes.verticalKeywordScore;
    }

    const headers = bestRow.map((cell, index) => {
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
      header_row_index: bestRowIndex,
      is_pivoted: isPivoted,
      vertical_keyword_score: verticalKeywordScore
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
