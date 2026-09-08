'use strict';

const { HttpsError, onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { getAuth } = require('firebase-admin/auth');
const { Timestamp, getFirestore } = require('firebase-admin/firestore');

const FUNCTION_REGION = 'europe-west1';
const RUNTIME_SERVICE_ACCOUNT = 'configurator-runtime@configurator-360.iam.gserviceaccount.com';
const PROFILE_VERSION = 1;
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

function authSummary(authUser, displayNameOverride = '') {
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
    displayName: cleanText(displayNameOverride || authUser?.displayName, 120),
    photoURL: cleanText(authUser?.photoURL, 2048),
    providers,
    createdAtMs: authUser?.metadata?.creationTime ? Date.parse(authUser.metadata.creationTime) || 0 : 0,
    lastSignInAtMs: authUser?.metadata?.lastSignInTime ? Date.parse(authUser.metadata.lastSignInTime) || 0 : 0,
  };
}

// Firestore profile data is the source of truth for the 360Configurator profile.
// Updating Firebase Auth's displayName is a useful synchronization step, but it
// must not make the whole profile save fail if the runtime account temporarily
// lacks the Identity Toolkit update permission.
exports.updateUserProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireUid(request);
  const auth = getAuth();
  const authUser = await auth.getUser(uid);
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

  await userRef.set(updates, { merge: true });

  let synchronizedAuthUser = authUser;
  try {
    synchronizedAuthUser = await auth.updateUser(uid, { displayName: profile.fullName });
  } catch (error) {
    logger.warn('Profile saved but Firebase Auth display-name synchronization failed.', {
      event: 'profile-auth-display-name-sync-failed',
      uid,
      code: String(error?.code || ''),
      message: String(error?.message || error),
    });
  }

  return {
    profile,
    auth: authSummary(synchronizedAuthUser, profile.fullName),
    profileUpdatedAtMs: now.toMillis(),
  };
});
