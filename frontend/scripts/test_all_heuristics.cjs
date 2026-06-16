const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Import the headerDetector functions using a dynamic require or by replicating them
// Since we want to test the exact logic in headerDetector.ts, let's write a simple script that compiles/requires it
// Or we can just read the TS file and run it. Since we can run node on a JS/CJS version, let's implement the logic in the script directly to test.
// Even better, let's copy the code from headerDetector.ts and run it!

function getCellType(val) {
  if (val === null || val === undefined || val === '') {
    return 'empty';
  }

  const valStr = String(val).trim();
  if (valStr === '') {
    return 'empty';
  }

  if (!isNaN(Number(valStr)) && valStr !== '') {
    return 'number';
  }

  const dateRegex = /^(\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}[-/]\d{1,2}[-/]\d{1,4})$/;
  if (dateRegex.test(valStr)) {
    return 'date';
  }

  return 'string';
}

function scoreRowContextually(rowIndex, allRows, checkPivoted = true, useScaling = true) {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) {
    return 0;
  }

  let score = 0;
  let filledCells = 0;
  let numericCells = 0;
  let stringCells = 0;

  const uniqueValues = new Set();
  let duplicates = 0;

  const cellCounts = new Map();
  row.forEach(cell => {
    if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
      const key = String(cell).trim().toLowerCase();
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    }
  });

  const numericValues = [];
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

  const contextRows = allRows.slice(rowIndex + 1, rowIndex + 6);
  const contextScale = (useScaling && contextRows.length < 3) ? 0.6 : 1.0;

  row.forEach((cell, colIndex) => {
    const cType = getCellType(cell);
    if (cType !== 'empty') {
      filledCells += 1;
      score += 2;

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
          score += Math.round(10 * contextScale);
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

      const totalContext = belowNumericOrDate + belowString;
      if (totalContext > 0) {
        if (belowNumericOrDate > belowString) {
          const firstBelowCell = contextRows[0] && colIndex < contextRows[0].length ? contextRows[0][colIndex] : null;
          const firstBelowType = getCellType(firstBelowCell);
          if (firstBelowType === 'number' || firstBelowType === 'date' || firstBelowType === 'empty') {
            score += Math.round(15 * contextScale);
          } else {
            score += Math.round(5 * contextScale);
          }
        } else if (belowString >= belowNumericOrDate) {
          score += Math.round(5 * contextScale);
        }
      }
    }
  });

  if (!isPivotedHeader && filledCells > 0 && (numericCells / filledCells) > 0.5) {
    score -= 50;
  }

  // Numeric Data Penalty: If a row contains numeric cells and is not a pivoted header series
  if (!isPivotedHeader && numericCells > 0) {
    score -= 20;
  }

  if (isPivotedHeader) {
    score += 25;
  }

  if (filledCells > 0 && stringCells === filledCells) {
    score += 10;
  }

  if (duplicates > 0) {
    score -= (duplicates * 5);
  } else if (filledCells > 1 && duplicates === 0) {
    score += 5;
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

  if (filledCells > 0 && !hasDataBelow) {
    score -= 50;
  }

  return score;
}

function detectHeaderRow(sampleRows, useScaling = true) {
  // Stage 1: Standard Header Detection (checkPivoted = false)
  let bestScore = -Infinity;
  let bestRowIndex = -1;

  for (let i = 0; i < sampleRows.length - 1; i++) {
    const score = scoreRowContextually(i, sampleRows, false, useScaling);
    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = i;
    }
  }

  // If standard check scores >= 50, return immediately
  if (bestScore >= 50 && bestRowIndex !== -1) {
    return {
      score: bestScore,
      index: bestRowIndex,
      row: sampleRows[bestRowIndex],
      is_pivoted: false
    };
  }

  // Stage 2: Fallback Pivoted Header Detection (checkPivoted = true)
  let bestPivotedScore = -Infinity;
  let bestPivotedRowIndex = -1;

  for (let i = 0; i < sampleRows.length - 1; i++) {
    const score = scoreRowContextually(i, sampleRows, true, useScaling);
    if (score > bestPivotedScore) {
      bestPivotedScore = score;
      bestPivotedRowIndex = i;
    }
  }

  if (bestPivotedScore >= 50 && bestPivotedScore > bestScore && bestPivotedRowIndex !== -1) {
    return {
      score: bestPivotedScore,
      index: bestPivotedRowIndex,
      row: sampleRows[bestPivotedRowIndex],
      is_pivoted: true
    };
  }

  // Fallback
  return {
    score: bestScore,
    index: bestRowIndex,
    row: bestRowIndex !== -1 ? sampleRows[bestRowIndex] : null,
    is_pivoted: false
  };
}

const dir = path.join(__dirname, '..', 'test_data', 'header_detection');

console.log("--- EVALUATING WITHOUT SCALING ---");
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.xlsx')) {
    const filePath = path.join(dir, file);
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    const result = detectHeaderRow(allRows, false);
    console.log(`File: ${file.padEnd(42)} -> Best Row: ${result.index + 1} | Score: ${result.score} | Pivoted: ${result.is_pivoted} | Row: ${JSON.stringify(result.row)}`);
  }
});

console.log("\n--- EVALUATING WITH SCALING ---");
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.xlsx')) {
    const filePath = path.join(dir, file);
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    const result = detectHeaderRow(allRows, true);
    console.log(`File: ${file.padEnd(42)} -> Best Row: ${result.index + 1} | Score: ${result.score} | Pivoted: ${result.is_pivoted} | Row: ${JSON.stringify(result.row)}`);
  }
});
