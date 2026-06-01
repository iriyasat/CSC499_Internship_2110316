// Global Dashboard Application State
const state = {
  activeTab: 'tab-charts',
  filters: {
    search: '',
    make: '',
    year: '',
    transmission: ''
  },
  pagination: {
    page: 1,
    limit: 10,
    totalPages: 1,
    totalRecords: 0
  },
  charts: {
    monthly: null,
    makes: null,
    weekly: null,
    transmission: null
  },
  pivot: {
    row: 'make',
    col: 'transmission',
    metric: 'count'
  },
  currentSales: [] // Caches rows on the current page for CRUD edits
};

// Client-side table sorting state
state.databaseSort = { field: null, order: 'asc' };

// Utilities & Formatting
const formatCurrency = (val) => {
  if (val === null || val === undefined) return '$0.00';
  const num = parseFloat(val);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatNumber = (val) => {
  if (val === null || val === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(val));
};

const formatDecimal = (val, decimals = 1) => {
  if (val === null || val === undefined) return '0.0';
  return parseFloat(val).toFixed(decimals);
};

const barValueLabelsPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((element, index) => {
        const value = dataset.data[index];
        if (value === null || value === undefined) return;

        const { x, y } = element.tooltipPosition();
        ctx.fillText(formatNumber(value), x, y - 6);
      });
    });

    ctx.restore();
  }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFilterControls();
  initPivotControls();
  initDatabasePagination();
  initCRUDHandlers();
  initSqlRunner();
  
  // Initial load
  loadSummary();
  loadActiveTab();
});

// 1. Navigation Controller (Tab Switching)
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = btn.getAttribute('data-tab');
      
      // Toggle Active Button
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle Active Tab Content
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.getElementById(targetTab).classList.add('active');
      
      state.activeTab = targetTab;
      loadActiveTab();
      // filters are now contextual inside the Sales Database tab; no global toggle needed
    });
  });

}

// Load current tab data
function loadActiveTab() {
  if (state.activeTab === 'tab-charts') {
    loadChartsData();
  } else if (state.activeTab === 'tab-pivot') {
    loadPivotData();
  } else if (state.activeTab === 'tab-database') {
    loadDatabaseTable();
  }

}

// 2. Summary Metrics API Loader
async function loadSummary() {
  try {
    const res = await fetch('/api/summary');
    const data = await res.json();
    
    const m = data.metrics;
    
    // Set metric card text
    document.getElementById('metric-total-sales').innerText = formatNumber(m.totalSales);
    document.getElementById('metric-total-revenue').innerText = formatCurrency(m.totalRevenue);
    
    // Profit card margin formatting
    const avgProfit = parseFloat(m.avgProfitLoss);
    const profitEl = document.getElementById('metric-avg-profit');
    const profitIcon = document.getElementById('margin-icon');
    profitEl.innerText = formatCurrency(avgProfit);
    
    if (avgProfit >= 0) {
      profitEl.className = 'kpi-val text-success';
      profitIcon.innerText = '📈';
    } else {
      profitEl.className = 'kpi-val text-danger';
      profitIcon.innerText = '📉';
    }
    
    // Populate Dropdown Filters (Make & Year)
    populateDropdown('filter-make', data.filters.makes, 'All Makes');
    populateDropdown('filter-year', data.filters.years, 'All Years');
    
    // Cohort metadata print
    document.getElementById('cohort-range').innerText = `Displaying comprehensive analysis across ${formatNumber(m.totalSales)} database records.`;
    
  } catch (err) {
    console.error('[-] Error fetching summary cards metrics:', err);
  }
}

function populateDropdown(selectId, items, defaultText) {
  const select = document.getElementById(selectId);
  const currentVal = select.value;
  select.innerHTML = `<option value="">${defaultText}</option>`;
  items.forEach(item => {
    if (item) {
      const opt = document.createElement('option');
      opt.value = item;
      opt.innerText = item;
      select.appendChild(opt);
    }
  });
  select.value = currentVal;
}

