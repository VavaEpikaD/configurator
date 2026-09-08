'use strict';

const { HttpsError, onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { getAuth } = require('firebase-admin/auth');
const { Timestamp, getFirestore } = require('firebase-admin/firestore');

const FUNCTION_REGION = 'europe-west1';
const RUNTIME_SERVICE_ACCOUNT = 'configurator-runtime@configurator-360.iam.gserviceaccount.com';
const PROFILE_VERSION = 1;
const MAX_HISTORY_ITEMS = 50;
const MAX_AVATAR_DATA_URL_LENGTH = 240_000;
const LOCALES = new Set(['en-US', 'ro-RO', 'de-DE']);
const DOMAINS = new Set(['com', 'ro', 'de']);
const CURRENCIES = new Set(['USD', 'RON', 'EUR']);
const MEASUREMENT_SYSTEMS = new Set(['metric', 'imperial']);
const PROFILE_ALLOWED_ORIGINS = Object.freeze([
  'https://360configurator.com',
  'https://www.360configurator.com',
  'https://360configurator.ro',
  'https://www.360configurator.ro',
  'https://360konfigurator.de',
  'https://www.360konfigurator.de',
  'https://aks.360configurator.com',
  /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?\.360configurator\.com$/,
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/,
]);

const CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  cors: PROFILE_ALLOWED_ORIGINS,
  enforceAppCheck: false,
  timeoutSeconds: 30,
  memory: '256MiB',
});

function requireUid(request) {
  const uid = String(request.auth?.uid || '').trim();
  if (!uid) throw new HttpsError('unauthenticated', 'Google login is required.');
  return uid;
}

function cleanText(value, maxLength = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function cleanEnum(value, allowed, fallback) {
  const normalized = cleanText(value, 40);
  return allowed.has(normalized) ? normalized : fallback;
}

function cleanAvatar(value) {
  const avatar = String(value || '');
  if (!avatar) return '';
  if (avatar.length > MAX_AVATAR_DATA_URL_LENGTH) {
    throw new HttpsError('invalid-argument', 'The profile photo is too large.');
  }
  if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(avatar)) {
    throw new HttpsError('invalid-argument', 'The profile photo format is not supported.');
  }
  return avatar;
}

function timestampMs(value) {
  return value?.toMillis?.() || 0;
}

function profileDefaults(authUser) {
  return {
    v: PROFILE_VERSION,
    fullName: cleanText(authUser?.displayName || '', 120),
    phone: cleanText(authUser?.phoneNumber || '', 40),
    country: '',
    preferredLanguage: 'en-US',
    timeZone: 'UTC',
    defaultSiteDomain: 'com',
    defaultCurrency: 'EUR',
    defaultMeasurementSystem: 'metric',
    avatarMode: authUser?.photoURL ? 'photo' : 'initials',
    avatarDataUrl: '',
  };
}

function normalizeStoredProfile(raw, authUser) {
  const defaults = profileDefaults(authUser);
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    v: PROFILE_VERSION,
    fullName: cleanText(source.fullName || defaults.fullName, 120),
    phone: cleanText(source.phone || defaults.phone, 40),
    country: cleanText(source.country || '', 120),
    preferredLanguage: cleanEnum(source.preferredLanguage, LOCALES, defaults.preferredLanguage),
    timeZone: cleanText(source.timeZone || defaults.timeZone, 120) || defaults.timeZone,
    defaultSiteDomain: cleanEnum(source.defaultSiteDomain, DOMAINS, defaults.defaultSiteDomain),
    defaultCurrency: cleanEnum(source.defaultCurrency, CURRENCIES, defaults.defaultCurrency),
    defaultMeasurementSystem: cleanEnum(source.defaultMeasurementSystem, MEASUREMENT_SYSTEMS, defaults.defaultMeasurementSystem),
    avatarMode: source.avatarMode === 'initials' || source.avatarMode === 'photo'
      ? source.avatarMode
      : defaults.avatarMode,
    avatarDataUrl: typeof source.avatarDataUrl === 'string' && source.avatarDataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH
      ? source.avatarDataUrl
      : '',
  };
}

function sanitizeIncomingProfile(raw, authUser) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const current = profileDefaults(authUser);
  const fullName = cleanText(source.fullName, 120);
  if (!fullName) throw new HttpsError('invalid-argument', 'Full name is required.');

  return {
    v: PROFILE_VERSION,
    fullName,
    phone: cleanText(source.phone, 40),
    country: cleanText(source.country, 120),
    preferredLanguage: cleanEnum(source.preferredLanguage, LOCALES, current.preferredLanguage),
    timeZone: cleanText(source.timeZone, 120) || current.timeZone,
    defaultSiteDomain: cleanEnum(source.defaultSiteDomain, DOMAINS, current.defaultSiteDomain),
    defaultCurrency: cleanEnum(source.defaultCurrency, CURRENCIES, current.defaultCurrency),
    defaultMeasurementSystem: cleanEnum(source.defaultMeasurementSystem, MEASUREMENT_SYSTEMS, current.defaultMeasurementSystem),
    avatarMode: source.avatarMode === 'initials' ? 'initials' : 'photo',
    avatarDataUrl: source.avatarMode === 'initials' ? '' : cleanAvatar(source.avatarDataUrl),
  };
}

