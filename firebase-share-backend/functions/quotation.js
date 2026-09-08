'use strict';

const { randomBytes } = require('node:crypto');
const { GoogleAuth } = require('google-auth-library');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { Timestamp, getFirestore } = require('firebase-admin/firestore');

const FUNCTION_REGION = 'europe-west1';
const RUNTIME_SERVICE_ACCOUNT = 'configurator-runtime@configurator-360.iam.gserviceaccount.com';
const TEST_QUOTATION_RECIPIENT = 'matei.belciug.work@gmail.com';
const QUOTATION_RATE_LIMIT_COLLECTION = 'quotationRequestRateLimits';
const QUOTATIONS_COLLECTION = 'quotations';
const QUOTATION_ARCHIVE_VERSION = 1;
const QUOTATION_MIN_INTERVAL_MS = 30 * 1000;
const SHARES_COLLECTION = 'sharedConfigurations';
const SHARE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_SINGLE_SHARE_BYTES = 850_000;
const FIRESTORE_RECORD_VERSION = 1;
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const CART_ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,180}$/;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const PRODUCTS = Object.freeze(['window', 'roof', 'pergola', 'hall', 'solar', 'fence', 'cardbox']);
const PRODUCT_SET = new Set(PRODUCTS);
const CURRENCIES = new Set(['USD', 'RON', 'EUR']);
const LOCALES = new Set(['en-US', 'ro-RO', 'de-DE']);
const FX_RATES_FROM_EUR = Object.freeze({ EUR: 1, USD: 1.09, RON: 4.98 });
const MAX_CART_ITEMS = 100;

