'use strict';

const { onInit } = require('firebase-functions/v2/core');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { createHash, randomBytes } = require('node:crypto');
const { GoogleAuth } = require('google-auth-library');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { AggregateField, FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');

// Firebase CLI loads this module during deployment to discover exported functions.
// Defer Admin/Monitoring initialization until the deployed runtime starts so
// discovery does not initialize Google services on the developer machine.
let db;
let adminAuth;
let monitoringAuth;
let mailerSignerAuth;
let identityToolkitAuth;
let gmailAccessTokenCache = { token: '', expiresAtMs: 0 };
onInit(() => {
  initializeApp();
  db = getFirestore();
  adminAuth = getAuth();
  monitoringAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/monitoring.read'],
  });
  mailerSignerAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  identityToolkitAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
});

const PROJECT_ID = 'configurator-360';
const SHARES_COLLECTION = 'sharedConfigurations';
const SYSTEM_COLLECTION = 'sharedConfigurationSystem';
const APP_CHECK_USAGE_DOCUMENT = 'appCheckUsage';
const FIRESTORE_RECORD_VERSION = 1;
const ALLOWED_PRODUCTS = new Set(['window', 'roof', 'pergola', 'hall', 'solar', 'fence', 'cardbox', 'bookshelf']);

// Tier-1 tenant provisioning.
const TENANTS_COLLECTION = 'tenants';
const TENANT_PUBLIC_COLLECTION = 'tenantPublic';
const TENANT_PROVISIONING_ADMINS_COLLECTION = 'tenantProvisioningAdmins';
const TENANT_USAGE_COLLECTION = 'tenantUsage';
const CONFIGURATOR_ANALYTICS_COLLECTION = 'configuratorAnalytics';
const TENANT_AUDIT_COLLECTION = 'tenantAuditLogs';
const TENANT_AUDIT_SCHEMA_VERSION = 1;
const TENANT_AUDIT_ADMIN_LIMIT = 100;
const TENANT_AUDIT_DASHBOARD_LIMIT = 25;
const TENANT_SCHEMA_VERSION = 1;
const TENANT_PLAN_GO_LIVE_NOW = 'go_live_now';
const TENANT_SUBSCRIPTION_SCHEMA_VERSION = 1;
const TENANT_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'suspended', 'cancelled']);
const TENANT_ACCESSIBLE_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due']);
const TENANT_PLAN_CHANGE_SCHEMA_VERSION = 1;
const TENANT_PLAN_CHANGE_STATUS_PENDING = 'pending';
const TENANT_PLAN_CATALOG = Object.freeze({
  go_live_now_1: Object.freeze({
    id: 'go_live_now_1',
    name: 'Go Live Now — 1 configurator',
    shortName: '1 configurator',
    description: 'A simple launch plan for one standard configurator on your company subdomain.',
    maxConfigurators: 1,
    displayOrder: 10,
    recommended: false,
    features: Object.freeze([
      '1 standard configurator',
      'Company name and logo',
      'Customer dashboard',
      'Saved configurations',
      'Usage analytics',
    ]),
    billingInterval: 'month',
    currency: 'EUR',
    monthlyPriceCents: null,
    annualPriceCents: null,
    stripePriceId: '',
    stripeAnnualPriceId: '',
    solarUsageLimits: Object.freeze({
      analysesPerMonth: 0,
      buildingInsightsPerMonth: 0,
      dataLayersPerMonth: 0,
      pvgisPerMonth: 0,
    }),
  }),
  go_live_now_3: Object.freeze({
    id: 'go_live_now_3',
    name: 'Go Live Now — up to 3 configurators',
    shortName: 'Up to 3 configurators',
    description: 'For companies that want several standard configurators under the same branded customer environment.',
    maxConfigurators: 3,
    displayOrder: 20,
    recommended: true,
    features: Object.freeze([
      'Up to 3 standard configurators',
      'Company name and logo',
      'Customer dashboard',
      'Saved configurations',
      'Usage analytics',
    ]),
    billingInterval: 'month',
    currency: 'EUR',
    monthlyPriceCents: null,
    annualPriceCents: null,
    stripePriceId: '',
    stripeAnnualPriceId: '',
    solarUsageLimits: Object.freeze({
      analysesPerMonth: 0,
      buildingInsightsPerMonth: 0,
      dataLayersPerMonth: 0,
      pvgisPerMonth: 0,
    }),
  }),
  go_live_now_all: Object.freeze({
    id: 'go_live_now_all',
    name: 'Go Live Now — all configurators',
    shortName: 'All configurators',
    description: 'The complete Go Live Now package with access to the full standard configurator catalogue.',
    maxConfigurators: 7,
    displayOrder: 30,
    recommended: false,
    features: Object.freeze([
      'All 7 standard configurators',
      'Company name and logo',
      'Customer dashboard',
      'Saved configurations',
      'Usage analytics',
    ]),
    billingInterval: 'month',
    currency: 'EUR',
    monthlyPriceCents: null,
    annualPriceCents: null,
    stripePriceId: '',
    stripeAnnualPriceId: '',
    solarUsageLimits: Object.freeze({
      analysesPerMonth: 0,
      buildingInsightsPerMonth: 0,
      dataLayersPerMonth: 0,
      pvgisPerMonth: 0,
    }),
  }),
});
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const TENANT_COMPANY_NAME_MAX_LENGTH = 120;
const TENANT_OWNER_EMAIL_MAX_LENGTH = 254;
const TENANT_LOGO_MAX_BYTES = 200_000;
const TENANT_ADMIN_LIST_LIMIT = 500;
const TENANT_STATUSES = new Set(['active', 'suspended']);
const TENANT_USAGE_LIMIT_MAX = 1_000_000_000;
const CONFIGURATOR_ANALYTICS_EVENTS = Object.freeze({
  access: 'accesses',
  login: 'logins',
  configuration_created: 'configurationsCreated',
});
const CONFIGURATOR_ANALYTICS_METRICS = Object.freeze(['accesses', 'logins', 'configurationsCreated']);
const PLATFORM_ANALYTICS_SCOPE_ID = 'platform';
const DEFAULT_SOLAR_USAGE_LIMITS = Object.freeze({
  analysesPerMonth: 0,
  buildingInsightsPerMonth: 0,
  dataLayersPerMonth: 0,
  pvgisPerMonth: 0,
});
const TENANT_ADMIN_ORIGIN = 'https://www.360configurator.com';
const TENANT_ADMIN_DEVELOPMENT_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const RESERVED_TENANT_SLUGS = new Set([
  'www',
  'aks',
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'billing',
  'cdn',
  'demo',
  'dev',
  'ftp',
  'mail',
  'staging',
  'static',
  'status',
  'support',
  'test',
]);
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;       // 200 MiB
const CLEANUP_CHUNK_BYTES = 1 * 1024 * 1024;     // 1 MiB
const MAX_SINGLE_SHARE_BYTES = 850_000;           // headroom below Firestore's document limit
const SHARE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const CLEANUP_QUERY_BATCH = 400;
const FUNCTION_REGION = 'europe-west1';
const RUNTIME_SERVICE_ACCOUNT = 'configurator-runtime@configurator-360.iam.gserviceaccount.com';
const DOMAIN_AUTH_HANDOFFS_COLLECTION = 'domainAuthHandoffs';
const DOMAIN_AUTH_HANDOFF_LIFETIME_MS = 5 * 60 * 1000;
const DOMAIN_AUTH_HANDOFF_CLEANUP_LIMIT = 100;
const DOMAIN_AUTH_HANDOFF_ID_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
const ALLOWED_CONFIGURATOR_ORIGINS = new Set([
  'https://360configurator.com',
  'https://www.360configurator.com',
  'https://360configurator.ro',
  'https://www.360configurator.ro',
  'https://360konfigurator.de',
  'https://www.360konfigurator.de',
  'https://aks.360configurator.com',
]);
const USER_CONFIGURATION_DEVELOPMENT_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

// Marketing-site contact form.
const CONTACT_RATE_LIMIT_COLLECTION = 'contactSubmissionRateLimits';
const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_RATE_LIMIT_MAX_ATTEMPTS = 5;
const CONTACT_RATE_LIMIT_BLOCK_MS = 30 * 60 * 1000;
const CONTACT_RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000;
const CONTACT_ALLOWED_ORIGINS = Object.freeze([
  'https://360configurator.com',
  'https://www.360configurator.com',
  'https://360configurator.ro',
  'https://www.360configurator.ro',
  'https://360konfigurator.de',
  'https://www.360konfigurator.de',
  'https://aks.360configurator.com',
]);
const CONTACT_DEVELOPMENT_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const CONTACT_ALLOWED_LANGUAGES = new Set(['en', 'ro', 'de']);
const CONTACT_DESTINATIONS = Object.freeze({
  ro: 'office@360configurator.ro',
  en: 'office@360configurator.com',
  de: 'office@360configurator.com',
});
const DEMO_REQUESTS_COLLECTION = 'demoRequests';
const DEMO_REQUEST_DESTINATION = 'matei.belciug.work@gmail.com';
const DEMO_REQUEST_SCHEMA_VERSION = 2;
const DEMO_REQUEST_CONFIGURATOR_NAMES = Object.freeze({
  window: 'Window configurator',
  pergola: 'Pergola configurator',
  roof: 'Roof configurator',
  hall: 'Hall configurator',
  solar: 'Solar configurator',
  fence: 'Fence configurator',
  cardbox: 'Cardbox configurator',
  bookshelf: 'Bookshelf configurator',
});
const DEMO_REQUEST_TIMINGS = new Set(['', 'asap', 'week', 'fortnight', 'exploring']);
const DEMO_REQUEST_JOB_TITLES = Object.freeze({
  'owner-founder': 'Owner / founder',
  'ceo-managing-director': 'CEO / Managing Director',
  'sales-business-development': 'Sales / Business Development',
  'design-engineering': 'Design / Engineering',
  'operations-production': 'Operations / Production',
  'procurement-purchasing': 'Procurement / Purchasing',
  'it-software': 'IT / Software',
  marketing: 'Marketing',
  other: 'Other',
  'prefer-not-to-say': 'Prefer not to say',
});
const CONTACT_FROM = '360Configurator Website <office@360configurator.com>';
const CONTACT_FALLBACK_FROM = '360Configurator Website <office@360design.ro>';
const CONTACT_WORKSPACE_USER = 'office@360design.ro';
const CONTACT_MAILER_SERVICE_ACCOUNT = 'configurator-mailer@configurator-360.iam.gserviceaccount.com';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// reCAPTCHA Enterprise / App Check budget policy.
const RECAPTCHA_ASSESSMENT_METRIC = 'recaptchaenterprise.googleapis.com/assessment_count';
const RECAPTCHA_MONTHLY_HARD_CAP = 9_500;
const RECAPTCHA_WARNING_THRESHOLDS = Object.freeze([8_000, 9_000, 9_400]);
const USAGE_STATUS_CACHE_MS = 60 * 1000;
const MONITORING_FAILURE_FALLBACK_MS = 10 * 60 * 1000;

function utf8ByteLength(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function normalizeProductType(value) {
  return String(value ?? '').trim().toLowerCase();
}

function generateShareId() {
  return randomBytes(12).toString('base64url');
}

function validateSharePayload(productType, stateJson) {
  const product = normalizeProductType(productType);
  if (!ALLOWED_PRODUCTS.has(product)) {
    throw new HttpsError('invalid-argument', 'Unsupported configurator type.');
  }
  if (typeof stateJson !== 'string' || stateJson.length === 0) {
    throw new HttpsError('invalid-argument', 'The shared configuration is empty.');
  }

  const sizeBytes = utf8ByteLength(stateJson);
  if (sizeBytes > MAX_SINGLE_SHARE_BYTES) {
    throw new HttpsError(
      'resource-exhausted',
      `This configuration is too large to share (${sizeBytes} bytes).`,
    );
  }

  try {
    const parsed = JSON.parse(stateJson);
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
  } catch {
    throw new HttpsError('invalid-argument', 'The shared configuration is not valid JSON.');
  }

  return { product, sizeBytes };
}

function utcMonthWindow(nowMs = Date.now()) {
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return {
    month,
    startMs: Date.UTC(year, monthIndex, 1, 0, 0, 0, 0),
    nextMonthMs: Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0),
  };
}

function timestampMillis(value) {
  return value?.toMillis ? value.toMillis() : 0;
}

function usageDocumentRef() {
  return db.collection(SYSTEM_COLLECTION).doc(APP_CHECK_USAGE_DOCUMENT);
}

async function currentStoredBytes(collection) {
  const snapshot = await collection.aggregate({
    totalBytes: AggregateField.sum('sizeBytes'),
  }).get();
  return Number(snapshot.data().totalBytes || 0);
}

async function deleteOldestUntilFreed(collection, bytesToFree, protectedShareId) {
  let freedBytes = 0;
  let deletedCount = 0;

  while (freedBytes < bytesToFree) {
    const oldest = await collection
      .orderBy('createdAt', 'asc')
      .limit(CLEANUP_QUERY_BATCH)
      .get();

    if (oldest.empty) break;

    const batch = db.batch();
    let batchDeleteCount = 0;

    for (const doc of oldest.docs) {
      if (doc.id === protectedShareId) continue;

      const data = doc.data();
      const bytes = Number.isFinite(Number(data.sizeBytes))
        ? Math.max(0, Number(data.sizeBytes))
        : utf8ByteLength(data.s);

      batch.delete(doc.ref);
      batchDeleteCount += 1;
      deletedCount += 1;
      freedBytes += bytes;

      if (freedBytes >= bytesToFree) break;
    }

    if (batchDeleteCount === 0) break;
    await batch.commit();
  }

  return { freedBytes, deletedCount };
}

async function readMonthlyRecaptchaAssessments(startMs, endMs) {
  // Use the Monitoring REST API through google-auth-library. This avoids another
  // large runtime dependency while still using the function's service-account
  // credentials and the monitoring.read OAuth scope.
  const authClient = await monitoringAuth.getClient();
  const baseUrl = `https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries`;
  let pageToken = '';
  let total = 0;

  do {
    const params = {
      filter: `metric.type="${RECAPTCHA_ASSESSMENT_METRIC}"`,
      'interval.startTime': new Date(startMs).toISOString(),
      'interval.endTime': new Date(endMs).toISOString(),
      // assessment_count is a DELTA metric with separate series per key/status.
      // Sum into hourly buckets and reduce across every matching series so the
      // threshold covers all reCAPTCHA Enterprise assessments in this project.
      'aggregation.alignmentPeriod': '3600s',
      'aggregation.perSeriesAligner': 'ALIGN_SUM',
      'aggregation.crossSeriesReducer': 'REDUCE_SUM',
      view: 'FULL',
      pageSize: 1000,
    };
    if (pageToken) params.pageToken = pageToken;

    const response = await authClient.request({
      url: baseUrl,
      method: 'GET',
      params,
    });

    const series = response.data?.timeSeries || [];
    for (const timeSeries of series) {
      for (const point of timeSeries.points || []) {
        const raw = point.value?.int64Value ?? point.value?.doubleValue ?? 0;
        const value = Number(raw);
        if (Number.isFinite(value)) total += value;
      }
    }

    pageToken = String(response.data?.nextPageToken || '');
  } while (pageToken);

  return Math.max(0, Math.round(total));
}

function internalWarningLevel(count) {
  if (count >= RECAPTCHA_MONTHLY_HARD_CAP) return 'hard-cap';
  if (count >= 9_400) return 'critical';
  if (count >= 9_000) return 'high';
  if (count >= 8_000) return 'warning';
  return 'normal';
}

function publicProtectionStatus(data, reasonOverride = '') {
  const fallback = Boolean(data.legacyFallbackEnabled)
    && timestampMillis(data.fallbackUntil) > Date.now();
  return {
    mode: fallback ? 'legacy' : 'app-check',
    reason: reasonOverride || String(data.modeReason || (fallback ? 'monthly-safety-fallback' : 'within-monthly-budget')),
    month: String(data.month || utcMonthWindow().month),
    hardCap: RECAPTCHA_MONTHLY_HARD_CAP,
    fallbackUntilMs: fallback ? timestampMillis(data.fallbackUntil) : null,
  };
}

