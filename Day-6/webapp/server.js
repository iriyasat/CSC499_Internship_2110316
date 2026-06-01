const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 6990;

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '33007'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vehicle_sales_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to handle async route errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Weekdays Helper for parsing saleday from YYYY-MM-DD
const getWeekdayName = (dateString) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? 'Monday' : days[date.getDay()];
};

// Helper for cleaning inputs to match cleaning script
const cleanRecordInput = (input) => {
  return {
    year: parseInt(input.year) || new Date().getFullYear(),
    make: (input.make || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
    model: (input.model || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
    trim: (input.trim || '').trim(),
    body: (input.body || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
    transmission: (input.transmission || 'automatic').trim().toLowerCase().includes('man') ? 'manual' : 'automatic',
    vin: (input.vin || '').trim().toUpperCase(),
    state: (input.state || '').trim().toUpperCase().substring(0, 10),
    condition: parseFloat(input.condition) || 0.0,
    odometer: parseInt(input.odometer) || 0,
    color: (input.color || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
    interior: (input.interior || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
    seller: (input.seller || '').trim(),
    mmr: parseInt(input.mmr) || 0,
    sellingprice: parseInt(input.sellingprice) || 0,
    saledate: input.saledate || new Date().toISOString().split('T')[0],
    saleday: getWeekdayName(input.saledate)
  };
};

// 1. GET /api/summary - Summary Metrics Cards
app.get('/api/summary', asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(`
      SELECT 
        COUNT(*) AS totalSales,
        SUM(sellingprice) AS totalRevenue,
        AVG(sellingprice - mmr) AS avgProfitLoss,
        AVG(odometer) AS avgOdometer,
        AVG(\`condition\`) AS avgCondition
      FROM car_sales
    `);
    
    // Get unique counts for dropdown filters
    const [makes] = await connection.query(`SELECT DISTINCT make FROM car_sales ORDER BY make`);
    const [years] = await connection.query(`SELECT DISTINCT year FROM car_sales ORDER BY year DESC`);
    
    res.json({
      metrics: rows[0],
      filters: {
        makes: makes.map(r => r.make),
        years: years.map(r => r.year)
      }
    });
  } finally {
    connection.release();
  }
}));



// 3. GET /api/sales - Paginated & Filterable Sales Table
app.get('/api/sales', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const make = req.query.make || '';
  const year = req.query.year || '';
  const transmission = req.query.transmission || '';

  const connection = await pool.getConnection();
  try {
    let whereClauses = [];
    let params = [];

    if (search) {
      whereClauses.push('(make LIKE ? OR model LIKE ? OR trim LIKE ? OR vin LIKE ? OR seller LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    if (make) {
      whereClauses.push('make = ?');
      params.push(make);
    }
    if (year) {
      whereClauses.push('year = ?');
      params.push(year);
    }
    if (transmission) {
      whereClauses.push('transmission = ?');
      params.push(transmission);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // Count total match rows
    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM car_sales ${whereSql}`,
      params
    );
    const totalRecords = countRows[0].total;

    // Fetch matching rows
    const selectSql = `
      SELECT 
        id, year, make, model, trim, body, transmission, vin, state, 
        \`condition\`, odometer, color, interior, seller, mmr, 
        sellingprice, saledate, saleday,
        (sellingprice - mmr) AS profit_loss
      FROM car_sales 
      ${whereSql}
      ORDER BY saledate DESC, id DESC
      LIMIT ? OFFSET ?
    `;
    
    const queryParams = [...params, limit, offset];
    const [sales] = await connection.query(selectSql, queryParams);

    res.json({
      sales,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit
      }
    });
  } finally {
    connection.release();
  }
}));

// CRUD 1: POST /api/sales - CREATE
app.post('/api/sales', asyncHandler(async (req, res) => {
  const cleaned = cleanRecordInput(req.body);
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO car_sales (
        year, make, model, trim, body, transmission, vin, state, 
        \`condition\`, odometer, color, interior, seller, mmr, 
        sellingprice, saledate, saleday
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleaned.year, cleaned.make, cleaned.model, cleaned.trim, cleaned.body, 
        cleaned.transmission, cleaned.vin, cleaned.state, cleaned.condition, 
        cleaned.odometer, cleaned.color, cleaned.interior, cleaned.seller, 
        cleaned.mmr, cleaned.sellingprice, cleaned.saledate, cleaned.saleday
      ]
    );
    res.status(201).json({ 
      success: true, 
      message: 'Vehicle record added successfully', 
      insertedId: result.insertId,
      record: { id: result.insertId, ...cleaned }
    });
  } finally {
    connection.release();
  }
}));

// CRUD 2: PUT /api/sales/:id - UPDATE
app.put('/api/sales/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID specified' });

  const cleaned = cleanRecordInput(req.body);
  const connection = await pool.getConnection();
  try {
    // Check if record exists
    const [exists] = await connection.query('SELECT id FROM car_sales WHERE id = ?', [id]);
    if (exists.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    await connection.query(
      `UPDATE car_sales SET 
        year = ?, make = ?, model = ?, trim = ?, body = ?, transmission = ?, 
        vin = ?, state = ?, \`condition\` = ?, odometer = ?, color = ?, 
        interior = ?, seller = ?, mmr = ?, sellingprice = ?, saledate = ?, 
        saleday = ?
      WHERE id = ?`,
      [
        cleaned.year, cleaned.make, cleaned.model, cleaned.trim, cleaned.body, 
        cleaned.transmission, cleaned.vin, cleaned.state, cleaned.condition, 
        cleaned.odometer, cleaned.color, cleaned.interior, cleaned.seller, 
        cleaned.mmr, cleaned.sellingprice, cleaned.saledate, cleaned.saleday,
        id
      ]
    );

    res.json({ 
      success: true, 
      message: 'Vehicle record updated successfully', 
      record: { id, ...cleaned }
    });
  } finally {
    connection.release();
  }
}));

