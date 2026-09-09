import { validateWindowSizeLimits, WINDOW_SIZE_MIN_MM, WINDOW_SIZE_MAX_MM } from './windowSizeSettings.js?v=1';

export function createWindowSettingsEditor({ onChange }) {
  const root = document.getElementById('window-size-fields');
  const iframe = document.getElementById('window-settings-preview');
  const notice = document.getElementById('size-validation-message');
  const previewMessage = document.getElementById('preview-load-message');
  let original = null;
  let draft = null;
  let ready = false;
  let section = 'colors';
  let previewData = null;
  const fields = new Map();
  let attempts = 0;
  const ping = () => iframe.contentWindow?.postMessage({ type: 'window-editor-preview-ping' }, location.origin);
  iframe.addEventListener('load', ping);
  const handshake = setInterval(() => {
    if (ready || ++attempts > 15) {
      clearInterval(handshake);
      if (!ready) previewMessage.textContent = 'Preview unavailable. Deploy the updated window assets, then refresh this page.';
      return;
    }
    ping();
  }, 1000);
  window.addEventListener('pagehide', () => clearInterval(handshake));
  ping();
  const clone = value => JSON.parse(JSON.stringify(value));
  for (const [scope, title, help] of [
    ['overall', 'Overall layout size', 'The complete assembly, including all joined windows.'],
    ['individual', 'Individual window size', 'The width and height sliders in the selected-window panel.'],
  ]) {
    const group = document.createElement('section');
    group.className = 'size-limit-group';
    const heading = document.createElement('h3'); heading.textContent = title;
    const description = document.createElement('p'); description.textContent = help;
    const columns = document.createElement('div'); columns.className = 'size-limit-head';
    columns.setAttribute('aria-hidden', 'true');
    for (const text of ['', 'Minimum', 'Maximum']) { const span = document.createElement('span'); span.textContent = text; columns.append(span); }
    group.append(heading, description, columns);
    for (const axis of ['width', 'height']) {
      const row = document.createElement('div'); row.className = 'size-limit-row';
      const name = document.createElement('span'); name.textContent = axis === 'width' ? 'Width' : 'Height'; row.append(name);
      for (const key of ['minMm', 'maxMm']) {
        const field = `${scope}.${axis}.${key}`;
        const label = document.createElement('label'); label.className = 'size-limit-field';
        const caption = document.createElement('span'); caption.className = 'sr-only';
        caption.textContent = `${title}: ${axis} ${key === 'minMm' ? 'minimum' : 'maximum'} in millimetres`;
        const input = document.createElement('input'); input.type = 'number'; input.step = '1';
        input.min = String(WINDOW_SIZE_MIN_MM); input.max = String(WINDOW_SIZE_MAX_MM); input.required = true;
        input.inputMode = 'numeric'; input.name = field; input.dataset.sizeLimit = field;
        const unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = 'mm'; unit.setAttribute('aria-hidden', 'true');
        input.addEventListener('input', () => {
          if (!draft) return;
          draft[scope][axis][key] = input.value === '' ? null : Number(input.value);
          validate(false); onChange();
        });
        // Enter in a numeric field commits the draft only, never publishes the form.
        input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); validate(true); } });
        fields.set(field, input); label.append(caption, input, unit); row.append(label);
      }
      group.append(row);
    }
    root.append(group);
  }

  function validateResponse(result) {
    if (result.windowSettingsVersion !== 1 || !result.sizeLimits) {
      throw new Error('Deploy the updated Firebase settings backend before opening this window editor.');
    }
    validateWindowSizeLimits(result.sizeLimits);
  }
  function validate(report = false) {
    for (const input of fields.values()) { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); }
    try {
      validateWindowSizeLimits(draft);
      notice.hidden = true; notice.textContent = '';
      return true;
    } catch (error) {
      notice.textContent = error.message; notice.hidden = false;
      const input = fields.get(error.field);
      if (input) { input.setCustomValidity(error.message); input.setAttribute('aria-invalid', 'true'); }
      if (report) {
        document.getElementById('sizes-menu').open = true;
        input?.focus(); input?.reportValidity();
      }
      return false;
    }
  }
  function sendPreview() {
    if (!ready || !previewData || !draft) return;
    let sizeLimits;
    try { sizeLimits = validateWindowSizeLimits(draft); }
    catch { sizeLimits = original; }
    iframe.contentWindow.postMessage({ type: 'window-editor-preview', ...previewData, sizeLimits, section }, location.origin);
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== iframe.contentWindow) return;
    if (event.data?.type === 'window-editor-preview-ready') {
      ready = true; previewMessage.hidden = true; sendPreview();
    }
    if (event.data?.type === 'window-editor-preview-height') {
      const height = Number(event.data.height);
      if (Number.isFinite(height)) iframe.style.height = `${Math.max(180, Math.min(2400, height))}px`;
    }
  });
  for (const [id, value] of [['colors-menu', 'colors'], ['sizes-menu', 'sizes']]) {
    document.getElementById(id).addEventListener('toggle', event => {
      if (!event.target.open) return;
      section = value;
      document.getElementById('settings-preview-title').textContent = value === 'sizes' ? 'Window sizes' : 'Colors';
      sendPreview();
    });
  }
  return {
    validateResponse,
    load(result) {
      validateResponse(result);
      original = validateWindowSizeLimits(result.sizeLimits); draft = clone(original);
      for (const [field, input] of fields) {
        const [scope, axis, key] = field.split('.'); input.value = String(draft[scope][axis][key]);
        input.setCustomValidity(''); input.removeAttribute('aria-invalid');
      }
      notice.hidden = true; notice.textContent = ''; sendPreview();
    },
    clear() {
      original = null; draft = null; previewData = null;
      for (const input of fields.values()) input.value = '';
      notice.hidden = true;
      if (ready) iframe.contentWindow.postMessage({ type: 'window-editor-preview-clear' }, location.origin);
    },
    isDirty: () => !!draft && JSON.stringify(draft) !== JSON.stringify(original),
    validate: () => validate(true),
    getValue: () => validateWindowSizeLimits(draft),
    preview(data) { previewData = clone(data); sendPreview(); },
  };
}