async function refreshRecaptchaUsageStatus({ force = false } = {}) {
  const ref = usageDocumentRef();
  const nowMs = Date.now();
  const window = utcMonthWindow(nowMs);
  const snapshot = await ref.get();
  const previous = snapshot.exists ? snapshot.data() || {} : {};
  const sameMonth = previous.month === window.month;
  const previousCheckedMs = timestampMillis(previous.lastCheckedAt);
  const previousFallbackUntilMs = timestampMillis(previous.fallbackUntil);

  // If the 9,500 hard cap was already confirmed for this month, never call the
  // reCAPTCHA/App Check path again before the next UTC month begins.
  if (
    sameMonth
    && previous.legacyFallbackEnabled === true
    && previous.modeReason === 'monthly-hard-cap'
    && previousFallbackUntilMs > nowMs
  ) {
    return publicProtectionStatus(previous);
  }

  if (
    !force
    && sameMonth
    && Number.isFinite(Number(previous.assessmentCount))
    && previousCheckedMs > nowMs - USAGE_STATUS_CACHE_MS
  ) {
    return publicProtectionStatus(previous);
  }

  if (!sameMonth && previous.month) {
    logger.info('reCAPTCHA App Check monthly protection automatically reopened.', {
      event: 'recaptcha-protection-auto-restored',
      previousMonth: previous.month,
      newMonth: window.month,
      previousAssessmentCount: Number(previous.assessmentCount || 0),
      previousFallbackWasActive: Boolean(previous.legacyFallbackEnabled),
    });
  }

  try {
    const assessmentCount = await readMonthlyRecaptchaAssessments(window.startMs, nowMs);
    const priorWarnings = sameMonth && Array.isArray(previous.warningThresholdsSent)
      ? previous.warningThresholdsSent.map(Number).filter(Number.isFinite)
      : [];
    const warningsSent = new Set(priorWarnings);

    for (const threshold of RECAPTCHA_WARNING_THRESHOLDS) {
      if (assessmentCount >= threshold && !warningsSent.has(threshold)) {
        logger.warn('reCAPTCHA Enterprise monthly assessment usage warning.', {
          event: 'recaptcha-assessment-usage-warning',
          month: window.month,
          assessmentCount,
          warningThreshold: threshold,
          hardCap: RECAPTCHA_MONTHLY_HARD_CAP,
        });
        warningsSent.add(threshold);
      }
    }

    const hardCapReached = assessmentCount >= RECAPTCHA_MONTHLY_HARD_CAP;
    const wasHardCapFallback = sameMonth
      && previous.legacyFallbackEnabled === true
      && previous.modeReason === 'monthly-hard-cap';

    if (hardCapReached && !wasHardCapFallback) {
      logger.warn('reCAPTCHA monthly hard cap reached; Share switched to the reCAPTCHA-free fallback until next month.', {
        event: 'recaptcha-hard-cap-fallback-activated',
        month: window.month,
        assessmentCount,
        hardCap: RECAPTCHA_MONTHLY_HARD_CAP,
        fallbackUntilMs: window.nextMonthMs,
      });
    }

    const nextState = {
      month: window.month,
      assessmentCount,
      hardCap: RECAPTCHA_MONTHLY_HARD_CAP,
      warningLevel: internalWarningLevel(assessmentCount),
      warningThresholdsSent: [...warningsSent].sort((a, b) => a - b),
      legacyFallbackEnabled: hardCapReached,
      fallbackUntil: Timestamp.fromMillis(window.nextMonthMs),
      modeReason: hardCapReached ? 'monthly-hard-cap' : 'within-monthly-budget',
      lastCheckedAt: Timestamp.now(),
      // Never reset this flag here. The first successfully App Check-protected
      // share sets it to true; thereafter direct Firestore creates are allowed
      // only during an explicit fallback window.
      secureModeActive: previous.secureModeActive === true,
    };

    if (!sameMonth) {
      nextState.monthStartedAt = Timestamp.fromMillis(window.startMs);
      nextState.lastModeChangedAt = Timestamp.now();
      nextState.lastAutoRestoredAt = Timestamp.now();
    } else if (Boolean(previous.legacyFallbackEnabled) !== hardCapReached) {
      nextState.lastModeChangedAt = Timestamp.now();
    }
    if (hardCapReached && !wasHardCapFallback) {
      nextState.hardCapActivatedAt = Timestamp.now();
    }

    await ref.set(nextState, { merge: true });
    return publicProtectionStatus(nextState);
  } catch (error) {
    // Availability wins if Monitoring is temporarily unavailable, but safety wins
    // on cost: use the existing reCAPTCHA-free path for ten minutes and retry
    // later rather than creating unmetered assessments while blind to usage.
    const fallbackUntilMs = Math.min(window.nextMonthMs, nowMs + MONITORING_FAILURE_FALLBACK_MS);
    const failureState = {
      month: window.month,
      hardCap: RECAPTCHA_MONTHLY_HARD_CAP,
      warningLevel: 'monitoring-unavailable',
      legacyFallbackEnabled: true,
      fallbackUntil: Timestamp.fromMillis(fallbackUntilMs),
      modeReason: 'monitoring-unavailable',
      lastCheckedAt: Timestamp.now(),
      lastMonitoringErrorAt: Timestamp.now(),
      secureModeActive: previous.secureModeActive === true,
    };
    await ref.set(failureState, { merge: true });

    logger.warn('Could not read reCAPTCHA assessment usage; Share temporarily switched to the reCAPTCHA-free fallback.', {
      event: 'recaptcha-monitoring-unavailable-fallback',
      month: window.month,
      fallbackUntilMs,
      error: String(error?.message || error),
    });

    return publicProtectionStatus(failureState);
  }
}

// ---------------------------------------------------------------------------
// Marketing website contact form
// ---------------------------------------------------------------------------

function isAllowedContactOrigin(origin) {
  const normalized = String(origin || '').trim().replace(/\/$/, '');
  return CONTACT_ALLOWED_ORIGINS.includes(normalized)
    || CONTACT_DEVELOPMENT_ORIGIN.test(normalized);
}

function sanitizeSingleLine(value, maxLength) {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, maxLength);
}

function sanitizeMessage(value, maxLength) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function validEmail(value) {
  if (!value || value.length > 254 || /[\r\n]/.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateContactPayload(data, requestOrigin) {
  const name = sanitizeSingleLine(data?.name, 120);
  const email = sanitizeSingleLine(data?.email, 254).toLowerCase();
  const company = sanitizeSingleLine(data?.company, 160);
  const phone = sanitizeSingleLine(data?.phone, 60);
  const configuratorInterest = sanitizeSingleLine(data?.configuratorInterest, 160);
  const message = sanitizeMessage(data?.message, 5000);
  const language = sanitizeSingleLine(data?.language, 8).toLowerCase();
  const sourcePageValue = sanitizeSingleLine(data?.sourcePage, 2048);
  if (!name || !email || !company || !message || !language || !sourcePageValue) {
    throw new HttpsError('invalid-argument', 'Please complete all required contact fields.');
  }
  if (!validEmail(email)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid email address.');
  }
  if (!CONTACT_ALLOWED_LANGUAGES.has(language)) {
    throw new HttpsError('invalid-argument', 'Unsupported contact form language.');
  }

  let sourcePage;
  try {
    sourcePage = new URL(sourcePageValue);
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid contact form source page.');
  }
  if (!['https:', 'http:'].includes(sourcePage.protocol)) {
    throw new HttpsError('invalid-argument', 'Invalid contact form source page.');
  }
  if (sourcePage.origin !== requestOrigin) {
    throw new HttpsError('permission-denied', 'The contact form source page is not allowed.');
  }

  // The path is enough to identify the source page. Drop query strings and
  // fragments so campaign parameters or accidental personal data never enter
  // the email/logging pipeline through the URL.
  sourcePage.search = '';
  sourcePage.hash = '';

  return {
    name,
    email,
    company,
    phone,
    configuratorInterest,
    message,
    language,
    sourcePage: sourcePage.toString(),
    sourceHost: sourcePage.hostname,
  };
}

function normalizeOptionalWebsite(value) {
  const raw = sanitizeSingleLine(value, 300);
  if (!raw) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return '';
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    return parsed.toString().slice(0, 300);
  } catch {
    return '';
  }
}

function validateDemoRequestPayload(data, requestOrigin) {
  const name = sanitizeSingleLine(data?.name, 120);
  const email = sanitizeSingleLine(data?.email, 254).toLowerCase();
  const company = sanitizeSingleLine(data?.company, 160);
  const phone = sanitizeSingleLine(data?.phone, 60);
  const companyWebsiteRaw = sanitizeSingleLine(data?.companyWebsite, 300);
  const companyWebsite = normalizeOptionalWebsite(companyWebsiteRaw);
  const jobTitleRaw = sanitizeSingleLine(data?.jobTitle, 120);
  const jobTitle = DEMO_REQUEST_JOB_TITLES[jobTitleRaw] || jobTitleRaw;
  const country = sanitizeSingleLine(data?.country, 120);
  const preferredTiming = sanitizeSingleLine(data?.preferredTiming, 32).toLowerCase();
  const message = sanitizeMessage(data?.message, 3000);
  const primaryConfigurator = sanitizeSingleLine(data?.configurator, 32).toLowerCase();
  const requestedSourceConfigurator = sanitizeSingleLine(data?.sourceConfigurator, 32).toLowerCase();
  const language = sanitizeSingleLine(data?.language, 8).toLowerCase();
  const sourcePageValue = sanitizeSingleLine(data?.sourcePage, 2048);
  const sourceConfiguratorPageValue = sanitizeSingleLine(data?.sourceConfiguratorPage, 2048);

  const rawConfigurators = Array.isArray(data?.configurators)
    ? data.configurators
    : (primaryConfigurator ? [primaryConfigurator] : []);
  const configurators = [];
  for (const raw of rawConfigurators.slice(0, 6)) {
    const configurator = sanitizeSingleLine(raw, 32).toLowerCase();
    if (!configurator) continue;
    if (!ALLOWED_PRODUCTS.has(configurator)) {
      throw new HttpsError('invalid-argument', 'Unsupported demo configurator.');
    }
    if (!configurators.includes(configurator)) configurators.push(configurator);
  }
  const sourceConfigurator = requestedSourceConfigurator || primaryConfigurator || configurators[0] || '';
  if (sourceConfigurator && !ALLOWED_PRODUCTS.has(sourceConfigurator)) {
    throw new HttpsError('invalid-argument', 'Unsupported source demo configurator.');
  }
  if (sourceConfigurator && !configurators.includes(sourceConfigurator)) configurators.unshift(sourceConfigurator);

  if (!name || !email || !company || !phone || !configurators.length || !language || !sourcePageValue) {
    throw new HttpsError('invalid-argument', 'Please complete all required demo request fields.');
  }
  if (!validEmail(email)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid work email address.');
  }
  if (companyWebsiteRaw && !companyWebsite) {
    throw new HttpsError('invalid-argument', 'Please enter a valid company website.');
  }
  if (!CONTACT_ALLOWED_LANGUAGES.has(language)) {
    throw new HttpsError('invalid-argument', 'Unsupported demo request language.');
  }
  if (!DEMO_REQUEST_TIMINGS.has(preferredTiming)) {
    throw new HttpsError('invalid-argument', 'Unsupported preferred demo timing.');
  }

  let sourcePage;
  try {
    sourcePage = new URL(sourcePageValue);
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid demo request source page.');
  }
  if (!['https:', 'http:'].includes(sourcePage.protocol) || sourcePage.origin !== requestOrigin) {
    throw new HttpsError('permission-denied', 'The demo request source page is not allowed.');
  }
  sourcePage.search = '';
  sourcePage.hash = '';

  let sourceConfiguratorPage = '';
  if (sourceConfiguratorPageValue) {
    try {
      const parsedSource = new URL(sourceConfiguratorPageValue);
      const sourceOrigin = parsedSource.origin;
      const sourceAllowed = ALLOWED_CONFIGURATOR_ORIGINS.has(sourceOrigin)
        || USER_CONFIGURATION_DEVELOPMENT_ORIGIN.test(sourceOrigin)
        || Boolean(tenantSlugFromConfiguratorOrigin(sourceOrigin));
      if (['https:', 'http:'].includes(parsedSource.protocol) && sourceAllowed) {
        parsedSource.search = '';
        parsedSource.hash = '';
        sourceConfiguratorPage = parsedSource.toString().slice(0, 2048);
      }
    } catch {
      // The source configurator id is authoritative for the demo interest. An
      // invalid optional source URL is omitted rather than blocking a valid lead.
    }
  }

  const configuratorNames = configurators.map((id) => DEMO_REQUEST_CONFIGURATOR_NAMES[id]);
  const effectiveSourceConfigurator = sourceConfigurator || configurators[0];

  return {
    name,
    email,
    company,
    phone,
    companyWebsite,
    jobTitle,
    country,
    preferredTiming,
    message,
    configurator: effectiveSourceConfigurator,
    configuratorName: DEMO_REQUEST_CONFIGURATOR_NAMES[effectiveSourceConfigurator],
    configurators,
    configuratorNames,
    sourceConfigurator: effectiveSourceConfigurator,
    sourceConfiguratorName: DEMO_REQUEST_CONFIGURATOR_NAMES[effectiveSourceConfigurator],
    language,
    sourcePage: sourcePage.toString(),
    sourceHost: sourcePage.hostname,
    sourceConfiguratorPage,
  };
}

function demoRequestEmailText(demo) {
  const timingLabels = {
    asap: 'As soon as possible',
    week: 'This week',
    fortnight: 'Within two weeks',
    exploring: 'Just exploring for now',
  };
  const configuratorLines = demo.configurators
    .map((id, index) => `  ${index + 1}. ${DEMO_REQUEST_CONFIGURATOR_NAMES[id]} (${id})`)
    .join('\n');
  return [
    'New 360Configurator demo request',
    '',
    `Source configurator: ${demo.sourceConfiguratorName} (${demo.sourceConfigurator})`,
    'Configurators of interest:',
    configuratorLines,
    `Name: ${demo.name}`,
    `Work email: ${demo.email}`,
    `Company: ${demo.company}`,
    `Phone: ${demo.phone}`,
    `Company website: ${demo.companyWebsite || 'Not provided'}`,
    `Job title / role: ${demo.jobTitle || 'Not provided'}`,
    `Country / region: ${demo.country || 'Not provided'}`,
    `Preferred timing: ${timingLabels[demo.preferredTiming] || 'No preference'}`,
    `Language: ${demo.language}`,
    `Demo request page: ${demo.sourcePage}`,
    `Configurator source page: ${demo.sourceConfiguratorPage || 'Not provided'}`,
    '',
    'What they would like to see:',
    demo.message || 'Not provided',
  ].join('\n');
}

async function stageDemoRequest(demo) {
  const ref = db.collection(DEMO_REQUESTS_COLLECTION).doc();
  const now = Timestamp.now();
  await ref.create({
    v: DEMO_REQUEST_SCHEMA_VERSION,
    requestId: ref.id,
    status: 'sending',
    emailStatus: 'sending',
    createdAt: now,
    updatedAt: now,
    name: demo.name,
    email: demo.email,
    company: demo.company,
    phone: demo.phone,
    companyWebsite: demo.companyWebsite || null,
    jobTitle: demo.jobTitle || null,
    country: demo.country || null,
    preferredTiming: demo.preferredTiming || null,
    message: demo.message || null,
    configuratorId: demo.configurator,
    configuratorName: demo.configuratorName,
    configuratorIds: demo.configurators,
    configuratorNames: demo.configuratorNames,
    sourceConfiguratorId: demo.sourceConfigurator,
    sourceConfiguratorName: demo.sourceConfiguratorName,
    language: demo.language,
    sourcePage: demo.sourcePage,
    sourceHost: demo.sourceHost,
    sourceConfiguratorPage: demo.sourceConfiguratorPage || null,
    recipient: DEMO_REQUEST_DESTINATION,
  });
  return ref;
}

function contactClientIp(rawRequest) {
  const forwarded = String(rawRequest?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || String(rawRequest?.ip || rawRequest?.socket?.remoteAddress || 'unknown');
}

function contactRateLimitKey(rawRequest) {
  return createHash('sha256')
    .update(`contact-rate-limit:v1:${contactClientIp(rawRequest)}`)
    .digest('hex');
}

async function enforceContactRateLimit(rawRequest) {
  const nowMs = Date.now();
  const ref = db.collection(CONTACT_RATE_LIMIT_COLLECTION).doc(contactRateLimitKey(rawRequest));
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? snapshot.data() || {} : {};
    const windowStartMs = timestampMillis(existing.windowStart);
    const blockedUntilMs = timestampMillis(existing.blockedUntil);
    const existingCount = Math.max(0, Number(existing.count || 0));

    if (blockedUntilMs > nowMs) {
      return { allowed: false, retryAfterMs: blockedUntilMs - nowMs };
    }

    const windowExpired = !windowStartMs || windowStartMs <= nowMs - CONTACT_RATE_LIMIT_WINDOW_MS;
    const windowStart = windowExpired ? Timestamp.fromMillis(nowMs) : existing.windowStart;
    const count = windowExpired ? 1 : existingCount + 1;
    const blocked = count > CONTACT_RATE_LIMIT_MAX_ATTEMPTS;
    const blockedUntil = blocked
      ? Timestamp.fromMillis(nowMs + CONTACT_RATE_LIMIT_BLOCK_MS)
      : null;

    transaction.set(ref, {
      count,
      windowStart,
      lastAttemptAt: Timestamp.fromMillis(nowMs),
      blockedUntil,
      expiresAt: Timestamp.fromMillis(nowMs + CONTACT_RATE_LIMIT_TTL_MS),
    }, { merge: false });

    return {
      allowed: !blocked,
      retryAfterMs: blocked ? CONTACT_RATE_LIMIT_BLOCK_MS : 0,
    };
  });

  if (!result.allowed) {
    throw new HttpsError(
      'resource-exhausted',
      'Too many contact form attempts. Please try again later.',
      { retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000) },
    );
  }
}

function contactEmailText(contact) {
  const labels = {
    en: 'English',
    ro: 'Romanian',
    de: 'German',
  };
  const optionalPhone = contact.phone || 'Not provided';
  const optionalInterest = contact.configuratorInterest || 'Not provided';
  return [
    'New 360Configurator website enquiry',
    '',
    `Name: ${contact.name}`,
    `Email: ${contact.email}`,
    `Company: ${contact.company}`,
    `Phone: ${optionalPhone}`,
    `Configurator interest: ${optionalInterest}`,
    `Language: ${labels[contact.language]} (${contact.language})`,
    `Source page: ${contact.sourcePage}`,
    '',
    'Message:',
    contact.message,
  ].join('\n');
}

function encodeMimeSubject(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), 'utf8').toString('base64')}?=`;
}

function encodeMimeMessage({ from, to, replyTo, subject, text }) {
  const normalizedText = String(text || '').replace(/\r?\n/g, '\r\n');
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizedText,
  ].join('\r\n');

  return Buffer.from(mime, 'utf8').toString('base64url');
}

async function delegatedGmailAccessToken() {
  const nowMs = Date.now();
  if (gmailAccessTokenCache.token && gmailAccessTokenCache.expiresAtMs > nowMs + 5 * 60 * 1000) {
    return gmailAccessTokenCache.token;
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  const jwtPayload = JSON.stringify({
    iss: CONTACT_MAILER_SERVICE_ACCOUNT,
    sub: CONTACT_WORKSPACE_USER,
    scope: GMAIL_SEND_SCOPE,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  });

  const signerClient = await mailerSignerAuth.getClient();
  const signResponse = await signerClient.request({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(CONTACT_MAILER_SERVICE_ACCOUNT)}:signJwt`,
    method: 'POST',
    data: { payload: jwtPayload },
  });
  const signedJwt = String(signResponse.data?.signedJwt || '');
  if (!signedJwt) {
    throw new Error('Google IAM Credentials did not return a signed JWT.');
  }

  const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });
  if (!tokenResponse.ok) {
    logger.error('Could not exchange the delegated Workspace JWT for a Gmail access token.', {
      event: 'contact-gmail-token-error',
      providerStatus: tokenResponse.status,
      impersonatedUserDomain: CONTACT_WORKSPACE_USER.split('@')[1],
    });
    throw new Error('Google Workspace delegated authorization failed.');
  }

  const tokenData = await tokenResponse.json();
  const accessToken = String(tokenData?.access_token || '');
  const expiresInSeconds = Math.max(60, Number(tokenData?.expires_in || 3600));
  if (!accessToken) {
    throw new Error('Google OAuth did not return an access token.');
  }

  gmailAccessTokenCache = {
    token: accessToken,
    expiresAtMs: nowMs + expiresInSeconds * 1000,
  };
  return accessToken;
}

