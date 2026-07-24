import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decideEntry,
  learnFromCandles,
  loadLearningState,
  recordOnlineTrade,
  saveLearningState,
} from './lib/learner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const LEARNING_FILE = path.join(DATA_DIR, 'learning.json');

const PORT = Number(process.env.PORT || 4173);
const SYMBOL = 'BTCUSDT';
const INTERVAL = '1m';
const ORDER_QUANTITY = 0.001;
const BINANCE_DATA_API = 'https://data-api.binance.vision/api/v3';
const KLINE_LIMIT = 3000;

/** @typedef {{
 *  id: number,
 *  created_at: string,
 *  symbol: string,
 *  type: 'buy' | 'sell',
 *  price: number,
 *  quantity: number,
 *  status: 'open' | 'closed',
 *  stop_loss?: number,
 *  take_profit?: number,
 *  pnl?: number,
 *  pnl_pct?: number,
 *  closed_at?: string,
 *  reason?: string,
 *  generation?: number
 * }} Trade */

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TRADES_FILE)) {
    fs.writeFileSync(TRADES_FILE, JSON.stringify({ nextId: 1, trades: [] }, null, 2));
  }
}

function readStore() {
  ensureDirs();
  return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
}

function writeStore(store) {
  ensureDirs();
  fs.writeFileSync(TRADES_FILE, JSON.stringify(store, null, 2));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`);
  return response.json();
}

async function fetchCandles(limit = KLINE_LIMIT) {
  // Paginate backwards to assemble a deeper history than the single-request cap.
  const pages = Math.max(1, Math.ceil(limit / 1000));
  /** @type {any[]} */
  let all = [];
  /** @type {number | undefined} */
  let endTime;

  for (let p = 0; p < pages; p++) {
    const qs = new URLSearchParams({
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: '1000',
    });
    if (endTime) qs.set('endTime', String(endTime));
    const raw = await fetchJson(`${BINANCE_DATA_API}/klines?${qs}`);
    if (!Array.isArray(raw) || raw.length === 0) break;
    all = raw.concat(all);
    endTime = raw[0][0] - 1;
    if (raw.length < 1000) break;
  }

  // De-dupe by open time and keep the most recent `limit` bars.
  const byTime = new Map();
  for (const k of all) byTime.set(k[0], k);
  const merged = [...byTime.values()].sort((a, b) => a[0] - b[0]).slice(-limit);

  return merged.map((k) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchCurrentPrice() {
  const data = await fetchJson(`${BINANCE_DATA_API}/ticker/price?symbol=${SYMBOL}`);
  return parseFloat(data.price);
}

/** @type {ReturnType<typeof loadLearningState>} */
let learning = loadLearningState(LEARNING_FILE);
let lastLearnMessage = 'Booting learner…';
let learningInProgress = false;

async function runLearningCycle(candidates = 120) {
  if (learningInProgress) return learning;
  learningInProgress = true;
  try {
    const candles = await fetchCandles();
    learning = learnFromCandles(candles, learning, { candidates });
    saveLearningState(LEARNING_FILE, learning);
    if (learning.online.edgeOk && learning.validation) {
      lastLearnMessage = `Gen ${learning.generation}: edge OK — val PnL ${learning.validation.netPnlPct.toFixed(2)}%, PF ${learning.validation.profitFactor.toFixed(2)}, WR ${(learning.validation.winRate * 100).toFixed(0)}%`;
    } else {
      lastLearnMessage = `Gen ${learning.generation}: noch kein validierter Edge — weiter lernen…`;
    }
    console.log(`[learn] ${lastLearnMessage}`);
    return learning;
  } finally {
    learningInProgress = false;
  }
}

async function manageOpenPosition(store, currentPrice, candles) {
  const openTrade = store.trades.find((t) => t.status === 'open');
  if (!openTrade) return null;

  const last = candles[candles.length - 1];
  let pnl = 0;
  let shouldClose = false;
  let reason = '';

  if (openTrade.type === 'buy') {
    pnl = (currentPrice - openTrade.price) * openTrade.quantity;
    if (last.low <= (openTrade.stop_loss ?? -Infinity)) {
      shouldClose = true;
      reason = 'stop_loss';
      pnl = ((openTrade.stop_loss ?? currentPrice) - openTrade.price) * openTrade.quantity;
    } else if (last.high >= (openTrade.take_profit ?? Infinity)) {
      shouldClose = true;
      reason = 'take_profit';
      pnl = ((openTrade.take_profit ?? currentPrice) - openTrade.price) * openTrade.quantity;
    }
  } else {
    pnl = (openTrade.price - currentPrice) * openTrade.quantity;
    if (last.high >= (openTrade.stop_loss ?? Infinity)) {
      shouldClose = true;
      reason = 'stop_loss';
      pnl = (openTrade.price - (openTrade.stop_loss ?? currentPrice)) * openTrade.quantity;
    } else if (last.low <= (openTrade.take_profit ?? -Infinity)) {
      shouldClose = true;
      reason = 'take_profit';
      pnl = (openTrade.price - (openTrade.take_profit ?? currentPrice)) * openTrade.quantity;
    }
  }

  openTrade.pnl = pnl;
  openTrade.pnl_pct = pnl / (openTrade.price * openTrade.quantity);

  if (shouldClose) {
    openTrade.status = 'closed';
    openTrade.closed_at = new Date().toISOString();
    openTrade.reason = reason;
    learning = recordOnlineTrade(learning, openTrade.pnl_pct);
    saveLearningState(LEARNING_FILE, learning);
    writeStore(store);
    return `Closed ${openTrade.type} via ${reason}. PnL=${pnl.toFixed(4)} (${(openTrade.pnl_pct * 100).toFixed(3)}%)`;
  }

  writeStore(store);
  return `Holding ${openTrade.type}. unrealized=${pnl.toFixed(4)}`;
}

async function runTradingLogic() {
  const candles = await fetchCandles();
  const currentPrice = candles[candles.length - 1].close;
  const store = readStore();

  const openMsg = await manageOpenPosition(store, currentPrice, candles);
  if (openMsg) return openMsg;

  const decision = decideEntry(candles, learning);
  if (!decision.signal || decision.stop == null || decision.take == null) {
    return `No trade: ${decision.reason}`;
  }

  /** @type {Trade} */
  const trade = {
    id: store.nextId++,
    created_at: new Date().toISOString(),
    symbol: SYMBOL,
    type: decision.signal,
    price: decision.price,
    quantity: ORDER_QUANTITY,
    status: 'open',
    stop_loss: decision.stop,
    take_profit: decision.take,
    pnl: 0,
    pnl_pct: 0,
    reason: decision.reason,
    generation: learning.generation,
  };

  store.trades.unshift(trade);
  writeStore(store);
  return `Opened ${decision.signal} @ ${decision.price.toFixed(2)} (gen ${learning.generation}, ${decision.reason})`;
}

function publicLearning() {
  return {
    generation: learning.generation,
    learnedAt: learning.learnedAt,
    message: lastLearnMessage,
    edgeOk: learning.online.edgeOk,
    params: learning.params,
    train: learning.train,
    validation: learning.validation,
    online: learning.online,
    history: learning.history.slice(0, 10),
  };
}

function publicStats(trades) {
  const closed = trades.filter((t) => t.status === 'closed');
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const totalPnl = closed.reduce((a, t) => a + (t.pnl ?? 0), 0);
  return {
    openPositions: trades.filter((t) => t.status === 'open').length,
    closedTrades: closed.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    realizedPnl: totalPnl,
    mode: learning.online.edgeOk ? 'live_edge' : 'learning',
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (url.startsWith('/api/health')) {
    sendJson(res, 200, {
      ok: true,
      symbol: SYMBOL,
      mode: learning.online.edgeOk ? 'live_edge' : 'learning',
      generation: learning.generation,
    });
    return;
  }

  if (url.startsWith('/api/learning')) {
    sendJson(res, 200, publicLearning());
    return;
  }

  if (url.startsWith('/api/stats')) {
    sendJson(res, 200, publicStats(readStore().trades));
    return;
  }

  if (url.startsWith('/api/trades')) {
    sendJson(res, 200, readStore().trades);
    return;
  }

  if (url.startsWith('/api/learn') && req.method === 'POST') {
    try {
      await runLearningCycle();
      sendJson(res, 200, publicLearning());
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (url.startsWith('/api/bot/run') && req.method === 'POST') {
    try {
      const message = await runTradingLogic();
      sendJson(res, 200, { message, trades: readStore().trades, learning: publicLearning() });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  serveStatic(req, res);
});

// Clear fake seed trades from earlier demo fix — learner should earn its history.
ensureDirs();
{
  const store = readStore();
  const looksSeeded =
    store.trades.length > 0 &&
    store.trades.every((t) => t.generation == null && t.reason == null);
  if (looksSeeded) {
    writeStore({ nextId: 1, trades: [] });
    console.log('[boot] Cleared seeded demo trades — learning from market data instead.');
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kidev learning bot on http://0.0.0.0:${PORT}`);
});

// Learn several generations at boot, then trade only with validated edge.
(async () => {
  try {
    for (let i = 0; i < 5; i++) {
      await runLearningCycle(160);
      if (learning.online.edgeOk) break;
    }
    const msg = await runTradingLogic();
    console.log(`[bot] ${msg}`);
  } catch (error) {
    console.error('[boot] failed:', error);
  }
})();

setInterval(() => {
  runLearningCycle().catch((error) => console.error('[learn] cycle failed:', error));
}, 15 * 60_000);

setInterval(() => {
  runTradingLogic()
    .then((message) => console.log(`[bot] ${message}`))
    .catch((error) => console.error('[bot] tick failed:', error));
}, 60_000);
