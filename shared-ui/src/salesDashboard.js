import {
  getFirebaseIdToken,
  observeGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
} from '/shared-ui/src/firebaseAuth.js?v=19';

const FUNCTION_BASE = 'https://europe-west1-configurator-360.cloudfunctions.net';
const state = {
  authUser: null,
  users: [],
  filteredUsers: [],
  demos: [],
  filteredDemos: [],
  selectedUid: '',
  selectedDetails: null,
  authorizedUid: '',
  authorizingUid: '',
};

const els = {
  authState: document.getElementById('authState'),
  authButton: document.getElementById('authButton'),
  signOutButton: document.getElementById('signOutButton'),
  accessCard: document.getElementById('accessCard'),
  accessTitle: document.getElementById('accessTitle'),
  accessMessage: document.getElementById('accessMessage'),
  workspace: document.getElementById('dashboardWorkspace'),
  userSearch: document.getElementById('userSearch'),
  userList: document.getElementById('userList'),
  userListStatus: document.getElementById('userListStatus'),
  refreshUsersButton: document.getElementById('refreshUsersButton'),
  userEmptyState: document.getElementById('userEmptyState'),
  userDetailsContent: document.getElementById('userDetailsContent'),
  selectedUserName: document.getElementById('selectedUserName'),
  selectedUserEmail: document.getElementById('selectedUserEmail'),
  selectedUserMeta: document.getElementById('selectedUserMeta'),
  userSummaryGrid: document.getElementById('userSummaryGrid'),
  quotationCount: document.getElementById('quotationCount'),
  quotationList: document.getElementById('quotationList'),
  quotationEmpty: document.getElementById('quotationEmpty'),
  cartCount: document.getElementById('cartCount'),
  cartTableWrap: document.getElementById('cartTableWrap'),
  cartTableBody: document.getElementById('cartTableBody'),
  cartEmpty: document.getElementById('cartEmpty'),
  demoSearch: document.getElementById('demoSearch'),
  demoList: document.getElementById('demoList'),
  demoListStatus: document.getElementById('demoListStatus'),
  demoEmpty: document.getElementById('demoEmpty'),
  refreshDemosButton: document.getElementById('refreshDemosButton'),
  toast: document.getElementById('toast'),
};

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function initials(user) {
  const source = String(user?.displayName || user?.email || '?').trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function dateTime(ms) {
  if (!Number.isFinite(Number(ms)) || Number(ms) <= 0) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Number(ms)));
}


function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function money(amount, currency) {
  const number = Number(amount);
  const code = String(currency || '').trim().toUpperCase();
  if (!Number.isFinite(number)) return '—';
  if (!/^[A-Z]{3}$/.test(code)) return `${number.toFixed(2)}${code ? ` ${code}` : ''}`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(number);
  } catch {
    return `${number.toFixed(2)} ${code}`;
  }
}

let toastTimer = null;
function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  els.toast.textContent = String(message || '');
  els.toast.classList.toggle('is-error', isError);
  els.toast.hidden = false;
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, isError ? 5000 : 2800);
}

function callableError(payload, status) {
  const message = payload?.error?.message || `Dashboard request failed (${status}).`;
  const error = new Error(message);
  error.code = String(payload?.error?.status || payload?.error?.code || `http-${status}`).toLowerCase();
  return error;
}

async function callDashboard(name, data = {}) {
  const token = await getFirebaseIdToken();
  if (!token) {
    const error = new Error('Google login is required.');
    error.code = 'unauthenticated';
    throw error;
  }
  const response = await fetch(`${FUNCTION_BASE}/${name}`, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok || payload?.error) throw callableError(payload, response.status);
  return payload?.result ?? payload?.data ?? null;
}

function setAccess(mode, title, message) {
  els.accessCard.classList.toggle('is-error', mode === 'error');
  els.accessCard.classList.toggle('is-ready', mode === 'ready');
  els.accessTitle.textContent = title;
  els.accessMessage.textContent = message;
}

function authLabel(user) {
  if (!user) return 'Not signed in';
  return user.email || user.displayName || 'Signed in';
}

