const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const testDataDir = path.join(__dirname, 'test_data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir);
}

// Data generator for a single row
const generateGoodRow = (index) => ({
  'Supplier ID': `SUP-${1000 + index}`,
  'Supplier Name': `Global Logistics ${index} Inc`,
  'Supplier Alias': `GL${index}`,
  'Supplier Legal name': `Global Logistics Systems ${index} LLC`,
  'Street Address': `${700 + index} Evergreen Terrace`,
  'City State': 'Springfield, OR',
  'Potal Code': '97477',
  'Country': 'US',
  'Phone Number': `+1-541-555-${String(index).padStart(4, '0')}`,
  'Email Address': `contact${index}@globallogistics.com`,
  'Tax Id': `12-34567${String(index).padStart(2, '0')}`,
  'Payment Terms': 'Net 30',
  'Payment Method': 'ACH',
  'Currency': 'USD',
  'Total Number of Invoices': 120 + index,
  'Total Number of Purchase Orders': 45 + index,
  'Total Number of Payments Paid': 95 + index,
  'Total Number of Paymnets Due': 20 + index,
  'Total Number of Payments open': 5,
  'Transaction Count': 165 + index,
  'Total Amount of Invoices': 240500.75 + (index * 100),
  'Total Amount of Purchase Orders': 195000.00 + (index * 100),
  'Total Amount of Payments Paid': 180000.50 + (index * 100),
  'Total Amount of Payments Due': 55500.25,
  'Total Amount of Payments Open': 5000.00,
  'Annual Target Spend': 500000.00
});

// 1. Positive Standard Schema
const positiveStandardData = Array.from({ length: 10 }, (_, i) => generateGoodRow(i));
const wsStandard = xlsx.utils.json_to_sheet(positiveStandardData);
const wbStandard = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbStandard, wsStandard, 'Sheet1');
xlsx.writeFile(wbStandard, path.join(testDataDir, 'Positive_StandardSchema.xlsx'));

// 2. Positive Custom Headers
const positiveCustomData = positiveStandardData.map(row => {
  return {
    'Vendor ID': row['Supplier ID'],
    'Company Name': row['Supplier Name'],
    'Alias': row['Supplier Alias'],
    'Legal Entity': row['Supplier Legal name'],
    'Street': row['Street Address'],
    'City and State': row['City State'],
    'Zip Code': row['Potal Code'],
    'Nation': row['Country'],
    'Tel #': row['Phone Number'],
    'Contact Email': row['Email Address'],
    'EIN': row['Tax Id'],
    'Terms': row['Payment Terms'],
    'Pay Method': row['Payment Method'],
    'Curr': row['Currency'],
    'Invoices Count': row['Total Number of Invoices'],
    'PO Count': row['Total Number of Purchase Orders'],
    'Paid Count': row['Total Number of Payments Paid'],
    'Due Count': row['Total Number of Paymnets Due'],
    'Open Count': row['Total Number of Payments open'],
    'Transactions': row['Transaction Count'],
    'Invoice Total': row['Total Amount of Invoices'],
    'PO Total': row['Total Amount of Purchase Orders'],
    'Paid Total': row['Total Amount of Payments Paid'],
    'Due Total': row['Total Amount of Payments Due'],
    'Open Total': row['Total Amount of Payments Open'],
    'Target Spend': row['Annual Target Spend']
  };
});
const wsCustom = xlsx.utils.json_to_sheet(positiveCustomData);
const wbCustom = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbCustom, wsCustom, 'Sheet1');
xlsx.writeFile(wbCustom, path.join(testDataDir, 'Positive_CustomHeaders.xlsx'));

// 3. Negative Missing Mandatory
const negativeMissingData = positiveStandardData.map((row, i) => {
  const newRow = { ...row };
  if (i === 2) delete newRow['Supplier ID']; // missing on 3rd row
  if (i === 5) newRow['Supplier Name'] = ''; // blank on 6th row
  return newRow;
});
const wsMissing = xlsx.utils.json_to_sheet(negativeMissingData);
const wbMissing = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbMissing, wsMissing, 'Sheet1');
xlsx.writeFile(wbMissing, path.join(testDataDir, 'Negative_MissingMandatory.xlsx'));

// 4. Negative Bad Data Types
const negativeBadData = positiveStandardData.map((row, i) => {
  const newRow = { ...row };
  if (i === 1) newRow['Total Number of Invoices'] = 'One Hundred'; // String instead of int
  if (i === 3) newRow['Total Amount of Invoices'] = 'Invalid Amount'; // String instead of decimal
  if (i === 7) newRow['Country'] = 123; // Number instead of String
  return newRow;
});
const wsBad = xlsx.utils.json_to_sheet(negativeBadData);
const wbBad = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbBad, wsBad, 'Sheet1');
xlsx.writeFile(wbBad, path.join(testDataDir, 'Negative_BadDataTypes.xlsx'));

// 5. Negative Over 10MB (We'll generate a dummy large CSV directly to save generation time)
const largeCsvPath = path.join(testDataDir, 'Negative_LargeFile_15MB.csv');
const chunk = "A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z\n" + "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26\n".repeat(5000); // approx 260KB chunk
const stream = fs.createWriteStream(largeCsvPath);
// Write 60 chunks = ~15.6 MB
for (let i = 0; i < 60; i++) {
  stream.write(chunk);
}
stream.end();

console.log('Test data generated successfully in test_data directory.');
