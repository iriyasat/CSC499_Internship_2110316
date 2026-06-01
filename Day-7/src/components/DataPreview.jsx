import React, { useState } from 'react';
import { Database, Search, ArrowLeft, ArrowRight, Download } from 'lucide-react';

export default function DataPreview({ cleanedData, originalCount, removedCount, totalProcessed, columns }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!cleanedData || cleanedData.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'hsl(var(--text-muted))' }}>
        <p>No clean data preview available. Upload a file and configure the cleaner to begin.</p>
      </div>
    );
  }

  // Filter data based on query
  const filteredData = cleanedData.filter(row => {
    return Object.values(row).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Calculate pagination details
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getRetentionRate = () => {
    if (totalProcessed === 0) return '0%';
    const rate = (cleanedData.length / totalProcessed) * 100;
    return rate.toFixed(1) + '%';
  };

  // Trigger browser download of cleaned data as CSV
  const downloadCSV = () => {
    if (cleanedData.length === 0) return;
    
    // Create CSV header
    const csvRows = [columns.join(',')];
    
    // Create CSV body rows
    for (const row of cleanedData) {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        // Escape quotes
        const valStr = String(val).replace(/"/g, '""');
        return `"${valStr}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cleaned_dataset_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Metrics Dashboard */}
      <div className="stats-container">
        <div className="stat-card">
          <span className="stat-label">Original Rows Count</span>
          <span className="stat-value primary">{originalCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Processed Range</span>
          <span className="stat-value primary">{totalProcessed}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Cleaned Rows Retained</span>
          <span className="stat-value success">{cleanedData.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Rows Removed / Discarded</span>
          <span className="stat-value danger">{removedCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Data Retention Rate</span>
          <span className="stat-value success">{getRetentionRate()}</span>
        </div>
      </div>

      <div className="card">
        <div className="flex-between" style={{ marginBottom: '20px', gap: '20px', flexWrap: 'wrap' }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            <Database size={20} className="text-gradient-purple" />
            Cleaned Data Preview
          </h3>
          
          <div style={{ display: 'flex', gap: '12px', flexGrow: 1, justifySelf: 'end', maxWidth: '500px' }}>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <input 
                type="text"
                placeholder="Search cleaned data..."
                className="form-control"
                style={{ width: '100%', paddingLeft: '40px' }}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
              <Search 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'hsl(var(--text-muted))'
                }} 
              />
            </div>
            
            <button onClick={downloadCSV} className="btn btn-secondary" title="Download Cleaned CSV">
              <Download size={18} />
              Export CSV
            </button>
          </div>
        </div>

        {totalItems === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
            No records matched your search query.
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>#</th>
                    {columns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((row, idx) => {
                    const rowNum = indexOfFirstItem + idx + 1;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold', color: 'hsl(var(--text-dark))' }}>{rowNum}</td>
                        {columns.map(col => {
                          const val = row[col];
                          return (
                            <td key={col} title={val !== null ? String(val) : 'NULL'}>
                              {val === null || val === undefined ? (
                                <span className="null-cell">[NULL]</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  Showing <strong>{indexOfFirstItem + 1}</strong> to <strong>{Math.min(indexOfLastItem, totalItems)}</strong> of <strong>{totalItems}</strong> entries
                </span>
                <div className="pagination-buttons">
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px' }}
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  
                  <span className="flex-center" style={{ padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px' }}
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
