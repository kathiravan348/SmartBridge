# Header Auto-Detection: Q&A Report

Based on the SmartBridge Header Auto-Detection Engine product overview and technical documentation, here are the detailed answers to your questions.

---

## 1. Algorithm and Validation Rules for Header Detection

The system uses a **4-Pillar Structural Heuristic Scoring Algorithm** instead of standard text parsing. This makes it language-agnostic and relies on data-type patterns. It evaluates candidate rows by looking at the 5 context rows immediately below them.

### The 4-Pillar Algorithm
1. **Pillar 1: Base Density** - Measures how much of the file's maximum width the candidate row spans.
2. **Pillar 2: Data Boundary Signal** - Identifies if the data structurally changes from text (String) to quantitative data (Numbers/Dates) directly below the row. *This is the strongest indicator of a header.*
3. **Pillar 3: Data Consistency** - If there is no strict text-to-number boundary, it checks if the data below the candidate row remains consistent in type.
4. **Pillar 4: Header Traits** - Awards bonus points if the row exhibits standard header traits (e.g., being composed entirely of text and having unique column names).

### Validation Rules & Detection Pipeline
The engine runs an explicit **Three-Layer Architecture**:

*   **Layer 1 (Structural Detection):** Scores all rows purely structurally using the 4 Pillars with strict penalties applied to numeric data.
*   **Layer 2 (Keyword Scoring):** Scans the winning structural row contiguously from the first column until the first empty column. Calculates a keyword match percentage on that contiguous block.
*   **Layer 3 (Validation Trap):** A supervisory validation step. If the contiguous keyword score from Layer 2 is `< 50%`, it runs a vertical keyword scan down the first column (up to 200 rows). If the vertical block matches keywords at `>= 50%` AND contains strictly unique labels, it explicitly flags the row as `isPivoted = true` for rejection.

---

## 2. Probability / % Matching for Each Method

The algorithm evaluates candidates natively on a **0-100% scale**. A final score of **≥ 50%** is required to achieve "High Confidence" auto-detection.

### Positive Scoring (% Matching)
*   **Base Density:** Up to **+20%** `(Filled Cells / Max File Width * 20%)`
*   **Data Boundary Signal:** Up to **+100%** `(Columns with Boundary / Filled Cells * 100%)`
*   **Data Consistency:** Up to **+35%** `(Consistent Columns / Filled Cells * 35%)`
*   **Header Traits (100% Strings):** **+10%** bonus
*   **Header Traits (Unique Columns):** **+5%** bonus

**Score Capping (Max 100%)**
While the theoretical maximum sum of all pillars is 170%, the final structural score is strictly **capped at 100%** in the UI. 
*Why?* This allows a perfect "Data Boundary" (100%) to instantly grant full confidence on its own, while a row lacking a strict data boundary can still build up a high confidence score (e.g., 70%) by combining base density, consistency, and header traits.

*Note: If there are fewer than 3 context rows below the candidate, all positive signal weights are scaled down by 0.6×.*

### Critical Penalties (Validation Deductions)
These penalties drastically reduce the probability of invalid rows being selected:
*   **Pure Data Penalty:** **-100%** (Applied if ≥ 50% of the row consists of numbers or dates).
*   **Orphan Header Penalty:** **-100%** (Applied if the row sits at the end of the file with no data below it).
*   **Mixed Numeric Penalty:** **-30%** (Applied if the row contains stray numbers).
*   **Duplicate Penalty:** **-5%** *per duplicate column name*.

---

## 3. File Scenarios & Handling Duplicate/Ambiguous Data

The engine has been tested against various real-world scenarios with the following detection rates:

| File Scenario | Auto-Detection Rate |
| :--- | :--- |
| **Standard CSV/Excel** (Clean, 1 header row) | ~99% |
| **Pivoted Tables** (Horizontal timelines) | ~98% (Correctly rejected/flagged) |
| **Excel Export with Junk Rows** (1-3 title rows) | ~95% |
| **Multi-Language Files** (Spanish, German, etc.) | ~95% |
| **Excel Export with Blank Rows + Junk** | ~92% |
| **Structurally Ambiguous Files** (All strings) | < 50% score → Safe Manual Fallback |
| **All-Numeric / No Labels** | < 50% score → Safe Manual Fallback |
| **Multi-row / Stacked Headers** | Not Supported |

### Which approach is best for Duplicate Mapping / Ambiguous Data?

The **Heuristic Engine with the Validation Trap** is significantly better and safer than AI/LLM approaches when dealing with ambiguous or duplicate data. 

**Why it is the best approach:**
1. **Handling Duplicate Mappings:** The engine explicitly targets duplicates with a **-5% Penalty per duplicate column**. Conversely, it rewards truly unique columns with a +5% bonus. This mathematically deprioritizes messy, duplicate-heavy rows.
2. **Handling Ambiguous Data:** If the file is structurally ambiguous (e.g., a file containing 100% text where the boundary between headers and data is blurred), the engine will naturally score the file below the **50% Confidence Threshold**. Instead of hallucinating a "best guess" like an LLM might (which would break downstream mapping), the heuristic engine safely falls back to the "Unpredictable File" UI flow, explicitly asking the user to manually verify.
3. **Keyword Validation Trap:** If the structural signals are confident but dictionary keywords are severely lacking (`< 50%`), the Layer 3 validation trap kicks in to detect anomalies like vertically pivoted tables. It enforces a strict uniqueness check on the vertical labels—if duplicates are found, it safely rejects it as a pivoted table, leaving the file in the "Unpredictable" state. This exposes mismatched expectations to the user rather than blindly failing.
