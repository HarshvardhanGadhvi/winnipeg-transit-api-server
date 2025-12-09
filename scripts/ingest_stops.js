import sqlite3 from 'sqlite3';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

// 🔑 YOU MUST GET AN API KEY FROM: https://api.winnipegtransit.com/
const API_KEY = "***REMOVED***"; 
const BASE_URL = "https://api.winnipegtransit.com/v4";

const db = new sqlite3.Database(DB_PATH);

async function setupDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("PRAGMA journal_mode = WAL;");
            
            // Create a table specifically for Stop Locations
            db.run(`
                CREATE TABLE IF NOT EXISTS transit_stops (
                    stop_number INTEGER PRIMARY KEY,
                    stop_name TEXT,
                    latitude REAL,
                    longitude REAL,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log("✅ Stops Table Ready");
            resolve();
        });
    });
}

// Helper to pause execution (to respect API rate limits)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchAllRoutes() {
    try {
        console.log("   🔄 Fetching active routes list...");
        const response = await axios.get(`${BASE_URL}/routes.json`, {
            params: { 'api-key': API_KEY }
        });
        // The API returns { routes: [ ... ] }
        return response.data.routes;
    } catch (error) {
        console.error("❌ Failed to fetch routes. Check your API KEY.");
        throw error;
    }
}

async function fetchStopsForRoute(routeKey) {
    try {
        const response = await axios.get(`${BASE_URL}/stops.json`, {
            params: { 
                'api-key': API_KEY,
                'route': routeKey,
                'usage': 'long' // "long" gives full street names (e.g., "Westbound Portage at Main")
            }
        });
        return response.data.stops;
    } catch (error) {
        console.warn(`   ⚠️ Could not fetch stops for route ${routeKey} (might be inactive)`);
        return [];
    }
}

async function startStopIngestion() {
    await setupDatabase();
    
    if (API_KEY === "YOUR_WINNIPEG_TRANSIT_API_KEY") {
        console.error("\n🛑 STOP! You need to paste your API Key in the script code.");
        return;
    }

    console.log("🚀 Starting Stop Location Sync...");

    try {
        const routes = await fetchAllRoutes();
        console.log(`   Found ${routes.length} routes. Scanning for stops...`);

        let totalStopsProcessed = 0;
        let newOrUpdatedCount = 0;

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO transit_stops (stop_number, stop_name, latitude, longitude)
            VALUES (?, ?, ?, ?)
        `);

        for (const route of routes) {
            // FIX: Ensure routeKey is passed as a string/number correctly to the fetch function
            const stops = await fetchStopsForRoute(route.key);
            
            if (stops) {
                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    stops.forEach(stop => {
                        // V4 API structure: stop.centre.geographic
                        if (stop.centre && stop.centre.geographic) {
                            const lat = stop.centre.geographic.latitude;
                            const lon = stop.centre.geographic.longitude;
                            stmt.run(stop.key, stop.name, lat, lon);
                            newOrUpdatedCount++;
                        }
                    });
                    db.run("COMMIT");
                });

                totalStopsProcessed += stops.length;
                
                // FIX: Convert key to String before padding
                const routeStr = String(route.key);
                process.stdout.write(`\r   🚌 Processed Route ${routeStr.padEnd(4)} | Total Operations: ${newOrUpdatedCount}   `);
                
                await sleep(200); 
            }
        }

        stmt.finalize();
        console.log(`\n\n🏁 Sync Complete! Database now contains up-to-date locations for active stops.`);

    } catch (error) {
        console.error("\n❌ Fatal Error:", error.message);
    }
}

startStopIngestion();