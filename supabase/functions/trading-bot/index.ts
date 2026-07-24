// Import necessary libraries from Deno and Supabase
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Configuration ---
const SYMBOL = 'BTCUSDT';
const INTERVAL = '1m';
const SHORT_WINDOW = 10;
const LONG_WINDOW = 50;
const ORDER_QUANTITY = 0.001; // The amount of BTC to trade
const STOP_LOSS_PERCENTAGE = 0.01; // 1%
const TAKE_PROFIT_PERCENTAGE = 0.02; // 2%


// --- Binance API Helper Functions ---
async function createSignature(queryString: string, apiSecret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    console.log(`Binance order successful: ${side} ${quantity} ${symbol}`, data);
    return data;
}

async function fetchCurrentPrice(symbol: string): Promise<number> {
    // data-api.binance.vision is the public market-data endpoint and works from more regions
    // than api.binance.com (which is geo-restricted in some locations).
    const url = `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch current price for ${symbol}`);
    const data = await response.json();
    return parseFloat(data.price);
}


// --- Main Trading Bot Logic ---
async function runTradingLogic(supabase: SupabaseClient, apiKey: string, apiSecret: string) {
    // --- 1. Check for and Manage Open Positions ---
    const { data: openTrade, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'PGRST116' (No rows found)
        throw new Error(`Supabase fetch error: ${fetchError.message}`);
    }

    if (openTrade) {
        const currentPrice = await fetchCurrentPrice(SYMBOL);
        let shouldClose = false;
        let pnl = 0;
        const stopLoss = openTrade.stop_loss;
        const takeProfit = openTrade.take_profit;

        if (openTrade.type === 'buy') {
            pnl = (currentPrice - openTrade.price) * openTrade.quantity;
            if (
                (typeof stopLoss === 'number' && currentPrice <= stopLoss) ||
                (typeof takeProfit === 'number' && currentPrice >= takeProfit)
            ) {
                shouldClose = true;
            }
        } else { // sell
            pnl = (openTrade.price - currentPrice) * openTrade.quantity;
            if (
                (typeof stopLoss === 'number' && currentPrice >= stopLoss) ||
                (typeof takeProfit === 'number' && currentPrice <= takeProfit)
            ) {
                shouldClose = true;
            }
        }

        // Update PnL in real-time for UI
        const { error: pnlError } = await supabase.from('trades').update({ pnl }).eq('id', openTrade.id);
        if (pnlError) console.error('Failed to update open PnL:', pnlError.message);

        if (shouldClose) {
            console.log(`Closing position for ${SYMBOL} due to SL/TP hit.`);
            const closeSide = openTrade.type === 'buy' ? 'SELL' : 'BUY';
            await placeTestnetOrder(SYMBOL, closeSide, openTrade.quantity, apiKey, apiSecret);

            const { error: updateError } = await supabase
                .from('trades')
                .update({
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                    pnl // final pnl
                })
                .eq('id', openTrade.id);

            if (updateError) throw new Error(`Supabase update error: ${updateError.message}`);
            console.log(`Position closed. Final PnL: ${pnl}`);
            return `Position for ${SYMBOL} closed.`; // End execution after closing a trade
        } else {
            return `Holding open position for ${SYMBOL}. Current PnL: ${pnl}`;
        }
    }

    // --- 2. If No Open Position, Look for a New Signal ---
    const binanceUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${SYMBOL}&interval=${INTERVAL}&limit=${LONG_WINDOW + 5}`;
    const binanceResponse = await fetch(binanceUrl);
    if (!binanceResponse.ok) throw new Error(`Binance API error: ${binanceResponse.statusText}`);
    const klines = (await binanceResponse.json()) as Array<Array<string | number>>;
    const closePrices: number[] = klines.map((kline) => parseFloat(String(kline[4])));

    const calculateSMA = (prices: number[], window: number): number[] => {
        const sma: number[] = [];
        for (let i = 0; i <= prices.length - window; i++) {
            const windowSlice = prices.slice(i, i + window);
            sma.push(windowSlice.reduce((a, b) => a + b, 0) / window);
        }
        return sma;
    };

    const shortSMA = calculateSMA(closePrices, SHORT_WINDOW);
    const longSMA = calculateSMA(closePrices, LONG_WINDOW);

    if (shortSMA.length < 2 || longSMA.length < 2) throw new Error("Not enough data to calculate SMAs.");

    const lastShortSMA = shortSMA[shortSMA.length - 1];
    const prevShortSMA = shortSMA[shortSMA.length - 2];
    const lastLongSMA = longSMA[longSMA.length - 1];
    const prevLongSMA = longSMA[longSMA.length - 2];

    // Spot testnet cannot naked-short — only open long entries here.
    let signal: 'buy' | null = null;
    if (prevShortSMA <= prevLongSMA && lastShortSMA > lastLongSMA) signal = 'buy';
    else if (prevShortSMA >= prevLongSMA && lastShortSMA < lastLongSMA) {
        return 'Short signal ignored on spot testnet (long-only).';
    }

    if (!signal) {
        return 'No new signal detected. Holding.';
    }

    // --- 3. Execute New Trade and Open Position ---
    console.log(`New signal detected: ${signal.toUpperCase()} for ${SYMBOL}`);
    const order = await placeTestnetOrder(SYMBOL, 'BUY', ORDER_QUANTITY, apiKey, apiSecret);

    let entryPrice = closePrices[closePrices.length - 1];
    const fills = Array.isArray(order?.fills) ? order.fills as Array<{ price: string; qty: string }> : [];
    if (fills.length > 0) {
      let notional = 0;
      let qtySum = 0;
      for (const fill of fills) {
        const qty = parseFloat(fill.qty);
        notional += parseFloat(fill.price) * qty;
        qtySum += qty;
      }
      if (qtySum > 0) entryPrice = notional / qtySum;
    }
    const stopLoss = entryPrice * (1 - STOP_LOSS_PERCENTAGE);
    const takeProfit = entryPrice * (1 + TAKE_PROFIT_PERCENTAGE);

    const { error: insertError } = await supabase.from('trades').insert({
        symbol: SYMBOL,
        type: signal,
        price: entryPrice,
        quantity: ORDER_QUANTITY,
        status: 'open',
        stop_loss: stopLoss,
        take_profit: takeProfit,
    });

    if (insertError) throw new Error(`Supabase insert error: ${insertError.message}`);

    return `New position opened for ${SYMBOL} at ${entryPrice}.`;
}


// --- Edge Function Main Handler ---
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const binanceApiKey = Deno.env.get('BINANCE_API_KEY')!;
        const binanceApiSecret = Deno.env.get('BINANCE_SECRET_KEY')!;
        if (!binanceApiKey || !binanceApiSecret) {
            throw new Error("Binance API credentials are not set in Supabase environment variables.");
        }

        const message = await runTradingLogic(supabaseClient, binanceApiKey, binanceApiSecret);

        return new Response(JSON.stringify({ message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error("Error in Edge Function:", error);
        const message = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
