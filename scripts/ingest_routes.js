// scripts/ingest_routes.js
import sqlite3 from 'sqlite3';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

const API_KEY = process.env.API_KEY; 
const BASE_URL = "https://api.winnipegtransit.com/v4/routes.json";

const db = new sqlite3.Database(DB_PATH);

async function setupDatabase() {
    return new Promise((resolve) => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS transit_routes (
                    route_number TEXT PRIMARY KEY,
                    route_name TEXT,
                    color TEXT,
                    text_color TEXT
                )
            `);
            console.log("✅ Routes Table Ready");
            resolve();
        });
    });
}

async function startIngestion() {
    await setupDatabase();

    if (API_KEY.includes("YOUR_WINNIPEG")) {
        console.error("🛑 STOP! Paste your API Key in the script.");
        return;
    }

    console.log("🚀 Fetching Official Route Colors...");

    try {
        const response = await axios.get(BASE_URL, {
            params: { 'api-key': API_KEY }
        });

        const routes = response.data.routes;
        console.log(`   Found ${routes.length} routes.`);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO transit_routes (route_number, route_name, color, text_color)
                VALUES (?, ?, ?, ?)
            `);

            routes.forEach(r => {
                // ✅ FIX: Access the nested 'badge-style' object
                const style = r['badge-style'] || {};
                
                // API returns "background-color": "#d9d9d9"
                let bgColor = style['background-color'] || '#334155';
                let txtColor = style['color'] || '#ffffff';

                // Ensure it has a hash (API usually includes it, but just in case)
                if (!bgColor.startsWith('#')) bgColor = `#${bgColor}`;
                if (!txtColor.startsWith('#')) txtColor = `#${txtColor}`;
                
                // Use badge-label if available (handles "BLUE" vs "11")
                const routeNum = String(r.key); 

                stmt.run(routeNum, r.name, bgColor, txtColor);
            });

            stmt.finalize();
            db.run("COMMIT");
        });

        console.log("🏁 Route Colors Sync Complete!");

    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.response) console.error("   API Response:", error.response.data);
    }
}

startIngestion();