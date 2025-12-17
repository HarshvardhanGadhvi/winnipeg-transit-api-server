# 📡 Winnipeg Transit Pulse API (Backend)

The **Transit Pulse API** is a high-performance RESTful service that powers the Transit Pulse dashboard. It processes over **6 million records** of historical transit data to deliver real-time insights into On-Time Performance (OTP), ridership, and pass-ups.

Built with **Node.js** and **Express**, backed by a highly optimized **SQLite** database.

## ⚡ Features

* **🚀 High Performance:** optimized SQL queries to handle millions of rows with sub-second response times.
* **🛡️ Robust Error Handling:** Centralized error management for stability.
* **🌍 CORS Enabled:** Configured to allow secure connections from local network devices and frontend apps.
* **📦 Modular Processors:** Separate logic for OTP, Pass-ups, and Ridership data processing.

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** SQLite (read-only file based)
* **Utilities:** `cors`, `dotenv`, `sqlite3`

## 🚀 Getting Started

### Prerequisites
* Node.js (v16 or higher)
* A `transit_data.db` SQLite file (placed in the root directory).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/HarshvardhanGadhvi/winnipeg-transit-api-server.git
    cd winnipeg-transit-api-server
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory.
    
    ```env
    # .env
    PORT=5001
    ```

4.  **Database Setup:**
    Ensure your `transit_data.db` file is located in the root folder.
    * *Note: The Database is not uploaded on github, the ingestion files for the database can be found in the scripts folder and have to be run before running the api server*

5.  Start the server:
    ```bash
    node server.js
    ```
    You should see: `🚀 API running on http://0.0.0.0:5001`

## 📡 API Endpoints

### 🚍 On-Time Performance (OTP)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/otp-summary` | Returns system-wide scorecards and route lists. |
| `GET` | `/api/v1/otp/system-history` | Returns 30-day system trend data. |
| `GET` | `/api/v1/otp/route/:id` | Returns stats and history for a specific route. |
| `GET` | `/api/v1/otp/map` | Returns geospatial data for stops (accepts `?route=ID`). |

### 🛑 Pass-ups & Ridership
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/passups/summary` | Returns monthly pass-up statistics. |
| `GET` | `/api/v1/passups/map` | Returns heatmap data for pass-up locations. |
| `GET` | `/api/v1/ridership/summary` | Returns seasonal ridership trends. |

## 📦 Deployment (Optional)

This API is designed to be stateless (read-only DB).
* **Docker:** Compatible with standard Node.js containers.
* **Cloud:** Deploys easily to Render, Railway, or Fly.io.
    * *Tip:* For cloud deployment, ensure your SQLite DB is either included in the build or hosted externally (e.g., Turso).

## 📜 License
[MIT](https://choosealicense.com/licenses/mit/)