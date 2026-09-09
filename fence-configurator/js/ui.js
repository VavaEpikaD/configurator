import { PANEL_STYLES, activeRunIds, deriveFenceMetrics, normalizeFenceState } from './state.js?v=4';
import { getAvailableFenceFinishes, resolveFenceFinish, selectFenceFinish } from './finish-catalog.js?v=1';
import { buildFenceBom, fenceBomCsv, formatMoney } from './bom.js?v=4';
import { applyFenceTranslations, fenceT, resolveFenceLocale } from './i18n.js?v=4';

const CONTROL_CONFIG = Object.freeze({
  runA: { kind: 'length', min: 2, max: 30, step: 0.25 },
  runB: { kind: 'length', min: 2, max: 20, step: 0.25 },
  runC: { kind: 'length', min: 2, max: 20, step: 0.25 },
  runD: { kind: 'length', min: 2, max: 20, step: 0.25 },
  angleB: { kind: 'angle', min: 30, max: 150, step: 1 },
  height: { kind: 'length', min: 0.8, max: 2.6, step: 0.05 },
  targetBayWidth: { kind: 'length', min: 1, max: 3, step: 0.05 },
  infillGap: { kind: 'small', min: 0.015, max: 0.12, step: 0.005 },
});

export class FenceUI {
  constructor(state, callbacks = {}, locale = resolveFenceLocale()) {
    this.state = state;
    this.callbacks = callbacks;
    this.locale = locale;
    this.units = 'metric';
    this.currency = 'EUR';
    this.bind();
    this.setLocale(locale);
  }

