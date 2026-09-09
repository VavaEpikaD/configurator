import { observeGoogleAuth, signInWithGoogle, signOutGoogle } from './firebaseAuth.js';
import { callConfiguratorColorAdmin } from './configuratorColorApi.js';

// Each dedicated page chooses exactly one product. Older window pages have no
// data attribute and continue to work with their existing versioned script URL.
const EDITORS = Object.freeze({
  window: { name: 'window', groups: ['mill', 'anodized', 'coated'], initialGroup: 'coated', uniqueColors: false },
  pergola: { name: 'pergola', groups: ['frame', 'louvers', 'screens', 'privacy-wall', 'led'], initialGroup: 'frame', uniqueColors: true },
});
const configuratorId = document.documentElement.dataset.configuratorId || 'window';
if (!Object.prototype.hasOwnProperty.call(EDITORS, configuratorId)) throw new Error('Unsupported editor page.');
const definition = EDITORS[configuratorId];
const element = id => document.getElementById(id);
const ui = Object.fromEntries([
  'account', 'account-name', 'sign-out', 'access-panel', 'access-title', 'access-message',
  'sign-in', 'retry-access', 'editor', 'editor-controls', 'finish-tabs',
  'color-count', 'color-rows', 'add-color', 'preview-title', 'preview-swatches', 'preview-name',
  'editor-message', 'dirty-label', 'published-label', 'reload', 'publish',
].map(id => [id, element(id)]));
const clone = value => JSON.parse(JSON.stringify(value));
const validHex = value => /^#[0-9a-f]{6}$/i.test(value);
let user = null;
let generation = 0;
let authorized = false;
let loading = false;
let saving = false;
let published = null;
let draft = null;
let finishGroups = [];
let maxColors = 100;
let activeGroup = definition.initialGroup;
let previewId = '';
let conflict = false;
let unsubscribe;

function isDirty() {
  return !!draft && !!published && JSON.stringify(draft) !== JSON.stringify(published.groups);
}

function message(text, isError = false) {
  ui['editor-message'].textContent = text;
  ui['editor-message'].hidden = !text;
  ui['editor-message'].classList.toggle('notice-error', isError);
  ui['editor-message'].setAttribute('role', isError ? 'alert' : 'status');
}

function syncActions() {
  const busy = loading || saving;
  ui['editor-controls'].disabled = busy || !authorized;
  ui.reload.disabled = busy;
  ui.publish.disabled = busy || !authorized || !isDirty() || conflict;
  ui.publish.textContent = saving ? 'Publishing…' : 'Save and publish';
  ui['sign-out'].disabled = busy;
  ui['dirty-label'].textContent = conflict ? 'Reload needed before publishing' : isDirty() ? 'Unpublished changes' : 'No unpublished changes';
  ui['dirty-label'].classList.toggle('has-changes', isDirty());
  if (published) {
    ui['published-label'].textContent = published.revision
      ? `Published revision ${published.revision}${published.updatedAtMs ? ` · ${new Date(published.updatedAtMs).toLocaleString()}` : ''}`
      : 'Using the original built-in colors';
  }
  ui['add-color'].disabled = busy || !draft || draft[activeGroup].length >= maxColors;
}

function showAccess(title, text, { login = false, retry = false } = {}) {
  ui['access-panel'].hidden = false;
  ui['access-title'].textContent = title;
  ui['access-message'].textContent = text;
  ui['sign-in'].hidden = !login;
  ui['retry-access'].hidden = !retry;
  ui.editor.hidden = true;
}

function lockEditor(error) {
  authorized = false;
  draft = null;
  published = null;
  ui['color-rows'].replaceChildren();
  ui['preview-swatches'].replaceChildren();
  showAccess('Admin access required', error.message, { login: !user });
  syncActions();
}

function handleError(error) {
  if (['PERMISSION_DENIED', 'UNAUTHENTICATED'].includes(error.code)) {
    lockEditor(error);
    return;
  }
  if (error.code === 'ABORTED') conflict = true;
  message(error.message || 'Unable to reach the editor service. Your changes have not been confirmed.', true);
}