// CRUD 3: DELETE /api/sales/:id - DELETE
app.delete('/api/sales/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID specified' });

  const connection = await pool.getConnection();
  try {
    // Check if record exists
    const [exists] = await connection.query('SELECT id FROM car_sales WHERE id = ?', [id]);
    if (exists.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    await connection.query('DELETE FROM car_sales WHERE id = ?', [id]);
    res.json({ success: true, message: 'Vehicle record deleted successfully', deletedId: id });
  } finally {
    connection.release();
  }
}));

// 4. GET /api/charts/makes - Top 10 Makes by Sales Volume
app.get('/api/charts/makes', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT make, COUNT(*) AS count, SUM(sellingprice) AS revenue, AVG(sellingprice - mmr) AS avgProfit
    FROM car_sales
    GROUP BY make
    ORDER BY count DESC
    LIMIT 10
  `);
  res.json(rows);
}));

// 5. GET /api/charts/trends - Weekly and Monthly Revenue/Profit Trends
app.get('/api/charts/trends', asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Weekly Trend (sorted chronologically)
    const [weekly] = await connection.query(`
      SELECT 
        saleday AS dayOfWeek, 
        COUNT(*) AS count,
        SUM(sellingprice) AS revenue,
        SUM(sellingprice - mmr) AS profit
      FROM car_sales
      GROUP BY saleday, WEEKDAY(saledate)
      ORDER BY WEEKDAY(saledate) ASC
    `);

    // Monthly Trend (sorted chronologically)
    const [monthly] = await connection.query(`
      SELECT 
        YEAR(saledate) AS year, 
        MONTHNAME(saledate) AS month, 
        COUNT(*) AS count,
        SUM(sellingprice) AS revenue,
        SUM(sellingprice - mmr) AS profit
      FROM car_sales
      GROUP BY YEAR(saledate), MONTHNAME(saledate), MONTH(saledate)
      ORDER BY YEAR(saledate) ASC, MONTH(saledate) ASC
    `);

    res.json({ weekly, monthly });
  } finally {
    connection.release();
  }
}));

// 6. GET /api/pivot - Aggregations for Dynamic Front-end Pivot Tables
app.get('/api/pivot', asyncHandler(async (req, res) => {
  const rowField = req.query.row || 'make';
  const colField = req.query.col || 'transmission';
  
  // Whitelist fields to prevent SQL injection
  const allowedFields = ['make', 'transmission', 'year', 'state', 'color', 'body', 'saleday'];
  if (!allowedFields.includes(rowField) || !allowedFields.includes(colField)) {
    return res.status(400).json({ error: 'Invalid pivot fields specified' });
  }

  // Dynamic Query grouping by Row & Column
  const [rows] = await pool.query(`
    SELECT 
      \`${rowField}\` AS rowVal,
      \`${colField}\` AS colVal,
      COUNT(*) AS count,
      SUM(sellingprice) AS revenue,
      AVG(sellingprice) AS avgPrice,
      AVG(sellingprice - mmr) AS avgProfit
    FROM car_sales
    GROUP BY \`${rowField}\`, \`${colField}\`
    ORDER BY rowVal ASC, colVal ASC
  `);
  
  res.json({
    rowField,
    colField,
    data: rows
  });
}));

// 7. POST /api/query - SQL Query Runner API
app.post('/api/query', asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'SQL query string is required' });
  }

  const connection = await pool.getConnection();
  try {
    const startTime = process.hrtime();
    const [result, fields] = await connection.query(query);
    const diff = process.hrtime(startTime);
    const durationMs = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);

    if (Array.isArray(result)) {
      res.json({
        success: true,
        type: 'select',
        rows: result,
        fields: fields ? fields.map(f => f.name) : [],
        durationMs,
        affectedRows: 0
      });
    } else {
      res.json({
        success: true,
        type: 'dml',
        rows: [],
        fields: [],
        durationMs,
        affectedRows: result.affectedRows || 0,
        insertId: result.insertId || 0,
        info: result.info || ''
      });
    }
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message || 'Unknown database error'
    });
  } finally {
    connection.release();
  }
}));


// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[-] WebApp Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[+] WebApp Server running on http://localhost:${PORT}`);
});
