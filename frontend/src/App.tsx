import React from 'react';
import { FileUploadPage } from './features/fileUpload/FileUploadPage';
import './App.css';
import './mapping.css';

function App() {
  return (
    <div className="app-container">
      <div className="header">
        <h1>SmartBridge</h1>
        <p>AI-Driven Data Ingestion Pipeline</p>
      </div>

      <FileUploadPage />
    </div>
  );
}

export default App;