function renderPreview() {
  const colors = draft[activeGroup];
  const group = finishGroups.find(entry => entry.id === activeGroup);
  ui['preview-title'].textContent = group.label;
  if (!colors.some(color => color.id === previewId)) previewId = colors[0].id;
  const buttons = colors.map(color => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preview-swatch';
    button.style.setProperty('--swatch-color', validHex(color.color) ? color.color : '#ffffff');
    button.setAttribute('aria-label', color.name || 'Unnamed color');
    button.setAttribute('aria-pressed', String(color.id === previewId));
    button.title = color.name || 'Unnamed color';
    if (configuratorId === 'pergola') {
      const label = document.createElement('span');
      label.textContent = color.name || 'Unnamed color';
      button.append(label);
    }
    button.addEventListener('click', () => {
      previewId = color.id;
      // Preserve keyboard focus by updating the existing swatches in place.
      [...ui['preview-swatches'].children].forEach((swatch, index) => swatch.setAttribute('aria-pressed', String(colors[index].id === previewId)));
      ui['preview-name'].textContent = color.name || 'Unnamed color';
    });
    return button;
  });
  ui['preview-swatches'].replaceChildren(...buttons);
  ui['preview-name'].textContent = colors.find(color => color.id === previewId)?.name || 'Unnamed color';
}

function changed() {
  if (!conflict) message('');
  renderPreview();
  syncActions();
}

function labelInput(text, input) {
  const label = document.createElement('label');
  label.className = 'row-field';
  const caption = document.createElement('span');
  caption.className = 'sr-only';
  caption.textContent = text;
  label.append(caption, input);
  return label;
}

function renderRows() {
  const colors = draft[activeGroup];
  ui['color-count'].textContent = `${colors.length} ${colors.length === 1 ? 'color' : 'colors'}`;
  const rows = colors.map((color, index) => {
    const row = document.createElement('div');
    row.className = 'color-row';
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.className = 'color-input';
    picker.value = validHex(color.color) ? color.color : '#ffffff';
    const hex = document.createElement('input');
    hex.type = 'text';
    hex.name = `hex-${activeGroup}-${color.id}`;
    hex.className = 'hex-input';
    hex.value = color.color;
    hex.maxLength = 7;
    hex.required = true;
    hex.pattern = '#[0-9a-fA-F]{6}';
    hex.spellcheck = false;
    hex.autocomplete = 'off';
    hex.setAttribute('autocapitalize', 'none');
    const name = document.createElement('input');
    name.type = 'text';
    name.name = `name-${activeGroup}-${color.id}`;
    name.value = color.name;
    name.maxLength = 120;
    name.required = true;
    name.placeholder = 'Color name';
    name.className = 'name-input';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-color';
    remove.textContent = '×';
    remove.title = colors.length === 1 ? 'Keep at least one color in this group.' : 'Delete color';
    remove.setAttribute('aria-label', `Delete ${color.name || `color ${index + 1}`}`);
    remove.disabled = colors.length <= 1;
    picker.addEventListener('input', () => {
      color.color = picker.value.toLowerCase();
      hex.value = color.color;
      hex.setCustomValidity('');
      changed();
    });
    hex.addEventListener('input', () => {
      color.color = hex.value;
      const valid = validHex(color.color);
      hex.setCustomValidity(valid ? '' : 'Enter a six-digit hex color, such as #383e42.');
      if (valid) picker.value = color.color;
      changed();
    });
    name.addEventListener('input', () => {
      color.name = name.value;
      name.setCustomValidity(name.value.trim() && !/[\u0000-\u001f\u007f]/.test(name.value) ? '' : 'Enter a color name without control characters.');
      remove.setAttribute('aria-label', `Delete ${name.value || `color ${index + 1}`}`);
      changed();
    });
    remove.addEventListener('click', () => {
      if (draft[activeGroup].length <= 1) return;
      draft[activeGroup] = draft[activeGroup].filter(entry => entry.id !== color.id);
      renderRows();
      changed();
      ui['add-color'].focus();
    });
    row.append(labelInput(`Pick color ${index + 1}`, picker), labelInput(`Hex value for color ${index + 1}`, hex), labelInput(`Name for color ${index + 1}`, name), remove);
    return row;
  });
  ui['color-rows'].replaceChildren(...rows);
}

