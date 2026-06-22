"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMappingEngine = exports.runDeepScanEngine = exports.deepScanSanitizeAndSplit = exports.runStandardEngine = exports.getWeightedMatchScore = exports.lemmatize = exports.removeStopWords = exports.sanitizeAndSplit = void 0;
exports.splitWordByDictionary = splitWordByDictionary;
const matching_engine_config_json_1 = __importDefault(require("./matching_engine_config.json"));
const schema_1 = require("./schema");
const configData = matching_engine_config_json_1.default.matching_engine_config;
const stopWordsSet = new Set(configData.nlp_config.stop_words);
const invertedBaseTokensMap = new Map();
const knownVocabulary = new Set(configData.nlp_config.stop_words);
for (const [baseToken, synonyms] of Object.entries(configData.nlp_config.base_tokens)) {
    knownVocabulary.add(baseToken);
    for (const synonym of synonyms) {
        invertedBaseTokensMap.set(synonym, baseToken);
        knownVocabulary.add(synonym);
    }
}
// Compound words map removed.
// Map target signatures to target header IDs
const targetSignaturesMap = new Map();
for (const [label, signature] of Object.entries(configData.target_signatures)) {
    const targetHeader = schema_1.TARGET_HEADERS.find(th => th.label === label);
    if (targetHeader) {
        // Crucial Fix: Lemmatize the target signature so it speaks the exact same base-token language as the input!
        // Since lemmatize is defined further down, we will do a simple inline replacement using the maps directly.
        const lemmatizedSignature = [];
        for (const token of signature) {
            if (invertedBaseTokensMap.has(token)) {
                lemmatizedSignature.push(...invertedBaseTokensMap.get(token).split(' '));
            }
            else {
                lemmatizedSignature.push(token);
            }
        }
        targetSignaturesMap.set(targetHeader.id, lemmatizedSignature);
        for (const token of lemmatizedSignature) {
            knownVocabulary.add(token);
        }
    }
}
// Phase 1: Algorithm to split word based on dictionary
function splitWordByDictionary(word) {
    if (knownVocabulary.has(word))
        return [word];
    // Try dynamic splitting for concatenated words (e.g. Suppliername -> Supplier, name)
    // This matches words by slicing at every index to check if both left and right sides are valid known words.
    for (let i = 1; i < word.length; i++) {
        const left = word.slice(0, i);
        const right = word.slice(i);
        // If both left and right are known words, we split them.
        if (knownVocabulary.has(left) && knownVocabulary.has(right)) {
            return [left, right];
        }
    }
    return [word];
}
const sanitizeAndSplit = (text) => {
    if (!text)
        return [];
    // Replace underscores and dashes with spaces
    let sanitized = text.replace(/[_-]/g, ' ');
    // CamelCase splitting (insert space before uppercase letters)
    let camelSplit = sanitized.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Lowercase and keep only alphanumeric and spaces
    let cleanText = camelSplit.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    // Multi-word phrase replacement before tokenization (Removed - handled by base_tokens now)
    let rawTokens = cleanText.split(' ');
    // Apply dynamic dictionary splitting
    let finalTokens = [];
    for (const token of rawTokens) {
        if (!token)
            continue;
        const splitTokens = splitWordByDictionary(token);
        finalTokens.push(...splitTokens);
    }
    return finalTokens;
};
exports.sanitizeAndSplit = sanitizeAndSplit;
// Phase 2: Noise Reduction
const removeStopWords = (tokens) => {
    return tokens.filter(token => !stopWordsSet.has(token));
};
exports.removeStopWords = removeStopWords;
// Phase 3: Semantic Translation (Now supports N-grams)
const lemmatize = (tokens) => {
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
        // 3-gram
        if (i < tokens.length - 2) {
            const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
            if (invertedBaseTokensMap.has(trigram)) {
                result.push(...invertedBaseTokensMap.get(trigram).split(' '));
                i += 2;
                continue;
            }
        }
        // 2-gram
        if (i < tokens.length - 1) {
            const bigram = `${tokens[i]} ${tokens[i + 1]}`;
            if (invertedBaseTokensMap.has(bigram)) {
                result.push(...invertedBaseTokensMap.get(bigram).split(' '));
                i += 1;
                continue;
            }
        }
        // 1-gram
        if (invertedBaseTokensMap.has(tokens[i])) {
            result.push(...invertedBaseTokensMap.get(tokens[i]).split(' '));
        }
        else {
            result.push(tokens[i]);
        }
    }
    return result;
};
exports.lemmatize = lemmatize;
// Levenshtein distance for Tier 3 Fuzzy Match
const levenshtein = (a, b) => {
    const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++)
        matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++)
        matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[a.length][b.length];
};
// Phase 4: Cascading Signature Matching (Weighted Jaccard with TF-IDF)
const tokenFrequency = new Map();
let totalSignatures = 0;
for (const signature of targetSignaturesMap.values()) {
    totalSignatures++;
    const uniqueTokens = new Set(signature);
    for (const token of uniqueTokens) {
        tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
    }
}
const getTokenWeight = (token) => {
    const freq = tokenFrequency.get(token);
    if (!freq)
        return 0.2; // Unknown extra tokens get a minor weight penalty (likely noise)
    return 1.0 / freq; // Inverse Document Frequency weight
};
// ... (keep previous config loading) ...
const getWeightedMatchScore = (inputTokens, targetTokens, debugLines) => {
    let matchedWeight = 0;
    let inputWeight = 0;
    let targetWeight = 0;
    for (const t of targetTokens)
        targetWeight += getTokenWeight(t);
    if (debugLines) {
        debugLines.push(`Target Signature: [${targetTokens.join(', ')}] (Total Weight: ${targetWeight.toFixed(2)})`);
    }
    for (const iToken of inputTokens) {
        const exactIndex = targetTokens.indexOf(iToken);
        if (exactIndex !== -1) {
            // Exact token match
            const weight = getTokenWeight(iToken);
            matchedWeight += weight;
            inputWeight += weight;
            if (debugLines)
                debugLines.push(`✅ Exact match: "${iToken}" (+${weight.toFixed(2)} weight)`);
        }
        else {
            // Try fuzzy match
            let bestFuzzyScore = 0;
            let bestMatchIndex = -1;
            for (let j = 0; j < targetTokens.length; j++) {
                const tToken = targetTokens[j];
                if (Math.abs(iToken.length - tToken.length) > 3)
                    continue;
                const dist = levenshtein(iToken, tToken);
                const maxLen = Math.max(iToken.length, tToken.length);
                const score = maxLen === 0 ? 0 : 1 - (dist / maxLen);
                if (score > bestFuzzyScore) {
                    bestFuzzyScore = score;
                    bestMatchIndex = j;
                }
            }
            if (bestFuzzyScore >= 0.7 && bestMatchIndex !== -1) {
                const matchedTToken = targetTokens[bestMatchIndex];
                const weight = getTokenWeight(matchedTToken);
                const addedWeight = bestFuzzyScore * weight;
                matchedWeight += addedWeight;
                inputWeight += weight; // use the target's weight for the input
                if (debugLines)
                    debugLines.push(`⚠️ Fuzzy match: "${iToken}" ≈ "${matchedTToken}" (Similarity ${bestFuzzyScore.toFixed(2)}, +${addedWeight.toFixed(2)} weight)`);
            }
            else {
                // Unmatched extra token
                const noiseWeight = getTokenWeight(iToken);
                inputWeight += noiseWeight;
                if (debugLines)
                    debugLines.push(`❌ Unmatched noise: "${iToken}" (-${noiseWeight.toFixed(2)} penalty)`);
            }
        }
    }
    const denominator = targetWeight + inputWeight - matchedWeight;
    const rawScore = denominator <= 0 ? 0 : matchedWeight / denominator;
    const score = Math.min(1.0, rawScore);
    if (debugLines) {
        debugLines.push(`Score Calculation: ${matchedWeight.toFixed(2)} / (${targetWeight.toFixed(2)} + ${inputWeight.toFixed(2)} - ${matchedWeight.toFixed(2)}) = ${(score * 100).toFixed(1)}%`);
    }
    return score;
};
exports.getWeightedMatchScore = getWeightedMatchScore;
const deferredAmbiguityResolution = (allPairs, threshold, mappings, confidenceScores, debugLogs) => {
    allPairs.sort((a, b) => b.score - a.score);
    const sourceTopScores = new Map();
    const ambiguousSources = new Set();
    for (const pair of allPairs) {
        if (!sourceTopScores.has(pair.source)) {
            sourceTopScores.set(pair.source, pair.score);
        }
        else {
            const topScore = sourceTopScores.get(pair.source);
            if (topScore - pair.score <= 0.05 && pair.score >= threshold) {
                ambiguousSources.add(pair.source);
            }
        }
    }
    const mappedSources = new Set();
    const mappedTargets = new Set();
    // Pass 1: Assign Non-Ambiguous
    for (const pair of allPairs) {
        if (pair.score >= threshold && !ambiguousSources.has(pair.source)) {
            if (!mappedSources.has(pair.source) && !mappedTargets.has(pair.targetId)) {
                mappings[pair.targetId].push(pair.source);
                confidenceScores[pair.targetId] = pair.score;
                debugLogs[pair.targetId] = pair.debugLines;
                mappedSources.add(pair.source);
                mappedTargets.add(pair.targetId);
            }
        }
    }
    // Pass 2: Resolve Ambiguous
    const remainingAmbiguousPairs = allPairs.filter(p => ambiguousSources.has(p.source) &&
        !mappedSources.has(p.source) &&
        p.score >= threshold);
    const ambiguousGroups = new Map();
    for (const p of remainingAmbiguousPairs) {
        if (!ambiguousGroups.has(p.source))
            ambiguousGroups.set(p.source, []);
        ambiguousGroups.get(p.source).push(p);
    }
    for (const [source, pairs] of ambiguousGroups.entries()) {
        const lowerSource = source.toLowerCase();
        // Crucial Fix: Do NOT apply the grammar tie breaker if the source explicitly contains "amount" or "number" (or their base tokens)
        const hasExplicitAmount = lowerSource.includes('amount') || lowerSource.includes('value') || lowerSource.includes('cost') || lowerSource.includes('sum');
        const hasExplicitNumber = lowerSource.includes('number') || lowerSource.includes('count') || lowerSource.includes('qty') || lowerSource.includes('freq');
        const isExplicitlyStated = hasExplicitAmount || hasExplicitNumber;
        if (!isExplicitlyStated) {
            const isPlural = source.endsWith('s') || /s\b/.test(source) || lowerSource.includes('orders') || lowerSource.includes('invoices') || lowerSource.includes('payments');
            const isSingular = !isPlural;
            for (const p of pairs) {
                if (mappedTargets.has(p.targetId))
                    continue;
                const targetHeader = schema_1.TARGET_HEADERS.find(t => t.id === p.targetId);
                if (!targetHeader)
                    continue;
                const tLabel = targetHeader.label.toLowerCase();
                const targetIsCount = tLabel.includes('number') || tLabel.includes('count') || tLabel.includes('transaction');
                const targetIsAmount = tLabel.includes('amount') || tLabel.includes('value');
                let bonus = 0;
                if (isPlural && targetIsCount)
                    bonus = 0.10;
                if (isSingular && targetIsAmount)
                    bonus = 0.10;
                if (bonus > 0) {
                    p.score += bonus;
                    p.debugLines.push(`\n✨ Deferred Tie-Breaker Applied: +10% bonus because ${isPlural ? 'plural source maps to count target' : 'singular source maps to amount target'}`);
                }
            }
        }
        else {
            if (pairs.length > 0) {
                pairs[0].debugLines.push(`\n👔 Grammar Tie-Breaker Skipped: Source explicitly states amount/number.`);
            }
        }
        pairs.sort((a, b) => b.score - a.score);
        for (const p of pairs) {
            if (!mappedTargets.has(p.targetId)) {
                mappings[p.targetId].push(p.source);
                confidenceScores[p.targetId] = p.score;
                debugLogs[p.targetId] = p.debugLines;
                mappedSources.add(p.source);
                mappedTargets.add(p.targetId);
                break;
            }
        }
    }
};
const runStandardEngine = (sourceHeaders, threshold = 0.5) => {
    const mappings = {};
    const confidenceScores = {};
    const debugLogs = {};
    schema_1.TARGET_HEADERS.forEach(th => {
        mappings[th.id] = [];
        confidenceScores[th.id] = 0;
        debugLogs[th.id] = [];
    });
    const allPairs = [];
    for (const sourceHeader of sourceHeaders) {
        // Pipeline
        const step1 = (0, exports.sanitizeAndSplit)(sourceHeader);
        const step2 = (0, exports.lemmatize)(step1);
        const step3 = (0, exports.removeStopWords)(step2);
        for (const [targetId, signatureTokens] of targetSignaturesMap.entries()) {
            const debugLines = [];
            debugLines.push(`Source: "${sourceHeader}"`);
            debugLines.push(`1. Sanitized: [${step1.join(', ')}]`);
            debugLines.push(`2. Lemmatized: [${step2.join(', ')}]`);
            debugLines.push(`3. Stop Words Removed: [${step3.join(', ')}]`);
            const score = (0, exports.getWeightedMatchScore)(step3, signatureTokens, debugLines);
            if (score > 0) {
                allPairs.push({ source: sourceHeader, targetId, score, debugLines });
            }
        }
    }
    deferredAmbiguityResolution(allPairs, threshold, mappings, confidenceScores, debugLogs);
    return { mappings, confidenceScores, debugLogs };
};
exports.runStandardEngine = runStandardEngine;
// --- V2: GREEDY DYNAMIC SEGMENTER ---
const greedySegmenter = (word, debugLines) => {
    const result = [];
    let i = 0;
    let unknownChunk = '';
    const flushUnknown = () => {
        if (unknownChunk.length > 0) {
            if (debugLines)
                debugLines.push(`❌ Deep Scan skipped unknown string: "${unknownChunk}"`);
            result.push(unknownChunk);
            unknownChunk = '';
        }
    };
    while (i < word.length) {
        let matched = false;
        for (let len = word.length - i; len >= 3; len--) {
            const slice = word.slice(i, i + len);
            if (knownVocabulary.has(slice)) {
                flushUnknown();
                if (debugLines)
                    debugLines.push(`✅ Deep Scan locked 100% prefix match: "${slice}"`);
                result.push(slice);
                i += len;
                matched = true;
                break;
            }
        }
        if (matched)
            continue;
        let bestFuzzyScore = 0;
        let bestSliceLen = 0;
        let bestMatchedVocab = '';
        for (let len = word.length - i; len >= 3; len--) {
            const slice = word.slice(i, i + len);
            for (const vocabToken of knownVocabulary) {
                if (Math.abs(slice.length - vocabToken.length) > 2)
                    continue;
                const dist = levenshtein(slice, vocabToken);
                const maxLen = Math.max(slice.length, vocabToken.length);
                const score = maxLen === 0 ? 0 : 1 - (dist / maxLen);
                if (score > bestFuzzyScore) {
                    bestFuzzyScore = score;
                    bestSliceLen = len;
                    bestMatchedVocab = vocabToken;
                }
            }
        }
        if (bestFuzzyScore >= 0.7 && bestSliceLen >= 3) {
            flushUnknown();
            const slice = word.slice(i, i + bestSliceLen);
            if (debugLines)
                debugLines.push(`⚠️ Deep Scan locked fuzzy prefix match: "${slice}" ≈ "${bestMatchedVocab}" (${(bestFuzzyScore * 100).toFixed(0)}%)`);
            result.push(bestMatchedVocab);
            i += bestSliceLen;
            continue;
        }
        unknownChunk += word.charAt(i);
        i += 1;
    }
    flushUnknown();
    return result;
};
const deepScanSanitizeAndSplit = (text, debugLines) => {
    if (!text)
        return [];
    let sanitized = text.replace(/[_-]/g, ' ');
    let cleanText = sanitized.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    let rawTokens = cleanText.split(' ');
    let finalTokens = [];
    for (const token of rawTokens) {
        if (!token)
            continue;
        const splitTokens = greedySegmenter(token, debugLines);
        finalTokens.push(...splitTokens);
    }
    return finalTokens;
};
exports.deepScanSanitizeAndSplit = deepScanSanitizeAndSplit;
const runDeepScanEngine = (sourceHeaders, threshold = 0.5) => {
    const mappings = {};
    const confidenceScores = {};
    const debugLogs = {};
    schema_1.TARGET_HEADERS.forEach(th => {
        mappings[th.id] = [];
        confidenceScores[th.id] = 0;
        debugLogs[th.id] = [];
    });
    const allPairs = [];
    for (const sourceHeader of sourceHeaders) {
        for (const [targetId, signatureTokens] of targetSignaturesMap.entries()) {
            const debugLines = [];
            debugLines.push(`Source: "${sourceHeader}"`);
            const step1 = (0, exports.deepScanSanitizeAndSplit)(sourceHeader, debugLines);
            debugLines.push(`1. Deep Scan Segmented: [${step1.join(', ')}]`);
            const step2 = (0, exports.lemmatize)(step1);
            debugLines.push(`2. Lemmatized: [${step2.join(', ')}]`);
            const step3 = (0, exports.removeStopWords)(step2);
            debugLines.push(`3. Stop Words Removed: [${step3.join(', ')}]`);
            const score = (0, exports.getWeightedMatchScore)(step3, signatureTokens, debugLines);
            if (score > 0) {
                allPairs.push({ source: sourceHeader, targetId, score, debugLines });
            }
        }
    }
    deferredAmbiguityResolution(allPairs, threshold, mappings, confidenceScores, debugLogs);
    return { mappings, confidenceScores, debugLogs };
};
exports.runDeepScanEngine = runDeepScanEngine;
// --- ROUTER ---
const runMappingEngine = (sourceHeaders, threshold = 0.5, engineVersion = 'v1') => {
    if (engineVersion === 'v2') {
        return (0, exports.runDeepScanEngine)(sourceHeaders, threshold);
    }
    return (0, exports.runStandardEngine)(sourceHeaders, threshold);
};
exports.runMappingEngine = runMappingEngine;
