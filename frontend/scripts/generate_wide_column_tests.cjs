/**
 * generate_wide_column_tests.cjs
 *
 * Generates header_detection test files that exercise the full 26-column
 * supplier schema (matching schema.ts TARGET_HEADERS).
 * Note: SmartBridge reads the first sheet only; multi-sheet files are out of scope.
 *
 * Files produced:
 *  1. Wide_Valid_Clean_Test.xlsx              – clean header at Row 1
 *  2. Wide_Valid_Messy_Metadata_Test.xlsx     – 4 junk rows, header at Row 6
 *  3. Wide_Valid_Deep_Junk_Test.xlsx          – 30 junk rows, header at Row 32
 *  4. Wide_Valid_Sparse_Data_Test.xlsx        – clean header, ~35% empty data cells
 *  5. Wide_Valid_Aliased_Headers_Test.xlsx    – same schema, different column labels
 *  6. Wide_Valid_Partial_Schema_Test.xlsx     – only 22 of 26 schema columns
 *  7. Wide_Invalid_No_Header_Test.xlsx        – pure data, no header row
 *  8. Wide_Invalid_Pivoted_Years_Test.xlsx    – wide pivoted year series header
 *  9. Wide_Mixed_Types_Top_Test.xlsx          – dense mixed-type junk rows, then header
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const OUT_DIR = path.join(__dirname, '..', 'test_data', 'header_detection');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Schema (mirrors schema.ts TARGET_HEADERS) ───────────────────────────────

const SCHEMA_HEADERS = [
  'Supplier ID',
  'Supplier Name',
  'Supplier Alias',
  'Supplier Legal Name',
  'Street Address',
  'City State',
  'Postal Code',
  'Country',
  'Phone Number',
  'Email Address',
  'Tax ID',
  'Payment Terms',
  'Payment Method',
  'Currency',
  'Total Number of Invoices',
  'Total Number of Purchase Orders',
  'Total Number of Payments Paid',
  'Total Number of Payments Due',
  'Total Number of Payments Open',
  'Transaction Count',
  'Total Amount of Invoices',
  'Total Amount of Purchase Orders',
  'Total Amount of Payments Paid',
  'Total Amount of Payments Due',
  'Total Amount of Payments Open',
  'Annual Target Spend',
];

// Alternative labels used in the aliased-header test
const ALIASED_HEADERS = [
  'Vendor #',
  'Vendor Name',
  'Trade Name / DBA',
  'Legal Entity Name',
  'Address Line 1',
  'City / State',
  'ZIP',
  'Nation',
  'Tel',
  'E-Mail',
  'EIN / TIN',
  'Net Terms',
  'Pay Method',
  'CCY',
  '# Invoices',
  '# POs',
  '# Pmts Paid',
  '# Pmts Due',
  '# Pmts Open',
  'Txn Count',
  'Inv Amt Total',
  'PO Amt Total',
  'Paid Amt Total',
  'Due Amt Total',
  'Open Amt Total',
  'Annual Spend Target',
];

// ─── Data row generator ───────────────────────────────────────────────────────

const PAYMENT_TERMS   = ['Net 30', 'Net 60', 'Net 90', '2/10 Net 30', 'Due on Receipt'];
const PAYMENT_METHODS = ['ACH', 'Wire Transfer', 'Check', 'Credit Card'];
const CURRENCIES      = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const COUNTRIES       = ['United States', 'Germany', 'United Kingdom', 'Canada', 'Australia'];
const CITY_STATES     = ['Austin, TX', 'New York, NY', 'Chicago, IL', 'Seattle, WA', 'Miami, FL'];

function generateDataRow(i) {
  const base = 1000 + i;
  return [
    `SUP-${base}`,                                    // Supplier ID
    `Acme Supplier Solutions ${i} LLC`,               // Supplier Name
    `AcmeSup${i}`,                                    // Supplier Alias
    `Acme Supplier Solutions ${i} LLC (Legal)`,       // Supplier Legal Name
    `${100 + i} Commerce Blvd`,                       // Street Address
    CITY_STATES[i % CITY_STATES.length],              // City State
    `${70000 + i}`,                                   // Postal Code
    COUNTRIES[i % COUNTRIES.length],                  // Country
    `+1-512-${String(555000 + i).slice(-7)}`,         // Phone Number
    `supplier${base}@acmesolutions.com`,              // Email Address
    `${82 + (i % 10)}-${String(1000000 + i * 7)}`,   // Tax ID
    PAYMENT_TERMS[i % PAYMENT_TERMS.length],          // Payment Terms
    PAYMENT_METHODS[i % PAYMENT_METHODS.length],      // Payment Method
    CURRENCIES[i % CURRENCIES.length],                // Currency
    10 + (i % 50),                                    // Total Number of Invoices
    5  + (i % 30),                                    // Total Number of Purchase Orders
    8  + (i % 40),                                    // Total Number of Payments Paid
    2  + (i % 15),                                    // Total Number of Payments Due
    1  + (i % 10),                                    // Total Number of Payments Open
    20 + (i % 80),                                    // Transaction Count
    50000  + i * 150,                                 // Total Amount of Invoices
    45000  + i * 120,                                 // Total Amount of Purchase Orders
    40000  + i * 100,                                 // Total Amount of Payments Paid
    5000   + i * 30,                                  // Total Amount of Payments Due
    3000   + i * 20,                                  // Total Amount of Payments Open
    100000 + i * 500,                                 // Annual Target Spend
  ];
}

function buildDataRows(count, startIndex = 0) {
  return Array.from({ length: count }, (_, i) => generateDataRow(startIndex + i));
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function write(wb, filename) {
  const filepath = path.join(OUT_DIR, filename);
  xlsx.writeFile(wb, filepath);
  console.log(`  ✓  ${filename}`);
}

function newWb(sheetName, aoa) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(aoa);
  xlsx.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

// ─── 1. Wide_Valid_Clean_Test.xlsx ────────────────────────────────────────────
// Header at Row 1, 200 data rows, all 26 columns.
console.log('\nGenerating wide-column header detection test files...\n');

{
  const data = [
    SCHEMA_HEADERS,
    ...buildDataRows(200),
  ];
  write(newWb('Supplier Data', data), 'Wide_Valid_Clean_Test.xlsx');
}

// ─── 2. Wide_Valid_Messy_Metadata_Test.xlsx ───────────────────────────────────
// 4 junk rows, blank row, then header at Row 6, 200 data rows.
{
  const data = [
    ['SMARTBRIDGE SUPPLIER MASTER EXPORT'],
    ['Generated On: 2026-06-17'],
    ['Generated By: Finance Operations'],
    ['Classification: Internal Use Only'],
    [],
    SCHEMA_HEADERS,
    ...buildDataRows(200),
  ];
  write(newWb('Supplier Export', data), 'Wide_Valid_Messy_Metadata_Test.xlsx');
}

// ─── 3. Wide_Valid_Deep_Junk_Test.xlsx ────────────────────────────────────────
// 30 metadata/disclaimer rows, blank row, header at Row 32, 180 data rows.
{
  const metaLines = Array.from({ length: 28 }, (_, i) =>
    [`Metadata field ${i + 1}: Value ${i + 1}`]
  );
  const data = [
    ['SMARTBRIDGE ENTERPRISE VENDOR REPORT — CONFIDENTIAL'],
    ['DO NOT DISTRIBUTE OUTSIDE FINANCE DIVISION'],
    ...metaLines,
    [],
    SCHEMA_HEADERS,
    ...buildDataRows(180),
  ];
  write(newWb('Vendor Report', data), 'Wide_Valid_Deep_Junk_Test.xlsx');
}

// ─── 4. Wide_Valid_Sparse_Data_Test.xlsx ──────────────────────────────────────
// Clean header, 200 rows with ~35% of optional columns randomly empty.
{
  // Columns 2-13 are optional-ish; mark indices 2,3,6,8,9,12,13 as sparse
  const SPARSE_COLS = new Set([2, 3, 6, 8, 9, 12, 13]);

  const sparseRows = buildDataRows(200).map(row =>
    row.map((val, idx) => (SPARSE_COLS.has(idx) && Math.random() < 0.35 ? '' : val))
  );

  const data = [
    ['SMARTBRIDGE SPARSE SUPPLIER EXPORT'],
    ['Note: Some optional fields may be blank.'],
    [],
    SCHEMA_HEADERS,
    ...sparseRows,
  ];
  write(newWb('Sparse Supplier Export', data), 'Wide_Valid_Sparse_Data_Test.xlsx');
}

// ─── 5. Wide_Valid_Aliased_Headers_Test.xlsx ──────────────────────────────────
// Same 26 columns but with real-world synonym labels instead of schema labels.
// Simulates a supplier export using their own internal column names.
{
  const data = [
    ['VENDOR MASTER EXTRACT — EXTERNAL SYSTEM'],
    ['Source: ERP Export Module v3.2'],
    [],
    ALIASED_HEADERS,
    ...buildDataRows(200),
  ];
  write(newWb('Vendor Master', data), 'Wide_Valid_Aliased_Headers_Test.xlsx');
}

// ─── 6. Wide_Valid_Partial_Schema_Test.xlsx ───────────────────────────────────
// Only 22 of 26 schema columns (drop Alias, Postal Code, Tax ID, Annual Target Spend).
{
  const DROP_INDICES = new Set([2, 6, 10, 25]);
  const partialHeaders = SCHEMA_HEADERS.filter((_, i) => !DROP_INDICES.has(i));

  const partialRows = buildDataRows(200).map(row =>
    row.filter((_, i) => !DROP_INDICES.has(i))
  );

  const data = [
    ['VENDOR PAYMENT SUMMARY REPORT'],
    ['Partial schema — 4 fields omitted by source system'],
    [],
    partialHeaders,
    ...partialRows,
  ];
  write(newWb('Partial Schema', data), 'Wide_Valid_Partial_Schema_Test.xlsx');
}

// ─── 7. Wide_Invalid_No_Header_Test.xlsx ──────────────────────────────────────
// 220 pure data rows, no header row at all.
// Engine should score no row >= 50 and fall back to manual.
{
  const data = buildDataRows(220);
  write(newWb('Raw Data Dump', data), 'Wide_Invalid_No_Header_Test.xlsx');
}

// ─── 8. Wide_Invalid_Pivoted_Years_Test.xlsx ──────────────────────────────────
// Row 1 = dimension labels; Row 2 = wide horizontal year series (pivoted header).
// Engine should detect as pivoted and reject auto-mapping.
{
  const YEARS = Array.from({ length: 22 }, (_, i) => 2003 + i); // 2003–2024

  const data = [
    ['ANNUAL SUPPLIER SPEND TREND ANALYSIS'],
    ['Supplier Name', 'Category', ...YEARS],
  ];

  // 200 data rows — each with spend values per year
  for (let i = 0; i < 200; i++) {
    const row = [
      `Acme Supplier ${i}`,
      i % 2 === 0 ? 'Direct Materials' : 'Indirect Services',
      ...YEARS.map((_, y) => 50000 + i * 100 + y * 500),
    ];
    data.push(row);
  }

  write(newWb('Pivoted Trend', data), 'Wide_Invalid_Pivoted_Years_Test.xlsx');
}

// ─── 9. Wide_Mixed_Types_Top_Test.xlsx ───────────────────────────────────────
// Dense mixed-type junk rows (strings + numbers + dates) at the top,
// then the full 26-column header, then 200 data rows.
// The strongest test for Signals H (Numeric Penalty) and I (Pure Data Penalty).
{
  const data = [
    // Row 1: dense mixed-type summary row (should score low due to Numeric Penalty)
    ['Total Suppliers:', 847, 'Active:', 712, 'Inactive:', 135, 'YTD Spend:', 42500000,
     'Q2 Spend:', 9800000, 'As Of:', '2026-06-17', '', '', '', '',
     '', '', '', '', '', '', '', '', '', '', '', ''],

    // Row 2: key-value pairs across many columns
    ['Region:', 'Global', 'FY:', 2026, 'Currency:', 'USD', 'Report:', 'FINAL',
     'Division:', 'Finance', 'Owner:', 'CFO Office', '', '', '', '',
     '', '', '', '', '', '', '', '', '', ''],

    // Row 3: another dense numeric summary
    [150000, 280000, 410000, 560000, 720000, 890000, 1050000, 1220000,
     1400000, 1590000, 1780000, 1970000, 2160000, 2360000, 2560000, 2760000,
     2960000, 3160000, 3370000, 3580000, 3800000, 4020000, 4250000, 4480000,
     4720000, 4960000],

    // Row 4: blank
    [],

    // Row 5: true 26-column header — should score highest
    SCHEMA_HEADERS,

    ...buildDataRows(200),
  ];
  write(newWb('Mixed Top Export', data), 'Wide_Mixed_Types_Top_Test.xlsx');
}

console.log('\nAll 9 wide-column test files generated successfully.\n');
