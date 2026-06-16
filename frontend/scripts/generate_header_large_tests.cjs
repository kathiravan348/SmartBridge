const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const testDataDir = path.join(__dirname, '..', 'test_data', 'header_detection');

if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Helper to generate standard data row
const generateStandardRow = (i) => [
  `SUP-${1000 + i}`,
  `Acme Logistics Solutions ${i} LLC`,
  `contact_${i}@acmelogistics.com`,
  5000 + i * 15,
  6000 + i * 12
];

// Helper to generate pivoted data row
const generatePivotedRow = (i) => [
  `Product-${100 + i}`,
  i % 2 === 0 ? 'East' : 'West',
  100 + i * 2,
  120 + i * 3,
  140 + i * 4,
  160 + i * 5
];

// Helper to generate pure no-header data row
const generateNoHeaderRow = (i) => [
  `V-${2000 + i}`,
  `Globex Subunit ${i}`,
  `Austin`,
  `TX`,
  100 + i,
  105 + i,
  110 + i,
  115 + i
];

console.log("Generating large test files...");

// 1. Large_Valid_Standard_Test.xlsx (250 rows, headers at Row 5)
const wb1 = xlsx.utils.book_new();
const data1 = [
  ["SMARTBRIDGE DENSE STANDARD REPORT"],
  ["Export Date: 2026-06-16"],
  ["Author: QA Automation Engine"],
  [],
  // Row 5: Headers
  ["Vendor ID", "Company Name", "Contact Email", "Invoice Total", "PO Total"]
];
for (let i = 0; i < 245; i++) {
  data1.push(generateStandardRow(i));
}
const ws1 = xlsx.utils.aoa_to_sheet(data1);
xlsx.utils.book_append_sheet(wb1, ws1, "Standard Export");
xlsx.writeFile(wb1, path.join(testDataDir, 'Large_Valid_Standard_Test.xlsx'));

// 2. Large_Valid_Pivoted_Test.xlsx (250 rows, pivoted headers at Row 5)
const wb2 = xlsx.utils.book_new();
const data2 = [
  ["SMARTBRIDGE DENSE PIVOTED REPORT"],
  ["Period: Multi-Year Sales Grid"],
  ["Source: Warehouse DB"],
  [],
  // Row 5: Pivoted Headers (monotonic consecutive years)
  ["Product", "Region", 2021, 2022, 2023, 2024]
];
for (let i = 0; i < 245; i++) {
  data2.push(generatePivotedRow(i));
}
const ws2 = xlsx.utils.aoa_to_sheet(data2);
xlsx.utils.book_append_sheet(wb2, ws2, "Pivoted Export");
xlsx.writeFile(wb2, path.join(testDataDir, 'Large_Valid_Pivoted_Test.xlsx'));

// 3. Large_Invalid_No_Header_Test.xlsx (250 rows, no header row, contains monotonic data values)
const wb3 = xlsx.utils.book_new();
const data3 = [];
for (let i = 0; i < 250; i++) {
  data3.push(generateNoHeaderRow(i));
}
const ws3 = xlsx.utils.aoa_to_sheet(data3);
xlsx.utils.book_append_sheet(wb3, ws3, "No Header Export");
xlsx.writeFile(wb3, path.join(testDataDir, 'Large_Invalid_No_Header_Test.xlsx'));

// 4. Large_Messy_Headers_Deep_Test.xlsx (250 rows, headers at Row 55 to test deep scanning loop)
const wb4 = xlsx.utils.book_new();
const data4 = [
  ["SMARTBRIDGE DEEP SCANNING TEST FILE"],
  ["This metadata block is intentionally extremely long to force deep scanning."],
  ...Array.from({ length: 50 }, (_, i) => [`Metadata line ${i + 1}`]),
  [],
  [],
  // Row 55: Headers
  ["Vendor ID", "Company Name", "Contact Email", "Invoice Total", "PO Total"]
];
for (let i = 0; i < 195; i++) {
  data4.push(generateStandardRow(i));
}
const ws4 = xlsx.utils.aoa_to_sheet(data4);
xlsx.utils.book_append_sheet(wb4, ws4, "Deep Messy Export");
xlsx.writeFile(wb4, path.join(testDataDir, 'Large_Messy_Headers_Deep_Test.xlsx'));

