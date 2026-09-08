import {
  AR_PLATFORM_OPTIONS,
  CURRENCY_OPTIONS,
  QUALITY_OPTIONS,
  UNIT_OPTIONS,
} from '../config.js';
import { sharedT } from '../i18n.js?v=25';
import { sharedIcon } from '../icons.js?v=22';
import { escapeHtml } from '../utils.js';
import { accountOrdersLabel, installAccountOrders } from './accountOrders.js?v=1';


installAccountOrders();

const DOMAIN_OPTIONS = Object.freeze([
  { locale: 'en-US', suffix: 'COM', flag: '🇺🇸' },
  { locale: 'ro-RO', suffix: 'RO', flag: '🇷🇴' },
  { locale: 'de-DE', suffix: 'DE', flag: '🇩🇪' },
]);

function renderDomainControl(locale, domainOpen = false, currentDomainLocale = 'en-US') {
  return `
    <button type="button" data-action="toggle-domain-menu" aria-expanded="${domainOpen}">
      <span class="account-menu__domain-icon" aria-hidden="true">🌐</span>
      <strong>${escapeHtml(sharedT(locale, 'account.changeSiteDomain'))}</strong>
      <span class="account-menu__chevron">›</span>
    </button>
    <div class="account-domain" data-account-domain>
      ${DOMAIN_OPTIONS.map((option) => `
        <button type="button" data-action="select-domain" data-domain-locale="${option.locale}" ${option.locale === currentDomainLocale ? 'aria-current="true"' : ''}>
          <strong>${option.suffix}</strong>
          <span class="account-domain__flag" aria-hidden="true">${option.flag}</span>
          <span class="account-domain__check" aria-hidden="true">${option.locale === currentDomainLocale ? '✓' : ''}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function localizedOptions(locale, path, options) {
  const namespaces = {
    units: 'settings.units',
    currency: 'settings.currency',
    quality: 'settings.quality',
    defaultArPlatform: 'settings.ar',
  };
  const namespace = namespaces[path];
  return options.map((option) => ({
    ...option,
    label: namespace ? sharedT(locale, `${namespace}.${option.value}`) : option.label,
  }));
}

function renderSettingsSelect(locale, labelKey, path, value, options) {
  const label = sharedT(locale, labelKey);
  const localized = localizedOptions(locale, path, options);
  return `
    <label class="account-settings__field">
      <span>${escapeHtml(label)}</span>
      <select data-path="${path}" aria-label="${escapeHtml(label)}">
        ${localized.map((option) => `<option value="${option.value}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
  `;
}

function accountDisplayName(user) {
  const displayName = String(user?.displayName || '').trim();
  if (displayName) return displayName;
  const email = String(user?.email || '').trim();
  if (email) return email;
  return sharedT('en-US', 'account.userFallback');
}

function accountInitials(user) {
  const source = String(user?.displayName || '').trim() || String(user?.email || '').split('@')[0] || 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  const value = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : source.slice(0, 2);
  return value.toUpperCase();
}

export function syncAccountIdentity(root, locale, user, { busy = false } = {}) {
  if (!root) return;
  const authenticated = Boolean(user?.uid);
  const greeting = root.querySelector('[data-account-greeting]');
  const loginButton = root.querySelector('[data-action="account-login"]');
  const signOutButton = root.querySelector('[data-action="account-signout"]');
  const authenticatedContent = root.querySelector('[data-account-authenticated-content]');
  const guestDomainContent = root.querySelector('[data-account-guest-domain-content]');

  if (greeting) {
    greeting.textContent = authenticated
      ? sharedT(locale, 'account.greetingUser', { name: accountDisplayName(user) })
      : sharedT(locale, 'account.greetingGuest');
  }

  if (loginButton) {
    loginButton.hidden = authenticated;
    loginButton.disabled = busy;
    loginButton.setAttribute('aria-busy', String(Boolean(busy)));
    const label = loginButton.querySelector('[data-account-login-label]');
    if (label) label.textContent = sharedT(locale, busy ? 'account.signingIn' : 'account.loginGoogle');
  }
  if (signOutButton) signOutButton.hidden = !authenticated;
  if (authenticatedContent) authenticatedContent.hidden = !authenticated;
  if (guestDomainContent) guestDomainContent.hidden = authenticated;
}

export function renderAccountMenu(state) {
  const locale = state.locale;
  const authenticated = Boolean(state.authUser?.uid);
  const domainOpen = Boolean(state.domainOpen);
  const helpOpen = Boolean(state.helpOpen);
  const currentDomainLocale = String(state.currentDomainLocale || 'en-US');
  const greeting = authenticated
    ? sharedT(locale, 'account.greetingUser', { name: accountDisplayName(state.authUser) })
    : sharedT(locale, 'account.greetingGuest');
  const avatarUrl = authenticated ? String(state.profileAvatarUrl || '') : '';
  const avatarInitials = authenticated ? accountInitials(state.authUser) : '';
  return `
    <section class="account-menu" data-account-menu aria-label="${escapeHtml(sharedT(locale, 'account.menu'))}">
      <div class="account-menu__profile">
        <span class="account-menu__avatar">${authenticated ? (avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" />` : `<strong class="account-menu__avatar-initials">${escapeHtml(avatarInitials)}</strong>`) : sharedIcon('account')}</span>
        <strong data-account-greeting>${escapeHtml(greeting)}</strong>
        <button class="account-menu__login" type="button" data-action="account-login" ${authenticated ? 'hidden' : ''}>
          <span>${sharedIcon('account')}</span>
          <strong data-account-login-label>${escapeHtml(sharedT(locale, 'account.loginGoogle'))}</strong>
        </button>
      </div>
      <div data-account-guest-domain-content ${authenticated ? 'hidden' : ''}>
        <nav class="account-menu__items account-menu__items--guest">
          ${renderDomainControl(locale, domainOpen, currentDomainLocale)}
        </nav>
      </div>
      <div data-account-authenticated-content ${authenticated ? '' : 'hidden'}>
        <nav class="account-menu__items">
<<<<<<< Updated upstream
          <button type="button" data-action="account-profile"><span>${sharedIcon('account')}</span><strong>${escapeHtml(sharedT(locale, 'account.profile'))}</strong></button>
=======
          ${profile ? `<button type="button" data-action="account-profile"><span>${sharedIcon('account')}</span><strong>${escapeHtml(sharedT(locale, 'account.profile'))}</strong></button>` : ''}
          <button type="button" data-action="account-orders"><span>${sharedIcon('cart')}</span><strong>${escapeHtml(accountOrdersLabel(locale))}</strong></button>
>>>>>>> Stashed changes
          <button type="button" data-action="account-saved"><span>${sharedIcon('folder')}</span><strong>${escapeHtml(sharedT(locale, 'account.saved'))}</strong></button>
          ${renderDomainControl(locale, domainOpen, currentDomainLocale)}
          <button class="account-menu__help" type="button" data-action="toggle-account-help" aria-expanded="${helpOpen}">
            <span class="account-menu__help-icon">${sharedIcon('help')}</span>
            <strong>${escapeHtml(sharedT(locale, 'account.help'))}</strong>
            <span class="account-menu__chevron">›</span>
          </button>
          <div class="account-help" data-account-help>
            <span class="account-help__prompt">${escapeHtml(sharedT(locale, 'account.helpContact'))}</span>
            <button class="account-help__email" type="button" data-action="account-support-email">
              <span class="account-help__mail-icon" aria-hidden="true">${sharedIcon('supportMail')}</span>
              <strong>office@360configurator.com</strong>
            </button>
          </div>
          <button type="button" data-action="toggle-account-settings" aria-expanded="false"><span>${sharedIcon('settings')}</span><strong>${escapeHtml(sharedT(locale, 'account.settings'))}</strong><span class="account-menu__chevron">›</span></button>
          <div class="account-settings" data-account-settings>
            ${renderSettingsSelect(locale, 'account.measuringUnits', 'units', state.units, UNIT_OPTIONS)}
            ${renderSettingsSelect(locale, 'account.currency', 'currency', state.currency, CURRENCY_OPTIONS)}
            ${renderSettingsSelect(locale, 'account.quality', 'quality', state.quality, QUALITY_OPTIONS)}
            ${renderSettingsSelect(locale, 'account.defaultArPlatform', 'defaultArPlatform', state.defaultArPlatform, AR_PLATFORM_OPTIONS)}
            <button class="account-settings__toggle" type="button" data-action="toggle-dark-mode" aria-pressed="${state.darkMode}">
              <span>${escapeHtml(sharedT(locale, 'account.darkMode'))}</span>
              <span class="settings-toggle-value"><strong data-dark-mode-label>${escapeHtml(sharedT(locale, state.darkMode ? 'account.on' : 'account.off'))}</strong><span class="settings-switch ${state.darkMode ? 'is-on' : ''}" aria-hidden="true"><span></span></span></span>
            </button>
            <button class="account-settings__cookies" type="button" data-action="cookies-placeholder">
              <span>${escapeHtml(sharedT(locale, 'account.cookies'))}</span><strong>${escapeHtml(sharedT(locale, 'account.manage'))}</strong>
            </button>
          </div>
          <button type="button" data-action="account-signout"><span>${sharedIcon('signout')}</span><strong>${escapeHtml(sharedT(locale, 'account.signOut'))}</strong></button>
        </nav>
      </div>
    </section>
  `;
}
