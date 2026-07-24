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
  pnl_pct?: number;
  closed_at?: string;
  reason?: string;
  generation?: number;
}

interface HonestyInfo {
  confidence: number;
  progress: number;
  phase: string;
  readyForPaper: boolean;
  readyForLive: boolean;
  reasons: string[];
  labels: Record<string, string>;
}

interface LearningInfo {
  generation: number;
  learnedAt: string | null;
  message: string;
  lastBotMessage?: string;
  edgeOk: boolean;
  params: Record<string, number>;
  train: null | {
    netPnlPct: number;
    winRate: number;
    profitFactor: number;
    expectancy: number;
    tradeCount: number;
    score: number;
  };
  validation: null | {
    netPnlPct: number;
    winRate: number;
    profitFactor: number;
    expectancy: number;
    tradeCount: number;
    score: number;
    maxDrawdownPct?: number;
  };
  online: {
    closedTrades: number;
    wins: number;
    losses: number;
    realizedPnlPct: number;
    edgeOk: boolean;
  };
  honesty?: HonestyInfo;
  paperPnlUsdt?: number;
  candleCount?: number;
  marketSource?: string;
  disclaimer?: string;
}

interface Stats {
  openPositions: number;
  closedTrades: number;
  winRate: number;
  realizedPnl: number;
  paperPnlUsdt?: number;
  mode: string;
  confidence?: number;
  progress?: number;
  readyForLive?: boolean;
}

