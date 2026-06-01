import express from 'express';
import cors from 'cors';
import multer from 'multer';
import xlsx from 'xlsx';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it does not exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Helper to check if a value is "gibberish"
function isGibberish(val) {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (str.length === 0) return false;
  
  // 1. Control / non-printable characters
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  if (controlCharRegex.test(str)) return true;
  
  // 2. High ratio of special symbols / weird characters in string of length > 5
  // We check for alphanumeric characters, standard spaces, and standard punctuation.
  const standardChars = str.match(/[a-zA-Z0-9\s.,!?;:'"()_\-@]/g) || [];
  const ratio = standardChars.length / str.length;
  if (ratio < 0.3 && str.length > 5) {
    return true; // Likely corrupt binary text or gibberish symbols
  }
  
  // 3. Excessively long repeated sequences (e.g. "aaaaaa", "111111")
  if (/(.)\1{6,}/.test(str)) {
    return true;
  }
  
  return false;
}

// Helper to auto-detect MySQL data type based on values
function detectType(rows, columnName) {
  let isInt = true;
  let isFloat = true;
  let maxLen = 0;
  let hasValue = false;

  for (const row of rows) {
    const val = row[columnName];
    if (val === null || val === undefined || val === '') continue;
    hasValue = true;
    
    const strVal = String(val);
    if (strVal.length > maxLen) {
      maxLen = strVal.length;
    }

    const num = Number(val);
    if (isNaN(num)) {
      isInt = false;
      isFloat = false;
    } else {
      if (!Number.isInteger(num)) {
        isInt = false;
      }
    }
  }

  if (!hasValue) return 'VARCHAR(255)';
  if (isInt) return 'INT';
  if (isFloat) return 'DOUBLE';
  if (maxLen > 255) return 'TEXT';
  return 'VARCHAR(255)';
}

/**
 * API: Upload and Process/Clean Data File
 * Form-data:
 *  - file: File (CSV, XLSX, XLS)
 *  - removeNulls: 'true'/'false'
 *  - nullColumns: JSON array (optional - specific columns to filter nulls on, or all if empty)
 *  - removeDuplicates: 'true'/'false'
 *  - removeGibberish: 'true'/'false'
 *  - trimData: 'true'/'false'
 *  - limitRows: number (optional)
 */
app.post('/api/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const file = req.file;
    const {
      removeNulls = 'false',
      nullColumns = '[]',
      removeDuplicates = 'false',
      removeGibberish = 'false',
      trimData = 'true',
      limitRows = ''
    } = req.body;

    const shouldRemoveNulls = removeNulls === 'true';
    const shouldRemoveDuplicates = removeDuplicates === 'true';
    const shouldRemoveGibberish = removeGibberish === 'true';
    const shouldTrimData = trimData === 'true';
    const parsedNullColumns = JSON.parse(nullColumns);

    // Read the file with XLSX (SheetJS covers CSV, XLS, XLSX)
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Parse into JSON objects
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: null });
    const originalCount = rawData.length;

    if (originalCount === 0) {
      fs.unlinkSync(file.path); // clean up
      return res.json({
        success: true,
        originalCount: 0,
        cleanedCount: 0,
        columns: [],
        data: []
      });
    }

    // Determine all possible columns present in the dataset
    const columnsSet = new Set();
    rawData.forEach(row => {
      Object.keys(row).forEach(key => columnsSet.add(key));
    });
    const columns = Array.from(columnsSet);

    // Slice raw data to limitRows if specified
    let dataToClean = rawData;
    const limit = parseInt(limitRows, 10);
    if (!isNaN(limit) && limit > 0) {
      dataToClean = rawData.slice(0, limit);
    }

    const targetNullColumns = parsedNullColumns.length > 0 ? parsedNullColumns : columns;
    const uniqueRows = new Set();
    const cleanedData = [];

    for (const row of dataToClean) {
      let keepRow = true;
      const processedRow = {};

      for (const col of columns) {
        let val = row[col];

        // 1. Trim strings
        if (shouldTrimData && typeof val === 'string') {
          val = val.trim();
        }

        // Check if value is null-like
        const isNullLike = val === null || val === undefined || (typeof val === 'string' && val === '');

        // 2. Null Checks
        if (shouldRemoveNulls && targetNullColumns.includes(col) && isNullLike) {
          keepRow = false;
          break;
        }

        // 3. Gibberish Checks
        if (shouldRemoveGibberish && !isNullLike && isGibberish(val)) {
          keepRow = false;
          break;
        }

        // Assign value to processed row (normalize empty string to null for DB safety)
        processedRow[col] = isNullLike ? null : val;
      }

      if (!keepRow) continue;

      // 4. Duplicate checks
      if (shouldRemoveDuplicates) {
        // Stringify row to create unique key
        const rowKey = JSON.stringify(processedRow);
        if (uniqueRows.has(rowKey)) {
          continue; // skip duplicate row
        }
        uniqueRows.add(rowKey);
      }

      cleanedData.push(processedRow);
    }

    // Delete temp upload file
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      originalCount,
      totalProcessed: dataToClean.length,
      cleanedCount: cleanedData.length,
      removedCount: dataToClean.length - cleanedData.length,
      columns,
      data: cleanedData
    });

  } catch (error) {
    console.error('Error processing file:', error);
    // Cleanup file if it still exists
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * API: Test Connection to XAMPP Database
 */
app.post('/api/mysql/test', async (req, res) => {
  const { host = 'localhost', port = 3306, user = 'root', password = '', database } = req.body;
  let connection;
  try {
    // Attempt connection without database first, in case the database doesn't exist yet.
    connection = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password
    });
    
    if (database) {
      // Check if DB exists or can be accessed
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    }

    res.json({ success: true, message: 'Database connection tested successfully! Database is ready.' });
  } catch (error) {
    console.error('Database connection test error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

/**
 * API: Export Cleaned Data to XAMPP MySQL
 */
app.post('/api/mysql/export', async (req, res) => {
  const {
    host = 'localhost',
    port = 3306,
    user = 'root',
    password = '',
    database,
    tableName,
    columns,
    data,
    importMode = 'overwrite' // 'overwrite' or 'append'
  } = req.body;

  if (!database || !tableName || !columns || !data || data.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing required parameters or data is empty.' });
  }

  let connection;
  try {
    // 1. Connect to MySQL server
    connection = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      multipleStatements: true
    });

    // 2. Create DB and use it
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await connection.query(`USE \`${database}\``);

    // 3. Handle schema creation
    if (importMode === 'overwrite') {
      await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }

    // Detect schemas and generate CREATE TABLE SQL
    const columnDefinitions = columns.map(col => {
      const dbType = detectType(data, col);
      // Escape column name
      return `\`${col}\` ${dbType}`;
    }).join(', ');

    const createTableSql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefinitions})`;
    await connection.query(createTableSql);

    // 4. Bulk Insert data in chunks
    // Convert array of objects to array of arrays in column order
    const valuesList = data.map(row => {
      return columns.map(col => {
        const val = row[col];
        // Convert JS Dates or objects to string/mysql friendly values if needed
        if (val instanceof Date) return val.toISOString().slice(0, 19).replace('T', ' ');
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val;
      });
    });

    const colNamesSql = columns.map(col => `\`${col}\``).join(', ');
    const insertSql = `INSERT INTO \`${tableName}\` (${colNamesSql}) VALUES ?`;
    
    // Chunk size: 1000 rows at a time
    const CHUNK_SIZE = 1000;
    let rowsInserted = 0;

    for (let i = 0; i < valuesList.length; i += CHUNK_SIZE) {
      const chunk = valuesList.slice(i, i + CHUNK_SIZE);
      await connection.query(insertSql, [chunk]);
      rowsInserted += chunk.length;
    }

    res.json({
      success: true,
      message: `Export completed successfully! Cleaned data uploaded to table \`${database}.${tableName}\`.`,
      rowsInserted
    });

  } catch (error) {
    console.error('MySQL export error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Serve frontend if in production (optional, but good practice)
// For local development, we run them separately/concurrently.
app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
