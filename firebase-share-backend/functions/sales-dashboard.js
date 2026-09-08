'use strict';

const { randomBytes } = require('node:crypto');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { Timestamp, getFirestore } = require('firebase-admin/firestore');

const FUNCTION_REGION = 'europe-west1';
const RUNTIME_SERVICE_ACCOUNT = 'configurator-runtime@configurator-360.iam.gserviceaccount.com';
const SHARES_COLLECTION = 'sharedConfigurations';
const DEMO_REQUESTS_COLLECTION = 'demoRequests';
const SHARE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_SINGLE_SHARE_BYTES = 850_000;
const MAX_DEMO_PAGE_SIZE = 200;
const MAX_AUTH_PAGE_SIZE = 1000;
const DEMO_LOGIN_ATTACH_WINDOW_MS = 15 * 60 * 1000;

const DASHBOARD_ADMIN_EMAILS = new Set([
  'office@360design.ro',
  'alexandru.alexe@360design.ro',
  'vlamogusamogus@gmail.com',
]);

const DASHBOARD_ORIGINS = Object.freeze([
  'https://360configurator.com',
  'https://www.360configurator.com',
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/,
]);

const DEMO_ATTACH_ORIGINS = Object.freeze([
  'https://360configurator.com',
  'https://www.360configurator.com',
  'https://360configurator.ro',
  'https://www.360configurator.ro',
  'https://360konfigurator.de',
  'https://www.360konfigurator.de',
  'https://aks.360configurator.com',
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/,
]);

const PRODUCTS = Object.freeze([
  'window',
  'roof',
  'pergola',
  'hall',
  'solar',
  'fence',
  'cardbox',
  'bookshelf',
]);
const PRODUCT_SET = new Set(PRODUCTS);
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const CONFIGURATOR_PATHS = Object.freeze({
  window: '/window-configurator/',
  roof: '/roof-configurator/',
  pergola: '/pergola-configurator/',
  hall: '/hall-configurator/',
  solar: '/solar-configurator/',
  fence: '/fence-configurator/',
  cardbox: '/cardbox-configurator/',
  bookshelf: '/bookshelf-configurator/',
});

const DASHBOARD_CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  cors: DASHBOARD_ORIGINS,
  enforceAppCheck: false,
  timeoutSeconds: 60,
  memory: '512MiB',
});

const DEMO_ATTACH_CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  cors: DEMO_ATTACH_ORIGINS,
  enforceAppCheck: true,
  timeoutSeconds: 30,
  memory: '256MiB',
});

function timestampMs(value) {
  return value?.toMillis?.() || 0;
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function requestOrigin(request) {
  return String(request.rawRequest?.get?.('origin') || '').trim().replace(/\/$/, '');
}

function originMatches(origin, allowed) {
  return allowed.some((candidate) => candidate instanceof RegExp ? candidate.test(origin) : candidate === origin);
}

function requireDashboardOrigin(request) {
  const origin = requestOrigin(request);
  if (!originMatches(origin, DASHBOARD_ORIGINS)) {
    throw new HttpsError('permission-denied', 'The sales dashboard is only available from the internal dashboard page.');
  }
  return origin;
}

async function requireDashboardAdmin(request) {
  requireDashboardOrigin(request);
  const uid = cleanText(request.auth?.uid, 256);
  if (!uid) throw new HttpsError('unauthenticated', 'Google login is required.');

  const authUser = await getAuth().getUser(uid);
  const email = cleanText(authUser.email, 254).toLowerCase();
  if (!authUser.emailVerified || !DASHBOARD_ADMIN_EMAILS.has(email)) {
    throw new HttpsError('permission-denied', 'This account is not authorized to access the sales dashboard.');
  }
  return authUser;
}

function authUserSummary(user) {
  return {
    uid: cleanText(user?.uid, 256),
    email: cleanText(user?.email, 254),
    displayName: cleanText(user?.displayName, 160),
    photoURL: cleanText(user?.photoURL, 2048),
    emailVerified: Boolean(user?.emailVerified),
    disabled: Boolean(user?.disabled),
    createdAtMs: user?.metadata?.creationTime ? Date.parse(user.metadata.creationTime) || 0 : 0,
    lastSignInAtMs: user?.metadata?.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) || 0 : 0,
  };
}