// 5. Large_Valid_MultiRow_Header_Test.xlsx (250 rows, multi-row layout, headers at Row 4)
const wb5 = xlsx.utils.book_new();
const data5 = [
  ["SMARTBRIDGE FINANCE MULTI-ROW REPORT"],
  [],
  ["Metadata", "Metadata", "Metadata", "Sales Info", "Sales Info"],
  // Row 4: Actual Headers
  ["Vendor ID", "Company Name", "Contact Email", "Invoice Total", "PO Total"]
];
for (let i = 0; i < 246; i++) {
  data5.push(generateStandardRow(i));
}
const ws5 = xlsx.utils.aoa_to_sheet(data5);
xlsx.utils.book_append_sheet(wb5, ws5, "MultiRow Export");
xlsx.writeFile(wb5, path.join(testDataDir, 'Large_Valid_MultiRow_Header_Test.xlsx'));

// 6. Large_Valid_Sparse_Data_Test.xlsx (220 rows, sparse data columns, headers at Row 3)
const wb6 = xlsx.utils.book_new();
const data6 = [
  ["SMARTBRIDGE SPARSE REPORT"],
  [],
  ["Vendor ID", "Company Name", "Contact Email", "Invoice Total", "PO Total"]
];
for (let i = 0; i < 217; i++) {
  const row = generateStandardRow(i);
  // Randomly set some cells to empty (up to 40% chance per cell)
  const sparseRow = row.map((val, idx) => {
    if (idx >= 2 && Math.random() < 0.4) {
      return "";
    }
    return val;
  });
  data6.push(sparseRow);
}
const ws6 = xlsx.utils.aoa_to_sheet(data6);
xlsx.utils.book_append_sheet(wb6, ws6, "Sparse Export");
xlsx.writeFile(wb6, path.join(testDataDir, 'Large_Valid_Sparse_Data_Test.xlsx'));

// 7. Large_Invalid_Pivoted_Data_Test.xlsx (230 rows, pure numbers, should be rejected)
const wb7 = xlsx.utils.book_new();
const data7 = [];
for (let i = 0; i < 230; i++) {
  data7.push([
    100 + i,
    105 + i,
    110 + i,
    115 + i,
    120 + i,
    125 + i
  ]);
}
const ws7 = xlsx.utils.aoa_to_sheet(data7);
xlsx.utils.book_append_sheet(wb7, ws7, "Pure Numbers Grid");
xlsx.writeFile(wb7, path.join(testDataDir, 'Large_Invalid_Pivoted_Data_Test.xlsx'));

// 8. Large_Valid_Deep_Pivoted_Test.xlsx (240 rows, pivoted years series headers at Row 65)
const wb8 = xlsx.utils.book_new();
const data8 = [
  ["SMARTBRIDGE DEEP PIVOTED REPORT"],
  ...Array.from({ length: 62 }, (_, i) => [`Junk metadata line ${i + 1}`]),
  [],
  // Row 65: Pivoted headers (monotonic consecutive years)
  ["Product", "Region", 2021, 2022, 2023, 2024]
];
for (let i = 0; i < 175; i++) {
  data8.push(generatePivotedRow(i));
}
const ws8 = xlsx.utils.aoa_to_sheet(data8);
xlsx.utils.book_append_sheet(wb8, ws8, "Deep Pivoted Export");
xlsx.writeFile(wb8, path.join(testDataDir, 'Large_Valid_Deep_Pivoted_Test.xlsx'));

// 9. Large_Invalid_Messy_No_Header_Test.xlsx (220 rows, messy data, no distinct headers)
const wb9 = xlsx.utils.book_new();
const data9 = [];
for (let i = 0; i < 220; i++) {
  data9.push([
    `DataVal-${i}`,
    123.45 + i,
    `2026-06-${(i % 28) + 1}`,
    i % 2 === 0 ? "True" : "False",
    `Supplier_Grp_${i}`
  ]);
}
const ws9 = xlsx.utils.aoa_to_sheet(data9);
xlsx.utils.book_append_sheet(wb9, ws9, "Messy No Header Export");
xlsx.writeFile(wb9, path.join(testDataDir, 'Large_Invalid_Messy_No_Header_Test.xlsx'));

console.log("Large test files generated successfully in test_data/header_detection/");
