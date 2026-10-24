import React, { useEffect, useRef, useState, useMemo } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './analysis-tool.scss';

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

    const [selectedOverUnder, setSelectedOverUnder] = useState<number>(0);
    const [selectedMatchDiffer, setSelectedMatchDiffer] = useState<number>(0);

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let subscriptionId: string | null = null;
        let isCancelled = false;

        setConnectionStatus('connecting');

        const subscribeTicks = async () => {
            try {
                let api = api_base?.api;
                let attempts = 0;
                while ((!api || !api.connection || api.connection.readyState !== WebSocket.OPEN) && attempts < 15) {
                    await new Promise((r) => setTimeout(r, 200));
                    api = api_base?.api;
                    attempts++;
                }

                if (api && api.connection && api.connection.readyState === WebSocket.OPEN) {
                    setConnectionStatus('connected');
                    const response = await (api as any).send({
                        ticks_history: selectedMarket,
                        adjust_start_time: 1,
                        count: tickCount,
                        end: 'latest',
                        start: 1,
                        style: 'ticks',
                        subscribe: 1,
                    });

                    if (isCancelled) return;

                    if (response?.history?.prices) {
                        const prices: number[] = response.history.prices;
                        const pips: number = response.history.pip_size ?? 2;
                        setPriceDecimals(pips);
                        if (prices.length > 0) {
                            setCurrentPrice(prices[prices.length - 1]);
                            setTicksHistory(prices.slice(-tickCount));
                        }
                    }

                    if (response?.subscription) {
                        subscriptionId = response.subscription.id;
                    }

                    const subscriber = (api as any).onMessage().subscribe(({ data }: any) => {
                        if (data?.msg_type === 'tick' && data?.tick?.symbol === selectedMarket) {
                            const tick = data.tick;
                            setPriceDecimals(tick.pip_size ?? 2);
                            setCurrentPrice((prev) => {
                                setPrevPrice(prev);
                                return tick.quote;
                            });
                            setTicksHistory((prev) => [...prev.slice(-(tickCount - 1)), tick.quote]);
                        }
                    });

                    return () => {
                        subscriber.unsubscribe();
                        if (subscriptionId) {
                            (api as any).send({ forget: subscriptionId }).catch(() => {});
                        }
                    };
                } else {
                    const serverUrl = 'wss://ws.derivws.com/websockets/v3?app_id=1089&brand=deriv';
                    const ws = new WebSocket(serverUrl);
                    wsRef.current = ws;

                    ws.onopen = () => {
                        if (isCancelled) return;
                        setConnectionStatus('connected');
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
                            setPriceDecimals(data.history?.pip_size ?? 2);
                            if (prices.length > 0) {
                                setCurrentPrice(prices[prices.length - 1]);
                                setTicksHistory(prices.slice(-tickCount));
                            }
                        } else if (data.msg_type === 'tick') {
                            const tick = data.tick;
                            setPriceDecimals(tick.pip_size ?? 2);
                            setCurrentPrice((prev) => {
                                setPrevPrice(prev);
                                return tick.quote;
                            });
                            setTicksHistory((prev) => [...prev.slice(-(tickCount - 1)), tick.quote]);
                        }
                    };

                    ws.onerror = () => setConnectionStatus('error');
                }
            } catch (err) {
                console.error('Error in ticks stream:', err);
                setConnectionStatus('error');
            }
        };

        const cleanupPromise = subscribeTicks();

        return () => {
            isCancelled = true;
            cleanupPromise.then((cleanup) => cleanup && cleanup());
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ forget_all: 'ticks' }));
                wsRef.current.close();
            }
        };
    }, [selectedMarket, tickCount]);

    const lastDigits = useMemo(() => {
        return ticksHistory.map((price) => {
            const formatted = price.toFixed(priceDecimals);
            return parseInt(formatted.slice(-1), 10);
        });
    }, [ticksHistory, priceDecimals]);

    const latestDigit = lastDigits.length > 0 ? lastDigits[lastDigits.length - 1] : null;

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
        const secondMost = sorted[1]?.digit;
        const least = sorted[sorted.length - 1]?.digit;
        const secondLeast = sorted[sorted.length - 2]?.digit;

        return { indexed, most, secondMost, least, secondLeast };
    }, [lastDigits]);

    const overUnderStats = useMemo(() => {
        if (!lastDigits.length) return { over: '0.0', under: '0.0', recent: [] };
        const overCount = lastDigits.filter((d) => d > selectedOverUnder).length;
        const underCount = lastDigits.filter((d) => d < selectedOverUnder).length;
        const total = lastDigits.length;

        const recent = lastDigits.slice(-8).map((d) => (d > selectedOverUnder ? 'O' : d < selectedOverUnder ? 'U' : '-'));

        return {
            over: ((overCount / total) * 100).toFixed(1),
            under: ((underCount / total) * 100).toFixed(1),
            recent,
        };
    }, [lastDigits, selectedOverUnder]);

    const matchDifferStats = useMemo(() => {
        if (!lastDigits.length) return { match: '0.0', differ: '0.0', recent: [] };
        const matchCount = lastDigits.filter((d) => d === selectedMatchDiffer).length;
        const total = lastDigits.length;
        const matchPct = ((matchCount / total) * 100).toFixed(1);
        const differPct = (100 - parseFloat(matchPct)).toFixed(1);
        const recent = lastDigits.slice(-8).map((d) => (d === selectedMatchDiffer ? 'M' : 'D'));

        return { match: matchPct, differ: differPct, recent };
    }, [lastDigits, selectedMatchDiffer]);

    const evenOddStats = useMemo(() => {
        if (!lastDigits.length) return { evenPct: '50.0', oddPct: '50.0', recent: [] };
        const evenCount = lastDigits.filter((d) => d % 2 === 0).length;
        const total = lastDigits.length;
        const evenPct = ((evenCount / total) * 100).toFixed(1);
        const oddPct = (100 - parseFloat(evenPct)).toFixed(1);
        const recent = lastDigits.slice(-8).map((d) => (d % 2 === 0 ? 'E' : 'O'));
        return { evenPct, oddPct, recent };
    }, [lastDigits]);

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
        for (let i = Math.max(1, ticksHistory.length - 8); i < ticksHistory.length; i++) {
            recent.push(ticksHistory[i] >= ticksHistory[i - 1] ? 'R' : 'F');
        }

        const total = rises + falls || 1;
        const risePct = ((rises / total) * 100).toFixed(1);
        const fallPct = (100 - parseFloat(risePct)).toFixed(1);
        return { risePct, fallPct, recent };
    }, [ticksHistory]);

    const priceColor =
        prevPrice !== null && currentPrice !== null
            ? currentPrice >= prevPrice
                ? '#10b981'
                : '#ef4444'
            : '#0f172a';

    return (
        <div className="chichi-analysis-tool">
            {/* Top Controls Card */}
            <div className="cat-top-card">
                <div className="cat-header-row">
                    <div className="cat-title-wrap">
                        <h2>Analysis Tool</h2>
                        <span className={`cat-status-dot ${connectionStatus}`} />
                    </div>
                    <div className="cat-desktop-price">
                        <span className="price-label">PRICE:</span>
                        <span className="price-val" style={{ color: priceColor }}>
                            {currentPrice !== null ? currentPrice.toFixed(priceDecimals) : 'Connecting...'}
                        </span>
                    </div>
                </div>

                <div className="cat-controls-flex">
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
                        <span>Sync to Bot Builder</span>
                    </label>
                </div>
            </div>

            {/* Digit Frequency Card (Matching chichitraders 2x5 Grid) */}
            <div className="cat-panel">
                <div className="cat-panel-header">
                    <h3>Digit Frequency</h3>
                    {latestDigit !== null && (
                        <div className="cat-latest-pill">
                            Latest digit {latestDigit}
                        </div>
                    )}
                </div>

                <div className="cat-legend">
                    <span className="legend-item"><span className="dot dot-most" /> Most appearing</span>
                    <span className="legend-item"><span className="dot dot-second" /> Second most</span>
                    <span className="legend-item"><span className="dot dot-second-least" /> Second least</span>
                    <span className="legend-item"><span className="dot dot-least" /> Least appearing</span>
                    <span className="legend-item"><span className="arrow-latest">▲</span> Latest tick</span>
                </div>

                {/* 2x5 Responsive Grid */}
                <div className="cat-digit-grid-2x5">
                    {digitStats.indexed.map((item) => {
                        const isMost = item.digit === digitStats.most;
                        const isSecondMost = item.digit === digitStats.secondMost;
                        const isSecondLeast = item.digit === digitStats.secondLeast;
                        const isLeast = item.digit === digitStats.least;
                        const isLatest = item.digit === latestDigit;

                        let gaugeClass = '';
                        if (isMost) gaugeClass = 'gauge-most';
                        else if (isSecondMost) gaugeClass = 'gauge-second';
                        else if (isSecondLeast) gaugeClass = 'gauge-second-least';
                        else if (isLeast) gaugeClass = 'gauge-least';

                        return (
                            <div key={item.digit} className={`cat-gauge-item ${isLatest ? 'is-latest-tick' : ''}`}>
                                <div className={`cat-donut-gauge ${gaugeClass}`}>
                                    <span className="cat-gauge-number">{item.digit}</span>
                                </div>
                                <div className="cat-gauge-pct">{item.percentage}%</div>
                                {isLatest && <div className="cat-latest-arrow">▲</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Analysis Cards */}
            <div className="cat-bottom-cards">
                {/* 1. Over/Under */}
                <div className="cat-sub-card">
                    <div className="cat-sub-top">
                        <h4>Over/Under Analysis</h4>
                        <div className="cat-actions">
                            <button type="button" className="cat-pin-btn">📌</button>
                            <button type="button" className="cat-action-pill red">2x Over</button>
                        </div>
                    </div>

                    <div className="cat-keypad-5x2">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`cat-key-btn ${selectedOverUnder === d ? 'active' : ''}`}
                                onClick={() => setSelectedOverUnder(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>

                    <div className="cat-stat-lines">
                        <div className="cat-stat-head">
                            <span>Over</span>
                            <strong>{overUnderStats.over}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill green" style={{ width: `${overUnderStats.over}%` }} /></div>

                        <div className="cat-stat-head">
                            <span>Under</span>
                            <strong>{overUnderStats.under}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill orange" style={{ width: `${overUnderStats.under}%` }} /></div>
                    </div>

                    <div className="cat-seq-section">
                        <span className="cat-seq-lbl">RECENT SEQUENCE</span>
                        <div className="cat-seq-tiles">
                            {overUnderStats.recent.map((val, idx) => (
                                <span key={idx} className={`cat-tile ${val === 'O' ? 'tile-green' : 'tile-gray'}`}>
                                    {val}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. Matches/Differs */}
                <div className="cat-sub-card">
                    <div className="cat-sub-top">
                        <h4>Matches/Differs Analysis</h4>
                        <div className="cat-actions">
                            <button type="button" className="cat-pin-btn">📌</button>
                            <button type="button" className="cat-action-pill red">1x Match</button>
                        </div>
                    </div>

                    <div className="cat-keypad-5x2">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`cat-key-btn ${selectedMatchDiffer === d ? 'active' : ''}`}
                                onClick={() => setSelectedMatchDiffer(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>

                    <div className="cat-stat-lines">
                        <div className="cat-stat-head">
                            <span>Matches</span>
                            <strong>{matchDifferStats.match}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill blue" style={{ width: `${matchDifferStats.match}%` }} /></div>

                        <div className="cat-stat-head">
                            <span>Differs</span>
                            <strong>{matchDifferStats.differ}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill purple" style={{ width: `${matchDifferStats.differ}%` }} /></div>
                    </div>

                    <div className="cat-seq-section">
                        <span className="cat-seq-lbl">RECENT SEQUENCE</span>
                        <div className="cat-seq-tiles">
                            {matchDifferStats.recent.map((val, idx) => (
                                <span key={idx} className={`cat-tile ${val === 'M' ? 'tile-blue' : 'tile-purple'}`}>
                                    {val}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 3. Even/Odd */}
                <div className="cat-sub-card">
                    <div className="cat-sub-top">
                        <h4>Even/Odd Analysis</h4>
                        <div className="cat-actions">
                            <button type="button" className="cat-pin-btn">📌</button>
                            <button type="button" className="cat-action-pill red">1x Even</button>
                        </div>
                    </div>

                    <div className="cat-stat-lines" style={{ marginTop: '1rem' }}>
                        <div className="cat-stat-head">
                            <span>Even</span>
                            <strong>{evenOddStats.evenPct}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill green" style={{ width: `${evenOddStats.evenPct}%` }} /></div>

                        <div className="cat-stat-head">
                            <span>Odd</span>
                            <strong>{evenOddStats.oddPct}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill orange" style={{ width: `${evenOddStats.oddPct}%` }} /></div>
                    </div>

                    <div className="cat-seq-section">
                        <span className="cat-seq-lbl">RECENT SEQUENCE</span>
                        <div className="cat-seq-tiles">
                            {evenOddStats.recent.map((val, idx) => (
                                <span key={idx} className={`cat-tile ${val === 'E' ? 'tile-green' : 'tile-orange'}`}>
                                    {val}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4. Rise/Fall */}
                <div className="cat-sub-card">
                    <div className="cat-sub-top">
                        <h4>Rise/Fall Analysis</h4>
                        <div className="cat-actions">
                            <button type="button" className="cat-pin-btn">📌</button>
                            <button type="button" className="cat-action-pill red">1x Rise</button>
                        </div>
                    </div>

                    <div className="cat-stat-lines" style={{ marginTop: '1rem' }}>
                        <div className="cat-stat-head">
                            <span>Rise</span>
                            <strong>{riseFallStats.risePct}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill green" style={{ width: `${riseFallStats.risePct}%` }} /></div>

                        <div className="cat-stat-head">
                            <span>Fall</span>
                            <strong>{riseFallStats.fallPct}%</strong>
                        </div>
                        <div className="cat-bar"><div className="cat-fill red" style={{ width: `${riseFallStats.fallPct}%` }} /></div>
                    </div>

                    <div className="cat-seq-section">
                        <span className="cat-seq-lbl">RECENT SEQUENCE</span>
                        <div className="cat-seq-tiles">
                            {riseFallStats.recent.map((val, idx) => (
                                <span key={idx} className={`cat-tile ${val === 'R' ? 'tile-green' : 'tile-red'}`}>
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
