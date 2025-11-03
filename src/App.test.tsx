// src/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, vi } from 'vitest';
import App from './App';

// --- Mock the TradingChart component ---
// We replace the real TradingChart with a simple placeholder for this test.
// This prevents errors because the chart library needs a real browser to work.
vi.mock('./components/TradingChart', () => ({
  // The 'default' export of the module is the component itself
  default: () => <div data-testid="mock-chart">Mock Trading Chart</div>,
}));

describe('App', () => {
  it('renders the dashboard title and the chart component', () => {
    // Render the App component
    render(<App />);

    // Check if the main heading is in the document
    expect(screen.getByRole('heading', { level: 1, name: /Trading Bot Dashboard/i })).toBeInTheDocument();

    // Check if our mock chart placeholder is rendered
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
  });
});
