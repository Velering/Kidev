import time
import json
from binance.client import Client
from .. import config
from . import strategy

# The status file will be created in the root directory when running as a module
STATUS_FILE = 'bot_status.json'

def get_binance_client():
    """Initializes and returns the Binance client."""
    api_key = config.API_KEY
    api_secret = config.API_SECRET

    if not api_key or not api_secret or "YOUR_API_KEY" in api_key:
        raise ValueError("Binance API Key and Secret must be set in the .env file.")

    # Use testnet=True for demo accounts
    client = Client(api_key, api_secret, testnet=True)
    return client

def get_account_info(client):
    """Fetches and returns account information."""
    try:
        account_info = client.get_account()
        return account_info
    except Exception as e:
        print(f"An error occurred fetching account info: {e}")
        return None

def get_historical_data(client, symbol, interval, lookback):
    """Fetches historical kline/candlestick data."""
    try:
        klines = client.get_historical_klines(symbol, interval, lookback)
        return klines
    except Exception as e:
        print(f"An error occurred while fetching historical data: {e}")
        return None

def place_order(client, symbol, side, quantity, order_type='MARKET'):
    """Places a simulated order."""
    try:
        print(f"--- SIMULATED ORDER ---")
        print(f"Symbol: {symbol}")
        print(f"Side: {side.upper()}")
        print(f"Quantity: {quantity}")
        print(f"Type: {order_type}")
        print(f"----------------------")
        return {"symbol": symbol, "side": side, "quantity": quantity, "type": order_type, "status": "FILLED"}
    except Exception as e:
        print(f"An error occurred while placing order: {e}")
        return None

def update_status_file(data):
    """Writes the bot status to a JSON file."""
    with open(STATUS_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print("Status file updated.")

def run_trading_loop():
    """The main trading loop."""
    print("Starting trading bot...")
    client = get_binance_client()

    symbol = 'BTCUSDT'
    interval = Client.KLINE_INTERVAL_1HOUR
    short_window = 10
    long_window = 50
    lookback = f"{long_window + 5} hours ago UTC"

    while True:
        status_data = {
            'timestamp': time.time(),
            'symbol': symbol,
            'short_window': short_window,
            'long_window': long_window,
            'signal': 'hold',
            'short_sma': None,
            'long_sma': None,
            'balances': [],
            'error': None,
        }

        try:
            print(f"\n[{time.ctime()}] Checking for signals...")

            account_info = get_account_info(client)
            if account_info and 'balances' in account_info:
                status_data['balances'] = [b for b in account_info['balances'] if float(b['free']) > 0 or float(b['locked']) > 0]

            klines = get_historical_data(client, symbol, interval, lookback)
            if klines:
                short_sma = strategy.calculate_sma(klines, short_window)
                long_sma = strategy.calculate_sma(klines, long_window)

                if short_sma is not None and long_sma is not None:
                    status_data['short_sma'] = short_sma.iloc[-1]
                    status_data['long_sma'] = long_sma.iloc[-1]

                    signal = strategy.check_crossover(short_sma, long_sma)
                    if signal:
                        status_data['signal'] = signal
                        print(f"Signal found: {signal.upper()}. Placing simulated order.")
                        place_order(client, symbol, signal, 0.001)
                    else:
                        print("No crossover detected.")
                else:
                    status_data['error'] = "Could not calculate SMAs."
                    print(status_data['error'])
            else:
                status_data['error'] = "Could not fetch historical data."
                print(status_data['error'])

        except Exception as e:
            error_message = f"An unexpected error occurred in the trading loop: {e}"
            print(error_message)
            status_data['error'] = error_message

        finally:
            update_status_file(status_data)
            # Wait for 1 hour (3600 seconds) before the next check.
            # For demonstration, we'll use a shorter interval.
            print("Waiting for 1 hour before next check...")
            time.sleep(3600)

if __name__ == "__main__":
    try:
        run_trading_loop()
    except ValueError as e:
        print(f"Configuration Error: {e}")
    except KeyboardInterrupt:
        print("\nTrading bot stopped by user.")