async function gmailSendRaw(accessToken, raw) {
  return fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(CONTACT_WORKSPACE_USER)}/messages/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': '360ConfiguratorContact/1.0',
      },
      body: JSON.stringify({ raw }),
    },
  );
}

async function sendContactEmail(contact) {
  const destination = CONTACT_DESTINATIONS[contact.language];
  const accessToken = await delegatedGmailAccessToken();
  const subject = `[360Configurator] ${contact.company} — ${contact.name}`;
  const text = contactEmailText(contact);

  let sender = CONTACT_FROM;
  let response = await gmailSendRaw(accessToken, encodeMimeMessage({
    from: sender,
    to: destination,
    replyTo: contact.email,
    subject,
    text,
  }));

  // The 360configurator.com domain is a Google Workspace alias domain. If its
  // send-as alias has not yet been enabled for the mailbox, retry once from the
  // primary Workspace address rather than losing the enquiry.
  if (response.status === 400) {
    sender = CONTACT_FALLBACK_FROM;
    response = await gmailSendRaw(accessToken, encodeMimeMessage({
      from: sender,
      to: destination,
      replyTo: contact.email,
      subject,
      text,
    }));
  }

  if (!response.ok) {
    logger.error('Gmail API rejected a contact form email.', {
      event: 'contact-email-provider-error',
      provider: 'gmail-api',
      providerStatus: response.status,
      recipientDomain: destination.split('@')[1],
      senderDomain: sender.match(/@([^>]+)>?$/)?.[1] || '',
      language: contact.language,
      sourceHost: contact.sourceHost,
    });
    throw new HttpsError('unavailable', 'Your message could not be sent. Please try again.');
  }

  let providerMessageId = '';
  try {
    const providerResult = await response.json();
    providerMessageId = sanitizeSingleLine(providerResult?.id, 128);
  } catch {
    // A successful Gmail API response is enough to consider the message accepted.
  }

  return { destination, providerMessageId, sender };
}

async function sendDemoRequestEmail(demo) {
  const accessToken = await delegatedGmailAccessToken();
  const subject = `[360Configurator Demo] ${demo.sourceConfiguratorName}${demo.configurators.length > 1 ? ` + ${demo.configurators.length - 1} more` : ''} — ${demo.company}`;
  const text = demoRequestEmailText(demo);

  let sender = CONTACT_FROM;
  let response = await gmailSendRaw(accessToken, encodeMimeMessage({
    from: sender,
    to: DEMO_REQUEST_DESTINATION,
    replyTo: demo.email,
    subject,
    text,
  }));
  if (response.status === 400) {
    sender = CONTACT_FALLBACK_FROM;
    response = await gmailSendRaw(accessToken, encodeMimeMessage({
      from: sender,
      to: DEMO_REQUEST_DESTINATION,
      replyTo: demo.email,
      subject,
      text,
    }));
  }
  if (!response.ok) {
    logger.error('Gmail API rejected a demo request email.', {
      event: 'demo-request-email-provider-error',
      providerStatus: response.status,
      recipientDomain: DEMO_REQUEST_DESTINATION.split('@')[1],
      configurator: demo.configurator,
      configurators: demo.configurators,
      sourceHost: demo.sourceHost,
    });
    throw new HttpsError('unavailable', 'Your demo request email could not be sent. Please try again.');
  }

  let providerMessageId = '';
  try {
    providerMessageId = sanitizeSingleLine((await response.json())?.id, 128);
  } catch {
    // Successful Gmail response is sufficient.
  }
  return { providerMessageId, sender };
}

async function processDemoRequest(data, origin) {
  const demo = validateDemoRequestPayload(data, origin);
  const ref = await stageDemoRequest(demo);
  try {
    const delivery = await sendDemoRequestEmail(demo);
    const now = Timestamp.now();
    await ref.set({
      status: 'sent',
      emailStatus: 'sent',
      sentAt: now,
      updatedAt: now,
      providerMessageId: delivery.providerMessageId || null,
      sender: delivery.sender,
    }, { merge: true });
    logger.info('Demo request accepted and archived.', {
      event: 'demo-request-sent',
      requestId: ref.id,
      configurator: demo.configurator,
      configurators: demo.configurators,
      sourceHost: demo.sourceHost,
      recipientDomain: DEMO_REQUEST_DESTINATION.split('@')[1],
    });
    return { success: true, delivered: true, requestId: ref.id };
  } catch (error) {
    await ref.set({
      status: 'email_failed',
      emailStatus: 'failed',
      failedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true }).catch(() => {});
    throw error;
  }
}

exports.submitContact = onCall(
  {
    region: FUNCTION_REGION,
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
    cors: [...CONTACT_ALLOWED_ORIGINS, CONTACT_DEVELOPMENT_ORIGIN],
    enforceAppCheck: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    if (request.rawRequest?.method !== 'POST') {
      throw new HttpsError('invalid-argument', 'Contact submissions must use POST.');
    }

    const origin = String(request.rawRequest?.get?.('origin') || '').trim().replace(/\/$/, '');
    if (!origin || !isAllowedContactOrigin(origin)) {
      throw new HttpsError('permission-denied', 'This contact form origin is not allowed.');
    }

    // Count every protected submission attempt, including honeypot hits, so a
    // bot cannot burn App Check assessments indefinitely without reaching the
    // rate limiter simply by filling the hidden field.
    await enforceContactRateLimit(request.rawRequest);

    // Honeypot. A bot that filled the hidden field receives a harmless success
    // response, but no email is sent and no lead document is created.
    if (sanitizeSingleLine(request.data?.website, 200)) {
      logger.info('Contact/demo honeypot submission discarded.', {
        event: 'contact-honeypot-discarded',
        origin,
        appId: String(request.app?.appId || ''),
      });
      return { success: true, delivered: false };
    }

    if (sanitizeSingleLine(request.data?.requestType, 32).toLowerCase() === 'demo') {
      return processDemoRequest(request.data, origin);
    }

    const contact = validateContactPayload(request.data, origin);
    const delivery = await sendContactEmail(contact);
    logger.info('Contact form email accepted by provider.', {
      event: 'contact-email-accepted',
      provider: 'gmail-api',
      providerStatus: 'accepted',
      providerMessageId: delivery.providerMessageId || null,
      senderDomain: delivery.sender.match(/@([^>]+)>?$/)?.[1] || '',
      recipientDomain: delivery.destination.split('@')[1],
      language: contact.language,
      sourceHost: contact.sourceHost,
      configuratorInterestProvided: Boolean(contact.configuratorInterest),
      appId: String(request.app?.appId || ''),
    });
    return { success: true, delivered: true };
  },
);

// Public on purpose. The browser must ask this BEFORE App Check is initialized;
// protecting this endpoint with App Check would consume the assessment that this
// endpoint exists to decide whether we are still allowed to spend.
exports.getShareProtectionStatus = onCall(
  {
    region: FUNCTION_REGION,
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
    enforceAppCheck: false,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async () => refreshRecaptchaUsageStatus(),
);

exports.createSharedConfiguration = onCall(
  {
    region: FUNCTION_REGION,
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
    enforceAppCheck: true,
    maxInstances: 1,
    concurrency: 1,
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (request) => {
    const stateJson = request.data?.stateJson;
    const { product, sizeBytes } = validateSharePayload(request.data?.productType, stateJson);
    const collection = db.collection(SHARES_COLLECTION);

    const currentBytes = await currentStoredBytes(collection);
    const projectedBytes = currentBytes + sizeBytes;

    if (projectedBytes > MAX_TOTAL_BYTES) {
      const overflowBytes = projectedBytes - MAX_TOTAL_BYTES;
      const bytesToFree = Math.max(CLEANUP_CHUNK_BYTES, overflowBytes);
      const cleanup = await deleteOldestUntilFreed(collection, bytesToFree, '');
      const afterCleanupBytes = await currentStoredBytes(collection);

      if (afterCleanupBytes + sizeBytes > MAX_TOTAL_BYTES) {
        throw new HttpsError(
          'resource-exhausted',
          'Shared configuration storage is temporarily full. Please try again.',
        );
      }

      logger.info('Shared configuration FIFO cleanup completed before secure write.', {
        event: 'shared-configuration-prewrite-quota-cleanup',
        requestedBytesToFree: bytesToFree,
        freedBytes: cleanup.freedBytes,
        deletedCount: cleanup.deletedCount,
        totalBytesAfterCleanup: afterCleanupBytes,
        incomingShareBytes: sizeBytes,
        limitBytes: MAX_TOTAL_BYTES,
      });
    }

    // Reaching this point already proves a valid App Check token. Mark the rollout
    // active before writing the share so direct Firestore creation is closed from
    // this moment onward except during a server-authorized fallback window.
    await usageDocumentRef().set({
      secureModeActive: true,
      secureModeActivatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const createdAt = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + SHARE_LIFETIME_MS);
    const documentData = {
      v: FIRESTORE_RECORD_VERSION,
      p: product,
      s: stateJson,
      sizeBytes,
      createdAt,
      expiresAt,
      quotaVersion: 2,
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const shareId = generateShareId();
      try {
        await collection.doc(shareId).create(documentData);

        return {
          id: shareId,
          expiresAtMs: expiresAt.toMillis(),
          sizeBytes,
        };
      } catch (error) {
        if (Number(error?.code) === 6 || String(error?.code) === 'already-exists') continue;
        logger.error('Secure share creation failed.', error);
        throw new HttpsError('internal', 'The shared configuration could not be stored.');
      }
    }

    throw new HttpsError('aborted', 'Could not allocate a unique share id. Please try again.');
  },
);


// ---------------------------------------------------------------------------
// Cross-domain Firebase Authentication handoff helpers
// ---------------------------------------------------------------------------
function normalizeConfiguratorOrigin(value) {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return '';
  }
}

function requestOrigin(request) {
  return normalizeConfiguratorOrigin(request.rawRequest?.headers?.origin || '');
}

function tenantSlugFromConfiguratorOrigin(origin) {
  const normalized = normalizeConfiguratorOrigin(origin);
  if (!normalized) return '';

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:' || parsed.port) return '';

  const suffix = '.360configurator.com';
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith(suffix)) return '';

  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes('.') || !TENANT_SLUG_PATTERN.test(slug) || RESERVED_TENANT_SLUGS.has(slug)) {
    return '';
  }
  return slug;
}

async function requireAllowedConfiguratorOrigin(origin, label = 'origin') {
  const normalized = normalizeConfiguratorOrigin(origin);
  if (ALLOWED_CONFIGURATOR_ORIGINS.has(normalized)) return normalized;

  const tenantSlug = tenantSlugFromConfiguratorOrigin(normalized);
  if (tenantSlug) {
    const snapshot = await db.collection(TENANTS_COLLECTION).doc(tenantSlug).get();
    const tenant = snapshot.data() || {};
    const expectedDomain = `${tenantSlug}.360configurator.com`;
    if (snapshot.exists && tenant.status === 'active' && String(tenant.domain || '') === expectedDomain) {
      return normalized;
    }
  }

  throw new HttpsError('permission-denied', `Unsupported configurator ${label}.`);
}

function domainAuthHandoffsCollection() {
  return db.collection(DOMAIN_AUTH_HANDOFFS_COLLECTION);
}

async function cleanupExpiredDomainAuthHandoffs() {
  const expired = await domainAuthHandoffsCollection()
    .where('expiresAt', '<=', Timestamp.now())
    .limit(DOMAIN_AUTH_HANDOFF_CLEANUP_LIMIT)
    .get();
  if (expired.empty) return;
  const batch = db.batch();
  expired.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

function generateDomainAuthHandoffId() {
  return randomBytes(32).toString('base64url');
}

// ---------------------------------------------------------------------------
// Tier-1 tenant provisioning helpers
// ---------------------------------------------------------------------------
const IDENTITY_TOOLKIT_CONFIG_URL = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;

async function identityToolkitAccessToken() {
  const client = await identityToolkitAuth.getClient();
  const result = await client.getAccessToken();
  const token = typeof result === 'string' ? result : result?.token;
  if (!token) throw new Error('Identity Toolkit access token unavailable.');
  return token;
}

async function identityToolkitConfigRequest({ method = 'GET', updateMask = '', body = null } = {}) {
  const accessToken = await identityToolkitAccessToken();
  const url = new URL(IDENTITY_TOOLKIT_CONFIG_URL);
  if (updateMask) url.searchParams.set('updateMask', updateMask);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const detail = String(payload?.error?.message || `HTTP ${response.status}`);
    const error = new Error(`Identity Toolkit config request failed: ${detail}`);
    error.statusCode = response.status;
    throw error;
  }
  return payload || {};
}

async function ensureFirebaseAuthorizedDomain(domain) {
  const hostname = String(domain || '').trim().toLowerCase();
  const tenantSlug = tenantSlugFromConfiguratorOrigin(`https://${hostname}`);
  if (!tenantSlug || hostname !== `${tenantSlug}.360configurator.com`) {
    throw new Error('Refusing to authorize an invalid tenant authentication domain.');
  }

  const config = await identityToolkitConfigRequest();
  const currentDomains = Array.isArray(config.authorizedDomains)
    ? config.authorizedDomains.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (currentDomains.includes(hostname)) return false;

  const authorizedDomains = [...new Set([...currentDomains, hostname])].sort();
  const updated = await identityToolkitConfigRequest({
    method: 'PATCH',
    updateMask: 'authorizedDomains',
    body: {
      name: `projects/${PROJECT_ID}/config`,
      authorizedDomains,
    },
  });

  const savedDomains = Array.isArray(updated.authorizedDomains)
    ? updated.authorizedDomains.map((value) => String(value || '').trim().toLowerCase())
    : [];
  if (!savedDomains.includes(hostname)) {
    throw new Error('Firebase Authentication did not retain the tenant authorized domain.');
  }
  return true;
}

function tenantProvisioningAdminsCollection() {
  return db.collection(TENANT_PROVISIONING_ADMINS_COLLECTION);
}

function normalizeTenantSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function validateTenantSlug(value) {
  const slug = normalizeTenantSlug(value);
  if (!TENANT_SLUG_PATTERN.test(slug)) {
    throw new HttpsError(
      'invalid-argument',
      'The subdomain must use only lowercase letters, numbers, and hyphens, with a maximum length of 40 characters.',
    );
  }
  if (RESERVED_TENANT_SLUGS.has(slug)) {
    throw new HttpsError('invalid-argument', 'This subdomain is reserved by 360Configurator.');
  }
  return slug;
}

function validateTenantCompanyName(value) {
  const companyName = String(value || '').trim();
  if (!companyName || companyName.length > TENANT_COMPANY_NAME_MAX_LENGTH) {
    throw new HttpsError(
      'invalid-argument',
      `Company name must contain between 1 and ${TENANT_COMPANY_NAME_MAX_LENGTH} characters.`,
    );
  }
  return companyName;
}

function validateTenantOwnerEmail(value, { optional = true } = {}) {
  const email = String(value || '').trim().toLowerCase();
  if (!email && optional) return '';
  if (!email || email.length > TENANT_OWNER_EMAIL_MAX_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid tenant dashboard owner email address.');
  }
  return email;
}

function validateTenantStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!TENANT_STATUSES.has(status)) {
    throw new HttpsError('invalid-argument', 'Tenant status must be active or suspended.');
  }
  return status;
}

function normalizedTenantConfigurators(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    [...ALLOWED_PRODUCTS].map((product) => [product, source[product] === true]),
  );
}

function validateTenantConfigurators(value) {
  const configurators = normalizedTenantConfigurators(value);
  if (!Object.values(configurators).some(Boolean)) {
    throw new HttpsError('invalid-argument', 'Enable at least one configurator.');
  }
  return configurators;
}

function enabledConfiguratorCount(configurators) {
  return Object.values(normalizedTenantConfigurators(configurators)).filter(Boolean).length;
}

function inferredTenantPlanId(configurators) {
  const count = enabledConfiguratorCount(configurators);
  if (count <= 1) return 'go_live_now_1';
  if (count <= 3) return 'go_live_now_3';
  return 'go_live_now_all';
}

function validateTenantPlanId(value, configurators = null) {
  const fallback = configurators ? inferredTenantPlanId(configurators) : '';
  const planId = String(value || fallback).trim().toLowerCase();
  const plan = TENANT_PLAN_CATALOG[planId];
  if (!plan) throw new HttpsError('invalid-argument', 'Unsupported Go Live Now plan.');
  return planId;
}

function tenantPlan(planId) {
  const normalized = validateTenantPlanId(planId);
  return TENANT_PLAN_CATALOG[normalized];
}

function validateConfiguratorsForPlan(configurators, planId) {
  const normalized = validateTenantConfigurators(configurators);
  const plan = tenantPlan(planId);
  const count = enabledConfiguratorCount(normalized);
  if (count > plan.maxConfigurators) {
    throw new HttpsError(
      'failed-precondition',
      `${plan.name} allows at most ${plan.maxConfigurators} configurator${plan.maxConfigurators === 1 ? '' : 's'}.`,
    );
  }
  return normalized;
}

function publicTenantPlanCatalog() {
  return Object.values(TENANT_PLAN_CATALOG)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      shortName: plan.shortName,
      description: plan.description,
      maxConfigurators: plan.maxConfigurators,
      displayOrder: plan.displayOrder,
      recommended: plan.recommended,
      features: [...plan.features],
      billingInterval: plan.billingInterval,
      currency: plan.currency,
      monthlyPriceCents: plan.monthlyPriceCents,
      annualPriceCents: plan.annualPriceCents,
      stripePriceId: plan.stripePriceId,
      stripeAnnualPriceId: plan.stripeAnnualPriceId,
      solarUsageLimits: { ...plan.solarUsageLimits },
    }));
}

