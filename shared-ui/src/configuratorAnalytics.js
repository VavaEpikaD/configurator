import { getFirebaseIdToken } from './firebaseAuth.js?v=18';

const PROJECT_ID = 'configurator-360';
const FUNCTIONS_REGION = 'europe-west1';
const FUNCTION_URL = `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/recordConfiguratorAnalyticsEvent`;
const PRODUCT_IDS = new Set(['window', 'roof', 'pergola', 'hall', 'solar', 'fence', 'cardbox', 'bookshelf']);
const EVENT_TYPES = new Set(['access', 'login', 'configuration_created']);

function normalizeProduct(value = '') {
  const product = String(value || '').trim().toLowerCase();
  return PRODUCT_IDS.has(product) ? product : '';
}

function analyticsSessionAccessKey(product) {
  const hostname = String(globalThis.location?.hostname || '').trim().toLowerCase();
  return `360-configurator:analytics:access:${hostname}:${product}`;
}

export async function recordConfiguratorAnalyticsEvent({ productType, eventType, requireAuth = false } = {}) {
  const product = normalizeProduct(productType);
  const event = String(eventType || '').trim().toLowerCase();
  if (!product || !EVENT_TYPES.has(event)) return false;

  const headers = { 'Content-Type': 'application/json' };
  if (requireAuth) {
    const token = await getFirebaseIdToken();
    if (!token) return false;
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers,
    body: JSON.stringify({ data: { productType: product, eventType: event } }),
  });

  let payload = null;
  try { payload = await response.json(); } catch { /* response status handled below */ }
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || `Configurator analytics request failed (${response.status}).`);
    error.code = payload?.error?.status || `http-${response.status}`;
    throw error;
  }
  return payload?.result?.recorded === true;
}

export async function recordConfiguratorAccessOnce(productType) {
  const product = normalizeProduct(productType);
  if (!product || typeof globalThis.sessionStorage === 'undefined') return false;
  const key = analyticsSessionAccessKey(product);
  if (globalThis.sessionStorage.getItem(key) === '1') return false;

  // Mark before sending so fast reloads cannot double-count the same tab session.
  globalThis.sessionStorage.setItem(key, '1');
  try {
    return await recordConfiguratorAnalyticsEvent({ productType: product, eventType: 'access' });
  } catch (error) {
    globalThis.sessionStorage.removeItem(key);
    throw error;
  }
}
