// Updated to use brand configuration for footer elements visibility
// Controls language settings and theme toggle via brand.config.json
import React, { useState } from 'react';
import brandConfig from '@/../brand.config.json';
import { useApiBase } from '@/hooks/useApiBase';
import useModalManager from '@/hooks/useModalManager';
import { getActiveTabUrl } from '@/utils/getActiveTabUrl';
import { FILTERED_LANGUAGES } from '@/utils/languages';
import { useTranslations } from '@deriv-com/translations';
import { DesktopLanguagesModal } from '@deriv-com/ui';
import ChangeTheme from './ChangeTheme';
import FullScreen from './FullScreen';
import LanguageSettings from './LanguageSettings';
import LogoutFooter from './LogoutFooter';
import NetworkStatus from './NetworkStatus';
import ServerTime from './ServerTime';
import './footer.scss';

export const RiskDisclaimerModal = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type='button'
                className='risk-disclaimer-btn'
                onClick={() => setIsOpen(true)}
            >
                <span className='risk-icon'>⚠️</span>
                <span className='risk-label'>Risk Disclaimer</span>
            </button>

            {isOpen && (
                <div className='risk-modal-overlay' onClick={() => setIsOpen(false)}>
                    <div className='risk-modal-content' onClick={(e) => e.stopPropagation()}>
                        <div className='risk-modal-header'>
                            <h3>Risk Warning & Disclaimer</h3>
                            <button
                                type='button'
                                className='risk-modal-close'
                                onClick={() => setIsOpen(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className='risk-modal-body'>
                            <p>
                                Trading derivatives carries a high level of risk to your capital and you should only trade with money you can afford to lose. Trading derivatives may not be suitable for all investors.
                            </p>
                            <p>
                                Ensure you fully understand the risks involved and seek independent financial advice if necessary. Past performance of any automated strategy does not guarantee future results.
                            </p>
                            <p>
                                This platform is powered by the Deriv API but is operated independently.
                            </p>
                        </div>
                        <div className='risk-modal-footer'>
                            <button
                                type='button'
                                className='risk-modal-confirm-btn'
                                onClick={() => setIsOpen(false)}
                            >
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const Footer = () => {
    const { currentLang = 'EN', localize, switchLanguage } = useTranslations();
    const { hideModal, isModalOpenFor, showModal } = useModalManager();
    const { isAuthorized } = useApiBase();

    // Get footer configuration from brand.config.json
    const enableLanguageSettings = brandConfig.platform.footer?.enable_language_settings ?? true;
    const enableThemeToggle = brandConfig.platform.footer?.enable_theme_toggle ?? true;

    const openLanguageSettingModal = () => showModal('DesktopLanguagesModal');

    return (
        <footer className='app-footer'>
            <FullScreen />
            {isAuthorized && <LogoutFooter />}
            {/* [AI] Conditionally render language settings based on brand config */}
            {enableLanguageSettings && (
                <>
                    <LanguageSettings openLanguageSettingModal={openLanguageSettingModal} />
                    <div className='app-footer__vertical-line' />
                </>
            )}
            {/* [/AI] */}
            {/* [AI] Conditionally render theme toggle based on brand config */}
            {enableThemeToggle && (
                <>
                    <ChangeTheme />
                    <div className='app-footer__vertical-line' />
                </>
            )}
            {/* [/AI] */}
            <ServerTime />
            <div className='app-footer__vertical-line' />
            <NetworkStatus />
            <div className='app-footer__vertical-line' />
            <RiskDisclaimerModal />

            {/* [AI] Only show language modal if language settings are enabled */}
            {enableLanguageSettings && isModalOpenFor('DesktopLanguagesModal') && (
                <DesktopLanguagesModal
                    headerTitle={localize('Select Language')}
                    isModalOpen
                    languages={FILTERED_LANGUAGES}
                    onClose={hideModal}
                    onLanguageSwitch={code => {
                        try {
                            switchLanguage(code);
                            hideModal();
                            window.location.replace(getActiveTabUrl());
                        } catch (error) {
                            console.error('Failed to switch language:', error);
                            hideModal();
                        }
                    }}
                    selectedLanguage={currentLang}
                />
            )}
            {/* [/AI] */}
        </footer>
    );
};

export default Footer;
