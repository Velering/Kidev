import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import TradingChart from './components/TradingChart';

// --- Type Definitions ---
// Erweitert, um die neuen Felder aus der Datenbank aufzunehmen
export interface Trade {
  id: number;
  created_at: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  status: 'open' | 'closed'; // Neu
  stop_loss?: number;       // Neu
  take_profit?: number;      // Neu
  pnl?: number;              // Neu (Profit and Loss)
  closed_at?: string;        // Neu
}

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // --- 1. Fetch initial data ---
    const fetchInitialTrades = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trades:', error);
        setError('Could not fetch trade history.');
      } else {
        setTrades(data as Trade[]);
      }
    };

    fetchInitialTrades();

    // --- 2. Set up real-time subscription for INSERTS and UPDATES ---
    const subscription = supabase
      .channel('trades-channel-updates')
      .on<Trade>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades' }, // Hört auf alle Änderungen
        (payload) => {
          console.log('Change received!', payload);

          if (payload.eventType === 'INSERT') {
            // Füge neuen Trade oben hinzu
            setTrades(currentTrades => [payload.new, ...currentTrades]);
          } else if (payload.eventType === 'UPDATE') {
            // Finde und aktualisiere den bestehenden Trade in der Liste
            setTrades(currentTrades =>
              currentTrades.map(trade =>
                trade.id === payload.new.id ? payload.new : trade
              )
            );
          }
        }
      )
      .subscribe();

    // --- 3. Clean up subscription on component unmount ---
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      {/* Header */}
      <header className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Trading Bot Dashboard</h1>
        {/* Optional: Add a status indicator here later */}
      </header>

      <main className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h2 className="text-xl mb-4">BTC/USDT Chart</h2>
          <TradingChart trades={trades} />
        </div>

        {/* Trade History */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h2 className="text-xl mb-4">Trade History</h2>
          {error && <p className="text-red-500">{error}</p>}
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
                {trades.map(trade => (
                  <tr key={trade.id} className={`border-t border-gray-700 ${trade.status === 'open' ? 'bg-blue-900 bg-opacity-30' : ''}`}>
                    <td className={`p-2 uppercase font-bold ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{trade.type}</td>
                    <td className="p-2">{trade.price.toFixed(2)}</td>
                    <td className={`p-2 font-semibold ${trade.status === 'open' ? 'text-yellow-400' : 'text-gray-400'}`}>{trade.status}</td>
                    <td className={`p-2 font-mono ${!trade.pnl ? 'text-gray-500' : trade.pnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.pnl ? trade.pnl.toFixed(4) : 'N/A'}
                    </td>
                    <td className="p-2 text-gray-400 text-sm">{new Date(trade.created_at).toLocaleTimeString()}</td>
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
