# Kidev Trading Bot

React-Dashboard + lokaler Paper-Trading-Server (BTC/USDT, SMA-Kreuzung, SL/TP).

## Schnellstart

```bash
npm install
npm run build
npm start
```

Öffne http://localhost:4173 — Trade-Historie kommt von `/api/trades`, der Bot tickt jede Minute.

## Scripts

| Befehl | Beschreibung |
| --- | --- |
| `npm run build` | Frontend nach `dist/` |
| `npm start` | API + Static Server + Paper-Bot |
| `npm run dev` | Nur Vite-Frontend (ohne API) |
| `npm test` | Vitest |

Trades werden unter `data/trades.json` gespeichert (gitignored).
