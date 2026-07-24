# Kidev Learning Bot

Paper-Trading-Bot, der **lernt**, wann Trades einen Edge haben — nicht nur Demo-Daten anzeigt.

## Was er lernt

1. Holt BTC/USDT 1m-Kerzen von Binance Data API
2. Evolutions-/Such-Schritt: EMA/RSI/ATR-Parameter
3. Walk-forward: Train 70% / Validation 30%
4. Handelt live nur, wenn Validation **profitabel** ist (PnL > 0, Profit Factor ≥ 1.05)
5. Passt den Edge nach geschlossenen Paper-Trades online an

## Start (Produktion / ein Prozess)

```bash
npm install
npm run build
npm start
```

Dashboard: http://localhost:4173  
APIs: `/api/learning`, `/api/trades`, `/api/stats`

## Start (Dev: UI + Bot getrennt)

```bash
# Terminal 1 — Learning-Bot API
npm run bot

# Terminal 2 — Vite UI (proxied /api → :8787)
npm run dev
```

Dashboard: http://localhost:5173

## Optional: Supabase Edge Function

Die ältere Spot-Testnet-Logik liegt unter `supabase/functions/trading-bot` (long-only).  
SQL für die `trades`-Tabelle: `supabase/migrations/`.

## Hinweis

Das ist Paper-Trading / Forschung — keine Finanzberatung und kein Garant für Live-Gewinne.
