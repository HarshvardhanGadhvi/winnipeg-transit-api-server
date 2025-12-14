// src/OTP_DataProcessor.js
import BaseProcessor from './BaseProcessor.js';

export default class OTP_DataProcessor extends BaseProcessor {
    constructor() {
        super();
        this.LATE_THRESHOLD = 180; // Seconds (3 mins)
        this.EARLY_THRESHOLD = -60; // Seconds (1 min)
    }

    // --- HELPER: CALCULATE TRENDS (Last 30 Days vs Previous 30) ---
    async getTrends(routeId = null) {
        const sql = `
            SELECT 
                'current' as period,
                COUNT(*) as total_trips,
                AVG(deviation) as avg_deviation,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time_count
            FROM otp_records
            WHERE scheduled_time >= DATE('now', '-30 days')
            ${routeId ? 'AND route_number = ?' : ''}
            
            UNION ALL
            
            SELECT 
                'previous' as period,
                COUNT(*) as total_trips,
                AVG(deviation) as avg_deviation,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time_count
            FROM otp_records
            WHERE scheduled_time >= DATE('now', '-60 days') 
              AND scheduled_time < DATE('now', '-30 days')
            ${routeId ? 'AND route_number = ?' : ''}
        `;

        // Param logic: If routeId exists, we need it twice (once for current, once for prev)
        const params = routeId 
            ? [this.EARLY_THRESHOLD, this.LATE_THRESHOLD, routeId, this.EARLY_THRESHOLD, this.LATE_THRESHOLD, routeId] 
            : [this.EARLY_THRESHOLD, this.LATE_THRESHOLD, this.EARLY_THRESHOLD, this.LATE_THRESHOLD];

        try {
            const rows = await this.query(sql, params);

            const curr = rows.find(r => r.period === 'current') || { total_trips: 0, on_time_count: 0, avg_deviation: 0 };
            const prev = rows.find(r => r.period === 'previous') || { total_trips: 0, on_time_count: 0, avg_deviation: 0 };

            const currOTP = curr.total_trips > 0 ? (curr.on_time_count / curr.total_trips) * 100 : 0;
            const prevOTP = prev.total_trips > 0 ? (prev.on_time_count / prev.total_trips) * 100 : 0;

            return {
                otp_diff: currOTP - prevOTP,
                trip_diff: curr.total_trips - prev.total_trips,
                deviation_diff: (curr.avg_deviation || 0) - (prev.avg_deviation || 0)
            };
        } catch (e) {
            console.error("⚠️ Trend Calculation Error:", e.message);
            return { otp_diff: 0, trip_diff: 0, deviation_diff: 0 };
        }
    }

