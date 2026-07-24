# Kidev Trading Bot

React + TypeScript Dashboard für den Binance Paper-Trading Bot.

## Schnellstart

```bash
npm install
cp .env.example .env   # optional: Supabase-Werte eintragen
npm run dev
```

Ohne Supabase startet das Dashboard im **Demo-Modus** mit Live-BTC/USDT-Chart.

## Scripts

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev` | Lokaler Dev-Server |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm run preview` | Statischen Build lokal ansehen |
| `npm test` | Vitest |

## Backend (Supabase Edge Function)

Die Bot-Logik liegt unter `supabase/functions/trading-bot`.

Benötigte Secrets im Supabase-Projekt:

- `BINANCE_API_KEY`
- `BINANCE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (meist automatisch vorhanden)

Marktdaten kommen über `https://data-api.binance.vision` (weniger geo-restricted als `api.binance.com`).
Orders laufen weiter über das Binance Testnet.

## Datenbank

Tabelle `trades` (Auszug):

- `symbol`, `type`, `price`, `quantity`
- `status` (`open` / `closed`)
- `stop_loss`, `take_profit`, `pnl`, `closed_at`
