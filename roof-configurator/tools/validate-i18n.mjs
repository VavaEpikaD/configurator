import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const roofRoot = path.join(root, 'roof-configurator');

const i18n = await import(`${pathToFileURL(path.join(roofRoot, 'js', 'i18n.js')).href}?validate=${Date.now()}`);
const locales = ['en-US', 'ro-RO', 'de-DE'];
const failures = [];

const keySets = locales.map((locale) => new Set(Object.keys(i18n.getRoofMessages(locale))));
const referenceKeys = [...keySets[0]].sort();
for (let index = 1; index < locales.length; index += 1) {
  const missing = referenceKeys.filter((key) => !keySets[index].has(key));
  const extra = [...keySets[index]].filter((key) => !keySets[0].has(key));
  if (missing.length) failures.push(`${locales[index]} missing keys: ${missing.join(', ')}`);
  if (extra.length) failures.push(`${locales[index]} extra keys: ${extra.join(', ')}`);
}

for (const locale of locales) {
  const components = i18n.getRainwaterComponents(locale);
  if (components.length !== 21) failures.push(`${locale} must define 21 rainwater components; got ${components.length}`);
  components.forEach((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2 || entry.some((value) => !String(value).trim())) {
      failures.push(`${locale} rainwater component ${index + 1} is incomplete`);
    }
  });

  for (const type of ['gable', 'hip', 'shed', 'lshape', 'dormer', 'custom']) {
    if (i18n.roofName(locale, type).startsWith('roof.name.')) failures.push(`${locale} missing roof name for ${type}`);
  }
  for (const covering of ['generic', 'roca', 'teclado']) {
    if (i18n.pitchRuleText(locale, covering).startsWith('covering.rule.')) failures.push(`${locale} missing pitch rule for ${covering}`);
  }
}

const sharedConfig = await import(`${pathToFileURL(path.join(root, 'shared-ui', 'src', 'config.js')).href}?validate=${Date.now()}`);
const expectedPaths = {
  'en-US': '/roof-configurator/',
  'ro-RO': '/configurator-acoperis/',
  'de-DE': '/dach-konfigurator/',
};
for (const [locale, expected] of Object.entries(expectedPaths)) {
  const actual = sharedConfig.CONFIGURATOR_PUBLIC_PATHS?.[locale]?.roof;
  if (actual !== expected) failures.push(`${locale} roof path expected ${expected}, got ${actual}`);
}

const files = {
  ui: fs.readFileSync(path.join(roofRoot, 'js', 'ui.js'), 'utf8'),
  bom: fs.readFileSync(path.join(roofRoot, 'js', 'bom.js'), 'utf8'),
  shell: fs.readFileSync(path.join(roofRoot, 'js', 'sharedShell.js'), 'utf8'),
  app: fs.readFileSync(path.join(roofRoot, 'js', 'app.js'), 'utf8'),
  scene: fs.readFileSync(path.join(roofRoot, 'js', 'scene.js'), 'utf8'),
  index: fs.readFileSync(path.join(roofRoot, 'index.html'), 'utf8'),
};

const guards = [
  [files.ui, "'Awaiting plan'", 'ui.js hard-codes Awaiting plan'],
  [files.ui, 'No BOM generated', 'ui.js hard-codes No BOM generated'],
  [files.ui, 'Plan status', 'ui.js hard-codes Plan status'],
  [files.ui, 'items included', 'ui.js hard-codes BOM selection status'],
  [files.shell, 'Reset the roof to its starting configuration?', 'sharedShell.js hard-codes reset confirmation'],
  [files.shell, "'Rainwater components'", 'sharedShell.js hard-codes rainwater tool label'],
  [files.shell, "'Hide compass'", 'sharedShell.js hard-codes compass tooltip'],
  [files.bom, 'Țiglă metalică', 'bom.js contains Romanian product copy instead of dictionary keys'],
  [files.bom, 'Denumire', 'bom.js contains Romanian CSV header instead of dictionary keys'],
  [files.scene, "createCompassLabel('E'", 'scene.js hard-codes compass east label'],
];
for (const [source, needle, message] of guards) {
  if (source.includes(needle)) failures.push(message);
}

const sharedShell = fs.readFileSync(path.join(root, 'shared-ui', 'src', 'standaloneShell.js'), 'utf8');
if (sharedShell.includes('getLanguageSwitchTarget(')) {
  failures.push('Shared UI still performs cross-domain language switching');
}
if (!sharedShell.includes("callbacks.onPreferenceChange?.('locale'")) {
  failures.push('Shared UI does not own in-place locale switching');
}
if (files.shell.includes('getLocalizedConfiguratorUrl(nextLocale')) {
  failures.push('Roof duplicates language switching instead of using the shared shell');
}
if (!files.app.includes('state.locale = resolveRoofLocale')) failures.push('app.js does not initialize locale from the shared shell/domain');
if (!files.scene.includes('scene.setLocale') && !files.app.includes('scene.setLocale')) failures.push('Roof scene compass locale is not synchronized');
if (!files.index.includes('./js/sharedShell.js?v=40') || !files.index.includes('./js/app.js?v=62')) {
  failures.push('Roof entrypoint cache-busting versions were not updated for the i18n release');
}

if (failures.length) {
  console.error('Roof i18n validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Roof i18n validated for ${locales.join(', ')}: ${referenceKeys.length} message keys, 21 rainwater parts per locale, localized BOM/CSV, compass, tools, and in-place language switching.`);
}
