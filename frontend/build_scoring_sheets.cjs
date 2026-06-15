const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dir = path.join(__dirname, 'test_data', 'header_detection');

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

function analyzeRow(rowIndex, allRows) {
  const row = allRows[rowIndex];
  if (!row || row.length === 0) return null;
  
  let score = 0;
  let filledCells = 0;
  let numericCells = 0;
  let stringCells = 0;

  const uniqueValues = new Set();
  let duplicates = 0;

  const contextRows = allRows.slice(rowIndex + 1, rowIndex + 6);

  let densityBonus = 0;
  let dataBoundarySignal = 0;
  let consistentStringSignal = 0;

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
    }

    if (type === 'string') {
      stringCells++;
      let belowNumericOrDate = 0;
      let belowString = 0;
      let belowEmpty = 0;

      contextRows.forEach(contextRow => {
        const belowCell = contextRow[colIndex];
        const belowType = belowCell !== undefined ? getCellType(belowCell) : 'empty';
        if (belowType === 'number' || belowType === 'date') belowNumericOrDate++;
        else if (belowType === 'string') belowString++;
        else if (belowType === 'empty') belowEmpty++;
      });

      const totalContext = belowNumericOrDate + belowString;
      if (totalContext > 0) {
        if (belowNumericOrDate > belowString) {
          score += 15;
          dataBoundarySignal += 15;
        } else if (belowString >= belowNumericOrDate) {
          score += 5;
          consistentStringSignal += 5;
        }
      }
    }
  });

  let pureDataPenalty = 0;
  if (filledCells > 0 && numericCells / filledCells > 0.5) {
    score -= 50;
    pureDataPenalty = -50;
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
    "Pure Data Penalty": pureDataPenalty,
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
    
    // Evaluate up to first 20 rows
    const breakdown = [];
    const maxRows = Math.min(allRows.length - 1, 20); // We need context below, so limit
    for (let i = 0; i < maxRows; i++) {
      const res = analyzeRow(i, allRows);
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
    
    console.log(`Processed ${file} -> ${newFileName}`);
  }
});
