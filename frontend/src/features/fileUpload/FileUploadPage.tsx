import React, { useState } from 'react';
import FileUploader from './FileUploader';
import FileMetadataCard from './FileMetadataCard';
import { MappingReviewUI } from '../mappingReview/MappingReviewUI';
import { HeaderConfirmationUI } from '../headerDetection/HeaderConfirmationUI';
import { useFilePipeline } from './useFilePipeline';

export const FileUploadPage: React.FC = () => {
  const { selectedFiles, handleFilesSelect, handleRemoveFile, handleValidate, confirmMapping, confirmHeader, markAsError } = useFilePipeline();

  const fileInMapping = selectedFiles.find(f => f.status === 'mapping');
  const fileInConfirmation = selectedFiles.find(f => f.status === 'confirming_header');
  const activeFile = fileInMapping || fileInConfirmation;

  return (
    <>
      <div className={`split-layout ${activeFile ? 'active' : ''}`}>
      <div className="left-panel">
        {selectedFiles.length === 0 ? (
          <FileUploader onFileSelect={handleFilesSelect} />
        ) : (
          <FileMetadataCard 
            fileStates={selectedFiles} 
            onAddFiles={handleFilesSelect}
            onRemoveFile={handleRemoveFile}
            onValidate={handleValidate} 
          />
        )}
      </div>
      
      {activeFile && (
        <div className="right-panel">
          {fileInConfirmation ? (
            <HeaderConfirmationUI 
              fileState={fileInConfirmation} 
              onConfirm={confirmHeader} 
              onError={markAsError}
            />
          ) : fileInMapping ? (
            <MappingReviewUI fileState={fileInMapping} onConfirm={confirmMapping} />
          ) : null}
        </div>
      )}
    </div>
    </>
  );
};
