// src/BaseProcessor.js (FINAL FIX)
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export default class BaseProcessor {
    constructor() {
        this.API_KEY = process.env.WT_API_KEY;
        this.Socrata_API_BASE = "https://data.winnipeg.ca/resource/"; // Base URL is defined here
        
        // ... (liveApiInstance setup)
    }

    // Common method to fetch data from the City of Winnipeg Open Data Portal (Socrata)
    async fetchOpenData(resourceId, limit = 500) { // Keep limit low for debugging
        // FIX: Ensure the URL is constructed cleanly
        const url = `${this.Socrata_API_BASE}${resourceId}.json`; 
        
        try {
            const response = await axios.get(url, { 
                params: { 
                    // Use a very specific, minimal filter to force a result
                    // This often resolves issues with general access
                    '$limit': limit,
                    // OPTIONAL: Try adding a filter for the past year to validate the date field
                    // '$where': "scheduled_departure_date > '2024-01-01T00:00:00.000'"
                } 
            });
            
            // CRITICAL: Check for a successful HTTP status before parsing
            if (response.status !== 200) {
                 console.error(`Socrata API returned status ${response.status} for ${resourceId}.`);
                 return [];
            }
            
            if (Array.isArray(response.data) && response.data.length > 0) {
                 console.log(`SUCCESS: Fetched ${response.data.length} records for ${resourceId}.`);
                 return response.data;
            } else {
                 console.error(`Socrata API returned 0 records for ${resourceId}. Check the resource ID and data availability.`);
                 return [];
            }
        } catch (error) {
            console.error(`Critical Error: Could not fetch Socrata data for ${resourceId}.`, error.message);
            return [];
        }
    }
}