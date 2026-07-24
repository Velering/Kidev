/**
 * Honest readiness scoring for paper/live trading.
 * Never equates backtest PnL with real money. Live capital requires an
 * explicit high bar that is intentionally hard to reach.
 */

/**
 * @param {{
 *  generation: number,
 *  train: null | { netPnlPct: number, profitFactor: number, tradeCount: number, expectancy?: number, maxDrawdownPct?: number },
 *  validation: null | { netPnlPct: number, profitFactor: number, tradeCount: number, expectancy?: number, maxDrawdownPct?: number },
 *  online: { closedTrades: number, wins: number, losses: number, realizedPnlPct: number, edgeOk: boolean }
 * }} state
 * @param {{ closedPaperTrades?: number, paperPnlUsdt?: number, candleCount?: number, generationTarget?: number }} [ctx]
 */
export function computeHonesty(state, ctx = {}) {
  const train = state.train;
  const val = state.validation;
  const online = state.online;
  const closedPaper = ctx.closedPaperTrades ?? online.closedTrades ?? 0;
  const paperPnlUsdt = ctx.paperPnlUsdt ?? 0;
  const candleCount = ctx.candleCount ?? 0;
  const generationTarget = ctx.generationTarget ?? 50;

  /** @type {string[]} */
  const reasons = [];
  let confidence = 0;

  if (!val || val.tradeCount < 5) {
    reasons.push('Validation hat zu wenige Trades (<5) — kein belastbarer Edge.');
  } else {
    // Sample size (0–25)
    const sampleScore = Math.min(25, (val.tradeCount / 20) * 25);
    confidence += sampleScore;

    // Validation expectancy / PF (0–35)
    if (val.netPnlPct > 0 && val.profitFactor >= 1.1 && val.expectancy > 0) {
      confidence += Math.min(35, 10 + val.profitFactor * 8 + Math.min(10, val.netPnlPct));
    } else if (val.netPnlPct > 0) {
      confidence += 8;
      reasons.push('Validation nur schwach positiv — noch unsicher.');
    } else {
      reasons.push('Validation-PnL ≤ 0 — kein Edge.');
    }

    // Drawdown control (0–10)
    if (val.maxDrawdownPct != null && val.maxDrawdownPct < 3) confidence += 10;
    else if (val.maxDrawdownPct != null && val.maxDrawdownPct < 6) confidence += 5;
    else reasons.push('Validation-Drawdown hoch.');
  }

  // Train/validation consistency (0–20) — critical honesty check
  if (train && val) {
    if (train.netPnlPct > 0 && val.netPnlPct > 0 && train.profitFactor >= 1 && val.profitFactor >= 1) {
      confidence += 20;
    } else if (train.netPnlPct < 0 && val.netPnlPct > 0) {
      confidence *= 0.35;
      reasons.push('Overfitting-Risiko: Train negativ, Validation positiv.');
    } else if (train.netPnlPct <= 0) {
      confidence *= 0.5;
      reasons.push('Train-Segment nicht profitabel.');
    } else {
      confidence += 5;
      reasons.push('Train/Validation nur teilweise konsistent.');
    }
  } else {
    reasons.push('Noch kein vollständiges Train/Validation-Ergebnis.');
  }

  // Live paper evidence (0–20) — only real closed paper trades count
  if (closedPaper >= 10) {
    const liveWr = online.closedTrades ? online.wins / online.closedTrades : 0;
    if (paperPnlUsdt > 0 && liveWr >= 0.45) confidence += 20;
    else if (paperPnlUsdt > 0) confidence += 10;
    else {
      confidence *= 0.6;
      reasons.push('Paper-Live bisher nicht profitabel.');
    }
  } else if (closedPaper > 0) {
    confidence += 3;
    reasons.push(`Nur ${closedPaper} Paper-Trades — Live-Sample noch zu klein.`);
  } else {
    reasons.push('Noch keine geschlossenen Paper-Trades am echten Marktpreis.');
  }

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  // Progress: data + generations + confidence growth (honest, not fake)
  const genProgress = Math.min(40, (state.generation / generationTarget) * 40);
  const dataProgress = Math.min(30, (candleCount / 3000) * 30);
  const confProgress = (confidence / 100) * 30;
  const progress = Math.max(0, Math.min(100, Math.round(genProgress + dataProgress + confProgress)));

  /** @type {'searching' | 'weak_edge' | 'paper_candidate' | 'paper_trading' | 'not_ready_for_live'} */
  let phase = 'searching';
  if (confidence >= 55 && train?.netPnlPct > 0 && val?.netPnlPct > 0) {
    phase = closedPaper > 0 ? 'paper_trading' : 'paper_candidate';
  } else if (confidence >= 30) {
    phase = 'weak_edge';
  }

  // Paper trading allowed only with honest bar (still NOT real money)
  const readyForPaper =
    confidence >= 55 &&
    Boolean(train && val) &&
    train.netPnlPct > 0 &&
    val.netPnlPct > 0 &&
    val.profitFactor >= 1.15 &&
    val.tradeCount >= 8 &&
    train.tradeCount >= 8;

  // Real-money readiness: intentionally strict — never auto-claim from backtest alone
  const readyForLive =
    readyForPaper &&
    closedPaper >= 30 &&
    paperPnlUsdt > 0 &&
    online.wins / Math.max(1, online.closedTrades) >= 0.45 &&
    confidence >= 75;

  if (!readyForPaper) {
    reasons.push('Kein Paper-Trading: Confidence/Sample/Konsistenz reichen nicht.');
  }
  if (!readyForLive) {
    reasons.push('Nicht bereit für echtes Kapital — nur Paper / Forschung.');
  }

  return {
    confidence,
    progress,
    phase,
    readyForPaper,
    readyForLive,
    reasons,
    labels: {
      validationPnl: 'Backtest Validation (kein echtes Geld)',
      trainPnl: 'Backtest Train (kein echtes Geld)',
      paperPnl: 'Paper-PnL zu Marktpreisen (Binance Data API, kein Exchange-Order)',
      livePnl: 'Echtes Geld: noch nicht freigeschaltet',
    },
  };
}
