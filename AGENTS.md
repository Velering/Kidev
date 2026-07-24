# Kidev Learning Bot

React + TypeScript + Vite dashboard plus a local Node paper-trading server that
learns a profitable edge (EMA/RSI/ATR) before trading. An optional Supabase Deno
Edge Function still lives under `supabase/functions/trading-bot`.

## Cursor Cloud specific instructions

### Services

- **Local paper-trading server** — primary runtime after build:
  `npm run build && npm start`. Serves `dist/` and APIs on
  `http://localhost:4173/` (`/api/trades`, `/api/learning`, `/api/stats`,
  `/api/health`). Learner + bot loop run in-process; no Supabase required.
- **Frontend dashboard (Vite)** — `npm run dev` on `http://localhost:5173/` for
  UI-only work. Prefer `npm start` for full bot + learning verification (API
  routes are proxied/served by the Node server in production mode).
- **Supabase Edge Function `trading-bot`** — optional legacy/cloud backend.
  There is no Supabase CLI config committed; not needed for local verification.

### Non-obvious notes

- Full stack path: `npm install && npm run build && npm start`. Dashboard title
  is **Kidev Learning Bot**; status shows Learning vs Trading (Edge) with
  generation number.
- The live chart and learner fetch candles from Binance Data API
  (`https://data-api.binance.vision`). Outbound access to that host is required.
- Trade state persists under `data/trades.json` (gitignored).
- `npm run lint` still flags a pre-existing `no-explicit-any` in
  `supabase/functions/trading-bot/index.ts` and may exit non-zero.
- This is paper trading / research only — not financial advice.
