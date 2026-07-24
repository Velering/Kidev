import { describe, expect, it } from 'vitest';
import { backtest, defaultParams, liveSignal } from './backtest.js';

function makeCandles(n, start = 100) {
  const candles = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    // mild uptrend with noise
    price = price * (1 + (i % 7 === 0 ? -0.002 : 0.0015));
    const open = price * 0.999;
    const close = price;
    const high = Math.max(open, close) * 1.001;
    const low = Math.min(open, close) * 0.999;
    candles.push({
      time: Date.UTC(2024, 0, 1) + i * 60_000,
      open,
      high,
      low,
      close,
      volume: 10,
    });
  }
  return candles;
}

describe('backtest', () => {
  it('returns structured stats for enough candles', () => {
    const result = backtest(makeCandles(250), defaultParams());
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.netPnlPct)).toBe(true);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.profitFactor).toBeGreaterThanOrEqual(0);
  });

  it('liveSignal handles warmup without throwing', () => {
    const signal = liveSignal(makeCandles(30), defaultParams());
    expect(signal).toHaveProperty('signal');
    expect(signal).toHaveProperty('price');
  });
});
