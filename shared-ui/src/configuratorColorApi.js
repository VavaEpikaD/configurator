import { getFirebaseIdToken } from './firebaseAuth.js';

const BASE_URL = 'https://europe-west1-configurator-360.cloudfunctions.net/';
const ALLOWED_CALLS = new Set(['getConfiguratorColorEditor', 'saveConfiguratorColors']);

export async function callConfiguratorColorAdmin(name, data) {
  if (!ALLOWED_CALLS.has(name)) throw new Error('Unknown editor operation.');
  const token = await getFirebaseIdToken();
  if (!token) {
    const error = new Error('Sign in with an authorized Google account.');
    error.code = 'UNAUTHENTICATED';
    throw error;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(`${BASE_URL}${name}`, {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: controller.signal,
      body: JSON.stringify({ data }),
    });
    let payload;
    try { payload = await response.json(); } catch (error) {
      if (error.name === 'AbortError') throw error;
      // A non-JSON response is reported below without trusting its body.
    }
    if (!response.ok || payload?.error) {
      const error = new Error(payload?.error?.message || `The editor request failed (${response.status}).`);
      error.code = payload?.error?.status || `HTTP_${response.status}`;
      throw error;
    }
    const result = payload?.result ?? payload?.data;
    if (!result) throw new Error('The editor returned an empty response.');
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeout = new Error('The request timed out. Reload published colors to check whether your changes were saved.');
      timeout.code = 'TIMEOUT';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
