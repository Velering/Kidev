// Import necessary libraries from Deno and Supabase
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Helper function to create a signature for Binance API ---
async function createSignature(queryString: string, apiSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Function to place a real order on Binance Testnet ---
async function placeTestnetOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number, apiKey: string, apiSecret: string) {
  const endpoint = 'https://testnet.binance.vision/api/v3/order';
  const timestamp = Date.now();

  const params = new URLSearchParams({
    symbol,
    side,
    type: 'MARKET',
    quantity: quantity.toString(),
    timestamp: timestamp.toString(),
  });

  const queryString = params.toString();
  const signature = await createSignature(queryString, apiSecret);
  params.append('signature', signature);

  const url = `${endpoint}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-MBX-APIKEY': apiKey },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Binance Testnet API error: ${data.msg || response.statusText}`);
  }
  console.log('Binance order successful:', data);
  return data;
}

// --- Trading Bot Logic ---
async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Configuration ---
    const symbol = 'BTCUSDT';
    const interval = '1m';
    const shortWindow = 10;
    const longWindow = 50;

    // --- 1. Fetch Live Market Data from Binance ---
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${longWindow + 5}`;
    const binanceResponse = await fetch(binanceUrl);
    if (!binanceResponse.ok) throw new Error(`Binance API error: ${binanceResponse.statusText}`);
    const klines: any[] = await binanceResponse.json();
    const closePrices: number[] = klines.map(kline => parseFloat(kline[4]));

    // --- 2. Implement Trading Strategy ---
    const calculateSMA = (prices: number[], window: number): number[] => {
      const sma: number[] = [];
      for (let i = 0; i <= prices.length - window; i++) {
        const windowSlice = prices.slice(i, i + window);
        const sum = windowSlice.reduce((acc, val) => acc + val, 0);
        sma.push(sum / window);
      }
      return sma;
    };

    const shortSMA = calculateSMA(closePrices, shortWindow);
    const longSMA = calculateSMA(closePrices, longWindow);

    if(shortSMA.length < 2 || longSMA.length < 2) throw new Error("Not enough data to calculate SMAs.");

    const lastShortSMA = shortSMA[shortSMA.length - 1];
    const prevShortSMA = shortSMA[shortSMA.length - 2];
    const lastLongSMA = longSMA[longSMA.length - 1];
    const prevLongSMA = longSMA[longSMA.length - 2];

    let signal: 'buy' | 'sell' | null = null;
    if (prevShortSMA <= prevLongSMA && lastShortSMA > lastLongSMA) signal = 'buy';
    else if (prevShortSMA >= prevLongSMA && lastShortSMA < lastLongSMA) signal = 'sell';

    if (!signal) {
      return new Response(JSON.stringify({ message: 'No signal detected. Holding position.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 3. Get API Keys & Supabase client ---
    const binanceApiKey = Deno.env.get('BINANCE_API_KEY')!;
    const binanceApiSecret = Deno.env.get('BINANCE_SECRET_KEY')!;
    if (!binanceApiKey || !binanceApiSecret) {
      throw new Error("Binance API credentials are not set in Supabase environment variables.");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- 4. Prevent duplicate trades ---
    const { data: lastTrade } = await supabaseClient
      .from('trades')
      .select('type')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastTrade && lastTrade.type === signal) {
      return new Response(JSON.stringify({ message: `Signal is still '${signal}', but no new trade needed.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 5. Execute Live (Testnet) Trade ---
    const orderQuantity = 0.001; // The amount of BTC to trade
    await placeTestnetOrder(
      symbol,
      signal.toUpperCase() as 'BUY' | 'SELL',
      orderQuantity,
      binanceApiKey,
      binanceApiSecret
    );

    // --- 6. Record Successful Trade in Supabase ---
    const { error: insertError } = await supabaseClient
      .from('trades')
      .insert({
        symbol: symbol,
        type: signal,
        price: closePrices[closePrices.length - 1],
        quantity: orderQuantity,
      });

    if (insertError) throw new Error(`Supabase error inserting trade: ${insertError.message}`);

    return new Response(JSON.stringify({ message: `Live Testnet trade executed and recorded: ${signal.toUpperCase()}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
}

serve(handleRequest);