const PUBLIC_ORIGINS = new Set([
  'https://360configurator.com',
  'https://www.360configurator.com',
  'https://360configurator.ro',
  'https://www.360configurator.ro',
  'https://360konfigurator.de',
  'https://www.360konfigurator.de',
  'https://aks.360configurator.com',
]);
const DEVELOPMENT_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const TENANT_ORIGIN = /^https:\/\/([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)\.360configurator\.com$/;

const LOCALE_HOSTS = Object.freeze({
  'en-US': 'www.360configurator.com',
  'ro-RO': 'www.360configurator.ro',
  'de-DE': 'www.360konfigurator.de',
});
const CONFIGURATOR_PATHS = Object.freeze({
  'en-US': Object.freeze({
    pergola: '/pergola-configurator/',
    roof: '/roof-configurator/',
    window: '/window-configurator/',
    hall: '/hall-configurator/',
    solar: '/solar-configurator/',
    fence: '/fence-configurator/',
    cardbox: '/cardbox-configurator/',
  }),
  'ro-RO': Object.freeze({
    pergola: '/configurator-pergola/',
    roof: '/configurator-acoperis/',
    window: '/configurator-ferestre/',
    hall: '/configurator-hala/',
    solar: '/configurator-solar/',
    fence: '/configurator-garduri/',
    cardbox: '/configurator-cutii-carton/',
  }),
  'de-DE': Object.freeze({
    pergola: '/pergola-konfigurator/',
    roof: '/dach-konfigurator/',
    window: '/fenster-konfigurator/',
    hall: '/hallen-konfigurator/',
    solar: '/solar-konfigurator/',
    fence: '/zaun-konfigurator/',
    cardbox: '/karton-konfigurator/',
  }),
});

// These are production defaults, not placeholders. The branding resolver is
// deliberately centralized so a future tenant/company implementation can swap
// these values without touching the email template or quotation workflow.
const DEFAULT_QUOTATION_BRAND = Object.freeze({
  companyName: '360Configurator',
  representativeName: '360Configurator Team',
  logoUrl: 'https://www.360configurator.com/shared-ui/assets/360CONFIGURATOR.png',
  websiteUrl: 'https://www.360configurator.com/',
  contactEmail: 'office@360configurator.com',
});

const QUOTATION_FROM = '360Configurator Quotations <office@360configurator.com>';
const QUOTATION_FALLBACK_FROM = '360Configurator Quotations <office@360design.ro>';
const WORKSPACE_USER = 'office@360design.ro';
const MAILER_SERVICE_ACCOUNT = 'configurator-mailer@configurator-360.iam.gserviceaccount.com';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const mailerSignerAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
let gmailAccessTokenCache = { token: '', expiresAtMs: 0 };

const EMAIL_COPY = Object.freeze({
  'en-US': Object.freeze({
    subject: 'Your quotation request',
    preheader: 'We received your quotation request and configuration selection.',
    greeting: 'Hello,',
    intro: (company) => `Thank you for your quotation request. We received the configurations below on behalf of ${company}.`,
    help: 'Please note that the prices shown below are indicative and may change. To receive the final quotation, you will need to discuss the request with a representative of our company.',
    configuration: 'Configuration',
    price: 'Price',
    summary: 'Summary',
    currency: 'Quotation currency',
    closing: 'A member of our team will review your request and contact you with the next steps.',
    regards: 'Kind regards,',
    generated: 'This quotation request was generated from the 360Configurator cart.',
    product: Object.freeze({ window: 'Window', roof: 'Roof', pergola: 'Pergola', hall: 'Hall', solar: 'Solar', fence: 'Fence', cardbox: 'Cardboard box' }),
  }),
  'ro-RO': Object.freeze({
    subject: 'Solicitarea dumneavoastră de ofertă',
    preheader: 'Am primit solicitarea de ofertă și configurațiile selectate.',
    greeting: 'Bună ziua,',
    intro: (company) => `Vă mulțumim pentru solicitarea de ofertă. Am primit configurațiile de mai jos în numele ${company}.`,
    help: 'Vă reamintim că prețurile afișate dedesubt sunt orientative și pot suferi schimbări. Pentru primirea ofertei finale va trebui să discutați cu un reprezentant al companiei noastre.',
    configuration: 'Configurație',
    price: 'Preț',
    summary: 'Total',
    currency: 'Moneda ofertei',
    closing: 'Un membru al echipei noastre va analiza solicitarea și vă va contacta pentru pașii următori.',
    regards: 'Cu stimă,',
    generated: 'Această solicitare de ofertă a fost generată din coșul 360Configurator.',
    product: Object.freeze({ window: 'Fereastră', roof: 'Acoperiș', pergola: 'Pergolă', hall: 'Hală', solar: 'Solar', fence: 'Gard', cardbox: 'Cutie din carton' }),
  }),
  'de-DE': Object.freeze({
    subject: 'Ihre Angebotsanfrage',
    preheader: 'Wir haben Ihre Angebotsanfrage und die ausgewählten Konfigurationen erhalten.',
    greeting: 'Guten Tag,',
    intro: (company) => `Vielen Dank für Ihre Angebotsanfrage. Wir haben die unten aufgeführten Konfigurationen im Namen von ${company} erhalten.`,
    help: 'Bitte beachten Sie, dass die unten angezeigten Preise Richtwerte sind und sich ändern können. Für ein endgültiges Angebot müssen Sie die Anfrage mit einem Vertreter unseres Unternehmens besprechen.',
    configuration: 'Konfiguration',
    price: 'Preis',
    summary: 'Summe',
    currency: 'Angebotswährung',
    closing: 'Ein Mitglied unseres Teams wird Ihre Anfrage prüfen und Sie zu den nächsten Schritten kontaktieren.',
    regards: 'Mit freundlichen Grüßen,',
    generated: 'Diese Angebotsanfrage wurde aus dem 360Configurator-Warenkorb erstellt.',
    product: Object.freeze({ window: 'Fenster', roof: 'Dach', pergola: 'Pergola', hall: 'Halle', solar: 'Solar', fence: 'Zaun', cardbox: 'Kartonbox' }),
  }),
});

function requestOrigin(request) {
  return String(request.rawRequest?.get?.('origin') || '').trim().replace(/\/$/, '');
}

function requireUid(request) {
  const uid = String(request.auth?.uid || '').trim();
  if (!uid) throw new HttpsError('unauthenticated', 'Google login is required.');
  return uid;
}

async function quotationScope(request) {
  const origin = requestOrigin(request);
  if (PUBLIC_ORIGINS.has(origin) || DEVELOPMENT_ORIGIN.test(origin)) {
    return { origin, tenantSlug: '' };
  }

  const match = origin.match(TENANT_ORIGIN);
  const tenantSlug = String(match?.[1] || '').trim();
  if (!TENANT_SLUG_PATTERN.test(tenantSlug)) {
    throw new HttpsError('permission-denied', 'Unsupported quotation origin.');
  }

  const snapshot = await getFirestore().collection('tenants').doc(tenantSlug).get();
  const tenant = snapshot.data() || {};
  if (!snapshot.exists || tenant.status !== 'active' || String(tenant.domain || '') !== `${tenantSlug}.360configurator.com`) {
    throw new HttpsError('permission-denied', 'This customer tenant is not active.');
  }
  return { origin, tenantSlug };
}

function cartCollection(uid, product, tenantSlug = '') {
  const userRef = getFirestore().collection('users').doc(uid);
  if (!tenantSlug) {
    return userRef.collection('shoppingCart').doc(product).collection('items');
  }
  return userRef
    .collection('tenantShoppingCart')
    .doc(tenantSlug)
    .collection('products')
    .doc(product)
    .collection('items');
}

async function readCart(uid, tenantSlug) {
  const snapshots = await Promise.all(PRODUCTS.map((product) =>
    cartCollection(uid, product, tenantSlug).limit(MAX_CART_ITEMS).get()));

  const items = [];
  for (let productIndex = 0; productIndex < PRODUCTS.length; productIndex += 1) {
    const product = PRODUCTS[productIndex];
    for (const doc of snapshots[productIndex].docs) {
      const data = doc.data() || {};
      const amount = Number(data.priceAmount ?? data.costAmount);
      const currency = String(data.currency || '').trim().toUpperCase();
      const stateJson = String(data.s || '');
      if (!stateJson || !Number.isFinite(amount) || amount < 0 || !CURRENCIES.has(currency)) continue;
      items.push({
        key: doc.id,
        productId: product,
        name: String(data.n || data.name || `${product} configuration`).trim().slice(0, 120),
        amount,
        currency,
        stateJson,
        createdAtMs: data.createdAt?.toMillis?.() || 0,
      });
    }
  }
  items.sort((a, b) => a.createdAtMs - b.createdAtMs || a.productId.localeCompare(b.productId) || a.key.localeCompare(b.key));
  return items.slice(0, MAX_CART_ITEMS);
}

function quotationGuestUrl(locale, tenantSlug, productId, shareId) {
  const host = tenantSlug ? `${tenantSlug}.360configurator.com` : LOCALE_HOSTS[locale];
  const path = tenantSlug
    ? CONFIGURATOR_PATHS['en-US']?.[productId]
    : CONFIGURATOR_PATHS[locale]?.[productId];
  if (!host || !path) throw new HttpsError('internal', 'The quotation configuration link could not be generated.');
  const target = new URL(`https://${host}${path}`);
  const hash = new URLSearchParams();
  hash.set('s', shareId);
  hash.set('domainAuthState', 'guest');
  target.hash = hash.toString();
  return target.href;
}

async function createQuotationGuestShares(items, locale, tenantSlug) {
  const collection = getFirestore().collection(SHARES_COLLECTION);
  const createdShareIds = [];
  const preparedItems = [];
  try {
    for (const item of items) {
      const sizeBytes = Buffer.byteLength(item.stateJson, 'utf8');
      if (sizeBytes <= 0 || sizeBytes > MAX_SINGLE_SHARE_BYTES) {
        throw new HttpsError('failed-precondition', 'A cart configuration is too large to include in a quotation link.');
      }
      const createdAt = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + SHARE_LIFETIME_MS);
      const documentData = {
        v: FIRESTORE_RECORD_VERSION,
        p: item.productId,
        s: item.stateJson,
        sizeBytes,
        createdAt,
        expiresAt,
        quotaVersion: 2,
      };

      let shareId = '';
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const candidate = randomBytes(12).toString('base64url');
        try {
          await collection.doc(candidate).create(documentData);
          shareId = candidate;
          break;
        } catch (error) {
          if (Number(error?.code) === 6 || String(error?.code) === 'already-exists') continue;
          throw error;
        }
      }
      if (!shareId) throw new HttpsError('aborted', 'Could not allocate a quotation configuration link.');
      createdShareIds.push(shareId);
      preparedItems.push({
        ...item,
        link: quotationGuestUrl(locale, tenantSlug, item.productId, shareId),
      });
    }
    return { items: preparedItems, shareIds: createdShareIds };
  } catch (error) {
    await Promise.allSettled(createdShareIds.map((shareId) => collection.doc(shareId).delete()));
    if (error instanceof HttpsError) throw error;
    logger.error('Quotation guest-share creation failed.', {
      event: 'quotation-share-creation-failed',
      itemCount: items.length,
      tenantSlug: tenantSlug || null,
      message: String(error?.message || error),
    });
    throw new HttpsError('unavailable', 'The quotation configuration links could not be prepared. Please try again.');
  }
}

