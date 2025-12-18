import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OTP_DataProcessor from './src/OTP_DataProcessor.js';
import PassupDataProcessor from './src/PassupDataProcessor.js'; // [NEW] Import Passup Processor
import RidershipDataProcessor from './src/RidershipDataProcessor.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001; 

app.use(cors());
app.use(express.json());

// Initialize Processors
const otpProcessor = new OTP_DataProcessor(); 
const passupProcessor = new PassupDataProcessor(); // [NEW] Initialize Passup Processor
const ridershipProcessor = new RidershipDataProcessor();
let otpCache = {
    data: null,
    lastUpdated: 0
};
const CACHE_DURATION = 1000 * 60 * 60; // Cache for 1 Hour
// --- ENDPOINT 1: Main Dashboard (OTP) ---
app.get('/api/v1/otp-summary', async (req, res) => {
    try {
        const now = Date.now();

        // Check if cache exists and is less than 1 hour old
        if (otpCache.data && (now - otpCache.lastUpdated < CACHE_DURATION)) {
            console.log("⚡ Serving OTP Summary from Cache");
            return res.json(otpCache.data);
        }

        console.log("🐢 Cache expired or empty. Calculating fresh data...");
        // If no cache, fetch from database (The slow part)
        const data = await otpProcessor.getRouteSummary();

        // Update the cache
        otpCache.data = data;
        otpCache.lastUpdated = now;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT 2: System Trend Chart ---
app.get('/api/v1/otp/system-history', async (req, res) => {
    try {
        // Default to 30 days if not provided
        const days = req.query.days || 30; 
        const data = await otpProcessor.getSystemHistory(days);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT 3: Single Route Chart ---
app.get('/api/v1/otp/route/:id', async (req, res) => {
    try {
        const days = req.query.days || 30;
        const data = await otpProcessor.getSingleRouteHistory(req.params.id, days);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT 4: Map Data (OTP) ---
app.get('/api/v1/otp/map', async (req, res) => {
    try {
        // 1. Get the route parameter from the URL (e.g. ?route=11)
        const routeId = req.query.route || null;

        // 2. Log it so we know it worked
        console.log(`📡 API Request: Get Map for Route "${routeId || 'ALL'}"`);

        // 3. Pass it to the processor
        const data = await otpProcessor.getStopMapData(routeId);
        
        res.json(data);
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- [NEW] ENDPOINT 5: Pass-up Summary ---
app.get('/api/v1/passups/summary', async (req, res) => {
    try {
        console.log("📡 API Request: Get Pass-up Summary");
        const data = await passupProcessor.getMonthlyPassupSummary();
        res.json(data);
    } catch (error) {
        console.error("API Error (Passups):", error.message);
        res.status(500).json({ error: error.message });
    }
});


// --- [NEW] ENDPOINT 6: Top Routes for Passups ---
app.get('/api/v1/passups/routes', async (req, res) => {
    try {
        const data = await passupProcessor.getPassupsByRoute();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- [NEW] ENDPOINT 7: Passup Heatmap Data ---
app.get('/api/v1/passups/map', async (req, res) => {
    try {
        const data = await passupProcessor.getPassupHeatmap();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- [NEW] RIDERSHIP ENDPOINTS ---

app.get('/api/v1/ridership/summary', async (req, res) => {
    try {
        const data = await ridershipProcessor.getSeasonalRidershipSummary();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/ridership/routes', async (req, res) => {
    try {
        const data = await ridershipProcessor.getRidershipByRoute();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/ridership/map', async (req, res) => {
    try {
        const data = await ridershipProcessor.getRidershipHeatmap();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT,'0.0.0.0', () => console.log(`🚀 API running on http://localhost:${PORT}`));