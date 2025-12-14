import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OTP_DataProcessor from './src/OTP_DataProcessor.js';
import PassupDataProcessor from './src/PassupDataProcessor.js'; // [NEW] Import Passup Processor

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001; 

app.use(cors());
app.use(express.json());

// Initialize Processors
const otpProcessor = new OTP_DataProcessor(); 
const passupProcessor = new PassupDataProcessor(); // [NEW] Initialize Passup Processor

// --- ENDPOINT 1: Main Dashboard (OTP) ---
app.get('/api/v1/otp-summary', async (req, res) => {
    try {
        const data = await otpProcessor.getRouteSummary();
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

app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));