async function deleteQuotationShares(shareIds) {
  const collection = getFirestore().collection(SHARES_COLLECTION);
  await Promise.allSettled((Array.isArray(shareIds) ? shareIds : []).map((shareId) => collection.doc(shareId).delete()));
}

function normalizeLocale(value) {
  const locale = String(value || '').trim();
  if (!LOCALES.has(locale)) throw new HttpsError('invalid-argument', 'Unsupported quotation language.');
  return locale;
}

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  if (!CURRENCIES.has(currency)) throw new HttpsError('invalid-argument', 'Unsupported quotation currency.');
  return currency;
}

function convertMoney(amount, fromCurrency, toCurrency) {
  const fromRate = Number(FX_RATES_FROM_EUR[fromCurrency]);
  const toRate = Number(FX_RATES_FROM_EUR[toCurrency]);
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate)) return 0;
  return (Number(amount) / fromRate) * toRate;
}

function formatMoney(amount, currency, locale) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function expectedLinkHost(locale, tenantSlug) {
  return tenantSlug ? `${tenantSlug}.360configurator.com` : LOCALE_HOSTS[locale];
}

function parseAndValidateLink(rawLink, locale, tenantSlug, expectedProduct) {
  let url;
  try { url = new URL(String(rawLink || '')); } catch { throw new HttpsError('invalid-argument', 'A quotation configuration link is invalid.'); }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== expectedLinkHost(locale, tenantSlug)) {
    throw new HttpsError('invalid-argument', 'A quotation configuration link uses an unexpected domain.');
  }
  const expectedPath = tenantSlug
    ? CONFIGURATOR_PATHS['en-US']?.[expectedProduct]
    : CONFIGURATOR_PATHS[locale]?.[expectedProduct];
  if (url.pathname !== expectedPath) {
    throw new HttpsError('invalid-argument', 'A quotation configuration link uses an unexpected configurator path.');
  }
  if (url.search) throw new HttpsError('invalid-argument', 'A quotation configuration link contains unexpected query data.');

  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  const shareId = String(hash.get('s') || '');
  if (!SHARE_ID_PATTERN.test(shareId) || hash.get('domainAuthState') !== 'guest') {
    throw new HttpsError('invalid-argument', 'A quotation configuration link is not a guest share.');
  }
  if (hash.has('domainAuthHandoff') || hash.has('savedConfig') || hash.has('cartItem') || hash.has('cartProduct')) {
    throw new HttpsError('invalid-argument', 'A quotation link may not contain authenticated configuration state.');
  }
  return { url: url.href, shareId };
}

