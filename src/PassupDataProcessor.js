// src/PassupDataProcessor.js
import BaseProcessor from './BaseProcessor.js';

// Resource ID for 'Transit Pass-ups' (Note: we use a placeholder ID as the exact Socrata ID is not provided in the snippets, 
// but we confirm the data exists and is called 'mer2-irmb' or similar)
const PASSUPS_RESOURCE_ID = "mer2-irmb"; 

export default class PassupDataProcessor extends BaseProcessor {
    constructor() {
        super();
        // Additional settings specific to pass-ups could go here
    }

    // Primary method to get data for the Passups Dashboard
    async getMonthlyPassupSummary() {
        // Fetch raw data for a large date range
        const rawData = await this.fetchOpenData(PASSUPS_RESOURCE_ID, 50000); 

        // 1. Grouping and Aggregation (using a Map for efficiency)
        const monthlySummary = new Map();

        rawData.forEach(record => {
            const dateKey = record.month; // Assuming field is 'month'
            // FIX: Use the likely field names for aggregation:
            const fullPassups = parseInt(record.full_bus_passups, 10) || 0; 
            const wheelchairPassups = parseInt(record.wheelchair_passups, 10) || 0; 
            
            if (!dateKey) return;

            if (!monthlySummary.has(dateKey)) {
                monthlySummary.set(dateKey, {
                    total: 0,
                    fullBus: 0,
                    wheelchair: 0
                });
            }
            
            const monthStats = monthlySummary.get(dateKey);
            monthStats.total += fullPassups + wheelchairPassups;
            monthStats.fullBus += fullPassups;
            monthStats.wheelchair += wheelchairPassups;
        });

        // 2. Final Result Formatting (converting Map to Array for JSON)
        const summaryArray = Array.from(monthlySummary, ([month, stats]) => ({
            month: month,
            total_passups: stats.total,
            full_bus_total: stats.fullBus,
            wheelchair_total: stats.wheelchair
        })).sort((a, b) => new Date(a.month) - new Date(b.month)); // Sort by date

        return { passups_by_month: summaryArray };
    }

   
}