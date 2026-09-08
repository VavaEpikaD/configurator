import { getLanguageProfile } from '../config.js';
import { sharedT } from '../i18n.js?v=21';
import { sharedIcon } from '../icons.js?v=22';
import { escapeHtml } from '../utils.js';
import { renderAccountMenu } from './accountMenu.js?v=24';
import { renderLanguageMenu } from './languageMenu.js';

function iconButton({ action, label, icon, disabled = false, extraClass = '' }) {
  return `
    <button class="topbar-icon-button ${extraClass}" type="button" data-action="${escapeHtml(action)}" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${disabled ? 'disabled aria-disabled="true"' : ''}>
      ${icon}
    </button>
  `;
}

function newConfigurationButton(locale, disabled = false) {
  return iconButton({
    action: 'new-configuration',
    label: sharedT(locale, 'topbar.newConfiguration'),
    icon: sharedIcon('newConfiguration'),
    disabled,
  });
}

function saveButton(locale, disabled = false) {
  const label = sharedT(locale, 'topbar.save');
  return `
    <button class="topbar-icon-button save-preview-button" type="button" data-action="save" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${disabled ? 'disabled aria-disabled="true"' : ''}>
      <span class="save-icon save-icon--cloud">${sharedIcon('cloud')}</span>
      <span class="save-icon save-icon--success">${sharedIcon('success')}</span>
    </button>
  `;
}

function shareButton(locale, disabled = false) {
  const label = sharedT(locale, 'topbar.share');
  return `
    <button class="topbar-icon-button share-preview-button" type="button" data-action="share" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${disabled ? 'disabled aria-disabled="true"' : ''}>
      <span class="share-icon share-icon--default">${sharedIcon('share')}</span>
      <span class="share-icon share-icon--success">${sharedIcon('success')}</span>
    </button>
  `;
}

function cartButton(locale, count = 0, open = false) {
  const label = sharedT(locale, 'topbar.cart');
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const badgeText = safeCount > 99 ? '99+' : String(safeCount);
  const accessibleLabel = safeCount > 0 ? `${label} (${safeCount})` : label;
  return `
    <button class="topbar-icon-button cart-button" type="button" data-action="cart" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(accessibleLabel)}" aria-expanded="${Boolean(open)}">
      <span class="cart-icon">${sharedIcon('cart')}</span>
      <span class="cart-count-badge" data-cart-count ${safeCount > 0 ? '' : 'hidden'} aria-hidden="true">${escapeHtml(badgeText)}</span>
    </button>
  `;
}

export function renderTopBar({ brandSrc, brandAlt, projectName, state, capabilities = {} }) {
  const locale = state.locale;
  const authenticated = Boolean(state.authUser?.uid);
  const canViewAR = capabilities.viewAR !== false;
  const canSave = capabilities.save !== false && authenticated;
  const canNewConfiguration = capabilities.save !== false && authenticated;
  const canUndo = capabilities.undo !== false;
  const canReset = capabilities.reset !== false;
  const canShare = capabilities.share !== false;
  const language = getLanguageProfile(locale);
  const labels = {
    home: sharedT(locale, 'topbar.home'),
    projectName: sharedT(locale, 'topbar.projectName'),
    unsaved: sharedT(locale, 'topbar.unsavedChanges'),
    viewAr: sharedT(locale, 'topbar.viewAr'),
    undo: sharedT(locale, 'topbar.undo'),
    reset: sharedT(locale, 'topbar.reset'),
    account: sharedT(locale, 'topbar.account'),
  };

  return `
    <header class="site-header">
      <div class="site-header__brand-cluster">
        <a class="brand" href="#" aria-label="${escapeHtml(labels.home)}">
          <img src="${escapeHtml(brandSrc)}" alt="${escapeHtml(brandAlt)}" />
        </a>
        <button class="book-demo-button" type="button" data-action="book-demo" aria-label="Book a demo">
          <span class="book-demo-button__label">Book a demo</span>
        </button>
      </div>

      <div class="project-name-shell ${authenticated ? '' : 'is-guest'}">
        <span class="project-name-measure" data-project-name-measure aria-hidden="true">${escapeHtml(projectName)}</span>
        <input class="project-name-input" type="text" value="${escapeHtml(projectName)}" maxlength="80" data-project-name aria-label="${escapeHtml(labels.projectName)}" spellcheck="false" ${authenticated ? '' : 'readonly disabled tabindex="-1" aria-readonly="true" aria-disabled="true"'} />
        <span class="project-dirty-indicator" data-project-dirty aria-label="${escapeHtml(labels.unsaved)}">*</span>
      </div>

      <div class="site-header__actions">
        ${newConfigurationButton(locale, !canNewConfiguration)}
        ${saveButton(locale, !canSave)}
        ${iconButton({ action: 'view-ar', label: labels.viewAr, icon: sharedIcon('ar'), disabled: !canViewAR })}
        ${iconButton({ action: 'undo', label: labels.undo, icon: sharedIcon('undo'), disabled: !canUndo })}
        ${iconButton({ action: 'reset', label: labels.reset, icon: sharedIcon('reset'), disabled: !canReset })}
        ${shareButton(locale, !canShare)}
        ${cartButton(locale, state.cartCount, state.cartOpen)}
        ${iconButton({ action: 'account', label: labels.account, icon: sharedIcon('account') })}
        <button class="topbar-icon-button language-button" type="button" data-action="language" data-tooltip="${escapeHtml(language.nativeName)}" aria-label="${escapeHtml(language.nativeName)}" aria-expanded="false">
          <span class="language-flag" data-language-button-flag aria-hidden="true">${language.flag}</span>
        </button>
      </div>

      ${renderAccountMenu(state, { profile: capabilities.profile !== false })}
      ${renderLanguageMenu(locale)}
    </header>
  `;
}