function linkMapFromRequest(rawLinks) {
  if (!Array.isArray(rawLinks) || rawLinks.length > MAX_CART_ITEMS) {
    throw new HttpsError('invalid-argument', 'Invalid quotation configuration links.');
  }
  const result = new Map();
  for (const raw of rawLinks) {
    const key = String(raw?.key || '').trim();
    const productId = String(raw?.productId || '').trim().toLowerCase();
    if (!CART_ITEM_ID_PATTERN.test(key) || !PRODUCT_SET.has(productId)) {
      throw new HttpsError('invalid-argument', 'A quotation cart item is invalid.');
    }
    const compound = `${productId}:${key}`;
    if (result.has(compound)) throw new HttpsError('invalid-argument', 'Duplicate quotation cart item.');
    result.set(compound, String(raw?.url || ''));
  }
  return result;
}

async function validatedCartLinks(items, rawLinks, locale, tenantSlug) {
  const supplied = linkMapFromRequest(rawLinks);
  if (supplied.size !== items.length) {
    throw new HttpsError('failed-precondition', 'The cart changed while the quotation was being prepared. Please try again.');
  }

  const validated = [];
  for (const item of items) {
    const compound = `${item.productId}:${item.key}`;
    if (!supplied.has(compound)) {
      throw new HttpsError('failed-precondition', 'The cart changed while the quotation was being prepared. Please try again.');
    }
    const parsed = parseAndValidateLink(supplied.get(compound), locale, tenantSlug, item.productId);
    const shareSnapshot = await getFirestore().collection(SHARES_COLLECTION).doc(parsed.shareId).get();
    const share = shareSnapshot.data() || {};
    if (!shareSnapshot.exists || String(share.p || '') !== item.productId || String(share.s || '') !== item.stateJson) {
      throw new HttpsError('failed-precondition', 'A quotation share no longer matches the cart snapshot. Please try again.');
    }
    validated.push({ ...item, link: parsed.url });
  }
  return validated;
}

async function enforceQuotationRateLimit(uid) {
  const db = getFirestore();
  const ref = db.collection(QUOTATION_RATE_LIMIT_COLLECTION).doc(uid);
  const nowMs = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const lastMs = snapshot.data()?.lastAttemptAt?.toMillis?.() || 0;
    if (lastMs && nowMs - lastMs < QUOTATION_MIN_INTERVAL_MS) {
      const retryAfterMs = Math.max(1, QUOTATION_MIN_INTERVAL_MS - (nowMs - lastMs));
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      throw new HttpsError(
        'resource-exhausted',
        `Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before sending another quotation request.`,
        { retryAfterSeconds },
      );
    }
    transaction.set(ref, {
      lastAttemptAt: Timestamp.fromMillis(nowMs),
      updatedAt: Timestamp.fromMillis(nowMs),
    }, { merge: true });
  });
}

