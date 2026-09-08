import { getFirebaseIdToken } from './firebaseAuth.js?v=13';

const FUNCTIONS_REGION = 'europe-west1';
const PROJECT_ID = 'configurator-360';
const MAX_NAME_LENGTH = 80;
const ALLOWED_PRODUCTS = new Set(['window', 'roof', 'pergola', 'hall', 'solar', 'fence', 'cardbox', 'bookshelf']);

function normalizeProductType(value) {
  const product = String(value || '').trim().toLowerCase();
  if (!ALLOWED_PRODUCTS.has(product)) throw new Error('Unsupported configurator type.');
  return product;
}

function callableUrl(name) {
  return `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
}

async function callUserFunction(name, data = {}) {
  // Intentionally call the authenticated endpoint directly instead of through
  // the Firebase Functions browser SDK. This keeps Saved configurations outside
  // the App Check provider entirely, so reCAPTCHA assessments remain strictly
  // lazy and are only requested by the Share action.
  const token = await getFirebaseIdToken();
  if (!token) {
    const error = new Error('Google login is required.');
    error.code = 'auth-required';
    throw error;
  }

  const response = await fetch(callableUrl(name), {
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

  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || `Saved configuration request failed (${response.status}).`;
    const error = new Error(message);
    error.code = payload?.error?.status || `http-${response.status}`;
    throw error;
  }

  return payload?.result ?? payload?.data ?? null;
}

export async function saveUserConfiguration({ id = '', productType, name, state } = {}) {
  const product = normalizeProductType(productType);
  const projectName = String(name || '').trim().slice(0, MAX_NAME_LENGTH);
  if (!projectName) throw new Error('A project name is required.');
  const stateJson = JSON.stringify(state ?? {});

  return callUserFunction('saveUserConfiguration', {
    id: String(id || ''),
    productType: product,
    name: projectName,
    stateJson,
  });
}

export async function listUserConfigurations({ productType } = {}) {
  const product = normalizeProductType(productType);
  const result = await callUserFunction('listUserConfigurations', { productType: product });
  return Array.isArray(result?.items) ? result.items : [];
}

export async function getUserConfiguration({ id, productType } = {}) {
  const product = normalizeProductType(productType);
  const result = await callUserFunction('getUserConfiguration', {
    id: String(id || ''),
    productType: product,
  });
  if (!result?.stateJson) throw new Error('The saved configuration is empty.');
  return {
    ...result,
    state: JSON.parse(result.stateJson),
  };
}

export async function deleteUserConfiguration({ id, productType } = {}) {
  const product = normalizeProductType(productType);
  return callUserFunction('deleteUserConfiguration', {
    id: String(id || ''),
    productType: product,
  });
}
