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

    async getSeasonalRidershipSummary() {
        console.log("⚡ Querying Local Ridership...");
        
        // Much simpler query now: Group by the actual Season Name!
        const sql = `
            SELECT 
                season_name as season_label,
                service_date,
                SUM(average_boardings) as total_boardings,
                SUM(average_alightings) as total_alightings,
                COUNT(*) as records_count
            FROM ridership_records
            GROUP BY season_name
            ORDER BY service_date ASC
        `;

        const rows = await this.query(sql);

        const summary = rows.map(r => ({
            season: r.season_label, // e.g. "Winter 2024"
            // Divide total boardings by approx days in season or just show raw volume?
            // The dataset is "Average Daily Activity", so summing it gives "Systemwide Daily Average"
            average_daily_boardings: Math.round(r.total_boardings),
            average_daily_alightings: Math.round(r.total_alightings)
        }));

        return { ridership_by_season: summary };
    }
}