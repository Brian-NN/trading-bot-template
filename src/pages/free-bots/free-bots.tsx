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
        if (!response.ok) throw new Error(`Bot file not found: ${bot.xmlUrl}`);
        const xmlText = await response.text();
        if (!xmlText.trim().startsWith('<xml')) {
            throw new Error('File is not a bot XML (is the path right?)');
        }

        handleTabChange(DBOT_TABS.BOT_BUILDER);

        // Wait up to 5 seconds for the workspace instead of guessing 100 ms
        const blockly = (window as any).Blockly;
        let tries = 0;
        while (!blockly?.derivWorkspace && tries < 50) {
            await new Promise(r => setTimeout(r, 100));
            tries++;
        }
        const workspace = blockly?.derivWorkspace;
        if (!workspace) throw new Error('Workspace never became ready');

        if (typeof load_modal?.loadStrategy === 'function') {
            const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
            await load_modal.loadStrategy(xmlDoc);
        } else {
            blockly.Events.disable();
            try {
                workspace.clear();
                const xmlDom = blockly.utils.xml.textToDom(xmlText);
                blockly.Xml.domToWorkspace(xmlDom, workspace);
                workspace.cleanUp?.();
            } finally {
                blockly.Events.enable(); // always runs
            }
        }
    } catch (error) {
        console.error('Failed to load bot:', error);
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
