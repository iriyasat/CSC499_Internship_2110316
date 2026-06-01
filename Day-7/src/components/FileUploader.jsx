import React, { useState, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';

export default function FileUploader({ onFileSelected, selectedFile, onClear }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (file) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      alert("Invalid file format. Please upload a CSV (.csv) or Excel spreadsheet (.xlsx, .xls).");
      return;
    }

    onFileSelected(file);
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="card">
      <h3 className="card-title">
        <Upload size={20} className="text-gradient-purple" />
        Upload Dataset
      </h3>

      {!selectedFile ? (
        <div 
          className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
        >
          <input 
            ref={inputRef}
            type="file" 
            className="hidden-file-input" 
            style={{ display: 'none' }}
            onChange={handleChange}
            accept=".csv, .xlsx, .xls"
          />
          <div className="upload-icon-container">
            <Upload size={28} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>
              Drag and drop your spreadsheet here
            </p>
            <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
              Supports CSV, XLSX, or XLS files
            </p>
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginTop: '8px' }}>
            Browse Files
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between',
          padding: '20px',
          background: 'hsl(var(--bg-main))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius-md)',
          width: '100%'
        }} className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'hsl(var(--primary) / 0.1)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--primary))'
            }}>
              <FileText size={24} />
            </div>
            <div>
              <p style={{ fontWeight: 700, color: 'hsl(var(--text-main))' }}>
                {selectedFile.name}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                Size: {formatFileSize(selectedFile.size)} • Type: {selectedFile.name.split('.').pop().toUpperCase()}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClear} 
            className="btn btn-secondary" 
            style={{ padding: '8px', borderRadius: '50%', minWidth: '40px', height: '40px' }}
            title="Remove file"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
