import { getFirebaseIdToken } from '../firebaseAuth.js?v=13';

const FUNCTIONS_REGION = 'europe-west1';
const PROJECT_ID = 'configurator-360';
const INSTALL_KEY = '__CFG360_ACCOUNT_ORDERS_INSTALLED__';
const DIALOG_ID = 'cfg360AccountOrdersDialog';
const STYLE_ID = 'cfg360AccountOrdersStyle';

const COPY = Object.freeze({
  'en-US': Object.freeze({
    menu: 'Orders',
    title: 'Orders',
    subtitle: 'Configurations included in your previous orders.',
    loading: 'Loading orders…',
    empty: 'You do not have any orders yet.',
    error: 'Your orders could not be loaded. Please try again.',
    order: 'Order',
    items: 'items',
    item: 'item',
    view: 'View configuration',
    opening: 'Opening…',
    unavailable: 'Configuration unavailable',
    close: 'Close orders',
    retry: 'Retry',
    products: Object.freeze({
      window: 'Window', roof: 'Roof', pergola: 'Pergola', hall: 'Hall', solar: 'Solar', fence: 'Fence', cardbox: 'Cardboard box', bookshelf: 'Bookshelf',
    }),
  }),
  'ro-RO': Object.freeze({
    menu: 'Comenzi',
    title: 'Comenzi',
    subtitle: 'Configurațiile incluse în comenzile dumneavoastră anterioare.',
    loading: 'Se încarcă comenzile…',
    empty: 'Nu aveți încă nicio comandă.',
    error: 'Comenzile nu au putut fi încărcate. Încercați din nou.',
    order: 'Comanda',
    items: 'produse',
    item: 'produs',
    view: 'Vezi configurația',
    opening: 'Se deschide…',
    unavailable: 'Configurație indisponibilă',
    close: 'Închide comenzile',
    retry: 'Încearcă din nou',
    products: Object.freeze({
      window: 'Fereastră', roof: 'Acoperiș', pergola: 'Pergolă', hall: 'Hală', solar: 'Solar', fence: 'Gard', cardbox: 'Cutie din carton', bookshelf: 'Bibliotecă',
    }),
  }),
  'de-DE': Object.freeze({
    menu: 'Bestellungen',
    title: 'Bestellungen',
    subtitle: 'Konfigurationen aus Ihren bisherigen Bestellungen.',
    loading: 'Bestellungen werden geladen…',
    empty: 'Sie haben noch keine Bestellungen.',
    error: 'Ihre Bestellungen konnten nicht geladen werden. Bitte versuchen Sie es erneut.',
    order: 'Bestellung',
    items: 'Artikel',
    item: 'Artikel',
    view: 'Konfiguration anzeigen',
    opening: 'Wird geöffnet…',
    unavailable: 'Konfiguration nicht verfügbar',
    close: 'Bestellungen schließen',
    retry: 'Erneut versuchen',
    products: Object.freeze({
      window: 'Fenster', roof: 'Dach', pergola: 'Pergola', hall: 'Halle', solar: 'Solar', fence: 'Zaun', cardbox: 'Kartonbox', bookshelf: 'Bücherregal',
    }),
  }),
});

function normalizedLocale(value = '') {
  const locale = String(value || '').trim();
  if (COPY[locale]) return locale;
  if (locale.toLowerCase().startsWith('ro')) return 'ro-RO';
  if (locale.toLowerCase().startsWith('de')) return 'de-DE';
  return 'en-US';
}

function currentLocale() {
  const htmlLang = String(document.documentElement.lang || '').trim();
  const host = String(location.hostname || '').toLowerCase();
  if (htmlLang.toLowerCase().startsWith('ro') || host.includes('360configurator.ro')) return 'ro-RO';
  if (htmlLang.toLowerCase().startsWith('de') || host.includes('360konfigurator.de')) return 'de-DE';
  return 'en-US';
}

function c(locale = currentLocale()) {
  return COPY[normalizedLocale(locale)] || COPY['en-US'];
}

export function accountOrdersLabel(locale = 'en-US') {
  return c(locale).menu;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function callableUrl() {
  return `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/requestCartQuotation`;
}

async function callOrdersAction(action, data = {}) {
  const token = await getFirebaseIdToken();
  if (!token) throw new Error('Google login is required.');
  const response = await fetch(callableUrl(), {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: { action, ...data } }),
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || `Order request failed (${response.status}).`);
    error.code = payload?.error?.status || `http-${response.status}`;
    throw error;
  }
  return payload?.result ?? payload?.data ?? null;
}

function formatDate(value, locale) {
  const ms = Number(value) || 0;
  if (!ms) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleDateString();
  }
}

