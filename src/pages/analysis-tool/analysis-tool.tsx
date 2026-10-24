import React, { useEffect, useState, useRef } from 'react';
import './analysis-tool.scss';

interface TickHistoryResponse {
  msg_type: string;
  history?: { prices: number[] };
  tick?: { quote: number; symbol: string };
}

const MARKETS = [
  { id: '1HZ10V', label: 'Volatility 10 (1s) Index' },
  { id: '1HZ25V', label: 'Volatility 25 (1s) Index' },
  { id: '1HZ50V', label: 'Volatility 50 (1s) Index' },
  { id: '1HZ75V', label: 'Volatility 75 (1s) Index' },
  { id: '1HZ100V', label: 'Volatility 100 (1s) Index' },
  { id: 'R_50', label: 'Volatility 50 Index' },
  { id: 'R_100', label: 'Volatility 100 Index' },
];

export const AnalysisTool: React.FC = () => {
  const [symbol, setSymbol] = useState<string>('1HZ75V');
  const [tickLimit, setTickLimit] = useState<number>(1000);
  const [ticks, setTicks] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState<string>('0.00');
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);

  // Contract analysis states
  const [overUnderThreshold, setOverUnderThreshold] = useState<number>(4);
  const [differsTarget, setDiffersTarget] = useState<number>(5);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          end: 'latest',
          count: tickLimit,
          style: 'ticks',
          subscribe: 1,
        })
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      const data: TickHistoryResponse = JSON.parse(event.data);

      if (data.msg_type === 'history' && data.history?.prices) {
        const prices = data.history.prices;
        setTicks(prices);
        if (prices.length > 0) {
          const latest = prices[prices.length - 1];
          const formatted = latest.toFixed(2);
          setCurrentPrice(formatted);
          setLastDigit(Number(formatted.slice(-1)));
        }
      } else if (data.msg_type === 'tick' && data.tick) {
        const price = data.tick.quote;
        const formatted = price.toFixed(2);
        setCurrentPrice(formatted);
        const digit = Number(formatted.slice(-1));
        setLastDigit(digit);

        setTicks((prev) => {
          const next = [...prev.slice(1), price];
          setPrevPrice(prev[prev.length - 1] ?? null);
          return next;
        });
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: 'ticks' }));
      }
      ws.close();
    };
  }, [symbol, tickLimit]);

  // Extract digits for frequency analysis
  const digits = ticks.map((p) => Number(p.toFixed(2).slice(-1)));
  const totalCount = digits.length || 1;

  const frequencies = Array.from({ length: 10 }, (_, i) => {
    const count = digits.filter((d) => d === i).length;
    const percentage = ((count / totalCount) * 100).toFixed(1);
    return { digit: i, count, percentage: Number(percentage) };
  });

  // Calculate ranks: Most, 2nd Most, 2nd Least, Least
  const sorted = [...frequencies].sort((a, b) => b.count - a.count);
  const mostAppearing = sorted[0]?.digit;
  const secondMost = sorted[1]?.digit;
  const secondLeast = sorted[sorted.length - 2]?.digit;
  const leastAppearing = sorted[sorted.length - 1]?.digit;

  const getRankClass = (digit: number) => {
    if (digit === mostAppearing) return 'rank-most';
    if (digit === secondMost) return 'rank-second-most';
    if (digit === secondLeast) return 'rank-second-least';
    if (digit === leastAppearing) return 'rank-least';
    return '';
  };

  // Derivative metrics
  const evenCount = digits.filter((d) => d % 2 === 0).length;
  const evenPct = ((evenCount / totalCount) * 100).toFixed(1);
  const oddPct = (100 - Number(evenPct)).toFixed(1);

  const overCount = digits.filter((d) => d > overUnderThreshold).length;
  const overPct = ((overCount / totalCount) * 100).toFixed(1);
  const underPct = (100 - Number(overPct)).toFixed(1);

  const matchCount = digits.filter((d) => d === differsTarget).length;
  const matchPct = ((matchCount / totalCount) * 100).toFixed(1);
  const differsPct = (100 - Number(matchPct)).toFixed(1);

  const isRise = prevPrice !== null && Number(currentPrice) >= prevPrice;

  return (
    <div className="analysis-tool-page">
      {/* Top Header Controls */}
      <div className="analysis-header">
        <div className="controls-left">
          <label>
            Market:
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {MARKETS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>

          <label>
            Ticks:
            <input
              type="number"
              min="100"
              max="5000"
              value={tickLimit}
              onChange={(e) => setTickLimit(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="price-callout">
          <div className="price-sub">Current Price</div>
          <div className={`price-val ${isRise ? 'rise' : 'fall'}`}>
            {currentPrice}
          </div>
          <div className="latest-digit">Last Digit: <span>{lastDigit ?? '-'}</span></div>
        </div>
      </div>

      {/* Legend */}
      <div className="legend-bar">
        <span className="badge rank-most">Most Appearing</span>
        <span className="badge rank-second-most">Second Most</span>
        <span className="badge rank-second-least">Second Least</span>
        <span className="badge rank-least">Least Appearing</span>
      </div>

      {/* 0-9 Digit Row with Live Moving Cursor */}
      <div className="digit-grid">
        {frequencies.map((item) => {
          const isCurrentCursor = item.digit === lastDigit;
          const rankClass = getRankClass(item.digit);

          return (
            <div
              key={item.digit}
              className={`digit-card ${rankClass} ${isCurrentCursor ? 'active-cursor' : ''}`}
            >
              {isCurrentCursor && <div className="cursor-indicator">▼</div>}
              <div className="digit-value">{item.digit}</div>
              <div className="digit-percent">{item.percentage}%</div>
              <div className="digit-count">{item.count} hits</div>
            </div>
          );
        })}
      </div>

      {/* Contract Probability Grids */}
      <div className="metrics-grid">
        <div className="metric-box">
          <h4>Even / Odd Analysis</h4>
          <div className="metric-row">
            <span>Even: {evenPct}%</span>
            <span>Odd: {oddPct}%</span>
          </div>
          <div className="progress-bar">
            <div className="fill even" style={{ width: `${evenPct}%` }}></div>
            <div className="fill odd" style={{ width: `${oddPct}%` }}></div>
          </div>
        </div>

        <div className="metric-box">
          <h4>Over / Under (Threshold: {overUnderThreshold})</h4>
          <div className="threshold-selector">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((val) => (
              <button
                key={val}
                type="button"
                className={overUnderThreshold === val ? 'active' : ''}
                onClick={() => setOverUnderThreshold(val)}
              >
                {val}
              </button>
            ))}
          </div>
          <div className="metric-row">
            <span>Over: {overPct}%</span>
            <span>Under: {underPct}%</span>
          </div>
        </div>

        <div className="metric-box">
          <h4>Matches / Differs (Target: {differsTarget})</h4>
          <div className="threshold-selector">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
              <button
                key={val}
                type="button"
                className={differsTarget === val ? 'active' : ''}
                onClick={() => setDiffersTarget(val)}
              >
                {val}
              </button>
            ))}
          </div>
          <div className="metric-row">
            <span>Match: {matchPct}%</span>
            <span>Differs: {differsPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisTool;
