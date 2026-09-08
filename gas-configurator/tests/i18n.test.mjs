import assert from 'node:assert/strict';
import test from 'node:test';
import { gasT } from '../src/i18n.js';
import { renderGasLayout } from '../src/ui/layout.js';

const LOCALES = ['en-US', 'ro-RO', 'de-DE'];

function layoutTranslationKeys() {
  const root = { innerHTML: '' };
  renderGasLayout(root);
  return [...root.innerHTML.matchAll(/data-gas-i18n(?:-title|-aria-label)?="([^"]+)"/g)]
    .map((match) => match[1]);
}

test('every translation key rendered by the gas layout exists in every supported locale', () => {
  const keys = [...new Set(layoutTranslationKeys())];
  assert.ok(keys.length > 100);
  LOCALES.forEach((locale) => {
    const missing = keys.filter((key) => gasT(locale, key) === key);
    assert.deepEqual(missing, [], `${locale} is missing: ${missing.join(', ')}`);
  });
});

test('dynamic catalogue, obstacle and route-event labels exist in every supported locale', () => {
  const keys = [
    'pipeCatalog.pressureLimit',
    'routeEvent.confirmed',
    'routeEvent.needsConfirmation',
    'routeEvent.alreadyAdded',
    'action.addDetectedCrossing',
    'option.routeEventType.utilityCrossing',
    'option.routeEventType.roadCrossing',
    'option.routeEventType.railwayCrossing',
    'option.routeEventType.watercourseCrossing',
    'option.routeEventSource.manual',
    'option.routeEventSource.publicScreening',
    'option.routeEventSource.ownerPlan',
    'option.routeEventSource.fieldVerified',
    'option.installationMethod.notSpecified',
    'option.installationMethod.openTrench',
    'option.installationMethod.trenchless',
    'obstacle.status.disabled',
    'obstacle.status.idle',
    'obstacle.status.loading',
    'obstacle.status.ready',
    'obstacle.status.error',
    'option.depthPointSource.default',
    'option.depthPointSource.manual',
    'option.depthPointSource.surveyed',
    'depthProfile.zoneStatus.ready',
    'depthProfile.zoneStatus.missing',
    'depthProfile.zoneStatus.partial',
    'depthProfile.zoneStatus.stale',
    'depthProfile.zoneStatus.missing-width',
    'depthProfile.zoneRole.entry',
    'depthProfile.zoneRole.center',
    'depthProfile.zoneRole.exit',
    'depthProfile.warning.duplicates',
    'depthProfile.warning.abrupt',
    'depthProfile.warning.missingZones',
    'depthProfile.warning.fallbackTerrain',
    'validation.depthProfile.title',
    'validation.depthProfile.duplicates',
    'validation.depthProfile.abrupt',
    'validation.depthProfile.crossingMissing',
    'validation.depthProfile.crossingStale',
    'validation.depthProfile.pass',
  ];
  LOCALES.forEach((locale) => {
    const missing = keys.filter((key) => gasT(locale, key) === key);
    assert.deepEqual(missing, [], `${locale} is missing: ${missing.join(', ')}`);
  });
});
