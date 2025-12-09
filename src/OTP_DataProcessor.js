// src/OTP_DataProcessor.js
import BaseProcessor from './BaseProcessor.js';

export default class OTP_DataProcessor extends BaseProcessor {
    constructor() {
        super(); // Initialize the DB connection from BaseProcessor
        this.LATE_THRESHOLD = 180;
        this.EARLY_THRESHOLD = -60;
    }

    // --- 1. DASHBOARD SUMMARY ---
    async getRouteSummary() {
        console.log("⚡ Fetching Route Summary...");
        
        const sql = `
            SELECT 
                route_number,
                COUNT(*) as total,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records
            WHERE scheduled_time >= '2025-07-29'
            GROUP BY route_number
        `;

        // Use the helper from BaseProcessor
        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD]);

        // Calculate Percentages
        const routeSummary = rows.map(r => ({
            route_number: r.route_number,
            total_trips: r.total,
            otp_percentage: parseFloat(((r.on_time / r.total) * 100).toFixed(1))
        })).sort((a, b) => parseInt(a.route_number) - parseInt(b.route_number));

        // Calculate Overall System Stats
        const total = routeSummary.reduce((sum, r) => sum + r.total_trips, 0);
        const onTimeWeighted = routeSummary.reduce((sum, r) => sum + (r.otp_percentage * r.total_trips / 100), 0);
        const overall = total > 0 ? (onTimeWeighted / total) * 100 : 0;

        return { 
            metadata: {
                total_trips_analyzed: total,
                overall_otp_percentage: parseFloat(overall.toFixed(1)),
                processed_at: new Date().toISOString()
            },
            routes: routeSummary
        };
    }

    // --- 2. SYSTEM HISTORY CHART ---
    async getSystemHistory() {
        console.log("🔍 Fetching System History...");
        const sql = `
            SELECT 
                strftime('%Y-%m-%d', scheduled_time) as date,
                COUNT(*) as total,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records
            WHERE scheduled_time >= '2025-07-29'
            GROUP BY date
            ORDER BY date ASC
        `;
        
        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD]);
        
        return rows.map(r => ({
            date: r.date,
            otp: parseFloat(((r.on_time / r.total) * 100).toFixed(1))
        }));
    }

    // --- 3. SINGLE ROUTE CHART ---
    async getSingleRouteHistory(routeId) {
        console.log(`🔍 Fetching History for Route ${routeId}...`);
        const sql = `
            SELECT 
                strftime('%Y-%m-%d', scheduled_time) as date,
                COUNT(*) as total,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records
            WHERE route_number = ? AND scheduled_time >= '2025-07-29'
            GROUP BY date
            ORDER BY date ASC
        `;
        
        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD, routeId]);
        
        return {
            route_number: routeId,
            trend: rows.map(r => ({
                date: r.date,
                otp: parseFloat(((r.on_time / r.total) * 100).toFixed(1))
            }))
        };
    }
    // --- 4. GEOSPATIAL MAP DATA ---
    async getStopMapData(routeId = null) {
        console.log(`🌍 Fetching Map Data (Route: ${routeId || 'All'})...`);

        let sql = `
            SELECT 
                T.stop_number,
                T.stop_name,
                T.latitude,
                T.longitude,
                AVG(O.deviation) as avg_deviation,
                COUNT(O.id) as trip_count
            FROM otp_records O
            JOIN transit_stops T ON O.stop_number = T.stop_number
            WHERE O.scheduled_time >= '2024-01-01' 
        `;

        const params = [];

        // 1. Dynamic Filtering: If a routeId is passed, add it to the query
        if (routeId) {
            sql += ` AND O.route_number = ?`;
            params.push(routeId);
        }

        // 2. Finish the query
        sql += `
            GROUP BY T.stop_number
            HAVING trip_count > 5
        `;

        try {
            const rows = await this.query(sql, params);
            
            return rows.map(r => ({
                id: r.stop_number,
                name: r.stop_name || `Stop #${r.stop_number}`,
                lat: parseFloat(r.latitude),
                lng: parseFloat(r.longitude),
                avg_delay_seconds: Math.round(r.avg_deviation),
                count: r.trip_count,
                // Status logic: Late > 2m (120s), Early < -1m (-60s)
                status: r.avg_deviation > 120 ? 'Late' 
                      : (r.avg_deviation < -60 ? 'Early' : 'On-Time')
            }));
        } catch (e) {
            console.error("❌ Map Data Error:", e.message);
            return []; 
        }
    }
}