import React, { useEffect, useRef, useState, useMemo } from 'react';
import './analysis-tool.scss';

interface TickData {
    quote: number;
    pip_size: number;
    epoch: number;
}

const MARKETS = [
    { id: 'R_10', name: 'Volatility 10 Index' },
    { id: 'R_25', name: 'Volatility 25 Index' },
    { id: 'R_50', name: 'Volatility 50 Index' },
    { id: 'R_75', name: 'Volatility 75 Index' },
    { id: 'R_100', name: 'Volatility 100 Index' },
    { id: '1HZ10V', name: 'Volatility 10 (1s) Index' },
    { id: '1HZ25V', name: 'Volatility 25 (1s) Index' },
    { id: '1HZ50V', name: 'Volatility 50 (1s) Index' },
    { id: '1HZ75V', name: 'Volatility 75 (1s) Index' },
    { id: '1HZ100V', name: 'Volatility 100 (1s) Index' },
];

const AnalysisTool: React.FC = () => {
    const [selectedMarket, setSelectedMarket] = useState('R_25');
    const [tickCount, setTickCount] = useState<number>(1000);
    const [syncWithBot, setSyncWithBot] = useState(true);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [prevPrice, setPrevPrice] = useState<number | null>(null);
    const [priceDecimals, setPriceDecimals] = useState(2);
    const [ticksHistory, setTicksHistory] = useState<number[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

    // Selected comparison digits
    const [selectedOverUnder, setSelectedOverUnder] = useState<number>(4);
    const [selectedMatchDiffer, setSelectedMatchDiffer] = useState<number>(5);

    const wsRef = useRef<WebSocket | null>(null);

    // Connect & subscribe to Deriv ticks
    useEffect(() => {
        setConnectionStatus('connecting');
        const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
        wsRef.current = ws;

        ws.onopen = () => {
            setConnectionStatus('connected');
            // Request history + subscription
            ws.send(JSON.stringify({
                ticks_history: selectedMarket,
                adjust_start_time: 1,
                count: tickCount,
                end: 'latest',
                start: 1,
                style: 'ticks',
                subscribe: 1,
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.msg_type === 'history') {
                const prices: number[] = data.history?.prices || [];
                const pips: number = data.history?.pip_size ?? 2;
                setPriceDecimals(pips);
                if (prices.length > 0) {
                    const last = prices[prices.length - 1];
                    setCurrentPrice(last);
                    setTicksHistory(prices.slice(-tickCount));
                }
            } else if (data.msg_type === 'tick') {
                const tick: TickData = data.tick;
                if (tick?.quote !== undefined) {
                    setPriceDecimals(tick.pip_size ?? 2);
                    setCurrentPrice((prev) => {
                        setPrevPrice(prev);
                        return tick.quote;
                    });
                    setTicksHistory((prev) => [...prev.slice(-(tickCount - 1)), tick.quote]);
                }
            }
        };

        ws.onerror = () => setConnectionStatus('error');

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ forget_all: 'ticks' }));
            }
            ws.close();
        };
    }, [selectedMarket, tickCount]);

    // Extract last digits
    const lastDigits = useMemo(() => {
        return ticksHistory.map((price) => {
            const formatted = price.toFixed(priceDecimals);
            return parseInt(formatted.slice(-1), 10);
        });
    }, [ticksHistory, priceDecimals]);

    const latestDigit = lastDigits.length > 0 ? lastDigits[lastDigits.length - 1] : null;

    // Digit frequencies (0 - 9)
    const digitStats = useMemo(() => {
        const counts = Array(10).fill(0);
        lastDigits.forEach((d) => counts[d]++);
        const total = lastDigits.length || 1;

        const indexed = counts.map((count, digit) => ({
            digit,
            count,
            percentage: ((count / total) * 100).toFixed(1),
            rawPct: count / total,
        }));

        const sorted = [...indexed].sort((a, b) => b.count - a.count);
        const most = sorted[0]?.digit;
        const second = sorted[1]?.digit;
        const least = sorted[sorted.length - 1]?.digit;

        return { indexed, most, second, least };
    }, [lastDigits]);

    // Even / Odd stats
    const evenOddStats = useMemo(() => {
        if (!lastDigits.length) return { evenPct: '50.0', oddPct: '50.0', recent: [] };
        const evenCount = lastDigits.filter((d) => d % 2 === 0).length;
        const total = lastDigits.length;
        const evenPct = ((evenCount / total) * 100).toFixed(1);
        const oddPct = (100 - parseFloat(evenPct)).toFixed(1);
        const recent = lastDigits.slice(-10).map((d) => (d % 2 === 0 ? 'E' : 'O'));
        return { evenPct, oddPct, recent };
    }, [lastDigits]);

    // Rise / Fall stats
    const riseFallStats = useMemo(() => {
        if (ticksHistory.length < 2) return { risePct: '50.0', fallPct: '50.0', recent: [] };
        let rises = 0;
        let falls = 0;
        const recent: ('R' | 'F')[] = [];

        for (let i = 1; i < ticksHistory.length; i++) {
            const diff = ticksHistory[i] - ticksHistory[i - 1];
            if (diff >= 0) rises++;
            else falls++;
        }
        for (let i = Math.max(1, ticksHistory.length - 10); i < ticksHistory.length; i++) {
            recent.push(ticksHistory[i] >= ticksHistory[i - 1] ? 'R' : 'F');
        }

        const total = rises + falls || 1;
        const risePct = ((rises / total) * 100).toFixed(1);
        const fallPct = (100 - parseFloat(risePct)).toFixed(1);
        return { risePct, fallPct, recent };
    }, [ticksHistory]);

    // Over / Under calculated for selectedOverUnder
    const overUnderStats = useMemo(() => {
        if (!lastDigits.length) return { over: '50.0', under: '50.0' };
        const overCount = lastDigits.filter((d) => d > selectedOverUnder).length;
        const underCount = lastDigits.filter((d) => d < selectedOverUnder).length;
        const total = lastDigits.length;
        return {
            over: ((overCount / total) * 100).toFixed(1),
            under: ((underCount / total) * 100).toFixed(1),
        };
    }, [lastDigits, selectedOverUnder]);

    // Matches / Differs calculated for selectedMatchDiffer
    const matchDifferStats = useMemo(() => {
        if (!lastDigits.length) return { match: '10.0', differ: '90.0' };
        const matchCount = lastDigits.filter((d) => d === selectedMatchDiffer).length;
        const total = lastDigits.length;
        const matchPct = ((matchCount / total) * 100).toFixed(1);
        const differPct = (100 - parseFloat(matchPct)).toFixed(1);
        return { match: matchPct, differ: differPct };
    }, [lastDigits, selectedMatchDiffer]);

    const priceColor =
        prevPrice !== null && currentPrice !== null
            ? currentPrice >= prevPrice
                ? '#10b981'
                : '#ef4444'
            : '#ffffff';

    return (
        <div className="chichi-analysis-tool">
            {/* Top Bar: Controls & Current Price */}
            <div className="cat-header-card">
                <div className="cat-controls-group">
                    <div className="cat-title-row">
                        <h2>Analysis Tool</h2>
                        <span className={`cat-status-dot ${connectionStatus}`} />
                    </div>

                    <div className="cat-inputs-row">
                        <div className="cat-field">
                            <label>Market</label>
                            <select
                                value={selectedMarket}
                                onChange={(e) => setSelectedMarket(e.target.value)}
                                className="cat-select"
                            >
                                {MARKETS.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="cat-field">
                            <label>Ticks</label>
                            <input
                                type="number"
                                min={50}
                                max={5000}
                                step={50}
                                value={tickCount}
                                onChange={(e) => setTickCount(Number(e.target.value))}
                                className="cat-input"
                            />
                        </div>

                        <label className="cat-toggle-label">
                            <input
                                type="checkbox"
                                checked={syncWithBot}
                                onChange={(e) => setSyncWithBot(e.target.checked)}
                            />
                            <span className="cat-toggle-slider" />
                            <span className="cat-toggle-text">Sync to Bot Builder</span>
                        </label>
                    </div>
                </div>

                <div className="cat-price-banner">
                    <div className="cat-price-title">CURRENT PRICE</div>
                    <div className="cat-price-val" style={{ color: priceColor }}>
                        {currentPrice !== null ? currentPrice.toFixed(priceDecimals) : 'Connecting...'}
                    </div>
                    {latestDigit !== null && (
                        <div className="cat-latest-digit-pill">
                            Latest digit: <strong>{latestDigit}</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* Digit Frequency Ring Section */}
            <div className="cat-panel">
                <div className="cat-panel-header">
                    <h3>Digit Frequency</h3>
                    <div className="cat-legend">
                        <span className="legend-item"><span className="dot dot-most" /> Most appearing</span>
                        <span className="legend-item"><span className="dot dot-second" /> Second most</span>
                        <span className="legend-item"><span className="dot dot-least" /> Least appearing</span>
                        <span className="legend-item"><span className="dot dot-latest" /> Latest tick</span>
                    </div>
                </div>

                <div className="cat-digit-rings-grid">
                    {digitStats.indexed.map((item) => {
                        const isMost = item.digit === digitStats.most;
                        const isSecond = item.digit === digitStats.second;
                        const isLeast = item.digit === digitStats.least;
                        const isLatest = item.digit === latestDigit;

                        let ringClass = '';
                        if (isMost) ringClass = 'ring-most';
                        else if (isSecond) ringClass = 'ring-second';
                        else if (isLeast) ringClass = 'ring-least';

                        return (
                            <div key={item.digit} className={`cat-ring-card ${ringClass} ${isLatest ? 'is-latest' : ''}`}>
                                {isLatest && <span className="cat-latest-marker">●</span>}
                                <div className="cat-ring-circle">
                                    <span className="cat-ring-digit">{item.digit}</span>
                                </div>
                                <div className="cat-ring-pct">{item.percentage}%</div>
                                <div className="cat-ring-count">{item.count}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom 4-Column Grid: Over/Under, Matches/Differs, Even/Odd, Rise/Fall */}
            <div className="cat-grid-four">
                {/* 1. Over / Under */}
                <div className="cat-sub-card">
                    <div className="cat-sub-header">
                        <h4>Over/Under Analysis</h4>
                        <div className="cat-action-btns">
                            <button type="button" className="cat-btn-red">To Under</button>
                            <button type="button" className="cat-btn-red">To Over</button>
                        </div>
                    </div>
                    <div className="cat-digit-selector">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`cat-digit-btn ${selectedOverUnder === d ? 'active' : ''}`}
                                onClick={() => setSelectedOverUnder(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                    <div className="cat-stat-bar-group">
                        <div className="cat-stat-row">
                            <span>Over</span>
                            <strong>{overUnderStats.over}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-blue" style={{ width: `${overUnderStats.over}%` }} />
                        </div>
                        <div className="cat-stat-row">
                            <span>Under</span>
                            <strong>{overUnderStats.under}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-orange" style={{ width: `${overUnderStats.under}%` }} />
                        </div>
                    </div>
                </div>

                {/* 2. Matches / Differs */}
                <div className="cat-sub-card">
                    <div className="cat-sub-header">
                        <h4>Matches/Differs Analysis</h4>
                        <div className="cat-action-btns">
                            <button type="button" className="cat-btn-red">To Match</button>
                            <button type="button" className="cat-btn-red">To Differ</button>
                        </div>
                    </div>
                    <div className="cat-digit-selector">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`cat-digit-btn ${selectedMatchDiffer === d ? 'active' : ''}`}
                                onClick={() => setSelectedMatchDiffer(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                    <div className="cat-stat-bar-group">
                        <div className="cat-stat-row">
                            <span>Matches</span>
                            <strong>{matchDifferStats.match}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-blue" style={{ width: `${matchDifferStats.match}%` }} />
                        </div>
                        <div className="cat-stat-row">
                            <span>Differs</span>
                            <strong>{matchDifferStats.differ}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-purple" style={{ width: `${matchDifferStats.differ}%` }} />
                        </div>
                    </div>
                </div>

                {/* 3. Even / Odd */}
                <div className="cat-sub-card">
                    <div className="cat-sub-header">
                        <h4>Even/Odd Analysis</h4>
                        <div className="cat-action-btns">
                            <button type="button" className="cat-btn-red">To Even</button>
                            <button type="button" className="cat-btn-red">To Odd</button>
                        </div>
                    </div>
                    <div className="cat-stat-bar-group">
                        <div className="cat-stat-row">
                            <span>Even</span>
                            <strong>{evenOddStats.evenPct}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-green" style={{ width: `${evenOddStats.evenPct}%` }} />
                        </div>
                        <div className="cat-stat-row">
                            <span>Odd</span>
                            <strong>{evenOddStats.oddPct}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-orange" style={{ width: `${evenOddStats.oddPct}%` }} />
                        </div>
                    </div>
                    <div className="cat-recent-sequence">
                        <span className="cat-seq-title">RECENT SEQUENCE</span>
                        <div className="cat-seq-pills">
                            {evenOddStats.recent.map((val, idx) => (
                                <span key={idx} className={`cat-pill ${val === 'E' ? 'pill-even' : 'pill-odd'}`}>
                                    {val}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4. Rise / Fall */}
                <div className="cat-sub-card">
                    <div className="cat-sub-header">
                        <h4>Rise/Fall Analysis</h4>
                        <div className="cat-action-btns">
                            <button type="button" className="cat-btn-red">To Fall</button>
                            <button type="button" className="cat-btn-red">To Rise</button>
                        </div>
                    </div>
                    <div className="cat-stat-bar-group">
                        <div className="cat-stat-row">
                            <span>Rise</span>
                            <strong>{riseFallStats.risePct}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-blue" style={{ width: `${riseFallStats.risePct}%` }} />
                        </div>
                        <div className="cat-stat-row">
                            <span>Fall</span>
                            <strong>{riseFallStats.fallPct}%</strong>
                        </div>
                        <div className="cat-progress-track">
                            <div className="cat-progress-fill fill-red" style={{ width: `${riseFallStats.fallPct}%` }} />
                        </div>
                    </div>
                    <div className="cat-recent-sequence">
                        <span className="cat-seq-title">RECENT SEQUENCE</span>
                        <div className="cat-seq-pills">
                            {riseFallStats.recent.map((val, idx) => (
                                <span key={idx} className={`cat-pill ${val === 'R' ? 'pill-rise' : 'pill-fall'}`}>
                                    {val}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisTool;
