// src/OTP_DataProcessor.js
import BaseProcessor from './BaseProcessor.js';

// Resource ID for 'Recent Transit On-Time Performance Data' (from previous step)
const OTP_RESOURCE_ID = "gp3k-am4u"; 

export default class OTP_DataProcessor extends BaseProcessor {
    constructor() {
        super();
        this.LATE_THRESHOLD = 180;  // > 3 minutes late
        this.EARLY_THRESHOLD = -60; // < 1 minute early
    }

    // The primary method the API calls
    async getRouteSummary() {
        // Fetch raw data for analysis. The API URL is handled by the BaseProcessor.
        const rawData = await this.fetchOpenData(OTP_RESOURCE_ID, 20000); // Using a smaller limit for fast testing
        
        const routeDataMap = new Map();
        let totalTrips = 0;

        rawData.forEach(record => {
            const route = record.route;
            // FIX: Use the confirmed Socrata field name 'deviation'
            const deviation = parseInt(record.deviation, 10); 
            
            if (isNaN(deviation)) return; // This will now skip far fewer records
            totalTrips++;

            // Apply Winnipeg Transit's OTP logic
            let status = 'Early';
            if (deviation > this.LATE_THRESHOLD) {
                status = 'Late';
            } else if (deviation >= this.EARLY_THRESHOLD && deviation <= this.LATE_THRESHOLD) {
                status = 'On-Time';
            }
            
            // Aggregation logic...
            if (!routeDataMap.has(route)) {
                routeDataMap.set(route, { total: 0, onTime: 0, late: 0, early: 0 });
            }

            const routeStats = routeDataMap.get(route);
            routeStats.total++;
            if (status === 'On-Time') routeStats.onTime++;
            if (status === 'Late') routeStats.late++;
            if (status === 'Early') routeStats.early++;
        });

        // Final result formatting
        const routeSummary = Array.from(routeDataMap, ([route, stats]) => ({
            route_number: route,
            total_trips: stats.total,
            on_time_trips: stats.onTime,
            late_trips: stats.late,
            early_trips: stats.early,
            otp_percentage: parseFloat(((stats.onTime / stats.total) * 100).toFixed(2))
        }));

        const overallOTP = totalTrips > 0 ? (routeSummary.reduce((sum, r) => sum + r.on_time_trips, 0) / totalTrips) * 100 : 0;

        return { 
            metadata: {
                overall_otp_percentage: parseFloat(overallOTP.toFixed(2)),
                processed_at: new Date().toISOString()
            },
            routes: routeSummary 
        };
    }
}