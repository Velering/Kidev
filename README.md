# Kidev Learning Bot

Paper-Trading-Bot, der **lernt**, wann Trades einen Edge haben — nicht nur Demo-Daten anzeigt.

## Was er lernt

1. Holt BTC/USDT 1m-Kerzen von Binance Data API  
2. Evolutions-/Such-Schritt: EMA/RSI/ATR-Parameter  
3. Walk-forward: Train 70% / Validation 30%  
4. Handelt live nur, wenn Validation **profitabel** ist (PnL &gt; 0, Profit Factor ≥ 1.1)  
5. Passt den Edge nach geschlossenen Paper-Trades online an  

## Start

```bash
npm install
npm run build
npm start
```

Dashboard: http://localhost:4173  
APIs: `/api/learning`, `/api/trades`, `/api/stats`

## Hinweis

Das ist Paper-Trading / Forschung — keine Finanzberatung und kein Garant für Live-Gewinne.
