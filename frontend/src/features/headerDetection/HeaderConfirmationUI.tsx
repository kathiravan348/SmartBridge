import React, { useState, useEffect, useRef } from 'react';
import { FileState } from '../fileUpload/useFilePipeline';
import { scoreRowContextually, getCellType } from './headerDetector';

interface HeaderConfirmationUIProps {
  fileState: FileState;
  onConfirm: (fileName: string, finalHeaders: string[]) => void;
}

export const HeaderConfirmationUI: React.FC<HeaderConfirmationUIProps> = ({ fileState, onConfirm }) => {
  // Local state for tracking current confidence dynamically
  const [currentConfidence, setCurrentConfidence] = useState<number | undefined>(
    fileState.headerConfidence
  );

  const isConfident = currentConfidence !== undefined && currentConfidence >= 50 && !fileState.isPivoted;

  // 0-indexed row index selection
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | undefined>(
    fileState.headerConfidence !== undefined && fileState.headerConfidence >= 50 && !fileState.isPivoted
      ? fileState.headerRowIndex
      : undefined
  );

  // 1-based text input for the row number
  const [rowNumberInput, setRowNumberInput] = useState<string>(
    selectedRowIndex !== undefined ? String(selectedRowIndex + 1) : ''
  );

  // Modal display state for the full preview
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Toggle state to show/hide scoring breakdown details
  const [showScoringDetails, setShowScoringDetails] = useState<boolean>(false);

  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close tooltip if user clicks outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showScoringDetails && tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowScoringDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showScoringDetails]);

  // Pagination for the modal full preview
  const [currentPage, setCurrentPage] = useState<number>(0);
  const pageSize = 15;

  // Sync state if fileState changes
  useEffect(() => {
    if (fileState.headerConfidence !== undefined && fileState.sourceHeaders) {
      const idx = fileState.headerRowIndex;
      setSelectedRowIndex(idx);
      setRowNumberInput(idx !== undefined && idx !== -1 ? String(idx + 1) : '');
      setCurrentConfidence(fileState.headerConfidence);
    }
  }, [fileState.sourceHeaders, fileState.headerConfidence, fileState.headerRowIndex]);

  // Handle manual input of the row number
  const handleRowNumberInputChange = (val: string) => {
    setRowNumberInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0 && fileState.sampleRows && num <= fileState.sampleRows.length) {
      const idx = num - 1;
      setSelectedRowIndex(idx);

      // Recalculate confidence score dynamically
      const score = scoreRowContextually(idx, fileState.sampleRows);
      setCurrentConfidence(score);
    } else {
      setSelectedRowIndex(undefined);
      setCurrentConfidence(undefined);
    }
  };

  const handleConfirm = () => {
    if (selectedRowIndex !== undefined && fileState.sampleRows && selectedRowIndex < fileState.sampleRows.length) {
      const selectedRow = fileState.sampleRows[selectedRowIndex];
      const headers = selectedRow.map((cell, idx) => {
        if (cell === null || cell === undefined || String(cell).trim() === '') {
          return `Column_${idx + 1}`;
        }
        return String(cell).trim();
      });
      onConfirm(fileState.file.name, headers);
    } else {
      onConfirm(fileState.file.name, fileState.sourceHeaders || []);
    }
  };

  const selectRowIndexFromSource = (idx: number) => {
    if (!fileState.sampleRows) return;
    setSelectedRowIndex(idx);
    setRowNumberInput(String(idx + 1));

    // Recalculate confidence score dynamically
    const score = scoreRowContextually(idx, fileState.sampleRows);
    setCurrentConfidence(score);
  };

  // Compute dynamic scoring factor breakdown for the selected row
  const getScoringBreakdown = () => {
    if (selectedRowIndex === undefined || !fileState.sampleRows) return null;
    const rowIndex = selectedRowIndex;
    const allRows = fileState.sampleRows;
    const row = allRows[rowIndex];
    if (!row || row.length === 0) return null;

    const breakdown: { name: string; score: number }[] = [];
    const checkPivoted = !!fileState.isPivoted;

    let filledCells = 0;
    let numericCells = 0;
    let stringCells = 0;

    const uniqueValues = new Set<string>();
    let duplicates = 0;

    // Pre-calculate cell counts to identify unique cells in the row
    const cellCounts = new Map<string, number>();
    row.forEach(cell => {
      if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
        const key = String(cell).trim().toLowerCase();
        cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
      }
    });

    // Extract numeric/date values to check for horizontal monotonicity and pivoted headers
    const numericValues: number[] = [];
    let hasDateCell = false;
    row.forEach(cell => {
      const cType = getCellType(cell);
      if (cType === 'number') {
        const valNum = Number(String(cell).trim());
        if (!isNaN(valNum)) {
          numericValues.push(valNum);
        }
      } else if (cType === 'date') {
        hasDateCell = true;
        const valDate = Date.parse(String(cell).trim());
        if (!isNaN(valDate)) {
          numericValues.push(valDate);
        }
      }
    });

    let isPivotedHeader = false;
    if (checkPivoted && numericValues.length >= 3) {
      let increasing = true;
      let decreasing = true;
      let strictlyConsecutive = true;

      for (let i = 1; i < numericValues.length; i++) {
        const diff = numericValues[i] - numericValues[i - 1];
        if (diff > 0) {
          decreasing = false;
        } else if (diff < 0) {
          increasing = false;
        } else {
          increasing = false;
          decreasing = false;
        }

        if (Math.abs(diff) !== 1) {
          strictlyConsecutive = false;
        }
      }

      const isMonotonic = increasing || decreasing;

      if (isMonotonic) {
        const allInYearRange = numericValues.every(v => Number.isInteger(v) && v >= 1900 && v <= 2100);
        const allInMonthRange = numericValues.every(v => Number.isInteger(v) && v >= 1 && v <= 12);

        if (hasDateCell || strictlyConsecutive || allInYearRange || allInMonthRange) {
          isPivotedHeader = true;
        }
      }
    }

    // Context rows (next 5)
    const contextRows = allRows.slice(rowIndex + 1, rowIndex + 6);
    const contextScale = contextRows.length < 3 ? 0.6 : 1.0;

    row.forEach((cell, colIndex) => {
      const cType = getCellType(cell);
      if (cType !== 'empty') {
        filledCells += 1;
        breakdown.push({ name: `Density Bonus (Column ${colIndex + 1})`, score: 2 });

        const cellStr = String(cell).trim().toLowerCase();
        if (uniqueValues.has(cellStr)) {
          duplicates += 1;
        } else {
          uniqueValues.add(cellStr);
        }
      }

      if (cType === 'number' || cType === 'date') {
        numericCells += 1;

        // Analyze context below for consistent numeric/date data (pivoted columns)
        let belowNumericOrDate = 0;
        let belowEmpty = 0;
        let totalValidContext = 0;

        for (const contextRow of contextRows) {
          if (colIndex < contextRow.length) {
            totalValidContext += 1;
            const belowType = getCellType(contextRow[colIndex]);
            if (belowType === 'number' || belowType === 'date') {
              belowNumericOrDate += 1;
            } else if (belowType === 'empty') {
              belowEmpty += 1;
            }
          }
        }

        if (isPivotedHeader && totalValidContext > 0 && (belowNumericOrDate / totalValidContext) >= 0.6) {
          const cellKey = String(cell).trim().toLowerCase();
          const isCellUnique = cellCounts.get(cellKey) === 1;
          if (isCellUnique) {
            breakdown.push({ name: `Consistent Numeric Column Signal (Column ${colIndex + 1})`, score: Math.round(10 * contextScale) });
          }
        }
      }

      if (cType === 'string') {
        stringCells += 1;

        // Analyze context below
        let belowNumericOrDate = 0;
        let belowString = 0;

        for (const contextRow of contextRows) {
          if (colIndex < contextRow.length) {
            const belowType = getCellType(contextRow[colIndex]);
            if (belowType === 'number' || belowType === 'date') {
              belowNumericOrDate += 1;
            } else if (belowType === 'string') {
              belowString += 1;
            }
          }
        }

        const totalContext = belowNumericOrDate + belowString;
        if (totalContext > 0) {
          if (belowNumericOrDate > belowString) {
            const firstBelowCell = contextRows[0] && colIndex < contextRows[0].length ? contextRows[0][colIndex] : null;
            const firstBelowType = getCellType(firstBelowCell);
            if (firstBelowType === 'number' || firstBelowType === 'date' || firstBelowType === 'empty') {
              breakdown.push({ name: `Data Boundary Signal (Column ${colIndex + 1})`, score: Math.round(15 * contextScale) });
            } else {
              breakdown.push({ name: `Consistent String Signal (Column ${colIndex + 1} - No Boundary)`, score: Math.round(5 * contextScale) });
            }
          } else if (belowString >= belowNumericOrDate) {
            breakdown.push({ name: `Consistent String Signal (Column ${colIndex + 1})`, score: Math.round(5 * contextScale) });
          }
        }
      }
    });

    if (!isPivotedHeader && filledCells > 0 && (numericCells / filledCells) > 0.5) {
      breakdown.push({ name: 'Pure Data Penalty (>50% numbers/dates)', score: -50 });
    }

    if (!isPivotedHeader && numericCells > 0) {
      breakdown.push({ name: 'Numeric Data Penalty', score: -20 });
    }

    if (isPivotedHeader) {
      breakdown.push({ name: 'Pivoted Header Series Bonus (monotonic sequence)', score: 25 });
    }

    if (filledCells > 0 && stringCells === filledCells) {
      breakdown.push({ name: '100% String Bonus', score: 10 });
    }

    if (duplicates > 0) {
      breakdown.push({ name: `Duplicate Values Penalty (${duplicates} duplicates)`, score: -duplicates * 5 });
    } else if (filledCells > 1 && duplicates === 0) {
      breakdown.push({ name: 'Uniqueness Bonus', score: 5 });
    }

    let hasDataBelow = false;
    for (const contextRow of contextRows) {
      for (const c of contextRow) {
        if (getCellType(c) !== 'empty') {
          hasDataBelow = true;
          break;
        }
      }
      if (hasDataBelow) break;
    }

    if (filledCells > 0 && !hasDataBelow) {
      breakdown.push({ name: 'Orphan Header Penalty (No data in rows below)', score: -50 });
    }

    return breakdown;
  };

  // Get dynamic 3-row context preview (Header N, Data N+1, Data N+2)
  const getContextRows = () => {
    if (selectedRowIndex === undefined || !fileState.sampleRows) return [];
    const rows: { label: string; index: number; data: any[] }[] = [];

    // Header Row
    if (selectedRowIndex < fileState.sampleRows.length) {
      rows.push({
        label: 'Header Row',
        index: selectedRowIndex,
        data: fileState.sampleRows[selectedRowIndex]
      });
    }
    // Context Row 1
    if (selectedRowIndex + 1 < fileState.sampleRows.length) {
      rows.push({
        label: 'Data Row 1',
        index: selectedRowIndex + 1,
        data: fileState.sampleRows[selectedRowIndex + 1]
      });
    }
    // Context Row 2
    if (selectedRowIndex + 2 < fileState.sampleRows.length) {
      rows.push({
        label: 'Data Row 2',
        index: selectedRowIndex + 2,
        data: fileState.sampleRows[selectedRowIndex + 2]
      });
    }
    return rows;
  };

  const contextRows = getContextRows();

  // Find column count for inline preview context
  const inlineMaxCols = contextRows.length > 0 ? Math.max(...contextRows.map(r => r.data.length), 0) : 0;
  const inlineColIndices = Array.from({ length: inlineMaxCols }, (_, i) => i);

  // Modal pagination math
  const totalRowsCount = fileState.sampleRows ? fileState.sampleRows.length : 0;
  const totalPages = Math.ceil(totalRowsCount / pageSize);
  const startIdx = currentPage * pageSize;
  const paginatedRows = fileState.sampleRows ? fileState.sampleRows.slice(startIdx, startIdx + pageSize) : [];

  // Find column count for modal full preview
  const modalMaxCols = paginatedRows.length > 0 ? Math.max(...paginatedRows.map(r => r.length), 0) : 0;
  const modalColIndices = Array.from({ length: modalMaxCols }, (_, i) => i);

  // Update page when modal opens to center around current selection
  const openModal = () => {
    if (selectedRowIndex !== undefined && selectedRowIndex !== -1) {
      setCurrentPage(Math.floor(selectedRowIndex / pageSize));
    } else {
      setCurrentPage(0);
    }
    setIsModalOpen(true);
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
        <h2>Header Detection Confirmation</h2>
        <p style={{ color: 'var(--text-secondary)' }}>File: <strong>{fileState.file.name}</strong></p>
      </div>

      {selectedRowIndex !== undefined && (
        <>
          {selectedRowIndex !== fileState.headerRowIndex ? (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '1rem', borderRadius: '8px', color: '#60a5fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 style={{ margin: 0, fontWeight: 'bold' }}>Manual Row Selection (Score: {currentConfidence})</h4>
              </div>
              <div ref={tooltipRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowScoringDetails(!showScoringDetails)}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.82rem', padding: 0, textDecoration: 'underline', fontWeight: 500 }}
                >
                  {showScoringDetails ? 'Hide Scoring Details' : 'View Scoring Details'}
                </button>
                {showScoringDetails && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '420px', padding: '0.75rem', background: '#1e293b', border: '1px solid var(--surface-border)', borderRadius: '8px', zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', textAlign: 'left' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: 'var(--text-primary)' }}>Heuristic Breakdown:</h5>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {getScoringBreakdown()?.map((item, i) => (
                        <li key={i} style={{ color: item.score >= 0 ? '#34d399' : '#f87171' }}>
                          {item.name}: <strong>{item.score >= 0 ? `+${item.score}` : item.score}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : isConfident ? (
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.4)', padding: '1rem', borderRadius: '8px', color: '#34d399', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 style={{ margin: 0, fontWeight: 'bold' }}>High Confidence Detection (Score: {currentConfidence})</h4>
              </div>
              <div ref={tooltipRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowScoringDetails(!showScoringDetails)}
                  style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.82rem', padding: 0, textDecoration: 'underline', fontWeight: 500 }}
                >
                  {showScoringDetails ? 'Hide Scoring Details' : 'View Scoring Details'}
                </button>
                {showScoringDetails && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '420px', padding: '0.75rem', background: '#1e293b', border: '1px solid var(--surface-border)', borderRadius: '8px', zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', textAlign: 'left' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: 'var(--text-primary)' }}>Heuristic Breakdown:</h5>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {getScoringBreakdown()?.map((item, i) => (
                        <li key={i} style={{ color: item.score >= 0 ? '#34d399' : '#f87171' }}>
                          {item.name}: <strong>{item.score >= 0 ? `+${item.score}` : item.score}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '1rem', borderRadius: '8px', color: '#f87171', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h4 style={{ margin: 0, fontWeight: 'bold' }}>Unpredictable File Detected (Score: {currentConfidence})</h4>
              </div>
              <div ref={tooltipRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowScoringDetails(!showScoringDetails)}
                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem', padding: 0, textDecoration: 'underline', fontWeight: 500 }}
                >
                  {showScoringDetails ? 'Hide Scoring Details' : 'View Scoring Details'}
                </button>
                {showScoringDetails && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '420px', padding: '0.75rem', background: '#1e293b', border: '1px solid var(--surface-border)', borderRadius: '8px', zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', textAlign: 'left' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: 'var(--text-primary)' }}>Heuristic Breakdown:</h5>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {getScoringBreakdown()?.map((item, i) => (
                        <li key={i} style={{ color: item.score >= 0 ? '#34d399' : '#f87171' }}>
                          {item.name}: <strong>{item.score >= 0 ? `+${item.score}` : item.score}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Row Number Input and Browse Button */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <label style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Header Row Number (1-based)</label>
          <input
            type="number"
            min="1"
            max={fileState.sampleRows ? fileState.sampleRows.length : 1}
            value={rowNumberInput}
            onChange={(e) => handleRowNumberInputChange(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-color)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', width: '100%' }}
            placeholder="Type row number..."
          />
        </div>
        <button
          onClick={openModal}
          className="btn"
          style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', height: '45px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Browse Full File
        </button>
      </div>

      {/* Comma-separated textarea removed in favor of the clean dynamic spreadsheet preview context below */}

      {/* Solution 2: Inline 3-Row Context Preview */}
      {selectedRowIndex !== undefined && contextRows.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ marginBottom: '1rem', fontWeight: 500 }}>Inline Preview Context:</h4>
          <div style={{ border: '1px solid var(--surface-border)', borderRadius: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.75rem', width: '130px', whiteSpace: 'nowrap' }}>Row Type</th>
                  <th style={{ padding: '0.75rem', width: '60px', whiteSpace: 'nowrap' }}>Row</th>
                  {inlineColIndices.map((colIdx) => (
                    <th key={colIdx} style={{ padding: '0.75rem', whiteSpace: 'nowrap', minWidth: '100px' }}>
                      Column {colIdx + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contextRows.map((cRow) => (
                  <tr key={cRow.index} style={{ borderBottom: '1px solid var(--surface-border)', background: cRow.label === 'Header Row' ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}>
                    <td style={{ padding: '0.75rem', fontWeight: cRow.label === 'Header Row' ? 'bold' : 'normal', color: cRow.label === 'Header Row' ? '#60a5fa' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {cRow.label}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{cRow.index + 1}</td>
                    {inlineColIndices.map((colIdx) => {
                      const cellVal = colIdx < cRow.data.length ? cRow.data[colIdx] : '';
                      return (
                        <td key={colIdx} style={{ padding: '0.75rem', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cellVal === null || cellVal === undefined ? '' : String(cellVal)}>
                          {cellVal === null || cellVal === undefined ? '' : String(cellVal)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
        <button
          className="btn btn-primary"
          onClick={handleConfirm}
          disabled={selectedRowIndex === undefined}
        >
          Confirm Headers &amp; Continue
        </button>
      </div>

      {/* Solution 1: Paginated Full Preview in Modal Dialog */}
      {isModalOpen && fileState.sampleRows && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '850px', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem', position: 'relative', border: '1px solid var(--surface-border)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', overflow: 'hidden' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Select Header Row from Full Preview</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                title="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Table Container */}
            <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--surface-border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--surface-border)' }}>
                    <th style={{ padding: '0.6rem', width: '80px', whiteSpace: 'nowrap' }}>Action</th>
                    <th style={{ padding: '0.6rem', width: '50px', whiteSpace: 'nowrap' }}>Row</th>
                    {modalColIndices.map((colIdx) => (
                      <th key={colIdx} style={{ padding: '0.6rem', whiteSpace: 'nowrap', minWidth: '100px' }}>
                        Column {colIdx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, index) => {
                    const actualIdx = startIdx + index;
                    const isSelected = selectedRowIndex === actualIdx;
                    return (
                      <tr key={actualIdx} style={{ borderBottom: '1px solid var(--surface-border)', background: isSelected ? 'rgba(59, 130, 246, 0.15)' : actualIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.6rem' }}>
                          <button
                            onClick={() => {
                              selectRowIndexFromSource(actualIdx);
                              setIsModalOpen(false);
                            }}
                            style={{ padding: '4px 10px', fontSize: '0.75rem', background: isSelected ? '#10b981' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </td>
                        <td style={{ padding: '0.6rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{actualIdx + 1}</td>
                        {modalColIndices.map((colIdx) => {
                          const cellVal = colIdx < row.length ? row[colIdx] : '';
                          return (
                            <td key={colIdx} style={{ padding: '0.6rem', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cellVal === null || cellVal === undefined ? '' : String(cellVal)}>
                              {cellVal === null || cellVal === undefined ? '' : String(cellVal)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem' }}>
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                className="btn"
                style={{ padding: '6px 14px', fontSize: '0.8rem', opacity: currentPage === 0 ? 0.4 : 1, background: 'transparent', border: '1px solid var(--surface-border)' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Page {currentPage + 1} of {totalPages} (Rows {startIdx + 1} - {Math.min(startIdx + pageSize, totalRowsCount)} of {totalRowsCount})
              </span>
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                className="btn"
                style={{ padding: '6px 14px', fontSize: '0.8rem', opacity: currentPage >= totalPages - 1 ? 0.4 : 1, background: 'transparent', border: '1px solid var(--surface-border)' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