  bind() {
    document.querySelectorAll('[data-accordion]').forEach((section) => {
      const button = section.querySelector('.accordion-toggle');
      const panel = section.querySelector('.accordion-panel');
      button?.addEventListener('click', () => {
        const open = !section.classList.contains('is-open');
        section.classList.toggle('is-open', open);
        button.setAttribute('aria-expanded', String(open));
        if (panel) panel.hidden = !open;
      });
    });

    document.querySelectorAll('[data-layout]').forEach((button) => {
      button.addEventListener('click', () => {
        this.state.layout = button.dataset.layout;
        this.commit({ fitCamera: true });
      });
    });

    document.querySelectorAll('[data-panel-style]').forEach((button) => {
      button.addEventListener('click', () => {
        this.state.panelStyle = button.dataset.panelStyle;
        this.commit();
      });
    });

    document.querySelector('.finish-row')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-finish]');
      if (button && selectFenceFinish(this.state, button.dataset.finish)) this.commit();
    });

    document.querySelectorAll('[data-control]').forEach((control) => this.bindNumericControl(control));

    bindSelect('#foundationType', (value) => { this.state.foundation = value; this.commit(); });

    document.querySelector('#addGateButton')?.addEventListener('click', () => this.addGate());
    document.querySelector('#gateList')?.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-gate-remove]');
      if (remove) this.removeGate(remove.dataset.gateRemove);
    });
    document.querySelector('#gateList')?.addEventListener('change', (event) => {
      const control = event.target.closest('[data-gate-field]');
      if (!control) return;
      const value = control.dataset.gateField === 'position' ? Number(control.value) : control.value;
      this.updateGate(control.dataset.gateId, { [control.dataset.gateField]: value });
    });
    document.querySelector('#gateList')?.addEventListener('input', (event) => {
      const control = event.target.closest('[data-gate-field="position"]');
      if (!control) return;
      const gate = this.state.gates.find((item) => item.id === control.dataset.gateId);
      const from = Number(control.value) + 1;
      const to = gate?.type === 'driveway' ? `–${from + 1}` : '';
      const output = control.closest('.range-control')?.querySelector('output');
      if (output) output.textContent = fenceT(this.locale, 'gate.positionHint', { from, to });
    });

    document.querySelector('#sceneryToggle')?.addEventListener('change', (event) => {
      this.state.scenery = event.target.checked;
      this.callbacks.onDisplayChange?.();
      this.update();
    });

    document.querySelector('#bomOpenButton')?.addEventListener('click', () => document.querySelector('#bomPanel')?.showModal());
    document.querySelector('#bomDoneButton')?.addEventListener('click', () => document.querySelector('#bomPanel')?.close());
    document.querySelector('#bomClose')?.addEventListener('click', () => document.querySelector('#bomPanel')?.close());
    document.querySelector('#bomExportInlineButton')?.addEventListener('click', () => this.exportCsv());
    document.querySelector('#bomExportDialogButton')?.addEventListener('click', () => this.exportCsv());
  }

  bindNumericControl(control) {
    const key = control.dataset.control;
    const config = CONTROL_CONFIG[key];
    if (!config) return;
    const range = control.querySelector('input[type="range"]');
    const number = control.querySelector('input[type="number"]');
    const updateFromDisplay = (input, immediate = false) => {
      const metric = this.toMetric(Number(input.value), config.kind);
      this.state[key] = metric;
      normalizeFenceState(this.state);
      this.commit({ immediate });
    };
    range?.addEventListener('input', () => updateFromDisplay(range, true));
    number?.addEventListener('change', () => updateFromDisplay(number, false));
    number?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { number.blur(); }
    });
  }

  commit(options = {}) {
    normalizeFenceState(this.state);
    this.callbacks.onModelChange?.(options);
    this.update();
  }

  update(build = null) {
    const metrics = build?.metrics ?? deriveFenceMetrics(this.state);
    this.syncChoices();
    this.syncNumericControls();
    this.syncGateControls(metrics);
    this.syncSummary(metrics);
  }

  syncChoices() {
    document.querySelectorAll('[data-layout]').forEach((button) => {
      const selected = button.dataset.layout === this.state.layout;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-panel-style]').forEach((button) => {
      const selected = button.dataset.panelStyle === this.state.panelStyle;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    this.syncFinishChoices();
    setValue('#foundationType', this.state.foundation);
    const scenery = document.querySelector('#sceneryToggle');
    if (scenery) scenery.checked = this.state.scenery;

    const isClosed4 = this.state.layout === 'closed';
    const isClosed5 = this.state.layout === 'closed5';
    const isClosed = isClosed4 || isClosed5;
    document.querySelector('#runBControl')?.toggleAttribute('hidden', this.state.layout === 'straight');
    document.querySelector('#runCControl')?.toggleAttribute('hidden', !['u', 'closed', 'closed5'].includes(this.state.layout));
    document.querySelector('#runDControl')?.toggleAttribute('hidden', !isClosed5);
    document.querySelector('#angleBControl')?.toggleAttribute('hidden', !isClosed);
    document.querySelector('#closingRunInfo')?.toggleAttribute('hidden', !isClosed);
    document.querySelector('#gapControl')?.toggleAttribute('hidden', !['vertical', 'horizontal'].includes(this.state.panelStyle));

    setText('#runALabel', fenceT(this.locale, isClosed ? 'dimension.closedRunA' : 'dimension.runA'));
    setText('#runBLabel', fenceT(this.locale, isClosed ? 'dimension.closedRunB' : 'dimension.runB'));
    setText('#runCLabel', fenceT(this.locale, isClosed ? 'dimension.closedRunC' : 'dimension.runC'));
    setText('#runDLabel', fenceT(this.locale, 'dimension.closed5RunD'));
    setText('#closingRunLabel', fenceT(this.locale, isClosed5 ? 'dimension.closed5RunE' : 'dimension.closedRunD'));
    setText('#closingRunHelp', fenceT(this.locale, isClosed5 ? 'dimension.closed5Help' : 'dimension.closedHelp'));
  }

  syncFinishChoices() {
    const row = document.querySelector('.finish-row');
    if (!row) return;
    const finishes = getAvailableFenceFinishes();
    const signature = JSON.stringify([this.locale, finishes]);
    const labelFor = finish => finish.labelKey ? fenceT(this.locale, finish.labelKey) : finish.name;
    if (this.finishChoicesSignature !== signature) {
      this.finishChoicesSignature = signature;
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', fenceT(this.locale, 'finish.label'));
      row.replaceChildren(...finishes.map(finish => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'finish-swatch';
        button.dataset.finish = finish.id;
        button.style.setProperty('--swatch', finish.color);
        button.style.minWidth = '0';
        const name = labelFor(finish);
        button.title = name;
        button.setAttribute('aria-label', name);
        const chip = document.createElement('i');
        chip.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        // Published names are plain text, not HTML or translation message keys.
        label.textContent = name;
        label.style.overflowWrap = 'anywhere';
        button.append(chip, label);
        return button;
      }));
    }
    const selection = resolveFenceFinish(this.state);
    let offered = false;
    row.querySelectorAll('[data-finish]').forEach((button, index) => {
      const finish = finishes[index];
      const selected = finish.id === selection.id && finish.color === selection.color;
      offered ||= selected;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    // Show an archived selection without putting a deleted finish back in the picker.
    let selectedName = document.querySelector('#selectedFenceFinish');
    if (!selectedName) {
      selectedName = document.createElement('p');
      selectedName.id = 'selectedFenceFinish';
      selectedName.className = 'section-copy';
      selectedName.setAttribute('role', 'status');
      row.after(selectedName);
    }
    selectedName.textContent = `${fenceT(this.locale, 'finish.label')}: ${labelFor(selection)}${offered ? '' : ` (${selection.color})`}`;
  }

  syncNumericControls() {
    Object.entries(CONTROL_CONFIG).forEach(([key, config]) => {
      const control = document.querySelector(`[data-control="${key}"]`);
      if (!control) return;
      const range = control.querySelector('input[type="range"]');
      const number = control.querySelector('input[type="number"]');
      const output = control.querySelector('output');
      const value = this.fromMetric(this.state[key], config.kind);
      const min = this.fromMetric(config.min, config.kind);
      const max = this.fromMetric(config.max, config.kind);
      const step = this.displayStep(config.step, config.kind);
      [range, number].forEach((input) => {
        if (!input) return;
        input.min = String(round(min, this.units === 'imperial' ? 2 : 1));
        input.max = String(round(max, this.units === 'imperial' ? 2 : 1));
        input.step = String(step);
        input.value = String(round(value, config.kind === 'small' ? 1 : 2));
      });
      if (output) output.textContent = this.formatControlValue(this.state[key], config.kind);
    });

    const metrics = deriveFenceMetrics(this.state);
    const closingRunId = this.state.layout === 'closed5' ? 'e' : 'd';
    const closingRun = metrics.runs.find((run) => run.id === closingRunId);
    if (closingRun) setText('#closingRunValue', this.formatLength(closingRun.length));
    const hint = document.querySelector('#bayInfo');
    if (hint) {
      const average = metrics.totalLength / metrics.bayCount;
      hint.textContent = fenceT(this.locale, 'dimension.bayHint', { count: metrics.bayCount, width: this.formatLength(average) });
    }
  }

  syncGateControls(metrics) {
    const list = document.querySelector('#gateList');
    const empty = document.querySelector('#gateEmptyState');
    const capacity = document.querySelector('#gateCapacityMessage');
    const addButton = document.querySelector('#addGateButton');
    if (!list) return;

    const active = new Set(activeRunIds(this.state));
    const closed = ['closed', 'closed5'].includes(this.state.layout);
    const runLabels = this.state.layout === 'closed5'
      ? { a: 'AB', b: 'BC', c: 'CD', d: 'DE', e: 'EA' }
      : closed ? { a: 'AB', b: 'BC', c: 'CD', d: 'DA' } : { a: 'A', b: 'B', c: 'C', d: 'D' };
    const usedBays = new Map(metrics.runs.map((run) => [run.id, new Set()]));
    metrics.gates.forEach((gate) => {
      for (let bay = gate.startBay; bay < gate.startBay + gate.span; bay += 1) usedBays.get(gate.runId)?.add(bay);
    });

    list.innerHTML = metrics.gates.map((gate, index) => {
      const run = metrics.runs.find((item) => item.id === gate.runId) ?? metrics.runs[0];
      const max = Math.max(0, (run?.bayCount ?? 1) - gate.span);
      const from = gate.startBay + 1;
      const to = gate.span > 1 ? `–${gate.startBay + gate.span}` : '';
      const runOptions = metrics.runs.map((item) => `<option value="${item.id}"${item.id === gate.runId ? ' selected' : ''}>${escapeHtml(runLabels[item.id] ?? item.id.toUpperCase())}</option>`).join('');
      return `
        <div class="gate-card" data-gate-card="${escapeHtml(gate.id)}">
          <div class="gate-card-head">
            <strong>${escapeHtml(fenceT(this.locale, 'gate.itemTitle', { number: index + 1 }))}</strong>
            <button class="gate-remove" type="button" data-gate-remove="${escapeHtml(gate.id)}" aria-label="${escapeHtml(fenceT(this.locale, 'gate.remove'))}" title="${escapeHtml(fenceT(this.locale, 'gate.remove'))}">×</button>
          </div>
          <label class="field-label">${escapeHtml(fenceT(this.locale, 'gate.type'))}</label>
          <select data-gate-id="${escapeHtml(gate.id)}" data-gate-field="type">
            <option value="pedestrian"${gate.type === 'pedestrian' ? ' selected' : ''}>${escapeHtml(fenceT(this.locale, 'gate.pedestrian'))}</option>
            <option value="driveway"${gate.type === 'driveway' ? ' selected' : ''}>${escapeHtml(fenceT(this.locale, 'gate.driveway'))}</option>
          </select>
          <label class="field-label">${escapeHtml(fenceT(this.locale, 'gate.run'))}</label>
          <select data-gate-id="${escapeHtml(gate.id)}" data-gate-field="runId">${runOptions}</select>
          <label class="range-control compact-control">
            <span class="control-label"><b>${escapeHtml(fenceT(this.locale, 'gate.position'))}</b><output>${escapeHtml(fenceT(this.locale, 'gate.positionHint', { from, to }))}</output></span>
            <span class="range-row range-row--single"><input type="range" min="0" max="${max}" step="1" value="${Math.min(gate.startBay, max)}" data-gate-id="${escapeHtml(gate.id)}" data-gate-field="position" ${max === 0 ? 'disabled' : ''}/></span>
          </label>
          ${gate.type === 'pedestrian' ? `
          <div>
            <label class="field-label">${escapeHtml(fenceT(this.locale, 'gate.handing'))}</label>
            <select data-gate-id="${escapeHtml(gate.id)}" data-gate-field="handing">
              <option value="left"${gate.handing === 'left' ? ' selected' : ''}>${escapeHtml(fenceT(this.locale, 'gate.left'))}</option>
              <option value="right"${gate.handing === 'right' ? ' selected' : ''}>${escapeHtml(fenceT(this.locale, 'gate.right'))}</option>
            </select>
          </div>` : ''}
        </div>`;
    }).join('');

    const occupiedBayCount = metrics.gates.reduce((sum, gate) => sum + gate.span, 0);
    const hasCapacity = occupiedBayCount < metrics.bayCount;
    if (empty) empty.hidden = metrics.gates.length > 0;
    if (capacity) capacity.hidden = hasCapacity;
    if (addButton) addButton.disabled = !hasCapacity;

    // Keep stale run values from old states out of the DOM/state after layout changes.
    this.state.gates.forEach((gate) => {
      if (!active.has(gate.runId)) gate.runId = metrics.runs[0]?.id ?? 'a';
    });
  }

  addGate() {
    const metrics = deriveFenceMetrics(this.state);
    if (metrics.gateBayCount >= metrics.bayCount) return;
    const occupied = new Map(metrics.runs.map((run) => [run.id, new Set()]));
    metrics.gates.forEach((gate) => {
      for (let bay = gate.startBay; bay < gate.startBay + gate.span; bay += 1) occupied.get(gate.runId)?.add(bay);
    });
    let placement = null;
    for (const run of metrics.runs) {
      for (let bay = 0; bay < run.bayCount; bay += 1) {
        if (!occupied.get(run.id)?.has(bay)) { placement = { runId: run.id, position: bay }; break; }
      }
      if (placement) break;
    }
    if (!placement) return;
    const id = `gate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.state.gates.push({ id, type: 'pedestrian', runId: placement.runId, position: placement.position, handing: 'right' });
    this.commit();
  }

  updateGate(id, patch, options = {}) {
    const index = this.state.gates.findIndex((gate) => gate.id === id);
    if (index < 0) return;
    const before = structuredClone(this.state.gates);
    Object.assign(this.state.gates[index], patch);
    normalizeFenceState(this.state);
    // If the requested change cannot fit anywhere without overlapping another
    // gate, keep the previous valid arrangement instead of deleting a gate.
    if (!this.state.gates.some((gate) => gate.id === id)) this.state.gates = before;
    this.callbacks.onModelChange?.(options);
    this.update();
  }

  removeGate(id) {
    const index = this.state.gates.findIndex((gate) => gate.id === id);
    if (index < 0) return;
    this.state.gates.splice(index, 1);
    this.commit();
  }

  syncSummary(metrics) {
    const bom = buildFenceBom(this.state, { locale: this.locale });
    setText('#summaryTotal', formatMoney(bom.totalEur, this.currency, this.locale));
    const breakdown = document.querySelector('#summaryPriceBreakdown');
    if (breakdown) breakdown.innerHTML = [
      summaryRow(fenceT(this.locale, 'summary.materials'), formatMoney(bom.materialTotal, this.currency, this.locale)),
      summaryRow(fenceT(this.locale, 'summary.installation'), formatMoney(bom.installation, this.currency, this.locale)),
      summaryRow(fenceT(this.locale, 'summary.engineering'), formatMoney(bom.engineering, this.currency, this.locale)),
    ].join('');
    const summaryMetrics = document.querySelector('#summaryMetrics');
    if (summaryMetrics) summaryMetrics.innerHTML = [
      metricCard(fenceT(this.locale, 'summary.length'), this.formatLength(metrics.totalLength)),
      metricCard(fenceT(this.locale, 'summary.bays'), String(metrics.bayCount)),
      metricCard(fenceT(this.locale, 'summary.posts'), String(metrics.postCount)),
      metricCard(fenceT(this.locale, 'summary.gates'), String(metrics.gates.length)),
    ].join('');

    const preview = document.querySelector('#summaryBomList');
    if (preview) preview.innerHTML = bom.items.slice(0, 4).map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.quantity))} ${escapeHtml(item.unit)}</strong></div>`).join('');
    setText('#headerBomSummary', fenceT(this.locale, 'summary.itemCount', { count: bom.items.length }));
    this.renderBomDialog(bom);
  }

  renderBomDialog(bom) {
    const tbody = document.querySelector('#bomTableBody');
    if (!tbody) return;
    tbody.innerHTML = bom.items.map((entry) => `
      <tr>
        <td><strong>${escapeHtml(entry.label)}</strong></td>
        <td>${escapeHtml(String(entry.quantity))}</td>
        <td>${escapeHtml(entry.unit)}</td>
        <td>${escapeHtml(formatMoney(entry.unitPriceEur, this.currency, this.locale))}</td>
        <td>${escapeHtml(formatMoney(entry.totalEur, this.currency, this.locale))}</td>
      </tr>`).join('');
    setText('#bomDialogTotal', formatMoney(bom.totalEur, this.currency, this.locale));
  }

  captureState() {
    return structuredClone(this.state);
  }

  restoreState(snapshot) {
    Object.keys(this.state).forEach((key) => delete this.state[key]);
    Object.assign(this.state, structuredClone(snapshot));
    normalizeFenceState(this.state);
    this.callbacks.onModelChange?.({ fitCamera: true, immediate: true });
    this.update();
  }

  setPreferences({ units = this.units, currency = this.currency } = {}) {
    this.units = units;
    this.currency = currency;
    this.update();
  }

  setLocale(locale) {
    this.locale = resolveFenceLocale(locale);
    applyFenceTranslations(this.locale);
    this.update();
  }

  exportCsv() {
    const csv = fenceBomCsv(this.state, { currency: this.currency, locale: this.locale });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'fence-bom.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  fromMetric(value, kind) {
    if (kind === 'angle') return value;
    if (kind === 'small') return this.units === 'imperial' ? value * 39.37007874 : value * 1000;
    return this.units === 'imperial' ? value * 3.280839895 : value;
  }

  toMetric(value, kind) {
    if (kind === 'angle') return value;
    if (kind === 'small') return this.units === 'imperial' ? value / 39.37007874 : value / 1000;
    return this.units === 'imperial' ? value / 3.280839895 : value;
  }

  displayStep(metricStep, kind) {
    if (kind === 'angle') return metricStep;
    if (kind === 'small') return this.units === 'imperial' ? 0.1 : Math.max(1, Math.round(metricStep * 1000));
    return this.units === 'imperial' ? 0.1 : metricStep;
  }

  formatControlValue(value, kind) {
    if (kind === 'angle') return `${Math.round(value)}°`;
    if (kind === 'small') return this.units === 'imperial' ? `${(value * 39.37007874).toFixed(1)} in` : `${Math.round(value * 1000)} mm`;
    return this.formatLength(value);
  }

  formatLength(value) {
    return this.units === 'imperial' ? `${(value * 3.280839895).toFixed(value < 3 ? 1 : 0)} ft` : `${value.toFixed(value < 3 ? 2 : 1)} m`;
  }
}

function bindSelect(selector, callback) {
  document.querySelector(selector)?.addEventListener('change', (event) => callback(event.target.value));
}
function setValue(selector, value) { const element = document.querySelector(selector); if (element) element.value = value; }
function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
function summaryRow(label, value) { return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function metricCard(label, value) { return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
