// src/components/TradingChart.tsx
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';
import type { Trade } from '../App';

const BINANCE_DATA_API = 'https://data-api.binance.vision/api/v3';

interface TradingChartProps {
  trades: Trade[];
}

const TradingChart: React.FC<TradingChartProps> = ({ trades }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1a1a1b' },
        textColor: '#d7dadc',
      },
      grid: {
        vertLines: { color: '#272729' },
        horzLines: { color: '#272729' },
      },
      timeScale: {
        borderColor: '#343536',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
      width: chartContainerRef.current.clientWidth,
      height: 384,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#28a745',
      downColor: '#dc3545',
      borderDownColor: '#dc3545',
      borderUpColor: '#28a745',
      wickDownColor: '#dc3545',
      wickUpColor: '#28a745',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    const handleResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fetchCandleData = async () => {
      if (!candleSeriesRef.current) return;
      try {
        const response = await fetch(
          `${BINANCE_DATA_API}/klines?symbol=BTCUSDT&interval=1m&limit=500`,
        );
        if (!response.ok) {
          throw new Error(`Chart data request failed: ${response.status}`);
        }
        const data = await response.json();

        const formattedData = data.map((d: (string | number)[]) => ({
          time: (Number(d[0]) / 1000) as UTCTimestamp,
          open: parseFloat(String(d[1])),
          high: parseFloat(String(d[2])),
          low: parseFloat(String(d[3])),
          close: parseFloat(String(d[4])),
        }));

        candleSeriesRef.current.setData(formattedData);
        chartRef.current?.timeScale().fitContent();
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      }
    };

    fetchCandleData();
    const intervalId = window.setInterval(fetchCandleData, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!markersRef.current) return;

    const markers: SeriesMarker<UTCTimestamp>[] = trades
      .map((trade) => ({
        time: (new Date(trade.created_at).getTime() / 1000) as UTCTimestamp,
        position: trade.type === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
        color: trade.type === 'buy' ? '#28a745' : '#dc3545',
        shape: trade.type === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
        text: `${trade.type.toUpperCase()} @ ${trade.price.toFixed(2)}`,
      }))
      // lightweight-charts requires ascending marker times
      .sort((a, b) => a.time - b.time);

    markersRef.current.setMarkers(markers);
  }, [trades]);

  return <div ref={chartContainerRef} className="w-full h-96" />;
};

export default TradingChart;