function formatMoney(value, currency, locale) {
  const amount = Number(value);
  const code = String(currency || '').toUpperCase();
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code || 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`.trim();
  }
}

function productName(productId, locale) {
  const copy = c(locale);
  return copy.products[String(productId || '').toLowerCase()] || String(productId || 'Configuration');
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .cfg360-orders-overlay{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:24px;background:rgba(12,20,27,.42);backdrop-filter:blur(5px)}
    .cfg360-orders-dialog{width:min(780px,100%);max-height:min(820px,88vh);display:flex;flex-direction:column;overflow:hidden;border:1px solid #dde4e8;border-radius:22px;background:#fff;color:#17232b;box-shadow:0 28px 80px rgba(15,31,42,.28);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .cfg360-orders-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:24px 26px 19px;border-bottom:1px solid #e8ecef}
    .cfg360-orders-head h2{margin:0;font-size:25px;line-height:1.15}.cfg360-orders-head p{margin:7px 0 0;color:#71808a;font-size:13px;line-height:1.45}
    .cfg360-orders-close{width:38px;height:38px;display:grid;place-items:center;border:1px solid #dce4e9;border-radius:11px;background:#fff;color:#53636e;font-size:27px;line-height:1;cursor:pointer}.cfg360-orders-close:hover{background:#f6f8f9}
    .cfg360-orders-body{min-height:180px;overflow:auto;padding:18px 22px 24px}.cfg360-orders-state{padding:52px 20px;text-align:center;color:#71808a;font-size:13px}.cfg360-orders-state button{margin-top:14px;padding:9px 15px;border:1px solid #1187d5;border-radius:9px;background:#1187d5;color:#fff;font-weight:750;cursor:pointer}
    .cfg360-order{margin-bottom:10px;border:1px solid #dde5ea;border-radius:14px;background:#fff;overflow:hidden}.cfg360-order[open]{border-color:#b9d9ed;box-shadow:0 5px 20px rgba(28,77,106,.07)}
    .cfg360-order summary{list-style:none;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:14px;align-items:center;padding:15px 16px;cursor:pointer}.cfg360-order summary::-webkit-details-marker{display:none}.cfg360-order summary:hover{background:#f8fbfc}
    .cfg360-order-title{font-size:14px;font-weight:800;color:#23333d}.cfg360-order-date{font-size:12px;color:#73818a}.cfg360-order-total{font-size:13px;font-weight:850;color:#0d78bc;white-space:nowrap}.cfg360-order-chevron{font-size:19px;color:#7e8c95;transition:transform .18s ease}.cfg360-order[open] .cfg360-order-chevron{transform:rotate(90deg)}
    .cfg360-order-items{border-top:1px solid #e9edf0;background:#fafcfd;padding:9px}.cfg360-order-item{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:11px 10px;border-radius:10px}.cfg360-order-item+.cfg360-order-item{border-top:1px solid #e9edf0;border-radius:0}.cfg360-order-item-copy{min-width:0}.cfg360-order-item-copy b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:#2a3943}.cfg360-order-item-copy small{display:block;margin-top:2px;color:#849099;font-size:10.5px}.cfg360-order-item-price{font-size:12px;font-weight:750;color:#53636d;white-space:nowrap}
    .cfg360-order-view{padding:8px 11px;border:1px solid #168de0;border-radius:9px;background:#fff;color:#0876be;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.cfg360-order-view:hover:not(:disabled){background:#eff8fe}.cfg360-order-view:disabled{opacity:.52;cursor:not-allowed}
    .shared-ui-dark-mode .cfg360-orders-dialog{background:#1d252a;color:#edf2f4;border-color:#3b484f}.shared-ui-dark-mode .cfg360-orders-head,.shared-ui-dark-mode .cfg360-order-items,.shared-ui-dark-mode .cfg360-order-item+.cfg360-order-item{border-color:#3b484f}.shared-ui-dark-mode .cfg360-orders-close,.shared-ui-dark-mode .cfg360-order{background:#222c32;border-color:#3c4a52;color:#e8eef1}.shared-ui-dark-mode .cfg360-order summary:hover{background:#273239}.shared-ui-dark-mode .cfg360-order-title,.shared-ui-dark-mode .cfg360-order-item-copy b{color:#eef3f5}.shared-ui-dark-mode .cfg360-order-items{background:#1a2227}.shared-ui-dark-mode .cfg360-order-view{background:#222c32}
    @media(max-width:640px){.cfg360-orders-overlay{padding:10px}.cfg360-orders-dialog{max-height:92vh;border-radius:17px}.cfg360-orders-head{padding:19px 17px 15px}.cfg360-orders-body{padding:12px}.cfg360-order summary{grid-template-columns:minmax(0,1fr) auto;gap:6px 10px}.cfg360-order-date{grid-column:1}.cfg360-order-total{grid-column:2;grid-row:1/3}.cfg360-order-chevron{display:none}.cfg360-order-item{grid-template-columns:minmax(0,1fr) auto}.cfg360-order-item-price{grid-column:1}.cfg360-order-view{grid-column:2;grid-row:1/3}}
  `;
  document.head.append(style);
}

