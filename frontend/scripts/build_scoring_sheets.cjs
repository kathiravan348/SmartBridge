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

function analyzeRow(rowIndex, allRows, isPivotedHeader = false) {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) return null;

  const maxFileWidth = allRows.reduce((max, r) => Math.max(max, r.filter(c => getCellType(c) !== 'empty').length), 1);

  let filledCells = 0;
  let numericCells = 0;
  let stringCells = 0;
  let duplicates = 0;
  let dataBoundaryColumns = 0;
  let consistentColumns = 0;

  const uniqueValues = new Set();
  const cellCounts = new Map();

  row.forEach(cell => {
    const cType = getCellType(cell);
    if (cType !== 'empty') {
      const cellStr = String(cell).trim().toLowerCase();
      cellCounts.set(cellStr, (cellCounts.get(cellStr) || 0) + 1);
    }
  });

  const contextRows = [];
  for (let i = 1; i <= 5; i++) {
    if (rowIndex + i < allRows.length) {
      contextRows.push(allRows[rowIndex + i]);
    }
  }

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

  if (filledCells === 0) return null;

  const densityScore = Math.round((filledCells / maxFileWidth) * 20);
  const boundaryScore = Math.round((dataBoundaryColumns / filledCells) * 100 * contextScale);
  const consistencyScore = Math.round((consistentColumns / filledCells) * 35 * contextScale);
  const stringBonus = (stringCells === filledCells) ? 10 : 0;
  const uniqueBonus = (filledCells > 1 && duplicates === 0) ? 5 : 0;
  const pivotedBonus = isPivotedHeader ? 20 : 0;

  let totalScore = densityScore + boundaryScore + consistencyScore + stringBonus + uniqueBonus + pivotedBonus;

  let pureDataPenalty = 0;
  if (!isPivotedHeader && (numericCells / filledCells) >= 0.5) {
    totalScore -= 100;
    pureDataPenalty = -100;
  }

  let numericDataPenalty = 0;
  if (!isPivotedHeader && numericCells > 0 && (numericCells / filledCells) < 0.5) {
    totalScore -= 30;
    numericDataPenalty = -30;
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

  let orphanHeaderPenalty = 0;
  if (!hasDataBelow) {
    totalScore -= 100;
    orphanHeaderPenalty = -100;
  }

  let duplicatesPenalty = 0;
  if (duplicates > 0) {
    duplicatesPenalty = -(duplicates * 5);
    totalScore += duplicatesPenalty;
  }

  return {
    "Row #": rowIndex + 1,
    "Row Preview": JSON.stringify(row).substring(0, 50),
    "Pillar 1: Density (%)": densityScore,
    "Pillar 2: Boundary (%)": boundaryScore,
    "Pillar 3: Consistency (%)": consistencyScore,
    "Pillar 4: Traits (%)": stringBonus + uniqueBonus,
    "Pure Data Penalty": pureDataPenalty,
    "Mixed Data Penalty": numericDataPenalty,
    "Search Booster (Pivoted)": pivotedBonus,
    "Orphan Header Penalty": orphanHeaderPenalty,
    "Duplicates Penalty": duplicatesPenalty,
    "FILLED CELLS": filledCells,
    "TOTAL RAW SCORE": Math.round(totalScore),
    "NORMALIZED SCORE (%)": Math.min(100, Math.max(0, Math.round(totalScore)))
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
    const maxScanRows = Math.min(allRows.length - 1, 200);
    for (let i = 0; i < maxScanRows; i++) {
      const res = analyzeRow(i, allRows, false);
      if (res && res["TOTAL RAW SCORE"] > bestStandardScore) {
        bestStandardScore = res["TOTAL RAW SCORE"];
      }
    }

    let checkPivoted = false;
    if (bestStandardScore < 50) {
      let bestPivotedScore = -Infinity;
      for (let i = 0; i < maxScanRows; i++) {
        const res = analyzeRow(i, allRows, true);
        if (res && res["TOTAL RAW SCORE"] > bestPivotedScore) {
          bestPivotedScore = res["TOTAL RAW SCORE"];
        }
      }
      if (bestPivotedScore >= 50 && bestPivotedScore > bestStandardScore) {
        checkPivoted = true;
      }
    }

    const breakdown = [];
    for (let i = 0; i < maxScanRows; i++) {
      const res = analyzeRow(i, allRows, checkPivoted);
      if (res) {
        if (checkPivoted && res["Search Booster (Pivoted)"] > 0) {
          res["Unsupported Pivoted Penalty"] = -100;
          res["TOTAL RAW SCORE"] -= 100;
          res["NORMALIZED SCORE (%)"] = Math.min(100, Math.max(0, res["TOTAL RAW SCORE"]));
        }
        breakdown.push(res);
      }
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
