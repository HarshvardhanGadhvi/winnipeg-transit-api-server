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

    // --- HELPER: Trend Calculation (Last 30 Days vs Prior 30 Days) ---
    async getTrends() {
        const sql = `
            SELECT 
                'current' as period,
                COUNT(*) as total,
                SUM(CASE WHEN pass_up_type LIKE '%Full%' THEN 1 ELSE 0 END) as full_bus,
                SUM(CASE WHEN pass_up_type LIKE '%Wheelchair%' THEN 1 ELSE 0 END) as wheelchair
            FROM passup_records
            WHERE time >= DATE('now', '-30 days')
            
            UNION ALL
            
            SELECT 
                'previous' as period,
                COUNT(*) as total,
                SUM(CASE WHEN pass_up_type LIKE '%Full%' THEN 1 ELSE 0 END) as full_bus,
                SUM(CASE WHEN pass_up_type LIKE '%Wheelchair%' THEN 1 ELSE 0 END) as wheelchair
            FROM passup_records
            WHERE time >= DATE('now', '-60 days') 
              AND time < DATE('now', '-30 days')
        `;

        const rows = await this.query(sql);
        
        const curr = rows.find(r => r.period === 'current') || { total: 0, full_bus: 0, wheelchair: 0 };
        const prev = rows.find(r => r.period === 'previous') || { total: 0, full_bus: 0, wheelchair: 0 };

        // Helper to calculate percentage change
        const calcChange = (c, p) => {
            if (p === 0) return c > 0 ? 100 : 0; // If prev was 0, change is 100% or 0%
            return ((c - p) / p) * 100;
        };

        return {
            total_change: calcChange(curr.total, prev.total),
            full_bus_change: calcChange(curr.full_bus, prev.full_bus),
            wheelchair_change: calcChange(curr.wheelchair, prev.wheelchair),
            // We also return the actual "Last 30 Days" counts if you want to show those instead of All-Time
            recent_counts: curr 
        };
    }

    // --- 1. Monthly Summary (Updated with Trends) ---
    async getMonthlyPassupSummary() {
        const sql = `
            SELECT 
                strftime('%Y-%m', time) as month,
                COUNT(*) as total_passups,
                SUM(CASE WHEN pass_up_type LIKE '%Full%' THEN 1 ELSE 0 END) as full_bus_total,
                SUM(CASE WHEN pass_up_type LIKE '%Wheelchair%' THEN 1 ELSE 0 END) as wheelchair_total
            FROM passup_records
            WHERE time >= '2024-01-01' -- Ensure we get enough history
            GROUP BY month
            ORDER BY month ASC
        `;

        const [monthlyData, trends] = await Promise.all([
            this.query(sql),
            this.getTrends()
        ]);

        return { 
            passups_by_month: monthlyData,
            trends: trends 
        };
    }

    // --- 2. Top Routes ---
    async getPassupsByRoute() {
        const sql = `
            SELECT 
                route_number,
                route_destination,
                COUNT(*) as count
            FROM passup_records
            WHERE time >= '2024-01-01'
            GROUP BY route_number
            ORDER BY count DESC
            LIMIT 10
        `;
        return await this.query(sql);
    }

    // --- 3. Heatmap Data ---
    async getPassupHeatmap() {
        const sql = `
            SELECT 
                json_extract(location, '$.coordinates[1]') as lat,
                json_extract(location, '$.coordinates[0]') as lng,
                pass_up_type
            FROM passup_records
            WHERE location IS NOT NULL
            AND time >= '2024-01-01'
            LIMIT 5000 
        `;
        return await this.query(sql);
    }
}