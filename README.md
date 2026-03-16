# AI Smart Environmental Station

Monitor environment with sensors (ESP32), view real-time data on a local dashboard, and get AI-based predictions (rain chance, irrigation advice)—all running locally. No API keys or cloud needed.

---

## Quick Start

**1. Set up:**
- ESP32 (or similar) collects data: temp, humidity, soil, air quality.
- Dashboard (Next.js) shows data & AI panel.
- Local Python (Flask) gives rain/irrigation advice.

**2. Requirements:**
- ESP32 sending sensor data via WebSocket.
- Browser dashboard.
- Flask AI predictor.

---

## Key Features

- **Live soil/air readings:** moisture, pH, NPK, AQI, light, UV, and more.
- **AI advice panel:** rain% (next 6h), irrigation need, weather alerts.
- **All-in-one grid:** 16+ live values.
- **Charts:** last 60 temperature/humidity samples.
- **WebSocket:** for instant ESP32 → dashboard updates.
- **AI polling:** dashboard fetches `http://localhost:5000/predict` every 30s.

---

## How to Run

1. **AI Predictor:**
   ```bash
   cd ai-predictor
   pip install -r requirements.txt
   python3 app.py
   ```
   Or from root:  
   `npm run ai`

2. **Test in browser:**
   - [http://localhost:5000](http://localhost:5000) → AI prediction JSON
   - `/predict` & `/health` also available

3. **Dashboard config:**
   Set `NEXT_PUBLIC_AI_PREDICT_URL=http://localhost:5000/predict` in `.env.local`.

---

## Stack

| Layer      | Tech                   | Notes                               |
|------------|------------------------|-------------------------------------|
| Sensors    | ESP32 / Arduino        | Sends data via WebSocket            |
| Dashboard  | Next.js + Recharts     | UI, charts, AI info                 |
| AI         | Python Flask (port 5000) | Local rain/irrigation prediction    |
| Auth (opt) | Supabase               | Login/register if enabled           |

_No API keys needed for local use; Supabase keys only if using auth._

---
