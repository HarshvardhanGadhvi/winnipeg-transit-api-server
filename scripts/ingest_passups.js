import sqlite3 from 'sqlite3';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

const RESOURCE_ID = "mer2-irmb"; // Transit Pass-ups
const BASE_URL = "https://data.winnipeg.ca/resource/";
const BATCH_SIZE = 5000;

const db = new sqlite3.Database(DB_PATH);

async function setupDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Enable WAL mode for better concurrency
            db.run("PRAGMA journal_mode = WAL;");
            
            db.run(`
                CREATE TABLE IF NOT EXISTS passup_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pass_up_id TEXT UNIQUE,
                    pass_up_type TEXT,
                    time TEXT,
                    route_number TEXT,
                    route_destination TEXT,
                    location TEXT
                )
            `);
            db.run(`CREATE INDEX IF NOT EXISTS idx_passup_time ON passup_records(time)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_passup_route ON passup_records(route_number)`);
            console.log("✅ Passups Table Ready");
            resolve();
        });
    });
}

async function getLastDate() {
    return new Promise((resolve) => {
        db.get("SELECT MAX(time) as last_date FROM passup_records", (err, row) => {
            // Start from Primary Network Launch
            resolve(row && row.last_date ? row.last_date : '2025-06-29T00:00:00.000');
        });
    });
}

async function startIngestion() {
    await setupDatabase();
    let lastDate = await getLastDate();
    console.log(`🚀 Fetching Pass-ups from: ${lastDate}`);

    let isFinished = false;
    let total = 0;

    while (!isFinished) {
        try {
            const response = await axios.get(`${BASE_URL}${RESOURCE_ID}.json`, {
                params: {
                    '$limit': BATCH_SIZE,
                    '$where': `time > '${lastDate}'`,
                    '$order': 'time ASC'
                }
            });

            const records = response.data;
            if (records.length === 0) {
                isFinished = true;
                console.log("\n🏁 Pass-ups ingestion complete!");
                break;
            }

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                const stmt = db.prepare(`
                    INSERT OR IGNORE INTO passup_records 
                    (pass_up_id, pass_up_type, time, route_number, route_destination, location)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                records.forEach(r => {
                    // Store location as JSON string if it exists
                    const loc = r.location ? JSON.stringify(r.location) : null;
                    stmt.run(r.pass_up_id, r.pass_up_type, r.time, r.route_number, r.route_destination, loc);
                });

                stmt.finalize();
                db.run("COMMIT");
            });

            lastDate = records[records.length - 1].time;
            total += records.length;
            process.stdout.write(`\r   💾 Saved ${total.toLocaleString()} pass-ups... Last Date: ${lastDate}   `);

        } catch (error) {
            console.error("\n❌ Error:", error.message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

startIngestion();