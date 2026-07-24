import { useEffect, useState } from 'react';
import TradingChart from './components/TradingChart';

export interface Trade {
  id: number;
  created_at: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  status: 'open' | 'closed';
  stop_loss?: number;
  take_profit?: number;
  pnl?: number;
  closed_at?: string;
}

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'live' | 'error'>('live');

  useEffect(() => {
    let cancelled = false;

    const loadTrades = async () => {
      try {
        const response = await fetch('/api/trades');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as Trade[];
        if (cancelled) return;
        setTrades(data);
        setConnectionStatus('live');
        setError(null);
      } catch (err) {
        console.error('Error fetching trades:', err);
        if (cancelled) return;
        setConnectionStatus('error');
        setError('Trade-Historie konnte nicht geladen werden. Chart bleibt verfügbar.');
      }
    };

    loadTrades();
    const intervalId = window.setInterval(loadTrades, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const statusLabel = connectionStatus === 'live' ? 'Live' : 'Offline';
  const statusColor = connectionStatus === 'live' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      <header className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Kidev Trading Bot</h1>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span>{statusLabel}</span>
        </div>
      </header>

      <main className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h2 className="text-xl mb-4">BTC/USDT Chart</h2>
          <TradingChart trades={trades} />
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h2 className="text-xl mb-4">Trade History</h2>
          {error && <p className="text-amber-400 mb-3 text-sm">{error}</p>}
          <div className="overflow-y-auto h-96">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-800">
                <tr>
                  <th className="p-2">Type</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">PnL</th>
                  <th className="p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 && !error && (
                  <tr>
                    <td colSpan={5} className="p-4 text-gray-400 text-sm">
                      Noch keine Trades. Der Bot sucht nach SMA-Signalen…
                    </td>
                  </tr>
                )}
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className={`border-t border-gray-700 ${trade.status === 'open' ? 'bg-blue-900 bg-opacity-30' : ''}`}
                  >
                    <td
                      className={`p-2 uppercase font-bold ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {trade.type}
                    </td>
                    <td className="p-2">{trade.price.toFixed(2)}</td>
                    <td
                      className={`p-2 font-semibold ${trade.status === 'open' ? 'text-yellow-400' : 'text-gray-400'}`}
                    >
                      {trade.status}
                    </td>
                    <td
                      className={`p-2 font-mono ${trade.pnl == null ? 'text-gray-500' : trade.pnl > 0 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {trade.pnl != null ? trade.pnl.toFixed(4) : 'N/A'}
                    </td>
                    <td className="p-2 text-gray-400 text-sm">
                      {new Date(trade.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
