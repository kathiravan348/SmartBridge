import React, { useState, useEffect } from 'react';
import { TARGET_HEADERS } from './schema';
import { FileState } from '../fileUpload/useFilePipeline';

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

export const MappingReviewUI: React.FC<MappingReviewUIProps> = ({ fileState, onConfirm }) => {
  // mapping state: target_id -> array of selected source headers
  const [mappings, setMappings] = useState<Record<string, string[]>>({});

  const sourceHeadersToUse = fileState.sourceHeaders && fileState.sourceHeaders.length > 0 
    ? fileState.sourceHeaders 
    : MOCK_SOURCE_HEADERS;

  const generateMockAIMappings = () => {
    const initialMapping: Record<string, string[]> = {};
    const usedGuesses = new Set<string>();

    TARGET_HEADERS.forEach(th => {
      // Very naive mock guessing logic that respects uniqueness
      const guess = sourceHeadersToUse.find(sh => 
        !usedGuesses.has(sh) && (
          sh.toLowerCase().includes(th.label.toLowerCase().split(' ')[0]) ||
          th.label.toLowerCase().includes(sh.toLowerCase().split(' ')[0])
        )
      );
      if (guess) {
        initialMapping[th.id] = [guess];
        usedGuesses.add(guess);
      } else {
        initialMapping[th.id] = [];
      }
    });
    return initialMapping;
  };

  // Mock AI Pre-population
  useEffect(() => {
    setMappings(generateMockAIMappings());
  }, [fileState.file.name]);

  const handleResetToAI = () => {
    setMappings(generateMockAIMappings());
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

  const getConfidenceBadge = (mappedCount: number) => {
    if (mappedCount === 0) {
      return <span className="badge badge-error">Unmapped</span>;
    }
    if (mappedCount > 1) {
      return <span className="badge badge-warning">Merged</span>;
    }
    return <span className="badge badge-success">High</span>;
  };

  const totalTargets = TARGET_HEADERS.length;
  const mappedTargets = TARGET_HEADERS.filter(th => (mappings[th.id] || []).length === 1).length;
  const mergedTargets = TARGET_HEADERS.filter(th => (mappings[th.id] || []).length > 1).length;
  const unmappedTargets = TARGET_HEADERS.filter(th => (mappings[th.id] || []).length === 0).length;

  return (
    <div className="glass-panel mapping-ui-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      <div className="mapping-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Mapping Review</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Review and confirm column mappings for <strong>{fileState.file.name}</strong></p>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{totalTargets}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Total</div>
          </div>
          <div style={{ width: '1px', background: 'var(--surface-border)' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#34d399' }}>{mappedTargets}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Mapped</div>
          </div>
          <div style={{ width: '1px', background: 'var(--surface-border)' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#facc15' }}>{mergedTargets}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Merged</div>
          </div>
          <div style={{ width: '1px', background: 'var(--surface-border)' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f87171' }}>{unmappedTargets}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Unmapped</div>
          </div>
        </div>
      </div>

      {(fileState.headerConfidence !== undefined && fileState.headerConfidence < 40) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '1rem', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong>Unpredictable Headers Detected:</strong> We could not reliably identify standard column headers in this file. The columns shown below may be raw data or incorrect. Please review carefully.
          </div>
        </div>
      )}

      <div className="mapping-grid-container" style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem' }}>System Header (Target)</th>
              <th style={{ padding: '1rem' }}>Confidence</th>
              <th style={{ padding: '1rem' }}>Mapped File Headers (Source)</th>
            </tr>
          </thead>
          <tbody>
            {TARGET_HEADERS.map((target, targetIndex) => {
              const selectedSources = mappings[target.id] || [];
              const allMappedSourcesArray = Object.values(mappings).flat();

              return (
                <tr key={target.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>{targetIndex + 1}.</span>
                    {target.label} {target.required && <span style={{ color: 'var(--danger-color)' }}>*</span>}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {getConfidenceBadge(selectedSources.length)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {selectedSources.map(sh => (
                        <div key={sh} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                          {sh}
                          <button
                            onClick={() => handleRemoveSourceHeader(target.id, sh)}
                            style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                          >&times;</button>
                        </div>
                      ))}
                    </div>

                    <select
                      className="source-select"
                      style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)', padding: '0.5rem', borderRadius: '4px', width: '100%' }}
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
                            style={{
                              color: isMapped ? 'var(--text-secondary)' : 'var(--text-primary)',
                              fontStyle: isMapped ? 'italic' : 'normal'
                            }}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem 0' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn" onClick={handleClearAll} style={{ background: 'transparent', border: '1px solid var(--surface-border)' }}>Clear All</button>
          <button className="btn" onClick={handleResetToAI} style={{ background: 'transparent', border: '1px solid var(--surface-border)' }}>Reset to AI</button>
        </div>
        <button className="btn btn-primary" onClick={() => onConfirm(fileState.file.name)}>
          Confirm Mapping & Continue
        </button>
      </div>
    </div>
  );
};
