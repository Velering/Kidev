import fs from 'node:fs';
import path from 'node:path';
import { backtest, defaultParams, liveSignal } from './backtest.js';

/**
 * @typedef {import('./backtest.js').StrategyParams} StrategyParams
 * @typedef {import('./backtest.js').Candle} Candle
 * @typedef {import('./backtest.js').BacktestResult} BacktestResult
 */

/**
 * @typedef {{
 *  generation: number,
 *  learnedAt: string | null,
 *  params: StrategyParams,
 *  train: null | Omit<BacktestResult, 'trades'>,
 *  validation: null | Omit<BacktestResult, 'trades'>,
 *  history: Array<{ generation: number, score: number, netPnlPct: number, winRate: number, profitFactor: number }>,
 *  online: { closedTrades: number, wins: number, losses: number, realizedPnlPct: number, edgeOk: boolean }
 * }} LearningState
 */

/**
 * @param {string} filePath
 * @returns {LearningState}
 */
export function loadLearningState(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      generation: 0,
      learnedAt: null,
      params: defaultParams(),
      train: null,
      validation: null,
      history: [],
      online: { closedTrades: 0, wins: 0, losses: 0, realizedPnlPct: 0, edgeOk: false },
    };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {string} filePath
 * @param {LearningState} state
 */
export function saveLearningState(filePath, state) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, digits = 4) {
  const v = min + Math.random() * (max - min);
  return Number(v.toFixed(digits));
}

/** @returns {StrategyParams} */
export function randomParams() {
  const shortEma = randInt(5, 18);
  const longEma = randInt(shortEma + 5, 60);
  return {
    shortEma,
    longEma,
    rsiPeriod: randInt(8, 21),
    rsiBuyMax: randInt(45, 70),
    rsiSellMin: randInt(30, 55),
    atrPeriod: randInt(10, 21),
    atrSlMult: randFloat(0.8, 2.2, 2),
    atrTpMult: randFloat(1.2, 3.5, 2),
    minSepPct: randFloat(0, 0.0002, 6),
  };
}

/**
 * Mutate around a parent — local search / evolutionary step.
 * @param {StrategyParams} parent
 * @returns {StrategyParams}
 */
export function mutateParams(parent) {
  const next = { ...parent };
  const keys = Object.keys(next);
  const key = keys[randInt(0, keys.length - 1)];
  switch (key) {
    case 'shortEma':
      next.shortEma = Math.max(3, parent.shortEma + randInt(-2, 2));
      break;
    case 'longEma':
      next.longEma = Math.max(next.shortEma + 4, parent.longEma + randInt(-4, 4));
      break;
    case 'rsiPeriod':
      next.rsiPeriod = Math.min(30, Math.max(5, parent.rsiPeriod + randInt(-2, 2)));
      break;
    case 'rsiBuyMax':
      next.rsiBuyMax = Math.min(70, Math.max(30, parent.rsiBuyMax + randInt(-3, 3)));
      break;
    case 'rsiSellMin':
      next.rsiSellMin = Math.min(70, Math.max(30, parent.rsiSellMin + randInt(-3, 3)));
      break;
    case 'atrPeriod':
      next.atrPeriod = Math.min(30, Math.max(7, parent.atrPeriod + randInt(-2, 2)));
      break;
    case 'atrSlMult':
      next.atrSlMult = Math.min(3.5, Math.max(0.8, Number((parent.atrSlMult + randFloat(-0.3, 0.3, 2)).toFixed(2))));
      break;
    case 'atrTpMult':
      next.atrTpMult = Math.min(5, Math.max(1.2, Number((parent.atrTpMult + randFloat(-0.4, 0.4, 2)).toFixed(2))));
      break;
    case 'minSepPct':
      // Slope threshold (fraction of price); keep small so crosses can fire.
      next.minSepPct = Math.min(
        0.0005,
        Math.max(0, Number((parent.minSepPct + randFloat(-0.00005, 0.00005, 6)).toFixed(6))),
      );
      break;
    default:
      break;
  }
  if (next.longEma <= next.shortEma) next.longEma = next.shortEma + 5;
  return next;
}

/**
 * @param {BacktestResult} result
 */
