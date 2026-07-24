import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');

const PORT = Number(process.env.PORT || 4173);
const SYMBOL = 'BTCUSDT';
const INTERVAL = '1m';
const SHORT_WINDOW = 10;
const LONG_WINDOW = 50;
const ORDER_QUANTITY = 0.001;
const STOP_LOSS_PERCENTAGE = 0.01;
const TAKE_PROFIT_PERCENTAGE = 0.02;
const BINANCE_DATA_API = 'https://data-api.binance.vision/api/v3';

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
 *  closed_at?: string
 * }} Trade */

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TRADES_FILE)) {
    fs.writeFileSync(TRADES_FILE, JSON.stringify({ nextId: 1, trades: [] }, null, 2));
  }
}

/** @returns {{ nextId: number, trades: Trade[] }} */
function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
}

/** @param {{ nextId: number, trades: Trade[] }} store */
function writeStore(store) {
  ensureStore();
  fs.writeFileSync(TRADES_FILE, JSON.stringify(store, null, 2));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`);
  return response.json();
}

async function fetchCurrentPrice() {
  const data = await fetchJson(`${BINANCE_DATA_API}/ticker/price?symbol=${SYMBOL}`);
  return parseFloat(data.price);
}

function calculateSMA(prices, window) {
  const sma = [];
  for (let i = 0; i <= prices.length - window; i++) {
    const slice = prices.slice(i, i + window);
    sma.push(slice.reduce((a, b) => a + b, 0) / window);
  }
  return sma;
}

async function runTradingLogic() {
  const store = readStore();
  const openTrade = store.trades.find((t) => t.status === 'open');
  const currentPrice = await fetchCurrentPrice();

  if (openTrade) {
    let pnl = 0;
    let shouldClose = false;

    if (openTrade.type === 'buy') {
      pnl = (currentPrice - openTrade.price) * openTrade.quantity;
      if (
        (openTrade.stop_loss != null && currentPrice <= openTrade.stop_loss) ||
        (openTrade.take_profit != null && currentPrice >= openTrade.take_profit)
      ) {
        shouldClose = true;
      }
    } else {
      pnl = (openTrade.price - currentPrice) * openTrade.quantity;
      if (
        (openTrade.stop_loss != null && currentPrice >= openTrade.stop_loss) ||
        (openTrade.take_profit != null && currentPrice <= openTrade.take_profit)
      ) {
        shouldClose = true;
      }
    }

    openTrade.pnl = pnl;
    if (shouldClose) {
      openTrade.status = 'closed';
      openTrade.closed_at = new Date().toISOString();
      writeStore(store);
      return `Closed ${openTrade.type} @ ${currentPrice}. PnL=${pnl.toFixed(4)}`;
    }

    writeStore(store);
    return `Holding ${openTrade.type}. PnL=${pnl.toFixed(4)}`;
  }

  const klines = await fetchJson(
    `${BINANCE_DATA_API}/klines?symbol=${SYMBOL}&interval=${INTERVAL}&limit=${LONG_WINDOW + 5}`,
  );
  const closePrices = klines.map((k) => parseFloat(k[4]));
  const shortSMA = calculateSMA(closePrices, SHORT_WINDOW);
  const longSMA = calculateSMA(closePrices, LONG_WINDOW);

  if (shortSMA.length < 2 || longSMA.length < 2) {
    return 'Not enough SMA data yet.';
  }

  const lastShort = shortSMA[shortSMA.length - 1];
  const prevShort = shortSMA[shortSMA.length - 2];
  const lastLong = longSMA[longSMA.length - 1];
  const prevLong = longSMA[longSMA.length - 2];

  /** @type {'buy' | 'sell' | null} */
  let signal = null;
  if (prevShort <= prevLong && lastShort > lastLong) signal = 'buy';
  else if (prevShort >= prevLong && lastShort < lastLong) signal = 'sell';

  if (!signal) return 'No signal. Holding.';

  const entryPrice = closePrices[closePrices.length - 1];
  const stopLoss =
    signal === 'buy'
      ? entryPrice * (1 - STOP_LOSS_PERCENTAGE)
      : entryPrice * (1 + STOP_LOSS_PERCENTAGE);
  const takeProfit =
    signal === 'buy'
      ? entryPrice * (1 + TAKE_PROFIT_PERCENTAGE)
      : entryPrice * (1 - TAKE_PROFIT_PERCENTAGE);

  /** @type {Trade} */
  const trade = {
    id: store.nextId++,
    created_at: new Date().toISOString(),
    symbol: SYMBOL,
    type: signal,
    price: entryPrice,
    quantity: ORDER_QUANTITY,
    status: 'open',
    stop_loss: stopLoss,
    take_profit: takeProfit,
    pnl: 0,
  };

  store.trades.unshift(trade);
  writeStore(store);
  return `Opened ${signal} @ ${entryPrice}`;
}

async function seedIfEmpty() {
  const store = readStore();
  if (store.trades.length > 0) return;

  try {
    const price = await fetchCurrentPrice();
    const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

    const closedBuy = {
      id: store.nextId++,
      created_at: minutesAgo(25),
      symbol: SYMBOL,
      type: /** @type {'buy'} */ ('buy'),
      price: price * 0.998,
      quantity: ORDER_QUANTITY,
      status: /** @type {'closed'} */ ('closed'),
      stop_loss: price * 0.988,
      take_profit: price * 1.018,
      pnl: (price - price * 0.998) * ORDER_QUANTITY,
      closed_at: minutesAgo(12),
    };

    const openSell = {
      id: store.nextId++,
      created_at: minutesAgo(8),
      symbol: SYMBOL,
      type: /** @type {'sell'} */ ('sell'),
      price: price * 1.001,
      quantity: ORDER_QUANTITY,
      status: /** @type {'open'} */ ('open'),
      stop_loss: price * 1.011,
      take_profit: price * 0.981,
      pnl: (price * 1.001 - price) * ORDER_QUANTITY,
    };

    store.trades = [openSell, closedBuy];
    writeStore(store);
    console.log(`Seeded ${store.trades.length} paper trades at ~${price}`);
  } catch (error) {
    console.error('Seed failed:', error);
  }
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
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
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
    sendJson(res, 200, { ok: true, mode: 'paper', symbol: SYMBOL });
    return;
  }

  if (url.startsWith('/api/trades')) {
    const store = readStore();
    sendJson(res, 200, store.trades);
    return;
  }

  if (url.startsWith('/api/bot/run') && req.method === 'POST') {
    try {
      const message = await runTradingLogic();
      sendJson(res, 200, { message, trades: readStore().trades });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  serveStatic(req, res);
});

await seedIfEmpty();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kidev paper-trading server on http://0.0.0.0:${PORT}`);
});

// Keep open positions' PnL fresh and look for new SMA signals.
const tick = async () => {
  try {
    const message = await runTradingLogic();
    console.log(`[bot] ${message}`);
  } catch (error) {
    console.error('[bot] tick failed:', error);
  }
};

setTimeout(tick, 3_000);
setInterval(tick, 60_000);