function userProfileSummary(data) {
  const profile = data?.profile && typeof data.profile === 'object' ? data.profile : {};
  return {
    fullName: cleanText(profile.fullName, 160),
    phone: cleanText(profile.phone, 60),
    country: cleanText(profile.country, 120),
    preferredLanguage: cleanText(profile.preferredLanguage, 20),
    defaultSiteDomain: cleanText(profile.defaultSiteDomain, 20),
    defaultCurrency: cleanText(profile.defaultCurrency, 12),
    profileUpdatedAtMs: timestampMs(data?.profileUpdatedAt),
  };
}

function quotationRequestSummary(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    quotationId: cleanText(data.quotationId || doc.id, 256),
    status: cleanText(data.status || 'unknown', 40),
    requestedAtMs: timestampMs(data.requestedAt || data.sentAt),
    sentAtMs: timestampMs(data.sentAt),
    providerAcceptedAtMs: timestampMs(data.providerAcceptedAt),
    itemCount: Math.max(0, Math.floor(finiteNumber(data.itemCount))),
    locale: cleanText(data.locale, 20),
    currency: cleanText(data.currency, 12),
    totalValue: finiteNumber(data.totalValue),
    totalText: cleanText(data.totalText, 100),
    tenantSlug: cleanText(data.tenantSlug, 80),
    origin: cleanText(data.origin, 500),
    userEmail: cleanText(data.userEmail, 254),
    userName: cleanText(data.userName, 160),
  };
}

function quotationItemSummary(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    position: Math.max(0, Math.floor(finiteNumber(data.position))),
    cartItemId: cleanText(data.cartItemId, 256),
    productId: cleanText(data.productId, 60),
    name: cleanText(data.name, 160),
    originalValue: finiteNumber(data.originalValue),
    originalCurrency: cleanText(data.originalCurrency, 12),
    quotationValue: finiteNumber(data.quotationValue),
    quotationCurrency: cleanText(data.quotationCurrency, 12),
    archivedAtMs: timestampMs(data.archivedAt),
    cartCreatedAtMs: timestampMs(data.cartCreatedAt),
    hasState: typeof data.configurationState === 'string' && data.configurationState.length > 0,
  };
}

function cartItemSummary(doc, productId, tenantSlug = '') {
  const data = doc.data() || {};
  const amount = finiteNumber(data.priceAmount ?? data.costAmount);
  return {
    id: doc.id,
    productId,
    tenantSlug,
    scope: tenantSlug ? 'tenant' : 'public',
    name: cleanText(data.n || data.name || `${productId} configuration`, 160),
    amount,
    currency: cleanText(data.currency, 12),
    createdAtMs: timestampMs(data.createdAt),
    updatedAtMs: timestampMs(data.updatedAt),
    hasState: typeof data.s === 'string' && data.s.length > 0,
  };
}

function publicCartCollection(db, uid, productId) {
  return db.collection('users').doc(uid).collection('shoppingCart').doc(productId).collection('items');
}

function tenantCartCollection(db, uid, tenantSlug, productId) {
  return db.collection('users').doc(uid)
    .collection('tenantShoppingCart').doc(tenantSlug)
    .collection('products').doc(productId)
    .collection('items');
}

async function readAllCartItems(uid) {
  const db = getFirestore();
  const result = [];

  const publicSnapshots = await Promise.all(PRODUCTS.map((productId) => publicCartCollection(db, uid, productId).get()));
  for (let index = 0; index < PRODUCTS.length; index += 1) {
    for (const doc of publicSnapshots[index].docs) result.push(cartItemSummary(doc, PRODUCTS[index], ''));
  }

  const tenantRefs = await db.collection('users').doc(uid).collection('tenantShoppingCart').listDocuments();
  for (const tenantRef of tenantRefs) {
    const tenantSlug = cleanText(tenantRef.id, 80);
    if (!tenantSlug) continue;
    const snapshots = await Promise.all(PRODUCTS.map((productId) => tenantCartCollection(db, uid, tenantSlug, productId).get()));
    for (let index = 0; index < PRODUCTS.length; index += 1) {
      for (const doc of snapshots[index].docs) result.push(cartItemSummary(doc, PRODUCTS[index], tenantSlug));
    }
  }

  result.sort((a, b) => b.createdAtMs - a.createdAtMs || a.productId.localeCompare(b.productId) || a.id.localeCompare(b.id));
  return result;
}