function normalizedTenantPendingPlanChange(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (!source || String(source.status || '').trim().toLowerCase() !== TENANT_PLAN_CHANGE_STATUS_PENDING) return null;

  try {
    const planId = validateTenantPlanId(source.planId, source.configurators);
    const configurators = validateConfiguratorsForPlan(source.configurators, planId);
    return {
      schemaVersion: Number(source.schemaVersion) || TENANT_PLAN_CHANGE_SCHEMA_VERSION,
      status: TENANT_PLAN_CHANGE_STATUS_PENDING,
      planId,
      configurators,
      requestedAt: source.requestedAt || null,
      requestedByUid: String(source.requestedByUid || ''),
      requestedByEmail: String(source.requestedByEmail || '').trim().toLowerCase(),
      source: String(source.source || 'tenant_dashboard'),
    };
  } catch {
    return null;
  }
}

function tenantPendingPlanChangeView(value, { includeActor = false } = {}) {
  const pending = normalizedTenantPendingPlanChange(value);
  if (!pending) return null;
  const plan = tenantPlan(pending.planId);
  const result = {
    status: pending.status,
    planId: pending.planId,
    planName: plan.name,
    maxConfigurators: plan.maxConfigurators,
    configurators: pending.configurators,
    requestedAtMs: tenantTimestampMs(pending.requestedAt),
  };
  if (includeActor) {
    result.requestedByEmail = pending.requestedByEmail;
    result.source = pending.source;
  }
  return result;
}

function createTenantPendingPlanChange({ planId, configurators, actor, source = 'tenant_dashboard', now = Timestamp.now() }) {
  return {
    schemaVersion: TENANT_PLAN_CHANGE_SCHEMA_VERSION,
    status: TENANT_PLAN_CHANGE_STATUS_PENDING,
    planId: validateTenantPlanId(planId, configurators),
    configurators: validateConfiguratorsForPlan(configurators, planId),
    requestedAt: now,
    requestedByUid: String(actor?.uid || ''),
    requestedByEmail: String(actor?.email || '').trim().toLowerCase(),
    source: String(source || 'tenant_dashboard'),
  };
}

function validateTenantSubscriptionStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!TENANT_SUBSCRIPTION_STATUSES.has(status)) {
    throw new HttpsError('invalid-argument', 'Unsupported subscription status.');
  }
  return status;
}

function tenantRuntimeStatusForSubscription(subscriptionStatus) {
  return TENANT_ACCESSIBLE_SUBSCRIPTION_STATUSES.has(subscriptionStatus) ? 'active' : 'suspended';
}

function defaultTenantSubscription(now = Timestamp.now()) {
  return {
    schemaVersion: TENANT_SUBSCRIPTION_SCHEMA_VERSION,
    status: 'active',
    cancelAtPeriodEnd: false,
    provider: 'manual',
    customerId: '',
    subscriptionId: '',
    priceId: '',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    lastEventId: '',
    updatedAt: now,
  };
}

function normalizedTenantSubscription(value, legacyTenantStatus = 'active') {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fallbackStatus = legacyTenantStatus === 'suspended' ? 'suspended' : 'active';
  const candidateStatus = String(source.status || fallbackStatus).trim().toLowerCase();
  const status = TENANT_SUBSCRIPTION_STATUSES.has(candidateStatus) ? candidateStatus : fallbackStatus;
  return {
    schemaVersion: Number(source.schemaVersion) || TENANT_SUBSCRIPTION_SCHEMA_VERSION,
    status,
    cancelAtPeriodEnd: source.cancelAtPeriodEnd === true,
    provider: String(source.provider || 'manual'),
    customerId: String(source.customerId || ''),
    subscriptionId: String(source.subscriptionId || ''),
    priceId: String(source.priceId || ''),
    currentPeriodStart: source.currentPeriodStart || null,
    currentPeriodEnd: source.currentPeriodEnd || null,
    lastEventId: String(source.lastEventId || ''),
    updatedAt: source.updatedAt || null,
  };
}

function subscriptionAdminView(subscription, legacyTenantStatus = 'active') {
  const normalized = normalizedTenantSubscription(subscription, legacyTenantStatus);
  return {
    schemaVersion: normalized.schemaVersion,
    status: normalized.status,
    cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
    provider: normalized.provider,
    customerId: normalized.customerId,
    subscriptionId: normalized.subscriptionId,
    priceId: normalized.priceId,
    currentPeriodStartMs: tenantTimestampMs(normalized.currentPeriodStart),
    currentPeriodEndMs: tenantTimestampMs(normalized.currentPeriodEnd),
    updatedAtMs: tenantTimestampMs(normalized.updatedAt),
  };
}

function validateTenantSubscriptionTransition(fromStatus, toStatus) {
  const from = validateTenantSubscriptionStatus(fromStatus);
  const to = validateTenantSubscriptionStatus(toStatus);
  if (from === to) return to;
  const allowed = {
    trialing: new Set(['active', 'past_due', 'suspended', 'cancelled']),
    active: new Set(['trialing', 'past_due', 'suspended', 'cancelled']),
    past_due: new Set(['active', 'suspended', 'cancelled']),
    suspended: new Set(['active', 'cancelled']),
    cancelled: new Set(['active']),
  };
  if (!allowed[from]?.has(to)) {
    throw new HttpsError('failed-precondition', `Subscription cannot move from ${from} to ${to}.`);
  }
  return to;
}

function normalizeTenantUsageLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(TENANT_USAGE_LIMIT_MAX, Math.floor(number));
}

function normalizedSolarUsageLimits(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    analysesPerMonth: normalizeTenantUsageLimit(source.analysesPerMonth),
    buildingInsightsPerMonth: normalizeTenantUsageLimit(source.buildingInsightsPerMonth),
    dataLayersPerMonth: normalizeTenantUsageLimit(source.dataLayersPerMonth),
    pvgisPerMonth: normalizeTenantUsageLimit(source.pvgisPerMonth),
  };
}

function validateSolarUsageLimits(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  for (const key of Object.keys(DEFAULT_SOLAR_USAGE_LIMITS)) {
    const raw = source[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0 || !Number.isInteger(number) || number > TENANT_USAGE_LIMIT_MAX) {
      throw new HttpsError(
        'invalid-argument',
        'Solar usage limits must be whole numbers between 0 and 1,000,000,000.',
      );
    }
  }
  return normalizedSolarUsageLimits(source);
}

function currentTenantUsageMonth() {
  return new Date().toISOString().slice(0, 7);
}

function normalizedSolarUsage(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const counter = (key) => Math.max(0, Math.floor(Number(source[key]) || 0));
  return {
    analyses: counter('analyses'),
    buildingInsights: counter('buildingInsights'),
    dataLayers: counter('dataLayers'),
    pvgis: counter('pvgis'),
    pvgisUpstream: counter('pvgisUpstream'),
  };
}

async function tenantUsageForMonth(slug, month = currentTenantUsageMonth()) {
  const snapshot = await db.collection(TENANT_USAGE_COLLECTION).doc(slug).collection('months').doc(month).get();
  const data = snapshot.data() || {};
  return {
    month,
    solar: normalizedSolarUsage(data.solar),
    updatedAtMs: tenantTimestampMs(data.updatedAt),
  };
}

function currentAnalyticsDay() {
  return new Date().toISOString().slice(0, 10);
}

function analyticsScopeIdForTenant(slug) {
  return `tenant--${normalizeTenantSlug(slug)}`;
}

function emptyConfiguratorAnalytics() {
  return Object.fromEntries(
    [...ALLOWED_PRODUCTS].sort().map((product) => [product, { accesses: 0, logins: 0, configurationsCreated: 0 }]),
  );
}

function normalizedConfiguratorAnalytics(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sourceConfigurators = source.configurators && typeof source.configurators === 'object'
    ? source.configurators
    : {};
  const result = emptyConfiguratorAnalytics();
  for (const product of Object.keys(result)) {
    const metrics = sourceConfigurators[product] && typeof sourceConfigurators[product] === 'object'
      ? sourceConfigurators[product]
      : {};
    for (const metric of CONFIGURATOR_ANALYTICS_METRICS) {
      result[product][metric] = Math.max(0, Math.floor(Number(metrics[metric]) || 0));
    }
  }
  return result;
}

async function configuratorAnalyticsForScope(scopeId, month = currentTenantUsageMonth()) {
  const scopeRef = db.collection(CONFIGURATOR_ANALYTICS_COLLECTION).doc(scopeId);
  const [monthSnapshot, lifetimeSnapshot] = await Promise.all([
    scopeRef.collection('months').doc(month).get(),
    scopeRef.collection('summary').doc('all').get(),
  ]);
  const monthData = monthSnapshot.data() || {};
  const lifetimeData = lifetimeSnapshot.data() || {};
  return {
    month,
    currentMonth: normalizedConfiguratorAnalytics(monthData),
    lifetime: normalizedConfiguratorAnalytics(lifetimeData),
    updatedAtMs: Math.max(tenantTimestampMs(monthData.updatedAt), tenantTimestampMs(lifetimeData.updatedAt)),
  };
}

function validateConfiguratorAnalyticsProduct(value) {
  const product = String(value || '').trim().toLowerCase();
  if (!ALLOWED_PRODUCTS.has(product)) {
    throw new HttpsError('invalid-argument', 'Unsupported configurator analytics product.');
  }
  return product;
}

function validateConfiguratorAnalyticsEvent(value) {
  const event = String(value || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(CONFIGURATOR_ANALYTICS_EVENTS, event)) {
    throw new HttpsError('invalid-argument', 'Unsupported configurator analytics event.');
  }
  return event;
}

async function configuratorAnalyticsScopeForRequest(request, product) {
  const origin = requestOrigin(request);
  if (USER_CONFIGURATION_DEVELOPMENT_ORIGIN.test(origin) || origin === 'https://aks.360configurator.com') {
    return { skip: true, scopeId: '', scopeType: 'development', tenantSlug: '' };
  }
  if (ALLOWED_CONFIGURATOR_ORIGINS.has(origin)) {
    return { skip: false, scopeId: PLATFORM_ANALYTICS_SCOPE_ID, scopeType: 'platform', tenantSlug: '' };
  }

  const tenantSlug = tenantSlugFromConfiguratorOrigin(origin);
  if (!tenantSlug) throw new HttpsError('permission-denied', 'Unsupported configurator analytics origin.');

  const snapshot = await db.collection(TENANTS_COLLECTION).doc(tenantSlug).get();
  const tenant = snapshot.data() || {};
  const expectedDomain = `${tenantSlug}.360configurator.com`;
  const configurators = tenant.configurators && typeof tenant.configurators === 'object' ? tenant.configurators : {};
  if (
    !snapshot.exists
    || tenant.status !== 'active'
    || String(tenant.domain || '') !== expectedDomain
    || configurators[product] !== true
  ) {
    throw new HttpsError('permission-denied', 'This configurator is not enabled for the customer tenant.');
  }
  return {
    skip: false,
    scopeId: analyticsScopeIdForTenant(tenantSlug),
    scopeType: 'tenant',
    tenantSlug,
  };
}

async function incrementConfiguratorAnalytics(scope, product, metric) {
  const now = Timestamp.now();
  const month = currentTenantUsageMonth();
  const day = currentAnalyticsDay();
  const scopeRef = db.collection(CONFIGURATOR_ANALYTICS_COLLECTION).doc(scope.scopeId);
  const payload = {
    schemaVersion: 1,
    scopeType: scope.scopeType,
    ...(scope.tenantSlug ? { tenantSlug: scope.tenantSlug } : {}),
    configurators: {
      [product]: {
        [metric]: FieldValue.increment(1),
      },
    },
    updatedAt: now,
  };
  const batch = db.batch();
  batch.set(scopeRef.collection('summary').doc('all'), payload, { merge: true });
  batch.set(scopeRef.collection('months').doc(month), { ...payload, period: month }, { merge: true });
  batch.set(scopeRef.collection('days').doc(day), { ...payload, period: day }, { merge: true });
  await batch.commit();
}

function detectLogoMime(buffer) {
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) return 'image/png';

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';

  return '';
}

function validateTenantLogoDataUrl(value) {
  const dataUrl = String(value || '').trim();
  if (!dataUrl) return '';

  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    throw new HttpsError('invalid-argument', 'Logo must be a PNG, JPEG, or WebP image.');
  }

  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    throw new HttpsError('invalid-argument', 'The logo image is invalid.');
  }
  if (!buffer.length || buffer.length > TENANT_LOGO_MAX_BYTES) {
    throw new HttpsError(
      'invalid-argument',
      `Logo must be smaller than ${Math.floor(TENANT_LOGO_MAX_BYTES / 1000)} KB after optimization.`,
    );
  }

  const detectedMime = detectLogoMime(buffer);
  if (!detectedMime || detectedMime !== match[1]) {
    throw new HttpsError('invalid-argument', 'The logo image format does not match its declared type.');
  }

  return `data:${detectedMime};base64,${buffer.toString('base64')}`;
}

function requireTenantAdminOrigin(request) {
  const origin = requestOrigin(request);
  if (origin === TENANT_ADMIN_ORIGIN || TENANT_ADMIN_DEVELOPMENT_ORIGIN.test(origin)) return origin;
  throw new HttpsError('permission-denied', 'Tenant provisioning is only available from the internal admin page.');
}

async function requireTenantProvisioningAdmin(request) {
  const uid = requireAuthenticatedUid(request);
  const email = String(request.auth?.token?.email || '').trim().toLowerCase();
  if (!email || request.auth?.token?.email_verified !== true) {
    throw new HttpsError('permission-denied', 'A verified Google account is required.');
  }

  const snapshot = await tenantProvisioningAdminsCollection().doc(uid).get();
  const data = snapshot.data() || {};
  if (!snapshot.exists || data.active !== true) {
    throw new HttpsError('permission-denied', 'This account is not authorized to provision tenants.');
  }

  const restrictedEmail = String(data.email || '').trim().toLowerCase();
  if (restrictedEmail && restrictedEmail !== email) {
    throw new HttpsError('permission-denied', 'This account is not authorized to provision tenants.');
  }

  return { uid, email };
}

function tenantTimestampMs(value) {
  return value && typeof value.toMillis === 'function' ? value.toMillis() : 0;
}

function tenantAuditEventsCollection(slug) {
  return db.collection(TENANT_AUDIT_COLLECTION).doc(slug).collection('events');
}

function tenantAuditEventRef(slug) {
  return tenantAuditEventsCollection(slug).doc();
}

function tenantAuditEnabledProducts(configurators = {}) {
  return [...ALLOWED_PRODUCTS]
    .filter((product) => configurators?.[product] === true)
    .sort();
}

function tenantAuditChangedConfigurators(before = {}, after = {}) {
  const previous = normalizedTenantConfigurators(before);
  const next = normalizedTenantConfigurators(after);
  return {
    enabled: [...ALLOWED_PRODUCTS].filter((product) => previous[product] !== true && next[product] === true).sort(),
    disabled: [...ALLOWED_PRODUCTS].filter((product) => previous[product] === true && next[product] !== true).sort(),
  };
}

function enabledConfiguratorLabelsForAudit(configurators = {}) {
  const normalized = normalizedTenantConfigurators(configurators);
  return [...ALLOWED_PRODUCTS].filter((product) => normalized[product] === true).sort();
}

function tenantAuditActor(actorType, { uid = '', email = '' } = {}) {
  return {
    actorType: String(actorType || 'system'),
    actorUid: String(uid || ''),
    actorEmail: String(email || '').trim().toLowerCase(),
  };
}

function createTenantAuditPayload({ type, summary, actorType = 'system', actor = {}, details = {}, createdAt = Timestamp.now() }) {
  return {
    schemaVersion: TENANT_AUDIT_SCHEMA_VERSION,
    type: String(type || 'tenant_activity'),
    summary: String(summary || 'Tenant activity recorded.').slice(0, 500),
    ...tenantAuditActor(actorType, actor),
    details: details && typeof details === 'object' && !Array.isArray(details) ? details : {},
    createdAt,
  };
}

function tenantAuditEventView(snapshot, { includeDetails = false } = {}) {
  const data = snapshot.data() || {};
  const result = {
    id: snapshot.id,
    type: String(data.type || 'tenant_activity'),
    summary: String(data.summary || 'Tenant activity recorded.'),
    actorType: String(data.actorType || 'system'),
    createdAtMs: tenantTimestampMs(data.createdAt),
  };
  if (includeDetails) {
    result.actorEmail = String(data.actorEmail || '').trim().toLowerCase();
    result.details = data.details && typeof data.details === 'object' && !Array.isArray(data.details) ? data.details : {};
  }
  return result;
}

async function tenantAuditEventsForTenant(slug, { limit = TENANT_AUDIT_DASHBOARD_LIMIT, includeDetails = false } = {}) {
  const cappedLimit = Math.max(1, Math.min(TENANT_AUDIT_ADMIN_LIMIT, Number(limit) || TENANT_AUDIT_DASHBOARD_LIMIT));
  const snapshot = await tenantAuditEventsCollection(slug)
    .orderBy('createdAt', 'desc')
    .limit(cappedLimit)
    .get();
  return snapshot.docs.map((doc) => tenantAuditEventView(doc, { includeDetails }));
}

function tenantAuditSummary(prefix, changedFields = []) {
  const fields = changedFields.filter(Boolean);
  if (!fields.length) return '';
  if (fields.length === 1) return `${prefix} ${fields[0]}.`;
  if (fields.length === 2) return `${prefix} ${fields[0]} and ${fields[1]}.`;
  return `${prefix} ${fields.slice(0, -1).join(', ')}, and ${fields.at(-1)}.`;
}

function tenantAuditSubscriptionLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

