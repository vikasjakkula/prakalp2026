function readPublicEnv(name: string): string | null {
  if (typeof process === "undefined") return null;
  const v = process.env[name];
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isDefinitelyLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

function isProbablyPrivateLanHost(hostname: string): boolean {
  // Note: This intentionally focuses on common LAN/private IP ranges used in demos.
  // It's not a full RFC implementation, but it's enough to prevent noisy prod errors.
  if (hostname === "localhost") return true;
  if (hostname === "127.0.0.1" || hostname === "0.0.0.0") return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  const m = hostname.match(/^172\.(\d{1,2})\./);
  if (m) {
    const second = Number(m[1]);
    if (!Number.isNaN(second) && second >= 16 && second <= 31) return true;
  }
  return false;
}

function parseUrlSafely(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * WebSocket URL for ESP32 (set in env).
 * In production, we intentionally do NOT default to a LAN IP to avoid Mixed Content
 * warnings (HTTPS page trying to open ws://...).
 */
export function getEsp32WsUrl(): string | null {
  const raw = readPublicEnv("NEXT_PUBLIC_ESP32_WS_URL");
  if (!raw) return null;

  if (typeof window !== "undefined") {
    const isPublicSite = window.location.hostname !== "localhost";
    const isHttpsPage = window.location.protocol === "https:";

    // On public HTTPS sites, don't attempt to connect to LAN/private endpoints.
    // This prevents Mixed Content noise and unreachable connections on Vercel.
    if (isPublicSite) {
      if (raw.startsWith("ws://")) return null;
      const u = parseUrlSafely(raw.replace(/^wss?:\/\//, "http://"));
      if (u && isProbablyPrivateLanHost(u.hostname)) return null;
    }

    // On HTTPS pages (even locally), prefer secure WebSockets if provided.
    if (isHttpsPage) {
      if (raw.startsWith("ws://")) return null;
    }
  }

  return raw;
}

/** Default production backend (Render). Override with NEXT_PUBLIC_AI_PREDICT_URL. */
const DEFAULT_AI_PREDICT_URL = "https://prakalp-backend-wyx7.onrender.com/";

/**
 * AI prediction URL (set in env, or defaults to Render backend).
 * We do NOT default to localhost in production because browsers cannot reach the
 * Vercel server's localhost, and it triggers CORS noise for end users.
 */
export function getAiPredictUrl(): string | null {
  const raw = readPublicEnv("NEXT_PUBLIC_AI_PREDICT_URL") ?? DEFAULT_AI_PREDICT_URL;
  if (!raw) return null;

  if (typeof window !== "undefined") {
    const isPublicSite = window.location.hostname !== "localhost";
    if (isPublicSite) {
      if (isDefinitelyLocalhost(raw)) return null;
      const u = parseUrlSafely(raw);
      if (u) {
        if (isProbablyPrivateLanHost(u.hostname)) return null;
        // Avoid mixed content / blocked fetches from HTTPS sites.
        if (window.location.protocol === "https:" && u.protocol === "http:") return null;
      }
    }
  }

  return raw;
}

/** Max history points for charts */
export const CHART_HISTORY_LENGTH = 60;
