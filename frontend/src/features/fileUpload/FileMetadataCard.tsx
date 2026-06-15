import React, { useRef, ChangeEvent } from 'react';
import { FileState, FileStatus } from './useFilePipeline';

interface FileMetadataCardProps {
  fileStates: FileState[];
  onAddFiles: (files: File[]) => void;
  onValidate: () => void;
  onRemoveFile: (fileName: string) => void;
}

const FileMetadataCard: React.FC<FileMetadataCardProps> = ({ fileStates, onAddFiles, onValidate, onRemoveFile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <span style={{
        backgroundColor: color.bg,
        color: color.text,
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginLeft: 'auto',
        marginRight: '1rem'
      }}>
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
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Selected Files ({fileStates.length})</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
          {fileStates.map((fs, index) => (
            <div key={`${fs.file.name}-${index}`} className="file-info-header" style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <div className="file-icon" style={{ width: '40px', height: '40px' }}>
                {getFileIcon(fs.file.name)}
              </div>
              <div className="file-details" style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <div className="file-name" title={fs.file.name}>{fs.file.name}</div>
                  <div className="file-size">{formatSize(fs.file.size)}</div>
                </div>
                {getStatusBadge(fs.status)}
              </div>
              <button
                onClick={() => onRemoveFile(fs.file.name)}
                style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
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
    </div>
  );
};

export default FileMetadataCard;
