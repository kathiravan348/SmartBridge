import { useState } from 'react';
import { detectHeaderRow } from './headerDetector';

export type FileStatus = 'pending' | 'queued' | 'detecting' | 'confirming_header' | 'mapping' | 'validating' | 'completed' | 'error';

export interface FileState {
  file: File;
  status: FileStatus;
  sourceHeaders?: string[];
  headerConfidence?: number;
  sampleRows?: any[][];
  headerRowIndex?: number;
}

export const useFilePipeline = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileState[]>([]);

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(f => f.file.name));
      const newUniqueFiles = files.filter(f => !existingNames.has(f.name));
      const newFileStates = newUniqueFiles.map(f => ({ file: f, status: 'pending' as FileStatus }));
      return [...prev, ...newFileStates];
    });
  };

  const handleRemoveFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => f.file.name !== fileName));
  };

  const triggerNextInQueue = () => {
    setSelectedFiles(prev => {
      // Wait if there's already a file being mapped or detected
      if (prev.some(f => f.status === 'mapping' || f.status === 'confirming_header' || f.status === 'detecting')) return prev;

      const nextFile = prev.find(f => f.status === 'queued');
      if (nextFile) {
        // Kick off async detection
        detectHeaderRow(nextFile.file).then(result => {
          setSelectedFiles(current => 
            current.map(f => f.file.name === nextFile.file.name 
              ? { ...f, status: 'confirming_header', sourceHeaders: result.headers, headerConfidence: result.confidenceScore, sampleRows: result.sampleRows, headerRowIndex: result.headerRowIndex } 
              : f
            )
          );
        });
        
        // Transition to detecting state to prevent race conditions
        return prev.map(f => f.file.name === nextFile.file.name ? { ...f, status: 'detecting' } : f);
      }
      return prev;
    });
  };

  const handleValidate = () => {
    setSelectedFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'queued' } : f));
    setTimeout(triggerNextInQueue, 50);
  };

  const confirmMapping = async (fileName: string) => {
    // User finished mapping, move to validating
    setSelectedFiles(prev => prev.map(f => f.file.name === fileName ? { ...f, status: 'validating' } : f));

    // Mock validation process
    await new Promise(r => setTimeout(r, 1500));

    setSelectedFiles(prev => prev.map(f => {
      if (f.file.name === fileName) {
        return { ...f, status: f.file.name.includes('Negative') ? 'error' : 'completed' };
      }
      return f;
    }));

    // Trigger the next file in the queue
    setTimeout(triggerNextInQueue, 500);
  };

  const confirmHeader = (fileName: string, finalHeaders: string[]) => {
    setSelectedFiles(prev => prev.map(f => f.file.name === fileName ? { ...f, status: 'mapping', sourceHeaders: finalHeaders } : f));
  };

  return {
    selectedFiles,
    handleFilesSelect,
    handleRemoveFile,
    handleValidate,
    confirmHeader,
    confirmMapping
  };
};