// 3. Filters & Inputs Controller
function initFilterControls() {
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear-btn');
  const makeSelect = document.getElementById('filter-make');
  const yearSelect = document.getElementById('filter-year');
  const transSelect = document.getElementById('filter-transmission');
  const resetBtn = document.getElementById('reset-filters-btn');

  // Debounced search typing handler
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.trim();
    searchClear.style.display = state.filters.search ? 'block' : 'none';
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.pagination.page = 1;
      loadActiveTab();
    }, 400);
  });

  // Clear search field
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.search = '';
    searchClear.style.display = 'none';
    state.pagination.page = 1;
    loadActiveTab();
  });

  // Dropdown listeners
  makeSelect.addEventListener('change', (e) => {
    state.filters.make = e.target.value;
    state.pagination.page = 1;
    loadActiveTab();
  });

  yearSelect.addEventListener('change', (e) => {
    state.filters.year = e.target.value;
    state.pagination.page = 1;
    loadActiveTab();
  });

  transSelect.addEventListener('change', (e) => {
    state.filters.transmission = e.target.value;
    state.pagination.page = 1;
    loadActiveTab();
  });

  // Reset Filters button
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    makeSelect.value = '';
    yearSelect.value = '';
    transSelect.value = '';
    
    state.filters = { search: '', make: '', year: '', transmission: '' };
    state.pagination.page = 1;
    
    loadActiveTab();
  });
}

// 4. Tab 1: Charts Controller
async function loadChartsData() {
  try {
    const resMakes = await fetch('/api/charts/makes');
    const makesData = await resMakes.json();
    renderMakesChart(makesData);

    const resTrends = await fetch('/api/charts/trends');
    const trendsData = await resTrends.json();
    renderTrendsChart(trendsData.monthly);
    renderWeeklyChart(trendsData.weekly);
    
    renderTransmissionChart();

  } catch (err) {
    console.error('[-] Error fetching charts data:', err);
  }
}

// Makes Volume Horizontal Bar Chart
function renderMakesChart(data) {
  const ctx = document.getElementById('makesVolumeChart').getContext('2d');
  
  if (state.charts.makes) state.charts.makes.destroy();

  const labels = data.map(item => item.make);
  const counts = data.map(item => item.count);

  state.charts.makes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sales Volume',
        data: counts,
        backgroundColor: 'rgba(59, 130, 246, 0.65)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// Monthly Area Line Chart (Revenue & Profits)
function renderTrendsChart(data) {
  const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
  
  if (state.charts.monthly) state.charts.monthly.destroy();

  const labels = data.map(item => `${item.month} ${item.year}`);
  const revenues = data.map(item => item.revenue);
  const profits = data.map(item => item.profit);

  state.charts.monthly = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Revenue ($)',
          data: revenues,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        },
        {
          label: 'Total Profit/Loss ($)',
          data: profits,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          labels: { color: '#f8fafc' } 
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { 
            color: '#94a3b8',
            callback: function(val) {
              return '$' + formatNumber(val);
            }
          }
        }
      }
    }
  });
}

// Weekly Sales Bar Chart
function renderWeeklyChart(data) {
  const ctx = document.getElementById('weeklyDistributionChart').getContext('2d');
  
  if (state.charts.weekly) state.charts.weekly.destroy();

  const labels = data.map(item => item.dayOfWeek);
  const counts = data.map(item => item.count);

  state.charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sales Volume',
        data: counts,
        backgroundColor: 'rgba(236, 72, 153, 0.65)',
        borderColor: '#ec4899',
        borderWidth: 1,
        borderRadius: 8,
        minBarLength: 8
      }]
    },
    plugins: [barValueLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        },
        y: {
          beginAtZero: true,
          beginAtZero: true,
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            stepSize: 2500,
            callback: function(val) {
              return formatNumber(val);
            }
          }
        }
      }
    }
  });
}

