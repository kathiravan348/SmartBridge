const { performance } = require('perf_hooks');
const bm25 = require('wink-bm25-text-search');
const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, '../src/features/mappingReview/possible_english_keys.json');
const aliasDict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

const cleanseText = (text) => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '_');
};

const getTrigrams = (str) => {
  const trigrams = new Set();
  const padded = `  ${str}  `;
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
};

const trigramSimilarity = (str1, str2) => {
  const set1 = getTrigrams(str1);
  const set2 = getTrigrams(str2);
  let intersectionSize = 0;
  for (const t of set1) {
    if (set2.has(t)) intersectionSize++;
  }
  const unionSize = set1.size + set2.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
};

const prepTask = (text) => {
  if (!text) return [];
  return text.toLowerCase().split(/\s+/).map(t => t.replace(/[^a-z0-9]/g, '')).filter(t => t);
};

const sourceHeaders = [];
for (let i = 0; i < 50; i++) {
  sourceHeaders.push(`vendor id ${i}`);
  sourceHeaders.push(`random_unmapped_${i}`);
  sourceHeaders.push(`custmer name`);
}

const runMappingEngine = () => {
  const unmappedSources = new Set(sourceHeaders);

  // Exact Match Pass
  for (const sourceHeader of Array.from(unmappedSources)) {
    const cleansedSource = cleanseText(sourceHeader);
    for (const [targetKey, aliases] of Object.entries(aliasDict)) {
      const cleansedAliases = aliases.map(a => cleanseText(a));
      if (cleansedAliases.includes(cleansedSource)) {
        unmappedSources.delete(sourceHeader);
        break;
      }
    }
  }

  // Lexical Pass
  if (unmappedSources.size > 0) {
    const engine = bm25();
    engine.defineConfig({ fldWeights: { text: 1 } });
    engine.definePrepTasks([prepTask]);
    
    Object.entries(aliasDict).forEach(([targetKey, aliases]) => {
      const targetId = targetKey.replace(/ /g, '_');
      aliases.forEach(alias => {
        engine.addDoc({ text: alias }, targetId);
      });
    });
    
    engine.consolidate();

    for (const sourceHeader of Array.from(unmappedSources)) {
      let bestTrigramScore = 0;
      for (const [targetKey, aliases] of Object.entries(aliasDict)) {
        for (const alias of aliases) {
          const score = trigramSimilarity(cleanseText(sourceHeader), cleanseText(alias));
          if (score > bestTrigramScore) bestTrigramScore = score;
        }
      }
      engine.search(sourceHeader);
    }
  }
};

const start = performance.now();
runMappingEngine();
const end = performance.now();

console.log(`Execution time for mapping ${sourceHeaders.length} headers: ${(end - start).toFixed(2)} ms`);
