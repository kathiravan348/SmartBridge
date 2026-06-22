## Value Statement
As an engineering team,
I want to explore approaches for enabling flexible file uploads with automatic header-based mapping to canonical fields,
so that we can recommend a scalable, reliable, and user-friendly solution for ingestion without predefined templates.

## Description
This spike explores enabling flexible file ingestion without predefined templates by automatically mapping CSV and Excel headers to canonical fields with user validation. It evaluates rule-based, heuristic, hybrid, and AI-assisted mapping approaches to identify the most scalable and reliable option. The spike also assesses a modular AI vs non-AI architecture with defined fallback behavior to ensure graceful degradation. Key challenges such as multilingual headers, ambiguous mappings, data quality issues, and parallel processing are considered. The outcome is a clear recommendation on mapping strategy, architecture, and user interaction model, along with key risks and trade-offs to support implementation decisions.

## Scope of Exploration
**This spike will investigate and evaluate:**
- **Support for CSV and Excel file formats (first sheet only for Excel)**
- **Techniques for automatic header row detection**
- **Methods for extracting headers and mapping them to canonical fields**
- **Header-name-based mapping approaches only (no value/sample-based inference)**

### Comparison of mapping strategies:
- Rule-based (**deterministic matching**)
- Heuristic / **similarity-based matching**
- Hybrid approaches combining both
- Exploration of **AI-based mapping approaches** as a separate module alongside non-AI solutions

### Mechanisms for:
- Generating **ranked mapping suggestions** for ambiguous matches
- Enabling **user confirmation and manual override of mappings**
- Enforcing **required field mapping before ingestion**

### AI vs Non-AI Architecture & Fallback
- Evaluation of **separate, decoupled modules**:
  - Non-AI mapping (rule-based + similarity-based)
  - AI-integrated mapping approach
- Exploration of **interchangeability between modules**
- Definition of **fallback behaviour**, including:
  - AI failure (timeout, service issues)
  - Low confidence output
  - Incomplete required field mapping
  - Ambiguous or conflicting mappings
- Evaluation of **fallback strategy (AI → non-AI)** ensuring graceful degradation

### Multilingual Header Handling
- Exploration of approaches to handle **headers in different languages**, including:
  - Alias/dictionary-based mapping
  - Normalization (UTF-8, accents, tokenization)
  - Translation-assisted approaches
- Assessment of **trade-offs and scalability** of each approach

### Evaluation of constraints and behaviors:
- Handling **duplicate headers** (error scenarios)
- Supporting **strict one-to-one mapping** between source and canonical fields
- Ignoring **unmapped extra columns**

### Handling Data Quality & Parsing Issues
- Detection and handling of:
  - **Corrupt or unreadable headers**
  - **Missing header rows**
  - **Encoding issues**
- Evaluation of:
  - **Auto-normalization vs user intervention**
  - Definition of **recoverable vs blocking scenarios**
- Identification of **file parsing constraints and assumptions** (e.g., delimiters, encoding, formatting, etc.) as needed during exploration

> [!NOTE]
> Optional:
> ### Parallel Processing & Ingestion Control
> - Exploration of **parallel processing of multiple files**
> - Evaluation of:
>   - **File-level isolation** (failures do not affect other files)
>   - **Header mapping as a gating step per file**
> - Comparison of:
>   - Blocking ingestion model (default)
>   - Optional **asynchronous “fix later” model**

### Exploration of:
- Persisting **user-confirmed mappings for reuse**
- Potential for **client-specific mapping templates/profiles** ⚠️ (possible to do later down the line.)
- Integration considerations with the **existing ingestion workflow (conceptual only, not implementation)**

### Out of Scope
- Implementation of production-ready ingestion flow
- Full system integration or deployment
- Sample data / value-based inference
- Multi-sheet Excel support
- Data transformation, cleansing, or enrichment
- Fully automated ingestion without user validation
- PDF/image-based ingestion (including OCR or document parsing)

## Expected Deliverables
- Comparative analysis of mapping approaches (**rule-based, similarity-based, hybrid, AI vs non-AI**) with pros/cons and trade-offs
- Recommendation for:
  - Preferred mapping strategy
  - **AI vs non-AI usage model**
  - **Fallback strategy and trigger conditions**
  - Confidence scoring / ranking approach
  - User interaction model (confirmation, overrides)
- Defined assumptions and constraints for:
  - File parsing
  - Encoding handling
  - Header quality scenarios
- Suggested **architecture**:
  - Modular design (AI vs non-AI)
  - Fallback orchestration
  - Placement of mapping logic
- Recommendation on **persistence and reuse of mappings**
- Identified **risks, limitations, and edge cases**, including:
  - Multilingual complexity
  - Large file handling
  - Performance and concurrency considerations

## Key Success Criteria
- Clear understanding of **feasible approaches and trade-offs**
- Defined **recommended approach with justification**, including:
  - Mapping strategy
  - AI vs non-AI positioning
  - Fallback behaviour
- Identification of **risks and design considerations** needed for implementation
- Alignment-ready outputs for **engineering and product decision-making**
- Confidence that the proposed approach:
  - **Scales across file formats and sizes**
  - Handles **real-world variability (languages, corruption, inconsistencies)**
  - Provides **reliable fallback without failure**