function tenantAdminSummaryFromSnapshot(snapshot) {
  const data = snapshot.data() || {};
  const slug = normalizeTenantSlug(data.slug || snapshot.id);
  const configurators = normalizedTenantConfigurators(data.configurators);
  const planId = validateTenantPlanId(data.planId, configurators);
  const plan = tenantPlan(planId);
  const subscription = subscriptionAdminView(data.subscription, data.status);
  return {
    slug,
    domain: String(data.domain || `${slug}.360configurator.com`),
    companyName: String(data.companyName || slug),
    status: String(data.status || tenantRuntimeStatusForSubscription(subscription.status)).trim().toLowerCase(),
    planId,
    planName: plan.name,
    maxConfigurators: plan.maxConfigurators,
    subscription,
    pendingPlanChange: tenantPendingPlanChangeView(data.pendingPlanChange, { includeActor: true }),
    configurators,
    ownerEmail: String(data.ownerEmail || '').trim().toLowerCase(),
    hasLogo: Boolean(String(data.logoUrl || '').trim()),
    firebaseAuthDomainAuthorized: data.firebaseAuthDomainAuthorized === true,
    createdAtMs: tenantTimestampMs(data.createdAt),
    updatedAtMs: tenantTimestampMs(data.updatedAt),
  };
}

function tenantAdminDetailFromSnapshot(snapshot, usage = null, analytics = null, auditEvents = null) {
  const data = snapshot.data() || {};
  return {
    ...tenantAdminSummaryFromSnapshot(snapshot),
    logoUrl: String(data.logoUrl || ''),
    solarUsageLimits: normalizedSolarUsageLimits(data.solarUsageLimits),
    usage: usage || {
      month: currentTenantUsageMonth(),
      solar: normalizedSolarUsage(null),
      updatedAtMs: 0,
    },
    analytics: analytics || {
      month: currentTenantUsageMonth(),
      currentMonth: emptyConfiguratorAnalytics(),
      lifetime: emptyConfiguratorAnalytics(),
      updatedAtMs: 0,
    },
    auditEvents: Array.isArray(auditEvents) ? auditEvents : [],
  };
}

async function requireGoLiveNowTenant(slug) {
  const snapshot = await db.collection(TENANTS_COLLECTION).doc(slug).get();
  const data = snapshot.data() || {};
  if (!snapshot.exists || data.plan !== TENANT_PLAN_GO_LIVE_NOW) {
    throw new HttpsError('not-found', 'Tier-1 tenant not found.');
  }
  return snapshot;
}


async function requireTenantDashboardOwner(request) {
  const uid = requireAuthenticatedUid(request);
  const email = String(request.auth?.token?.email || '').trim().toLowerCase();
  if (!email || request.auth?.token?.email_verified !== true) {
    throw new HttpsError('permission-denied', 'A verified Google account is required.');
  }

  const origin = requestOrigin(request);
  const slug = tenantSlugFromConfiguratorOrigin(origin);
  if (!slug || origin !== `https://${slug}.360configurator.com`) {
    throw new HttpsError('permission-denied', 'Tenant dashboard requests must come from the customer domain.');
  }

  const ref = db.collection(TENANTS_COLLECTION).doc(slug);
  let snapshot = await ref.get();
  let tenant = snapshot.data() || {};
  if (!snapshot.exists || tenant.plan !== TENANT_PLAN_GO_LIVE_NOW) {
    throw new HttpsError('not-found', 'Tier-1 tenant not found.');
  }

  const ownerEmail = String(tenant.ownerEmail || '').trim().toLowerCase();
  const ownerUid = String(tenant.ownerUid || '').trim();
  if (!ownerEmail) {
    throw new HttpsError('permission-denied', 'No dashboard owner is assigned to this tenant yet.');
  }

  if (ownerUid) {
    if (ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'This account is not authorized to manage this tenant.');
    }
  } else {
    if (ownerEmail !== email) {
      throw new HttpsError('permission-denied', 'This account is not authorized to manage this tenant.');
    }

    const now = Timestamp.now();
    const auditRef = tenantAuditEventRef(slug);
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(ref);
      const current = currentSnapshot.data() || {};
      if (!currentSnapshot.exists || current.plan !== TENANT_PLAN_GO_LIVE_NOW) {
        throw new HttpsError('not-found', 'Tier-1 tenant not found.');
      }
      const currentOwnerEmail = String(current.ownerEmail || '').trim().toLowerCase();
      const currentOwnerUid = String(current.ownerUid || '').trim();
      if (currentOwnerEmail !== email || (currentOwnerUid && currentOwnerUid !== uid)) {
        throw new HttpsError('permission-denied', 'This account is not authorized to manage this tenant.');
      }
      if (!currentOwnerUid) {
        transaction.update(ref, { ownerUid: uid, ownerBoundAt: now });
        transaction.create(auditRef, createTenantAuditPayload({
          type: 'dashboard_owner_claimed',
          summary: 'Dashboard ownership linked to a verified account.',
          actorType: 'tenant_owner',
          actor: { uid, email },
          details: { changes: [`Dashboard owner verified: ${email}`] },
          createdAt: now,
        }));
      }
    });
    snapshot = await ref.get();
    tenant = snapshot.data() || {};
  }

  return { uid, email, slug, ref, snapshot, tenant };
}

function tenantDashboardViewFromSnapshot(snapshot, analytics = null, usage = null, auditEvents = null) {
  const data = snapshot.data() || {};
  const slug = normalizeTenantSlug(data.slug || snapshot.id);
  const configurators = normalizedTenantConfigurators(data.configurators);
  const planId = validateTenantPlanId(data.planId, configurators);
  const plan = tenantPlan(planId);
  const subscription = normalizedTenantSubscription(data.subscription, data.status);
  return {
    slug,
    domain: String(data.domain || `${slug}.360configurator.com`),
    companyName: String(data.companyName || slug),
    logoUrl: String(data.logoUrl || ''),
    status: String(data.status || tenantRuntimeStatusForSubscription(subscription.status)),
    planId,
    planName: plan.name,
    maxConfigurators: plan.maxConfigurators,
    subscription: {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEndMs: tenantTimestampMs(subscription.currentPeriodEnd),
    },
    pendingPlanChange: tenantPendingPlanChangeView(data.pendingPlanChange),
    configurators,
    plans: publicTenantPlanCatalog(),
    analytics: analytics || {
      month: currentTenantUsageMonth(),
      currentMonth: emptyConfiguratorAnalytics(),
      lifetime: emptyConfiguratorAnalytics(),
      updatedAtMs: 0,
    },
    usage: usage || {
      month: currentTenantUsageMonth(),
      solar: normalizedSolarUsage(null),
      updatedAtMs: 0,
    },
    auditEvents: Array.isArray(auditEvents) ? auditEvents : [],
  };
}

// ---------------------------------------------------------------------------
// Private per-user saved configurations
// ---------------------------------------------------------------------------
const USER_SAVED_CONFIGURATION_VERSION = 1;
const MAX_SAVED_CONFIGURATION_BYTES = 850_000;
const MAX_SAVED_CONFIGURATION_NAME_LENGTH = 80;
const SAVED_CONFIGURATION_LIST_LIMIT = 100;
const USER_CART_VERSION = 4;
const MAX_USER_CART_ITEMS = 100;
const USER_CART_CURRENCIES = new Set(['USD', 'EUR', 'RON']);
const SHOPPING_CART_ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,180}$/;

function requireAuthenticatedUid(request) {
  const uid = String(request.auth?.uid || '');
  if (!uid) throw new HttpsError('unauthenticated', 'Google login is required.');
  return uid;
}

function validateSavedConfigurationId(value, { optional = false } = {}) {
  const id = String(value || '').trim();
  if (!id && optional) return '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new HttpsError('invalid-argument', 'Invalid saved configuration id.');
  }
  return id;
}

function validateSavedConfigurationPayload(productType, name, stateJson) {
  const product = normalizeProductType(productType);
  if (!ALLOWED_PRODUCTS.has(product)) {
    throw new HttpsError('invalid-argument', 'Unsupported configurator type.');
  }

  const projectName = String(name || '').trim();
  if (!projectName || projectName.length > MAX_SAVED_CONFIGURATION_NAME_LENGTH) {
    throw new HttpsError('invalid-argument', 'The project name is invalid.');
  }

  if (typeof stateJson !== 'string' || !stateJson.length) {
    throw new HttpsError('invalid-argument', 'The saved configuration is empty.');
  }
  const sizeBytes = utf8ByteLength(stateJson);
  if (sizeBytes > MAX_SAVED_CONFIGURATION_BYTES) {
    throw new HttpsError('resource-exhausted', 'This configuration is too large to save.');
  }
  try {
    const parsed = JSON.parse(stateJson);
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
  } catch {
    throw new HttpsError('invalid-argument', 'The saved configuration is not valid JSON.');
  }

  return { product, projectName, sizeBytes };
}

function userSavedItemsCollection(uid, product, tenantSlug = '') {
  const userRef = db.collection('users').doc(uid);
  if (!tenantSlug) {
    // Preserve the existing account-wide library for the public 360Configurator
    // domains. This keeps all pre-Tier-1 saves and .com/.ro/.de domain handoffs
    // compatible with the original storage path.
    return userRef
      .collection('savedConfigurations')
      .doc(product)
      .collection('items');
  }

  // Tier-1 customer saves live in a tenant-specific subtree. The browser never
  // chooses this path: the callable derives the tenant from the request Origin
  // and validates the private tenant record before accessing it.
  return userRef
    .collection('tenantSavedConfigurations')
    .doc(tenantSlug)
    .collection('products')
    .doc(product)
    .collection('items');
}

async function requireSavedConfigurationScope(request, product) {
  const origin = requestOrigin(request);
  if (ALLOWED_CONFIGURATOR_ORIGINS.has(origin) || USER_CONFIGURATION_DEVELOPMENT_ORIGIN.test(origin)) {
    return { origin, tenantSlug: '' };
  }

  const tenantSlug = tenantSlugFromConfiguratorOrigin(origin);
  if (!tenantSlug) {
    throw new HttpsError('permission-denied', 'Unsupported saved-configuration origin.');
  }

  const snapshot = await db.collection(TENANTS_COLLECTION).doc(tenantSlug).get();
  const tenant = snapshot.data() || {};
  const expectedDomain = `${tenantSlug}.360configurator.com`;
  const configurators = tenant.configurators && typeof tenant.configurators === 'object'
    ? tenant.configurators
    : {};

  if (
    !snapshot.exists
    || tenant.status !== 'active'
    || String(tenant.domain || '') !== expectedDomain
    || configurators[product] !== true
  ) {
    throw new HttpsError('permission-denied', 'This configurator is not enabled for the customer tenant.');
  }

  return { origin, tenantSlug };
}

function userShoppingCartItemsCollection(uid, product, tenantSlug = '') {
  const userRef = db.collection('users').doc(uid);
  if (!tenantSlug) {
    // Mirror savedConfigurations: each product owns its own items subcollection.
    // The public .com/.ro/.de domains still share the same account-level cart.
    return userRef
      .collection('shoppingCart')
      .doc(product)
      .collection('items');
  }

  // Customer tenant carts remain isolated from the public-platform cart and
  // from every other tenant while preserving the same product separation.
  return userRef
    .collection('tenantShoppingCart')
    .doc(tenantSlug)
    .collection('products')
    .doc(product)
    .collection('items');
}

// Snapshot rows from the immediately previous release lived directly under
// shoppingCart (or tenantShoppingCart/{tenant}/items). Keep these references
// only so they can be migrated into the product-grouped layout once.
function legacyFlatShoppingCartCollection(uid, tenantSlug = '') {
  const userRef = db.collection('users').doc(uid);
  if (!tenantSlug) return userRef.collection('shoppingCart');
  return userRef.collection('tenantShoppingCart').doc(tenantSlug).collection('items');
}

async function readShoppingCartSnapshots(uid, tenantSlug = '') {
  const snapshots = await Promise.all([...ALLOWED_PRODUCTS].map((product) =>
    userShoppingCartItemsCollection(uid, product, tenantSlug)
      .orderBy('createdAt', 'asc')
      .limit(MAX_USER_CART_ITEMS)
      .get()));
  const docs = snapshots.flatMap((snapshot) => snapshot.docs);
  docs.sort((left, right) => {
    const leftMs = timestampMillis(left.data()?.createdAt) || 0;
    const rightMs = timestampMillis(right.data()?.createdAt) || 0;
    return leftMs - rightMs;
  });
  return { docs: docs.slice(0, MAX_USER_CART_ITEMS) };
}

// Previous releases stored the entire cart as one mutable document. Keep this
// reference only for one-time migration into immutable shoppingCart documents.
function legacyUserCartDocument(uid, tenantSlug = '') {
  const scopeId = tenantSlug ? `tenant_${tenantSlug}` : 'platform';
  return db.collection('users').doc(uid).collection('carts').doc(scopeId);
}

async function requireUserCartScope(request) {
  const origin = requestOrigin(request);
  if (ALLOWED_CONFIGURATOR_ORIGINS.has(origin) || USER_CONFIGURATION_DEVELOPMENT_ORIGIN.test(origin)) {
    return { origin, tenantSlug: '' };
  }

  const tenantSlug = tenantSlugFromConfiguratorOrigin(origin);
  if (!tenantSlug) throw new HttpsError('permission-denied', 'Unsupported cart origin.');

  const snapshot = await db.collection(TENANTS_COLLECTION).doc(tenantSlug).get();
  const tenant = snapshot.data() || {};
  if (
    !snapshot.exists
    || tenant.status !== 'active'
    || String(tenant.domain || '') !== `${tenantSlug}.360configurator.com`
  ) {
    throw new HttpsError('permission-denied', 'This customer tenant is not active.');
  }

  return { origin, tenantSlug };
}

function validateShoppingCartItemId(value) {
  const id = String(value || '').trim();
  if (!SHOPPING_CART_ITEM_ID_PATTERN.test(id)) {
    throw new HttpsError('invalid-argument', 'Invalid shopping cart item id.');
  }
  return id;
}

function normalizeCartCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  if (!USER_CART_CURRENCIES.has(currency)) {
    throw new HttpsError('invalid-argument', 'Unsupported cart currency.');
  }
  return currency;
}

function normalizeCartPrice(value) {
  const costAmount = Number(value);
  if (!Number.isFinite(costAmount) || costAmount < 0 || costAmount > 1_000_000_000_000) {
    throw new HttpsError('invalid-argument', 'Invalid cart price.');
  }
  return costAmount;
}

