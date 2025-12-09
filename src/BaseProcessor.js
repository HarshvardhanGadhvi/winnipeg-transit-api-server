// src/BaseProcessor.js
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Calculate the correct path to your DB file relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db'); // Adjust if your DB is elsewhere

export default class BaseProcessor {
    constructor() {
        // 2. Initialize the connection once
        this.db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error("❌ Database Connection Error:", err.message);
            } else {
                console.log("📂 Connected to SQLite database.");
            }
        });
    }

    // 3. A generic helper to turn SQLite callbacks into Promises (async/await)
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error("SQL Error:", err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}