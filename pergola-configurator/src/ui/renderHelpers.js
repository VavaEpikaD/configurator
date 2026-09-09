import { escapeHtml } from '../../../shared-ui/src/index.js';

export function optionCard({ value, label, description = '', icon = '', badge = '', disabled = false, disabledReason = '' }, selected, path, extraClass = '') {
  return `
    <button class="option-card ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ${extraClass}" type="button" data-option-path="${path}" data-option-value="${value}" aria-pressed="${selected}" ${disabled ? `disabled aria-disabled="true"${disabledReason ? ` title="${escapeHtml(disabledReason)}"` : ''}` : ''}>
      ${icon ? `<span class="option-card__icon"><img src="${icon}" alt="" /></span>` : ''}
      <span class="option-card__copy">
        <strong>${escapeHtml(label)}</strong>
        ${description ? `<small>${escapeHtml(description)}</small>` : ''}
      </span>
      ${badge ? `<span class="option-card__badge">${escapeHtml(badge)}</span>` : ''}
      <span class="option-card__check" aria-hidden="true">✓</span>
    </button>
  `;
}

export function segmented(options, selected, path) {
  return `
    <div class="segmented-control" role="group">
      ${options.map((option) => `
        <button type="button" class="segmented-control__item ${selected === option.value ? 'is-selected' : ''}" data-option-path="${path}" data-option-value="${option.value ?? 'off'}" aria-pressed="${selected === option.value}" ${option.disabled ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(option.label)}</button>
      `).join('')}
    </div>
  `;
}

export function colorSwatches(colors, selected, path) {
  return `
    <div class="color-grid">
      ${colors.map((color) => {
        const label = color.publishedName ?? color.label;
        return `
        <button type="button" class="color-swatch ${selected === color.value ? 'is-selected' : ''}" data-option-path="${path}" data-option-value="${color.value}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" aria-pressed="${selected === color.value}">
          <span style="--swatch:${color.value}"></span>
          <small>${escapeHtml(label)}</small>
        </button>
      `;
      }).join('')}
    </div>
  `;
}
