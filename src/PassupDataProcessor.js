import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

export default class PassupDataProcessor {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getMonthlyPassupSummary() {
        console.log("⚡ Querying Local Passups...");
        // Aggregate pass-ups by month (using SQLite's strftime)
        const sql = `
            SELECT 
                strftime('%Y-%m', time) as month,
                COUNT(*) as total_passups,
                SUM(CASE WHEN pass_up_type LIKE '%Full%' THEN 1 ELSE 0 END) as full_bus_total,
                SUM(CASE WHEN pass_up_type LIKE '%Wheelchair%' THEN 1 ELSE 0 END) as wheelchair_total
            FROM passup_records
            WHERE time >= '2025-06-29'
            GROUP BY month
            ORDER BY month ASC
        `;

        const rows = await this.query(sql);
        
        // Convert '2025-07' to 'July 2025' or similar if needed, 
        // or just send standard ISO strings to frontend.
        return { passups_by_month: rows };
    }
}