    // --- 1. DASHBOARD SUMMARY ---
    async getRouteSummary() {
        console.log("⚡ Fetching Route Summary...");
        
        // Fix: Use CAST to ensure route numbers match between tables
        const sql = `
            SELECT 
                O.route_number,
                R.color,
                R.text_color,
                COUNT(*) as total,
                SUM(CASE WHEN O.deviation >= ? AND O.deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records O
            LEFT JOIN transit_routes R ON CAST(O.route_number AS TEXT) = CAST(R.route_number AS TEXT)
            WHERE O.scheduled_time >= '2025-07-29'
            GROUP BY O.route_number
        `;

        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD]);

        const routeSummary = rows.map(r => ({
            route_number: r.route_number,
            // Fallback colors if DB is empty
            color: (r.color && r.color.startsWith('#')) ? r.color : '#64748b', 
            text_color: r.text_color || '#ffffff',
            total_trips: r.total,
            otp_percentage: parseFloat(((r.on_time / r.total) * 100).toFixed(1))
        })).sort((a, b) => parseInt(a.route_number) - parseInt(b.route_number));

        // Calculate Overall System Stats
        const total = routeSummary.reduce((sum, r) => sum + r.total_trips, 0);
        const onTimeWeighted = routeSummary.reduce((sum, r) => sum + (r.otp_percentage * r.total_trips / 100), 0);
        const overall = total > 0 ? (onTimeWeighted / total) * 100 : 0;

        // Get Trends
        const trends = await this.getTrends(null);

        return { 
            metadata: {
                total_trips_analyzed: total,
                overall_otp_percentage: parseFloat(overall.toFixed(1)),
                processed_at: new Date().toISOString(),
                trends: {
                    otp_change: trends.otp_diff,
                    trip_change: trends.trip_diff,
                    deviation_change: trends.deviation_diff
                }
            },
            routes: routeSummary
        };
    }

    // --- 2. SYSTEM HISTORY CHART (Dynamic Range) ---
    async getSystemHistory(lookbackDays = 30) {
        console.log(`🔍 Fetching System History (Last ${lookbackDays} days)...`);
        
        const sql = `
            SELECT 
                strftime('%Y-%m-%d', scheduled_time) as date,
                COUNT(*) as total,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records
            WHERE scheduled_time >= DATE('now', '-' || ? || ' days')
            GROUP BY date
            ORDER BY date ASC
        `;
        
        // Pass parameters: Early, Late, Days
        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD, lookbackDays]);
        
        return rows.map(r => ({
            date: r.date,
            otp: parseFloat(((r.on_time / r.total) * 100).toFixed(1))
        }));
    }

    // --- 3. SINGLE ROUTE CHART & STATS (Dynamic Range) ---
    async getSingleRouteHistory(routeId, lookbackDays = 30) {
        console.log(`🔍 Fetching History for Route ${routeId} (Last ${lookbackDays} days)...`);
        
        const sql = `
            SELECT 
                strftime('%Y-%m-%d', scheduled_time) as date,
                COUNT(*) as total,
                SUM(CASE WHEN deviation >= ? AND deviation <= ? THEN 1 ELSE 0 END) as on_time
            FROM otp_records
            WHERE route_number = ? 
              AND scheduled_time >= DATE('now', '-' || ? || ' days')
            GROUP BY date
            ORDER BY date ASC
        `;
        
        const rows = await this.query(sql, [this.EARLY_THRESHOLD, this.LATE_THRESHOLD, routeId, lookbackDays]);
        
        // Re-calculate stats for this specific window if needed, 
        // or just keep using the default 30-day trend helper. 
        // For speed, we'll keep the standard trend helper distinct.
        const routeStats = await this.getTrends(routeId);

        return {
            route_number: routeId,
            history: rows.map(r => ({
                date: r.date,
                otp: parseFloat(((r.on_time / r.total) * 100).toFixed(1))
            })),
            stats: {
                otp_change: routeStats.otp_diff,
                trip_change: routeStats.trip_diff,
                deviation_change: routeStats.deviation_diff
            }
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
                COUNT(O.id) as total_trips,
                SUM(CASE WHEN CAST(O.deviation AS REAL) > 120 THEN 1 ELSE 0 END) as late_count,
                SUM(CASE WHEN CAST(O.deviation AS REAL) < -60 THEN 1 ELSE 0 END) as early_count
            FROM otp_records O
            JOIN transit_stops T ON O.stop_number = T.stop_number
            WHERE O.scheduled_time >= '2024-01-01' 
        `;

        const params = [];
        if (routeId) {
            sql += ` AND O.route_number = ?`;
            params.push(routeId);
        }

        sql += ` GROUP BY T.stop_number HAVING total_trips > 0`;

        try {
            const rows = await this.query(sql, params);
            return rows.map(r => {
                const total = r.total_trips;
                const lateRatio = r.late_count / total;
                const earlyRatio = r.early_count / total;
                let status = 'On-Time';
                let severity = 0;

                if (lateRatio > 0.05) { 
                    status = 'Late';
                    severity = lateRatio; 
                } else if (earlyRatio > 0.05) {
                    status = 'Early';
                    severity = earlyRatio;
                }

                return {
                    id: r.stop_number,
                    name: r.stop_name || `Stop #${r.stop_number}`,
                    lat: parseFloat(r.latitude),
                    lng: parseFloat(r.longitude),
                    count: total,
                    late_pct: Math.round(lateRatio * 100),
                    early_pct: Math.round(earlyRatio * 100),
                    status: status,
                    severity: severity 
                };
            });
        } catch (e) {
            console.error("❌ Map Data Error:", e.message);
            return []; 
        }
    }
}