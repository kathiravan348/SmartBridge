import React, { useRef, ChangeEvent, useState } from 'react';
import { FileState, FileStatus } from './useFilePipeline';
import './FileMetadataCard.css';

interface FileMetadataCardProps {
  fileStates: FileState[];
  onAddFiles: (files: File[]) => void;
  onValidate: () => void;
  onRemoveFile: (fileName: string) => void;
}

const FileMetadataCard: React.FC<FileMetadataCardProps> = ({ fileStates, onAddFiles, onValidate, onRemoveFile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePopupFile, setActivePopupFile] = useState<string | null>(null);

  if (!fileStates || fileStates.length === 0) return null;

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Determine icon based on extension
  const getFileIcon = (name: string) => {
    const isCsv = name.toLowerCase().endsWith('.csv');
    if (isCsv) {
      return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  };

  const getStatusBadge = (status: FileStatus) => {
    if (status === 'pending') {
      return null;
    }

    const colors: Record<FileStatus, { bg: string, text: string }> = {
      pending: { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8' },
      queued: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
      mapping: { bg: 'rgba(234, 179, 8, 0.2)', text: '#facc15' },
      validating: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c' },
      completed: { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
      error: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' },
    };

    const color = colors[status] || colors.pending;

    return (
      <span
        className="status-badge"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {status}
      </span>
    );
  };

  const handleUploadMoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      onAddFiles(newFiles);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glass-panel metadata-card">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        style={{ display: 'none' }}
      />

      <div className="file-list">
        <h3 className="file-list-header">Selected Files ({fileStates.length})</h3>

        <div className="file-list-container">
          {fileStates.map((fs, index) => (
            <div key={`${fs.file.name}-${index}`} className="file-item-card">
              <div className="file-icon-wrapper">
                {getFileIcon(fs.file.name)}
              </div>
              <div className="file-details-wrapper">
                <div className="file-info-col">
                  <div className="file-name" title={fs.file.name}>{fs.file.name}</div>
                  <div className="file-size">{formatSize(fs.file.size)}</div>
                  {(fs.headerConfidence !== undefined || fs.keywordConfidence !== undefined) && (
                    <div className="confidence-text" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      {fs.headerConfidence !== undefined && (
                        <div>
                          <span className="confidence-label">Structural Confidence:</span> {fs.headerConfidence}%
                          {fs.headerRowIndex !== undefined && ` (Row ${fs.headerRowIndex + 1})`}
                        </div>
                      )}
                      {fs.keywordConfidence !== undefined && (
                        <div>
                          <span className="confidence-label">Keyword Confidence:</span> {fs.keywordConfidence}%
                        </div>
                      )}
                      {fs.verticalKeywordScore !== undefined && (
                        <div>
                          <span className="confidence-label">Pivoted Keyword Confidence:</span> {fs.verticalKeywordScore}%
                        </div>
                      )}
                      {fs.isPivoted && (
                        <div className="pivoted-warning" style={{ color: 'var(--danger-color)', marginTop: '2px', marginLeft: '0px', fontWeight: 500 }}>
                          (Looks like Pivoted Table)
                        </div>
                      )}
                    </div>
                  )}
                  {fs.status !== 'error' && fs.status !== 'confirming_header' && fs.headerConfidence !== undefined && fs.headerConfidence >= 50 && !fs.isPivoted && fs.sourceHeaders && fs.sourceHeaders.length > 0 && (
                    <div
                      onClick={() => setActivePopupFile(fs.file.name)}
                      className="view-headers-link"
                    >
                      View Headers ({fs.sourceHeaders.length})
                    </div>
                  )}
                </div>
                {getStatusBadge(fs.status)}
              </div>
              <button
                onClick={() => onRemoveFile(fs.file.name)}
                className="remove-file-btn"
                title="Remove file"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card-actions">
        <button className="btn" onClick={handleUploadMoreClick}>
          Upload More
        </button>
        <button className="btn btn-primary" onClick={onValidate}>
          Validate Files
        </button>
      </div>

      {/* Header View Popup Modal */}
      {activePopupFile && (
        <div
          className="modal-overlay"
          onClick={() => setActivePopupFile(null)}
        >
          {(() => {
            const fs = fileStates.find(f => f.file.name === activePopupFile);
            if (!fs || !fs.sourceHeaders) return null;
            return (
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="modal-header">
                  <span>Detected Headers <span className="modal-header-count">({fs.sourceHeaders.length})</span></span>
                  <button onClick={() => setActivePopupFile(null)} className="modal-close-btn">✕</button>
                </h3>
                <div className="headers-chip-container">
                  {fs.sourceHeaders.map((header, i) => (
                    <span key={i} className="header-chip">
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default FileMetadataCard;
