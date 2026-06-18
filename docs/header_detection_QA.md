# Header Auto-Detection: Q&A Report

Based on the SmartBridge Header Auto-Detection Engine product overview and technical documentation, here are the detailed answers to your questions.

---

## 1. Algorithm and Validation Rules for Header Detection

The system uses a **Per-Column Averaged Heuristic Scoring Algorithm** instead of standard text parsing. This makes it language-agnostic and mathematically bounded between 0 and 100%.

### The Per-Column Algorithm
Every column in a candidate row is evaluated out of **100 points**:
1. **Cell Presence (+20 pts)**: The cell contains data (handles density natively).
2. **Data Relationship (Up to +60 pts)**: Identifies if the data structurally changes from text to quantitative data directly below the row (+60 pts), or remains consistent text (+40 pts).
3. **Header Traits (Up to +20 pts)**: Awards bonus points if the cell is purely text (+10 pts) and is uniquely named across the row (+10 pts).

The row's preliminary score is simply the average of all its columns.

### Validation Rules & Detection Pipeline
The engine runs an explicit **Three-Layer Architecture**:

*   **Layer 1 (Structural Detection):** Calculates the preliminary column average and applies strict row-level multipliers (penalties) for numeric data.
*   **Layer 2 (Keyword Scoring):** Scans the winning structural row contiguously from the first column until the first empty column. Calculates a keyword match percentage on that contiguous block.
*   **Layer 3 (Validation Trap):** A supervisory validation step. If the contiguous keyword score from Layer 2 is `< 50%`, it runs a vertical keyword scan down the first column (up to 200 rows). If the vertical block matches keywords at `>= 50%` AND contains strictly unique labels, it explicitly flags the row as `isPivoted = true` for rejection.

---

## 2. Probability / % Matching for Each Method

The algorithm natively calculates a final score that cannot mathematically exceed **100%**. A final score of **≥ 50%** is required to achieve "High Confidence" auto-detection.

### Positive Scoring (Per Column)
*   **Presence:** **+20 pts** (Cell is populated)
*   **Strict Boundary:** **+60 pts** (Cell is Text, data below is Number/Date)
*   **Consistent Data:** **+40 pts** (Cell is Text, data below is Text)
*   **String Trait:** **+10 pts** (Cell is Text)
*   **Unique Trait:** **+10 pts** (Cell name does not repeat in the row)

**Preliminary Score:** Sum of column scores ÷ Total File Width.

### Row-Level Penalties (The Multipliers)
These penalties drastically reduce the probability of invalid rows being selected by multiplying the Preliminary Score:
*   **Pure Data Penalty (× 0.0):** Applied if ≥ 50% of the row consists of numbers or dates.
*   **Orphan Header Penalty (× 0.0):** Applied if the row sits at the end of the file with absolutely no data below it.
*   **Mixed Numeric Penalty (× 0.5):** Applied if the row contains stray numbers.

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
