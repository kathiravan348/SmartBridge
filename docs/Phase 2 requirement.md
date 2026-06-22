Canonical Field Mapping (Phase 2)

## 1. Overview
This requirement document outlines the implementation phase for the **Cascading Mapping Engine** within Project Antigravity. Building upon the successfully deployed Header Auto-Detection engine, this phase focuses strictly on high-speed, 100% client-side data mapping. 

To ensure maximum processing velocity and low overhead, this phase is limited to deterministic and lexical mapping. Data Extraction (Stage 3) and Vector Semantic Fallback are explicitly deferred.

## 2. Value Statement
As an engineering team, we need to implement a fast, robust, and client-side cascading mapping pipeline (Exact Match + Lexical Recovery) so that we can accurately map detected file headers to our canonical database schema without relying on heavy AI models or server-side processing.

## 3. In-Scope Implementation Areas

### Stage 4, Layer 1: Deterministic Exact & Alias Mapping (~0 ms)
Implementation of the foundational exact-match lookup system.
* **Text Cleansing & Normalization Sequence:**
    * Implement a pure JavaScript utility to trim spacing, enforce lowercase formatting, and strip special punctuation.
    * Convert all varying whitespace blocks to uniform underscores (e.g., `_`).
* **Alias Dictionary Engine:**
    * Implement a flat JSON dictionary structure capable of scaling to ~600-1,500 rows.
    * Support mapping of our 25 core target keys across 5 global languages (including 5-10 structural phrasing variations per key).

### Stage 4, Layer 2: Lexical Recovery (1-5 ms)
Implementation of the secondary fallback layer to catch out-of-order words and minor typos.
* **BM25 Integration (`wink-bm25`):**
    * Integrate the `wink-bm25` package (50KB pure JS library).
    * Configure the engine to score word rarity and token overlap to match reordered phrases (e.g., accurately mapping "name of the customer" to the canonical `customer_name`).
* **Trigram Jaccard Pass:**
    * Implement a structural overlap calculator that breaks incoming unmapped header text into 3-character blocks (trigrams).
    * Use this to repair and map minor spelling errors (e.g., correcting "custmer_name" to `customer_name`).

## 4. Architecture & UI Integration
* **Confidence UI Handoff:** The mapping engine must pass confidence scores back to the UI.
    * Exact Alias Matches = **High Confidence (≥ 50%)** → Auto-selected with a green badge.
    * Lexical Recovery Matches = Requires threshold tuning. If the `wink-bm25` or Trigram score falls below the accepted certainty threshold, it must trigger the **Unpredictable File (< 50%)** state, leaving the field blank and forcing manual user selection from a dropdown.
* **Web Worker Execution:** The BM25 index generation and mapping operations must execute inside a background Web Worker thread to prevent UI freezing during the evaluation of large header sets.

## 5. Out of Scope (Deferred)
* **Stage 3: Data Extraction:** Translating the mapped data into JSON payloads is excluded from this phase.
* **Stage 4, Layer 3: Vector Semantic Fallback:**
    * Integration of `@xenova/transformers` or ONNX Runtime Web.
    * Any loading, caching (IndexedDB), or execution of the `paraphrase-multilingual-MiniLM-L12-v2` embedding model.
    * Cosine similarity calculations.

## 6. Key Success Criteria
* **Performance:** Layer 1 and Layer 2 mapping operations execute in under **10ms** total per file.
* **Bundle Size:** The addition of `wink-bm25` and the alias dictionary adds no more than **100KB** to the client-side bundle.
* **Accuracy:** 100% match rate on exact dictionary aliases; successful recovery of randomized minor typos via the Trigram pass.
* **Stability:** Lexical indexing does not crash the browser or freeze the main UI thread.