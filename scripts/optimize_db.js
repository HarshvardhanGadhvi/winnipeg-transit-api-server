import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

const db = new sqlite3.Database(DB_PATH);

console.log("⚡ Optimizing Database for Speed...");

db.serialize(() => {
    // 1. Index for filtering by Date (Huge speedup for your WHERE clause)
    db.run(`CREATE INDEX IF NOT EXISTS idx_otp_date ON otp_records(scheduled_time)`);

    // 2. Index for filtering by Route (Huge speedup for Single Route view)
    db.run(`CREATE INDEX IF NOT EXISTS idx_otp_route ON otp_records(route_number)`);

    // 3. Index for the JOIN (Speedup for connecting Stops to Records)
    db.run(`CREATE INDEX IF NOT EXISTS idx_otp_stop ON otp_records(stop_number)`);
    
    // 4. Index for the Stop Lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_stops_id ON transit_stops(stop_number)`);

    console.log("✅ Indexes Created.");
    
    // 5. Run Analyze to let SQLite know about the new structure
    db.run("ANALYZE;", () => {
        console.log("🚀 Database Optimized! Restart your server.");
        db.close();
    });
});