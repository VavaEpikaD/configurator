export const LANGUAGE_PROFILES = Object.freeze({
  'en-US': {
    label: 'English (US)',
    nativeName: 'English (US)',
    flag: '🇺🇸',
    searchTerms: 'english united states usa',
    units: 'imperial',
    currency: 'USD',
  },
  'ro-RO': {
    label: 'Romanian',
    nativeName: 'Română',
    flag: '🇷🇴',
    searchTerms: 'română romania romanian',
    units: 'metric',
    currency: 'RON',
  },
  'de-DE': {
    label: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    searchTerms: 'deutsch deutschland german germany',
    units: 'metric',
    currency: 'EUR',
  },
});

export const LOCALE_HOSTS = Object.freeze({
  'en-US': 'www.360configurator.com',
  'ro-RO': 'www.360configurator.ro',
  'de-DE': 'www.360konfigurator.de',
});

export const CONFIGURATOR_PUBLIC_PATHS = Object.freeze({
  'en-US': Object.freeze({
    pergola: '/pergola-configurator/',
    roof: '/roof-configurator/',
    window: '/window-configurator/',
    hall: '/hall-configurator/',
    solar: '/solar-configurator/',
    fence: '/fence-configurator/',
    cardbox: '/cardbox-configurator/',
    bookshelf: '/bookshelf-configurator/',
  }),
  'ro-RO': Object.freeze({
    pergola: '/configurator-pergola/',
    roof: '/configurator-acoperis/',
    window: '/configurator-ferestre/',
    hall: '/configurator-hala/',
    solar: '/configurator-solar/',
    fence: '/configurator-garduri/',
    cardbox: '/configurator-cutii-carton/',
    bookshelf: '/bookshelf-configurator/',
  }),
  'de-DE': Object.freeze({
    pergola: '/pergola-konfigurator/',
    roof: '/dach-konfigurator/',
    window: '/fenster-konfigurator/',
    hall: '/hallen-konfigurator/',
    solar: '/solar-konfigurator/',
    fence: '/zaun-konfigurator/',
    cardbox: '/karton-konfigurator/',
    bookshelf: '/bookshelf-configurator/',
  }),
});

export const UNIT_OPTIONS = Object.freeze([
  { value: 'imperial', label: 'Imperial (ft / in)' },
  { value: 'metric', label: 'Metric (mm)' },
]);

export const CURRENCY_OPTIONS = Object.freeze([
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'RON', label: 'Romanian Leu (RON)' },
  { value: 'EUR', label: 'Euro (EUR)' },
]);

export const QUALITY_OPTIONS = Object.freeze([
  { value: 'low', label: 'Low' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high', label: 'High' },
]);

export const AR_PLATFORM_OPTIONS = Object.freeze([
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
]);

export function getLanguageProfile(locale) {
  return LANGUAGE_PROFILES[locale] ?? LANGUAGE_PROFILES['en-US'];
}

export function getLocaleForHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/\.$/, '');
  if (normalized === '360configurator.ro' || normalized === 'www.360configurator.ro') return 'ro-RO';
  if (normalized === '360konfigurator.de' || normalized === 'www.360konfigurator.de') return 'de-DE';
  return 'en-US';
}

function normalizeProductType(productType = '') {
  const value = String(productType).toLowerCase();
  if (value.includes('pergola')) return 'pergola';
  if (value.includes('roof')) return 'roof';
  if (value.includes('window')) return 'window';
  if (value.includes('hall')) return 'hall';
  if (value.includes('solar')) return 'solar';
  if (value.includes('fence') || value.includes('gard') || value.includes('zaun')) return 'fence';
  if (value.includes('cardbox') || value.includes('cardboard') || value.includes('carton') || value.includes('karton')) return 'cardbox';
  if (value.includes('bookshelf') || value.includes('bibliotec') || value.includes('bücherregal') || value.includes('buecherregal')) return 'bookshelf';
  return null;
}

export function getLocalizedConfiguratorUrl(locale, productType, location = window.location) {
  const resolvedLocale = LANGUAGE_PROFILES[locale] ? locale : 'en-US';
  const product = normalizeProductType(productType);
  const path = product ? CONFIGURATOR_PUBLIC_PATHS[resolvedLocale]?.[product] : location.pathname;
  if (!path) return null;
  const url = new URL(`https://${LOCALE_HOSTS[resolvedLocale]}${path}`);
  url.search = location.search || '';
  url.hash = location.hash || '';
  return url.href;
}
