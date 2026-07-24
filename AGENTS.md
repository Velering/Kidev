# Kidev Learning Bot

React + TypeScript + Vite dashboard with a local Node paper-trading / learning bot
under `server/`. Learning state persists in `data/`. An optional Supabase Edge
Function remains under `supabase/functions/trading-bot`.

## Cursor Cloud specific instructions

### Services

- **Learning bot + dashboard (`npm start`)** — after `npm run build`, serves UI and
  `/api/*` on `http://localhost:4173/`. Learns every ~3 minutes from Binance
  Data API candles and saves to `data/learning.json`.
- **Dev split** — `npm run bot` (API on `:8787`) + `npm run dev` (Vite on `:5173`).
- Conversation order: see `docs/TIMELINE.md` (sequential, not parallel).

### Honesty rules

- Backtest train/validation PnL is **not** real profit.
- Paper PnL only counts closed paper trades at market prices.
- `readyForLive` stays false until a strict paper sample exists — never claim
  live readiness from backtest alone.
- Overfit patterns (train negative / validation positive) lower confidence and
  block paper trading.

### Non-obvious notes

- No Supabase secrets needed for `npm start`.
- Chart + learner need outbound access to `https://data-api.binance.vision`.
- `data/` is gitignored; do not delete it while the bot should keep learning.
