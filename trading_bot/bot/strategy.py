import pandas as pd

def calculate_sma(data, window):
    """Calculates the Simple Moving Average (SMA)."""
    if not data or len(data) < window:
        return None

    # Create a DataFrame from the kline data
    df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume',
                                     'close_time', 'quote_asset_volume', 'number_of_trades',
                                     'taker_buy_base_asset_volume', 'taker_buy_quote_asset_volume', 'ignore'])

    # Convert 'close' prices to numeric, coercing errors
    df['close'] = pd.to_numeric(df['close'], errors='coerce')

    # Calculate SMA
    sma = df['close'].rolling(window=window).mean()
    return sma

def check_crossover(short_sma, long_sma):
    """
    Checks for a crossover between a short-term and long-term SMA.
    Returns 'buy' for a golden cross, 'sell' for a death cross, and None otherwise.
    """
    if short_sma is None or long_sma is None or len(short_sma) < 2 or len(long_sma) < 2:
        return None

    # Get the last two values of each SMA
    last_short = short_sma.iloc[-1]
    prev_short = short_sma.iloc[-2]

    last_long = long_sma.iloc[-1]
    prev_long = long_sma.iloc[-2]

    # Golden Cross: short-term SMA crosses above long-term SMA
    if prev_short <= prev_long and last_short > last_long:
        return 'buy'

    # Death Cross: short-term SMA crosses below long-term SMA
    elif prev_short >= prev_long and last_short < last_long:
        return 'sell'

    return None
