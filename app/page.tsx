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
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import {
  Droplets,
  Thermometer,
  Gauge,
  Wind,
  Sun,
  Moon,
  CloudRain,
  Leaf,
  Flame,
  Activity,
  Zap,
  AlertTriangle,
  Maximize2,
  Minimize2,
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

/** Gauge color by level: green (good), yellow (moderate), red (critical) */
function getGaugeColor(level: "good" | "moderate" | "critical"): string {
  switch (level) {
    case "good":
      return "#22c55e";
    case "moderate":
      return "#eab308";
    case "critical":
      return "#ef4444";
  }
}

/** Soil moisture 0–100%: good 40–80%, moderate 20–40 or 80–95%, critical else */
function getMoistureLevel(value: number): "good" | "moderate" | "critical" {
  if (value >= 40 && value <= 80) return "good";
  if ((value >= 20 && value < 40) || (value > 80 && value <= 95)) return "moderate";
  return "critical";
}

/** Humidity 0–100%: good 40–70%, moderate 30–40 or 70–85%, critical else */
function getHumidityLevel(value: number): "good" | "moderate" | "critical" {
  if (value >= 40 && value <= 70) return "good";
  if ((value >= 30 && value < 40) || (value > 70 && value <= 85)) return "moderate";
  return "critical";
}

/** AQI 0–500: good 0–50, moderate 51–150, critical 151+ */
function getAQILevel(value: number): "good" | "moderate" | "critical" {
  if (value <= 50) return "good";
  if (value <= 150) return "moderate";
  return "critical";
}

type SemicircleGaugeProps = {
  label: string;
  value: number;
  max: number;
  displaySuffix: string;
  level: "good" | "moderate" | "critical";
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

function SemicircleGauge({
  label,
  value,
  max,
  displaySuffix,
  level,
  icon: Icon,
}: SemicircleGaugeProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = getGaugeColor(level);
  const trackColor = "var(--border)";

  const gaugeData = [
    { name: "track", value: 100, fill: trackColor },
    { name: "fill", value: percent, fill: barColor },
  ];

  const displayValue = max === 500 ? Math.round(value) : value.toFixed(1);

  return (
    <div className="panel-item panel-item--gauge" data-no-sparkline>
      <div className="panel-item-label">
        <Icon className="panel-item-icon" />
        {label}
      </div>
      <div className="gauge-wrap">
        <ResponsiveContainer width="100%" height={100}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="95%"
            barSize={12}
            data={gaugeData}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <PolarRadiusAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            >
              {gaugeData.map((entry, index) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </RadialBar>
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="gauge-value" style={{ color: "var(--foreground)" }}>
          {displayValue}
          {displaySuffix}
        </div>
      </div>
    </div>
  );
}

/** Sparkline for last 10 readings, 80x30, no axes. Client-only to avoid Recharts hydration mismatch (clipPathId). */
const SPARKLINE_WIDTH = 80;
const SPARKLINE_HEIGHT = 30;

function SparklineMini({ data, stroke = "var(--muted)" }: { data: number[]; stroke?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const chartData = data.length ? data.map((v, i) => ({ i, v })) : [{ i: 0, v: 0 }];
  return (
    <div className="sparkline-wrap" style={{ width: SPARKLINE_WIDTH, height: SPARKLINE_HEIGHT }}>
      {mounted ? (
        <LineChart width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} dot={false} isAnimationActive />
        </LineChart>
      ) : null}
    </div>
  );
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

const THEME_STORAGE_KEY = "dashboard-theme";
const MAX_TOASTS = 3;
const TOAST_AUTO_DISMISS_MS = 5000;
const SPARKLINE_LENGTH = 10;

type ToastSeverity = "Warning" | "Critical";
type ToastItem = {
  id: number;
  sensor: string;
  value: string;
  severity: ToastSeverity;
  createdAt: number;
};

export default function Dashboard() {
  const [data, setData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [aiConnected, setAiConnected] = useState(false);
  const [aiPrediction, setAIPrediction] = useState<AIPrediction | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"soil" | "atmosphere" | "air" | "ai">("soil");
  const wsRef = useRef<WebSocket | null>(null);
  const aiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedAtRef = useRef<number>(Date.now());
  const toastIdRef = useRef(0);

  // Restore theme from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  // Apply theme to document and persist
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  const exportCsv = () => {
    setCsvDownloading(true);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const rows: [string, string, string, string][] = [
      ["Parameter", "Value", "Unit", "Timestamp"],
      ["Soil Moisture", String(displayData.moisture ?? ""), "%", new Date().toISOString()],
      ["Temperature", String(displayData.temperature ?? ""), "°C", new Date().toISOString()],
      ["Humidity", String(displayData.humidity ?? ""), "%", new Date().toISOString()],
      ["AQI", String(displayData.aqi ?? ""), "", new Date().toISOString()],
      ["CO₂", String(displayData.co2_ppm ?? ""), "ppm", new Date().toISOString()],
      ["TVOC", String(displayData.tvoc_ppb ?? ""), "ppb", new Date().toISOString()],
      ["Pressure", String(displayData.pressure ?? ""), "hPa", new Date().toISOString()],
      ["UV Index", String(displayData.uv_index ?? ""), "", new Date().toISOString()],
      ["Light", String(displayData.light_lux ?? ""), "lux", new Date().toISOString()],
      ["Wind", String(displayData.wind_speed ?? ""), "m/s", new Date().toISOString()],
      ["Soil pH", String(displayData.soil_ph ?? ""), "", new Date().toISOString()],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enviro-data-${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setCsvDownloading(false), 1000);
  };

  const mockData = useMemo(() => getMockSensorData(), []);
  const mockHistory = useMemo(() => getMockHistory(), []);

  const displayData = data ?? mockData;
  const displayHistory = history.length > 0 ? history : mockHistory;
  const displayAi = aiPrediction ?? MOCK_AI;

  const rainPercent = displayAi.rain_probability_percent ?? 38;
  const rainSentence =
    rainPercent >= 60
      ? "Rain likely — consider delaying irrigation"
      : rainPercent >= 30
        ? "Possible rain in next 6 hours"
        : "Low chance of rain in next 6 hours";

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

  // Last updated: increment every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdatedAtRef.current) / 1000);
      setSecondsSinceUpdate(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Toast auto-dismiss after 5s
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = toasts[toasts.length - 1];
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id));
    }, TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const addToast = useCallback(
    (sensor: string, value: string, severity: ToastSeverity) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => {
        const next = [...prev, { id, sensor, value, severity, createdAt: Date.now() }].slice(-MAX_TOASTS);
        return next;
      });
    },
    []
  );

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
        lastUpdatedAtRef.current = Date.now();
        setData(parsed);
        setHistory((prev) => {
          const next = [...prev, parsed].slice(-CHART_HISTORY_LENGTH);
          return next;
        });
        // Toast thresholds: Moisture < 20%, AQI > 150, Temp > 38°C, CO2 > 1000
        const m = parsed.moisture ?? 0;
        const a = parsed.aqi ?? 0;
        const t = parsed.temperature ?? 0;
        const c = parsed.co2_ppm ?? 0;
        if (m < 20) addToast("Soil Moisture", `${m}%`, m < 10 ? "Critical" : "Warning");
        if (a > 150) addToast("AQI", String(a), a > 200 ? "Critical" : "Warning");
        if (t > 38) addToast("Temperature", `${t}°C`, t > 42 ? "Critical" : "Warning");
        if (c > 1000) addToast("CO₂", `${c} ppm`, c > 2000 ? "Critical" : "Warning");
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [addToast]);

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

  const sparklineLast10 = useMemo(
    () => displayHistory.slice(-SPARKLINE_LENGTH),
    [displayHistory]
  );
  const getSparkData = (key: keyof SensorData) =>
    sparklineLast10.map((h) => (h[key] as number) ?? 0);

  const soilCards = [
    { label: "Soil Moisture", value: formatVal(displayData.moisture, "62", "%"), icon: Droplets, sparkKey: "moisture" as const },
    { label: "Pump", value: displayData.pump_status ?? "OFF", icon: Zap },
    { label: "Soil pH", value: formatVal(displayData.soil_ph, "6.8"), icon: Activity, sparkKey: "soil_ph" as const },
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
    { label: "Temperature", value: `${formatVal(displayData.temperature, "27.4")}°C`, icon: Thermometer, sparkKey: "temperature" as const },
    { label: "Humidity", value: formatVal(displayData.humidity, "58", "%"), icon: Droplets, sparkKey: "humidity" as const },
    { label: "Pressure", value: `${formatVal(displayData.pressure, "1012")} hPa`, icon: Gauge, sparkKey: "pressure" as const },
    { label: "Wind", value: `${formatVal(displayData.wind_speed, "2.1")} m/s`, icon: Wind, sparkKey: "wind_speed" as const },
  ];

  const airQualityCards = [
    { label: "AQI", value: `${displayData.aqi ?? 72} (${aqiCategory})`, icon: Flame, sparkKey: "aqi" as const },
    { label: "CO₂", value: `${formatVal(displayData.co2_ppm, "418")} ppm`, icon: Activity, sparkKey: "co2_ppm" as const },
    { label: "TVOC", value: `${formatVal(displayData.tvoc_ppb, "124")} ppb`, icon: Flame, sparkKey: "tvoc_ppb" as const },
    { label: "Light", value: `${formatVal(displayData.light_lux, "340")} lux`, icon: Sun, sparkKey: "light_lux" as const },
  ];

  const aiCards = [
    { label: "Rain (next 6h)", value: `${displayAi.rain_probability_percent ?? 38}%`, icon: CloudRain },
    { label: "Irrigate", value: displayAi.irrigation_needed ? "YES" : "NO", icon: Zap },
    { label: "UV Index", value: formatVal(displayData.uv_index, "3.2"), icon: Sun, sparkKey: "uv_index" as const },
    { label: "Alert", value: displayAi.alert ?? "Clear", icon: AlertTriangle },
  ];

  const sensorHealthRows = useMemo(() => {
    const d = displayData;
    const near = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
    const status = (
      v: number | undefined,
      lowOk: number,
      highOk: number,
      warnLo?: number,
      warnHi?: number
    ): "Online" | "Offline" | "Warning" => {
      if (v == null || Number.isNaN(v)) return "Offline";
      if (warnLo != null && v <= warnLo) return "Warning";
      if (warnHi != null && v >= warnHi) return "Warning";
      if (v >= lowOk && v <= highOk) return "Online";
      return "Warning";
    };
    return [
      { name: "Soil Moisture", value: d.moisture, unit: "%", status: status(d.moisture, 40, 80, 20, 95) },
      { name: "Temperature", value: d.temperature, unit: "°C", status: status(d.temperature, 18, 35, 35, 38) },
      { name: "Humidity", value: d.humidity, unit: "%", status: status(d.humidity, 40, 70, 30, 85) },
      { name: "AQI", value: d.aqi, unit: "", status: status(d.aqi, 0, 50, 50, 150) },
      { name: "CO₂", value: d.co2_ppm, unit: "ppm", status: status(d.co2_ppm, 400, 800, 800, 1000) },
      { name: "Pressure", value: d.pressure, unit: "hPa", status: d.pressure != null ? "Online" : "Offline" },
      { name: "UV Index", value: d.uv_index, unit: "", status: status(d.uv_index, 0, 8, 8, 11) },
      { name: "Light", value: d.light_lux, unit: "lux", status: d.light_lux != null ? "Online" : "Offline" },
      { name: "Wind", value: d.wind_speed, unit: "m/s", status: d.wind_speed != null ? "Online" : "Offline" },
      { name: "Soil pH", value: d.soil_ph, unit: "", status: d.soil_ph != null ? "Online" : "Offline" },
    ];
  }, [displayData]);

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

  const lastUpdatedClass =
    secondsSinceUpdate > 30 ? "last-updated--disconnected" : secondsSinceUpdate >= 10 ? "last-updated--delayed" : "last-updated--live";

  return (
    <main className="dashboard-page">
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <button
        type="button"
        className="top-btn top-btn--fullscreen"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <div className="backend-badge">
        <span
          className={`backend-dot ${aiConnected ? "backend-dot--live" : "backend-dot--off"}`}
        />
        Backend {aiConnected ? "Live" : "Offline"}
      </div>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.severity.toLowerCase()}`}
            role="alert"
          >
            <span className="toast-sensor">{toast.sensor}</span>
            <span className="toast-value">{toast.value}</span>
            <span className="toast-severity">{toast.severity}</span>
          </div>
        ))}
      </div>

      <header className="dashboard-header">
        <h1 className="dashboard-title">AI Smart Environmental Station</h1>
        <p className={`last-updated ${lastUpdatedClass}`}>
          {secondsSinceUpdate <= 10 && <span className="last-updated-dot" />}
          Last updated: {secondsSinceUpdate} second{secondsSinceUpdate !== 1 ? "s" : ""} ago
        </p>
      </header>

      <section className="panel-grid panel-grid--desktop">
        {panelSections.map((section) => {
          const sectionId = section.title.startsWith("Soil")
            ? "soil"
            : section.title.startsWith("Atmosphere")
              ? "atmosphere"
              : section.title.startsWith("Air")
                ? "air"
                : "ai";
          const hiddenOnMobile = mobileTab !== sectionId;
          return (
            <div
              key={section.title}
              className={`panel-card ${hiddenOnMobile ? "panel-card--hidden-mobile" : ""}`}
              id={`panel-${sectionId}`}
            >
              <h2 className="panel-title">{section.title}</h2>
              <div className="panel-cards">
                {section.cards.map((c) => {
                  if (c.label === "Soil Moisture")
                    return (
                      <SemicircleGauge
                        key={c.label}
                        label="Soil Moisture"
                        value={Number(displayData.moisture ?? 62)}
                        max={100}
                        displaySuffix="%"
                        level={getMoistureLevel(Number(displayData.moisture ?? 62))}
                        icon={Droplets}
                      />
                    );
                  if (c.label === "Humidity")
                    return (
                      <SemicircleGauge
                        key={c.label}
                        label="Humidity"
                        value={Number(displayData.humidity ?? 58)}
                        max={100}
                        displaySuffix="%"
                        level={getHumidityLevel(Number(displayData.humidity ?? 58))}
                        icon={Droplets}
                      />
                    );
                  if (c.label === "AQI")
                    return (
                      <SemicircleGauge
                        key={c.label}
                        label="AQI"
                        value={Number(displayData.aqi ?? 72)}
                        max={500}
                        displaySuffix=""
                        level={getAQILevel(Number(displayData.aqi ?? 72))}
                        icon={Flame}
                      />
                    );
                  if (section.title === "AI Prediction Panel" && c.label === "Rain (next 6h)")
                    return (
                      <div key={c.label} className="panel-item panel-item--rain-bar">
                        <div className="panel-item-label">
                          <CloudRain className="panel-item-icon" />
                          Rain (next 6h)
                        </div>
                        <div className="rain-bar-wrap">
                          <div className="rain-bar-track">
                            <div
                              className="rain-bar-fill"
                              style={{
                                width: `${rainPercent}%`,
                                backgroundColor:
                                  rainPercent >= 60 ? "#ef4444" : rainPercent >= 30 ? "#eab308" : "#3b82f6",
                              }}
                            />
                          </div>
                          <p className="rain-bar-value">{rainPercent}%</p>
                          <p className="rain-bar-sentence">{rainSentence}</p>
                        </div>
                      </div>
                    );
                  const sparkKey = "sparkKey" in c ? c.sparkKey : undefined;
                  return (
                    <div key={c.label} className="panel-item">
                      <div className="panel-item-label">
                        <c.icon className="panel-item-icon" />
                        {c.label}
                      </div>
                      <p className="panel-item-value">{c.value}</p>
                      {sparkKey && (
                        <SparklineMini data={getSparkData(sparkKey)} stroke="var(--muted)" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="params-section">
        <div className="params-heading-row">
          <h2 className="params-heading">All Parameters</h2>
          <button
            type="button"
            className="params-export-btn"
            onClick={exportCsv}
            disabled={csvDownloading}
          >
            {csvDownloading ? "Downloading..." : "Export CSV"}
          </button>
        </div>
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

      <section className="sensor-health-section">
        <h2 className="sensor-health-heading">Sensor Health</h2>
        <div className="sensor-health-table-wrap">
          <table className="sensor-health-table">
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Value</th>
                <th>Status</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {sensorHealthRows.map((row, i) => (
                <tr key={row.name} className={i % 2 === 1 ? "sensor-health-row--alt" : ""}>
                  <td>{row.name}</td>
                  <td>{row.value != null ? `${row.value}${row.unit}` : "—"}</td>
                  <td>
                    <span className={`sensor-badge sensor-badge--${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div className="signal-bars">
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`signal-bar ${row.status === "Online" ? "signal-bar--on" : row.status === "Warning" && i <= 2 ? "signal-bar--on" : ""}`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Panel tabs">
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "soil" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("soil")}
        >
          Soil
        </button>
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "atmosphere" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("atmosphere")}
        >
          Atmosphere
        </button>
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "air" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("air")}
        >
          Air Quality
        </button>
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "ai" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("ai")}
        >
          AI
        </button>
      </nav>
    </main>
  );
}