function cartNameWithNumber(baseName, existingNames = []) {
  const base = String(baseName || '').trim().slice(0, MAX_SAVED_CONFIGURATION_NAME_LENGTH) || 'Configuration';
  const names = new Set(existingNames.map((name) => String(name || '').trim()));
  if (!names.has(base)) return base;
  for (let number = 1; number <= MAX_USER_CART_ITEMS + 1; number += 1) {
    const suffix = ` (${number})`;
    const candidate = `${base.slice(0, Math.max(1, MAX_SAVED_CONFIGURATION_NAME_LENGTH - suffix.length))}${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
  throw new HttpsError('resource-exhausted', 'Could not allocate a shopping cart item name.');
}

function shoppingCartItemSummary(snapshot) {
  const data = snapshot?.data?.() || snapshot || {};
  const id = String(snapshot?.id || data.id || '');
  const productId = normalizeProductType(data.p || data.productId);
  if (!id || !ALLOWED_PRODUCTS.has(productId)) return null;
  const costAmount = Number(data.priceAmount ?? data.costAmount);
  const currency = String(data.currency || '').trim().toUpperCase();
  if (!Number.isFinite(costAmount) || costAmount < 0 || !USER_CART_CURRENCIES.has(currency)) return null;
  return {
    key: id,
    cartItemId: id,
    productId,
    savedConfigurationId: String(data.sourceSavedConfigurationId || ''),
    name: String(data.n || data.name || '').trim().slice(0, MAX_SAVED_CONFIGURATION_NAME_LENGTH),
    sourceName: String(data.sourceName || '').trim().slice(0, MAX_SAVED_CONFIGURATION_NAME_LENGTH),
    costAmount,
    currency,
    addedAt: timestampMillis(data.createdAt) || Number(data.addedAt) || 0,
  };
}

function shoppingCartItemDetail(snapshot) {
  if (!snapshot?.exists) return null;
  const summary = shoppingCartItemSummary(snapshot);
  if (!summary) return null;
  const data = snapshot.data() || {};
  const stateJson = String(data.s || '');
  if (!stateJson) return null;
  return {
    ...summary,
    stateJson,
    sizeBytes: Number(data.sizeBytes || utf8ByteLength(stateJson)),
    updatedAtMs: timestampMillis(data.updatedAt) || timestampMillis(data.createdAt) || 0,
  };
}

function shoppingCartResponse(snapshot, { addedItem = null, updatedItem = null, editingItem = null, updatedAtMs = Date.now() } = {}) {
  const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
  const items = docs.map((doc) => shoppingCartItemSummary(doc)).filter(Boolean);
  return {
    exists: true,
    items,
    addedItem: addedItem ? shoppingCartItemSummary(addedItem) : null,
    updatedItem: updatedItem ? shoppingCartItemSummary(updatedItem) : null,
    editingItem: editingItem || null,
    updatedAtMs,
  };
}

function normalizeLegacyCartItems(items) {
  if (!Array.isArray(items)) return [];
  const deduplicated = new Map();
  items.slice(0, MAX_USER_CART_ITEMS).forEach((raw) => {
    try {
      const productId = normalizeProductType(raw?.productId);
      if (!ALLOWED_PRODUCTS.has(productId)) return;
      const savedConfigurationId = validateSavedConfigurationId(raw?.savedConfigurationId);
      const currency = normalizeCartCurrency(raw?.currency);
      const costAmount = normalizeCartPrice(raw?.costAmount);
      deduplicated.set(`${productId}:${savedConfigurationId}`, {
        productId,
        savedConfigurationId,
        currency,
        costAmount,
        addedAt: Number(raw?.addedAt) || Date.now(),
      });
    } catch {
      // Ignore malformed legacy entries instead of blocking cart migration.
    }
  });
  return [...deduplicated.values()];
}

async function migrateFlatShoppingCartIfNeeded(uid, tenantSlug = '') {
  const legacyCollection = legacyFlatShoppingCartCollection(uid, tenantSlug);
  const legacySnapshot = await legacyCollection.limit(MAX_USER_CART_ITEMS).get();
  if (legacySnapshot.empty) return;

  const batch = db.batch();
  let migrationCount = 0;
  for (const legacyDoc of legacySnapshot.docs) {
    const data = legacyDoc.data() || {};
    const productId = normalizeProductType(data.p || data.productId);
    // Product grouping parent documents have no cart payload and therefore do
    // not appear here as migratable rows. Ignore anything malformed.
    if (!ALLOWED_PRODUCTS.has(productId) || !String(data.s || '')) continue;

    const targetRef = userShoppingCartItemsCollection(uid, productId, tenantSlug).doc(legacyDoc.id);
    // Cart snapshots are immutable, so overwriting an already-copied migration
    // target with the same legacy payload is safe and makes retries idempotent.
    batch.set(targetRef, { ...data, p: productId });
    batch.delete(legacyDoc.ref);
    migrationCount += 1;
  }
  if (migrationCount) await batch.commit();
}

async function migrateLegacyUserCartIfNeeded(uid, tenantSlug = '') {
  const legacyRef = legacyUserCartDocument(uid, tenantSlug);
  const legacySnapshot = await legacyRef.get();
  if (!legacySnapshot.exists) return;

  const legacyItems = normalizeLegacyCartItems(legacySnapshot.data()?.items);

  for (const legacyItem of legacyItems) {
    const cartCollection = userShoppingCartItemsCollection(uid, legacyItem.productId, tenantSlug);
    const currentSnapshot = await cartCollection.limit(MAX_USER_CART_ITEMS).get();
    const existingNames = currentSnapshot.docs
      .map((doc) => String(doc.data()?.n || '').trim())
      .filter(Boolean);
    const existingIds = new Set(currentSnapshot.docs.map((doc) => doc.id));
    const migrationId = `legacy_${legacyItem.productId}_${legacyItem.savedConfigurationId}`;
    if (existingIds.has(migrationId)) continue;

    const savedSnapshot = await userSavedItemsCollection(
      uid,
      legacyItem.productId,
      tenantSlug,
    ).doc(legacyItem.savedConfigurationId).get();
    if (!savedSnapshot.exists) continue;
    const saved = savedSnapshot.data() || {};
    const stateJson = String(saved.s || '');
    if (!stateJson) continue;
    const sourceName = String(saved.n || 'Configuration').trim().slice(0, MAX_SAVED_CONFIGURATION_NAME_LENGTH);
    const name = cartNameWithNumber(sourceName, existingNames);
    const createdAt = Timestamp.fromMillis(
      Number.isFinite(legacyItem.addedAt) && legacyItem.addedAt > 0 ? legacyItem.addedAt : Date.now(),
    );
    await cartCollection.doc(migrationId).set({
      v: USER_CART_VERSION,
      p: legacyItem.productId,
      n: name,
      sourceName,
      sourceSavedConfigurationId: legacyItem.savedConfigurationId,
      s: stateJson,
      sizeBytes: Number(saved.sizeBytes || utf8ByteLength(stateJson)),
      priceAmount: legacyItem.costAmount,
      currency: legacyItem.currency,
      tenantSlug,
      createdAt,
    });
  }

  // Once migration has completed, remove the mutable legacy cart document so an
  // Empty cart action can never resurrect stale rows on a later domain visit.
  await legacyRef.delete();
}

const USER_CONFIGURATION_CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  // Saved configurations authenticate with the Google/Firebase ID token. App
  // Check remains deliberately disabled here so reCAPTCHA assessments stay
  // exclusive to the Share action, as required by the monthly assessment policy.
  enforceAppCheck: false,
  timeoutSeconds: 30,
  memory: '256MiB',
});

const TENANT_ADMIN_CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  // Tenant administration is protected by Firebase Auth + a private UID
  // allowlist. App Check remains disabled so the internal page does not consume
  // the Share-only reCAPTCHA assessment budget.
  enforceAppCheck: false,
  timeoutSeconds: 30,
  memory: '256MiB',
});

const CONFIGURATOR_ANALYTICS_CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  // Product analytics deliberately does not use App Check. It is non-billable
  // telemetry, while reCAPTCHA assessments remain reserved for Share.
  enforceAppCheck: false,
  timeoutSeconds: 15,
  memory: '256MiB',
});


const TENANT_DASHBOARD_CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  // Dashboard access is authenticated and bound to the tenant owner stored in
  // the private tenant document. App Check remains reserved for Share.
  enforceAppCheck: false,
  timeoutSeconds: 30,
  memory: '256MiB',
});

const PUBLIC_PLAN_CATALOG_CALLABLE_OPTIONS = Object.freeze({
  region: FUNCTION_REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  // Plan metadata is intentionally public. No customer or billing-provider
  // state is returned by this endpoint.
  enforceAppCheck: false,
  timeoutSeconds: 15,
  memory: '256MiB',
});

const TENANT_PROVISIONING_CALLABLE_OPTIONS = Object.freeze({
  ...TENANT_ADMIN_CALLABLE_OPTIONS,
  // Identity Platform authorizedDomains is a project-level read/modify/write
  // list. Provision customers serially so two simultaneous admin requests can
  // never overwrite each other's domain registration.
  concurrency: 1,
  maxInstances: 1,
});

exports.recordConfiguratorAnalyticsEvent = onCall(
  CONFIGURATOR_ANALYTICS_CALLABLE_OPTIONS,
  async (request) => {
    const product = validateConfiguratorAnalyticsProduct(request.data?.productType);
    const event = validateConfiguratorAnalyticsEvent(request.data?.eventType);
    if (event === 'login' && !String(request.auth?.uid || '')) {
      throw new HttpsError('unauthenticated', 'A successful Firebase login is required for login analytics.');
    }

    const scope = await configuratorAnalyticsScopeForRequest(request, product);
    if (scope.skip) return { recorded: false, scope: scope.scopeType };

    await incrementConfiguratorAnalytics(scope, product, CONFIGURATOR_ANALYTICS_EVENTS[event]);
    return { recorded: true, scope: scope.scopeType };
  },
);

exports.getTenantDashboard = onCall(
  TENANT_DASHBOARD_CALLABLE_OPTIONS,
  async (request) => {
    const access = await requireTenantDashboardOwner(request);
    const [snapshot, analytics, usage, auditEvents] = await Promise.all([
      access.ref.get(),
      configuratorAnalyticsForScope(analyticsScopeIdForTenant(access.slug)),
      tenantUsageForMonth(access.slug),
      tenantAuditEventsForTenant(access.slug, { limit: TENANT_AUDIT_DASHBOARD_LIMIT, includeDetails: false }),
    ]);
    return tenantDashboardViewFromSnapshot(snapshot, analytics, usage, auditEvents);
  },
);

exports.updateTenantDashboard = onCall(
  TENANT_DASHBOARD_CALLABLE_OPTIONS,
  async (request) => {
    const access = await requireTenantDashboardOwner(request);
    const input = request.data && typeof request.data === 'object' ? request.data : {};
    const now = Timestamp.now();
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(input, key);
    const publicRef = db.collection(TENANT_PUBLIC_COLLECTION).doc(access.slug);

    await db.runTransaction(async (transaction) => {
      const privateSnapshot = await transaction.get(access.ref);
      const publicSnapshot = await transaction.get(publicRef);
      const tenant = privateSnapshot.data() || {};
      if (!privateSnapshot.exists || tenant.plan !== TENANT_PLAN_GO_LIVE_NOW || !publicSnapshot.exists) {
        throw new HttpsError('not-found', 'Tier-1 tenant not found.');
      }
      if (String(tenant.ownerUid || '') !== access.uid) {
        throw new HttpsError('permission-denied', 'This account is not authorized to manage this tenant.');
      }

      const companyName = hasOwn('companyName')
        ? validateTenantCompanyName(input.companyName)
        : validateTenantCompanyName(tenant.companyName);
      const existingConfigurators = validateTenantConfigurators(tenant.configurators);
      const currentPlanId = validateTenantPlanId(tenant.planId, existingConfigurators);
      const requestedPlanId = hasOwn('planId')
        ? validateTenantPlanId(input.planId, existingConfigurators)
        : currentPlanId;
      const requestedConfigurators = hasOwn('configurators')
        ? validateConfiguratorsForPlan(input.configurators, requestedPlanId)
        : validateConfiguratorsForPlan(existingConfigurators, requestedPlanId);
      const isPlanChangeRequest = requestedPlanId !== currentPlanId;
      const configurators = isPlanChangeRequest
        ? existingConfigurators
        : validateConfiguratorsForPlan(requestedConfigurators, currentPlanId);

      const logoMode = hasOwn('logoMode') ? String(input.logoMode || '').trim().toLowerCase() : 'keep';
      if (!['keep', 'replace', 'remove'].includes(logoMode)) {
        throw new HttpsError('invalid-argument', 'Logo update mode is invalid.');
      }
      let logoUrl = String(tenant.logoUrl || '');
      if (logoMode === 'remove') logoUrl = '';
      if (logoMode === 'replace') {
        logoUrl = validateTenantLogoDataUrl(input.logoDataUrl);
        if (!logoUrl) throw new HttpsError('invalid-argument', 'Choose a logo image to replace the current logo.');
      }

      const privateUpdate = {
        companyName,
        configurators,
        logoUrl,
        planId: currentPlanId,
        updatedAt: now,
        lastSelfServiceUpdateByUid: access.uid,
        lastSelfServiceUpdateByEmail: access.email,
      };
      const existingPending = normalizedTenantPendingPlanChange(tenant.pendingPlanChange);
      let pendingPlanChangeChanged = false;
      if (isPlanChangeRequest) {
        const requestedSignature = JSON.stringify({ planId: requestedPlanId, configurators: requestedConfigurators });
        const existingSignature = existingPending
          ? JSON.stringify({ planId: existingPending.planId, configurators: existingPending.configurators })
          : '';
        if (requestedSignature !== existingSignature) {
          privateUpdate.pendingPlanChange = createTenantPendingPlanChange({
            planId: requestedPlanId,
            configurators: requestedConfigurators,
            actor: { uid: access.uid, email: access.email },
            now,
          });
          pendingPlanChangeChanged = true;
        }
      }

      const synchronizedFields = { companyName, configurators, logoUrl, updatedAt: now };
      transaction.update(access.ref, privateUpdate);
      transaction.update(publicRef, synchronizedFields);

      const configuratorChanges = tenantAuditChangedConfigurators(existingConfigurators, configurators);
      const changedFields = [];
      const changes = [];
      if (String(tenant.companyName || '') !== companyName) {
        changedFields.push('company name');
        changes.push(`Company name: ${String(tenant.companyName || '')} → ${companyName}`);
      }
      if (configuratorChanges.enabled.length || configuratorChanges.disabled.length) {
        changedFields.push('configurators');
        if (configuratorChanges.enabled.length) changes.push(`Enabled configurators: ${configuratorChanges.enabled.join(', ')}`);
        if (configuratorChanges.disabled.length) changes.push(`Disabled configurators: ${configuratorChanges.disabled.join(', ')}`);
      }
      const previousHasLogo = Boolean(String(tenant.logoUrl || '').trim());
      const nextHasLogo = Boolean(String(logoUrl || '').trim());
      if (logoMode !== 'keep' && (previousHasLogo !== nextHasLogo || logoMode === 'replace')) {
        changedFields.push('logo');
        changes.push(logoMode === 'remove' ? 'Logo removed' : previousHasLogo ? 'Logo replaced' : 'Logo added');
      }
      const summary = tenantAuditSummary('Customer dashboard updated', changedFields);
      if (summary) {
        transaction.create(tenantAuditEventRef(access.slug), createTenantAuditPayload({
          type: 'tenant_dashboard_updated',
          summary,
          actorType: 'tenant_owner',
          actor: { uid: access.uid, email: access.email },
          details: {
            changes,
            changedFields,
            enabledConfigurators: configuratorChanges.enabled,
            disabledConfigurators: configuratorChanges.disabled,
          },
          createdAt: now,
        }));
      }

      if (pendingPlanChangeChanged) {
        transaction.create(tenantAuditEventRef(access.slug), createTenantAuditPayload({
          type: 'plan_change_requested',
          summary: `Plan change requested from ${tenantPlan(currentPlanId).name} to ${tenantPlan(requestedPlanId).name}.`,
          actorType: 'tenant_owner',
          actor: { uid: access.uid, email: access.email },
          details: {
            changes: [
              `Requested plan: ${currentPlanId} → ${requestedPlanId}`,
              `Requested configurators: ${enabledConfiguratorLabelsForAudit(requestedConfigurators).join(', ')}`,
            ],
            planFrom: currentPlanId,
            planTo: requestedPlanId,
            requestedConfigurators,
            replacedPendingRequest: Boolean(existingPending),
          },
          createdAt: now,
        }));
      }
    });

    const [snapshot, analytics, usage, auditEvents] = await Promise.all([
      access.ref.get(),
      configuratorAnalyticsForScope(analyticsScopeIdForTenant(access.slug)),
      tenantUsageForMonth(access.slug),
      tenantAuditEventsForTenant(access.slug, { limit: TENANT_AUDIT_DASHBOARD_LIMIT, includeDetails: false }),
    ]);
    logger.info('Tier-1 tenant updated through customer dashboard.', {
      slug: access.slug,
      updatedByUid: access.uid,
    });
    return tenantDashboardViewFromSnapshot(snapshot, analytics, usage, auditEvents);
  },
);

exports.cancelTenantPlanChange = onCall(
  TENANT_DASHBOARD_CALLABLE_OPTIONS,
  async (request) => {
    const access = await requireTenantDashboardOwner(request);
    const now = Timestamp.now();

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(access.ref);
      const tenant = snapshot.data() || {};
      if (!snapshot.exists || tenant.plan !== TENANT_PLAN_GO_LIVE_NOW) {
        throw new HttpsError('not-found', 'Tier-1 tenant not found.');
      }
      if (String(tenant.ownerUid || '') !== access.uid) {
        throw new HttpsError('permission-denied', 'This account is not authorized to manage this tenant.');
      }
      const pending = normalizedTenantPendingPlanChange(tenant.pendingPlanChange);
      if (!pending) return;

      transaction.update(access.ref, {
        pendingPlanChange: FieldValue.delete(),
        updatedAt: now,
        lastSelfServiceUpdateByUid: access.uid,
        lastSelfServiceUpdateByEmail: access.email,
      });
      transaction.create(tenantAuditEventRef(access.slug), createTenantAuditPayload({
        type: 'plan_change_cancelled',
        summary: `Pending plan change to ${tenantPlan(pending.planId).name} was cancelled.`,
        actorType: 'tenant_owner',
        actor: { uid: access.uid, email: access.email },
        details: {
          changes: [`Cancelled requested plan: ${pending.planId}`],
          planTo: pending.planId,
        },
        createdAt: now,
      }));
    });

    const [snapshot, analytics, usage, auditEvents] = await Promise.all([
      access.ref.get(),
      configuratorAnalyticsForScope(analyticsScopeIdForTenant(access.slug)),
      tenantUsageForMonth(access.slug),
      tenantAuditEventsForTenant(access.slug, { limit: TENANT_AUDIT_DASHBOARD_LIMIT, includeDetails: false }),
    ]);
    return tenantDashboardViewFromSnapshot(snapshot, analytics, usage, auditEvents);
  },
);

exports.getPlatformAnalytics = onCall(
  TENANT_ADMIN_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    await requireTenantProvisioningAdmin(request);
    return configuratorAnalyticsForScope(PLATFORM_ANALYTICS_SCOPE_ID);
  },
);

exports.getTenantPlans = onCall(
  TENANT_ADMIN_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    await requireTenantProvisioningAdmin(request);
    return { plans: publicTenantPlanCatalog() };
  },
);

exports.getPublicTenantPlans = onCall(
  PUBLIC_PLAN_CATALOG_CALLABLE_OPTIONS,
  async (request) => {
    const origin = requestOrigin(request);
    if (!ALLOWED_CONFIGURATOR_ORIGINS.has(origin) && !USER_CONFIGURATION_DEVELOPMENT_ORIGIN.test(origin)) {
      throw new HttpsError('permission-denied', 'Plan catalogue is not available from this origin.');
    }
    return { plans: publicTenantPlanCatalog() };
  },
);

exports.provisionTenant = onCall(
  TENANT_PROVISIONING_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    const admin = await requireTenantProvisioningAdmin(request);
    const slug = validateTenantSlug(request.data?.slug);
    const companyName = validateTenantCompanyName(request.data?.companyName);
    const ownerEmail = validateTenantOwnerEmail(request.data?.ownerEmail);
    const requestedConfigurators = validateTenantConfigurators(request.data?.configurators);
    const planId = validateTenantPlanId(request.data?.planId, requestedConfigurators);
    const configurators = validateConfiguratorsForPlan(requestedConfigurators, planId);
    const plan = tenantPlan(planId);
    const logoUrl = validateTenantLogoDataUrl(request.data?.logoDataUrl);
    const now = Timestamp.now();
    const subscription = defaultTenantSubscription(now);
    const domain = `${slug}.360configurator.com`;
    const privateRef = db.collection(TENANTS_COLLECTION).doc(slug);
    const publicRef = db.collection(TENANT_PUBLIC_COLLECTION).doc(slug);
    const auditRef = tenantAuditEventRef(slug);

    // Fail before touching Firebase Auth when a Firestore tenant already owns
    // the slug. The transaction below repeats this check before creating data.
    const [privateExisting, publicExisting] = await Promise.all([privateRef.get(), publicRef.get()]);
    if (privateExisting.exists || publicExisting.exists) {
      throw new HttpsError('already-exists', 'This subdomain is already in use.');
    }

    try {
      await ensureFirebaseAuthorizedDomain(domain);
    } catch (error) {
      logger.error('Tier-1 Firebase Authentication domain authorization failed.', {
        slug,
        domain,
        error: String(error?.message || error),
      });
      throw new HttpsError(
        'failed-precondition',
        'The tenant domain could not be enabled for Google login. Provisioning was not completed.',
      );
    }

    await db.runTransaction(async (transaction) => {
      const privateSnapshot = await transaction.get(privateRef);
      const publicSnapshot = await transaction.get(publicRef);
      if (privateSnapshot.exists || publicSnapshot.exists) {
        throw new HttpsError('already-exists', 'This subdomain is already in use.');
      }

      transaction.create(privateRef, {
        schemaVersion: TENANT_SCHEMA_VERSION,
        slug,
        domain,
        companyName,
        plan: TENANT_PLAN_GO_LIVE_NOW,
        planId,
        status: tenantRuntimeStatusForSubscription(subscription.status),
        subscription,
        ownerUid: '',
        ownerEmail,
        configurators,
        solarUsageLimits: { ...plan.solarUsageLimits },
        logoUrl,
        firebaseAuthDomain: domain,
        firebaseAuthDomainAuthorized: true,
        createdByUid: admin.uid,
        createdByEmail: admin.email,
        createdAt: now,
        updatedAt: now,
      });

      transaction.create(publicRef, {
        schemaVersion: TENANT_SCHEMA_VERSION,
        slug,
        companyName,
        status: tenantRuntimeStatusForSubscription(subscription.status),
        logoUrl,
        configurators,
        createdAt: now,
        updatedAt: now,
      });
      transaction.create(auditRef, createTenantAuditPayload({
        type: 'tenant_created',
        summary: 'Tenant created and activated.',
        actorType: 'admin',
        actor: admin,
        details: {
          changes: [
            `Company: ${companyName}`,
            `Plan: ${planId}`,
            `Enabled configurators: ${tenantAuditEnabledProducts(configurators).join(', ')}`,
            ...(ownerEmail ? [`Dashboard owner assigned: ${ownerEmail}`] : []),
          ],
          planId,
          enabledConfigurators: tenantAuditEnabledProducts(configurators),
          ownerEmail,
        },
        createdAt: now,
      }));
    });

    logger.info('Tier-1 tenant provisioned.', {
      slug,
      companyName,
      planId,
      subscriptionStatus: subscription.status,
      configurators: Object.entries(configurators).filter(([, enabled]) => enabled).map(([id]) => id),
      createdByUid: admin.uid,
    });

    return {
      slug,
      companyName,
      domain,
      ownerEmail,
      url: `https://${domain}/`,
      planId,
      planName: plan.name,
      subscription: subscriptionAdminView(subscription, 'active'),
      configurators,
      createdAtMs: now.toMillis(),
    };
  },
);

