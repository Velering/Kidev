import { atr, ema, rsi } from './indicators.js';

/**
 * @typedef {{
 *  shortEma: number,
 *  longEma: number,
 *  rsiPeriod: number,
 *  rsiBuyMax: number,
 *  rsiSellMin: number,
 *  atrPeriod: number,
 *  atrSlMult: number,
 *  atrTpMult: number,
 *  minSepPct: number
 * }} StrategyParams
 *
 * @typedef {{
 *  time: number,
 *  open: number,
 *  high: number,
 *  low: number,
 *  close: number,
 *  volume: number
 * }} Candle
 *
 * @typedef {{
 *  type: 'buy' | 'sell',
 *  entryIndex: number,
 *  entryPrice: number,
 *  exitIndex: number,
 *  exitPrice: number,
 *  pnlPct: number,
 *  reason: string
 * }} ClosedTrade
 *
 * @typedef {{
 *  trades: ClosedTrade[],
 *  netPnlPct: number,
 *  winRate: number,
 *  profitFactor: number,
 *  expectancy: number,
 *  maxDrawdownPct: number,
 *  tradeCount: number,
 *  score: number
 * }} BacktestResult
 */

/** @returns {StrategyParams} */
export function defaultParams() {
  return {
    shortEma: 9,
    longEma: 21,
    rsiPeriod: 14,
    rsiBuyMax: 60,
    rsiSellMin: 40,
    atrPeriod: 14,
    atrSlMult: 1.2,
    atrTpMult: 2.0,
    // Minimum |long EMA slope| over lookback, as fraction of price.
    minSepPct: 0.00005,
  };
}

/**
 * Score favors positive expectancy with enough trades and controlled drawdown.
 * @param {Omit<BacktestResult, 'score'>} stats
 */
export function scoreStats(stats) {
  if (stats.tradeCount < 3) return -999;
  if (stats.profitFactor < 1) return -50 + stats.netPnlPct;
  const ddPenalty = Math.max(0, stats.maxDrawdownPct - 5) * 2;
  return (
    stats.expectancy * 100 * Math.sqrt(stats.tradeCount) +
    Math.log10(1 + Math.max(0, stats.profitFactor)) * 20 -
    ddPenalty +
    stats.winRate * 10
  );
}

/**
 * @param {Candle[]} candles
 * @param {StrategyParams} params
 * @param {{ feePct?: number, startIndex?: number, endIndex?: number }} [opts]
 * @returns {BacktestResult}
 */
