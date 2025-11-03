import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import TradingChart from './components/TradingChart'; // Import the new component

// --- Type Definitions ---
// This tells TypeScript what a 'Trade' object looks like
export interface Trade {
  id: number;
  created_at: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
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
        .order('created_at', { ascending: false }); // Get newest trades first

      if (error) {
        console.error('Error fetching trades:', error);
        setError('Could not fetch trade history.');
      } else {
        setTrades(data);
      }
    };

    fetchInitialTrades();

    // --- 2. Set up real-time subscription ---
    const subscription = supabase
      .channel('trades-channel')
      .on<Trade>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trades' },
        (payload) => {
          console.log('New trade received!', payload);
          // Add the new trade to the top of our list
          setTrades(currentTrades => [payload.new, ...currentTrades]);
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
        <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors">
          Stop Bot (Not-Aus)
        </button>
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
                  <th className="p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr key={trade.id} className={`border-t border-gray-700 ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                    <td className="p-2 uppercase font-bold">{trade.type}</td>
                    <td className="p-2">{trade.price.toFixed(2)}</td>
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
