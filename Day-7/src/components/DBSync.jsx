import React, { useState } from 'react';
import { Database, ShieldCheck, RefreshCw, Send, AlertTriangle, CheckCircle } from 'lucide-react';

export default function DBSync({ cleanedData, columns }) {
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '',
    database: 'cleaned_data_db',
    tableName: 'sales_data'
  });

  const [importMode, setImportMode] = useState('overwrite'); // 'overwrite' or 'append'
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null); // { success: boolean, message: string }
  const [progress, setProgress] = useState(0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDbConfig({ ...dbConfig, [name]: value });
  };

  // Connects to local express API to check MySQL connection
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('http://localhost:5001/api/mysql/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed.' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Could not connect to backend server. Make sure node server.js is running.' });
    } finally {
      setTesting(false);
    }
  };

  // Triggers backend upload
  const exportToDatabase = async () => {
    if (!cleanedData || cleanedData.length === 0) return;
    setExporting(true);
    setExportResult(null);
    setProgress(10);

    try {
      // Simulate chunk uploading/progress values
      const progressInterval = setInterval(() => {
        setProgress(p => {
          if (p >= 80) {
            clearInterval(progressInterval);
            return p;
          }
          return p + 15;
        });
      }, 200);

      const response = await fetch('http://localhost:5001/api/mysql/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dbConfig,
          columns,
          data: cleanedData,
          importMode
        })
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();
      if (response.ok && data.success) {
        setExportResult({ success: true, message: data.message });
      } else {
        setExportResult({ success: false, message: data.error || 'Export failed.' });
      }
    } catch (error) {
      setExportResult({ success: false, message: 'Could not connect to backend server. Make sure node server.js is running.' });
    } finally {
      setExporting(false);
    }
  };

  const isDataAvailable = cleanedData && cleanedData.length > 0;

  return (
    <div className="card">
      <h3 className="card-title">
        <Database size={20} className="text-gradient-purple" />
        XAMPP Database Connector
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', flexWrap: 'wrap' }}>
        
        {/* Connection Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            MySQL Credentials
          </h4>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Database Host</label>
              <input 
                type="text" 
                name="host" 
                className="form-control" 
                value={dbConfig.host} 
                onChange={handleInputChange} 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Port</label>
              <input 
                type="text" 
                name="port" 
                className="form-control" 
                value={dbConfig.port} 
                onChange={handleInputChange} 
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                name="user" 
                className="form-control" 
                value={dbConfig.user} 
                onChange={handleInputChange} 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                name="password" 
                placeholder="Empty (XAMPP Default)" 
                className="form-control" 
                value={dbConfig.password} 
                onChange={handleInputChange} 
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Database Name</label>
              <input 
                type="text" 
                name="database" 
                className="form-control" 
                value={dbConfig.database} 
                onChange={handleInputChange} 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Table Name</label>
              <input 
                type="text" 
                name="tableName" 
                className="form-control" 
                value={dbConfig.tableName} 
                onChange={handleInputChange} 
              />
            </div>
          </div>

          <button 
            type="button" 
            onClick={testConnection} 
            disabled={testing} 
            className="btn btn-secondary flex-center"
            style={{ width: '100%', padding: '12px' }}
          >
            {testing ? (
              <>
                <RefreshCw size={16} className="spin" style={{ marginRight: '8px' }} />
                Testing Database Connection...
              </>
            ) : (
              <>
                <ShieldCheck size={16} style={{ marginRight: '8px' }} />
                Test DB Connection
              </>
            )}
          </button>

          {/* Test Status Alert */}
          {testResult && (
            <div className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'}`}>
              {testResult.success ? (
                <>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Connection Successful!</strong>
                    <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>{testResult.message}</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Connection Failed:</strong>
                    <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>{testResult.message}</p>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* Sync Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h4 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Data Import Settings
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className="form-label">Upload Mode</span>
            
            <label className="form-checkbox-group">
              <input 
                type="radio" 
                name="importMode" 
                className="form-checkbox"
                checked={importMode === 'overwrite'}
                onChange={() => setImportMode('overwrite')}
              />
              <div className="checkbox-label">
                <span className="checkbox-title">Overwrite (Recreate Table)</span>
                <span className="checkbox-desc">Drops existing table and builds fresh schema. Perfect for fresh file loads.</span>
              </div>
            </label>

            <label className="form-checkbox-group">
              <input 
                type="radio" 
                name="importMode" 
                className="form-checkbox"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
              />
              <div className="checkbox-label">
                <span className="checkbox-title">Append Data</span>
                <span className="checkbox-desc">Inserts rows into the existing table. Keeps original schema and data.</span>
              </div>
            </label>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'hsl(var(--bg-main) / 0.3)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              fontSize: '0.85rem'
            }}>
              <p>Dataset Ready for Sync: <strong>{isDataAvailable ? `${cleanedData.length.toLocaleString()} cleaned rows` : 'None'}</strong></p>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                Column count: {columns.length} columns detected.
              </p>
            </div>

            <button
              onClick={exportToDatabase}
              disabled={!isDataAvailable || exporting}
              className="btn btn-primary pulse-button"
              style={{ width: '100%', padding: '16px' }}
            >
              {exporting ? (
                <>
                  <RefreshCw size={18} className="spin" style={{ marginRight: '8px' }} />
                  Exporting to XAMPP...
                </>
              ) : (
                <>
                  <Send size={18} style={{ marginRight: '8px' }} />
                  Export to XAMPP MySQL
                </>
              )}
            </button>
          </div>

          {/* Export Status Progress / Alerts */}
          {exporting && (
            <div>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Export progress: {progress}%</span>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {exportResult && (
            <div className={`alert ${exportResult.success ? 'alert-success' : 'alert-danger'}`}>
              {exportResult.success ? (
                <>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Export Succeeded!</strong>
                    <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>{exportResult.message}</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Export Error:</strong>
                    <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>{exportResult.message}</p>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
