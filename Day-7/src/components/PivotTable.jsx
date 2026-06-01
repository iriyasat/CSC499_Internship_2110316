import React, { useState, useMemo } from 'react';
import { BarChart3, HelpCircle } from 'lucide-react';

export default function PivotTable({ data, columns }) {
  const [rowDimension, setRowDimension] = useState('');
  const [colDimension, setColDimension] = useState('');
  const [valDimension, setValDimension] = useState('');
  const [aggType, setAggType] = useState('SUM');

  // Automatically pre-populate dropdowns on load
  React.useEffect(() => {
    if (columns && columns.length > 0) {
      setRowDimension(columns[0]);
      setValDimension(columns[columns.length - 1]);
      if (columns.length > 1) {
        setColDimension('NONE');
      }
    }
  }, [columns]);

  // Compute the pivot table matrix
  const pivotResults = useMemo(() => {
    if (!data || data.length === 0 || !rowDimension || !valDimension) {
      return null;
    }

    const hasCol = colDimension && colDimension !== 'NONE';

    // 1. Gather all unique row dimension values
    const rowValuesSet = new Set();
    const colValuesSet = new Set();

    data.forEach(row => {
      const rVal = row[rowDimension] === null ? '(blank)' : String(row[rowDimension]);
      rowValuesSet.add(rVal);
      
      if (hasCol) {
        const cVal = row[colDimension] === null ? '(blank)' : String(row[colDimension]);
        colValuesSet.add(cVal);
      }
    });

    const rowHeaders = Array.from(rowValuesSet).sort();
    const colHeaders = hasCol ? Array.from(colValuesSet).sort() : ['Value'];

    // 2. Initialize matrix
    // matrix[rowVal][colVal] = Array of numeric values to aggregate
    const matrix = {};
    rowHeaders.forEach(r => {
      matrix[r] = {};
      colHeaders.forEach(c => {
        matrix[r][c] = [];
      });
    });

    // 3. Populating matrix cells
    data.forEach(row => {
      const rVal = row[rowDimension] === null ? '(blank)' : String(row[rowDimension]);
      const cVal = hasCol 
        ? (row[colDimension] === null ? '(blank)' : String(row[colDimension]))
        : 'Value';
      
      const rawVal = row[valDimension];
      if (rawVal !== null && rawVal !== undefined) {
        const numVal = Number(rawVal);
        matrix[rVal][cVal].push(isNaN(numVal) ? rawVal : numVal);
      }
    });

    // Helper to calculate aggregation on an array of values
    const aggregate = (vals) => {
      if (vals.length === 0) return null;

      // Filter only numbers for SUM, AVG, MIN, MAX
      const numVals = vals.map(Number).filter(v => !isNaN(v));

      switch (aggType) {
        case 'COUNT':
          return vals.length;
        case 'SUM':
          if (numVals.length === 0) return 0;
          return numVals.reduce((sum, v) => sum + v, 0);
        case 'AVERAGE':
          if (numVals.length === 0) return 0;
          return numVals.reduce((sum, v) => sum + v, 0) / numVals.length;
        case 'MIN':
          if (numVals.length === 0) return 0;
          return Math.min(...numVals);
        case 'MAX':
          if (numVals.length === 0) return 0;
          return Math.max(...numVals);
        default:
          return 0;
      }
    };

    // 4. Compute aggregated cell values, row totals, column totals
    const grid = {};
    const rowTotals = {};
    const colTotals = {};
    let grandTotalValues = [];

    rowHeaders.forEach(r => {
      grid[r] = {};
      let rowValsAccumulator = [];

      colHeaders.forEach(c => {
        const cellRawVals = matrix[r][c];
        const cellAggregated = aggregate(cellRawVals);
        grid[r][c] = cellAggregated;

        if (cellAggregated !== null) {
          rowValsAccumulator.push(...cellRawVals);
          if (!colTotals[c]) colTotals[c] = [];
          colTotals[c].push(...cellRawVals);
          grandTotalValues.push(...cellRawVals);
        }
      });

      rowTotals[r] = aggregate(rowValsAccumulator);
    });

    const colTotalsAggregated = {};
    colHeaders.forEach(c => {
      colTotalsAggregated[c] = aggregate(colTotals[c] || []);
    });

    const grandTotal = aggregate(grandTotalValues);

    // Calculate max value in cells (excluding totals) to compute heat mapping
    let maxCellValue = 1;
    rowHeaders.forEach(r => {
      colHeaders.forEach(c => {
        const val = grid[r][c];
        if (typeof val === 'number' && val > maxCellValue) {
          maxCellValue = val;
        }
      });
    });

    return {
      rowHeaders,
      colHeaders,
      grid,
      rowTotals,
      colTotals: colTotalsAggregated,
      grandTotal,
      maxCellValue,
      hasCol
    };

  }, [data, rowDimension, colDimension, valDimension, aggType]);

  // Determine heatmap class for a cell value
  const getHeatmapClass = (val, maxVal) => {
    if (val === null || val === undefined || typeof val !== 'number' || val <= 0 || maxVal === 0) {
      return '';
    }
    const ratio = val / maxVal;
    if (ratio < 0.2) return 'heat-level-0';
    if (ratio < 0.4) return 'heat-level-1';
    if (ratio < 0.6) return 'heat-level-2';
    if (ratio < 0.8) return 'heat-level-3';
    return 'heat-level-4';
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return val.toLocaleString();
      return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(val);
  };

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'hsl(var(--text-muted))' }}>
        <p>No dataset is loaded. Upload a clean dataset to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">
        <BarChart3 size={20} className="text-gradient-purple" />
        Pivot Analysis Engine
      </h3>

      <div className="pivot-builder-layout">
        
        {/* Dimensions selector sidebar */}
        <div className="pivot-selectors" style={{ borderRight: '1px solid hsl(var(--border))', paddingRight: '24px' }}>
          
          <div className="form-group">
            <label className="form-label">Row Dimension</label>
            <select 
              className="form-control"
              value={rowDimension}
              onChange={(e) => setRowDimension(e.target.value)}
            >
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Column Dimension</label>
            <select 
              className="form-control"
              value={colDimension}
              onChange={(e) => setColDimension(e.target.value)}
            >
              <option value="NONE">-- None (Simple Grouping) --</option>
              {columns.filter(c => c !== rowDimension).map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Value Aggregation Field</label>
            <select 
              className="form-control"
              value={valDimension}
              onChange={(e) => setValDimension(e.target.value)}
            >
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Aggregation Type</label>
            <select 
              className="form-control"
              value={aggType}
              onChange={(e) => setAggType(e.target.value)}
            >
              <option value="SUM">Sum</option>
              <option value="COUNT">Count</option>
              <option value="AVERAGE">Average</option>
              <option value="MIN">Minimum</option>
              <option value="MAX">Maximum</option>
            </select>
          </div>

          <div style={{
            background: 'hsl(var(--bg-main) / 0.5)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            fontSize: '0.75rem',
            color: 'hsl(var(--text-muted))',
            display: 'flex',
            alignItems: 'start',
            gap: '8px'
          }}>
            <HelpCircle size={16} style={{ flexShrink: 0, color: 'hsl(var(--primary))' }} />
            <div>
              <strong>Quick Tip:</strong> Use HSL heat-map cell values to identify concentration patterns in your metrics instantly.
            </div>
          </div>

        </div>

        {/* Pivot table view panel */}
        <div style={{ overflow: 'hidden' }}>
          {pivotResults ? (
            <div className="pivot-table-container">
              <table className="pivot-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>
                      {rowDimension} \ {pivotResults.hasCol ? colDimension : ''}
                    </th>
                    {pivotResults.colHeaders.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                    {pivotResults.hasCol && <th>Grand Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {pivotResults.rowHeaders.map(rowVal => (
                    <tr key={rowVal}>
                      <td className="row-header">{rowVal}</td>
                      {pivotResults.colHeaders.map(colVal => {
                        const cellVal = pivotResults.grid[rowVal][colVal];
                        const heatClass = getHeatmapClass(cellVal, pivotResults.maxCellValue);
                        return (
                          <td key={colVal} className={heatClass}>
                            {formatValue(cellVal)}
                          </td>
                        );
                      })}
                      {pivotResults.hasCol && (
                        <td className="total-cell">
                          {formatValue(pivotResults.rowTotals[rowVal])}
                        </td>
                      )}
                    </tr>
                  ))}
                  
                  {/* Totals row */}
                  <tr>
                    <td className="row-header total-cell">Grand Total</td>
                    {pivotResults.colHeaders.map(colVal => (
                      <td key={colVal} className="total-cell">
                        {formatValue(pivotResults.colTotals[colVal])}
                      </td>
                    ))}
                    {pivotResults.hasCol && (
                      <td className="total-cell" style={{ border: '2px double hsl(var(--primary))' }}>
                        {formatValue(pivotResults.grandTotal)}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
              Select fields on the left to generate the Pivot Table analysis.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
