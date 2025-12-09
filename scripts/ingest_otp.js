// scripts/ingest_otp.js
import sqlite3 from 'sqlite3';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

// --- CONFIGURATION ---
const OTP_RESOURCE_ID = "gp3k-am4u"; 
const BASE_URL = "https://data.winnipeg.ca/resource/";
const BATCH_SIZE = 50000; 

// Initialize Database
const db = new sqlite3.Database(DB_PATH);

function setupDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS otp_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    route_number TEXT,
                    deviation INTEGER,
                    scheduled_time TEXT,
                    stop_number TEXT,
                    day_type TEXT
                )
            `);
            db.run(`CREATE INDEX IF NOT EXISTS idx_route ON otp_records(route_number)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_date ON otp_records(scheduled_time)`);
            console.log("✅ Database Schema Ready");
            resolve();
        });
    });
}

// --- THIS IS THE PART YOU CHANGE ---
function getLastRecordDate() {
    return new Promise((resolve, reject) => {
        db.get("SELECT MAX(scheduled_time) as last_date FROM otp_records", (err, row) => {
            if (err) reject(err);
            
            // 👇 CHANGE: Use the Primary Transit Network launch date (June 29, 2025)
            const NETWORK_LAUNCH_DATE = '2025-06-29T00:00:00.000';

            // If DB is empty, start from launch date. Otherwise, continue from where we left off.
            resolve(row && row.last_date ? row.last_date : NETWORK_LAUNCH_DATE);
        });
    });
}

async function startIngestion() {
    await setupDatabase();
    let lastDate = await getLastRecordDate();
    
    console.log(`🚀 Starting Ingestion from: ${lastDate}`);
    
    let isFinished = false;
    let totalInserted = 0;

    while (!isFinished) {
        try {
            console.log(`... Fetching batch after ${lastDate}...`);
            
            const response = await axios.get(`${BASE_URL}${OTP_RESOURCE_ID}.json`, {
                params: {
                    '$limit': BATCH_SIZE,
                    '$where': `scheduled_time > '${lastDate}'`, 
                    '$order': 'scheduled_time ASC'
                }
            });

            const records = response.data;

            if (records.length === 0) {
                isFinished = true;
                console.log("🏁 All data fetched! Database is up to date.");
                break;
            }

            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    
                    const stmt = db.prepare(`
                        INSERT INTO otp_records (route_number, deviation, scheduled_time, stop_number, day_type)
                        VALUES (?, ?, ?, ?, ?)
                    `);

                    records.forEach(r => {
                        const dev = parseInt(r.deviation, 10);
                        if (!isNaN(dev) && r.route_number && r.scheduled_time) {
                            stmt.run(r.route_number, dev, r.scheduled_time, r.stop_number, r.day_type);
                        }
                    });

                    stmt.finalize();
                    db.run("COMMIT", (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            lastDate = records[records.length - 1].scheduled_time;
            totalInserted += records.length;
            console.log(`   💾 Saved ${records.length} records. (Total: ${totalInserted.toLocaleString()})`);
            console.log(`   ➡️  Cursor advanced to: ${lastDate}`);

        } catch (error) {
            console.error("❌ Error during batch fetch:", error.message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

startIngestion();