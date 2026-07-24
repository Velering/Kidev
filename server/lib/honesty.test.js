import { describe, expect, it } from 'vitest';
import { computeHonesty } from './honesty.js';

const baseOnline = {
  closedTrades: 0,
  wins: 0,
  losses: 0,
  realizedPnlPct: 0,
  edgeOk: false,
};

describe('computeHonesty', () => {
  it('rejects overfitting train-/validation split', () => {
    const result = computeHonesty(
      {
        generation: 3,
        train: {
          netPnlPct: -1.5,
          profitFactor: 0.4,
          tradeCount: 18,
          expectancy: -0.001,
          maxDrawdownPct: 1.5,
        },
        validation: {
          netPnlPct: 0.2,
          profitFactor: 2.0,
          tradeCount: 8,
          expectancy: 0.0002,
          maxDrawdownPct: 0.2,
        },
        online: baseOnline,
      },
      { candleCount: 3000 },
    );

    expect(result.readyForPaper).toBe(false);
    expect(result.readyForLive).toBe(false);
    expect(result.confidence).toBeLessThan(55);
    expect(result.reasons.some((r) => /Overfitting/i.test(r))).toBe(true);
  });

  it('allows paper only with consistent profitable train+validation', () => {
    const result = computeHonesty(
      {
        generation: 20,
        train: {
          netPnlPct: 1.2,
          profitFactor: 1.4,
          tradeCount: 20,
          expectancy: 0.0006,
          maxDrawdownPct: 1.0,
        },
        validation: {
          netPnlPct: 0.9,
          profitFactor: 1.5,
          tradeCount: 12,
          expectancy: 0.0005,
          maxDrawdownPct: 0.8,
        },
        online: baseOnline,
      },
      { candleCount: 3000 },
    );

    expect(result.readyForPaper).toBe(true);
    expect(result.readyForLive).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(55);
  });

  it('never marks live-ready without paper sample', () => {
    const result = computeHonesty(
      {
        generation: 40,
        train: {
          netPnlPct: 2,
          profitFactor: 1.8,
          tradeCount: 30,
          expectancy: 0.001,
          maxDrawdownPct: 1,
        },
        validation: {
          netPnlPct: 1.5,
          profitFactor: 1.7,
          tradeCount: 20,
          expectancy: 0.0008,
          maxDrawdownPct: 0.9,
        },
        online: baseOnline,
      },
      { candleCount: 3000, closedPaperTrades: 0, paperPnlUsdt: 0 },
    );
    expect(result.readyForLive).toBe(false);
  });
});