// Doughnut Chart for Transmission Comparisons
async function renderTransmissionChart() {
  const ctx = document.getElementById('transmissionCompareChart').getContext('2d');
  
  if (state.charts.transmission) state.charts.transmission.destroy();

  try {
    const resPivot = await fetch('/api/pivot?row=transmission&col=transmission');
    const pivotData = await resPivot.json();
    
    // Group transmissions
    const transCounts = {};
    pivotData.data.forEach(item => {
      const type = item.rowVal.toUpperCase();
      transCounts[type] = (transCounts[type] || 0) + item.count;
    });

    const labels = Object.keys(transCounts);
    const dataVals = Object.values(transCounts);

    state.charts.transmission = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: dataVals,
          backgroundColor: [
            'rgba(59, 130, 246, 0.7)',
            'rgba(168, 85, 247, 0.7)'
          ],
          borderColor: [
            '#3b82f6',
            '#a855f7'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'right',
            labels: { color: '#f8fafc' } 
          }
        }
      }
    });
  } catch (err) {
    console.error('[-] Error loading transmission doughnut details:', err);
  }
}

// 5. Tab 2: Pivot Table Matrix Controller
function initPivotControls() {
  const generateBtn = document.getElementById('generate-pivot-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      state.pivot.row = document.getElementById('pivot-row-select').value;
      state.pivot.col = document.getElementById('pivot-col-select').value;
      state.pivot.metric = document.getElementById('pivot-metric-select').value;
      
      // Update Title
      const rowTxt = document.getElementById('pivot-row-select').options[document.getElementById('pivot-row-select').selectedIndex].text;
      const colTxt = document.getElementById('pivot-col-select').options[document.getElementById('pivot-col-select').selectedIndex].text;
      document.getElementById('pivot-title-text').innerText = `${rowTxt} vs. ${colTxt} Performance Matrix`;
      
      loadPivotData();
    });
  }
}

