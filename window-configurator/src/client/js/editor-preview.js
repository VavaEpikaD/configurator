import { WINDOW_SIZE_CONTROLS, applyWindowSliderBounds, validateWindowSizeLimits } from '../../../../shared-ui/src/windowSizeSettings.js?v=1';

const element = id => document.getElementById(id);
const groupIds = ['mill', 'anodized', 'coated'];
let groups = null;
let lastGroup = '';
let mode = 'same';
const selections = { outside: { type: 'coated', id: '' }, inside: { type: 'mill', id: '' } };
const send = message => { if (window.parent !== window) window.parent.postMessage(message, location.origin); };
const ready = () => send({ type: 'window-editor-preview-ready' });
const resize = () => send({ type: 'window-editor-preview-height', height: element('preview-content').offsetHeight + 6 });

function renderSide(side) {
  const selection = selections[side];
  const colors = groups[selection.type];
  if (!colors.some(color => color.id === selection.id)) selection.id = colors[0].id;
  element(`${side}FinishType`).querySelectorAll('button').forEach(button => {
    const active = button.dataset.finishType === selection.type;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  const container = element(`${side}FinishSwatches`);
  container.replaceChildren(...colors.map(color => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'finish-swatch';
    button.classList.toggle('active', selection.id === color.id);
    button.style.setProperty('--swatch-color', /^#[0-9a-f]{6}$/i.test(color.color) ? color.color : '#ffffff');
    const label = color.name.trim() || 'Unnamed color';
    button.title = label; button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(selection.id === color.id));
    button.addEventListener('click', () => {
      selection.id = color.id;
      [...container.children].forEach((swatch, index) => {
        const active = colors[index].id === selection.id;
        swatch.classList.toggle('active', active); swatch.setAttribute('aria-pressed', String(active));
      });
      element(`${side}FinishName`).textContent = label; resize();
    });
    return button;
  }));
  element(`${side}FinishName`).textContent = colors.find(color => color.id === selection.id)?.name || 'Unnamed color';
}
function renderColors() {
  if (!groups) return;
  element('insideFinishCard').hidden = mode === 'same';
  element('outsideFinishTitle').textContent = mode === 'same' ? 'Inside / outside' : 'Outside';
  for (const [id, active] of [['finishModeSame', mode === 'same'], ['finishModeDifferent', mode === 'different']]) {
    element(id).classList.toggle('active', active); element(id).setAttribute('aria-pressed', String(active));
  }
  renderSide('outside'); renderSide('inside'); resize();
}
for (const side of ['outside', 'inside']) {
  element(`${side}FinishType`).querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    selections[side] = { type: button.dataset.finishType, id: '' }; renderColors();
  }));
}
for (const [id, value] of [['finishModeSame', 'same'], ['finishModeDifferent', 'different']]) {
  element(id).addEventListener('click', () => { mode = value; renderColors(); });
}
for (const control of WINDOW_SIZE_CONTROLS) {
  const range = element(control.rangeId), number = element(control.valueId);
  const commit = value => {
    const next = Math.min(Number(range.max), Math.max(Number(range.min), Number.isFinite(value) ? value : Number(range.value)));
    range.value = next.toFixed(3); number.value = String(Math.round(next * 1000));
  };
  range.addEventListener('input', () => commit(Number(range.value)));
  number.addEventListener('change', () => commit(number.value === '' ? NaN : Number(number.value) / 1000));
  number.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commit(number.value === '' ? NaN : Number(number.value) / 1000); } });
  const row = range.closest('.selected-window-size-row');
  row.querySelector('button:first-child').addEventListener('click', () => commit(Number(range.value) - .001));
  row.querySelector('button:last-child').addEventListener('click', () => commit(Number(range.value) + .001));
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent) return;
  if (event.data?.type === 'window-editor-preview-ping') { ready(); return; }
  if (event.data?.type === 'window-editor-preview-clear') { groups = null; element('preview-content').hidden = true; resize(); return; }
  if (event.data?.type !== 'window-editor-preview') return;
  try {
    const data = event.data;
    const limits = validateWindowSizeLimits(data.sizeLimits);
    if (!data.groups || !groupIds.every(id => Array.isArray(data.groups[id]) && data.groups[id].length > 0 && data.groups[id].length <= 100
      && data.groups[id].every(color => color && typeof color.id === 'string' && color.id.length <= 64 && typeof color.name === 'string' && color.name.length <= 120 && typeof color.color === 'string' && color.color.length <= 7))) return;
    groups = data.groups;
    if (groupIds.includes(data.activeGroup) && data.activeGroup !== lastGroup) {
      lastGroup = data.activeGroup; selections.outside = { type: lastGroup, id: '' };
    }
    element('preview-content').hidden = false;
    const sizes = data.section === 'sizes';
    element('aluminiumFinishControls').hidden = sizes;
    element('overallWindowSizeControls').hidden = !sizes;
    element('selected-window-panel').hidden = !sizes;
    applyWindowSliderBounds(limits);
    for (const control of WINDOW_SIZE_CONTROLS) {
      const range = element(control.rangeId); element(control.valueId).value = String(Math.round(Number(range.value) * 1000));
    }
    renderColors();
  } catch { /* A partial draft cannot make the isolated preview execute unsafe data. */ }
});
new ResizeObserver(resize).observe(element('preview-content'));
document.fonts?.ready.then(resize);
ready();