function renderGroup() {
  [...ui['finish-tabs'].children].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.group === activeGroup)));
  renderRows();
  renderPreview();
  syncActions();
}

function renderEditor() {
  ui['finish-tabs'].replaceChildren(...finishGroups.map(group => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.group = group.id;
    button.textContent = group.label;
    button.addEventListener('click', () => {
      activeGroup = group.id;
      previewId = '';
      renderGroup();
    });
    return button;
  }));
  renderGroup();
}

function validateResponse(result) {
  const invalid = () => { throw new Error('The published palette response is invalid. No changes were loaded.'); };
  if (result?.schemaVersion !== 1 || result.configuratorId !== configuratorId
      || !Number.isSafeInteger(result.revision) || result.revision < 0
      || !result.groups || Array.isArray(result.groups)
      || Object.keys(result.groups).length !== definition.groups.length) invalid();
  for (const id of definition.groups) {
    const colors = result.groups[id];
    if (!Array.isArray(colors) || !colors.length || colors.length > 100) invalid();
    const ids = new Set();
    const hexValues = new Set();
    for (const color of colors) {
      if (!color || typeof color.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(color.id)
          || ids.has(color.id) || typeof color.color !== 'string' || !validHex(color.color)
          || typeof color.name !== 'string' || !color.name.trim() || color.name.length > 120
          || /[\u0000-\u001f\u007f]/.test(color.name)) invalid();
      const hex = color.color.toLowerCase();
      if (definition.uniqueColors && hexValues.has(hex)) invalid();
      ids.add(color.id);
      hexValues.add(hex);
    }
  }
}

async function loadPublished(expectedGeneration = generation) {
  if (!user || loading || saving) return;
  loading = true;
  syncActions();
  ui['retry-access'].disabled = true;
  try {
    const result = await callConfiguratorColorAdmin('getConfiguratorColorEditor', { configuratorId });
    if (generation !== expectedGeneration) return;
    validateResponse(result);
    if (!Array.isArray(result.finishGroups) || result.finishGroups.length !== definition.groups.length
        || !result.finishGroups.every((group, index) => group?.id === definition.groups[index]
          && typeof group.label === 'string' && group.label.length > 0 && group.hasNames === true)
        || !Number.isSafeInteger(result.maxColorsPerGroup) || result.maxColorsPerGroup < 1 || result.maxColorsPerGroup > 100) {
      throw new Error('The color group catalog is incomplete.');
    }
    finishGroups = result.finishGroups;
    maxColors = result.maxColorsPerGroup;
    published = clone(result);
    draft = clone(result.groups);
    conflict = false;
    authorized = true;
    if (!draft[activeGroup]) activeGroup = finishGroups[0].id;
    ui['access-panel'].hidden = true;
    ui.editor.hidden = false;
    renderEditor();
    message('Published colors loaded.');
  } catch (error) {
    if (generation !== expectedGeneration) return;
    if (['PERMISSION_DENIED', 'UNAUTHENTICATED'].includes(error.code)) lockEditor(error);
    else if (authorized) handleError(error);
    else showAccess('Unable to open the editor', error.message, { retry: true });
  } finally {
    if (generation === expectedGeneration) {
      loading = false;
      ui['retry-access'].disabled = false;
      syncActions();
    }
  }
}

function validateDraft() {
  for (const group of finishGroups) {
    const seen = new Set();
    for (const [index, color] of draft[group.id].entries()) {
      let selector = '.hex-input';
      let error = '';
      if (!validHex(color.color)) error = 'Enter a six-digit hex color, such as #383e42.';
      else if (definition.uniqueColors && seen.has(color.color.toLowerCase())) error = 'Use a different hex value; this color already exists in this group.';
      else if (!color.name.trim() || color.name.length > 120 || /[\u0000-\u001f\u007f]/.test(color.name)) {
        selector = '.name-input';
        error = 'Enter a color name of 1–120 characters without control characters.';
      }
      if (!error) { seen.add(color.color.toLowerCase()); continue; }
      activeGroup = group.id;
      renderGroup();
      const input = ui['color-rows'].children[index].querySelector(selector);
      input.setCustomValidity(error);
      input.reportValidity();
      message(`Check the highlighted color in ${group.label}. Nothing was published.`, true);
      return false;
    }
  }
  return true;
}