function pct(n: number | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * (Math.abs(n) <= 1.5 ? 100 : 1)).toFixed(digits)}%`;
}

function Meter({ label, value, hint }: { label: string; value: number; hint: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone =
    clamped >= 70 ? 'bg-green-500' : clamped >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-mono text-white">{clamped}%</span>
      </div>
      <div className="h-2 rounded bg-gray-700 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [learning, setLearning] = useState<LearningInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [tradesRes, learningRes, statsRes] = await Promise.all([
          fetch('/api/trades'),
          fetch('/api/learning'),
          fetch('/api/stats'),
        ]);
        if (!tradesRes.ok || !learningRes.ok || !statsRes.ok) {
          throw new Error('API unavailable');
        }
        const [tradesData, learningData, statsData] = await Promise.all([
          tradesRes.json(),
          learningRes.json(),
          statsRes.json(),
        ]);
        if (cancelled) return;
        setTrades(tradesData as Trade[]);
        setLearning(learningData as LearningInfo);
        setStats(statsData as Stats);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Bot-API nicht erreichbar.');
      }
    };

    load();
    const id = window.setInterval(load, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const honesty = learning?.honesty;
  const progress = honesty?.progress ?? stats?.progress ?? 0;
  const confidence = honesty?.confidence ?? stats?.confidence ?? 0;
  const paperPnl = learning?.paperPnlUsdt ?? stats?.paperPnlUsdt ?? stats?.realizedPnl ?? 0;
  const mode = honesty?.readyForPaper
    ? 'Paper-Trading'
    : honesty?.phase === 'weak_edge'
      ? 'Schwacher Edge — weiter lernen'
      : 'Lernen';
  const modeColor = honesty?.readyForPaper
    ? 'bg-green-500'
    : honesty?.phase === 'weak_edge'
      ? 'bg-yellow-500'
      : 'bg-orange-500';

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      <header className="p-4 border-b border-gray-700 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kidev Learning Bot</h1>
          <p className="text-xs text-gray-500 mt-1">
            Echter BTC/USDT-Markt (Binance Data API) · gespeichert in data/ · kein Fake-Profit
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${modeColor}`} />
          <span>
            {mode}
            {learning ? ` · Gen ${learning.generation}` : ''}
          </span>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <Meter
              label="Fortschritt"
              value={progress}
              hint="Generationen + Marktdaten + Confidence (kein Gewinnversprechen)"
            />
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <Meter
              label="Strategie-Sicherheit"
              value={confidence}
              hint="Nur hoch bei Train+Validation konsistent und genug Trades"
            />
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-300 mb-1">Paper-Gewinn (USDT)</p>
            <p
              className={`text-2xl font-mono ${
                paperPnl > 0 ? 'text-green-400' : paperPnl < 0 ? 'text-red-400' : 'text-gray-300'
              }`}
            >
              {paperPnl.toFixed(4)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Nur geschlossene Paper-Trades zu Marktpreisen. Backtest zählt hier nicht.
              {honesty?.readyForLive ? '' : ' Echtes Geld: noch gesperrt.'}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h2 className="text-xl mb-4">BTC/USDT Chart</h2>
            <TradingChart trades={trades} />
          </div>

          <div className="space-y-4">
            <section className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h2 className="text-xl mb-3">Lernen (ehrlich)</h2>
              {learning ? (
                <div className="space-y-2 text-sm text-gray-300">
                  <p className={honesty?.readyForPaper ? 'text-green-400' : 'text-yellow-300'}>
                    {learning.message}
                  </p>
                  {learning.lastBotMessage && (
                    <p className="text-gray-400 font-mono text-xs break-words">
                      Bot: {learning.lastBotMessage}
                    </p>
                  )}
                  <p>
                    Backtest Train:{' '}
                    <span className="font-mono text-white">
                      {learning.train ? `${learning.train.netPnlPct.toFixed(2)}%` : '—'}
                    </span>
                    {' · '}
                    Validation:{' '}
                    <span className="font-mono text-white">
                      {learning.validation ? `${learning.validation.netPnlPct.toFixed(2)}%` : '—'}
                    </span>
                  </p>
                  <p className="text-xs text-amber-400/90">
                    Backtest ≠ echtes Geld. Validation kann überfitten, wenn Train negativ ist.
                  </p>
                  <p>
                    PF {learning.validation?.profitFactor.toFixed(2) ?? '—'} · WR{' '}
                    {learning.validation ? pct(learning.validation.winRate, 0) : '—'} · Kerzen{' '}
                    {learning.candleCount ?? '—'}
                  </p>
                  <p className="text-gray-400">
                    Params: EMA {learning.params.shortEma}/{learning.params.longEma}, RSI{' '}
                    {learning.params.rsiPeriod}, SL×{learning.params.atrSlMult}, TP×
                    {learning.params.atrTpMult}
                  </p>
                  {stats && (
                    <p>
                      Paper closed: {stats.closedTrades} · WR {pct(stats.winRate, 0)} · Open{' '}
                      {stats.openPositions}
                    </p>
                  )}
                  {honesty?.reasons?.slice(0, 3).map((r) => (
                    <p key={r} className="text-xs text-gray-500">
                      · {r}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Learner startet…</p>
              )}
            </section>

            <section className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h2 className="text-xl mb-3">Trade History</h2>
              {error && <p className="text-amber-400 mb-3 text-sm">{error}</p>}
              <div className="overflow-y-auto h-72">
                <table className="w-full text-left text-sm">
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
                    {trades.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-gray-400">
                          Noch keine Paper-Trades. Der Bot lernt weiter und handelt erst bei
                          ausreichender Confidence.
                        </td>
                      </tr>
                    )}
                    {trades.map((trade) => (
                      <tr
                        key={trade.id}
                        className={`border-t border-gray-700 ${trade.status === 'open' ? 'bg-blue-900/30' : ''}`}
                      >
                        <td
                          className={`p-2 uppercase font-bold ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {trade.type}
                        </td>
                        <td className="p-2">{trade.price.toFixed(2)}</td>
                        <td
                          className={`p-2 ${trade.status === 'open' ? 'text-yellow-400' : 'text-gray-400'}`}
                        >
                          {trade.status}
                        </td>
                        <td
                          className={`p-2 font-mono ${
                            trade.pnl == null || trade.pnl === 0
                              ? 'text-gray-500'
                              : trade.pnl > 0
                                ? 'text-green-500'
                                : 'text-red-500'
                          }`}
                        >
                          {trade.pnl != null ? trade.pnl.toFixed(4) : 'N/A'}
                        </td>
                        <td className="p-2 text-gray-400">
                          {new Date(trade.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