async function loadPivotData() {
  const table = document.getElementById('pivot-render-table');
  table.innerHTML = `<thead><tr><th>Loading aggregated dataset matrix...</th></tr></thead>`;
  
  try {
    const query = new URLSearchParams({
      row: state.pivot.row,
      col: state.pivot.col
    }).toString();
    
    const res = await fetch(`/api/pivot?${query}`);
    const resJson = await res.json();
    
    const data = resJson.data;
    const metric = state.pivot.metric;
    
    const rowSet = new Set();
    const colSet = new Set();
    const matrix = {};
    
    data.forEach(item => {
      const r = item.rowVal ? item.rowVal.toString() : 'N/A';
      const c = item.colVal ? item.colVal.toString() : 'N/A';
      
      rowSet.add(r);
      colSet.add(c);
      
      if (!matrix[r]) matrix[r] = {};
      matrix[r][c] = item;
    });
    
    const uniqueRows = Array.from(rowSet).sort();
    const uniqueCols = Array.from(colSet).sort();
    
    if (uniqueRows.length === 0) {
      table.innerHTML = `<tbody><tr><td class="text-center">No pivot data found for selections.</td></tr></tbody>`;
      return;
    }
    
    let formatVal = formatNumber;
    if (metric === 'revenue' || metric === 'avgPrice' || metric === 'avgProfit') {
      formatVal = formatCurrency;
    }
    
    // Compile Table Headers
    let theadHtml = `
      <tr>
        <th>${resJson.rowField.toUpperCase()} \\ ${resJson.colField.toUpperCase()}</th>
    `;
    uniqueCols.forEach(col => {
      theadHtml += `<th>${col}</th>`;
    });
    theadHtml += `<th class="row-total-hdr">GRAND TOTAL</th></tr>`;
    
    // Compile Table Rows
    let tbodyHtml = '';
    const colTotals = {};
    uniqueCols.forEach(col => {
      colTotals[col] = { count: 0, revenue: 0, sumProfit: 0, sumPrice: 0 };
    });
    let grandTotalCount = 0;
    let grandTotalRevenue = 0;
    let grandTotalSumProfit = 0;
    let grandTotalSumPrice = 0;
    
    uniqueRows.forEach(rowVal => {
      tbodyHtml += `<tr><td><strong>${rowVal}</strong></td>`;
      
      let rowCount = 0;
      let rowRevenue = 0;
      let rowSumProfit = 0;
      let rowSumPrice = 0;
      
      uniqueCols.forEach(colVal => {
        const cell = matrix[rowVal][colVal];
        let displayStr = '-';
        
        if (cell) {
          let value = 0;
          if (metric === 'count') value = cell.count;
          else if (metric === 'revenue') value = parseFloat(cell.revenue);
          else if (metric === 'avgPrice') value = parseFloat(cell.avgPrice);
          else if (metric === 'avgProfit') value = parseFloat(cell.avgProfit);
          
          displayStr = formatVal(value);
          
          rowCount += cell.count;
          rowRevenue += parseFloat(cell.revenue);
          rowSumProfit += parseFloat(cell.avgProfit) * cell.count;
          rowSumPrice += parseFloat(cell.avgPrice) * cell.count;
          
          colTotals[colVal].count += cell.count;
          colTotals[colVal].revenue += parseFloat(cell.revenue);
          colTotals[colVal].sumProfit += parseFloat(cell.avgProfit) * cell.count;
          colTotals[colVal].sumPrice += parseFloat(cell.avgPrice) * cell.count;
        }
        
        if (metric === 'avgProfit' && cell) {
          const valNum = parseFloat(cell.avgProfit);
          const colorClass = valNum >= 0 ? 'text-success' : 'text-danger';
          tbodyHtml += `<td class="${colorClass}">${displayStr}</td>`;
        } else {
          tbodyHtml += `<td>${displayStr}</td>`;
        }
      });
      
      let rowTotalVal = 0;
      if (metric === 'count') rowTotalVal = rowCount;
      else if (metric === 'revenue') rowTotalVal = rowRevenue;
      else if (metric === 'avgPrice') rowTotalVal = rowCount > 0 ? (rowSumPrice / rowCount) : 0;
      else if (metric === 'avgProfit') rowTotalVal = rowCount > 0 ? (rowSumProfit / rowCount) : 0;
      
      let rowTotalClass = '';
      if (metric === 'avgProfit') {
        rowTotalClass = rowTotalVal >= 0 ? 'text-success' : 'text-danger';
      }
      
      tbodyHtml += `<td class="row-total-val ${rowTotalClass}">${formatVal(rowTotalVal)}</td></tr>`;
      
      grandTotalCount += rowCount;
      grandTotalRevenue += rowRevenue;
      grandTotalSumProfit += rowSumProfit;
      grandTotalSumPrice += rowSumPrice;
    });
    
    // Bottom column totals row
    tbodyHtml += `<tr class="col-total-row"><td><strong>GRAND TOTAL</strong></td>`;
    
    uniqueCols.forEach(colVal => {
      const colData = colTotals[colVal];
      let colTotalVal = 0;
      
      if (metric === 'count') colTotalVal = colData.count;
      else if (metric === 'revenue') colTotalVal = colData.revenue;
      else if (metric === 'avgPrice') colTotalVal = colData.count > 0 ? (colData.sumPrice / colData.count) : 0;
      else if (metric === 'avgProfit') colTotalVal = colData.count > 0 ? (colData.sumProfit / colData.count) : 0;
      
      let colClass = '';
      if (metric === 'avgProfit') {
        colClass = colTotalVal >= 0 ? 'text-success' : 'text-danger';
      }
      tbodyHtml += `<td class="${colClass}">${formatVal(colTotalVal)}</td>`;
    });
    
    // Grand Total Cell
    let grandVal = 0;
    if (metric === 'count') grandVal = grandTotalCount;
    else if (metric === 'revenue') grandVal = grandTotalRevenue;
    else if (metric === 'avgPrice') grandVal = grandTotalCount > 0 ? (grandTotalSumPrice / grandTotalCount) : 0;
    else if (metric === 'avgProfit') grandVal = grandTotalCount > 0 ? (grandTotalSumProfit / grandTotalCount) : 0;
    
    let grandClass = '';
    if (metric === 'avgProfit') {
      grandClass = grandVal >= 0 ? 'text-success' : 'text-danger';
    }
    
    tbodyHtml += `<td class="${grandClass}">${formatVal(grandVal)}</td></tr>`;
    
    table.innerHTML = theadHtml + '<tbody>' + tbodyHtml + '</tbody>';
    
  } catch (err) {
    console.error('[-] Error building pivot table matrix:', err);
    table.innerHTML = `<tbody><tr><td class="text-danger">Failed to connect to backend APIs to generate matrix.</td></tr></tbody>`;
  }
}

