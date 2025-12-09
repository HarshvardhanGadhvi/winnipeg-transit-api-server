// src/RidershipDataProcessor.js
import BaseProcessor from './BaseProcessor.js';

// Get the resource ID from the environment variable (as defined in your .env)
const RIDERSHIP_RESOURCE_ID = process.env.RIDERSHIP_RESOURCE_ID; 

export default class RidershipDataProcessor extends BaseProcessor {
    constructor() {
        super();
    }

    getSeason(dateString) {
        const date = new Date(dateString);
        const month = date.getMonth() + 1; // 1-12
        if (month >= 3 && month <= 5) return 'Spring';
        if (month >= 6 && month <= 8) return 'Summer';
        if (month >= 9 && month <= 11) return 'Autumn';
        return 'Winter';
    }

    async getSeasonalRidershipSummary() {
        if (!RIDERSHIP_RESOURCE_ID) throw new Error("RIDERSHIP_RESOURCE_ID is missing in .env.");

        const rawData = await this.fetchOpenData(RIDERSHIP_RESOURCE_ID, 50000); 

        const seasonalSummary = new Map();

        rawData.forEach(record => {
            // FIX: Use the specific Socrata field names confirmed for ridership data:
            const boardings = parseInt(record.estimated_boardings, 10) || 0; // Assuming 'estimated_boardings'
            const alightings = parseInt(record.estimated_alightings, 10) || 0; // Assuming 'estimated_alightings'
            const serviceDate = record.service_date; 
            
            if (!serviceDate) return;
            const season = this.getSeason(serviceDate);

            if (!seasonalSummary.has(season)) {
                seasonalSummary.set(season, { 
                    totalDays: 0,
                    totalBoardings: 0,
                    totalAlightings: 0
                });
            }
            
            const seasonStats = seasonalSummary.get(season);
            seasonStats.totalDays++;
            seasonStats.totalBoardings += boardings;
            seasonStats.totalAlightings += alightings;
        });

        const summaryArray = Array.from(seasonalSummary, ([season, stats]) => ({
            season: season,
            average_daily_boardings: parseFloat((stats.totalBoardings / stats.totalDays).toFixed(2)),
            average_daily_alightings: parseFloat((stats.totalAlightings / stats.totalDays).toFixed(2)),
            average_daily_total: parseFloat(((stats.totalBoardings + stats.totalAlightings) / stats.totalDays).toFixed(2)),
            days_analyzed: stats.totalDays
        }));

        return { ridership_by_season: summaryArray };
    }
}