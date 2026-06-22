import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TARGET_HEADERS } from './schema';
import { FileState } from '../fileUpload/useFilePipeline';
import './MappingReviewUI.css';

interface MappingReviewUIProps {
  fileState: FileState;
  onConfirm: (fileName: string) => void;
}

const MOCK_SOURCE_HEADERS = [
  'Vendor ID', 'Company Name', 'Street', 'City and State', 'Zip Code', 'Nation',
  'Tel #', 'Contact Email', 'EIN', 'Terms', 'Pay Method', 'Curr', 'First Name', 'Last Name',
  'Invoices Count', 'PO Count', 'Paid Count', 'Due Count', 'Open Count', 'Transactions',
  'Invoice Total', 'PO Total', 'Paid Total', 'Due Total', 'Open Total', 'Target Spend'
];

import { MappingResult } from './mappingEngine';

export const MappingReviewUI: React.FC<MappingReviewUIProps> = ({ fileState, onConfirm }) => {
  // mapping state: target_id -> array of selected source headers
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [confidenceScores, setConfidenceScores] = useState<Record<string, number>>({});
  const [debugLogs, setDebugLogs] = useState<Record<string, string[]>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [engineVersion, setEngineVersion] = useState<'v1' | 'v2' | null>(null);

  // Configurable threshold for Lexical Recovery
  const CONFIDENCE_THRESHOLD = 0.4;

  const sourceHeadersToUse = fileState.sourceHeaders && fileState.sourceHeaders.length > 0 
    ? fileState.sourceHeaders 
    : MOCK_SOURCE_HEADERS;

  const runMappingEngineWorker = (version: 'v1' | 'v2') => {
    setIsProcessing(true);
    const worker = new Worker(new URL('./mappingWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'SUCCESS') {
        const result: MappingResult = e.data.result;
        setMappings(result.mappings);
        setConfidenceScores(result.confidenceScores);
        setDebugLogs(result.debugLogs || {});
      } else {
        console.error('Mapping worker error:', e.data.error);
      }
      setIsProcessing(false);
      worker.terminate();
    };

    worker.postMessage({ sourceHeaders: sourceHeadersToUse, threshold: CONFIDENCE_THRESHOLD, engineVersion: version });
  };

  const handleEngineSelect = (version: 'v1' | 'v2') => {
    setEngineVersion(version);
    runMappingEngineWorker(version);
  };

  const handleResetToAI = () => {
    if (engineVersion) {
      runMappingEngineWorker(engineVersion);
    }
  };

  const handleClearAll = () => {
    const emptyMapping: Record<string, string[]> = {};
    TARGET_HEADERS.forEach(th => {
      emptyMapping[th.id] = [];
    });
    setMappings(emptyMapping);
  };

  const handleAddSourceHeader = (targetId: string, sourceHeader: string) => {
    if (!sourceHeader) return;
    setMappings(prev => {
      // Strict enforcement: do not allow adding if already mapped anywhere
      const allMapped = new Set(Object.values(prev).flat());
      if (allMapped.has(sourceHeader)) return prev;

      const current = prev[targetId] || [];
      return { ...prev, [targetId]: [...current, sourceHeader] };
    });
  };

  const handleRemoveSourceHeader = (targetId: string, sourceHeader: string) => {
    setMappings(prev => {
      const current = prev[targetId] || [];
      return { ...prev, [targetId]: current.filter(sh => sh !== sourceHeader) };
    });
  };

  const getConfidenceBadge = (targetId: string, mappedCount: number) => {
    if (mappedCount === 0) {
      return <span className="badge badge-error">Unmapped</span>;
    }
    if (mappedCount > 1) {
      return <span className="badge badge-warning">Merged</span>;
    }
    const score = confidenceScores[targetId] || 0;
    if (score >= 0.99) {
      return <span className="badge badge-success">Exact Match</span>;
    } else if (score >= CONFIDENCE_THRESHOLD) {
      return <span className="badge badge-warning">Lexical ({(score * 100).toFixed(0)}%)</span>;
    }
    return <span className="badge badge-success">High</span>;
  };

  const totalTargets = TARGET_HEADERS.length;
  const mappedTargets = TARGET_HEADERS.filter(th => (mappings[th.id] || []).length === 1).length;
  const mergedTargets = TARGET_HEADERS.filter(th => (mappings[th.id] || []).length > 1).length;
  const unmappedTargets = TARGET_HEADERS.filter(th => (mappings[th.id] || []).length === 0).length;

  if (!engineVersion) {
    return createPortal((
      <div className="debug-modal-overlay">
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '600px', width: '90%', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Select Mapping Engine
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Choose the algorithmic approach you'd like to use for evaluating and mapping these headers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => handleEngineSelect('v1')} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Standard Engine (v1)</span>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', fontWeight: 400, textAlign: 'left' }}>Fast 4-phase pipeline using dictionary boundaries and TF-IDF similarity. Best for standard data.</span>
            </button>
            <button className="btn btn-outline" onClick={() => handleEngineSelect('v2')} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: 'rgba(139, 92, 246, 0.1)', borderColor: '#8b5cf6' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', color: '#c084fc' }}>Deep Scan Engine (v2)</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400, textAlign: 'left' }}>Advanced greedy left-to-right scanning algorithm. Best for heavily concatenated or typo-ridden strings.</span>
            </button>
          </div>
        </div>
      </div>
    ), document.body);
  }

  return (
    <div className="glass-panel mapping-ui-container">
      <div className="mapping-header">
        <div className="mapping-title-area">
          <h2>Mapping Review</h2>
          <p>Review and confirm column mappings for <strong>{fileState.file.name}</strong></p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="mapping-stats-box">
            <div className="mapping-stat-col">
            <div className="mapping-stat-value" style={{ color: '#60a5fa' }}>{sourceHeadersToUse.length}</div>
            <div className="mapping-stat-label">Detected Columns</div>
          </div>
          <div className="mapping-stat-divider"></div>
          <div className="mapping-stat-col">
            <div className="mapping-stat-value color-total">{totalTargets}</div>
            <div className="mapping-stat-label">System Targets</div>
          </div>
          <div className="mapping-stat-divider"></div>
          <div className="mapping-stat-col">
            <div className="mapping-stat-value color-mapped">{mappedTargets}</div>
            <div className="mapping-stat-label">Mapped</div>
          </div>
          <div className="mapping-stat-divider"></div>
          <div className="mapping-stat-col">
            <div className="mapping-stat-value color-merged">{mergedTargets}</div>
            <div className="mapping-stat-label">Merged</div>
          </div>
          <div className="mapping-stat-divider"></div>
          <div className="mapping-stat-col">
            <div className="mapping-stat-value color-unmapped">{unmappedTargets}</div>
            <div className="mapping-stat-label">Unmapped</div>
          </div>
        </div>
        <button 
            className="btn btn-outline" 
            style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setIsLogModalOpen(true)}
            title="View Match Details"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {isLogModalOpen && createPortal((
        <div className="debug-modal-overlay">
          <div className="debug-modal-content">
            <div className="debug-modal-header">
              <h3>Mapping Engine Execution Logs</h3>
              <button className="debug-modal-close" onClick={() => setIsLogModalOpen(false)}>&times;</button>
            </div>
            <div className="debug-modal-body-split">
              
              <div className="debug-modal-left">
                <div className="debug-doc-card">
                  <h4>How the Engine Works</h4>
                  <p>This automated rules-based engine uses a 4-phase NLP pipeline combined with TF-IDF Weighted Jaccard Similarity to map headers deterministically.</p>
                  
                  {engineVersion === 'v1' ? (
                    <div className="debug-doc-phase">
                      <strong>Phase 1: Sanitization (Standard v1)</strong>
                      <p>Forces lowercase, breaks CamelCase strings, handles compound mappings, and splits strings into raw tokens.</p>
                      <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        <em>CamelCase Split: <code>SupplierName</code> → <code>["supplier", "name"]</code></em><br/>
                        <em>Compound Map: <code>zipcode</code> → <code>["postal"]</code></em><br/>
                        <em>Raw Tokens: <code>count of all invoices</code> → <code>["count", "of", "all", "invoices"]</code></em>
                      </div>
                    </div>
                  ) : (
                    <div className="debug-doc-phase">
                      <strong>Phase 1: Deep Scan Segmentation (Greedy v2)</strong>
                      <p>Uses a greedy left-to-right algorithm to continuously slice the string against the global dictionary. Handles heavily concatenated strings and typos.</p>
                      <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        <em>100% Prefix Match: <code>totalamount</code> → <code>["total", "amount"]</code></em><br/>
                        <em>Fuzzy Match Recovery: <code>emialaddress</code> → <code>["email", "address"]</code></em><br/>
                        <em>Noise Dropping: <code>supplierxyzname</code> → <code>["supplier", "xyz", "name"]</code></em>
                      </div>
                    </div>
                  )}
                  
                  <div className="debug-doc-phase">
                    <strong>Phase 2: Lemmatization</strong>
                    <p>Scans for multi-word synonyms and individual keywords, translating them to standardized base tokens.</p>
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      <em>Example: <code>["contact", "number"]</code> → <code>["phone"]</code></em><br/>
                      <em>Example: <code>["dba"]</code> → <code>["alias"]</code></em>
                    </div>
                  </div>

                  <div className="debug-doc-phase">
                    <strong>Phase 3: Noise Reduction</strong>
                    <p>Removes generic stop words that add zero semantic value to the match.</p>
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      <em>Example: <code>["count", "of", "all", "invoices"]</code> → <code>["count", "invoices"]</code></em>
                    </div>
                  </div>
                  
                  <div className="debug-doc-phase">
                    <strong>Phase 4: Weighted Similarity</strong>
                    <p>Assigns dynamic weights (TF-IDF) to tokens based on how rare they are across all signatures. Generic words get low weight, specific words get high weight.</p>
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      <em>Weight Example: "email" (1.0), "address" (0.5), "number" (0.14)</em>
                    </div>
                    <p style={{ marginTop: '0.5rem' }}>It evaluates input against Target Signatures using: <br/><code>Matched Weight / (Target + Input - Matched)</code></p>
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      <em>Scoring Example: "Contact Email" matching "Email Address"<br/>
                      Target Weight: 1.5 ("email" + "address")<br/>
                      Input Weight: 1.2 ("email" + "contact" noise penalty)<br/>
                      Matched Weight: 1.0 ("email")<br/>
                      Score = 1.0 / (1.5 + 1.2 - 1.0) = ~58.8%</em>
                    </div>
                  </div>
                </div>
              </div>

              <div className="debug-modal-right">
                {TARGET_HEADERS.map(target => {
                  const logs = debugLogs[target.id];
                  if (!logs || logs.length === 0) return null;
                  return (
                    <div key={target.id} className="debug-target-section">
                      <h4>Target: {target.label}</h4>
                      <pre className="debug-log-text">
                        {logs.join('\n')}
                      </pre>
                    </div>
                  );
                })}
                {Object.keys(debugLogs).every(id => !debugLogs[id] || debugLogs[id].length === 0) && (
                  <div className="debug-empty-state">No mapped headers to display logs for.</div>
                )}
              </div>

            </div>
          </div>
        </div>
      ), document.body)}

      {(fileState.headerConfidence !== undefined && fileState.headerConfidence < 40) && (
        <div className="mapping-warning-banner">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong>Unpredictable Headers Detected:</strong> We could not reliably identify standard column headers in this file. The columns shown below may be raw data or incorrect. Please review carefully.
          </div>
        </div>
      )}

      <div className="mapping-grid-container">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>System Header (Target)</th>
              <th>Confidence</th>
              <th>Mapped File Headers (Source)</th>
            </tr>
          </thead>
          <tbody>
            {TARGET_HEADERS.map((target, targetIndex) => {
              const selectedSources = mappings[target.id] || [];
              const allMappedSourcesArray = Object.values(mappings).flat();

              return (
                <tr key={target.id}>
                  <td className="mapping-target-cell">
                    <span className="mapping-target-index">{targetIndex + 1}.</span>
                    {target.label} {target.required && <span className="mapping-target-req">*</span>}
                  </td>
                  <td>
                    {getConfidenceBadge(target.id, selectedSources.length)}
                  </td>
                  <td>
                    <div className="mapped-sources-container">
                      {selectedSources.map(sh => (
                        <div key={sh} className="mapped-source-chip">
                          {sh}
                          <button
                            onClick={() => handleRemoveSourceHeader(target.id, sh)}
                            className="mapped-source-remove"
                          >&times;</button>
                        </div>
                      ))}
                    </div>

                    <select
                      className="source-select-dropdown"
                      onChange={(e) => {
                        handleAddSourceHeader(target.id, e.target.value);
                        e.target.value = ''; // Reset select
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>+ Add Source Column</option>
                      {sourceHeadersToUse.filter(sh => !selectedSources.includes(sh)).map(sh => {
                        const mappedTargetId = Object.keys(mappings).find(tid => mappings[tid]?.includes(sh));
                        const mappedTargetIndex = mappedTargetId ? TARGET_HEADERS.findIndex(t => t.id === mappedTargetId) + 1 : -1;
                        const isMapped = mappedTargetIndex !== -1;
                        
                        return (
                          <option
                            key={sh}
                            value={sh}
                            disabled={isMapped}
                            className={isMapped ? 'source-option-disabled' : ''}
                          >
                            {sh} {isMapped ? `✓ (Mapped to ${mappedTargetIndex})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mapping-footer-actions">
        <div className="mapping-footer-left">
          <button className="btn btn-outline" onClick={handleClearAll} disabled={isProcessing}>Clear All</button>
          <button className="btn btn-outline" onClick={handleResetToAI} disabled={isProcessing}>
            {isProcessing ? 'Mapping...' : 'Reset to AI'}
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => onConfirm(fileState.file.name)} disabled={isProcessing}>
          Confirm Mapping & Continue
        </button>
      </div>
    </div>
  );
};
