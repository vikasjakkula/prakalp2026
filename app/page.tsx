"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Droplets,
  Thermometer,
  Gauge,
  Wind,
  Sun,
  CloudRain,
  Leaf,
  Flame,
  Activity,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { getAiPredictUrl, getEsp32WsUrl, CHART_HISTORY_LENGTH } from "@/lib/config";
import type { SensorData, AIPrediction } from "@/lib/types";
import { getAQICategory } from "@/lib/types";

function formatVal(
  v: number | undefined,
  fallback: string,
  suffix = ""
): string {
  if (v === undefined || v === null || Number.isNaN(v)) return fallback;
  return `${Number(v).toFixed(1)}${suffix}`;
}

/** Mock sensor data so UI always has values (no blanks) */
function getMockSensorData(): SensorData {
  return {
    temperature: 27.4,
    humidity: 58,
    moisture: 62,
    aqi: 72,
    uv_index: 3.2,
    pressure: 1012,
    co2_ppm: 418,
    tvoc_ppb: 124,
    pump_status: "OFF",
    rain: 0,
    light_lux: 340,
    wind_speed: 2.1,
    soil_ph: 6.8,
    npk_n: 45,
    npk_p: 22,
    npk_k: 38,
    leaf_wetness: 12,
  };
}

/** Mock chart history so graph is never empty */
function getMockHistory(): SensorData[] {
  const base = getMockSensorData();
  return Array.from({ length: 50 }, (_, i) => {
    const t = 25 + Math.sin(i / 8) * 3 + (i % 5) * 0.2;
    const h = 52 + Math.cos(i / 6) * 8 + (i % 4);
    return {
      ...base,
      temperature: Math.round(t * 10) / 10,
      humidity: Math.round(h * 10) / 10,
      time: `${String(10 + Math.floor(i / 6) % 12).padStart(2, "0")}:${String((i * 2) % 60).padStart(2, "0")}`,
    };
  });
}

const MOCK_AI: AIPrediction = {
  rain_prediction: false,
  rain_probability_percent: 38,
  irrigation_needed: true,
  alert: "Clear",
};