function dialogTemplate(locale) {
  const copy = c(locale);
  return `
    <div class="cfg360-orders-overlay" id="${DIALOG_ID}" role="presentation">
      <section class="cfg360-orders-dialog" role="dialog" aria-modal="true" aria-labelledby="cfg360OrdersTitle">
        <header class="cfg360-orders-head">
          <div><h2 id="cfg360OrdersTitle">${escapeHtml(copy.title)}</h2><p>${escapeHtml(copy.subtitle)}</p></div>
          <button class="cfg360-orders-close" type="button" data-orders-close aria-label="${escapeHtml(copy.close)}">×</button>
        </header>
        <div class="cfg360-orders-body" data-orders-body><div class="cfg360-orders-state">${escapeHtml(copy.loading)}</div></div>
      </section>
    </div>`;
}

function renderOrders(orders, locale) {
  const copy = c(locale);
  if (!orders.length) return `<div class="cfg360-orders-state">${escapeHtml(copy.empty)}</div>`;
  return orders.map((order) => {
    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    const total = order.totalText || formatMoney(order.totalValue, order.currency, locale);
    const items = (order.items || []).map((item) => `
      <div class="cfg360-order-item">
        <div class="cfg360-order-item-copy">
          <b>${escapeHtml(item.name || productName(item.productId, locale))}</b>
          <small>${escapeHtml(productName(item.productId, locale))}</small>
        </div>
        <span class="cfg360-order-item-price">${escapeHtml(formatMoney(item.amount, item.currency || order.currency, locale))}</span>
        <button class="cfg360-order-view" type="button" data-orders-view data-order-id="${escapeHtml(order.id)}" data-item-id="${escapeHtml(item.id)}" ${item.hasConfiguration ? '' : 'disabled'}>${escapeHtml(item.hasConfiguration ? copy.view : copy.unavailable)}</button>
      </div>`).join('');
    return `
      <details class="cfg360-order">
        <summary>
          <span class="cfg360-order-title">${escapeHtml(copy.order)} #${escapeHtml(order.orderNumber)}</span>
          <span class="cfg360-order-date">${escapeHtml(formatDate(order.requestedAtMs, locale))}</span>
          <strong class="cfg360-order-total">${escapeHtml(total)}</strong>
          <span class="cfg360-order-chevron" aria-hidden="true">›</span>
        </summary>
        <div class="cfg360-order-items" aria-label="${escapeHtml(`${itemCount} ${itemCount === 1 ? copy.item : copy.items}`)}">${items}</div>
      </details>`;
  }).join('');
}

async function loadOrders(dialog, locale) {
  const body = dialog?.querySelector('[data-orders-body]');
  if (!body) return;
  const copy = c(locale);
  body.innerHTML = `<div class="cfg360-orders-state">${escapeHtml(copy.loading)}</div>`;
  try {
    const result = await callOrdersAction('list-orders');
    const orders = Array.isArray(result?.orders) ? result.orders : [];
    if (!dialog.isConnected) return;
    body.innerHTML = renderOrders(orders, locale);
  } catch (error) {
    console.error('Order history could not be loaded.', error);
    if (!dialog.isConnected) return;
    body.innerHTML = `<div class="cfg360-orders-state">${escapeHtml(copy.error)}<br><button type="button" data-orders-retry>${escapeHtml(copy.retry)}</button></div>`;
  }
}

function closeOrdersDialog() {
  document.getElementById(DIALOG_ID)?.remove();
}

async function openOrdersDialog() {
  closeOrdersDialog();
  injectStyles();
  const locale = currentLocale();
  const template = document.createElement('template');
  template.innerHTML = dialogTemplate(locale).trim();
  const dialog = template.content.firstElementChild;
  document.body.append(dialog);
  dialog.querySelector('[data-orders-close]')?.focus();
  await loadOrders(dialog, locale);
}

async function openOrderConfiguration(button) {
  if (!button || button.disabled) return;
  const locale = currentLocale();
  const copy = c(locale);
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = copy.opening;
  try {
    const result = await callOrdersAction('view-order-item', {
      orderId: button.dataset.orderId,
      itemId: button.dataset.itemId,
    });
    const url = String(result?.url || '');
    if (!url) throw new Error('The configuration link is empty.');
    window.location.assign(url);
  } catch (error) {
    console.error('Archived order configuration could not be opened.', error);
    button.disabled = false;
    button.textContent = previous;
  }
}

export function installAccountOrders() {
  if (globalThis[INSTALL_KEY]) return;
  globalThis[INSTALL_KEY] = true;
  injectStyles();

  document.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-action="account-orders"]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      void openOrdersDialog();
      return;
    }

    const dialog = document.getElementById(DIALOG_ID);
    if (!dialog) return;
    if (event.target === dialog || event.target.closest?.('[data-orders-close]')) {
      event.preventDefault();
      closeOrdersDialog();
      return;
    }
    const retry = event.target.closest?.('[data-orders-retry]');
    if (retry) {
      event.preventDefault();
      void loadOrders(dialog, currentLocale());
      return;
    }
    const viewButton = event.target.closest?.('[data-orders-view]');
    if (viewButton) {
      event.preventDefault();
      void openOrderConfiguration(viewButton);
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById(DIALOG_ID)) closeOrdersDialog();
  });
}
