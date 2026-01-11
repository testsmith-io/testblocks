import * as fs from 'fs';
import * as path from 'path';
import { TestDataSet } from '../types';

/**
 * Parse CSV content into TestDataSet array
 */
export function parseCSV(content: string): TestDataSet[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return []; // Need header + at least one data row

  const headers = lines[0].split(',').map(h => h.trim());
  const dataSets: TestDataSet[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles basic quoted values)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const val = values[idx] ?? '';
      // Try to parse as number or boolean
      if (val === 'true') {
        row[header] = true;
      } else if (val === 'false') {
        row[header] = false;
      } else if (val !== '' && !isNaN(Number(val))) {
        row[header] = Number(val);
      } else {
        row[header] = val;
      }
    });

    dataSets.push({ name: `Row ${i}`, values: row });
  }

  return dataSets;
}

/**
 * Load data from a file (CSV or JSON)
 */
export function loadDataFromFile(filePath: string, baseDir?: string): TestDataSet[] {
  const resolvedPath = baseDir && !path.isAbsolute(filePath)
    ? path.join(baseDir, filePath)
    : filePath;

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Data file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext === '.csv') {
    return parseCSV(content);
  } else if (ext === '.json') {
    const jsonData = JSON.parse(content);
    if (Array.isArray(jsonData)) {
      return jsonData.map((item, idx) => ({
        name: item.name || `Item ${idx + 1}`,
        values: item.values || item,
      }));
    }
    throw new Error('JSON data file must contain an array');
  }

  throw new Error(`Unsupported data file format: ${ext}`);
}
