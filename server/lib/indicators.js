/** Technical indicators used by the learning bot. */

/**
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function sma(values, period) {
  const out = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function ema(values, period) {
  const out = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * @param {number[]} closes
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function rsi(closes, period = 14) {
  const out = Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/**
 * Average True Range.
 * @param {{ high: number, low: number, close: number }[]} candles
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function atr(candles, period = 14) {
  const out = Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  const trs = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trs[i];
  let prev = sum / period;
  out[period] = prev;

  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period;
    out[i] = prev;
  }
  return out;
}