export function backtest(candles, params, opts = {}) {
  const feePct = opts.feePct ?? 0.0004;
  const startIndex = opts.startIndex ?? 0;
  const endIndex = opts.endIndex ?? candles.length - 1;

  const closes = candles.map((c) => c.close);
  const short = ema(closes, params.shortEma);
  const long = ema(closes, params.longEma);
  const rsiVals = rsi(closes, params.rsiPeriod);
  const atrVals = atr(candles, params.atrPeriod);

  /** @type {ClosedTrade[]} */
  const trades = [];
  /** @type {null | { type: 'buy' | 'sell', entryIndex: number, entryPrice: number, stop: number, take: number }} */
  let open = null;
  let equity = 0;
  let peak = 0;
  let maxDd = 0;

  const first = Math.max(
    startIndex,
    params.longEma + 2,
    params.rsiPeriod + 2,
    params.atrPeriod + 2,
  );

  for (let i = first; i <= endIndex; i++) {
    const price = closes[i];
    const a = atrVals[i];
    const s = short[i];
    const l = long[i];
    const r = rsiVals[i];
    const ps = short[i - 1];
    const pl = long[i - 1];

    if (open) {
      let exit = null;
      let reason = '';
      if (open.type === 'buy') {
        if (candles[i].low <= open.stop) {
          exit = open.stop;
          reason = 'sl';
        } else if (candles[i].high >= open.take) {
          exit = open.take;
          reason = 'tp';
        }
      } else {
        if (candles[i].high >= open.stop) {
          exit = open.stop;
          reason = 'sl';
        } else if (candles[i].low <= open.take) {
          exit = open.take;
          reason = 'tp';
        }
      }

      if (exit != null) {
        const raw =
          open.type === 'buy'
            ? (exit - open.entryPrice) / open.entryPrice
            : (open.entryPrice - exit) / open.entryPrice;
        const pnlPct = raw - feePct * 2;
        trades.push({
          type: open.type,
          entryIndex: open.entryIndex,
          entryPrice: open.entryPrice,
          exitIndex: i,
          exitPrice: exit,
          pnlPct,
          reason,
        });
        equity += pnlPct * 100;
        peak = Math.max(peak, equity);
        maxDd = Math.max(maxDd, peak - equity);
        open = null;
      }
      continue;
    }

    if (s == null || l == null || r == null || a == null || ps == null || pl == null) continue;

    // Trend filter: slope of the slow EMA (not short/long separation on the cross bar,
    // which is ~0 by definition and blocked all entries).
    const slopeLookback = Math.min(5, i);
    const longPrev = long[i - slopeLookback];
    if (longPrev == null) continue;
    const slopePct = (l - longPrev) / price;
    const trendUp = slopePct >= params.minSepPct;
    const trendDown = slopePct <= -params.minSepPct;

    const bullishCross = ps <= pl && s > l && r <= params.rsiBuyMax && trendUp;
    const bearishCross = ps >= pl && s < l && r >= params.rsiSellMin && trendDown;

    if (bullishCross || bearishCross) {
      const type = bullishCross ? 'buy' : 'sell';
      const stop =
        type === 'buy' ? price - a * params.atrSlMult : price + a * params.atrSlMult;
      const take =
        type === 'buy' ? price + a * params.atrTpMult : price - a * params.atrTpMult;
      open = { type, entryIndex: i, entryPrice: price, stop, take };
    }
  }

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct <= 0);
  const grossWin = wins.reduce((a, t) => a + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlPct, 0));
  const netPnlPct = trades.reduce((a, t) => a + t.pnlPct, 0) * 100;
  const winRate = trades.length ? wins.length / trades.length : 0;
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? 99 : 0) : grossWin / grossLoss;
  const expectancy = trades.length
    ? trades.reduce((a, t) => a + t.pnlPct, 0) / trades.length
    : 0;

  const stats = {
    trades,
    netPnlPct,
    winRate,
    profitFactor,
    expectancy,
    maxDrawdownPct: maxDd,
    tradeCount: trades.length,
  };

  return { ...stats, score: scoreStats(stats) };
}

/**
 * Live signal at the last closed candle using learned params.
 * @param {Candle[]} candles
 * @param {StrategyParams} params
 * @returns {{ signal: 'buy' | 'sell' | null, price: number, stop: number | null, take: number | null, reason: string }}
 */
export function liveSignal(candles, params) {
  if (candles.length < params.longEma + 5) {
    return { signal: null, price: 0, stop: null, take: null, reason: 'insufficient_data' };
  }

  const closes = candles.map((c) => c.close);
  const short = ema(closes, params.shortEma);
  const long = ema(closes, params.longEma);
  const rsiVals = rsi(closes, params.rsiPeriod);
  const atrVals = atr(candles, params.atrPeriod);
  const i = candles.length - 1;
  const price = closes[i];
  const s = short[i];
  const l = long[i];
  const r = rsiVals[i];
  const a = atrVals[i];
  const ps = short[i - 1];
  const pl = long[i - 1];

  if (s == null || l == null || r == null || a == null || ps == null || pl == null) {
    return { signal: null, price, stop: null, take: null, reason: 'warmup' };
  }

  const slopeLookback = Math.min(5, i);
  const longPrev = long[i - slopeLookback];
  if (longPrev == null) {
    return { signal: null, price, stop: null, take: null, reason: 'warmup' };
  }
  const slopePct = (l - longPrev) / price;
  const trendUp = slopePct >= params.minSepPct;
  const trendDown = slopePct <= -params.minSepPct;

  if (ps <= pl && s > l && r <= params.rsiBuyMax && trendUp) {
    return {
      signal: 'buy',
      price,
      stop: price - a * params.atrSlMult,
      take: price + a * params.atrTpMult,
      reason: 'ema_cross_up_trend',
    };
  }

  if (ps >= pl && s < l && r >= params.rsiSellMin && trendDown) {
    return {
      signal: 'sell',
      price,
      stop: price + a * params.atrSlMult,
      take: price - a * params.atrTpMult,
      reason: 'ema_cross_down_trend',
    };
  }

  return { signal: null, price, stop: null, take: null, reason: 'no_edge' };
}