// 6. Tab 3: Sales Database Controller
async function loadDatabaseTable() {
  const tbody = document.getElementById('sales-table-body');
  tbody.innerHTML = `<tr><td colspan="15" class="text-center">Querying database table...</td></tr>`;

  try {
    const queryObj = {
      page: state.pagination.page,
      limit: state.pagination.limit,
      search: state.filters.search,
      make: state.filters.make,
      year: state.filters.year,
      transmission: state.filters.transmission
    };

    if (state.databaseSort && state.databaseSort.field) {
      queryObj.sortField = state.databaseSort.field;
      queryObj.sortOrder = state.databaseSort.order || 'asc';
    }

    const query = new URLSearchParams(queryObj).toString();

    const res = await fetch(`/api/sales?${query}`);
    const data = await res.json();

    const sales = data.sales;
    const pag = data.pagination;

    // Cache current page records for edits
    state.currentSales = sales;

    // Update pagination state
    state.pagination.totalPages = pag.totalPages;
    state.pagination.totalRecords = pag.totalRecords;

    // Render counts label
    document.getElementById('table-totals-label').innerText = 
      `Showing records ${formatNumber(Math.min((pag.currentPage - 1) * pag.limit + 1, pag.totalRecords))} ` +
      `to ${formatNumber(Math.min(pag.currentPage * pag.limit, pag.totalRecords))} of ${formatNumber(pag.totalRecords)}`;

    if (sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="15" class="text-center">No matching database sales records found.</td></tr>`;
      updatePaginationControls();
      return;
    }

    // Render rows (server already returned requested page & sort)
    renderSalesRows(sales);

  } catch (err) {
    console.error('[-] Error fetching database table details:', err);
    tbody.innerHTML = `<tr><td colspan="15" class="text-danger text-center">Failed to load sales records from database.</td></tr>`;
  }
}

function initDatabasePagination() {
  const prevBtn = document.getElementById('pag-prev');
  const nextBtn = document.getElementById('pag-next');
  const limitSelect = document.getElementById('table-limit-select');

  prevBtn.addEventListener('click', () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      loadDatabaseTable();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (state.pagination.page < state.pagination.totalPages) {
      state.pagination.page++;
      loadDatabaseTable();
    }
  });

  limitSelect.addEventListener('change', (e) => {
    state.pagination.limit = parseInt(e.target.value);
    state.pagination.page = 1;
    loadDatabaseTable();
  });
  // Initialize table sorting hooks for the sales table
  initTableSorting();
}

function updatePaginationControls() {
  const prevBtn = document.getElementById('pag-prev');
  const nextBtn = document.getElementById('pag-next');
  const details = document.getElementById('pag-details');

  prevBtn.disabled = state.pagination.page === 1;
  nextBtn.disabled = state.pagination.page >= state.pagination.totalPages;
  
  details.innerText = `Page ${state.pagination.page} of ${state.pagination.totalPages || 1}`;
}
// (filters were relocated to the Sales Database tab; no global toggle required)

// --- Table Sorting Helpers ---
function mapHeaderToField(label) {
  const map = {
    'ID': 'id',
    'Year': 'year',
    'Make': 'make',
    'Model': 'model',
    'Trim': 'trim',
    'Body': 'body',
    'Trans': 'transmission',
    'Odometer': 'odometer',
    'Condition': 'condition',
    'State': 'state',
    'MMR': 'mmr',
    'Selling Price': 'sellingprice',
    'Margin': 'profit_loss',
    'Sale Date': 'saledate'
  };
  return map[label] || null;
}

function compareValues(a, b, field) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  // Date fields
  if (field === 'saledate') {
    const da = new Date(a);
    const db = new Date(b);
    return da - db;
  }

  // Numeric fields
  if (['id','year','odometer','condition','mmr','sellingprice','profit_loss'].includes(field)) {
    return Number(a) - Number(b);
  }

  // Default string compare
  return String(a).localeCompare(String(b));
}

function sortAndRenderSales() {
  const sortField = state.databaseSort.field;
  const sortOrder = state.databaseSort.order === 'asc' ? 1 : -1;

  if (!sortField) {
    // No sort requested; just render current cache
    renderSalesRows(state.currentSales);
    return;
  }

  const sorted = [...state.currentSales].sort((x, y) => {
    const res = compareValues(x[sortField], y[sortField], sortField);
    return res * sortOrder;
  });

  renderSalesRows(sorted);
}

function renderSalesRows(sales) {
  const tbody = document.getElementById('sales-table-body');
  if (!tbody) return;

  if (!Array.isArray(sales) || sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" class="text-center">No matching database sales records found.</td></tr>`;
    updatePaginationControls();
    return;
  }

  let rowsHtml = '';
  sales.forEach((row, idx) => {
    const margin = parseInt(row.profit_loss);
    const badgeClass = margin >= 0 ? 'profit-badge positive' : 'profit-badge negative';
    const marginStr = margin >= 0 ? `+${formatCurrency(margin)}` : formatCurrency(margin);
    const dateRaw = new Date(row.saledate);
    const dateStr = isNaN(dateRaw) ? row.saledate : dateRaw.toISOString().split('T')[0];

    // Compute human-friendly row number based on pagination offset
    const rowNumber = ((state.pagination.page - 1) * state.pagination.limit) + idx + 1;

    rowsHtml += `
      <tr>
        <td>${rowNumber}</td>
        <td>${row.id}</td>
        <td>${row.year}</td>
        <td><strong>${row.make}</strong></td>
        <td>${row.model}</td>
        <td>${row.trim}</td>
        <td>${row.body}</td>
        <td>${row.transmission}</td>
        <td>${formatNumber(row.odometer)}</td>
        <td>${formatDecimal(row.condition, 1)}</td>
        <td>${row.state}</td>
        <td>${formatCurrency(row.mmr)}</td>
        <td><strong>${formatCurrency(row.sellingprice)}</strong></td>
        <td><span class="${badgeClass}">${marginStr}</span></td>
        <td>${dateStr} (${row.saleday})</td>
        <td>
          <div class="action-btns">
            <button class="edit-btn" onclick="openEditRecordModal(${row.id})">Edit</button>
            <button class="delete-btn" onclick="triggerDeleteRecord(${row.id})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
  updatePaginationControls();
}

function initTableSorting() {
  const table = document.getElementById('sales-data-table');
  if (!table) return;
  const headers = table.querySelectorAll('thead th');
  headers.forEach(th => {
    if (th.classList.contains('actions-header')) return;
    // Respect an existing data-label attribute (useful when displayed text differs from mapped field)
    const label = th.dataset.label || th.innerText.trim();
    if (!th.dataset.label) th.dataset.label = label;
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const field = mapHeaderToField(th.dataset.label);
      if (!field) return;
      if (state.databaseSort.field === field) {
        state.databaseSort.order = state.databaseSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.databaseSort.field = field;
        state.databaseSort.order = 'asc';
      }
      // Update header arrows
      headers.forEach(h => {
        if (h.dataset && h.dataset.label) h.innerText = h.dataset.label;
      });
      th.innerText = th.dataset.label + (state.databaseSort.order === 'asc' ? ' ▲' : ' ▼');

      // Use server-side sorting: request page from backend with sort params
      loadDatabaseTable();
    });
  });
}



// 8. CRUD Events & Form Submissions
function initCRUDHandlers() {
  const modal = document.getElementById('crud-modal');
  const addBtn = document.getElementById('add-record-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-modal-btn');
  const form = document.getElementById('crud-form');
  
  // Open Add Record Modal
  addBtn.addEventListener('click', () => {
    document.getElementById('modal-title').innerText = 'Add Vehicle Sale Record';
    document.getElementById('record-id').value = '';
    form.reset();
    
    // Set default date to today
    document.getElementById('form-saledate').value = new Date().toISOString().split('T')[0];
    modal.classList.add('active');
  });

  // Close modals
  const closeModal = () => modal.classList.remove('active');
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  // Submit Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('record-id').value;
    const isEdit = id !== '';
    
    const data = {
      year: parseInt(document.getElementById('form-year').value),
      make: document.getElementById('form-make').value,
      model: document.getElementById('form-model').value,
      trim: document.getElementById('form-trim').value,
      body: document.getElementById('form-body').value,
      transmission: document.getElementById('form-transmission').value,
      vin: document.getElementById('form-vin').value,
      state: document.getElementById('form-state').value,
      condition: parseFloat(document.getElementById('form-condition').value),
      odometer: parseInt(document.getElementById('form-odometer').value),
      color: document.getElementById('form-color').value,
      interior: document.getElementById('form-interior').value,
      seller: document.getElementById('form-seller').value,
      mmr: parseInt(document.getElementById('form-mmr').value),
      sellingprice: parseInt(document.getElementById('form-sellingprice').value),
      saledate: document.getElementById('form-saledate').value
    };

    try {
      let response;
      if (isEdit) {
        response = await fetch(`/api/sales/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      
      const resData = await response.json();
      
      if (resData.success) {
        closeModal();
        alert(resData.message);
        
        // Reload all data
        loadSummary();
        loadActiveTab();
      } else {
        alert('Error: ' + resData.error);
      }
    } catch (err) {
      console.error('[-] Error submitting form:', err);
      alert('Network Error connecting to server.');
    }
  });
}

