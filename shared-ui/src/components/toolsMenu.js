import { normalizeToolsPlacement, resolveSharedTools } from '../tools/registry.js';
import { sharedT } from '../i18n.js';
import { escapeHtml } from '../utils.js';

const DEFAULT_TOOL_ITEMS = resolveSharedTools([
  'environment',
  { id: 'dimensions', active: true },
  'compass',
  'camera',
]);

const TOOL_LABEL_KEYS = Object.freeze({
  environment: 'tools.environment',
  dimensions: 'tools.dimensions',
  compass: 'tools.compass',
  camera: 'tools.camera',
  'technical-edges': 'tools.technicalEdges',
  explode: 'tools.explode',
});

/**
 * The launcher can render a chosen subset of the root tool pool. Standalone
 * Window and Roof integrations explicitly pass an empty array, so no tool is
 * enabled there until that configurator's developer opts in.
 */
export function renderToolsMenu(open, { items = DEFAULT_TOOL_ITEMS, placement = {}, locale = 'en-US' } = {}) {
  if (!Array.isArray(items) || items.length === 0) return '';

  const resolvedPlacement = normalizeToolsPlacement(placement);
  const style = [
    `--shared-tools-offset-x:${Number(resolvedPlacement.offsetX) || 0}px`,
    `--shared-tools-offset-y:${Number(resolvedPlacement.offsetY) || 0}px`,
  ].join(';');
  const toggleLabel = sharedT(locale, 'tools.toggle');

  return `
    <div
      class="viewport-toolbar viewport-toolbar--${escapeHtml(resolvedPlacement.side)} tools-toolbar tools-toolbar--${escapeHtml(resolvedPlacement.side)} tools-toolbar--${escapeHtml(resolvedPlacement.direction)} ${open ? 'is-open' : ''}"
      data-shared-tools
      data-tools-side="${escapeHtml(resolvedPlacement.side)}"
      data-tools-direction="${escapeHtml(resolvedPlacement.direction)}"
      style="${style}"
    >
      <button class="tool-launcher ${open ? 'is-active' : ''}" type="button" data-action="toggle-tools" aria-expanded="${open}" aria-label="${escapeHtml(toggleLabel)}">${escapeHtml(sharedT(locale, 'tools.label'))}</button>
      <div class="tools-toolbar__panel ${open ? 'is-open' : ''}">
        ${items.map((item) => {
          const labelKey = TOOL_LABEL_KEYS[item.id ?? item.action];
          const label = labelKey ? sharedT(locale, labelKey) : item.label;
          return `
          <button
            class="round-tool ${item.active ? 'is-active' : ''}"
            type="button"
            data-action="${escapeHtml(item.action)}"
            data-tool-id="${escapeHtml(item.id ?? item.action)}"
            aria-label="${escapeHtml(label)}"
            ${item.tooltip === false ? '' : `title="${escapeHtml(label)}"`}
            ${item.disabled ? 'disabled aria-disabled="true"' : ''}
          ><span aria-hidden="true">${item.icon ?? ''}</span></button>`;
        }).join('')}
      </div>
    </div>
  `;
}
