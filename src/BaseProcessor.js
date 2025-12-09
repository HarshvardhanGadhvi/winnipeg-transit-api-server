import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export default class BaseProcessor {
    constructor() {
        // Encapsulate configuration details
        this.API_KEY = process.env.WT_API_KEY;
        this.WT_BASE_URL = "https://api.winnipegtransit.com/v3";
        
        // Check for security risk
        if (!this.API_KEY || this.API_KEY === "YOUR_API_KEY_HERE") {
            throw new Error("API Key not configured. Check your .env file.");
        }
        
        // Reusable Axios instance
        this.axiosInstance = axios.create({
            params: {
                'api-key': this.API_KEY,
            }
        });
    }

    // Common method to fetch data from the City of Winnipeg Open Data Portal
    async fetchOpenData(resourceId, limit = 55000) {
        const url = `https://data.winnipeg.ca/resource/${resourceId}.json`;
        try {
            const response = await axios.get(url, { params: { '$limit': limit } });
            return response.data;
        } catch (error) {
            console.error(`Error fetching open data for ${resourceId}:`, error.message);
            throw new Error(`Failed to fetch open data for resource ${resourceId}.`);
        }
    }
}