async function readQuotationRequests(uid) {
  const requestSnapshot = await getFirestore().collection('quotations').doc(uid).collection('requests').get();
  const quotations = await Promise.all(requestSnapshot.docs.map(async (doc) => {
    const itemsSnapshot = await doc.ref.collection('items').get();
    const items = itemsSnapshot.docs.map(quotationItemSummary)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    return { ...quotationRequestSummary(doc), items };
  }));
  quotations.sort((a, b) => b.requestedAtMs - a.requestedAtMs || b.id.localeCompare(a.id));
  return quotations;
}

function serializeDemoRequest(doc) {
  const data = doc.data() || {};
  const loggedInUser = data.loggedInUser && typeof data.loggedInUser === 'object'
    ? {
      uid: cleanText(data.loggedInUser.uid, 256),
      email: cleanText(data.loggedInUser.email, 254),
      displayName: cleanText(data.loggedInUser.displayName, 160),
      photoURL: cleanText(data.loggedInUser.photoURL, 2048),
      emailVerified: Boolean(data.loggedInUser.emailVerified),
    }
    : null;

  return {
    id: doc.id,
    requestId: cleanText(data.requestId || doc.id, 256),
    status: cleanText(data.status, 60),
    emailStatus: cleanText(data.emailStatus, 60),
    createdAtMs: timestampMs(data.createdAt),
    updatedAtMs: timestampMs(data.updatedAt),
    sentAtMs: timestampMs(data.sentAt),
    failedAtMs: timestampMs(data.failedAt),
    name: cleanText(data.name, 160),
    email: cleanText(data.email, 254),
    company: cleanText(data.company, 180),
    phone: cleanText(data.phone, 80),
    companyWebsite: cleanText(data.companyWebsite, 500),
    jobTitle: cleanText(data.jobTitle, 160),
    country: cleanText(data.country, 140),
    preferredTiming: cleanText(data.preferredTiming, 80),
    message: cleanText(data.message, 4000),
    configuratorId: cleanText(data.configuratorId, 60),
    configuratorName: cleanText(data.configuratorName, 160),
    configuratorIds: Array.isArray(data.configuratorIds) ? data.configuratorIds.map((value) => cleanText(value, 60)).filter(Boolean) : [],
    configuratorNames: Array.isArray(data.configuratorNames) ? data.configuratorNames.map((value) => cleanText(value, 160)).filter(Boolean) : [],
    sourceConfiguratorId: cleanText(data.sourceConfiguratorId, 60),
    sourceConfiguratorName: cleanText(data.sourceConfiguratorName, 160),
    language: cleanText(data.language, 20),
    sourcePage: cleanText(data.sourcePage, 2200),
    sourceHost: cleanText(data.sourceHost, 300),
    sourceConfiguratorPage: cleanText(data.sourceConfiguratorPage, 2200),
    recipient: cleanText(data.recipient, 254),
    loggedInUser,
    loggedInUserAttachedAtMs: timestampMs(data.loggedInUserAttachedAt),
  };
}

function validatedProduct(value) {
  const product = cleanText(value, 60).toLowerCase();
  if (!PRODUCT_SET.has(product)) throw new HttpsError('failed-precondition', 'Unsupported configurator type.');
  return product;
}

function validatedState(rawState) {
  const state = String(rawState || '');
  if (!state) throw new HttpsError('failed-precondition', 'The configuration snapshot is missing.');
  const sizeBytes = Buffer.byteLength(state, 'utf8');
  if (sizeBytes > MAX_SINGLE_SHARE_BYTES) {
    throw new HttpsError('resource-exhausted', 'The configuration snapshot is too large to open.');
  }
  try {
    const parsed = JSON.parse(state);
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
  } catch {
    throw new HttpsError('failed-precondition', 'The configuration snapshot is invalid.');
  }
  return { state, sizeBytes };
}

