const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dir = path.join(__dirname, '..', 'test_data', 'header_detection');

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.xlsx')) {
    const filePath = path.join(dir, file);
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`=== File: ${file} ===`);
    console.log(`Total Rows: ${allRows.length}`);
    console.log('First 5 rows:');
    allRows.slice(0, 5).forEach((row, i) => {
      console.log(`  Row ${i + 1}:`, JSON.stringify(row));
    });
    console.log('\n');
  }
});