function stripTrades(result) {
  const { trades: _t, ...rest } = result;
  return rest;
}

/**
 * Walk-forward learning: optimize on train split, accept only if validation is profitable.
 * @param {Candle[]} candles
 * @param {LearningState} state
 * @param {{ candidates?: number }} [opts]
 * @returns {LearningState}
 */
export function learnFromCandles(candles, state, opts = {}) {
  const candidates = opts.candidates ?? 80;
  if (candles.length < 200) {
    return {
      ...state,
      learnedAt: new Date().toISOString(),
      online: { ...state.online, edgeOk: false },
    };
  }

  const split = Math.floor(candles.length * 0.7);
  /** @type {{ params: StrategyParams, train: BacktestResult, validation: BacktestResult }[]} */
  const ranked = [];

  // Keep exploring around current best + fresh random genomes.
  for (let i = 0; i < candidates; i++) {
    const params =
      i < Math.floor(candidates * 0.4) && state.generation > 0
        ? mutateParams(state.params)
        : randomParams();

    const train = backtest(candles, params, { startIndex: 0, endIndex: split - 1 });
    if (train.tradeCount < 4) continue;

    const validation = backtest(candles, params, {
      startIndex: split,
      endIndex: candles.length - 1,
    });
    if (validation.tradeCount < 2) continue;
    // Prefer profitable OOS; still keep near-breakeven candidates ranked by score.
    if (validation.netPnlPct < -0.5) continue;
    if (validation.profitFactor < 0.95) continue;

    ranked.push({ params, train, validation });
  }

  ranked.sort((a, b) => b.validation.score - a.validation.score);

  if (ranked.length === 0) {
    return {
      ...state,
      generation: state.generation + 1,
      learnedAt: new Date().toISOString(),
      online: { ...state.online, edgeOk: false },
      history: [
        {
          generation: state.generation + 1,
          score: -999,
          netPnlPct: 0,
          winRate: 0,
          profitFactor: 0,
        },
        ...state.history,
      ].slice(0, 30),
    };
  }

  const best = ranked[0];
  const generation = state.generation + 1;
  const edgeOk =
    best.validation.tradeCount >= 3 &&
    best.validation.score > 0 &&
    best.validation.netPnlPct > 0 &&
    best.validation.profitFactor >= 1.05 &&
    best.validation.expectancy > 0;
  const next = {
    generation,
    learnedAt: new Date().toISOString(),
    params: best.params,
    train: stripTrades(best.train),
    validation: stripTrades(best.validation),
    history: [
      {
        generation,
        score: best.validation.score,
        netPnlPct: best.validation.netPnlPct,
        winRate: best.validation.winRate,
        profitFactor: best.validation.profitFactor,
      },
      ...state.history,
    ].slice(0, 30),
    online: {
      ...state.online,
      edgeOk,
    },
  };
  return next;
}

/**
 * Update online edge estimate after a closed live paper trade.
 * @param {LearningState} state
 * @param {number} pnlPct  // decimal, e.g. 0.01 = +1%
 */
export function recordOnlineTrade(state, pnlPct) {
  const online = { ...state.online };
  online.closedTrades += 1;
  if (pnlPct > 0) online.wins += 1;
  else online.losses += 1;
  online.realizedPnlPct += pnlPct * 100;

  const winRate = online.closedTrades ? online.wins / online.closedTrades : 0;
  const avg = online.closedTrades ? online.realizedPnlPct / online.closedTrades : 0;
  // Require validation edge AND non-terrible live results once we have sample size.
  const liveOk = online.closedTrades < 5 || (winRate >= 0.4 && avg > -0.15);
  online.edgeOk = Boolean(state.validation && state.validation.expectancy > 0 && liveOk);

  return { ...state, online };
}

/**
 * @param {Candle[]} candles
 * @param {LearningState} state
 */
export function decideEntry(candles, state) {
  if (!state.online.edgeOk || !state.validation || state.validation.netPnlPct <= 0) {
    return {
      signal: null,
      price: candles.at(-1)?.close ?? 0,
      stop: null,
      take: null,
      reason: 'learning_no_edge',
    };
  }
  return liveSignal(candles, state.params);
}
