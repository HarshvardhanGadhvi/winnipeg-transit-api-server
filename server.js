// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OTP_DataProcessor from './src/OTP_DataProcessor.js';
// ... import other processors

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001; 

app.use(cors());
app.use(express.json());

const otpProcessor = new OTP_DataProcessor(); 

// --- ENDPOINT 1: Main Dashboard (Summary) ---
app.get('/api/v1/otp-summary', async (req, res) => {
    try {
        const data = await otpProcessor.getRouteSummary();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT 2: System Trend Chart (NEW) ---
app.get('/api/v1/otp/system-history', async (req, res) => {
    try {
        const data = await otpProcessor.getSystemHistory();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT 3: Single Route Chart (NEW) ---
app.get('/api/v1/otp/route/:id', async (req, res) => {
    try {
        const data = await otpProcessor.getSingleRouteHistory(req.params.id);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/v1/otp/map', async (req, res) => {
    try {
        const data = await otpProcessor.getStopMapData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- ENDPOINT 4: Map Data (Supports filtering) ---
app.get('/api/v1/otp/map', async (req, res) => {
    try {
        // Read the 'route' parameter from the URL (e.g., /api/v1/otp/map?route=11)
        const routeId = req.query.route || null;
        
        const data = await otpProcessor.getStopMapData(routeId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));