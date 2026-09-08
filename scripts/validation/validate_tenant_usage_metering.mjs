import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const checks = [
  ['solar-google-api/src/tenantUsage.mjs', [
    "const TENANT_USAGE_COLLECTION = 'tenantUsage'",
    'export async function resolveSolarRequestContext(request)',
    'const RESERVED_PLATFORM_SUBDOMAINS = new Set([',
    "'www'",
    "'aks'",
    'RESERVED_PLATFORM_SUBDOMAINS.has(slug)',
    'configurators.solar !== true',
    'export async function consumeTenantSolarMetric',
    'class TenantUsageQuotaError',
    "analysesPerMonth: normalizeLimit(source.analysesPerMonth)",
    "dataLayersPerMonth: normalizeLimit(source.dataLayersPerMonth)",
  ]],
  ['solar-google-api/src/googleSolarHandler.mjs', [
    "consumeTenantSolarMetric(usageContext, 'analyses')",
    "consumeTenantSolarMetric(usageContext, 'buildingInsights')",
    "consumeTenantSolarMetric(usageContext, 'dataLayers')",
    'resolveSolarRequestContext(request)',
    'quotaErrorPayload(error)',
  ]],
  ['solar-google-api/src/pvgisHandler.mjs', [
    "consumeTenantSolarMetric(usageContext, 'pvgis')",
    "consumeTenantSolarMetric(usageContext, 'pvgisUpstream', 1, { enforceLimit: false })",
    'resolveSolarRequestContext(request)',
  ]],
  ['firebase-share-backend/functions/index.js', [
    "const TENANT_USAGE_COLLECTION = 'tenantUsage'",
    'DEFAULT_SOLAR_USAGE_LIMITS',
    'normalizedSolarUsageLimits',
    'tenantUsageForMonth',
    'solarUsageLimits: { ...plan.solarUsageLimits }',
    "hasOwn('solarUsageLimits')",
    '[result.usage, result.analytics, result.auditEvents] = await Promise.all([',
    'tenantUsageForMonth(slug)',
  ]],
  ['firebase-share-backend/firestore.rules', [
    'match /tenantUsage/{tenantSlug}/months/{month}',
    'allow read, write: if false;',
  ]],
  ['shared-ui/admin/tenant-provisioning/index.html', [
    'Solar monthly usage limits',
    'manageSolarAnalysesLimit',
    'manageSolarBuildingInsightsLimit',
    'manageSolarDataLayersLimit',
    'manageSolarPvgisLimit',
    'manageUsageDataLayers',
    'tenantProvisioningAdmin.js?v=',
  ]],
  ['shared-ui/src/tenantProvisioningAdmin.js', [
    'currentSolarUsageLimitsFromForm',
    'populateSolarUsage(tenant)',
    'solarUsageLimits,',
    'usageValueWithLimit',
  ]],
  ['solar-configurator/js/googleSolar.js', ['}, 240000);', 'Google Solar analysis timed out after']],
  ['solar-configurator/js/app.js', ["from './googleSolar.js?v=8';"]],
  ['solar-google-api/package.json', ['node --check src/tenantUsage.mjs']],
  ['package.json', ['check:tenant-usage', 'validate_tenant_usage_metering.mjs']],
];

const failures = [];
for (const [relativePath, needles] of checks) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${relativePath}: missing file`);
    continue;
  }
  const content = read(relativePath);
  for (const needle of needles) {
    if (!content.includes(needle)) failures.push(`${relativePath}: missing ${JSON.stringify(needle)}`);
  }
}

const solarIndex = read('solar-configurator/index.html');
if (!/<script\s+type=["']module["']\s+src=["']\.\/js\/app\.js\?v=\d+["']><\/script>/.test(solarIndex)) {
  failures.push('solar-configurator/index.html: missing versioned ./js/app.js module script');
}

const usageModule = read('solar-google-api/src/tenantUsage.mjs');
if (!usageModule.includes('if (!Number.isFinite(number) || number <= 0) return 0;')) {
  failures.push('Zero must remain the unlimited/default tenant quota value.');
}
const rules = read('firebase-share-backend/firestore.rules');
if (!/match \/tenantUsage\/\{tenantSlug\}\/months\/\{month\}[\s\S]*?allow read, write: if false;/.test(rules)) {
  failures.push('Tenant usage telemetry must remain inaccessible to browser Firestore clients.');
}

if (failures.length) {
  console.error('Tenant usage metering validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Tenant usage metering validation passed.');
