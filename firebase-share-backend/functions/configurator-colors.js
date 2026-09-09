'use strict';

const { HttpsError, onCall, onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const WINDOW_DEFAULTS = require('./window-color-defaults.json');

// The same verified-account allowlist as the existing internal sales dashboard.
// Never authorize using an email, role, or admin flag supplied by the browser.
const EDITOR_ADMIN_EMAILS = new Set([
  'office@360design.ro',
  'alexandru.alexe@360design.ro',
  'vlamogusamogus@gmail.com',
  'matei.belciug.work@gmail.com',
]);
const EDITOR_ORIGINS = [
  'https://360configurator.com',
  'https://www.360configurator.com',
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/,
];
const OPTIONS = {
  region: 'europe-west1',
  serviceAccount: 'configurator-runtime@configurator-360.iam.gserviceaccount.com',
  timeoutSeconds: 30,
  memory: '256MiB',
};
const ADMIN_OPTIONS = { ...OPTIONS, cors: EDITOR_ORIGINS, enforceAppCheck: false };
const COLLECTION = 'configuratorColorPalettes';
const MAX_COLORS = 100;
const FINISH_GROUPS = [
  { id: 'mill', label: 'Mill finish', hasNames: true },
  { id: 'anodized', label: 'Anodized', hasNames: true },
  { id: 'coated', label: 'Color coated', hasNames: true },
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireKeys(value, keys, message) {
  if (!isObject(value) || Object.keys(value).length !== keys.length
      || !keys.every(key => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new HttpsError('invalid-argument', message);
  }
}

function requireWindow(id) {
  if (id !== 'window') {
    throw new HttpsError('invalid-argument', 'Color editing is currently available only for the window configurator.');
  }
}

async function requireEditorAdmin(request) {
  const origin = String(request.rawRequest?.get?.('origin') || '');
  if (!EDITOR_ORIGINS.some(allowed => allowed instanceof RegExp ? allowed.test(origin) : allowed === origin)) {
    throw new HttpsError('permission-denied', 'Open the editor on 360configurator.com.');
  }
  const uid = request.auth?.uid;
  if (!uid || typeof uid !== 'string') throw new HttpsError('unauthenticated', 'Google login is required.');
  let user;
  try {
    user = await getAuth().getUser(uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new HttpsError('unauthenticated', 'This account is no longer available.');
    }
    throw error;
  }
  if (user.disabled || !user.emailVerified || !EDITOR_ADMIN_EMAILS.has(String(user.email || '').trim().toLowerCase())) {
    throw new HttpsError('permission-denied', 'This account is not authorized to edit window colors.');
  }
  // Callable token validation is supplemented with revocation checks so removing
  // access or revoking sessions cannot leave an existing editor tab authorized.
  const validAfter = Date.parse(user.tokensValidAfterTime || '') || 0;
  const authenticatedAt = Number(request.auth.token?.auth_time) * 1000;
  if (validAfter && (!Number.isFinite(authenticatedAt) || authenticatedAt < validAfter)) {
    throw new HttpsError('unauthenticated', 'Your session has expired. Sign in again.');
  }
  return user;
}

function validateGroups(groups) {
  requireKeys(groups, FINISH_GROUPS.map(group => group.id), 'Include exactly the three window finish groups.');
  const result = {};
  for (const { id: groupId, label } of FINISH_GROUPS) {
    const colors = groups[groupId];
    if (!Array.isArray(colors) || colors.length < 1 || colors.length > MAX_COLORS) {
      throw new HttpsError('invalid-argument', `${label} must contain between 1 and ${MAX_COLORS} colors.`);
    }
    const ids = new Set();
    result[groupId] = colors.map(color => {
      requireKeys(color, ['id', 'name', 'color'], `Invalid color in ${label}.`);
      if (typeof color.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(color.id) || ids.has(color.id)) {
        throw new HttpsError('invalid-argument', `Color IDs must be valid and unique within ${label}.`);
      }
      if (typeof color.name !== 'string' || !color.name.trim() || color.name.length > 120
          || /[\u0000-\u001f\u007f]/.test(color.name)) {
        throw new HttpsError('invalid-argument', 'Every color needs a name of 1–120 characters without control characters.');
      }
      if (typeof color.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color.color)) {
        throw new HttpsError('invalid-argument', 'Use six-digit hexadecimal colors, for example #383e42.');
      }
      ids.add(color.id);
      return { id: color.id, name: color.name.trim(), color: color.color.toLowerCase() };
    });
  }
  return result;
}

function publicPalette(snapshot) {
  if (!snapshot.exists) {
    return { schemaVersion: 1, configuratorId: 'window', revision: 0, groups: validateGroups(WINDOW_DEFAULTS), updatedAtMs: 0 };
  }
  const data = snapshot.data();
  if (data.schemaVersion !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 1) {
    throw new HttpsError('failed-precondition', 'The stored color palette is not valid.');
  }
  // Explicit projection: neither editor identity nor audit history is public.
  return {
    schemaVersion: 1,
    configuratorId: 'window',
    revision: data.revision,
    groups: validateGroups(data.groups),
    updatedAtMs: data.updatedAt?.toMillis?.() || 0,
  };
}

exports.getConfiguratorColorEditor = onCall(ADMIN_OPTIONS, async request => {
  await requireEditorAdmin(request);
  requireKeys(request.data, ['configuratorId'], 'Specify the configurator to edit.');
  requireWindow(request.data.configuratorId);
  const snapshot = await getFirestore().collection(COLLECTION).doc('window').get();
  return {
    ...publicPalette(snapshot),
    finishGroups: FINISH_GROUPS,
    maxColorsPerGroup: MAX_COLORS,
  };
});

exports.saveConfiguratorColors = onCall(ADMIN_OPTIONS, async request => {
  const user = await requireEditorAdmin(request);
  requireKeys(request.data, ['configuratorId', 'expectedRevision', 'groups'], 'Invalid palette update.');
  requireWindow(request.data.configuratorId);
  const { expectedRevision } = request.data;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new HttpsError('invalid-argument', 'A valid palette revision is required. Reload the editor.');
  }
  const groups = validateGroups(request.data.groups);
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc('window');
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = publicPalette(snapshot);
    if (current.revision !== expectedRevision) {
      throw new HttpsError('aborted', 'Another administrator published changes. Reload the published colors before saving again.');
    }
    const revision = current.revision + 1;
    const updatedAt = Timestamp.now();
    const data = { schemaVersion: 1, revision, groups, updatedAt, updatedBy: user.uid };
    // The published document and its immutable audit snapshot are one atomic write.
    transaction.set(ref, data);
    transaction.create(ref.collection('history').doc(String(revision)), data);
    return { schemaVersion: 1, configuratorId: 'window', revision, groups, updatedAtMs: updatedAt.toMillis() };
  });
});

// This endpoint contains only public picker data and intentionally needs no login
// or App Check. Writes are NEVER exposed here, even with a valid admin token.
exports.getConfiguratorColors = onRequest({ ...OPTIONS, cors: true }, async (request, response) => {
  response.set('Cache-Control', 'no-store, max-age=0');
  response.set('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.set('Allow', 'GET');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (request.query?.configuratorId !== 'window') {
    response.status(400).json({ error: 'Unsupported configurator.' });
    return;
  }
  try {
    const snapshot = await getFirestore().collection(COLLECTION).doc('window').get();
    response.status(200).json(publicPalette(snapshot));
  } catch (error) {
    console.error('Unable to load published configurator colors.', error);
    response.status(503).json({ error: 'Published colors are temporarily unavailable.' });
  }
});