async function createTemporaryConfigurationLink({ productId, state, tenantSlug = '' }) {
  const product = validatedProduct(productId);
  const validated = validatedState(state);
  const db = getFirestore();
  const createdAt = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + SHARE_LIFETIME_MS);

  let shareId = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomBytes(12).toString('base64url');
    try {
      await db.collection(SHARES_COLLECTION).doc(candidate).create({
        v: 1,
        p: product,
        s: validated.state,
        sizeBytes: validated.sizeBytes,
        createdAt,
        expiresAt,
        quotaVersion: 2,
        source: 'sales-dashboard',
      });
      shareId = candidate;
      break;
    } catch (error) {
      if (Number(error?.code) === 6 || String(error?.code) === 'already-exists') continue;
      throw error;
    }
  }
  if (!shareId) throw new HttpsError('aborted', 'Could not create a temporary configuration link.');

  const rawTenant = cleanText(tenantSlug, 80).toLowerCase();
  const safeTenant = rawTenant && TENANT_SLUG_PATTERN.test(rawTenant) ? rawTenant : '';
  if (rawTenant && !safeTenant) throw new HttpsError('failed-precondition', 'The configuration tenant scope is invalid.');
  const host = safeTenant ? `${safeTenant}.360configurator.com` : 'www.360configurator.com';
  const path = CONFIGURATOR_PATHS[product];
  const target = new URL(`https://${host}${path}`);
  const hash = new URLSearchParams();
  hash.set('s', shareId);
  hash.set('domainAuthState', 'guest');
  target.hash = hash.toString();
  return { url: target.href, expiresAtMs: expiresAt.toMillis() };
}

exports.getSalesDashboardUsers = onCall(DASHBOARD_CALLABLE_OPTIONS, async (request) => {
  const admin = await requireDashboardAdmin(request);
  const requestedPageSize = Math.floor(finiteNumber(request.data?.pageSize, MAX_AUTH_PAGE_SIZE));
  const pageSize = Math.max(1, Math.min(MAX_AUTH_PAGE_SIZE, requestedPageSize || MAX_AUTH_PAGE_SIZE));
  const pageToken = cleanText(request.data?.pageToken, 2000) || undefined;
  const result = await getAuth().listUsers(pageSize, pageToken);
  return {
    admin: authUserSummary(admin),
    users: result.users.map(authUserSummary),
    nextPageToken: result.pageToken || '',
  };
});

exports.getSalesDashboardUserDetails = onCall(DASHBOARD_CALLABLE_OPTIONS, async (request) => {
  await requireDashboardAdmin(request);
  const uid = cleanText(request.data?.uid, 256);
  if (!uid) throw new HttpsError('invalid-argument', 'A Firebase user ID is required.');

  const [authUser, rootSnapshot, quotations, cartItems] = await Promise.all([
    getAuth().getUser(uid),
    getFirestore().collection('users').doc(uid).get(),
    readQuotationRequests(uid),
    readAllCartItems(uid),
  ]);

  return {
    user: authUserSummary(authUser),
    profile: userProfileSummary(rootSnapshot.data() || {}),
    quotations,
    cartItems,
  };
});

exports.getSalesDashboardDemoRequests = onCall(DASHBOARD_CALLABLE_OPTIONS, async (request) => {
  await requireDashboardAdmin(request);
  const requestedLimit = Math.floor(finiteNumber(request.data?.limit, MAX_DEMO_PAGE_SIZE));
  const limit = Math.max(1, Math.min(MAX_DEMO_PAGE_SIZE, requestedLimit || MAX_DEMO_PAGE_SIZE));
  const cursorId = cleanText(request.data?.cursorId, 256);

  let query = getFirestore().collection(DEMO_REQUESTS_COLLECTION).orderBy('createdAt', 'desc').limit(limit);
  if (cursorId) {
    const cursor = await getFirestore().collection(DEMO_REQUESTS_COLLECTION).doc(cursorId).get();
    if (!cursor.exists) throw new HttpsError('invalid-argument', 'The demo request cursor is no longer available.');
    query = getFirestore().collection(DEMO_REQUESTS_COLLECTION).orderBy('createdAt', 'desc').startAfter(cursor).limit(limit);
  }

  const snapshot = await query.get();
  return {
    requests: snapshot.docs.map(serializeDemoRequest),
    nextCursorId: snapshot.size === limit ? snapshot.docs[snapshot.docs.length - 1]?.id || '' : '',
  };
});

