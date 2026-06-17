const fs = require('fs');
let content = fs.readFileSync('headerDetector.ts', 'utf8');

const importStatement = `import englishKeys from '../mappingReview/possible_english_keys.json';

const knownKeywords = new Set<string>();
Object.values(englishKeys).forEach((aliases: any) => {
  aliases.forEach((alias: string) => knownKeywords.add(alias.toLowerCase()));
});\n\n`;

content = content.replace("export type CellType = 'empty' | 'number' | 'date' | 'string';", importStatement + "export type CellType = 'empty' | 'number' | 'date' | 'string';");

const scoreRowKeywordsFunc = `
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
  const breakdown = [];
  if (keywordScore > 0) {
    breakdown.push({ name: \`Keyword Matches (\${matchCount}/\${filledCells})\`, score: keywordScore });
  }

  return { score: keywordScore, breakdown };
}\n`;

content = content.replace('export interface HeaderDetectionResult {', scoreRowKeywordsFunc + 'export interface HeaderDetectionResult {');

const interfaceRegex = /export interface HeaderDetectionResult \{[^\}]+\}/ms;
content = content.replace(interfaceRegex, `export interface HeaderDetectionResult {
  detected_headers: string[];
  confidence_score: number;
  keyword_confidence_score: number;
  keyword_breakdown: { name: string, score: number }[];
  sample_rows: any[][];
  header_row_index: number;
  is_pivoted?: boolean;
}`);

const detectFuncRegex = /export function detectHeaderRow\(sampleRows: any\[\]\[\]\): HeaderDetectionResult \{.*^\}$/ms;
content = content.replace(detectFuncRegex, `export function detectHeaderRow(sampleRows: any[][], useKeywordDetection: boolean = false): HeaderDetectionResult {
  try {
    // Stage 1: Standard Header Detection (checkPivoted = false)
    let bestScore = -Infinity;
    let bestKeywordScore = -Infinity;
    let bestRowIndex = -1;
    let bestRow = null;
    let bestKeywordBreakdown: {name: string, score: number}[] = [];

    for (let i = 0; i < sampleRows.length - 1; i++) {
      const structRes = scoreRowContextually(i, sampleRows, false);
      const kwRes = scoreRowKeywords(sampleRows[i]);

      const isBetter = useKeywordDetection 
        ? (kwRes.score > bestKeywordScore || (kwRes.score === bestKeywordScore && structRes.score > bestScore))
        : (structRes.score > bestScore || (structRes.score === bestScore && kwRes.score > bestKeywordScore));

      if (isBetter) {
        bestScore = structRes.score;
        bestKeywordScore = kwRes.score;
        bestRow = sampleRows[i];
        bestRowIndex = i;
        bestKeywordBreakdown = kwRes.breakdown;
      }
    }

    const activeBestScore = useKeywordDetection ? bestKeywordScore : bestScore;

    // If we have a confident standard header row (score >= 50), return it immediately.
    if (activeBestScore >= 50 && bestRowIndex !== -1 && bestRow) {
      const headers = bestRow.map((cell, index) => {
        if (cell === null || cell === undefined || String(cell).trim() === '') {
          return \`Column_\${index + 1}\`;
        }
        return String(cell).trim();
      });

      const confidence = Math.min(100, Math.max(0, bestScore));
      const keywordConfidence = Math.min(100, Math.max(0, bestKeywordScore));

      return {
        detected_headers: headers,
        confidence_score: confidence,
        keyword_confidence_score: keywordConfidence,
        keyword_breakdown: bestKeywordBreakdown,
        sample_rows: sampleRows,
        header_row_index: bestRowIndex,
        is_pivoted: false
      };
    }

    // Stage 2: Fallback Pivoted Header Detection (checkPivoted = true)
    let bestPivotedScore = -Infinity;
    let bestPivotedKeywordScore = -Infinity;
    let bestPivotedRowIndex = -1;
    let bestPivotedRow = null;
    let bestPivotedKeywordBreakdown: {name: string, score: number}[] = [];

    for (let i = 0; i < Math.min(sampleRows.length - 1, 20); i++) {
      const structRes = scoreRowContextually(i, sampleRows, true);
      const kwRes = scoreRowKeywords(sampleRows[i]);

      const isBetter = useKeywordDetection 
        ? (kwRes.score > bestPivotedKeywordScore || (kwRes.score === bestPivotedKeywordScore && structRes.score > bestPivotedScore))
        : (structRes.score > bestPivotedScore || (structRes.score === bestPivotedScore && kwRes.score > bestPivotedKeywordScore));

      if (isBetter) {
        bestPivotedScore = structRes.score;
        bestPivotedKeywordScore = kwRes.score;
        bestPivotedRow = sampleRows[i];
        bestPivotedRowIndex = i;
        bestPivotedKeywordBreakdown = kwRes.breakdown;
      }
    }

    const activeBestPivotedScore = useKeywordDetection ? bestPivotedKeywordScore : bestPivotedScore;

    // If the best pivoted score is confident (>= 50) and it is higher than the standard score
    if (activeBestPivotedScore >= 50 && activeBestPivotedScore > activeBestScore && bestPivotedRowIndex !== -1) {
      const headers = bestPivotedRow.map((cell, index) => {
        if (cell === null || cell === undefined || String(cell).trim() === '') {
          return \`Column_\${index + 1}\`;
        }
        return String(cell).trim();
      });

      const confidence = Math.min(100, Math.max(0, bestPivotedScore - 100)); // Apply massive pivoted penalty
      const keywordConfidence = Math.min(100, Math.max(0, bestPivotedKeywordScore));

      return {
        detected_headers: headers,
        confidence_score: confidence,
        keyword_confidence_score: keywordConfidence,
        keyword_breakdown: bestPivotedKeywordBreakdown,
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
        keyword_confidence_score: 0,
        keyword_breakdown: [],
        sample_rows: sampleRows,
        header_row_index: -1,
        is_pivoted: false
      };
    }

    const headers = bestRow.map((cell, index) => {
      if (cell === null || cell === undefined || String(cell).trim() === '') {
        return \`Column_\${index + 1}\`;
      }
      return String(cell).trim();
    });

    const confidence = Math.min(100, Math.max(0, bestScore));
    const keywordConfidence = Math.min(100, Math.max(0, bestKeywordScore));

    return {
      detected_headers: headers,
      confidence_score: confidence,
      keyword_confidence_score: keywordConfidence,
      keyword_breakdown: bestKeywordBreakdown,
      sample_rows: sampleRows,
      header_row_index: bestRowIndex,
      is_pivoted: false
    };
  } catch (err) {
    console.error('Error detecting header:', err);
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
`;

fs.writeFileSync('headerDetector.ts', content);
