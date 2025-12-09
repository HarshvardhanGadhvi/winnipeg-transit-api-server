import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

const db = new sqlite3.Database(DB_PATH);

console.log("⚡ Optimizing Database Performance...");
console.log("   (This might take 1-2 minutes for 4.5M records. Do not interrupt.)");

db.serialize(() => {
    // 1. Memory Tuning
    db.run("PRAGMA journal_mode = WAL;"); // Better concurrency
    db.run("PRAGMA synchronous = NORMAL;"); // Faster writes
    db.run("PRAGMA cache_size = -200000;"); // Use ~200MB RAM for cache

    // 2. Create Indices (The Magic Speed Boost)
    console.log("... Indexing OTP Records (Route + Date)...");
    db.run("CREATE INDEX IF NOT EXISTS idx_otp_route_date ON otp_records(route_number, scheduled_time);");
    
    console.log("... Indexing OTP Records (Date Only)...");
    db.run("CREATE INDEX IF NOT EXISTS idx_otp_date ON otp_records(scheduled_time);");

    console.log("... Indexing Passups...");
    db.run("CREATE INDEX IF NOT EXISTS idx_passup_time ON passup_records(time);");

    // 3. Vacuum (Defrag)
    console.log("... Vacuuming database (Reclaiming space)...");
    db.run("VACUUM;", (err) => {
        if (err) console.error("❌ Error:", err.message);
        else console.log("✅ Optimization Complete! Your database is now racing tuned.");
    });
});