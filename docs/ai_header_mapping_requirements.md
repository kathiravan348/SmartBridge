# Requirements Document: AI-Driven Dynamic Header Mapping

This document details the functional and technical requirements for integrating an AI-assisted header mapping layer into the **SmartBridge File Validation Pipeline**. 

---

## 🎯 Objective

In production, suppliers often provide data in various formats with proprietary, custom, or translated column headers (e.g., `Vendor Num`, `Legal Entity`, `ZIP`, `Tel`). Rather than forcing suppliers to adhere strictly to our 26-column static template, this feature uses **Artificial Intelligence (LLMs)** to dynamically analyze, identify, and map custom source headers to our 26 static target headers, allowing seamless validation and ingestion.

---

## 🏗️ End-to-End Workflow Architecture

```mermaid
sequenceDiagram
    autofunctions
    actor User
    participant UI as Frontend Dashboard
    participant AI as AI Mapping Service (LLM)
    participant Worker as Validation Web Worker
    participant API as Backend API

    User->>UI: Uploads CSV/Excel (Unknown Format)
    UI->>UI: Parse first row (headers) from file
    UI->>AI: Send custom headers + 26 static target headers
    Note over AI: LLM performs semantic matching & synonym mapping
    AI-->>UI: Return JSON mapping (Source -> Target + Confidence)
    UI->>User: Display Mapping Confirmation UI (Visual Review)
    User->>UI: Adjusts manual links & Confirms Mapping
    UI->>Worker: Spin worker & send Mapping Config + raw file data
    Note over Worker: 1. Map raw rows to target schema<br/>2. Chunk into configured batches<br/>3. Run column-level validations
    Worker-->>UI: Progress update & validation results
    Worker->>API: Upload valid chunks with unique File ID
    UI->>User: Show success metrics / Error report dashboard
```

---

## 📋 Technical Requirements

### 1. Header Extraction & Detection (Client-Side)
- **Dynamic Header Row Detection (Multilingual Heuristics)**: To detect the header row across different languages (Spanish, German, Chinese, etc.) without relying on hardcoded English keyword lists, the client-side parsing script will:
  - **Data Type Density Analysis**: Analyze each row for column types. The actual header row is identified as the transition point where cell values are almost exclusively text labels (excluding blank fields), followed by rows containing structured format patterns (numbers, decimal amounts, dates, ISO codes, emails).
  - **Locale Dictionary Scoring**: Check strings against localized dictionary keywords dynamically based on the user's current browser locale.
  - **Manual Offset Override**: Provide a visual row selector in the UI that displays the first 10 rows, enabling users of any language to click and choose their header row manually.
- **Normalization**: Trim whitespace and standardize characters. To generate template hashes, clean the values but do not translate them, preserving the original file schema's hash.

### 2. Invariant Programmatic Slugs
To prevent localized UI titles from breaking backend validation or parsing schemas, the system maps source headers directly to **invariant programmatic slugs** (keys). The UI translation layer maps these slugs to the active language at render time.

| Invariant Slug | English UI Label | Data Type | Requirement |
|---|---|---|---|
| `supplier_id` | Supplier ID | Alphanumeric | Mandatory |
| `supplier_name` | Supplier Name | String | Mandatory |
| `supplier_alias` | Supplier Alias | String | Optional |
| `supplier_legal_name` | Supplier Legal name | String | Mandatory |
| `street_address` | Street Address | String | Mandatory |
| `city_state` | City State | String | Mandatory |
| `postal_code` | Potal Code | Alphanumeric | Mandatory |
| `country` | Country | String | Mandatory |
| `phone_number` | Phone Number | String | Mandatory |
| `email_address` | Email Address | String | Mandatory |
| `tax_id` | Tax Id | String | Mandatory |
| `payment_terms` | Payment Terms | String | Mandatory |
| `payment_method` | Payment Method | String | Mandatory |
| `currency` | Currency | String | Mandatory |
| `total_invoices` | Total Number of Invoices | Integer | Mandatory |
| `total_purchase_orders` | Total Number of Purchase Orders | Integer | Mandatory |
| `total_payments_paid` | Total Number of Payments Paid | Integer | Mandatory |
| `total_payments_due` | Total Number of Paymnets Due | Integer | Mandatory |
| `total_payments_open` | Total Number of Payments open | Integer | Mandatory |
| `transaction_count` | Transaction Count | Integer | Mandatory |
| `total_amount_invoices` | Total Amount of Invoices | Decimal | Mandatory |
| `total_amount_purchase_orders` | Total Amount of Purchase Orders | Decimal | Mandatory |
| `total_amount_payments_paid` | Total Amount of Payments Paid | Decimal | Mandatory |
| `total_amount_payments_due` | Total Amount of Payments Due | Decimal | Mandatory |
| `total_amount_payments_open` | Total Amount of Payments Open | Decimal | Mandatory |
| `annual_target_spend` | Annual Target Spend | Decimal | Mandatory |