exports.createSalesDashboardConfigurationLink = onCall(DASHBOARD_CALLABLE_OPTIONS, async (request) => {
  await requireDashboardAdmin(request);
  const uid = cleanText(request.data?.uid, 256);
  const sourceType = cleanText(request.data?.sourceType, 40).toLowerCase();
  if (!uid) throw new HttpsError('invalid-argument', 'A Firebase user ID is required.');

  const db = getFirestore();
  if (sourceType === 'quotation') {
    const quotationId = cleanText(request.data?.quotationId, 256);
    const itemId = cleanText(request.data?.itemId, 256);
    if (!quotationId || !itemId) throw new HttpsError('invalid-argument', 'Quotation and item IDs are required.');
    const requestRef = db.collection('quotations').doc(uid).collection('requests').doc(quotationId);
    const [requestSnapshot, itemSnapshot] = await Promise.all([
      requestRef.get(),
      requestRef.collection('items').doc(itemId).get(),
    ]);
    if (!requestSnapshot.exists || !itemSnapshot.exists) throw new HttpsError('not-found', 'The quotation configuration no longer exists.');
    const requestData = requestSnapshot.data() || {};
    const itemData = itemSnapshot.data() || {};
    return createTemporaryConfigurationLink({
      productId: itemData.productId,
      state: itemData.configurationState,
      tenantSlug: requestData.tenantSlug || '',
    });
  }

  if (sourceType === 'cart') {
    const productId = validatedProduct(request.data?.productId);
    const itemId = cleanText(request.data?.itemId, 256);
    const tenantSlug = cleanText(request.data?.tenantSlug, 80).toLowerCase();
    if (!itemId) throw new HttpsError('invalid-argument', 'A cart item ID is required.');
    const ref = tenantSlug
      ? tenantCartCollection(db, uid, tenantSlug, productId).doc(itemId)
      : publicCartCollection(db, uid, productId).doc(itemId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'The cart configuration no longer exists.');
    const data = snapshot.data() || {};
    return createTemporaryConfigurationLink({
      productId,
      state: data.s || data.stateJson,
      tenantSlug,
    });
  }

  throw new HttpsError('invalid-argument', 'Unsupported configuration source.');
});

exports.attachDemoRequestUser = onCall(DEMO_ATTACH_CALLABLE_OPTIONS, async (request) => {
  const uid = cleanText(request.auth?.uid, 256);
  if (!uid) throw new HttpsError('unauthenticated', 'Google login is required.');
  const requestId = cleanText(request.data?.requestId, 256);
  if (!requestId) throw new HttpsError('invalid-argument', 'A demo request ID is required.');

  const ref = getFirestore().collection(DEMO_REQUESTS_COLLECTION).doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'The demo request was not found.');
  const data = snapshot.data() || {};
  const createdAtMs = timestampMs(data.createdAt);
  if (!createdAtMs || Math.abs(Date.now() - createdAtMs) > DEMO_LOGIN_ATTACH_WINDOW_MS) {
    throw new HttpsError('failed-precondition', 'The demo request is no longer eligible for login capture.');
  }

  const existingUid = cleanText(data.loggedInUser?.uid, 256);
  if (existingUid && existingUid !== uid) {
    throw new HttpsError('already-exists', 'A different signed-in user is already recorded for this demo request.');
  }
  if (existingUid === uid) return { attached: true, alreadyAttached: true };

  const authUser = await getAuth().getUser(uid);
  await ref.set({
    loggedInUser: {
      uid: authUser.uid,
      email: cleanText(authUser.email, 254),
      displayName: cleanText(authUser.displayName, 160),
      photoURL: cleanText(authUser.photoURL, 2048),
      emailVerified: Boolean(authUser.emailVerified),
    },
    loggedInUserAttachedAt: Timestamp.now(),
    loginCaptureVersion: 1,
  }, { merge: true });

  return { attached: true, alreadyAttached: false };
});