ui['add-color'].addEventListener('click', () => {
  if (!authorized || draft[activeGroup].length >= maxColors) return;
  let hex = '#ffffff';
  if (definition.uniqueColors) {
    const used = new Set(draft[activeGroup].map(color => color.color.toLowerCase()));
    let value = 0xffffff;
    while (used.has(hex)) hex = `#${(--value).toString(16).padStart(6, '0')}`;
  }
  const color = { id: `custom-${crypto.randomUUID()}`, color: hex, name: 'New color' };
  draft[activeGroup].push(color);
  previewId = color.id;
  renderRows();
  changed();
  const input = ui['color-rows'].lastElementChild.querySelector('.name-input');
  input.focus();
  input.select();
});
ui.editor.addEventListener('submit', async event => {
  event.preventDefault();
  if (!authorized || loading || saving || !isDirty() || conflict || !validateDraft()) return;
  const currentGeneration = generation;
  const groups = clone(draft);
  for (const colors of Object.values(groups)) for (const color of colors) {
    color.name = color.name.trim();
    color.color = color.color.toLowerCase();
  }
  saving = true;
  message('Publishing colors…');
  syncActions();
  try {
    const result = await callConfiguratorColorAdmin('saveConfiguratorColors', {
      configuratorId, expectedRevision: published.revision, groups,
    });
    if (generation !== currentGeneration) return;
    validateResponse(result);
    published = clone(result);
    draft = clone(result.groups);
    renderGroup();
    message(`Published successfully. Open or refresh the ${definition.name} configurator to see these colors.`);
  } catch (error) {
    if (generation === currentGeneration) handleError(error);
  } finally {
    if (generation === currentGeneration) {
      saving = false;
      syncActions();
    }
  }
});
ui.reload.addEventListener('click', () => {
  if (isDirty() && !window.confirm('Discard your unpublished changes and reload the latest published colors?')) return;
  void loadPublished();
});
ui['retry-access'].addEventListener('click', () => void loadPublished());
ui['sign-in'].addEventListener('click', async () => {
  ui['sign-in'].disabled = true;
  try { await signInWithGoogle(); }
  catch (error) { ui['access-message'].textContent = error.message || 'Sign-in failed. Try again.'; }
  finally { ui['sign-in'].disabled = false; }
});
ui['sign-out'].addEventListener('click', async () => {
  if (isDirty() && !window.confirm('Sign out and discard your unpublished changes?')) return;
  try { await signOutGoogle(); }
  catch (error) {
    if (authorized) message(error.message || 'Unable to sign out.', true);
    else ui['access-message'].textContent = error.message || 'Unable to sign out.';
  }
});
window.addEventListener('beforeunload', event => {
  if (!isDirty() && !saving) return;
  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener('pagehide', event => { if (!event.persisted) unsubscribe?.(); });

try {
  unsubscribe = await observeGoogleAuth((nextUser, error) => {
    generation += 1;
    user = nextUser;
    authorized = false;
    loading = false;
    saving = false;
    conflict = false;
    draft = null;
    published = null;
    ui['account'].hidden = !user;
    ui['account-name'].textContent = user?.email || user?.displayName || '';
    ui['color-rows'].replaceChildren();
    ui['preview-swatches'].replaceChildren();
    syncActions();
    if (!user) {
      showAccess('Admin access', error?.message || `Sign in with your authorized Google account to manage ${definition.name} colors.`, { login: true });
      return;
    }
    showAccess('Checking admin access…', 'Verifying your account with the server.');
    void loadPublished(generation);
  });
} catch (error) {
  showAccess('Sign-in service unavailable', error.message || 'Refresh this page to try again.', { login: true });
}
