import { sanitizeAndSplit, removeStopWords, lemmatize, runMappingEngine } from '../frontend/src/features/mappingReview/mappingEngine';

console.log('--- Testing Pipeline ---');
const headers = [
  'SupplierName',
  'taxid',
  'Count of all invoices',
  'suplier',
  'payment terms',
  'Total Spend',
  'PO total',
  'Contact Email'
];

for (const h of headers) {
  const step1 = sanitizeAndSplit(h);
  const step2 = removeStopWords(step1);
  const step3 = lemmatize(step2);
  console.log(`Original: "${h}"`);
  console.log(`  Phase 1 (Sanitize):`, step1);
  console.log(`  Phase 2 (No Stop): `, step2);
  console.log(`  Phase 3 (Lemmatize):`, step3);
  console.log('');
}

console.log('--- Testing Matching ---');
const result = runMappingEngine(headers, 0.4);

for (const [targetId, mapped] of Object.entries(result.mappings)) {
  if (mapped.length > 0) {
    console.log(`Target: ${targetId} -> Mapped: ${mapped.join(', ')} (Score: ${result.confidenceScores[targetId].toFixed(2)})`);
  }
}
