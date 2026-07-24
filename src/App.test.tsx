import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from './App';

vi.mock('./components/TradingChart', () => ({
  default: () => <div data-testid="mock-chart">Mock Trading Chart</div>,
}));

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );
  });

  it('renders the dashboard title and the chart component', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Kidev Trading Bot/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
    expect(await screen.findByText('Live')).toBeInTheDocument();
  });
});
