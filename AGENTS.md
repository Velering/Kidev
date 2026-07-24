# Kidev Trading Bot

React + TypeScript + Vite dashboard for a Binance BTC/USDT paper-trading bot. The
optional backend is a Supabase Deno Edge Function under `supabase/functions/trading-bot`.

## Cursor Cloud specific instructions

### Services

- **Frontend dashboard (Vite dev server)** — the product UI. Standard commands are in
  `package.json` (`npm run dev`, `npm run build`, `npm run lint`, `npm test`, `npm run preview`).
  The dev server listens on `http://localhost:5173/`.
- **Supabase Edge Function `trading-bot`** — optional backend that runs the trading
  strategy. There is no Supabase CLI config committed, so it cannot be served locally
  from this repo; it is deployed to a Supabase project. Not needed to run/verify the dashboard.

### Non-obvious notes

- The dashboard runs fully standalone in **Demo mode** without any secrets. When
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are absent (or left as the `.env.example`
  placeholders), the app skips Supabase and only renders the live BTC/USDT chart + an empty
  trade-history panel. The status badge shows "Demo" (yellow). No secrets are required to
  develop or verify the UI.
- The live chart fetches candles directly from Binance's public API
  (`https://data-api.binance.vision`) from the browser — outbound internet access to that
  host is required for the chart to render.
- `npm run lint` lints the whole repo, including `supabase/functions/**`. The backend
  edge function currently has a pre-existing lint error (`no-explicit-any` in
  `supabase/functions/trading-bot/index.ts`), so `npm run lint` exits non-zero even on a
  clean checkout. This is unrelated to the frontend and to environment setup.
- Full end-to-end testing of the bot (real trade history + order placement) additionally
  requires a Supabase project with a `trades` table (Realtime enabled) and Binance Testnet
  credentials (`BINANCE_API_KEY`, `BINANCE_SECRET_KEY`) set as Supabase function secrets.
  No SQL migration for the `trades` table exists in the repo.
