import React from 'react';
import { Settings, Sparkles, AlertCircle } from 'lucide-react';

export default function DataCleanerConfig({ 
  columns, 
  config, 
  setConfig, 
  onClean, 
  loading,
  totalRawRows
}) {
  const toggleNullColumn = (col) => {
    const selected = config.nullColumns.includes(col);
    if (selected) {
      setConfig({
        ...config,
        nullColumns: config.nullColumns.filter(c => c !== col)
      });
    } else {
      setConfig({
        ...config,
        nullColumns: [...config.nullColumns, col]
      });
    }
  };

  const selectAllColumns = () => {
    setConfig({ ...config, nullColumns: [...columns] });
  };

  const clearAllColumns = () => {
    setConfig({ ...config, nullColumns: [] });
  };

  return (
    <div className="card">
      <h3 className="card-title">
        <Settings size={20} className="text-gradient-purple" />
        Cleaning Configuration
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Row Limit Control */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Data Range Limit</label>
            <input 
              type="number"
              placeholder={`All rows (Max: ${totalRawRows || 'N/A'})`}
              className="form-control"
              value={config.limitRows}
              onChange={(e) => setConfig({ ...config, limitRows: e.target.value })}
              min="1"
            />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
              Leave blank to clean the entire dataset.
            </span>
          </div>
        </div>

        {/* Cleaning Switches */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          
          <label className="form-checkbox-group">
            <input 
              type="checkbox" 
              className="form-checkbox"
              checked={config.trimData}
              onChange={(e) => setConfig({ ...config, trimData: e.target.checked })}
            />
            <div className="checkbox-label">
              <span className="checkbox-title">Trim Whitespace</span>
              <span className="checkbox-desc">Remove leading/trailing spaces</span>
            </div>
          </label>

          <label className="form-checkbox-group">
            <input 
              type="checkbox" 
              className="form-checkbox"
              checked={config.removeDuplicates}
              onChange={(e) => setConfig({ ...config, removeDuplicates: e.target.checked })}
            />
            <div className="checkbox-label">
              <span className="checkbox-title">Deduplicate Rows</span>
              <span className="checkbox-desc">Remove exact duplicate rows</span>
            </div>
          </label>

          <label className="form-checkbox-group">
            <input 
              type="checkbox" 
              className="form-checkbox"
              checked={config.removeGibberish}
              onChange={(e) => setConfig({ ...config, removeGibberish: e.target.checked })}
            />
            <div className="checkbox-label">
              <span className="checkbox-title">Filter Gibberish Data</span>
              <span className="checkbox-desc">Remove rows with corrupt/unreadable characters</span>
            </div>
          </label>

          <label className="form-checkbox-group">
            <input 
              type="checkbox" 
              className="form-checkbox"
              checked={config.removeNulls}
              onChange={(e) => setConfig({ ...config, removeNulls: e.target.checked })}
            />
            <div className="checkbox-label">
              <span className="checkbox-title">Remove Null / Empty Rows</span>
              <span className="checkbox-desc">Remove rows with missing values</span>
            </div>
          </label>
        </div>

        {/* Column multi-select for Null Values (Visible if removeNulls is checked) */}
        {config.removeNulls && columns.length > 0 && (
          <div style={{
            padding: '20px',
            background: 'hsl(var(--bg-main) / 0.3)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed hsl(var(--border))'
          }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <span className="form-label" style={{ fontSize: '0.8rem' }}>
                Select columns to scan for nulls ({config.nullColumns.length} selected)
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={selectAllColumns} 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                >
                  Select All
                </button>
                <button 
                  onClick={clearAllColumns} 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '8px 0'
            }}>
              {columns.map((col) => {
                const isSelected = config.nullColumns.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => toggleNullColumn(col)}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '20px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: 'none'
                    }}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '8px' }}>
              <AlertCircle size={12} />
              Rows containing empty cells in the selected columns will be discarded. If none are selected, all columns will be scanned.
            </p>
          </div>
        )}

        <button 
          onClick={onClean}
          disabled={loading}
          className="btn btn-primary pulse-button"
          style={{ width: '100%', marginTop: '8px', padding: '16px' }}
        >
          {loading ? (
            <span>Processing and Cleaning Data...</span>
          ) : (
            <>
              <Sparkles size={18} />
              Clean & Process Dataset
            </>
          )}
        </button>
      </div>
    </div>
  );
}
