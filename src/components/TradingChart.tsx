// src/components/TradingChart.tsx
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';
import type { Trade } from '../App'; // Import the Trade type

// --- Component Props ---
// We define what information this component needs from its parent (App.tsx)
interface TradingChartProps {
  trades: Trade[];
}

const TradingChart: React.FC<TradingChartProps> = ({ trades }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // --- Chart Initialization and Styling ---
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1a1a1b' }, // Dark background
        textColor: '#d7dadc',
      },
      grid: {
        vertLines: { color: '#272729' },
        horzLines: { color: '#272729' },
      },
      timeScale: {
        borderColor: '#343536',
        timeVisible: true, // Show time on the bottom axis
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Magnet crosshair
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#28a745',
      downColor: '#dc3545',
      borderDownColor: '#dc3545',
      borderUpColor: '#28a745',
      wickDownColor: '#dc3545',
      wickUpColor: '#28a745',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle chart resizing
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    // Clean up on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // --- Fetch and Update Chart Data ---
  useEffect(() => {
    const fetchCandleData = async () => {
      if (!candleSeriesRef.current) return;
      try {
        // Fetch the last 500 1-minute candles from Binance
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500');
        const data = await response.json();

        const formattedData = data.map((d: any) => ({
          time: (d[0] / 1000) as UTCTimestamp,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        candleSeriesRef.current.setData(formattedData);
      } catch (error) {
        console.error("Failed to fetch chart data:", error);
      }
    };
    fetchCandleData();
  }, []);

  // --- Add markers for trades ---
  useEffect(() => {
    if (!candleSeriesRef.current || trades.length === 0) return;

    const markers = trades.map(trade => ({
      time: (new Date(trade.created_at).getTime() / 1000) as UTCTimestamp,
      position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
      color: trade.type === 'buy' ? '#28a745' : '#dc3545',
      shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
      text: `${trade.type.toUpperCase()} @ ${trade.price.toFixed(2)}`,
    }));

    candleSeriesRef.current.setMarkers(markers);

  }, [trades]); // Re-run this effect whenever the trades array changes


  return <div ref={chartContainerRef} className="w-full h-96" />;
};

export default TradingChart;
