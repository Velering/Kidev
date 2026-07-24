import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/TradingChart', () => ({
  default: () => <div data-testid="mock-chart">Mock Trading Chart</div>,
}));

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/trades')) {
          return { ok: true, json: async () => [] };
        }
        if (url.includes('/api/learning')) {
          return {
            ok: true,
            json: async () => ({
              generation: 1,
              learnedAt: new Date().toISOString(),
              message: 'Gen 1: noch kein validierter Edge — weiter lernen…',
              edgeOk: false,
              params: {
                shortEma: 9,
                longEma: 21,
                rsiPeriod: 14,
                rsiBuyMax: 55,
                rsiSellMin: 45,
                atrPeriod: 14,
                atrSlMult: 1.5,
                atrTpMult: 2.5,
                minSepPct: 0.0005,
              },
              train: null,
              validation: null,
              online: {
                closedTrades: 0,
                wins: 0,
                losses: 0,
                realizedPnlPct: 0,
                edgeOk: false,
              },
            }),
          };
        }
        if (url.includes('/api/stats')) {
          return {
            ok: true,
            json: async () => ({
              openPositions: 0,
              closedTrades: 0,
              winRate: 0,
              realizedPnl: 0,
              mode: 'learning',
            }),
          };
        }
        return { ok: false, json: async () => ({}) };
      }),
    );
  });

  it('renders learning bot dashboard', async () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Kidev Learning Bot/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
    expect(
      await screen.findByText(/noch kein validierter Edge|edge OK/i),
    ).toBeInTheDocument();
  });
});