exports.listTenants = onCall(
  TENANT_ADMIN_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    await requireTenantProvisioningAdmin(request);

    const snapshot = await db.collection(TENANTS_COLLECTION).limit(TENANT_ADMIN_LIST_LIMIT).get();
    const tenants = snapshot.docs
      .filter((doc) => (doc.data() || {}).plan === TENANT_PLAN_GO_LIVE_NOW)
      .map(tenantAdminSummaryFromSnapshot)
      .sort((a, b) => {
        const byCompany = a.companyName.localeCompare(b.companyName, 'en', { sensitivity: 'base' });
        return byCompany || a.slug.localeCompare(b.slug);
      });

    return { tenants, truncated: snapshot.size >= TENANT_ADMIN_LIST_LIMIT };
  },
);

exports.getTenant = onCall(
  TENANT_ADMIN_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    await requireTenantProvisioningAdmin(request);
    const slug = validateTenantSlug(request.data?.slug);
    const snapshot = await requireGoLiveNowTenant(slug);
    const [usage, analytics, auditEvents] = await Promise.all([
      tenantUsageForMonth(slug),
      configuratorAnalyticsForScope(analyticsScopeIdForTenant(slug)),
      tenantAuditEventsForTenant(slug, { limit: TENANT_AUDIT_ADMIN_LIMIT, includeDetails: true }),
    ]);
    return tenantAdminDetailFromSnapshot(snapshot, usage, analytics, auditEvents);
  },
);

exports.updateTenant = onCall(
  TENANT_ADMIN_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    const admin = await requireTenantProvisioningAdmin(request);
    const input = request.data && typeof request.data === 'object' ? request.data : {};
    const slug = validateTenantSlug(input.slug);
    const privateRef = db.collection(TENANTS_COLLECTION).doc(slug);
    const publicRef = db.collection(TENANT_PUBLIC_COLLECTION).doc(slug);
    const expectedDomain = `${slug}.360configurator.com`;
    const now = Timestamp.now();
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(input, key);
    const auditRef = tenantAuditEventRef(slug);

    const result = await db.runTransaction(async (transaction) => {
      const privateSnapshot = await transaction.get(privateRef);
      const publicSnapshot = await transaction.get(publicRef);
      const tenant = privateSnapshot.data() || {};

      if (!privateSnapshot.exists || tenant.plan !== TENANT_PLAN_GO_LIVE_NOW) {
        throw new HttpsError('not-found', 'Tier-1 tenant not found.');
      }
      if (!publicSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'The public tenant document is missing.');
      }

      const storedDomain = String(tenant.domain || '').trim().toLowerCase();
      if (storedDomain && storedDomain !== expectedDomain) {
        throw new HttpsError('failed-precondition', 'The tenant domain does not match its immutable subdomain.');
      }

      const companyName = hasOwn('companyName')
        ? validateTenantCompanyName(input.companyName)
        : validateTenantCompanyName(tenant.companyName);
      const previousOwnerEmail = validateTenantOwnerEmail(tenant.ownerEmail);
      const ownerEmail = hasOwn('ownerEmail')
        ? validateTenantOwnerEmail(input.ownerEmail)
        : previousOwnerEmail;
      const ownerUid = ownerEmail === previousOwnerEmail ? String(tenant.ownerUid || '') : '';
      const existingConfigurators = validateTenantConfigurators(tenant.configurators);
      const planId = hasOwn('planId')
        ? validateTenantPlanId(input.planId, existingConfigurators)
        : validateTenantPlanId(tenant.planId, existingConfigurators);
      const configurators = hasOwn('configurators')
        ? validateConfiguratorsForPlan(input.configurators, planId)
        : validateConfiguratorsForPlan(existingConfigurators, planId);
      const solarUsageLimits = hasOwn('solarUsageLimits')
        ? validateSolarUsageLimits(input.solarUsageLimits)
        : normalizedSolarUsageLimits(tenant.solarUsageLimits);
      let subscription = normalizedTenantSubscription(tenant.subscription, tenant.status);
      if (hasOwn('status')) {
        const legacyStatus = validateTenantStatus(input.status);
        subscription = {
          ...subscription,
          status: legacyStatus === 'active' ? 'active' : 'suspended',
          cancelAtPeriodEnd: legacyStatus === 'active' ? subscription.cancelAtPeriodEnd : false,
          updatedAt: now,
        };
      }
      const status = tenantRuntimeStatusForSubscription(subscription.status);

      const logoMode = hasOwn('logoMode') ? String(input.logoMode || '').trim().toLowerCase() : 'keep';
      if (!['keep', 'replace', 'remove'].includes(logoMode)) {
        throw new HttpsError('invalid-argument', 'Logo update mode is invalid.');
      }

      let logoUrl = String(tenant.logoUrl || '');
      if (logoMode === 'remove') logoUrl = '';
      if (logoMode === 'replace') {
        logoUrl = validateTenantLogoDataUrl(input.logoDataUrl);
        if (!logoUrl) throw new HttpsError('invalid-argument', 'Choose a logo image to replace the current logo.');
      }

      const synchronizedFields = {
        companyName,
        status,
        configurators,
        logoUrl,
        updatedAt: now,
      };
      const previousPlanId = validateTenantPlanId(tenant.planId, existingConfigurators);
      const configuratorChanges = tenantAuditChangedConfigurators(existingConfigurators, configurators);
      const existingPendingPlanChange = normalizedTenantPendingPlanChange(tenant.pendingPlanChange);
      const clearPendingPlanChange = Boolean(existingPendingPlanChange)
        && (previousPlanId !== planId || configuratorChanges.enabled.length || configuratorChanges.disabled.length);
      const privateUpdate = {
        ...synchronizedFields,
        planId,
        subscription,
        solarUsageLimits,
        domain: expectedDomain,
        ownerEmail,
        ownerUid,
        lastUpdatedByUid: admin.uid,
        lastUpdatedByEmail: admin.email,
      };
      if (clearPendingPlanChange) privateUpdate.pendingPlanChange = FieldValue.delete();

      transaction.update(privateRef, privateUpdate);
      transaction.update(publicRef, synchronizedFields);

      const previousLimits = normalizedSolarUsageLimits(tenant.solarUsageLimits);
      const changedFields = [];
      const changes = [];
      if (String(tenant.companyName || '') !== companyName) {
        changedFields.push('company name');
        changes.push(`Company name: ${String(tenant.companyName || '')} → ${companyName}`);
      }
      if (previousPlanId !== planId) {
        changedFields.push('plan');
        changes.push(`Plan: ${previousPlanId} → ${planId}`);
      }
      if (clearPendingPlanChange) {
        changedFields.push('pending plan change');
        changes.push(`Pending plan request to ${existingPendingPlanChange.planId} cleared by direct admin plan/configurator update`);
      }
      if (configuratorChanges.enabled.length || configuratorChanges.disabled.length) {
        changedFields.push('configurators');
        if (configuratorChanges.enabled.length) changes.push(`Enabled configurators: ${configuratorChanges.enabled.join(', ')}`);
        if (configuratorChanges.disabled.length) changes.push(`Disabled configurators: ${configuratorChanges.disabled.join(', ')}`);
      }
      const previousHasLogo = Boolean(String(tenant.logoUrl || '').trim());
      const nextHasLogo = Boolean(String(logoUrl || '').trim());
      if (logoMode !== 'keep' && (previousHasLogo !== nextHasLogo || logoMode === 'replace')) {
        changedFields.push('logo');
        changes.push(logoMode === 'remove' ? 'Logo removed' : previousHasLogo ? 'Logo replaced' : 'Logo added');
      }
      if (previousOwnerEmail !== ownerEmail) {
        changedFields.push('dashboard owner');
        changes.push(`Dashboard owner: ${previousOwnerEmail || 'unassigned'} → ${ownerEmail || 'unassigned'}`);
      }
      if (JSON.stringify(previousLimits) !== JSON.stringify(solarUsageLimits)) {
        changedFields.push('Solar usage limits');
        changes.push(`Solar usage limits: ${JSON.stringify(previousLimits)} → ${JSON.stringify(solarUsageLimits)}`);
      }
      const previousSubscription = normalizedTenantSubscription(tenant.subscription, tenant.status);
      if (previousSubscription.status !== subscription.status) {
        changedFields.push('tenant status');
        changes.push(`Subscription status: ${tenantAuditSubscriptionLabel(previousSubscription.status)} → ${tenantAuditSubscriptionLabel(subscription.status)}`);
      }
      const summary = tenantAuditSummary('360Configurator admin updated', changedFields);
      if (summary) {
        transaction.create(auditRef, createTenantAuditPayload({
          type: 'tenant_admin_updated',
          summary,
          actorType: 'admin',
          actor: admin,
          details: {
            changes,
            changedFields,
            planFrom: previousPlanId,
            planTo: planId,
            enabledConfigurators: configuratorChanges.enabled,
            disabledConfigurators: configuratorChanges.disabled,
          },
          createdAt: now,
        }));
      }

      return {
        slug,
        domain: expectedDomain,
        companyName,
        status,
        planId,
        planName: tenantPlan(planId).name,
        maxConfigurators: tenantPlan(planId).maxConfigurators,
        subscription: subscriptionAdminView(subscription, status),
        pendingPlanChange: clearPendingPlanChange
          ? null
          : tenantPendingPlanChangeView(tenant.pendingPlanChange, { includeActor: true }),
        configurators,
        logoUrl,
        solarUsageLimits,
        ownerEmail,
        firebaseAuthDomainAuthorized: tenant.firebaseAuthDomainAuthorized === true,
        createdAtMs: tenantTimestampMs(tenant.createdAt),
        updatedAtMs: now.toMillis(),
      };
    });

    [result.usage, result.analytics, result.auditEvents] = await Promise.all([
      tenantUsageForMonth(slug),
      configuratorAnalyticsForScope(analyticsScopeIdForTenant(slug)),
      tenantAuditEventsForTenant(slug, { limit: TENANT_AUDIT_ADMIN_LIMIT, includeDetails: true }),
    ]);

    logger.info('Tier-1 tenant updated.', {
      slug,
      status: result.status,
      configurators: Object.entries(result.configurators).filter(([, enabled]) => enabled).map(([id]) => id),
      updatedByUid: admin.uid,
    });

    return result;
  },
);

exports.resolveTenantPlanChange = onCall(
  TENANT_ADMIN_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    const admin = await requireTenantProvisioningAdmin(request);
    const input = request.data && typeof request.data === 'object' ? request.data : {};
    const slug = validateTenantSlug(input.slug);
    const decision = String(input.decision || '').trim().toLowerCase();
    if (!['approve', 'reject'].includes(decision)) {
      throw new HttpsError('invalid-argument', 'Plan change decision must be approve or reject.');
    }

    const privateRef = db.collection(TENANTS_COLLECTION).doc(slug);
    const publicRef = db.collection(TENANT_PUBLIC_COLLECTION).doc(slug);
    const now = Timestamp.now();

    await db.runTransaction(async (transaction) => {
      const privateSnapshot = await transaction.get(privateRef);
      const publicSnapshot = await transaction.get(publicRef);
      const tenant = privateSnapshot.data() || {};
      if (!privateSnapshot.exists || tenant.plan !== TENANT_PLAN_GO_LIVE_NOW || !publicSnapshot.exists) {
        throw new HttpsError('not-found', 'Tier-1 tenant not found.');
      }

      const pending = normalizedTenantPendingPlanChange(tenant.pendingPlanChange);
      if (!pending) throw new HttpsError('failed-precondition', 'This tenant has no pending plan change.');
      const currentConfigurators = validateTenantConfigurators(tenant.configurators);
      const currentPlanId = validateTenantPlanId(tenant.planId, currentConfigurators);
      const auditRef = tenantAuditEventRef(slug);

      if (decision === 'approve') {
        const targetPlanId = validateTenantPlanId(pending.planId, pending.configurators);
        const targetConfigurators = validateConfiguratorsForPlan(pending.configurators, targetPlanId);
        transaction.update(privateRef, {
          planId: targetPlanId,
          configurators: targetConfigurators,
          pendingPlanChange: FieldValue.delete(),
          updatedAt: now,
          lastUpdatedByUid: admin.uid,
          lastUpdatedByEmail: admin.email,
        });
        transaction.update(publicRef, {
          configurators: targetConfigurators,
          updatedAt: now,
        });
        transaction.create(auditRef, createTenantAuditPayload({
          type: 'plan_change_approved',
          summary: `Plan change to ${tenantPlan(targetPlanId).name} was approved.`,
          actorType: 'admin',
          actor: admin,
          details: {
            changes: [
              `Plan: ${currentPlanId} → ${targetPlanId}`,
              `Enabled configurators: ${enabledConfiguratorLabelsForAudit(targetConfigurators).join(', ')}`,
            ],
            planFrom: currentPlanId,
            planTo: targetPlanId,
            requestedByEmail: pending.requestedByEmail,
          },
          createdAt: now,
        }));
      } else {
        transaction.update(privateRef, {
          pendingPlanChange: FieldValue.delete(),
          updatedAt: now,
          lastUpdatedByUid: admin.uid,
          lastUpdatedByEmail: admin.email,
        });
        transaction.create(auditRef, createTenantAuditPayload({
          type: 'plan_change_rejected',
          summary: `Plan change to ${tenantPlan(pending.planId).name} was rejected.`,
          actorType: 'admin',
          actor: admin,
          details: {
            changes: [`Rejected requested plan: ${pending.planId}`],
            planFrom: currentPlanId,
            planTo: pending.planId,
            requestedByEmail: pending.requestedByEmail,
          },
          createdAt: now,
        }));
      }
    });

    const snapshot = await requireGoLiveNowTenant(slug);
    const [usage, analytics, auditEvents] = await Promise.all([
      tenantUsageForMonth(slug),
      configuratorAnalyticsForScope(analyticsScopeIdForTenant(slug)),
      tenantAuditEventsForTenant(slug, { limit: TENANT_AUDIT_ADMIN_LIMIT, includeDetails: true }),
    ]);
    return tenantAdminDetailFromSnapshot(snapshot, usage, analytics, auditEvents);
  },
);

exports.setTenantSubscriptionState = onCall(
  TENANT_ADMIN_CALLABLE_OPTIONS,
  async (request) => {
    requireTenantAdminOrigin(request);
    const admin = await requireTenantProvisioningAdmin(request);
    const input = request.data && typeof request.data === 'object' ? request.data : {};
    const slug = validateTenantSlug(input.slug);
    const requestedStatus = validateTenantSubscriptionStatus(input.status);
    const requestedCancelAtPeriodEnd = input.cancelAtPeriodEnd === true;
    const privateRef = db.collection(TENANTS_COLLECTION).doc(slug);
    const publicRef = db.collection(TENANT_PUBLIC_COLLECTION).doc(slug);
    const now = Timestamp.now();
    const auditRef = tenantAuditEventRef(slug);

    const result = await db.runTransaction(async (transaction) => {
      const privateSnapshot = await transaction.get(privateRef);
      const publicSnapshot = await transaction.get(publicRef);
      const tenant = privateSnapshot.data() || {};
      if (!privateSnapshot.exists || tenant.plan !== TENANT_PLAN_GO_LIVE_NOW) {
        throw new HttpsError('not-found', 'Tier-1 tenant not found.');
      }
      if (!publicSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'The public tenant document is missing.');
      }

      const currentSubscription = normalizedTenantSubscription(tenant.subscription, tenant.status);
      const status = validateTenantSubscriptionTransition(currentSubscription.status, requestedStatus);
      const cancelAtPeriodEnd = ['suspended', 'cancelled'].includes(status)
        ? false
        : requestedCancelAtPeriodEnd;
      const subscription = {
        ...currentSubscription,
        schemaVersion: TENANT_SUBSCRIPTION_SCHEMA_VERSION,
        status,
        cancelAtPeriodEnd,
        updatedAt: now,
      };
      const runtimeStatus = tenantRuntimeStatusForSubscription(status);

      transaction.update(privateRef, {
        status: runtimeStatus,
        subscription,
        lastUpdatedByUid: admin.uid,
        lastUpdatedByEmail: admin.email,
        updatedAt: now,
      });
      transaction.update(publicRef, {
        status: runtimeStatus,
        updatedAt: now,
      });

      if (
        currentSubscription.status !== subscription.status
        || currentSubscription.cancelAtPeriodEnd !== subscription.cancelAtPeriodEnd
      ) {
        const changes = [];
        if (currentSubscription.status !== subscription.status) {
          changes.push(`Status: ${tenantAuditSubscriptionLabel(currentSubscription.status)} → ${tenantAuditSubscriptionLabel(subscription.status)}`);
        }
        if (currentSubscription.cancelAtPeriodEnd !== subscription.cancelAtPeriodEnd) {
          changes.push(`Cancel at period end: ${currentSubscription.cancelAtPeriodEnd ? 'on' : 'off'} → ${subscription.cancelAtPeriodEnd ? 'on' : 'off'}`);
        }
        transaction.create(auditRef, createTenantAuditPayload({
          type: 'subscription_state_changed',
          summary: currentSubscription.status !== subscription.status
            ? `Subscription changed from ${tenantAuditSubscriptionLabel(currentSubscription.status)} to ${tenantAuditSubscriptionLabel(subscription.status)}.`
            : 'Subscription cancellation schedule updated.',
          actorType: 'admin',
          actor: admin,
          details: {
            changes,
            statusFrom: currentSubscription.status,
            statusTo: subscription.status,
            cancelAtPeriodEndFrom: currentSubscription.cancelAtPeriodEnd,
            cancelAtPeriodEndTo: subscription.cancelAtPeriodEnd,
          },
          createdAt: now,
        }));
      }

      return {
        slug,
        status: runtimeStatus,
        subscription: subscriptionAdminView(subscription, runtimeStatus),
        updatedAtMs: now.toMillis(),
      };
    });

    logger.info('Tier-1 subscription state changed.', {
      slug,
      subscriptionStatus: result.subscription.status,
      cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd,
      runtimeStatus: result.status,
      updatedByUid: admin.uid,
    });

    return result;
  },
);

