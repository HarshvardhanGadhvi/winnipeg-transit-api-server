import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

const db = new sqlite3.Database(DB_PATH);

console.log("⚡ Super-Charging Database for Speed...");

db.serialize(() => {
    // --- 1. CONFIGURATION OPTIMIZATIONS ---
    
    // Enable Write-Ahead Logging (WAL)
    // This allows reading and writing to happen simultaneously. 
    // It makes the database significantly faster for web apps.
    db.run("PRAGMA journal_mode = WAL;");

    // Reduce disk sync requirements
    // 'NORMAL' is safe for most apps and much faster than the default 'FULL'.
    db.run("PRAGMA synchronous = NORMAL;");

    // Increase Cache Size (uses more RAM to avoid disk reads)
    // -64000 = 64MB of cache (negative number means pages, positive means bytes)
    db.run("PRAGMA cache_size = -64000;");

    // Memory Mapped I/O
    // Allows SQLite to access the DB file directly in memory (very fast for reads)
    db.run("PRAGMA mmap_size = 30000000000;");


    // --- 2. COMPOUND INDEXES (The Real Speedup) ---

    // PROBLEM: Your dashboard filters by Route AND Date often.
    // SOLUTION: A "Compound Index" lets SQLite jump straight to "Route 11 in Dec 2025"
    // without cross-referencing two separate lists.
    db.run(`CREATE INDEX IF NOT EXISTS idx_otp_route_date 
            ON otp_records(route_number, scheduled_time)`);

    // --- 3. STANDARD INDEXES ---
    
    // Keep these for general lookups (like system-wide stats)
    db.run(`CREATE INDEX IF NOT EXISTS idx_otp_date ON otp_records(scheduled_time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_otp_stop ON otp_records(stop_number)`);
    
    // Optimize Stop Lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_stops_id ON transit_stops(stop_number)`);

    // --- 4. INDEXES FOR NEW FEATURES (Ridership & Passups) ---
    // You added these features, but they might be missing indexes!
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_passups_time ON passup_records(time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ridership_season ON ridership_records(season_name)`);

    console.log("✅ Advanced Indexes Created.");
    
    // --- 5. ANALYZE ---
    db.run("ANALYZE;", () => {
        console.log("🚀 Database Optimized! Restart your server.");
        db.close();
    });
});