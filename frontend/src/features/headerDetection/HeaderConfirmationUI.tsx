import React, { useState, useEffect, useRef } from 'react';
import { FileState } from '../fileUpload/useFilePipeline';
import { scoreRowContextually, scoreRowKeywords, scoreRowKeywordsPivoted, getCellType, normalizeScore } from './headerDetector';
import './HeaderConfirmationUI.css';

interface HeaderConfirmationUIProps {
  fileState: FileState;
  onConfirm: (fileName: string, finalHeaders: string[]) => void;
  onError?: (fileName: string) => void;
}

export const HeaderConfirmationUI: React.FC<HeaderConfirmationUIProps> = ({ fileState, onConfirm, onError }) => {
  // Local state for tracking current confidence dynamically
  const [currentConfidence, setCurrentConfidence] = useState<number | undefined>(
    fileState.headerConfidence
  );
  const [currentKeywordConfidence, setCurrentKeywordConfidence] = useState<number | undefined>(
    fileState.keywordConfidence
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
      setCurrentKeywordConfidence(fileState.keywordConfidence);
    }
  }, [fileState.sourceHeaders, fileState.headerConfidence, fileState.keywordConfidence, fileState.headerRowIndex]);

  // Handle manual input of the row number
  const handleRowNumberInputChange = (val: string) => {
    setRowNumberInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0 && fileState.sampleRows && num <= fileState.sampleRows.length) {
      const idx = num - 1;
      setSelectedRowIndex(idx);

      // Recalculate confidence score dynamically
      const res = scoreRowContextually(idx, fileState.sampleRows);
      const kwRes = fileState.isPivoted ? scoreRowKeywordsPivoted(fileState.sampleRows[idx]) : scoreRowKeywords(fileState.sampleRows[idx]);
      // Wait, what if it's pivoted? We shouldn't guess, manual select means we use standard check
      setCurrentConfidence(Math.min(100, Math.max(0, res.score)));
      setCurrentKeywordConfidence(Math.min(100, Math.max(0, kwRes.score)));
    } else {
      setSelectedRowIndex(undefined);
      setCurrentConfidence(undefined);
      setCurrentKeywordConfidence(undefined);
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
    const res = scoreRowContextually(idx, fileState.sampleRows);
    const kwRes = fileState.isPivoted ? scoreRowKeywordsPivoted(fileState.sampleRows[idx]) : scoreRowKeywords(fileState.sampleRows[idx]);
    setCurrentConfidence(Math.min(100, Math.max(0, res.score)));
    setCurrentKeywordConfidence(Math.min(100, Math.max(0, kwRes.score)));
  };

  // Compute dynamic scoring factor breakdown for the selected row
  const getScoringBreakdown = () => {
    if (selectedRowIndex === undefined || !fileState.sampleRows) return null;
    const rowIndex = selectedRowIndex;
    const allRows = fileState.sampleRows;
    const row = allRows[rowIndex];
    if (!row || row.length === 0) return null;

    const checkPivoted = !!fileState.isPivoted;

    // The detector natively returns the correct pillar-based breakdown and score
    const res = scoreRowContextually(rowIndex, allRows, checkPivoted);
    const breakdown = res.breakdown;

    if (checkPivoted) {
      breakdown.push({ name: 'Unsupported Pivoted Structure Penalty', score: -100 });
    }

    const totalCalculated = res.score - (checkPivoted ? 100 : 0);
    const finalCapped = Math.min(100, Math.max(0, totalCalculated));

    breakdown.push({ name: '---', score: 0 }); // Divider
    breakdown.push({ name: `Total Structural %`, score: totalCalculated });

    if (totalCalculated > 100 || totalCalculated < 0) {
      breakdown.push({ name: `Final Capped Structural %`, score: finalCapped });
    }

    const kwRes = checkPivoted ? scoreRowKeywordsPivoted(row) : scoreRowKeywords(row);
    if (kwRes.breakdown.length > 0) {
      breakdown.push({ name: '---', score: 0 });
      kwRes.breakdown.forEach(b => breakdown.push(b));
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
    <div className="glass-panel header-confirm-container">
      <div className="header-confirm-title-area">
        <h2>Header Detection Confirmation</h2>
        <p>File: <strong>{fileState.file.name}</strong></p>
      </div>

      {selectedRowIndex !== undefined && (
        <>
          {selectedRowIndex !== fileState.headerRowIndex ? (
            <div className="status-banner banner-info">
              <div className="status-banner-content">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="status-banner-title">Manual Row Selection (Structural: {currentConfidence}%{currentKeywordConfidence !== undefined ? ` | Keyword: ${currentKeywordConfidence}%` : ''})</h4>
              </div>
              <div ref={tooltipRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowScoringDetails(!showScoringDetails)}
                  className="tooltip-toggle-btn"
                >
                  {showScoringDetails ? 'Hide Scoring Details' : 'View Scoring Details'}
                </button>
                {showScoringDetails && (
                  <div className="heuristic-tooltip-panel">
                    <h5 className="heuristic-tooltip-title">Heuristic Breakdown:</h5>
                    <ul className="heuristic-list">
                      {getScoringBreakdown()?.map((item, i) => (
                        <li key={i} className="heuristic-item">
                          {item.name === '---' ? (
                            <div className="heuristic-item-divider" />
                          ) : (
                            <>
                              <span className="heuristic-item-name">{item.name}</span>
                              <span className="heuristic-item-score" style={{
                                color: item.name.includes('Normalized %')
                                  ? '#38BDF8'
                                  : item.score > 0 ? '#10B981' : item.score < 0 ? '#EF4444' : '#94A3B8'
                              }}>
                                {item.score > 0 && !item.name.includes('Normalized %') ? '+' : ''}{item.score}{item.name.includes('Normalized %') ? '%' : ''}
                              </span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : isConfident ? (
            <div className="status-banner banner-success">
              <div className="status-banner-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <div>
                  <h4 className="status-banner-title">Valid Header Detected (Structural: {currentConfidence}%{currentKeywordConfidence !== undefined ? ` | Keyword: ${currentKeywordConfidence}%` : ''})</h4>
                  <p className="status-banner-desc">Row {selectedRowIndex + 1} appears to be the most confident header row.</p>
                </div>
              </div>
              <div ref={tooltipRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowScoringDetails(!showScoringDetails)}
                  className="tooltip-toggle-btn"
                >
                  {showScoringDetails ? 'Hide Scoring Details' : 'View Scoring Details'}
                </button>
                {showScoringDetails && (
                  <div className="heuristic-tooltip-panel">
                    <h5 className="heuristic-tooltip-title">Heuristic Breakdown:</h5>
                    <ul className="heuristic-list">
                      {getScoringBreakdown()?.map((item, i) => (
                        <li key={i} className="heuristic-item">
                          {item.name === '---' ? (
                            <div className="heuristic-item-divider" />
                          ) : (
                            <>
                              <span className="heuristic-item-name">{item.name}</span>
                              <span className="heuristic-item-score" style={{
                                color: item.name.includes('Normalized %')
                                  ? '#38BDF8'
                                  : item.score > 0 ? '#10B981' : item.score < 0 ? '#EF4444' : '#94A3B8'
                              }}>
                                {item.score > 0 && !item.name.includes('Normalized %') ? '+' : ''}{item.score}{item.name.includes('Normalized %') ? '%' : ''}
                              </span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="status-banner banner-danger">
              <div className="status-banner-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div>
                  <h4 className="status-banner-title">Unpredictable File Detected {fileState.isPivoted ? '(Looks like Pivoted) ' : ''}(Structural: {currentConfidence}%{currentKeywordConfidence !== undefined ? ` | Keyword: ${currentKeywordConfidence}%` : ''})</h4>
                </div>
              </div>
              <div ref={tooltipRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowScoringDetails(!showScoringDetails)}
                  className="tooltip-toggle-btn"
                >
                  {showScoringDetails ? 'Hide Scoring Details' : 'View Scoring Details'}
                </button>
                {showScoringDetails && (
                  <div className="heuristic-tooltip-panel">
                    <h5 className="heuristic-tooltip-title">Heuristic Breakdown:</h5>
                    <ul className="heuristic-list">
                      {getScoringBreakdown()?.map((item, i) => (
                        <li key={i} className="heuristic-item">
                          {item.name === '---' ? (
                            <div className="heuristic-item-divider" />
                          ) : (
                            <>
                              <span className="heuristic-item-name">{item.name}</span>
                              <span className="heuristic-item-score" style={{
                                color: item.name.includes('Normalized %')
                                  ? '#38BDF8'
                                  : item.score > 0 ? '#10B981' : item.score < 0 ? '#EF4444' : '#94A3B8'
                              }}>
                                {item.score > 0 && !item.name.includes('Normalized %') ? '+' : ''}{item.score}{item.name.includes('Normalized %') ? '%' : ''}
                              </span>
                            </>
                          )}
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
      <div className="row-input-layout">
        <div className="row-input-group">
          <label className="row-input-label">Header Row Number (1-based)</label>
          <input
            type="number"
            min="1"
            max={fileState.sampleRows ? fileState.sampleRows.length : 1}
            value={rowNumberInput}
            onChange={(e) => handleRowNumberInputChange(e.target.value)}
            className="row-number-input"
            placeholder="Type row number..."
          />
        </div>
        <button
          onClick={openModal}
          className="btn browse-file-btn"
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
        <div className="inline-preview-section">
          <h4 className="inline-preview-title">Inline Preview Context:</h4>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Row Type</th>
                  <th style={{ width: '60px' }}>Row</th>
                  {inlineColIndices.map((colIdx) => (
                    <th key={colIdx} style={{ minWidth: '100px' }}>
                      Column {colIdx + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contextRows.map((cRow) => (
                  <tr key={cRow.index} style={{ background: cRow.label === 'Header Row' ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}>
                    <td style={{ fontWeight: cRow.label === 'Header Row' ? 'bold' : 'normal', color: cRow.label === 'Header Row' ? '#60a5fa' : 'var(--text-secondary)' }}>
                      {cRow.label}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cRow.index + 1}</td>
                    {inlineColIndices.map((colIdx) => {
                      const cellVal = colIdx < cRow.data.length ? cRow.data[colIdx] : '';
                      return (
                        <td key={colIdx} className="cell-truncate" title={cellVal === null || cellVal === undefined ? '' : String(cellVal)}>
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

      <div className="action-buttons-layout">
        {onError && (
          <button
            className={`btn ${!isConfident ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => onError(fileState.file.name)}
            style={isConfident ? { background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)' } : { background: 'var(--danger-color)', color: '#fff', border: 'none' }}
          >
            Continue with Error
          </button>
        )}
        <button
          className={`btn ${isConfident ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleConfirm}
          disabled={selectedRowIndex === undefined}
          style={!isConfident ? { background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' } : {}}
        >
          Confirm Headers &amp; Continue
        </button>
      </div>

      {/* Solution 1: Paginated Full Preview in Modal Dialog */}
      {isModalOpen && fileState.sampleRows && (
        <div className="modal-full-overlay">
          <div className="glass-panel modal-full-content">

            {/* Modal Header */}
            <div className="modal-full-header">
              <h3>Select Header Row from Full Preview</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="modal-full-close"
                title="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Table Container */}
            <div className="modal-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Action</th>
                    <th style={{ width: '50px' }}>Row</th>
                    {modalColIndices.map((colIdx) => (
                      <th key={colIdx} style={{ minWidth: '100px' }}>
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
                      <tr key={actualIdx} style={{ background: isSelected ? 'rgba(59, 130, 246, 0.15)' : actualIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td>
                          <button
                            onClick={() => {
                              selectRowIndexFromSource(actualIdx);
                              setIsModalOpen(false);
                            }}
                            className={`select-row-btn ${isSelected ? 'selected' : 'unselected'}`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{actualIdx + 1}</td>
                        {modalColIndices.map((colIdx) => {
                          const cellVal = colIdx < row.length ? row[colIdx] : '';
                          return (
                            <td key={colIdx} className="cell-truncate" title={cellVal === null || cellVal === undefined ? '' : String(cellVal)}>
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
            <div className="modal-pagination">
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                className="btn pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage + 1} of {totalPages} (Rows {startIdx + 1} - {Math.min(startIdx + pageSize, totalRowsCount)} of {totalRowsCount})
              </span>
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                className="btn pagination-btn"
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
