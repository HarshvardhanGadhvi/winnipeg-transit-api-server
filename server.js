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
    promise: null, // New: Stores the active calculation
    lastUpdated: 0
};
const CACHE_DURATION = 1000 * 60 * 60; // 1 Hour
const getOtpSummary = () => {
    const now = Date.now();

    // 1. If we have fresh data, return it immediately
    if (otpCache.data && (now - otpCache.lastUpdated < CACHE_DURATION)) {
        return Promise.resolve(otpCache.data);
    }

    // 2. If a calculation is ALREADY running, join it! (Don't start a new one)
    if (otpCache.promise) {
        console.log("✋ Joining existing calculation...");
        return otpCache.promise;
    }

    // 3. Otherwise, start the work
    console.log("🐢 Starting new calculation...");
    otpCache.promise = otpProcessor.getRouteSummary().then(data => {
        otpCache.data = data;
        otpCache.lastUpdated = Date.now();
        otpCache.promise = null; // Clear the promise when done
        console.log("✅ Calculation finished & Cached.");
        return data;
    });

    return otpCache.promise;
};
// --- ENDPOINT 1: Main Dashboard (OTP) ---
app.get('/api/v1/otp-summary', async (req, res) => {
    try {
        // Use the helper to ensure we never run twice
        const data = await getOtpSummary();
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
const singleRouteCache = {}; 
const ROUTE_CACHE_DURATION = 1000 * 60 * 60; // 1 Hour
// --- ENDPOINT 3: Single Route History ---
//Added caching for individual route data
app.get('/api/v1/otp/route/:id', async (req, res) => {
    try {
        const routeId = req.params.id;
        const days = req.query.days || 30;

        // 2. Create a unique "Key" for this specific request
        // We must combine RouteID AND Days (e.g., "11_30" or "BLUE_60")
        const cacheKey = `${routeId}_${days}`;
        const now = Date.now();

        // 3. Check if THIS specific key exists and is fresh
        if (singleRouteCache[cacheKey] && (now - singleRouteCache[cacheKey].timestamp < ROUTE_CACHE_DURATION)) {
            console.log(`⚡ HIT: Serving Route ${routeId} from Cache`);
            return res.json(singleRouteCache[cacheKey].data);
        }

        console.log(`🐢 MISS: Calculating data for Route ${routeId}...`);
        
        // 4. If missing, do the work
        const data = await otpProcessor.getSingleRouteHistory(routeId, days);

        // 5. Save it to the bookshelf
        singleRouteCache[cacheKey] = {
            data: data,
            timestamp: now
        };

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

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
    
    // BACKGROUND WARM-UP (Now uses the same smart function)
    console.log("🔥 Warming up cache in background...");
    getOtpSummary(); // This starts the promise that Endpoint 1 will wait for
});