exports.createDomainAuthHandoff = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const uid = requireAuthenticatedUid(request);
    const sourceOrigin = await requireAllowedConfiguratorOrigin(requestOrigin(request), 'source origin');
    const targetOrigin = await requireAllowedConfiguratorOrigin(request.data?.targetOrigin, 'target origin');
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + DOMAIN_AUTH_HANDOFF_LIFETIME_MS);

    await cleanupExpiredDomainAuthHandoffs();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const handoffId = generateDomainAuthHandoffId();
      try {
        await domainAuthHandoffsCollection().doc(handoffId).create({
          uid,
          sourceOrigin,
          targetOrigin,
          createdAt: now,
          expiresAt,
        });
        return { handoffId, expiresAtMs: expiresAt.toMillis() };
      } catch (error) {
        if (Number(error?.code) === 6 || String(error?.code) === 'already-exists') continue;
        logger.error('Domain authentication handoff creation failed.', error);
        throw new HttpsError('internal', 'The domain authentication handoff could not be created.');
      }
    }
    throw new HttpsError('aborted', 'Could not allocate a domain authentication handoff.');
  },
);

exports.redeemDomainAuthHandoff = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const origin = await requireAllowedConfiguratorOrigin(requestOrigin(request), 'destination origin');
    const handoffId = String(request.data?.handoffId || '').trim();
    if (!DOMAIN_AUTH_HANDOFF_ID_PATTERN.test(handoffId)) {
      throw new HttpsError('invalid-argument', 'Invalid domain authentication handoff.');
    }

    const ref = domainAuthHandoffsCollection().doc(handoffId);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { missing: true };
      const data = snapshot.data() || {};
      const expiresAtMs = timestampMillis(data.expiresAt);
      if (!expiresAtMs || expiresAtMs <= Date.now()) {
        transaction.delete(ref);
        return { expired: true };
      }
      if (String(data.targetOrigin || '') !== origin) return { wrongOrigin: true };
      const uid = String(data.uid || '');
      if (!uid) {
        transaction.delete(ref);
        return { invalid: true };
      }
      transaction.delete(ref);
      return { uid };
    });

    if (result.missing) throw new HttpsError('not-found', 'Domain authentication handoff not found.');
    if (result.expired) throw new HttpsError('deadline-exceeded', 'Domain authentication handoff expired.');
    if (result.wrongOrigin) throw new HttpsError('permission-denied', 'Domain authentication handoff belongs to another origin.');
    if (result.invalid || !result.uid) throw new HttpsError('failed-precondition', 'Invalid domain authentication handoff.');

    const customToken = await adminAuth.createCustomToken(result.uid);
    return { customToken };
  },
);

exports.saveUserConfiguration = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const uid = requireAuthenticatedUid(request);
    const stateJson = request.data?.stateJson;
    const { product, projectName, sizeBytes } = validateSavedConfigurationPayload(
      request.data?.productType,
      request.data?.name,
      stateJson,
    );
    const requestedId = validateSavedConfigurationId(request.data?.id, { optional: true });
    const { tenantSlug } = await requireSavedConfigurationScope(request, product);
    const collection = userSavedItemsCollection(uid, product, tenantSlug);
    const ref = requestedId ? collection.doc(requestedId) : collection.doc();
    const existing = await ref.get();
    const now = Timestamp.now();
    const createdAt = existing.exists && existing.data()?.createdAt
      ? existing.data().createdAt
      : now;

    await ref.set({
      v: USER_SAVED_CONFIGURATION_VERSION,
      p: product,
      n: projectName,
      s: stateJson,
      sizeBytes,
      tenantSlug,
      createdAt,
      updatedAt: now,
    });

    return {
      id: ref.id,
      name: projectName,
      productType: product,
      sizeBytes,
      createdAtMs: createdAt.toMillis(),
      updatedAtMs: now.toMillis(),
    };
  },
);

exports.listUserConfigurations = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const uid = requireAuthenticatedUid(request);
    const product = normalizeProductType(request.data?.productType);
    if (!ALLOWED_PRODUCTS.has(product)) {
      throw new HttpsError('invalid-argument', 'Unsupported configurator type.');
    }

    const { tenantSlug } = await requireSavedConfigurationScope(request, product);
    const snapshot = await userSavedItemsCollection(uid, product, tenantSlug)
      .orderBy('updatedAt', 'desc')
      .limit(SAVED_CONFIGURATION_LIST_LIMIT)
      .select('n', 'createdAt', 'updatedAt', 'sizeBytes')
      .get();

    return {
      items: snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          name: String(data.n || ''),
          sizeBytes: Number(data.sizeBytes || 0),
          createdAtMs: timestampMillis(data.createdAt),
          updatedAtMs: timestampMillis(data.updatedAt),
        };
      }),
    };
  },
);

exports.getUserConfiguration = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const uid = requireAuthenticatedUid(request);
    const product = normalizeProductType(request.data?.productType);
    if (!ALLOWED_PRODUCTS.has(product)) {
      throw new HttpsError('invalid-argument', 'Unsupported configurator type.');
    }
    const id = validateSavedConfigurationId(request.data?.id);
    const { tenantSlug } = await requireSavedConfigurationScope(request, product);
    const snapshot = await userSavedItemsCollection(uid, product, tenantSlug).doc(id).get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Saved configuration not found.');
    const data = snapshot.data() || {};

    return {
      id: snapshot.id,
      name: String(data.n || ''),
      productType: product,
      stateJson: String(data.s || ''),
      sizeBytes: Number(data.sizeBytes || 0),
      createdAtMs: timestampMillis(data.createdAt),
      updatedAtMs: timestampMillis(data.updatedAt),
    };
  },
);

exports.deleteUserConfiguration = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const uid = requireAuthenticatedUid(request);
    const product = normalizeProductType(request.data?.productType);
    if (!ALLOWED_PRODUCTS.has(product)) {
      throw new HttpsError('invalid-argument', 'Unsupported configurator type.');
    }
    const id = validateSavedConfigurationId(request.data?.id);
    const { tenantSlug } = await requireSavedConfigurationScope(request, product);
    await userSavedItemsCollection(uid, product, tenantSlug).doc(id).delete();
    return { id, deleted: true };
  },
);

exports.getUserCart = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const uid = requireAuthenticatedUid(request);
    const { tenantSlug } = await requireUserCartScope(request);
    await migrateFlatShoppingCartIfNeeded(uid, tenantSlug);
    await migrateLegacyUserCartIfNeeded(uid, tenantSlug);

    let editingItem = null;
    const requestedKey = String(request.data?.key || '').trim();
    const requestedProduct = String(request.data?.productId || '').trim().toLowerCase();
    if (requestedKey || requestedProduct) {
      const productId = normalizeProductType(requestedProduct);
      if (!ALLOWED_PRODUCTS.has(productId)) {
        throw new HttpsError('invalid-argument', 'Unsupported cart configurator type.');
      }
      const itemId = validateShoppingCartItemId(requestedKey);
      const itemSnapshot = await userShoppingCartItemsCollection(uid, productId, tenantSlug).doc(itemId).get();
      if (!itemSnapshot.exists) throw new HttpsError('not-found', 'Shopping cart configuration not found.');
      editingItem = shoppingCartItemDetail(itemSnapshot);
      if (!editingItem) throw new HttpsError('failed-precondition', 'Shopping cart configuration is empty.');
    }

    const snapshot = await readShoppingCartSnapshots(uid, tenantSlug);
    return shoppingCartResponse(snapshot, { editingItem });
  },
);

exports.mutateUserCart = onCall(
  USER_CONFIGURATION_CALLABLE_OPTIONS,
  async (request) => {
    const uid = requireAuthenticatedUid(request);
    const { tenantSlug } = await requireUserCartScope(request);
    const action = String(request.data?.action || '').trim().toLowerCase();
    if (!['add', 'update', 'remove', 'empty'].includes(action)) {
      throw new HttpsError('invalid-argument', 'Unsupported cart action.');
    }

    await migrateFlatShoppingCartIfNeeded(uid, tenantSlug);
    await migrateLegacyUserCartIfNeeded(uid, tenantSlug);

    if (action === 'add') {
      const rawItem = request.data?.item || {};
      const productId = normalizeProductType(rawItem.productId);
      if (!ALLOWED_PRODUCTS.has(productId)) {
        throw new HttpsError('invalid-argument', 'Unsupported cart configurator type.');
      }
      const savedConfigurationId = validateSavedConfigurationId(rawItem.savedConfigurationId);
      const priceAmount = normalizeCartPrice(rawItem.costAmount);
      const currency = normalizeCartCurrency(rawItem.currency);
      const savedRef = userSavedItemsCollection(uid, productId, tenantSlug).doc(savedConfigurationId);
      const collection = userShoppingCartItemsCollection(uid, productId, tenantSlug);
      const cartItemRef = collection.doc();
      let addedData = null;

      await db.runTransaction(async (transaction) => {
        const savedSnapshot = await transaction.get(savedRef);
        if (!savedSnapshot.exists) {
          throw new HttpsError('not-found', 'The saved configuration referenced by this cart item no longer exists.');
        }

        const allCartDocs = [];
        for (const cartProduct of ALLOWED_PRODUCTS) {
          const productSnapshot = await transaction.get(
            userShoppingCartItemsCollection(uid, cartProduct, tenantSlug)
              .orderBy('createdAt', 'asc')
              .limit(MAX_USER_CART_ITEMS + 1),
          );
          allCartDocs.push(...productSnapshot.docs);
        }
        if (allCartDocs.length >= MAX_USER_CART_ITEMS) {
          throw new HttpsError('resource-exhausted', 'The shopping cart is full.');
        }

        const saved = savedSnapshot.data() || {};
        const stateJson = String(saved.s || '');
        if (!stateJson) {
          throw new HttpsError('failed-precondition', 'The saved configuration snapshot is empty.');
        }
        const sourceName = String(saved.n || 'Configuration').trim()
          .slice(0, MAX_SAVED_CONFIGURATION_NAME_LENGTH);
        const existingNames = allCartDocs
          .map((doc) => String(doc.data()?.n || '').trim())
          .filter(Boolean);
        const name = cartNameWithNumber(sourceName, existingNames);
        const now = Timestamp.now();
        addedData = {
          v: USER_CART_VERSION,
          p: productId,
          n: name,
          sourceName,
          sourceSavedConfigurationId: savedConfigurationId,
          // Copy the saved payload into the cart item. The cart entry is detached
          // from the source save: later source edits cannot alter it, while explicit
          // cart editing updates only this shoppingCart snapshot.
          s: stateJson,
          sizeBytes: Number(saved.sizeBytes || utf8ByteLength(stateJson)),
          priceAmount,
          currency,
          tenantSlug,
          createdAt: now,
          updatedAt: now,
        };
        transaction.create(cartItemRef, addedData);
      });

      const snapshot = await readShoppingCartSnapshots(uid, tenantSlug);
      return shoppingCartResponse(snapshot, {
        addedItem: { id: cartItemRef.id, ...addedData },
        updatedAtMs: Date.now(),
      });
    }

    if (action === 'update') {
      const rawItem = request.data?.item || {};
      const productId = normalizeProductType(rawItem.productId);
      if (!ALLOWED_PRODUCTS.has(productId)) {
        throw new HttpsError('invalid-argument', 'Unsupported cart configurator type.');
      }
      const itemId = validateShoppingCartItemId(rawItem.key || rawItem.cartItemId);
      const itemRef = userShoppingCartItemsCollection(uid, productId, tenantSlug).doc(itemId);
      const stateJson = rawItem.stateJson;
      const requestedName = String(rawItem.name || '').trim();
      const priceAmount = normalizeCartPrice(rawItem.costAmount);
      const currency = normalizeCartCurrency(rawItem.currency);

      const existing = await itemRef.get();
      if (!existing.exists) throw new HttpsError('not-found', 'Shopping cart configuration not found.');
      const existingData = existing.data() || {};
      const { projectName, sizeBytes } = validateSavedConfigurationPayload(
        productId,
        requestedName || existingData.n || 'Configuration',
        stateJson,
      );
      const now = Timestamp.now();
      const updates = {
        v: USER_CART_VERSION,
        n: projectName,
        s: stateJson,
        sizeBytes,
        priceAmount,
        currency,
        updatedAt: now,
      };
      await itemRef.update(updates);
      const updatedData = { id: itemId, ...existingData, ...updates };
      const snapshot = await readShoppingCartSnapshots(uid, tenantSlug);
      return shoppingCartResponse(snapshot, {
        updatedItem: updatedData,
        updatedAtMs: now.toMillis(),
      });
    }

    if (action === 'remove') {
      const productId = normalizeProductType(request.data?.productId);
      if (!ALLOWED_PRODUCTS.has(productId)) {
        throw new HttpsError('invalid-argument', 'Unsupported cart configurator type.');
      }
      const itemId = validateShoppingCartItemId(request.data?.key);
      await userShoppingCartItemsCollection(uid, productId, tenantSlug).doc(itemId).delete();
      const snapshot = await readShoppingCartSnapshots(uid, tenantSlug);
      return shoppingCartResponse(snapshot);
    }

    const allDocs = (await readShoppingCartSnapshots(uid, tenantSlug)).docs;
    if (allDocs.length) {
      const batch = db.batch();
      allDocs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    return shoppingCartResponse({ docs: [] });
  },
);

// Direct-Firestore shares remain the explicit no-reCAPTCHA fallback. The rules
// permit them before App Check is activated for the first time and, afterwards,
// only while the server-controlled fallback window is active. This trigger keeps
// that path under the same 200 MiB FIFO quota and 90-day lifetime policy.
exports.enforceSharedConfigurationQuota = onDocumentCreated(
  {
    document: `${SHARES_COLLECTION}/{shareId}`,
    region: FUNCTION_REGION,
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
    maxInstances: 1,
    concurrency: 1,
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const shareId = event.params.shareId;
    const data = snapshot.data();

    // Protected callable writes are already quota/lifetime annotated.
    if (
      Number(data.quotaVersion) >= 2
      && Number.isFinite(Number(data.sizeBytes))
      && data.createdAt
      && data.expiresAt
    ) {
      return;
    }

    const serializedState = data.s;
    if (typeof serializedState !== 'string' || serializedState.length === 0) {
      logger.warn(`Deleting invalid shared configuration ${shareId}: missing state string.`);
      await snapshot.ref.delete();
      return;
    }

    const sizeBytes = utf8ByteLength(serializedState);
    if (sizeBytes > MAX_SINGLE_SHARE_BYTES) {
      logger.warn(`Deleting oversized shared configuration ${shareId}.`, {
        event: 'shared-configuration-oversize-delete',
        shareId,
        sizeBytes,
        maxBytes: MAX_SINGLE_SHARE_BYTES,
      });
      await snapshot.ref.delete();
      return;
    }

    const createdAt = snapshot.createTime || Timestamp.now();
    const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + SHARE_LIFETIME_MS);
    await snapshot.ref.update({
      sizeBytes,
      createdAt,
      expiresAt,
      quotaVersion: 1,
    });

    const collection = db.collection(SHARES_COLLECTION);
    const totalBytes = await currentStoredBytes(collection);

    if (totalBytes <= MAX_TOTAL_BYTES) {
      logger.info('Legacy/fallback share stored within quota.', {
        event: 'shared-configuration-fallback-stored',
        shareId,
        sizeBytes,
        totalBytes,
        limitBytes: MAX_TOTAL_BYTES,
      });
      return;
    }

    const overflowBytes = totalBytes - MAX_TOTAL_BYTES;
    const bytesToFree = Math.max(CLEANUP_CHUNK_BYTES, overflowBytes);
    const cleanup = await deleteOldestUntilFreed(collection, bytesToFree, shareId);
    const remainingBytes = await currentStoredBytes(collection);

    logger.info('Shared configuration FIFO quota cleanup completed.', {
      event: 'shared-configuration-quota-cleanup',
      shareId,
      totalBytesBeforeCleanup: totalBytes,
      requestedBytesToFree: bytesToFree,
      freedBytes: cleanup.freedBytes,
      deletedCount: cleanup.deletedCount,
      totalBytesAfterCleanup: remainingBytes,
      limitBytes: MAX_TOTAL_BYTES,
    });

    if (remainingBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        `Shared configuration quota cleanup incomplete: ${remainingBytes} bytes remain ` +
        `above the ${MAX_TOTAL_BYTES}-byte limit.`,
      );
    }
  },
);