async function authorizeAndLoad(user) {
  if (!user?.uid || state.authorizingUid === user.uid) return;
  if (state.authorizedUid === user.uid) return;
  state.authorizingUid = user.uid;
  state.authorizedUid = '';
  els.workspace.hidden = true;
  setAccess('loading', 'Checking access', 'Verifying dashboard authorization and loading Firebase users…');
  try {
    await loadUsers({ silent: true });
    if (state.authUser?.uid !== user.uid) return;
    state.authorizedUid = user.uid;
    setAccess('ready', 'Access granted', `Signed in as ${authLabel(user)}.`);
    els.workspace.hidden = false;
    await loadDemos({ silent: true });
  } catch (error) {
    if (state.authUser?.uid !== user.uid) return;
    console.error('Sales dashboard authorization failed.', error);
    const permission = String(error?.code || '').includes('permission') || String(error?.code || '').includes('unauth');
    setAccess('error', permission ? 'Access denied' : 'Could not load dashboard', error?.message || 'Dashboard access failed.');
    els.workspace.hidden = true;
  } finally {
    if (state.authorizingUid === user.uid) state.authorizingUid = '';
  }
}

async function loadUsers({ silent = false } = {}) {
  if (!silent) els.userListStatus.textContent = 'Loading users…';
  const allUsers = [];
  let pageToken = '';
  do {
    const result = await callDashboard('getSalesDashboardUsers', { pageSize: 1000, pageToken });
    allUsers.push(...(Array.isArray(result?.users) ? result.users : []));
    pageToken = String(result?.nextPageToken || '');
  } while (pageToken);
  allUsers.sort((a, b) => normalized(a.email).localeCompare(normalized(b.email)) || normalized(a.uid).localeCompare(normalized(b.uid)));
  state.users = allUsers;
  filterUsers();
  els.userListStatus.textContent = `${allUsers.length} user${allUsers.length === 1 ? '' : 's'}`;
}

function filterUsers() {
  const query = normalized(els.userSearch.value);
  state.filteredUsers = !query ? [...state.users] : state.users.filter((user) =>
    [user.displayName, user.email, user.uid].some((value) => normalized(value).includes(query)));
  renderUsers();
}

function userAvatar(user) {
  const avatar = element('span', 'user-avatar');
  if (user.photoURL) {
    const image = document.createElement('img');
    image.src = user.photoURL;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      image.remove();
      avatar.textContent = initials(user);
    }, { once: true });
    avatar.appendChild(image);
  } else {
    avatar.textContent = initials(user);
  }
  return avatar;
}

function renderUsers() {
  clear(els.userList);
  const fragment = document.createDocumentFragment();
  for (const user of state.filteredUsers) {
    const button = element('button', `user-row${state.selectedUid === user.uid ? ' is-active' : ''}`);
    button.type = 'button';
    button.dataset.uid = user.uid;
    button.appendChild(userAvatar(user));
    const copy = element('span');
    const name = element('strong', '', user.displayName || user.email || 'Unnamed user');
    const email = element('span', '', user.email || user.uid);
    copy.append(name, email);
    button.appendChild(copy);
    button.addEventListener('click', () => selectUser(user.uid));
    fragment.appendChild(button);
  }
  els.userList.appendChild(fragment);
  if (!state.filteredUsers.length) {
    const empty = element('p', 'empty-copy', 'No users match this search.');
    els.userList.appendChild(empty);
  }
}

async function selectUser(uid) {
  if (!uid) return;
  state.selectedUid = uid;
  state.selectedDetails = null;
  renderUsers();
  els.userEmptyState.hidden = true;
  els.userDetailsContent.hidden = false;
  els.selectedUserName.textContent = 'Loading…';
  els.selectedUserEmail.textContent = 'Fetching quotation and cart data';
  clear(els.selectedUserMeta);
  clear(els.userSummaryGrid);
  clear(els.quotationList);
  clear(els.cartTableBody);
  els.quotationEmpty.hidden = true;
  els.cartEmpty.hidden = true;
  els.cartTableWrap.hidden = true;
  try {
    const details = await callDashboard('getSalesDashboardUserDetails', { uid });
    if (state.selectedUid !== uid) return;
    state.selectedDetails = details;
    renderUserDetails(details);
  } catch (error) {
    if (state.selectedUid !== uid) return;
    console.error('Could not load user details.', error);
    els.selectedUserName.textContent = 'Could not load user';
    els.selectedUserEmail.textContent = error?.message || 'Unknown error';
    showToast(error?.message || 'Could not load user details.', true);
  }
}

function addPill(parent, text) {
  parent.appendChild(element('span', 'pill', text));
}

function summaryItem(label, value) {
  const item = element('div', 'summary-item');
  item.append(element('span', '', label), element('strong', '', value || '—'));
  return item;
}

