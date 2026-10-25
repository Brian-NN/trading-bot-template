import React, { useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import './free-bots.scss';

// Change this to your own site name.
const BRAND_NAME = 'BNN Trading Hub';

type ArtKind = 'evenodd' | 'risefall' | 'overunder' | 'matches';

interface BotCard {
    id: string;
    title: string;
    description: string;
    tags: string[]; // small pills shown on the card image
    art: ArtKind; // which built-in illustration to draw
    accent: string; // button / label colour
    accentDark: string; // second colour of the button gradient
    xmlUrl: string; // file inside public/bots/
}

// Add more bots by copying an entry and putting its .xml file in public/bots/
const BOTS_LIST: BotCard[] = [
    {
        id: 'even-odd-ai',
        title: 'Even/Odd Frequency Bot',
        description: 'Follows the more frequent digit parity, with Martingale recovery and a max-stake stop.',
        tags: ['Even / Odd', 'Vol 50 (1s)'],
        art: 'evenodd',
        accent: '#16a34a',
        accentDark: '#15803d',
        xmlUrl: '/bots/EO_AI.xml',
    },
      {
        id: 'even-odd-switching',
        title: 'EOS',
        description: 'Follows the more frequent digit parity, with Martingale recovery and a max-stake stop.',
        tags: ['Even / Odd', 'Vol 50 (1s)'],
        art: 'evenodd',
        accent: '#16a34a',
        accentDark: '#15803d',
        xmlUrl: '/bots/fixed_switching_bot.xml',
    },
];

/* ---------- Built-in illustrations (no image files needed) ---------- */
const Art: React.FC<{ kind: ArtKind }> = ({ kind }) => {
    switch (kind) {
        case 'evenodd':
            return (
                <svg viewBox='0 0 240 140' role='img' aria-label='Even and odd digits'>
                    <rect x='28' y='30' width='80' height='80' rx='18' className='art-tile art-tile--a' />
                    <rect x='132' y='30' width='80' height='80' rx='18' className='art-tile art-tile--b' />
                    <text x='68' y='86' textAnchor='middle' className='art-letter'>E</text>
                    <text x='172' y='86' textAnchor='middle' className='art-letter'>O</text>
                </svg>
            );
        case 'risefall':
            return (
                <svg viewBox='0 0 240 140' role='img' aria-label='Rise and fall'>
                    <polyline points='24,100 80,60 120,84 170,36 216,48' className='art-line' />
                    <polygon points='170,22 190,46 150,46' className='art-fill' />
                </svg>
            );
        case 'overunder':
            return (
                <svg viewBox='0 0 240 140' role='img' aria-label='Over and under'>
                    <text x='62' y='88' textAnchor='middle' className='art-letter'>&gt;</text>
                    <text x='178' y='88' textAnchor='middle' className='art-letter'>&lt;</text>
                    <line x1='120' y1='30' x2='120' y2='110' className='art-line art-line--thin' />
                </svg>
            );
        default:
            return (
                <svg viewBox='0 0 240 140' role='img' aria-label='Target'>
                    <circle cx='120' cy='70' r='52' className='art-ring' />
                    <circle cx='120' cy='70' r='32' className='art-ring' />
                    <circle cx='120' cy='70' r='12' className='art-fill' />
                </svg>
            );
    }
};

interface FreeBotsProps {
    handleTabChange: (tab_index: number) => void;
}

const FreeBots: React.FC<FreeBotsProps> = ({ handleTabChange }) => {
    const { load_modal } = useStore();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

const handleLoadBot = async (bot: BotCard) => {
    if (loadingId) return;
    setError(null);
    setLoadingId(bot.id);

    try {
        const response = await fetch(bot.xmlUrl);
        if (!response.ok) throw new Error(`Bot file not found: ${bot.xmlUrl}`);
        const xmlText = await response.text();
        if (!xmlText.trim().startsWith('<xml')) {
            throw new Error(`${bot.xmlUrl} is not a valid bot XML file.`);
        }

        // 1. Switch to the Bot Builder tab
        handleTabChange(DBOT_TABS.BOT_BUILDER);

        // 2. Wait for Deriv Blockly workspace and active symbols to initialize
        const blockly = (window as any).Blockly;
        let tries = 0;
        while (!blockly?.derivWorkspace && tries < 50) {
            await new Promise(r => setTimeout(r, 100));
            tries++;
        }

        const workspace = blockly?.derivWorkspace;
        if (!workspace) throw new Error('The Bot Builder did not become ready.');

        // Allow a brief tick for the Deriv WebSocket symbol list to cache
        await new Promise(r => setTimeout(r, 300));

        // 3. Load using Deriv's native strategy loader
        if (typeof load_modal?.loadStrategy === 'function') {
            const xmlBlob = new Blob([xmlText], { type: 'application/xml' });
            const xmlFile = new File([xmlBlob], `${bot.id}.xml`, { type: 'application/xml' });
            await load_modal.loadStrategy(xmlFile);
        } else {
            // Fallback: Direct workspace load
            workspace.clear();
            const xmlDom = blockly.utils.xml.textToDom(xmlText);
            blockly.Xml.domToWorkspace(xmlDom, workspace);

            // Re-render the trade definition block so dropdowns refresh
            const tradeDefBlock = workspace.getAllBlocks(false).find(
                (b: any) => b.type === 'trade_definition'
            );
            if (tradeDefBlock) {
                tradeDefBlock.initSvg?.();
                tradeDefBlock.render?.();
            }
            workspace.cleanUp?.();
        }
    } catch (e) {
        console.error('Failed to load bot:', e);
        setError(e instanceof Error ? e.message : 'Could not load this bot.');
    } finally {
        setLoadingId(null);
    }
};

    return (
        <div className='free-bots-container'>
            <div className='free-bots-hero'>
                <h1>{BRAND_NAME}</h1>
                <p className='free-bots-subtitle'>Free bots</p>
                <span className='free-bots-desc'>
                    Pick a strategy, open it in Bot Builder, and test it on a demo account first.
                </span>
            </div>

            {error && (
                <div className='free-bots-error' role='alert'>
                    Couldn&rsquo;t open that bot: {error}
                </div>
            )}

            <div className='free-bots-grid'>
                {BOTS_LIST.map(bot => {
                    const isLoading = loadingId === bot.id;
                    return (
                        <div
                            key={bot.id}
                            className='free-bot-card'
                            style={{ '--accent': bot.accent, '--accent-dark': bot.accentDark } as React.CSSProperties}
                        >
                            <div className='free-bot-image-wrap'>
                                <div className='free-bot-tags'>
                                    {bot.tags.map(tag => (
                                        <span key={tag} className='free-bot-tag'>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <Art kind={bot.art} />
                            </div>

                            <div className='free-bot-footer'>
                                <span className='free-bot-label'>Free</span>
                                <h3 className='free-bot-title'>{bot.title}</h3>
                                <p className='free-bot-text'>{bot.description}</p>
                                <button
                                    type='button'
                                    className={`free-bot-load-btn${isLoading ? ' is-loading' : ''}`}
                                    disabled={!!loadingId}
                                    onClick={() => handleLoadBot(bot)}
                                >
                                    {isLoading ? (
                                        <>
                                            <span className='free-bot-spinner' aria-hidden='true' />
                                            Opening&hellip;
                                        </>
                                    ) : (
                                        <>
                                            <svg
                                                width='14'
                                                height='14'
                                                viewBox='0 0 24 24'
                                                fill='none'
                                                stroke='currentColor'
                                                strokeWidth='2.5'
                                                aria-hidden='true'
                                            >
                                                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                                                <polyline points='7 10 12 15 17 10' />
                                                <line x1='12' y1='15' x2='12' y2='3' />
                                            </svg>
                                            Load bot
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className='free-bots-note'>
                Trading bots can lose money. Strategies such as Martingale raise your stake after losses and
                can lose an account quickly. Test on a demo account and never trade more than you can afford to lose.
            </p>
        </div>
    );
};

export default FreeBots;