### 3. AI Mapping Engine
- **Input Payload**: A list of source headers extracted from the file, combined with the target mapping list of invariant slugs and their semantic definitions.
- **Matching Logic**: The LLM semantically matches source headers in *any language* (e.g. `Nombre de proveedor` or `Lieferantenname`) to the correct invariant slug based on:
  - Multilingual semantic synonym analysis.
  - Provided column descriptions and example values.
- **Prompt Engineering**: Instruct the AI to map raw headers directly to invariant target slugs.

#### 💡 AI Mapping Instructions
The AI engine is configured with a system prompt detailing the target schema and instruction rules:
1. **Target Schema Reference**: The AI receives the list of 26 invariant target keys and their functional definitions.
2. **Translation & Mapping**: The AI matches raw uploaded headers to these keys, supporting semantic synonyms and translation of terms.
3. **Classification**:
   - For mapped columns, the AI assigns a confidence score: High, Medium, or Low.
   - For columns with no match, it flags them as unmapped.

#### 📦 Expected AI Response Data
The AI returns a structured dataset containing:
- **Mappings List**: A collection of pairs, where each pair associates an uploaded column header with an invariant target key along with its matching confidence level.
- **Unmapped Source Columns**: A list of headers present in the uploaded file that the AI could not match.
- **Unmapped Target Columns**: A list of system columns that were not matched to any uploaded file column.

### 4. User Mapping Confirmation UI/UX
- **Visual Mapping Grid**: Displays a card-based layout matching Source Column name to the Suggested Invariant Target Slug.
- **Multilingual UI Translation**: In the UI, display the localized label corresponding to the target slug (e.g., using `t(targetHeader)` or a translations dictionary) so the grid remains fully localized based on the user's active interface language.
- **Confidence Indicators**:
  - 🟢 **High Confidence**: Auto-mapped without requiring user configuration (but editable).
  - 🟡 **Medium/Low Confidence**: Highlighted yellow for user verification.
  - 🔴 **Unmapped**: Left blank, prompting the user to select the appropriate target header slug from a dropdown containing unmapped target slug fields (rendered as localized strings).
- **Column Merging Override UI**: 
  - Provide a "Merge Columns" action toggle for each target field card.
  - Allow the user to select multiple source headers (e.g., checkbox select `first_name` and `last_name` from the uploaded file) and assign them to a single target field (e.g., `supplier_name`).
  - Provide a UI control to choose the merge separator (e.g., space, comma, or comma-space).
- **Template Reusability**: Provide a toggle: *"Save this mapping configuration as a template for future uploads"*. If checked, save the mapping of *Source Headers to Invariant Slugs* locally (e.g. `localStorage` or backend database) indexed by the template hash.

### 5. Data Transformation & Web Worker Validation
- The Web Worker will accept:
  1. The raw parsed JSON rows.
  2. The confirmed mapping configuration JSON (mapping invariant target keys to single source columns or arrays of merged source columns).
- **Re-indexing & Merging Logic**: 
  - The validation worker iterates through the 26 system target columns.
  - If a system field is mapped to a single source column, the cell value is extracted directly.
  - If a system field is mapped to multiple source columns (e.g. combining street and city/state components), the worker automatically merges the cell values using the user-defined separator (such as a space or comma).
  - Unmapped target columns are initialized with blank or null values.