async function quotationBrandingForScope() {
  // Future tenant/company-specific branding belongs here. For now every request
  // receives the polished 360Configurator identity and optional fields are simply
  // omitted by the template when empty.
  return { ...DEFAULT_QUOTATION_BRAND };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function quotationPresentation(items, locale, currency) {
  const copy = EMAIL_COPY[locale];
  const rows = items.map((item) => {
    const convertedAmount = convertMoney(item.amount, item.currency, currency);
    return {
      ...item,
      typeLabel: copy.product[item.productId] || item.productId,
      convertedAmount,
      priceText: formatMoney(convertedAmount, currency, locale),
    };
  });
  const total = rows.reduce((sum, item) => sum + item.convertedAmount, 0);
  return { rows, total, totalText: formatMoney(total, currency, locale), copy };
}

async function discardQuotationArchive(archive) {
  if (!archive?.requestRef) return;
  const refs = Array.isArray(archive.itemRefs) ? archive.itemRefs : [];
  const db = getFirestore();
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  await archive.requestRef.delete().catch(() => {});
}

async function stageQuotationArchive({ uid, userEmail, userName, tenantSlug, origin, locale, currency, items, presentation }) {
  const db = getFirestore();
  const userRef = db.collection(QUOTATIONS_COLLECTION).doc(uid);
  const requestRef = userRef.collection('requests').doc();
  const requestedAt = Timestamp.now();
  const itemRefs = [];

  try {
    await requestRef.create({
      v: QUOTATION_ARCHIVE_VERSION,
      quotationId: requestRef.id,
      userEmail: userEmail || null,
      userName: userName || null,
      status: 'sending',
      requestedAt,
      // Keep the send timestamp on the staged record so the request still has
      // a useful date even if the provider accepts the email but the final
      // status write is interrupted afterward.
      sentAt: requestedAt,
      itemCount: items.length,
      locale,
      currency,
      totalValue: presentation.total,
      totalText: presentation.totalText,
      tenantSlug: tenantSlug || null,
      origin,
    });

    // A single configuration can be close to Firestore's per-document limit.
    // Write item snapshots in small batches so a large cart cannot exceed the
    // 10 MiB Firestore batch-request limit.
    for (let offset = 0; offset < presentation.rows.length; offset += 8) {
      const batch = db.batch();
      const chunk = presentation.rows.slice(offset, offset + 8);
      chunk.forEach((item, chunkIndex) => {
        const itemRef = requestRef.collection('items').doc();
        itemRefs.push(itemRef);
        batch.set(itemRef, {
          v: QUOTATION_ARCHIVE_VERSION,
          position: offset + chunkIndex,
          cartItemId: item.key,
          productId: item.productId,
          name: item.name,
          configurationState: item.stateJson,
          originalValue: item.amount,
          originalCurrency: item.currency,
          quotationValue: item.convertedAmount,
          quotationCurrency: currency,
          configurationLink: item.link,
          cartCreatedAt: item.createdAtMs ? Timestamp.fromMillis(item.createdAtMs) : null,
          archivedAt: requestedAt,
        });
      });
      await batch.commit();
    }
  } catch (error) {
    await discardQuotationArchive({ requestRef, itemRefs }).catch(() => {});
    logger.error('Quotation archive staging failed.', {
      event: 'quotation-archive-stage-failed',
      uid,
      quotationId: requestRef.id,
      itemCount: items.length,
      message: String(error?.message || error),
    });
    throw new HttpsError('unavailable', 'The quotation request could not be recorded. Please try again.');
  }

  return { userRef, requestRef, itemRefs, quotationId: requestRef.id, requestedAt, userEmail, userName };
}

async function finalizeQuotationArchive(archive) {
  const db = getFirestore();
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await db.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(archive.userRef);
        const existing = userSnapshot.data() || {};
        const acceptedAt = Timestamp.now();
        const userRecord = {
          uid: archive.userRef.id,
          firstQuotationAt: existing.firstQuotationAt || archive.requestedAt,
          lastQuotationAt: acceptedAt,
          quotationCount: Math.max(0, Number(existing.quotationCount) || 0) + 1,
          updatedAt: acceptedAt,
        };
        if (archive.userEmail) userRecord.email = archive.userEmail;
        if (archive.userName) userRecord.displayName = archive.userName;
        transaction.set(archive.userRef, userRecord, { merge: true });
        transaction.update(archive.requestRef, {
          status: 'sent',
          providerAcceptedAt: acceptedAt,
          updatedAt: acceptedAt,
        });
      });
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
  logger.error('Quotation email was sent but the archive finalization failed.', {
    event: 'quotation-archive-finalize-failed',
    uid: archive.userRef.id,
    quotationId: archive.quotationId,
    message: String(lastError?.message || lastError || 'Unknown error'),
  });
  return false;
}