function renderUserDetails(details) {
  const user = details?.user || {};
  const profile = details?.profile || {};
  const quotations = Array.isArray(details?.quotations) ? details.quotations : [];
  const cartItems = Array.isArray(details?.cartItems) ? details.cartItems : [];
  els.selectedUserName.textContent = user.displayName || profile.fullName || user.email || 'Unnamed user';
  els.selectedUserEmail.textContent = user.email || user.uid || '—';
  clear(els.selectedUserMeta);
  if (user.emailVerified) addPill(els.selectedUserMeta, 'Verified email');
  if (user.disabled) addPill(els.selectedUserMeta, 'Disabled');
  addPill(els.selectedUserMeta, user.uid || 'No UID');

  clear(els.userSummaryGrid);
  els.userSummaryGrid.append(
    summaryItem('Account created', dateTime(user.createdAtMs)),
    summaryItem('Last sign-in', dateTime(user.lastSignInAtMs)),
    summaryItem('Country / phone', [profile.country, profile.phone].filter(Boolean).join(' · ') || '—'),
    summaryItem('Default preferences', [profile.preferredLanguage, profile.defaultCurrency, profile.defaultSiteDomain].filter(Boolean).join(' · ') || '—'),
  );

  els.quotationCount.textContent = String(quotations.length);
  clear(els.quotationList);
  els.quotationEmpty.hidden = quotations.length > 0;
  quotations.forEach((quotation) => els.quotationList.appendChild(renderQuotation(quotation, user.uid)));

  els.cartCount.textContent = String(cartItems.length);
  clear(els.cartTableBody);
  els.cartEmpty.hidden = cartItems.length > 0;
  els.cartTableWrap.hidden = cartItems.length === 0;
  cartItems.forEach((item) => els.cartTableBody.appendChild(renderCartRow(item, user.uid)));
}

function statusClass(status) {
  const value = normalized(status);
  if (['sent', 'delivered', 'success'].some((token) => value.includes(token))) return ' is-success';
  if (['sending', 'pending', 'queued'].some((token) => value.includes(token))) return ' is-warning';
  return '';
}

function scopeBadge(tenantSlug) {
  return element('span', `scope-pill${tenantSlug ? ' is-tenant' : ''}`, tenantSlug ? `Tenant: ${tenantSlug}` : 'Public platform');
}

function renderQuotation(quotation, uid) {
  const card = element('article', 'quotation-card');
  const header = element('div', 'quotation-header');
  const left = element('div');
  left.appendChild(element('strong', '', dateTime(quotation.requestedAtMs)));
  const meta = element('div', 'quotation-meta');
  meta.appendChild(element('span', `status-pill${statusClass(quotation.status)}`, quotation.status || 'unknown'));
  meta.appendChild(scopeBadge(quotation.tenantSlug));
  if (quotation.locale) meta.appendChild(element('span', 'pill', quotation.locale));
  left.appendChild(meta);
  const total = element('div', 'quotation-total');
  total.append(
    element('strong', '', quotation.totalText || money(quotation.totalValue, quotation.currency)),
    element('span', '', `${quotation.items?.length || 0} item${quotation.items?.length === 1 ? '' : 's'}`),
  );
  header.append(left, total);
  card.appendChild(header);

  const wrap = element('div', 'table-wrap');
  const table = element('table', 'data-table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Configuration', 'Original price', 'Quotation price', ''].forEach((label) => headRow.appendChild(element('th', '', label)));
  thead.appendChild(headRow);
  const body = document.createElement('tbody');
  (quotation.items || []).forEach((item) => {
    const row = document.createElement('tr');
    const titleCell = element('td', 'item-title');
    titleCell.append(element('strong', '', item.name || `${item.productId} configuration`), element('span', '', item.productId || 'configuration'));
    const original = element('td', '', money(item.originalValue, item.originalCurrency));
    const quoted = element('td', '', money(item.quotationValue, item.quotationCurrency));
    const action = document.createElement('td');
    const button = element('button', 'action-button', 'Open configuration');
    button.type = 'button';
    button.disabled = !item.hasState;
    button.addEventListener('click', () => openConfiguration(button, {
      sourceType: 'quotation',
      uid,
      quotationId: quotation.id,
      itemId: item.id,
    }));
    action.appendChild(button);
    row.append(titleCell, original, quoted, action);
    body.appendChild(row);
  });
  table.append(thead, body);
  wrap.appendChild(table);
  card.appendChild(wrap);
  return card;
}