- **Validation Step**: Once re-indexed, perform standard validations (as defined in [project_status.md](file:///d:/Study/SmartBridge/project_status.md)) against the static 26-column schema.
- **Chunking & Upload**: Chunk and stream to the backend.

---

## 🛡️ Edge Cases & Error Handling

| Edge Case Scenario | System Action / Mitigation |
|---|---|
| **Multiple source columns map to the same target** | The UI displays a validation warning preventing submission until the user resolves the collision. |
| **Mandatory target columns are not mapped** | The UI flags missing mandatory columns. The user must either select a source column or acknowledge that those fields will be treated as `null` (which will fail validation if they are mandatory fields like `Supplier Name`). |
| **AI service timeout / downtime** | Fallback to a completely manual mapping UI where the user manually pairs source headers to target headers using drag-and-drop or select lists. |
| **Blank Headers in source file** | Autogenerate placeholder headers (e.g., `Column A`, `Column B`) so the user can still map them. |
| **Header row starts at offset > 1 (e.g., row 3, 4, 5)** | Auto-detect using keyword density and filled-cell ratio. Show preview rows to allow user correction. |

---

## ⚖️ Pros & Cons of the Proposed Architecture

Before implementing this architecture, the following engineering trade-offs should be weighed:

### 👍 Pros (Advantages)
1. **Frictionless Onboarding**: Suppliers can upload files using their own terminology (e.g. `Lieferanten ID`, `Proveedor Num`) without manual formatting changes.
2. **Instant Repeat Uploads**: The SHA-256 template hashing and database mapping cache bypass LLM latency and API token charges for previously mapped formats.
3. **Language & Typo Agnostic**: Semantic AI matching translates column concepts seamlessly across multilingual templates and handles structural abbreviations.
4. **Data Privacy Safety**: Clients mask PII and financial content client-side before sending mapping requests to the external LLM provider.
5. **Interactive UI Review**: The confirmation panel prevents AI hallucination errors from contaminating the backend DB by keeping a human-in-the-loop review.

### 👎 Cons (Drawbacks & Mitigations)
1. **Initial Latency Overhead**: The very first upload of a new supplier template experiences a 1-3 second delay while waiting for the LLM output (Mitigation: Cache subsequent lookups).
2. **Dual-Path UI Complexity**: Developers must build both the automatic review grid and a complete manual drag-and-drop mapping system in case of LLM API timeouts or service failures.
3. **Nondeterminism Risks**: AI matches might misinterpret ambiguous columns (e.g. mapping "Shipping Street" to `street_address` instead of a separate shipping field) (Mitigation: Display confidence flags (🟢/🟡/🔴) on the UI).
4. **Token Usage Costs**: The system prompt and structured JSON schemas require token usage on the initial template upload.

---

## 📋 Detailed Work Items

### 1. Frontend Tasks (React)
- **Header Normalization & Detection**: Scan the first 5-10 rows of the file to auto-detect the header row index using keyword density and filled ratio, normalise the text (lowercase and trimmed spaces) to standardise columns.
- **Secure Data Masking**: Extract 10 fully populated data rows and replace PII or financial details with generic placeholders.
- **Template Hash Generation**: Join the normalized headers into a single string and generate a unique SHA-256 hash code.
- **Review Confirmation UI**: Build a screen showing the 25 system fields matched against Excel columns with correction dropdowns and **column merging controls** (enabling users to join multiple source fields to one target field).

### 2. Backend & Cache Tasks
- **Database Schema Creation**: Design a table to store the unique template hash, raw headers, and approved 25-column mapping (supporting single keys or stringified arrays of merged keys).
- **Cache Lookup Middleware**: Create a service to search the database by hash and instantly return existing mappings.
- **AI Integration Pipeline**: Connect to the LLM using structured outputs, passing the 25 field descriptions and masked samples (invoked only if template hash lookup returns empty).
- **Multilingual System Prompt**: Write system instructions detailing field meanings and explicitly enabling cross-language mapping logic.
- **Mapping Persistence API**: Build an endpoint to save the verified mapping and template hash after user approval.
