import axios from 'axios';

// Estimated Daily Passenger Activity
const RESOURCE_ID = "bv6q-du26"; 
const BASE_URL = `https://data.winnipeg.ca/resource/${RESOURCE_ID}.json`;

async function inspect() {
    console.log("🔍 Inspecting Ridership Dataset columns...");
    try {
        // Fetch just 1 row to see the keys
        const response = await axios.get(`${BASE_URL}?$limit=1`);
        
        if (response.data.length > 0) {
            const row = response.data[0];
            console.log("\n✅ Columns Found:");
            console.log(Object.keys(row).join(", "));
            console.log("\n📋 Sample Record:");
            console.log(row);
        } else {
            console.log("⚠️ Dataset appears empty.");
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.response) {
            console.error("Server Response:", error.response.data);
        }
    }
}

inspect();