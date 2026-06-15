import React, { useState } from 'react';
import { FileState } from './useFilePipeline';

interface HeaderConfirmationUIProps {
  fileState: FileState;
  onConfirm: (fileName: string, finalHeaders: string[]) => void;
}

export const HeaderConfirmationUI: React.FC<HeaderConfirmationUIProps> = ({ fileState, onConfirm }) => {
  const isConfident = fileState.headerConfidence !== undefined && fileState.headerConfidence >= 50;
  
  // If confident, we default to the source headers. If not, start empty so they MUST select one.
  const [editableHeaders, setEditableHeaders] = useState<string>(
    isConfident && fileState.sourceHeaders ? fileState.sourceHeaders.join(', ') : ''
  );

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | undefined>(
    isConfident ? fileState.headerRowIndex : undefined
  );
  const [showPreview, setShowPreview] = useState<boolean>(!isConfident);

  const handleConfirm = () => {
    // split by comma, trim, and send
    const finalHeaders = editableHeaders.split(',').map(h => h.trim()).filter(h => h.length > 0);
    onConfirm(fileState.file.name, finalHeaders.length > 0 ? finalHeaders : (fileState.sourceHeaders || []));
  };

  const selectRowAsHeader = (row: any[], index: number) => {
    const stringified = row.map((cell, idx) => {
      if (cell === null || cell === undefined || cell === '') {
        return `Column_${idx + 1}`;
      }
      return String(cell).trim();
    });
    setEditableHeaders(stringified.join(', '));
    setSelectedRowIndex(index);
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
        <h2>Header Detection Confirmation</h2>
        <p style={{ color: 'var(--text-secondary)' }}>File: <strong>{fileState.file.name}</strong></p>
      </div>

      {isConfident ? (
        <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.4)', padding: '1rem', borderRadius: '8px', color: '#34d399', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>High Confidence Detection</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              The system is confident it found the correct header row (Score: {fileState.headerConfidence}). Please review the headers below and confirm to proceed.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '1rem', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Unpredictable File Detected</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              The system could not reliably identify the header row (Score: {fileState.headerConfidence}). Please select the correct row from the preview below, or manually edit the headers.
            </p>
          </div>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
            Detected / Selected Headers (Comma Separated) 
            {selectedRowIndex !== undefined && selectedRowIndex !== -1 && <span style={{ color: '#60a5fa', marginLeft: '0.5rem' }}>[Row {selectedRowIndex + 1}]</span>}
          </label>
        </div>
        <textarea 
          value={editableHeaders}
          onChange={(e) => setEditableHeaders(e.target.value)}
          style={{ width: '100%', minHeight: '80px', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-color)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', fontFamily: 'monospace' }}
        />
      </div>

      {showPreview && fileState.sampleRows && fileState.sampleRows.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '1rem', fontWeight: 500 }}>Select a Row from File Preview:</h4>
          <div style={{ overflowX: 'auto', border: '1px solid var(--surface-border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.5rem', width: '50px' }}>Action</th>
                  <th style={{ padding: '0.5rem', width: '40px' }}>Row</th>
                  <th style={{ padding: '0.5rem' }}>Data Preview</th>
                </tr>
              </thead>
              <tbody>
                {fileState.sampleRows.map((row, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--surface-border)', background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <button 
                        onClick={() => selectRowAsHeader(row, index)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', background: selectedRowIndex === index ? '#10b981' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        {selectedRowIndex === index ? 'Selected' : 'Select'}
                      </button>
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{index + 1}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                      {JSON.stringify(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
        <button 
          onClick={() => setShowPreview(!showPreview)}
          className="btn" 
          style={{ background: 'transparent', border: '1px solid var(--surface-border)' }}
        >
          {showPreview ? 'Hide File Preview' : 'Manually Select Header Row'}
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleConfirm}
          disabled={!isConfident && editableHeaders.trim() === ''}
        >
          Confirm Headers &amp; Continue
        </button>
      </div>
    </div>
  );
};
