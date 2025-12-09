import sqlite3 from 'sqlite3';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

const RESOURCE_ID = "bv6q-du26"; // Estimated Daily Passenger Activity
const BASE_URL = "https://data.winnipeg.ca/resource/";
const BATCH_SIZE = 5000;

const db = new sqlite3.Database(DB_PATH);

async function setupDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("PRAGMA journal_mode = WAL;");

            // We keep the schema 'service_date' generic to hold the start date
            db.run(`
                CREATE TABLE IF NOT EXISTS ridership_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    unique_key TEXT UNIQUE,
                    service_date TEXT, 
                    season_name TEXT,
                    day_type TEXT,
                    time_period TEXT,
                    route_number TEXT,
                    stop_number TEXT,
                    average_boardings REAL,
                    average_alightings REAL
                )
            `);
            db.run(`CREATE INDEX IF NOT EXISTS idx_ride_date ON ridership_records(service_date)`);
            console.log("✅ Ridership Table Ready");
            resolve();
        });
    });
}

async function getLastDate() {
    return new Promise((resolve) => {
        db.get("SELECT MAX(service_date) as last_date FROM ridership_records", (err, row) => {
            // Default to Jan 1, 2020 as requested
            resolve(row && row.last_date ? row.last_date : '2020-01-01T00:00:00.000');
        });
    });
}

async function startIngestion() {
    await setupDatabase();
    let startDate = await getLastDate();
    
    console.log(`🚀 Fetching Ridership from: ${startDate} using 'schedule_period_start_date'`);

    let isFinished = false;
    let offset = 0;
    let totalSaved = 0;

    while (!isFinished) {
        try {
            const response = await axios.get(`${BASE_URL}${RESOURCE_ID}.json`, {
                params: {
                    '$limit': BATCH_SIZE,
                    '$offset': offset,
                    // FIX: Use the REAL column name found by the debugger
                    '$where': `schedule_period_start_date >= '${startDate}'`, 
                    '$order': 'schedule_period_start_date ASC'
                }
            });

            const records = response.data;
            if (records.length === 0) {
                isFinished = true;
                console.log("\n🏁 Ridership ingestion complete!");
                break;
            }

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                const stmt = db.prepare(`
                    INSERT OR IGNORE INTO ridership_records 
                    (unique_key, service_date, season_name, day_type, time_period, route_number, stop_number, average_boardings, average_alightings)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                records.forEach(r => {
                    // Create a robust ID: Season + Route + Stop + Day + Time
                    const uniqueId = `${r.schedule_period_name}-${r.route_number}-${r.stop_number}-${r.day_type}-${r.time_period}`;
                    
                    stmt.run(
                        uniqueId,
                        r.schedule_period_start_date, // Map API column -> DB column
                        r.schedule_period_name,
                        r.day_type,
                        r.time_period,
                        r.route_number,
                        r.stop_number,
                        parseFloat(r.average_boardings || 0),
                        parseFloat(r.average_alightings || 0)
                    );
                });

                stmt.finalize();
                db.run("COMMIT");
            });

            offset += records.length;
            totalSaved += records.length;
            
            // Log progress
            const lastRecDate = records[records.length - 1].schedule_period_start_date;
            process.stdout.write(`\r   💾 Saved ${totalSaved.toLocaleString()} records... Reached: ${lastRecDate.split('T')[0]}   `);

        } catch (error) {
            console.error("\n❌ Error:", error.message);
            if (error.response) console.error("   Server Message:", error.response.data);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

startIngestion();