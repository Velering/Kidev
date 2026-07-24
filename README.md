# Kidev Learning Bot

Paper-Trading-Bot am **echten BTC/USDT-Markt** (Binance Data API).  
Er lernt fortlaufend, speichert den Stand in `data/`, und zeigt ehrlich:

- **Fortschritt** (Generationen + Daten + Confidence)
- **Strategie-Sicherheit** (Confidence 0–100)
- **Paper-Gewinn** (nur geschlossene Paper-Trades — Backtest zählt nicht als Gewinn)

## Reihenfolge der Unterhaltungen

Siehe [docs/TIMELINE.md](docs/TIMELINE.md) — nacheinander, nicht parallel.

## Start (dauerhaft lernen)

```bash
npm install
npm run build
npm start
```

Dashboard: http://localhost:4173  
Lernen alle ~3 Min, Trade-Check jede Minute, State in `data/learning.json`.

## Ehrlichkeit

| Anzeige | Bedeutung |
| --- | --- |
| Backtest Train/Validation | Historische Simulation — **kein Geld** |
| Paper-Gewinn | Simulierte Orders zu Marktpreisen — **kein Exchange-Fill** |
| Echtes Geld | Erst wenn `readyForLive` (streng: ≥30 Paper-Trades, positiv, hohe Confidence) |

Der Bot **lügt nicht** mit Backtest-PnL als „Gewinn“. Overfitting (Train negativ / Validation positiv) senkt die Confidence stark und blockiert Paper-Trading.

## Hinweis

Forschung / Paper — keine Finanzberatung. Echtes Kapital erst nach langer, ehrlicher Paper-Phase.
