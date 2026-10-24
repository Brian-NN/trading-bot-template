import React from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
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
        id: 'nexus-speedbot',
        title: 'Nexus Speedbot V5',
        badge: 'TICK VOLATILITY',
        badgeColor: '#8b5cf6',
        buttonColor: '#8b5cf6',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
        xmlUrl: '/bots/nexus_speedbot.xml',
    },
    {
        id: 'zeus-print',
        title: 'Zeus Print',
        badge: 'EVEN / ODD',
        badgeColor: '#f97316',
        buttonColor: '#3b82f6',
        imageUrl: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=500&auto=format&fit=crop&q=60',
        xmlUrl: '/bots/zeus_print.xml',
    },
    {
        id: 'even-odd-analyzer',
        title: 'Even Odd Percentage Analyser',
        badge: 'DIGIT DIFFERS',
        badgeColor: '#10b981',
        buttonColor: '#10b981',
        imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=500&auto=format&fit=crop&q=60',
        xmlUrl: '/bots/even_odd.xml',
    },
];

interface FreeBotsProps {
    handleTabChange: (tab_index: number) => void;
}

const FreeBots: React.FC<FreeBotsProps> = ({ handleTabChange }) => {
    const handleLoadBot = async (bot: BotCard) => {
        try {
            const response = await fetch(bot.xmlUrl);
            const xmlText = await response.text();

            // Load into Deriv's Blockly workspace
            const blockly = (window as any).Blockly;
            if (blockly?.derivWorkspace) {
                const dom = blockly.utils.xml.textToDom(xmlText);
                blockly.derivWorkspace.clear();
                blockly.Xml.domToWorkspace(dom, blockly.derivWorkspace);
            }

            // Switch to Bot Builder tab
            handleTabChange(DBOT_TABS.BOT_BUILDER);
        } catch (error) {
            console.error('Failed to load bot XML:', error);
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
