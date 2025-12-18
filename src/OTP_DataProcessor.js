import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../transit_data.db');

export default class OTP_DataProcessor {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
        this.LATE_THRESHOLD = 180;  // 3 mins
        this.EARLY_THRESHOLD = -60; // 1 min
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // [SIMPLIFIED] We no longer need the complex getLatestDate() helper
    async getCurrentAnchorDate() {
        // Use a simple, reliable way to get today's date in YYYY-MM-DD format
        return new Date().toISOString().split('T')[0];
    }

   // --- TRENDS (Fixed Type Matching & NaN Safety) ---
    async getTrends(routeId = null) {
        // Anchor to the current date
        const anchorDate = await this.getCurrentAnchorDate();
        
        // [FIX 1] Use CAST to ensure "22" (String) matches 22 (Integer)
        const routeFilter = routeId ? 'AND CAST(route_number AS TEXT) = CAST(? AS TEXT)' : '';
        
        const sql = `
            SELECT 
                'current' as period,
                COUNT(*) as total_trips,
                AVG(CAST(deviation AS REAL)) as avg_deviation,
                SUM(CASE WHEN deviation >= ${this.EARLY_THRESHOLD} AND deviation <= ${this.LATE_THRESHOLD} THEN 1 ELSE 0 END) as on_time_count
            FROM otp_records
            WHERE scheduled_time BETWEEN DATETIME(?, '-30 days') AND DATETIME(?)
            ${routeFilter}
            
            UNION ALL
            
            SELECT 
                'previous' as period,
                COUNT(*) as total_trips,
                AVG(CAST(deviation AS REAL)) as avg_deviation,
                SUM(CASE WHEN deviation >= ${this.EARLY_THRESHOLD} AND deviation <= ${this.LATE_THRESHOLD} THEN 1 ELSE 0 END) as on_time_count
            FROM otp_records
            WHERE scheduled_time BETWEEN DATETIME(?, '-60 days') AND DATETIME(?, '-30 days')
            ${routeFilter}
        `;

        // Create parameters array based on whether routeId exists
        const params = routeId 
            ? [anchorDate, anchorDate, routeId, anchorDate, anchorDate, routeId] 
            : [anchorDate, anchorDate, anchorDate, anchorDate];

        try {
            const rows = await this.query(sql, params);
            
            // Safety Defaults (Handle missing rows)
            const curr = rows.find(r => r.period === 'current') || { total_trips: 0, on_time_count: 0, avg_deviation: 0 };
            const prev = rows.find(r => r.period === 'previous') || { total_trips: 0, on_time_count: 0, avg_deviation: 0 };

            // [FIX 2] Math with Safety Checks
            const currOTP = curr.total_trips > 0 ? (curr.on_time_count / curr.total_trips) * 100 : 0;
            const prevOTP = prev.total_trips > 0 ? (prev.on_time_count / prev.total_trips) * 100 : 0;
            
            // Handle null deviation (if no trips existed)
            const currDev = (curr.avg_deviation !== null) ? (curr.avg_deviation / 60) : 0;
            const prevDev = (prev.avg_deviation !== null) ? (prev.avg_deviation / 60) : 0;

            return {
                // The || 0 ensures that if anything is NaN, it becomes 0
                otp_diff: parseFloat((currOTP - prevOTP).toFixed(1)) || 0,
                trip_diff: (curr.total_trips || 0) - (prev.total_trips || 0),
                deviation_diff: parseFloat((currDev - prevDev).toFixed(1)) || 0,
                current_avg_deviation: parseFloat(currDev.toFixed(1)) || 0
            };
        } catch (e) {
            console.error("Trend Error:", e);
            // Return safe zeros on error
            return { otp_diff: 0, trip_diff: 0, deviation_diff: 0, current_avg_deviation: 0 };
        }
    }
    // --- 1. DASHBOARD SUMMARY ---
    async getRouteSummary() {
        console.log("⚡ Fetching Route Summary...");
        
        const sql = `
            SELECT 
                O.route_number, R.route_name, R.color, R.text_color,
                COUNT(*) as total,
                SUM(CASE WHEN O.deviation >= ? AND O.deviation <= ? THEN 1 ELSE 0 END) as on_time,
                AVG(CAST(O.deviation AS REAL)) as avg_dev
            FROM otp_records O 
            LEFT JOIN transit_routes R ON CAST(O.route_number AS TEXT) = CAST(R.route_number AS TEXT)
            GROUP BY O.route_number
        `;

        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD]);
        const trends = await this.getTrends(null); // No longer needs anchorDate

        let totalTrips = 0;
        let totalOnTime = 0;
        let weightedDev = 0;

        const routeSummary = rows.map(r => {
            totalTrips += r.total;
            totalOnTime += r.on_time;
            weightedDev += (r.avg_dev * r.total);

            return {
                route_number: r.route_number,
                route_name: r.route_name,
                color: r.color || '#334155', text_color: r.text_color || '#fff',
                total_trips: r.total,
                otp_percentage: parseFloat(((r.on_time / r.total) * 100).toFixed(1)),
                avg_deviation: parseFloat(((r.avg_dev || 0) / 60).toFixed(1))
            };
        }).sort((a, b) => parseInt(a.route_number) - parseInt(b.route_number));

        const systemOTP = totalTrips > 0 ? (totalOnTime / totalTrips) * 100 : 0;
        const systemAvgDev = totalTrips > 0 ? (weightedDev / totalTrips) / 60 : 0;

        return { 
            metadata: {
                total_trips_analyzed: totalTrips,
                overall_otp_percentage: parseFloat(systemOTP.toFixed(1)),
                average_deviation: parseFloat(systemAvgDev.toFixed(1)), 
                processed_at: new Date().toISOString(),
                trends: { 
                    otp_change: trends.otp_diff, trip_change: trends.trip_diff, 
                    deviation_change: trends.deviation_diff, current_avg_deviation: trends.current_avg_deviation 
                }
            },
            routes: routeSummary
        };
    }

    // --- 2. SYSTEM HISTORY (Fixed Date Logic) ---
    async getSystemHistory(lookbackDays = 30) {
        const anchorDate = await this.getCurrentAnchorDate();

        // [CRITICAL FIX] Use DATETIME() for reliable range calculation 
        // to correctly find data older than 2025-10-25
        const sql = `
            SELECT 
                DATE(scheduled_time) as date, COUNT(*) as total,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records
            WHERE scheduled_time BETWEEN DATETIME(?, '-' || ? || ' days') AND DATETIME(?)
            GROUP BY date ORDER BY date ASC
        `;
        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD, anchorDate, lookbackDays, anchorDate]);
        
        console.log(`\n📈 System History Success: Found ${rows.length} days of data for ${lookbackDays} days.`);

        return rows.map(r => ({ date: r.date, otp: r.total > 0 ? parseFloat(((r.on_time/r.total)*100).toFixed(1)) : 0 }));
    }

    // --- 3. SINGLE ROUTE HISTORY (Fixed Date Logic) ---
    async getSingleRouteHistory(routeId, lookbackDays = 30) {
        const anchorDate = await this.getCurrentAnchorDate();
        
        // [FIX] Ensure lookbackDays is treated as a number
        const days = parseInt(lookbackDays.toString()) || 30;

        const sql = `
            SELECT 
                DATE(scheduled_time) as date, COUNT(*) as total,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records
            WHERE route_number = ? 
              AND scheduled_time BETWEEN DATETIME(?, '-' || ? || ' days') AND DATETIME(?)
            GROUP BY date ORDER BY date ASC
        `;
        // Use the coerced 'days' variable in the query parameters
        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD, routeId, anchorDate, days, anchorDate]);
        const routeStats = await this.getTrends(routeId);

        return {
            route_number: routeId,
            history: rows.map(r => ({ date: r.date, otp: r.total > 0 ? parseFloat(((r.on_time/r.total)*100).toFixed(1)) : 0 })),
            stats: routeStats
        };
    }
    
    // --- 4. MAP DATA ---
    async getStopMapData(routeId = null) {
        // ... (Keep this method as it was, it doesn't rely on the date range that was broken)
        let sql = `
            SELECT T.stop_number, T.stop_name, T.latitude, T.longitude, COUNT(O.id) as total_trips,
            SUM(CASE WHEN CAST(O.deviation AS REAL) > 120 THEN 1 ELSE 0 END) as late_count,
            SUM(CASE WHEN CAST(O.deviation AS REAL) < -60 THEN 1 ELSE 0 END) as early_count,
            AVG(CAST(O.deviation AS REAL)) as avg_dev
            FROM otp_records O JOIN transit_stops T ON O.stop_number = T.stop_number
            WHERE O.scheduled_time >= '2024-01-01' 
        `;
        const params = [];
        if (routeId) { sql += ` AND O.route_number = ?`; params.push(routeId); }
        sql += ` GROUP BY T.stop_number HAVING total_trips > 0`;

        try {
            const rows = await this.query(sql, params);
            return rows.map(r => {
                const total = r.total_trips; const lateRatio = r.late_count / total; const earlyRatio = r.early_count / total;
                let status = 'On-Time'; let severity = 0;
                if (lateRatio > 0.10) { status = 'Late'; severity = lateRatio; }
                else if (earlyRatio > 0.30) { status = 'Early'; severity = earlyRatio; }
                return {
                    id: r.stop_number, name: r.stop_name, lat: parseFloat(r.latitude), lng: parseFloat(r.longitude),
                    count: total, late_pct: Math.round(lateRatio * 100), early_pct: Math.round(earlyRatio * 100),
                    avg_deviation: parseFloat(((r.avg_dev || 0) / 60).toFixed(1)), status: status, severity: severity
                };
            });
        } catch (e) { return []; }
    }
}