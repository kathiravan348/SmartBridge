import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { detectHeaderRow } from '../headerDetection/headerDetector';

export type FileStatus = 'pending' | 'queued' | 'detecting' | 'confirming_header' | 'mapping' | 'validating' | 'completed' | 'error';

export interface FileState {
  file: File;
  status: FileStatus;
  sourceHeaders?: string[];
  headerConfidence?: number;
  keywordConfidence?: number;
  keywordBreakdown?: {name: string, score: number}[];
  sampleRows?: any[][];
  headerRowIndex?: number;
  isPivoted?: boolean;
  verticalKeywordScore?: number;
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

  const parseFile = async (file: File, rowCount: number = 50): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
            // Map undefined to null to match python behavior if needed, but the heuristic handles undefined
            resolve(json.slice(0, rowCount) as any[][]);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        Papa.parse(file, {
          preview: rowCount,
          skipEmptyLines: true,
          complete: (results) => {
            resolve(results.data as any[][]);
          },
          error: (error) => {
            reject(error);
          }
        });
      }
    });
  };

  const processNextInQueue = async (fileState: FileState) => {
    try {
      const sampleRows = await parseFile(fileState.file, 200);
      const detectionResult = detectHeaderRow(sampleRows);

      if (!detectionResult.detected_headers || detectionResult.detected_headers.length === 0) {
        setSelectedFiles(current => current.map(f => 
          f.file.name === fileState.file.name 
            ? { 
                ...f, 
                status: 'error',
                sourceHeaders: detectionResult.detected_headers,
                headerConfidence: detectionResult.confidence_score,
                keywordConfidence: detectionResult.keyword_confidence_score,
                keywordBreakdown: detectionResult.keyword_breakdown,
                isPivoted: detectionResult.is_pivoted,
                verticalKeywordScore: detectionResult.vertical_keyword_score
              } 
            : f
        ));
        setTimeout(triggerNextInQueue, 50);
        return;
      }

      setSelectedFiles(current => 
        current.map(f => f.file.name === fileState.file.name 
          ? { 
              ...f, 
              status: 'confirming_header', 
              sourceHeaders: detectionResult.detected_headers, 
              headerConfidence: detectionResult.confidence_score, 
              keywordConfidence: detectionResult.keyword_confidence_score,
              keywordBreakdown: detectionResult.keyword_breakdown,
              sampleRows: detectionResult.sample_rows, 
              headerRowIndex: detectionResult.header_row_index,
              isPivoted: detectionResult.is_pivoted,
              verticalKeywordScore: detectionResult.vertical_keyword_score
            } 
          : f
        )
      );

    } catch (err) {
      console.error('Processing error:', err);
      setSelectedFiles(current => current.map(f => f.file.name === fileState.file.name ? { ...f, status: 'error' } : f));
    }

    setTimeout(triggerNextInQueue, 50);
  };

  const triggerNextInQueue = () => {
    setSelectedFiles(prev => {
      // If there is already a file being processed or waiting for user interaction, do not trigger the next
      if (prev.some(f => f.status === 'mapping' || f.status === 'confirming_header' || f.status === 'detecting')) {
        return prev;
      }

      const nextFile = prev.find(f => f.status === 'queued');
      if (nextFile) {
        // We use a timeout to avoid changing state while returning prev, we let the effect run asynchronously
        setTimeout(() => processNextInQueue(nextFile), 0);
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
    setSelectedFiles(prev => prev.map(f => f.file.name === fileName ? { ...f, status: 'validating' } : f));
    await new Promise(r => setTimeout(r, 1500));
    setSelectedFiles(prev => prev.map(f => {
      if (f.file.name === fileName) {
        return { ...f, status: f.file.name.includes('Negative') ? 'error' : 'completed' };
      }
      return f;
    }));
    setTimeout(triggerNextInQueue, 500);
  };

  const confirmHeader = (fileName: string, finalHeaders: string[]) => {
    setSelectedFiles(prev => prev.map(f => {
      if (f.file.name === fileName) {
        return { ...f, status: 'completed', sourceHeaders: finalHeaders };
      }
      return f;
    }));
    setTimeout(triggerNextInQueue, 50);
  };

  const markAsError = (fileName: string) => {
    setSelectedFiles(prev => prev.map(f => {
      if (f.file.name === fileName) {
        return { ...f, status: 'error' };
      }
      return f;
    }));
    setTimeout(triggerNextInQueue, 50);
  };

  return {
    selectedFiles,
    handleFilesSelect,
    handleRemoveFile,
    handleValidate,
    confirmHeader,
    confirmMapping,
    markAsError
  };
};
