import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

export default class RidershipDataProcessor {
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

    // Helper: Get Top Route for a specific season
    async getTopRouteForSeason(seasonName) {
        if (!seasonName) return 'N/A';
        const sql = `
            SELECT route_number 
            FROM ridership_records 
            WHERE season_name = ?
            GROUP BY route_number 
            ORDER BY SUM(average_boardings) DESC 
            LIMIT 1
        `;
        const rows = await this.query(sql, [seasonName]);
        return rows.length > 0 ? `Rte ${rows[0].route_number}` : 'N/A';
    }

    // 1. Seasonal Summary + TRENDS
    async getSeasonalRidershipSummary() {
        console.log("⚡ Calculating Ridership Trends...");
        const sql = `
            SELECT 
                season_name as season_label,
                MIN(service_date) as sort_date,
                SUM(average_boardings) as total_boardings,
                COUNT(DISTINCT stop_number) as stops_active
            FROM ridership_records
            GROUP BY season_name
            ORDER BY sort_date ASC
        `;
        
        const rows = await this.query(sql);
        
        // Default Trends
        let trends = { 
            boardings_change: 0, 
            stops_change: 0,
            prev_top_route: 'N/A' 
        };
        
        // Need at least 2 seasons to compare
        if (rows.length >= 2) {
            const curr = rows[rows.length - 1]; // Last item (Current Season)
            const prev = rows[rows.length - 2]; // Second to last (Previous Season)
            
            console.log(`Comparing: ${curr.season_label} vs ${prev.season_label}`);

            // Calculate % Change
            const calc = (c, p) => p > 0 ? ((c - p) / p) * 100 : 0;
            trends.boardings_change = calc(curr.total_boardings, prev.total_boardings);
            trends.stops_change = calc(curr.stops_active, prev.stops_active);

            // Fetch Previous Top Route
            trends.prev_top_route = await this.getTopRouteForSeason(prev.season_label);
        }

        return { 
            ridership_by_season: rows.map(r => ({
                season: r.season_label,
                total_boardings: Math.round(r.total_boardings)
            })),
            trends: trends 
        };
    }

    // 2. Route Rankings (New Network Only)
    async getRidershipByRoute() {
        const sql = `
            SELECT route_number, SUM(average_boardings) as total_boardings
            FROM ridership_records
            WHERE service_date >= '2025-06-29' 
            GROUP BY route_number
            ORDER BY total_boardings DESC
        `;
        return await this.query(sql);
    }

    // 3. Heatmap (New Network Only)
    async getRidershipHeatmap() {
        const sql = `
            SELECT 
                T.stop_number, T.stop_name, T.latitude as lat, T.longitude as lng,
                SUM(R.average_boardings) as boardings
            FROM ridership_records R
            JOIN transit_stops T ON R.stop_number = T.stop_number
            WHERE R.service_date >= '2025-06-29' 
            GROUP BY R.stop_number
            HAVING boardings > 10 
            ORDER BY boardings DESC
            LIMIT 1000
        `;
        return await this.query(sql);
    }
}