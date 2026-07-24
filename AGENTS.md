# Kidev Learning Bot

React + TypeScript + Vite dashboard with a local Node paper-trading / learning bot
under `server/`. An optional Supabase Deno Edge Function remains under
`supabase/functions/trading-bot` for Binance Testnet experiments.

## Cursor Cloud specific instructions

### Services

- **Learning bot + dashboard (`npm start`)** — after `npm run build`, serves UI and
  `/api/*` on `http://localhost:4173/`.
- **Dev split** — `npm run bot` (API on `:8787`, `API_ONLY=1`) + `npm run dev`
  (Vite on `:5173`, proxies `/api` → `:8787`).
- **Supabase Edge Function `trading-bot`** — optional; not required for the local
  learning stack. Needs Binance Testnet secrets if used.

### Non-obvious notes

- Primary path is **local paper trading**. No Supabase secrets are required for
  `npm start` / `npm run bot`.
- The live chart fetches candles from Binance
  (`https://data-api.binance.vision`) — outbound access to that host is required.
- Bot state is stored under `data/` (`trades.json`, `learning.json`); the folder
  is gitignored.
- `npm run lint` lints TS/TSX. Keep Edge Function free of `any` so lint stays green.
- The bot only opens live paper trades when walk-forward validation shows an edge
  (`edgeOk`); otherwise the dashboard stays in Learning mode.