function quotationHtml({ rows, totalText, copy, currency, brand }) {
  const logo = brand.logoUrl
    ? `<a href="${escapeHtml(brand.websiteUrl)}" style="display:inline-block;text-decoration:none"><img src="${escapeHtml(brand.logoUrl)}" width="190" alt="${escapeHtml(brand.companyName)}" style="display:block;max-width:190px;height:auto;border:0"></a>`
    : `<div style="font-size:22px;font-weight:750;color:#111827">${escapeHtml(brand.companyName)}</div>`;
  const rowsHtml = rows.map((item) => `
    <tr>
      <td style="padding:16px 18px;border-bottom:1px solid #e5e7eb;font:500 15px/1.4 Arial,sans-serif;color:#111827">
        <a href="${escapeHtml(item.link)}" style="color:#1267d6;text-decoration:none;font-weight:700"><span aria-hidden="true" style="display:inline-block;margin-right:7px;color:#1267d6;font-size:14px;line-height:1">&#128279;</span>${escapeHtml(item.typeLabel)}: ${escapeHtml(item.name)}</a>
      </td>
      <td align="right" style="padding:16px 18px;border-bottom:1px solid #e5e7eb;white-space:nowrap;font:700 15px/1.4 Arial,sans-serif;color:#111827">${escapeHtml(item.priceText)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f5f8;color:#111827">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(copy.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f5f8">
      <tr><td align="center" style="padding:32px 14px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden">
          <tr><td style="padding:26px 28px 20px;border-bottom:1px solid #eef0f3">${logo}</td></tr>
          <tr><td style="padding:28px 28px 8px;font:400 16px/1.6 Arial,sans-serif;color:#374151">
            <div style="font-size:22px;line-height:1.3;font-weight:750;color:#111827;margin-bottom:16px">${escapeHtml(copy.greeting)}</div>
            <p style="margin:0 0 12px">${escapeHtml(copy.intro(brand.companyName))}</p>
            <p style="margin:0 0 8px">${escapeHtml(copy.help)}</p>
          </td></tr>
          <tr><td style="padding:16px 28px 24px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0">
              <tr>
                <th align="left" style="padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font:700 12px/1.3 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(copy.configuration)}</th>
                <th align="right" style="padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font:700 12px/1.3 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(copy.price)}</th>
              </tr>
              ${rowsHtml}
              <tr>
                <td style="padding:17px 18px;background:#f8fafc;font:800 16px/1.4 Arial,sans-serif;color:#111827">${escapeHtml(copy.summary)}</td>
                <td align="right" style="padding:17px 18px;background:#f8fafc;white-space:nowrap;font:800 17px/1.4 Arial,sans-serif;color:#111827">${escapeHtml(totalText)}</td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:4px 28px 28px;font:400 16px/1.6 Arial,sans-serif;color:#374151">
            <p style="margin:0 0 22px">${escapeHtml(copy.closing)}</p>
            <p style="margin:0">${escapeHtml(copy.regards)}<br><strong>${escapeHtml(brand.representativeName)}</strong><br>${escapeHtml(brand.companyName)}</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #eef0f3;font:400 12px/1.5 Arial,sans-serif;color:#6b7280">
            ${brand.websiteUrl ? `<a href="${escapeHtml(brand.websiteUrl)}" style="color:#4b5563;text-decoration:none">${escapeHtml(brand.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : ''}
            ${brand.contactEmail ? ` &nbsp;•&nbsp; <a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:#4b5563;text-decoration:none">${escapeHtml(brand.contactEmail)}</a>` : ''}
            <div style="margin-top:8px">${escapeHtml(copy.generated)}</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function quotationText({ rows, totalText, copy, currency, brand }) {
  const lines = [
    copy.greeting,
    '',
    copy.intro(brand.companyName),
    copy.help,
    '',
  ];
  for (const item of rows) {
    lines.push(`${item.typeLabel}: ${item.name}    ${item.priceText}`);
    lines.push(`🔗 ${item.link}`);
    lines.push('');
  }
  lines.push(`${copy.summary}: ${totalText}`, '', copy.closing, '', copy.regards, brand.representativeName, brand.companyName);
  if (brand.websiteUrl) lines.push(brand.websiteUrl);
  if (brand.contactEmail) lines.push(brand.contactEmail);
  return lines.join('\n');
}

function encodeMimeSubject(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), 'utf8').toString('base64')}?=`;
}

function encodeMimeMessage({ from, to, replyTo, subject, text, html }) {
  const boundary = `quotation_${randomBytes(12).toString('hex')}`;
  const normalizedText = String(text || '').replace(/\r?\n/g, '\r\n');
  const normalizedHtml = String(html || '').replace(/\r?\n/g, '\r\n');
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizedText,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizedHtml,
    `--${boundary}--`,
    '',
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
    iss: MAILER_SERVICE_ACCOUNT,
    sub: WORKSPACE_USER,
    scope: GMAIL_SEND_SCOPE,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  });
  const signerClient = await mailerSignerAuth.getClient();
  const signResponse = await signerClient.request({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(MAILER_SERVICE_ACCOUNT)}:signJwt`,
    method: 'POST',
    data: { payload: jwtPayload },
  });
  const signedJwt = String(signResponse.data?.signedJwt || '');
  if (!signedJwt) throw new Error('Google IAM Credentials did not return a signed JWT.');

  const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google Workspace delegated authorization failed (${tokenResponse.status}).`);
  const tokenData = await tokenResponse.json();
  const accessToken = String(tokenData?.access_token || '');
  if (!accessToken) throw new Error('Google OAuth did not return an access token.');
  gmailAccessTokenCache = {
    token: accessToken,
    expiresAtMs: nowMs + Math.max(60, Number(tokenData?.expires_in || 3600)) * 1000,
  };
  return accessToken;
}

async function gmailSendRaw(accessToken, raw) {
  return fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(WORKSPACE_USER)}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': '360ConfiguratorQuotation/1.0',
    },
    body: JSON.stringify({ raw }),
  });
}


const ORDER_HISTORY_LIMIT = 250;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function archivedTimestampMs(value) {
  return value?.toMillis?.() || 0;
}

function archivedOrderItem(doc) {
  const data = doc.data() || {};
  const productId = String(data.productId || '').trim().toLowerCase();
  const value = Number(data.quotationValue);
  return {
    id: doc.id,
    position: Math.max(0, Math.floor(Number(data.position) || 0)),
    productId: PRODUCT_SET.has(productId) ? productId : '',
    name: String(data.name || `${productId || 'configuration'} configuration`).trim().slice(0, 160),
    amount: Number.isFinite(value) ? value : 0,
    currency: String(data.quotationCurrency || '').trim().toUpperCase(),
    hasConfiguration: typeof data.configurationState === 'string' && data.configurationState.length > 0,
  };
}

async function listArchivedOrders(uid) {
  const requestSnapshot = await getFirestore()
    .collection(QUOTATIONS_COLLECTION)
    .doc(uid)
    .collection('requests')
    .get();

  const requests = await Promise.all(requestSnapshot.docs.map(async (doc) => {
    const data = doc.data() || {};
    const itemsSnapshot = await doc.ref.collection('items').get();
    const items = itemsSnapshot.docs
      .map(archivedOrderItem)
      .filter((item) => item.productId)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const totalValue = Number(data.totalValue);
    return {
      id: doc.id,
      requestedAtMs: archivedTimestampMs(data.requestedAt || data.sentAt),
      currency: String(data.currency || '').trim().toUpperCase(),
      totalValue: Number.isFinite(totalValue) ? totalValue : 0,
      totalText: String(data.totalText || '').trim().slice(0, 100),
      status: String(data.status || 'unknown').trim().slice(0, 40),
      itemCount: items.length,
      items,
    };
  }));

  requests.sort((a, b) => a.requestedAtMs - b.requestedAtMs || a.id.localeCompare(b.id));
  requests.forEach((order, index) => { order.orderNumber = index + 1; });
  return requests.slice(-ORDER_HISTORY_LIMIT).reverse();
}

function validatedArchiveId(value, fieldName) {
  const id = String(value || '').trim();
  if (!ORDER_ID_PATTERN.test(id)) {
    throw new HttpsError('invalid-argument', `Invalid ${fieldName}.`);
  }
  return id;
}

async function createArchivedOrderItemLink(uid, orderIdValue, itemIdValue) {
  const orderId = validatedArchiveId(orderIdValue, 'order id');
  const itemId = validatedArchiveId(itemIdValue, 'order item id');
  const requestRef = getFirestore()
    .collection(QUOTATIONS_COLLECTION)
    .doc(uid)
    .collection('requests')
    .doc(orderId);
  const [requestSnapshot, itemSnapshot] = await Promise.all([
    requestRef.get(),
    requestRef.collection('items').doc(itemId).get(),
  ]);
  if (!requestSnapshot.exists || !itemSnapshot.exists) {
    throw new HttpsError('not-found', 'This order item no longer exists.');
  }

  const requestData = requestSnapshot.data() || {};
  const itemData = itemSnapshot.data() || {};
  const productId = String(itemData.productId || '').trim().toLowerCase();
  const stateJson = String(itemData.configurationState || '');
  if (!PRODUCT_SET.has(productId) || !stateJson) {
    throw new HttpsError('failed-precondition', 'The archived configuration is not available.');
  }
  const sizeBytes = Buffer.byteLength(stateJson, 'utf8');
  if (sizeBytes <= 0 || sizeBytes > MAX_SINGLE_SHARE_BYTES) {
    throw new HttpsError('failed-precondition', 'The archived configuration is too large to open.');
  }

  const localeCandidate = String(requestData.locale || '').trim();
  const locale = LOCALES.has(localeCandidate) ? localeCandidate : 'en-US';
  const tenantCandidate = String(requestData.tenantSlug || '').trim().toLowerCase();
  const tenantSlug = TENANT_SLUG_PATTERN.test(tenantCandidate) ? tenantCandidate : '';
  const originalValue = Number(itemData.originalValue);
  const originalCurrency = String(itemData.originalCurrency || requestData.currency || 'EUR').trim().toUpperCase();
  const prepared = await createQuotationGuestShares([{
    key: String(itemData.cartItemId || itemId),
    productId,
    name: String(itemData.name || `${productId} configuration`).trim().slice(0, 120),
    amount: Number.isFinite(originalValue) ? originalValue : 0,
    currency: CURRENCIES.has(originalCurrency) ? originalCurrency : 'EUR',
    stateJson,
    createdAtMs: itemData.cartCreatedAt?.toMillis?.() || 0,
  }], locale, tenantSlug);

  const item = prepared.items[0];
  if (!item?.link) throw new HttpsError('unavailable', 'The configuration link could not be prepared.');
  return {
    url: item.link,
    productId,
    orderId,
    itemId,
  };
}

async function sendQuotationEmail({ locale, currency, items, brand, presentation = null }) {
  const emailPresentation = presentation || quotationPresentation(items, locale, currency);
  const subject = `${emailPresentation.copy.subject} — ${brand.companyName}`;
  const text = quotationText({ ...emailPresentation, currency, brand });
  const html = quotationHtml({ ...emailPresentation, currency, brand });
  const accessToken = await delegatedGmailAccessToken();

  let sender = QUOTATION_FROM;
  let response = await gmailSendRaw(accessToken, encodeMimeMessage({
    from: sender,
    to: TEST_QUOTATION_RECIPIENT,
    replyTo: brand.contactEmail,
    subject,
    text,
    html,
  }));
  if (response.status === 400) {
    sender = QUOTATION_FALLBACK_FROM;
    response = await gmailSendRaw(accessToken, encodeMimeMessage({
      from: sender,
      to: TEST_QUOTATION_RECIPIENT,
      replyTo: brand.contactEmail,
      subject,
      text,
      html,
    }));
  }
  if (!response.ok) {
    logger.error('Gmail API rejected a quotation email.', {
      event: 'quotation-email-provider-error',
      providerStatus: response.status,
      recipientDomain: TEST_QUOTATION_RECIPIENT.split('@')[1],
      locale,
      currency,
    });
    throw new HttpsError('unavailable', 'The quotation email could not be sent. Please try again.');
  }
  return emailPresentation;
}

exports.requestCartQuotation = onCall(
  {
    region: FUNCTION_REGION,
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
    cors: [
      ...PUBLIC_ORIGINS,
      DEVELOPMENT_ORIGIN,
      TENANT_ORIGIN,
    ],
    enforceAppCheck: false,
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    const uid = requireUid(request);
    const action = String(request.data?.action || 'submit').trim().toLowerCase();

    if (action === 'list-orders') {
      await quotationScope(request);
      return { orders: await listArchivedOrders(uid) };
    }

    if (action === 'view-order-item') {
      await quotationScope(request);
      return createArchivedOrderItemLink(uid, request.data?.orderId, request.data?.itemId);
    }

    const userEmail = String(request.auth?.token?.email || '').trim().slice(0, 320);
    const userName = String(request.auth?.token?.name || request.auth?.token?.display_name || '').trim().slice(0, 120);
    const locale = normalizeLocale(request.data?.locale);
    const currency = normalizeCurrency(request.data?.currency);
    const { tenantSlug, origin } = await quotationScope(request);
    const cart = await readCart(uid, tenantSlug);
    if (!cart.length) throw new HttpsError('failed-precondition', 'The shopping cart is empty.');

    // Enforce the 30-second account cooldown before creating any temporary
    // quotation links. The backend reads immutable shoppingCart snapshots so a
    // single click remains a single, server-owned quotation operation.
    await enforceQuotationRateLimit(uid);
    const prepared = await createQuotationGuestShares(cart, locale, tenantSlug);
    const brand = await quotationBrandingForScope({ tenantSlug, origin });
    const presentation = quotationPresentation(prepared.items, locale, currency);
    let archive;
    try {
      archive = await stageQuotationArchive({
        uid,
        userEmail,
        userName,
        tenantSlug,
        origin,
        locale,
        currency,
        items: prepared.items,
        presentation,
      });
      await sendQuotationEmail({ locale, currency, items: prepared.items, brand, presentation });
    } catch (error) {
      // Failed requests should not leave quotation-only shares or a staged
      // quotation record behind.
      await deleteQuotationShares(prepared.shareIds);
      if (archive) await discardQuotationArchive(archive).catch(() => {});
      throw error;
    }

    // Gmail has accepted the message. Finalize the Firestore archive afterward;
    // if this last metadata update is transiently unavailable, the full staged
    // request and item snapshots still remain recorded with status "sending".
    await finalizeQuotationArchive(archive);

    logger.info('Quotation email accepted by provider.', {
      event: 'quotation-email-accepted',
      uid,
      tenantSlug: tenantSlug || null,
      origin,
      itemCount: prepared.items.length,
      locale,
      currency,
      recipientDomain: TEST_QUOTATION_RECIPIENT.split('@')[1],
      quotationId: archive.quotationId,
    });

    return {
      success: true,
      delivered: true,
      itemCount: prepared.items.length,
      currency,
      totalText: presentation.totalText,
      quotationId: archive.quotationId,
    };
  },
);