function authSummary(authUser) {
  const providers = Array.isArray(authUser?.providerData)
    ? authUser.providerData.map((provider) => ({
      providerId: cleanText(provider.providerId, 80),
      displayName: cleanText(provider.displayName, 120),
      email: cleanText(provider.email, 254),
    })).filter((provider) => provider.providerId)
    : [];
  return {
    uid: String(authUser?.uid || ''),
    email: cleanText(authUser?.email, 254),
    emailVerified: Boolean(authUser?.emailVerified),
    displayName: cleanText(authUser?.displayName, 120),
    photoURL: cleanText(authUser?.photoURL, 2048),
    providers,
    createdAtMs: authUser?.metadata?.creationTime ? Date.parse(authUser.metadata.creationTime) || 0 : 0,
    lastSignInAtMs: authUser?.metadata?.lastSignInTime ? Date.parse(authUser.metadata.lastSignInTime) || 0 : 0,
  };
}

async function quotationHistory(uid, limit = MAX_HISTORY_ITEMS) {
  const snapshot = await getFirestore()
    .collection('quotations')
    .doc(uid)
    .collection('requests')
    .orderBy('requestedAt', 'desc')
    .limit(Math.max(1, Math.min(MAX_HISTORY_ITEMS, Number(limit) || MAX_HISTORY_ITEMS)))
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      status: cleanText(data.status || 'unknown', 40),
      requestedAtMs: timestampMs(data.requestedAt || data.sentAt),
      sentAtMs: timestampMs(data.providerAcceptedAt || data.sentAt),
      itemCount: Math.max(0, Number(data.itemCount) || 0),
      currency: cleanText(data.currency, 8),
      totalValue: Number.isFinite(Number(data.totalValue)) ? Number(data.totalValue) : 0,
      totalText: cleanText(data.totalText, 80),
      tenantSlug: cleanText(data.tenantSlug, 80),
      origin: cleanText(data.origin, 500),
    };
  });
}

async function loadProfile(uid) {
  const [authUser, userSnapshot, history] = await Promise.all([
    getAuth().getUser(uid),
    getFirestore().collection('users').doc(uid).get(),
    quotationHistory(uid),
  ]);
  const rootData = userSnapshot.data() || {};
  return {
    profile: normalizeStoredProfile(rootData.profile, authUser),
    auth: authSummary(authUser),
    quotationHistory: history,
    profileUpdatedAtMs: timestampMs(rootData.profileUpdatedAt),
  };
}

exports.getUserProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireUid(request);
  return loadProfile(uid);
});

exports.updateUserProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireUid(request);
  const authUser = await getAuth().getUser(uid);
  const profile = sanitizeIncomingProfile(request.data?.profile, authUser);
  const now = Timestamp.now();
  const userRef = getFirestore().collection('users').doc(uid);
  const existing = await userRef.get();
  const updates = {
    profile,
    primaryEmail: authUser.email || null,
    profileUpdatedAt: now,
  };
  if (!existing.exists || !existing.data()?.profileCreatedAt) updates.profileCreatedAt = now;

  await Promise.all([
    userRef.set(updates, { merge: true }),
    getAuth().updateUser(uid, { displayName: profile.fullName }),
  ]);

  return {
    profile,
    auth: {
      ...authSummary(authUser),
      displayName: profile.fullName,
    },
    profileUpdatedAtMs: now.toMillis(),
  };
});

exports.exportUserProfileData = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireUid(request);
  const loaded = await loadProfile(uid);
  return {
    exportedAt: new Date().toISOString(),
    account: loaded.auth,
    profile: loaded.profile,
    quotationHistory: loaded.quotationHistory,
  };
});

exports.deleteUserAccount = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  const uid = requireUid(request);
  if (String(request.data?.confirmation || '') !== 'DELETE') {
    throw new HttpsError('failed-precondition', 'Type DELETE to confirm account deletion.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const quotationRef = db.collection('quotations').doc(uid);
  const rateLimitRef = db.collection('quotationRequestRateLimits').doc(uid);

  try {
    await Promise.all([
      db.recursiveDelete(userRef),
      db.recursiveDelete(quotationRef),
      rateLimitRef.delete(),
    ]);
    await getAuth().deleteUser(uid);
    return { deleted: true };
  } catch (error) {
    logger.error('Account deletion failed.', {
      event: 'account-delete-failed',
      uid,
      message: String(error?.message || error),
    });
    throw new HttpsError('unavailable', 'The account could not be deleted. Please try again.');
  }
});