function renderCartRow(item, uid) {
  const row = document.createElement('tr');
  const titleCell = element('td', 'item-title');
  titleCell.append(element('strong', '', item.name || `${item.productId} configuration`), element('span', '', item.productId || 'configuration'));
  const scopeCell = document.createElement('td');
  scopeCell.appendChild(scopeBadge(item.tenantSlug));
  const added = element('td', '', dateTime(item.createdAtMs));
  const price = element('td', '', money(item.amount, item.currency));
  const action = document.createElement('td');
  const button = element('button', 'action-button', 'Open configuration');
  button.type = 'button';
  button.disabled = !item.hasState;
  button.addEventListener('click', () => openConfiguration(button, {
    sourceType: 'cart',
    uid,
    productId: item.productId,
    itemId: item.id,
    tenantSlug: item.tenantSlug || '',
  }));
  action.appendChild(button);
  row.append(titleCell, scopeCell, added, price, action);
  return row;
}

async function openConfiguration(button, payload) {
  const popup = window.open('about:blank', '_blank');
  if (popup) {
    try { popup.opener = null; } catch { /* best effort */ }
    try {
      popup.document.title = 'Preparing configuration…';
      popup.document.body.textContent = 'Preparing configuration…';
    } catch { /* best effort */ }
  }
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing…';
  try {
    const result = await callDashboard('createSalesDashboardConfigurationLink', payload);
    const url = String(result?.url || '');
    if (!url) throw new Error('The temporary configuration link was not returned.');
    if (popup) popup.location.replace(url);
    else window.open(url, '_blank');
  } catch (error) {
    try { popup?.close(); } catch { /* best effort */ }
    console.error('Could not create dashboard configuration link.', error);
    showToast(error?.message || 'Could not open this configuration.', true);
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

async function loadDemos({ silent = false } = {}) {
  if (!silent) els.demoListStatus.textContent = 'Loading demo requests…';
  const all = [];
  let cursorId = '';
  do {
    const result = await callDashboard('getSalesDashboardDemoRequests', { limit: 200, cursorId });
    all.push(...(Array.isArray(result?.requests) ? result.requests : []));
    cursorId = String(result?.nextCursorId || '');
  } while (cursorId);
  state.demos = all;
  filterDemos();
  els.demoListStatus.textContent = `${all.length} demo request${all.length === 1 ? '' : 's'}`;
}

function filterDemos() {
  const query = normalized(els.demoSearch.value);
  state.filteredDemos = !query ? [...state.demos] : state.demos.filter((demo) => {
    const logged = demo.loggedInUser || {};
    return [demo.email, demo.name, demo.company, demo.phone, logged.email, logged.displayName, logged.uid]
      .some((value) => normalized(value).includes(query));
  });
  renderDemos();
}

function demoField(label, value, className = '') {
  const field = element('div', `demo-field${className ? ` ${className}` : ''}`);
  field.append(element('span', '', label), element('strong', '', value || '—'));
  return field;
}

function renderDemos() {
  clear(els.demoList);
  els.demoEmpty.hidden = state.filteredDemos.length > 0;
  const fragment = document.createDocumentFragment();
  state.filteredDemos.forEach((demo) => fragment.appendChild(renderDemoCard(demo)));
  els.demoList.appendChild(fragment);
}

function renderDemoCard(demo) {
  const card = element('article', 'demo-card');
  const header = element('div', 'demo-card-header');
  const heading = element('div');
  heading.append(
    element('p', 'eyebrow', demo.company || 'Demo request'),
    element('h3', '', demo.name || 'Unnamed contact'),
    element('div', 'demo-form-email', demo.email || 'No form email'),
  );
  const headerRight = element('div', 'demo-date');
  headerRight.append(
    element('div', '', dateTime(demo.createdAtMs)),
    element('span', `status-pill${statusClass(demo.status)}`, demo.status || 'unknown'),
  );
  header.append(heading, headerRight);
  card.appendChild(header);

  const grid = element('div', 'demo-grid');
  grid.append(
    demoField('Form email', demo.email),
    demoField('Phone', demo.phone),
    demoField('Company', demo.company),
    demoField('Country', demo.country),
    demoField('Job title', demo.jobTitle),
    demoField('Preferred timing', demo.preferredTiming),
  );

  const loggedField = element('div', 'demo-field is-wide');
  loggedField.appendChild(element('span', '', 'Logged-in Firebase user'));
  const logged = element('div', `logged-user-box${demo.loggedInUser?.uid ? ' is-present' : ''}`);
  if (demo.loggedInUser?.uid) {
    logged.append(
      element('strong', '', demo.loggedInUser.displayName || demo.loggedInUser.email || 'Firebase user'),
      element('small', '', demo.loggedInUser.email || 'No email recorded'),
      element('small', '', `UID: ${demo.loggedInUser.uid}`),
    );
  } else {
    logged.append(element('strong', '', 'No logged-in user recorded'), element('small', '', 'Guest submission or request created before login capture was added.'));
  }
  loggedField.appendChild(logged);
  grid.appendChild(loggedField);

  const websiteField = element('div', 'demo-field is-wide');
  websiteField.appendChild(element('span', '', 'Company website'));
  const companyWebsiteUrl = safeHttpUrl(demo.companyWebsite);
  if (companyWebsiteUrl) {
    const link = element('a', 'source-link', demo.companyWebsite);
    link.href = companyWebsiteUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    websiteField.appendChild(link);
  } else websiteField.appendChild(element('strong', '', '—'));
  grid.appendChild(websiteField);

  const configs = element('div', 'demo-field is-full');
  configs.appendChild(element('span', '', 'Configurators requested'));
  const chips = element('div', 'demo-configurators');
  const names = Array.isArray(demo.configuratorNames) && demo.configuratorNames.length
    ? demo.configuratorNames
    : (Array.isArray(demo.configuratorIds) ? demo.configuratorIds : []);
  if (names.length) names.forEach((name) => chips.appendChild(element('span', '', name)));
  else chips.appendChild(element('strong', '', demo.configuratorName || demo.configuratorId || '—'));
  configs.appendChild(chips);
  grid.appendChild(configs);

  if (demo.message) {
    const message = element('div', 'demo-field is-full');
    message.append(element('span', '', 'Demo notes'), element('p', 'demo-message', demo.message));
    grid.appendChild(message);
  }

  const source = element('div', 'demo-field is-full');
  source.appendChild(element('span', '', 'Source'));
  const sourcePageUrl = safeHttpUrl(demo.sourcePage);
  if (sourcePageUrl) {
    const link = element('a', 'source-link', demo.sourceHost || demo.sourcePage);
    link.href = sourcePageUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    source.appendChild(link);
  } else source.appendChild(element('strong', '', demo.sourceHost || '—'));
  grid.appendChild(source);

  card.appendChild(grid);
  return card;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-button').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
}

document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab || 'users'));
});
els.userSearch.addEventListener('input', filterUsers);
els.demoSearch.addEventListener('input', filterDemos);
els.refreshUsersButton.addEventListener('click', async () => {
  try { await loadUsers(); } catch (error) { showToast(error?.message || 'Could not refresh users.', true); }
});
els.refreshDemosButton.addEventListener('click', async () => {
  try { await loadDemos(); } catch (error) { showToast(error?.message || 'Could not refresh demo requests.', true); }
});
els.authButton.addEventListener('click', async () => {
  els.authButton.disabled = true;
  try { await signInWithGoogle(); } catch (error) { showToast(error?.message || 'Google sign-in failed.', true); }
  finally { els.authButton.disabled = false; }
});
els.signOutButton.addEventListener('click', async () => {
  els.signOutButton.disabled = true;
  try { await signOutGoogle(); } catch (error) { showToast(error?.message || 'Sign-out failed.', true); }
  finally { els.signOutButton.disabled = false; }
});

observeGoogleAuth((user, error) => {
  if (error) {
    state.authUser = null;
    state.authorizedUid = '';
    els.authState.textContent = 'Authentication error';
    els.authButton.hidden = false;
    els.signOutButton.hidden = true;
    els.workspace.hidden = true;
    setAccess('error', 'Authentication error', String(error?.message || error));
    return;
  }

  state.authUser = user;
  state.authorizedUid = user?.uid === state.authorizedUid ? state.authorizedUid : '';
  els.authState.textContent = user ? authLabel(user) : 'Not signed in';
  els.authButton.hidden = Boolean(user);
  els.signOutButton.hidden = !user;
  if (!user) {
    state.users = [];
    state.demos = [];
    state.selectedUid = '';
    els.workspace.hidden = true;
    setAccess('loading', 'Sign in required', 'Sign in with an authorized Google account to access the internal sales dashboard.');
    return;
  }
  authorizeAndLoad(user);
}).catch((error) => {
  console.error('Could not initialize dashboard authentication.', error);
  setAccess('error', 'Authentication unavailable', error?.message || 'Could not initialize Firebase Authentication.');
  els.authButton.hidden = false;
});
