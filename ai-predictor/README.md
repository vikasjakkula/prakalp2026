# AI Predictor (localhost:5000)

Rain and irrigation prediction API for the Environmental Station.

Right now the dashboard does not send live sensor data to this API; it uses server-side defaults or query/body. You can later add a Next.js API route or server action that forwards WebSocket sensor data to this URL.

## Expo checklist

- **ESP32:** Set your Wi-Fi and use the device IP in `NEXT_PUBLIC_ESP32_WS_URL` (no key).
- **This AI predictor:** `python app.py`.
- **Supabase:** Only if you use login/register; then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