// Edit Record Modal Trigger (bound dynamically to window scope so onclick works)
window.openEditRecordModal = function(id) {
  const record = state.currentSales.find(r => r.id === id);
  if (!record) return;

  document.getElementById('modal-title').innerText = 'Edit Vehicle Sale Record';
  document.getElementById('record-id').value = record.id;
  
  document.getElementById('form-year').value = record.year;
  document.getElementById('form-make').value = record.make;
  document.getElementById('form-model').value = record.model;
  document.getElementById('form-trim').value = record.trim || '';
  document.getElementById('form-body').value = record.body;
  document.getElementById('form-transmission').value = record.transmission;
  document.getElementById('form-vin').value = record.vin;
  document.getElementById('form-state').value = record.state;
  document.getElementById('form-condition').value = record.condition;
  document.getElementById('form-odometer').value = record.odometer;
  document.getElementById('form-color').value = record.color;
  document.getElementById('form-interior').value = record.interior;
  document.getElementById('form-seller').value = record.seller;
  document.getElementById('form-mmr').value = record.mmr;
  document.getElementById('form-sellingprice').value = record.sellingprice;
  
  // Format date correctly for date picker input (YYYY-MM-DD)
  const rawDate = new Date(record.saledate);
  const formattedDate = isNaN(rawDate.getTime()) ? record.saledate : rawDate.toISOString().split('T')[0];
  document.getElementById('form-saledate').value = formattedDate;
  
  document.getElementById('crud-modal').classList.add('active');
};

