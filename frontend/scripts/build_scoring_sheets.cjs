const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dir = path.join(__dirname, '..', 'test_data', 'header_detection');

function getCellType(cell) {
  if (cell === null || cell === undefined || cell === '') return 'empty';
  
  const strVal = String(cell).trim().toLowerCase();
  if (strVal === '') return 'empty';

  if (!isNaN(Number(strVal)) && strVal !== '') {
    return 'number';
  }

  if (/^(\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}[-/]\d{1,2}[-/]\d{1,4})$/.test(strVal)) {
    return 'date';
  }

  return 'string';
}

function analyzeRow(rowIndex, allRows, checkPivoted = true) {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) return null;
  
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
  const contextScale = contextRows.length < 3 ? 0.6 : 1.0;

  let densityBonus = 0;
  let dataBoundarySignal = 0;
  let consistentStringSignal = 0;
  let consistentNumericSignal = 0;

  row.forEach((cell, colIndex) => {
    const type = getCellType(cell);
    if (type !== 'empty') {
      filledCells++;
      score += 2;
      densityBonus += 2;
      
      const cellStr = String(cell).trim().toLowerCase();
      if (uniqueValues.has(cellStr)) {
        duplicates++;
      } else {
        uniqueValues.add(cellStr);
      }
    }

    if (type === 'number' || type === 'date') {
      numericCells++;

      let belowNumericOrDate = 0;
      let belowEmpty = 0;
      let totalValidContext = 0;

      contextRows.forEach(contextRow => {
        if (colIndex < contextRow.length) {
          totalValidContext++;
          const belowCell = contextRow[colIndex];
          const belowType = getCellType(belowCell);
          if (belowType === 'number' || belowType === 'date') belowNumericOrDate++;
          else if (belowType === 'empty') belowEmpty++;
        }
      });

      if (isPivotedHeader && totalValidContext > 0 && (belowNumericOrDate / totalValidContext) >= 0.6) {
        const cellKey = String(cell).trim().toLowerCase();
        const isCellUnique = cellCounts.get(cellKey) === 1;
        if (isCellUnique) {
          const pts = Math.round(10 * contextScale);
          score += pts;
          consistentNumericSignal += pts;
        }
      }
    }

    if (type === 'string') {
      stringCells++;
      let belowNumericOrDate = 0;
      let belowString = 0;

      contextRows.forEach(contextRow => {
        if (colIndex < contextRow.length) {
          const belowCell = contextRow[colIndex];
          const belowType = getCellType(belowCell);
          if (belowType === 'number' || belowType === 'date') belowNumericOrDate++;
          else if (belowType === 'string') belowString++;
        }
      });

      const totalContext = belowNumericOrDate + belowString;
      if (totalContext > 0) {
        if (belowNumericOrDate > belowString) {
          const firstBelowCell = contextRows[0] && colIndex < contextRows[0].length ? contextRows[0][colIndex] : null;
          const firstBelowType = getCellType(firstBelowCell);
          if (firstBelowType === 'number' || firstBelowType === 'date' || firstBelowType === 'empty') {
            const pts = Math.round(15 * contextScale);
            score += pts;
            dataBoundarySignal += pts;
          } else {
            const pts = Math.round(5 * contextScale);
            score += pts;
            consistentStringSignal += pts;
          }
        } else if (belowString >= belowNumericOrDate) {
          const pts = Math.round(5 * contextScale);
          score += pts;
          consistentStringSignal += pts;
        }
      }
    }
  });

  let pureDataPenalty = 0;
  if (!isPivotedHeader && filledCells > 0 && numericCells / filledCells > 0.5) {
    score -= 50;
    pureDataPenalty = -50;
  }

  let numericDataPenalty = 0;
  if (!isPivotedHeader && numericCells > 0) {
    score -= 20;
    numericDataPenalty = -20;
  }

  let pivotedHeaderSeriesBonus = 0;
  if (isPivotedHeader) {
    score += 25;
    pivotedHeaderSeriesBonus = 25;
  }

  let hundredPercentStringBonus = 0;
  if (filledCells > 0 && stringCells === filledCells) {
    score += 10;
    hundredPercentStringBonus = 10;
  }

  let uniqueValuesRule = 0;
  if (duplicates > 0) {
    score -= (duplicates * 5);
    uniqueValuesRule = -(duplicates * 5);
  } else if (filledCells > 1 && duplicates === 0) {
    score += 5;
    uniqueValuesRule = 5;
  }

  let orphanHeaderPenalty = 0;
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
    orphanHeaderPenalty = -50;
  }

  return {
    "Row #": rowIndex + 1,
    "Row Preview": JSON.stringify(row).substring(0, 50),
    "Density Bonus": densityBonus,
    "Data Boundary Signal": dataBoundarySignal,
    "Consistent String Signal": consistentStringSignal,
    "Consistent Numeric Signal": consistentNumericSignal,
    "Pure Data Penalty": pureDataPenalty,
    "Numeric Data Penalty": numericDataPenalty,
    "Pivoted Series Bonus": pivotedHeaderSeriesBonus,
    "100% String Bonus": hundredPercentStringBonus,
    "Unique Values Rule": uniqueValuesRule,
    "Orphan Header Penalty": orphanHeaderPenalty,
    "TOTAL SCORE": score
  };
}

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.csv') || file.endsWith('.xlsx')) {
    const filePath = path.join(dir, file);
    let workbook;
    if (file.endsWith('.csv')) {
      const csvData = fs.readFileSync(filePath, 'utf8');
      workbook = xlsx.read(csvData, { type: 'string', raw: true });
    } else {
      workbook = xlsx.readFile(filePath);
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Convert to Array of Arrays
    const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Determine checkPivoted:
    // Run standard scoring search (checkPivoted = false) on first 20 rows
    let bestStandardScore = -Infinity;
    const maxScanRows = Math.min(allRows.length - 1, 20);
    for (let i = 0; i < maxScanRows; i++) {
      const res = analyzeRow(i, allRows, false);
      if (res && res["TOTAL SCORE"] > bestStandardScore) {
        bestStandardScore = res["TOTAL SCORE"];
      }
    }

    let checkPivoted = false;
    if (bestStandardScore < 50) {
      // Run pivoted scoring search (checkPivoted = true) on first 20 rows
      let bestPivotedScore = -Infinity;
      for (let i = 0; i < maxScanRows; i++) {
        const res = analyzeRow(i, allRows, true);
        if (res && res["TOTAL SCORE"] > bestPivotedScore) {
          bestPivotedScore = res["TOTAL SCORE"];
        }
      }
      if (bestPivotedScore >= 50 && bestPivotedScore > bestStandardScore) {
        checkPivoted = true;
      }
    }

    // Evaluate up to first 20 rows with the selected checkPivoted flag
    const breakdown = [];
    for (let i = 0; i < maxScanRows; i++) {
      const res = analyzeRow(i, allRows, checkPivoted);
      if (res) breakdown.push(res);
    }

    // Create the Breakdown sheet
    const breakdownSheet = xlsx.utils.json_to_sheet(breakdown);
    
    // If it already exists, overwrite it, or just create
    if (workbook.SheetNames.includes("Scoring Breakdown")) {
        workbook.Sheets["Scoring Breakdown"] = breakdownSheet;
    } else {
        xlsx.utils.book_append_sheet(workbook, breakdownSheet, "Scoring Breakdown");
    }

    // Write back as XLSX
    const newFileName = file.replace('.csv', '.xlsx');
    const newFilePath = path.join(dir, newFileName);
    xlsx.writeFile(workbook, newFilePath);

    // Delete original CSV if we converted it
    if (file.endsWith('.csv')) {
      fs.unlinkSync(filePath);
    }
    
    console.log(`Processed ${file} -> ${newFileName} (checkPivoted = ${checkPivoted})`);
  }
});
