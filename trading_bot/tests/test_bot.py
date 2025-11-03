import sys
import os
import pytest
import pandas as pd

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from trading_bot.bot import strategy

# Sample kline data for testing (oldest first)
mock_kline_data = [
    [1622505600000, '40000', '40500', '39500', '40200', '1000', 1622509199999, '40000000', 100, '500', '20000000', '0'],
    [1622509200000, '40200', '40800', '40100', '40700', '1200', 1622512799999, '48000000', 120, '600', '24000000', '0'],
    [1622512800000, '40700', '41200', '40600', '41000', '1100', 1622516399999, '44000000', 110, '550', '22000000', '0'],
    [1622516400000, '41000', '41500', '40900', '41300', '1300', 1622519999999, '52000000', 130, '650', '26000000', '0'],
    [1622520000000, '41300', '41800', '41200', '41600', '1400', 1622523599999, '56000000', 140, '700', '28000000', '0']
]

def test_calculate_sma():
    """Test the SMA calculation."""
    # Test with a window of 3
    sma = strategy.calculate_sma(mock_kline_data, 3)
    assert sma is not None
    assert len(sma) == 5
    # SMA values: (40200+40700+41000)/3 = 40633.33, (40700+41000+41300)/3 = 41000, (41000+41300+41600)/3 = 41300
    assert round(sma.iloc[2], 2) == 40633.33
    assert sma.iloc[3] == 41000.0
    assert sma.iloc[4] == 41300.0

    # Test with insufficient data
    sma_insufficient = strategy.calculate_sma(mock_kline_data, 10)
    assert sma_insufficient is None

def test_check_crossover_golden_cross():
    """Test the golden cross (buy signal) detection."""
    # Short SMA crosses above Long SMA
    short_sma_data = pd.Series([98, 102])
    long_sma_data = pd.Series([100, 100])
    signal = strategy.check_crossover(short_sma_data, long_sma_data)
    assert signal == 'buy'

def test_check_crossover_death_cross():
    """Test the death cross (sell signal) detection."""
    # Short SMA crosses below Long SMA
    short_sma_data = pd.Series([102, 98])
    long_sma_data = pd.Series([100, 100])
    signal = strategy.check_crossover(short_sma_data, long_sma_data)
    assert signal == 'sell'

def test_check_crossover_no_cross():
    """Test the scenario with no crossover."""
    # No crossover
    short_sma_data = pd.Series([101, 102])
    long_sma_data = pd.Series([100, 100])
    signal = strategy.check_crossover(short_sma_data, long_sma_data)
    assert signal is None

    # Parallel movement
    short_sma_data = pd.Series([98, 99])
    long_sma_data = pd.Series([100, 101])
    signal = strategy.check_crossover(short_sma_data, long_sma_data)
    assert signal is None
