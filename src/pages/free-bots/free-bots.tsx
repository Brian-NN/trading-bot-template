import React from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import './free-bots.scss';

interface BotCard {
    id: string;
    title: string;
    badge: string;
    badgeColor: string;
    buttonColor: string;
    imageUrl: string;
    xmlUrl: string;
}

const BOTS_LIST: BotCard[] = [
    {
        id: 'even-odd-ai',
        title: 'Even Odd AI Strategy',
        badge: 'EVEN / ODD',
        badgeColor: '#10b981',
        buttonColor: '#10b981',
        imageUrl: '/bots/even_odd_preview.jpg',
        xmlUrl: '/bots/EO_AI.xml',
    },
    {
        id: 'nexus-speedbot',
        title: 'Nexus Speedbot V5',
        badge: 'TICK VOLATILITY',
        badgeColor: '#8b5cf6',
        buttonColor: '#8b5cf6',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
        xmlUrl: '/bots/nexus_speedbot.xml',
    },
];

interface FreeBotsProps {
    handleTabChange: (tab_index: number) => void;
}

const FreeBots: React.FC<FreeBotsProps> = ({ handleTabChange }) => {
    const { load_modal } = useStore();

   const handleLoadBot = async (bot: BotCard) => {
        try {
            const response = await fetch(bot.xmlUrl);
            const xmlText = await response.text();

            // 1. Switch to Bot Builder tab so the canvas is mounted
            handleTabChange(DBOT_TABS.BOT_BUILDER);

            setTimeout(async () => {
                try {
                    const blockly = (window as any).Blockly;
                    const workspace = blockly?.derivWorkspace;

                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

                    // 2. Use Deriv's official loadStrategy method
                    if (typeof load_modal?.loadStrategy === 'function') {
                        await load_modal.loadStrategy(xmlDoc);
                    } else if (workspace && blockly) {
                        // 3. Fallback: silent domToWorkspace injection
                        blockly.Events.disable();
                        workspace.clear();

                        const xmlDom = blockly.utils.xml.textToDom(xmlText);
                        blockly.Xml.domToWorkspace(xmlDom, workspace);

                        blockly.Events.enable();

                        if (typeof workspace.cleanUp === 'function') {
                            workspace.cleanUp();
                        }
                    }
                } catch (loadErr) {
                    console.error('Workspace load error:', loadErr);
                }
            }, 100);
        } catch (error) {
            console.error('Failed to fetch bot XML:', error);
            handleTabChange(DBOT_TABS.BOT_BUILDER);
        }
    };

    return (
        <div className="free-bots-container">
            <div className="free-bots-hero">
                <h1>Titan Trader</h1>
                <p className="free-bots-subtitle">Free bots</p>
                <span className="free-bots-desc">Load a bot and start trading, safely today.</span>
            </div>

            <div className="free-bots-grid">
                {BOTS_LIST.map((bot) => (
                    <div key={bot.id} className="free-bot-card">
                        <div className="free-bot-badge" style={{ backgroundColor: bot.badgeColor }}>
                            {bot.badge}
                        </div>
                        <div className="free-bot-image-wrap">
                            <img src={bot.imageUrl} alt={bot.title} />
                        </div>
                        <div className="free-bot-footer">
                            <h3 className="free-bot-title">{bot.title}</h3>
                            <button
                                type="button"
                                className="free-bot-load-btn"
                                style={{ backgroundColor: bot.buttonColor }}
                                onClick={() => handleLoadBot(bot)}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Load Bot
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FreeBots;