// Delete Record trigger
window.triggerDeleteRecord = async function(id) {
  const record = state.currentSales.find(r => r.id === id);
  const displayLabel = record ? `${record.year} ${record.make} ${record.model} (VIN: ${record.vin})` : `Record #${id}`;
  
  if (confirm(`Are you sure you want to permanently delete this vehicle sale record?\n\n${displayLabel}`)) {
    try {
      const response = await fetch(`/api/sales/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        
        // Reload all data
        loadSummary();
        loadActiveTab();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      console.error('[-] Error deleting record:', err);
      alert('Network Error connecting to server.');
    }
  }
};

// 9. Tab 4: SQL Query Runner Controller
function initSqlRunner() {
  const queryInput = document.getElementById('sql-query-input');
  const examplesSelect = document.getElementById('sql-examples-select');
  const clearBtn = document.getElementById('sql-clear-btn');
  const executeBtn = document.getElementById('sql-execute-btn');
  const resultContainer = document.getElementById('sql-result-container');
  const statusDetails = document.getElementById('sql-status-details');
  const metaDetails = document.getElementById('sql-meta-details');
  const executionTimeEl = document.getElementById('sql-execution-time');
  const rowCountEl = document.getElementById('sql-row-count');

  if (!executeBtn) return; // Guard clause in case HTML elements don't exist

  // Template select handler
  examplesSelect.addEventListener('change', (e) => {
    queryInput.value = e.target.value;
  });

  // Clear handler
  clearBtn.addEventListener('click', () => {
    queryInput.value = '';
    examplesSelect.value = '';
    statusDetails.innerText = 'No query executed yet.';
    metaDetails.style.display = 'none';
    resultContainer.innerHTML = `
      <div class="sql-placeholder-state">
        <div class="placeholder-icon">💻</div>
        <h4>Console Ready</h4>
        <p>Type your query in the console above and click <strong>Execute Query</strong> to view database output.</p>
      </div>
    `;
  });

  // Execute query handler
  executeBtn.addEventListener('click', async () => {
    const sqlQuery = queryInput.value.trim();
    if (!sqlQuery) {
      alert('Please enter a SQL query to execute.');
      return;
    }

    // Set loading state
    statusDetails.innerText = 'Running query...';
    metaDetails.style.display = 'none';
    resultContainer.innerHTML = `
      <div class="sql-loading-state">
        <div class="spinner"></div>
        <p>Executing statement on MySQL Server...</p>
      </div>
    `;
    executeBtn.disabled = true;

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sqlQuery })
      });
      const data = await res.json();
      executeBtn.disabled = false;

      if (!data.success) {
        // Handle database error
        statusDetails.innerText = 'Query completed with errors.';
        metaDetails.style.display = 'none';
        resultContainer.innerHTML = `
          <div class="sql-console-log error-log">
            <div class="log-header">
              <span class="icon">⚠️</span> MySQL Database Error
            </div>
            <div class="log-body">${data.error}</div>
          </div>
        `;
        return;
      }

      // Handle successful execution
      statusDetails.innerText = 'Query executed successfully.';
      metaDetails.style.display = 'flex';
      executionTimeEl.innerText = data.durationMs;

      if (data.type === 'select') {
        const rows = data.rows;
        const fields = data.fields;
        rowCountEl.innerText = `${rows.length} row(s)`;

        if (rows.length === 0) {
          resultContainer.innerHTML = `
            <div class="sql-placeholder-state">
              <div class="placeholder-icon">ℹ️</div>
              <h4>Empty Set</h4>
              <p>Query executed successfully, but returned 0 rows.</p>
            </div>
          `;
          return;
        }

        // Render data grid
        let tableHeaderHtml = fields.map(f => `<th>${f}</th>`).join('');
        let tableBodyHtml = rows.map(row => {
          let rowHtml = fields.map(field => {
            let val = row[field];
            if (val === null || val === undefined) return '<td><em>NULL</em></td>';
            
            // Render specific format styling
            if (typeof val === 'number') {
              const fieldLower = field.toLowerCase();
              if (fieldLower.includes('price') || fieldLower.includes('revenue') || fieldLower.includes('profit') || fieldLower.includes('mmr') || fieldLower.includes('price')) {
                return `<td>${formatCurrency(val)}</td>`;
              }
              return `<td>${formatNumber(val)}</td>`;
            }
            if (val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/))) {
              const d = new Date(val);
              return `<td>${isNaN(d.getTime()) ? val : d.toISOString().split('T')[0]}</td>`;
            }
            return `<td>${val}</td>`;
          }).join('');
          return `<tr>${rowHtml}</tr>`;
        }).join('');

        resultContainer.innerHTML = `
          <table class="data-grid">
            <thead><tr>${tableHeaderHtml}</tr></thead>
            <tbody>${tableBodyHtml}</tbody>
          </table>
        `;
      } else {
        // DML query (INSERT, UPDATE, DELETE, etc.)
        rowCountEl.innerText = '0 rows';
        let msg = `Affected rows: ${data.affectedRows}`;
        if (data.insertId) {
          msg += ` | Inserted ID: ${data.insertId}`;
        }
        if (data.info) {
          msg += ` | Info: ${data.info}`;
        }

        resultContainer.innerHTML = `
          <div class="sql-console-log">
            <div class="log-header">
              <span class="icon">✅</span> Statement Completed
            </div>
            <div class="log-body">
              ${msg}
            </div>
          </div>
        `;
        
        // Proactively reload dashboard metrics/summary
        loadSummary();
      }

    } catch (err) {
      executeBtn.disabled = false;
      console.error('[-] Fetch error executing query:', err);
      statusDetails.innerText = 'Network error.';
      metaDetails.style.display = 'none';
      resultContainer.innerHTML = `
        <div class="sql-console-log error-log">
          <div class="log-header">
            <span class="icon">❌</span> Connection Failed
          </div>
          <div class="log-body">Could not connect to the Express server API. Ensure the Node backend is running.</div>
        </div>
      `;
    }
  });
}

