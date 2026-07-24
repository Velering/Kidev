import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/TradingChart', () => ({
  default: () => <div data-testid="mock-chart">Mock Trading Chart</div>,
}));

describe('App', () => {
  it('renders the dashboard title and the chart component', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Kidev Trading Bot/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
  });
});
