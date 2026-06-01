import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  LayoutDashboard, 
  Settings2, 
  Table, 
  BarChart, 
  Database,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle,
  FileCheck2
} from 'lucide-react';

import FileUploader from './components/FileUploader';
import DataCleanerConfig from './components/DataCleanerConfig';
import DataPreview from './components/DataPreview';
import PivotTable from './components/PivotTable';
import DBSync from './components/DBSync';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Client-side extracted metadata
  const [columns, setColumns] = useState([]);
  const [totalRawRows, setTotalRawRows] = useState(0);

  // Cleaner configuration state
  const [config, setConfig] = useState({
    removeNulls: true,
    nullColumns: [],
    removeDuplicates: true,
    removeGibberish: true,
    trimData: true,
    limitRows: ''
  });

  // Processed results
  const [loading, setLoading] = useState(false);
  const [cleanedData, setCleanedData] = useState([]);
  const [stats, setStats] = useState({
    originalCount: 0,
    removedCount: 0,
    totalProcessed: 0,
    cleanedCount: 0
  });

  // Local helper to parse first row to extract column names
  const handleFileSelected = (file) => {
    setSelectedFile(file);
    
    // Reset output
    setCleanedData([]);
    setColumns([]);
    setTotalRawRows(0);
    setConfig(c => ({ ...c, nullColumns: [] }));

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', sheetRows: 2 });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Read headers
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (json.length > 0) {
          const headers = json[0].filter(h => h !== null && h !== undefined && h !== '');
          setColumns(headers);
          setTotalRawRows(0); // will be loaded dynamically from server response
        }
      } catch (err) {
        console.error('Error parsing file locally:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setColumns([]);
    setTotalRawRows(0);
    setCleanedData([]);
    setActiveTab('dashboard');
  };

  // Upload file and cleaning options to Express server
  const runDataCleaning = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('removeNulls', config.removeNulls);
      formData.append('nullColumns', JSON.stringify(config.nullColumns));
      formData.append('removeDuplicates', config.removeDuplicates);
      formData.append('removeGibberish', config.removeGibberish);
      formData.append('trimData', config.trimData);
      formData.append('limitRows', config.limitRows);

      const response = await fetch('http://localhost:5001/api/process', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setCleanedData(result.data);
        setColumns(result.columns);
        setTotalRawRows(result.originalCount);
        setStats({
          originalCount: result.originalCount,
          removedCount: result.removedCount,
          totalProcessed: result.totalProcessed,
          cleanedCount: result.cleanedCount
        });
        
        // Auto navigate to preview page
        setActiveTab('preview');
      } else {
        alert(result.error || 'Failed to process dataset.');
      }
    } catch (error) {
      console.error('API Error:', error);
      alert('Could not reach cleaning server. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const isCleanDataAvailable = cleanedData && cleanedData.length > 0;

  return (
    <div className="app-container">
      {/* Sidebar Layout */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <Sparkles size={20} color="#fff" />
          </div>
          <span className="logo-text">ClearSync DB</span>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard />
            Upload Dashboard
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'cleaner' ? 'active' : ''}`}
            onClick={() => {
              if (!selectedFile) return;
              setActiveTab('cleaner');
            }}
            disabled={!selectedFile}
            style={{ opacity: !selectedFile ? 0.4 : 1, cursor: !selectedFile ? 'not-allowed' : 'pointer' }}
          >
            <Settings2 />
            Data Cleaner
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => {
              if (!isCleanDataAvailable) return;
              setActiveTab('preview');
            }}
            disabled={!isCleanDataAvailable}
            style={{ opacity: !isCleanDataAvailable ? 0.4 : 1, cursor: !isCleanDataAvailable ? 'not-allowed' : 'pointer' }}
          >
            <Table />
            Cleaned Preview
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'pivot' ? 'active' : ''}`}
            onClick={() => {
              if (!isCleanDataAvailable) return;
              setActiveTab('pivot');
            }}
            disabled={!isCleanDataAvailable}
            style={{ opacity: !isCleanDataAvailable ? 0.4 : 1, cursor: !isCleanDataAvailable ? 'not-allowed' : 'pointer' }}
          >
            <BarChart />
            Pivot Analysis
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => {
              if (!isCleanDataAvailable) return;
              setActiveTab('sync');
            }}
            disabled={!isCleanDataAvailable}
            style={{ opacity: !isCleanDataAvailable ? 0.4 : 1, cursor: !isCleanDataAvailable ? 'not-allowed' : 'pointer' }}
          >
            <Database />
            Database Sync
          </button>
        </nav>

        <div style={{
          borderTop: '1px solid hsl(var(--border))',
          paddingTop: '16px',
          fontSize: '0.75rem',
          color: 'hsl(var(--text-dark))',
          textAlign: 'center'
        }}>
          ClearSync v1.0.0
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        
        {activeTab === 'dashboard' && (
          <div>
            <div className="header-section">
              <h2 className="header-title">Dataset Workspace</h2>
              <p className="header-description">Upload your spreadsheets to begin parsing, cleaning, and synchronizing with your MySQL database.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedFile ? '1.5fr 1fr' : '1fr', gap: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <FileUploader 
                  onFileSelected={handleFileSelected}
                  selectedFile={selectedFile}
                  onClear={handleClearFile}
                />

                {selectedFile && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>
                      <FileCheck2 size={20} className="text-gradient-purple" />
                      File Details
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="stat-card">
                        <span className="stat-label">Detected Columns</span>
                        <span className="stat-value primary">{columns.length}</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">Detected Records</span>
                        <span className="stat-value primary">{totalRawRows > 0 ? totalRawRows.toLocaleString() : 'Ready to Clean'}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('cleaner')} 
                      className="btn btn-primary"
                      style={{ marginTop: '8px' }}
                    >
                      Configure Cleaning
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>

              {!selectedFile && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 className="card-title">
                    <Info size={20} className="text-gradient-purple" />
                    How to Clean & Sync Data
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', flexShrink: 0 }} className="flex-center">1</div>
                      <p><strong>Upload File:</strong> Drag and drop your `.csv` or `.xlsx` files into the workspace. ClearSync detects the headers and rows instantly.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', flexShrink: 0 }} className="flex-center">2</div>
                      <p><strong>Data Cleaning:</strong> Configure duplicate filters, trim cell spaces, and remove records containing gibberish text or null values in specific columns.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', flexShrink: 0 }} className="flex-center">3</div>
                      <p><strong>Preview & Pivot:</strong> Analyze the filtered data in an interactive datagrid, download a local copy, and run custom Pivot heat-maps.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', flexShrink: 0 }} className="flex-center">4</div>
                      <p><strong>MySQL Export:</strong> Connect to XAMPP database directly, auto-generate optimal schema types, and execute bulk inserts.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cleaner' && selectedFile && (
          <div>
            <div className="header-section">
              <h2 className="header-title">Data Cleaning Panel</h2>
              <p className="header-description">Filter duplicates, trim spacing, and remove gibberish values before compiling tables.</p>
            </div>
            
            <DataCleanerConfig 
              columns={columns}
              config={config}
              setConfig={setConfig}
              onClean={runDataCleaning}
              loading={loading}
              totalRawRows={totalRawRows}
            />
          </div>
        )}

        {activeTab === 'preview' && isCleanDataAvailable && (
          <div>
            <div className="header-section">
              <h2 className="header-title">Dataset Preview</h2>
              <p className="header-description">View the filtered output, check metrics, search, and download a CSV copy of the clean data.</p>
            </div>

            <DataPreview 
              cleanedData={cleanedData}
              originalCount={stats.originalCount}
              removedCount={stats.removedCount}
              totalProcessed={stats.totalProcessed}
              columns={columns}
            />
          </div>
        )}

        {activeTab === 'pivot' && isCleanDataAvailable && (
          <div>
            <div className="header-section">
              <h2 className="header-title">Pivot Dimension Analysis</h2>
              <p className="header-description">Slice, group, and aggregate values dynamically using standard operations with visual heat mapping.</p>
            </div>

            <PivotTable 
              data={cleanedData}
              columns={columns}
            />
          </div>
        )}

        {activeTab === 'sync' && isCleanDataAvailable && (
          <div>
            <div className="header-section">
              <h2 className="header-title">Database Sync</h2>
              <p className="header-description">Configure XAMPP connections, test database statuses, auto-generate optimal schemas, and bulk-load data.</p>
            </div>

            <DBSync 
              cleanedData={cleanedData}
              columns={columns}
            />
          </div>
        )}

      </main>
    </div>
  );
}
