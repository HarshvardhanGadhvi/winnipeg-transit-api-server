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

    // 1. Existing Monthly Summary
    async getMonthlyPassupSummary() {
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
        return { passups_by_month: await this.query(sql) };
    }

    // 2. [NEW] Get Route Rankings (Top 10 Routes)
    async getPassupsByRoute() {
        const sql = `
            SELECT 
                route_number,
                route_destination,
                COUNT(*) as count
            FROM passup_records
            WHERE time >= '2025-06-29'
            GROUP BY route_number
            ORDER BY count DESC
            LIMIT 10
        `;
        return await this.query(sql);
    }

    // 3. [FIXED] Get Geospatial Data for Heatmap
    async getPassupHeatmap() {
        console.log("⚡ Fetching Heatmap Data...");
        // Extracted from GeoJSON: {"type":"Point","coordinates":[-97.15..., 49.82...]}
        // Note: SQLite json_extract index starts at 0. 
        // Index 0 = Longitude, Index 1 = Latitude
        const sql = `
            SELECT 
                json_extract(location, '$.coordinates[1]') as lat,
                json_extract(location, '$.coordinates[0]') as lng,
                pass_up_type
            FROM passup_records
            WHERE location IS NOT NULL
            AND time >= '2025-06-29'
            LIMIT 5000 
        `;
        return await this.query(sql);
    }
}