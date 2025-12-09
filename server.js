// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// --- Import all Data Processors (OOP Classes) ---
import OTP_DataProcessor from './src/OTP_DataProcessor.js';
import PassupDataProcessor from './src/PassupDataProcessor.js';
import RidershipDataProcessor from './src/RidershipDataProcessor.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
// Listen on 5001 to avoid conflict with Flask running on 5000
const PORT = process.env.PORT || 5001; 

app.use(cors()); // Allows frontend (localhost:5173) to access this API
app.use(express.json());

// Instantiate all processors (OOP Principle: Encapsulation/SoC)
const otpProcessor = new OTP_DataProcessor(); 
const passupProcessor = new PassupDataProcessor(); 
const ridershipProcessor = new RidershipDataProcessor(); 

// --- API Endpoint 1: OTP Summary ---
app.get('/api/v1/otp-summary', async (req, res) => {
    try {
        const summary = await otpProcessor.getRouteSummary();
        return res.json(summary);
    } catch (error) {
        console.error("Error serving OTP data:", error.message);
        return res.status(500).json({ error: "Failed to retrieve processed OTP data." });
    }
});

// --- API Endpoint 2: Passups Summary ---
app.get('/api/v1/passups-summary', async (req, res) => {
    try {
        const summary = await passupProcessor.getMonthlyPassupSummary(); 
        return res.json(summary);
    } catch (error) {
        console.error("Error serving Passups data:", error.message);
        return res.status(500).json({ error: "Failed to retrieve processed Passups data." });
    }
});

// --- API Endpoint 3: Ridership Summary ---
app.get('/api/v1/ridership-summary', async (req, res) => {
    try {
        const summary = await ridershipProcessor.getSeasonalRidershipSummary(); 
        return res.json(summary);
    } catch (error) {
        console.error("Error serving Ridership data:", error.message);
        return res.status(500).json({ error: "Failed to retrieve processed Ridership data." });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Node/Express API running at http://localhost:${PORT}`);
    console.log(`Test OTP Endpoint: http://localhost:${PORT}/api/v1/otp-summary`);
    console.log(`Test Passups Endpoint: http://localhost:${PORT}/api/v1/passups-summary`);
    console.log(`Test Ridership Endpoint: http://localhost:${PORT}/api/v1/ridership-summary`);
});