export default function Dashboard() {
  const [data, setData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [aiConnected, setAiConnected] = useState(false);
  const [aiPrediction, setAIPrediction] = useState<AIPrediction | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const aiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mockData = useMemo(() => getMockSensorData(), []);
  const mockHistory = useMemo(() => getMockHistory(), []);

  const displayData = data ?? mockData;
  const displayHistory = history.length > 0 ? history : mockHistory;
  const displayAi = aiPrediction ?? MOCK_AI;

  const fetchAI = useCallback(async () => {
    const url = getAiPredictUrl();
    if (!url) {
      setAIPrediction(null);
      setAiConnected(false);
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AIPrediction = await res.json();
      setAIPrediction(json);
      setAiConnected(true);
    } catch (e) {
      setAIPrediction(null);
      setAiConnected(false);
    }
  }, []);

  useEffect(() => {
    const wsUrl = getEsp32WsUrl();
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed: SensorData = JSON.parse(event.data as string) as SensorData;
        parsed.time = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setData(parsed);
        setHistory((prev) => {
          const next = [...prev, parsed].slice(-CHART_HISTORY_LENGTH);
          return next;
        });
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    fetchAI();
    const id = setInterval(fetchAI, 30_000);
    aiIntervalRef.current = id;
    return () => {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    };
  }, [fetchAI]);

  const aqi = displayData.aqi ?? 0;
  const aqiCategory = getAQICategory(aqi);

  const soilCards = [
    {
      label: "Soil Moisture",
      value: formatVal(displayData.moisture, "62", "%"),
      icon: Droplets,
    },
    { label: "Pump", value: displayData.pump_status ?? "OFF", icon: Zap },
    {
      label: "Soil pH",
      value: formatVal(displayData.soil_ph, "6.8"),
      icon: Activity,
    },
    {
      label: "NPK (N/P/K)",
      value:
        displayData.npk_n != null && displayData.npk_p != null && displayData.npk_k != null
          ? `${displayData.npk_n} / ${displayData.npk_p} / ${displayData.npk_k} mg/kg`
          : "45 / 22 / 38 mg/kg",
      icon: Leaf,
    },
  ];

  const atmosphereCards = [
    {
      label: "Temperature",
      value: `${formatVal(displayData.temperature, "27.4")}°C`,
      icon: Thermometer,
    },
    {
      label: "Humidity",
      value: formatVal(displayData.humidity, "58", "%"),
      icon: Droplets,
    },
    {
      label: "Pressure",
      value: `${formatVal(displayData.pressure, "1012")} hPa`,
      icon: Gauge,
    },
    {
      label: "Wind",
      value: `${formatVal(displayData.wind_speed, "2.1")} m/s`,
      icon: Wind,
    },
  ];

  const airQualityCards = [
    {
      label: "AQI",
      value: `${displayData.aqi ?? 72} (${aqiCategory})`,
      icon: Flame,
    },
    {
      label: "CO₂",
      value: `${formatVal(displayData.co2_ppm, "418")} ppm`,
      icon: Activity,
    },
    {
      label: "TVOC",
      value: `${formatVal(displayData.tvoc_ppb, "124")} ppb`,
      icon: Flame,
    },
    {
      label: "Light",
      value: `${formatVal(displayData.light_lux, "340")} lux`,
      icon: Sun,
    },
  ];

  const aiCards = [
    {
      label: "Rain (next 6h)",
      value: `${displayAi.rain_probability_percent ?? 38}%`,
      icon: CloudRain,
    },
    {
      label: "Irrigate",
      value: displayAi.irrigation_needed ? "YES" : "NO",
      icon: Zap,
    },
    {
      label: "UV Index",
      value: formatVal(displayData.uv_index, "3.2"),
      icon: Sun,
    },
    {
      label: "Alert",
      value: displayAi.alert ?? "Clear",
      icon: AlertTriangle,
    },
  ];

  const panelSections = [
    { title: "Soil Panel", cards: soilCards },
    { title: "Atmosphere Panel", cards: atmosphereCards },
    { title: "Air Quality Panel", cards: airQualityCards },
    { title: "AI Prediction Panel", cards: aiCards },
  ];

  const allParams = [
    { label: "Soil Moisture", value: `${formatVal(displayData.moisture, "62")}%` },
    { label: "Temperature", value: `${formatVal(displayData.temperature, "27.4")}°C` },
    { label: "Humidity", value: `${formatVal(displayData.humidity, "58")}%` },
    { label: "AQI", value: String(displayData.aqi ?? 72) },
    { label: "CO₂ (ppm)", value: String(displayData.co2_ppm ?? 418) },
    { label: "TVOC (ppb)", value: formatVal(displayData.tvoc_ppb, "124") },
    { label: "Pressure (hPa)", value: formatVal(displayData.pressure, "1012") },
    { label: "UV Index", value: formatVal(displayData.uv_index, "3.2") },
    { label: "Light (lux)", value: formatVal(displayData.light_lux, "340") },
    { label: "Rain", value: displayData.rain ? "YES" : "NO" },
    { label: "Wind", value: `${formatVal(displayData.wind_speed, "2.1")} m/s` },
    { label: "Soil pH", value: formatVal(displayData.soil_ph, "6.8") },
    {
      label: "NPK",
      value: `N${displayData.npk_n ?? 45} P${displayData.npk_p ?? 22} K${displayData.npk_k ?? 38}`,
    },
    { label: "Leaf Wetness", value: formatVal(displayData.leaf_wetness, "12") },
    {
      label: "Rain (6h)",
      value: `${displayAi.rain_probability_percent ?? 38}%`,
    },
  ];

  return (
    <main className="dashboard-page">
      <div className="backend-badge">
        <span
          className={`backend-dot ${aiConnected ? "backend-dot--live" : "backend-dot--off"}`}
        />
        Backend {aiConnected ? "Live" : "Offline"}
      </div>

      <header className="dashboard-header">
        <h1 className="dashboard-title">AI Smart Environmental Station</h1>
      </header>

      <section className="panel-grid">
        {panelSections.map((section) => (
          <div key={section.title} className="panel-card">
            <h2 className="panel-title">{section.title}</h2>
            <div className="panel-cards">
              {section.cards.map((c) => (
                <div key={c.label} className="panel-item">
                  <div className="panel-item-label">
                    <c.icon className="panel-item-icon" />
                    {c.label}
                  </div>
                  <p className="panel-item-value">{c.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="params-section">
        <h2 className="params-heading">All Parameters</h2>
        <div className="params-grid">
          {allParams.map((item) => (
            <div key={item.label} className="params-item">
              <p className="params-item-label">{item.label}</p>
              <p className="params-item-value">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="chart-section">
        <h2 className="chart-heading">Live Temperature & Humidity</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayHistory}
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
              <XAxis
                dataKey="time"
                stroke="#555"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="temp"
                stroke="#c2410c"
                tick={{ fontSize: 11 }}
                domain={["auto", "auto"]}
              />
              <YAxis
                yAxisId="hum"
                orientation="right"
                stroke="#1d4ed8"
                tick={{ fontSize: 11 }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                }}
                labelStyle={{ color: "#111" }}
              />
              <Legend />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Temperature °C"
                stroke="#c2410c"
                dot={false}
                strokeWidth={2}
              />
              <Line
                yAxisId="hum"
                type="monotone"
                dataKey="humidity"
                name="Humidity %"
                stroke="#1d4ed8"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
