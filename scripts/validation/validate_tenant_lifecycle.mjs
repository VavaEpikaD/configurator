import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const checks = [
  ['firebase-share-backend/functions/index.js', [
    'exports.listTenants = onCall(',
    'exports.getTenant = onCall(',
    'exports.updateTenant = onCall(',
    "TENANT_STATUSES = new Set(['active', 'suspended'])",
    'exports.setTenantSubscriptionState = onCall(',
    'transaction.update(privateRef',
    'transaction.update(publicRef, synchronizedFields)',
    "data.plan !== TENANT_PLAN_GO_LIVE_NOW",
    "logoMode === 'remove'",
    "logoMode === 'replace'",
    'lastUpdatedByUid: admin.uid',
  ]],
  ['shared-ui/admin/tenant-provisioning/index.html', [
    'Tier-1 tenant administration',
    'Manage tenants',
    'tenantEditorForm',
    'tenantStatusButton',
    'tenantProvisioningAdmin.js?v=',
  ]],
  ['shared-ui/src/tenantProvisioningAdmin.js', [
    'cloudfunctions.net',
    'listTenants',
    'getTenant',
    'updateTenant',
    "nextStatus === 'suspended'",
    'setTenantSubscriptionState',
    'No data will be deleted.',
    "logoMode = 'remove'",
    "logoMode = 'replace'",
  ]],
  ['.github/workflows/deploy-firebase-share.yml', [
    'Validate Tier-1 tenant lifecycle administration',
    'functions:listTenants',
    'functions:getTenant',
    'functions:updateTenant',
  ]],
  ['package.json', [
    'check:tenant-lifecycle',
    'validate_tenant_lifecycle.mjs',
  ]],
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

const functions = read('firebase-share-backend/functions/index.js');
if (functions.includes('transaction.delete(privateRef)') || functions.includes('transaction.delete(publicRef)')) {
  failures.push('Normal tenant lifecycle administration must not hard-delete tenant documents.');
}
if (!functions.includes('const expectedDomain = `${slug}.360configurator.com`;')) {
  failures.push('Tenant update must preserve the immutable slug-derived customer domain.');
}

if (failures.length) {
  console.error('Tenant lifecycle validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Tenant lifecycle validation passed.');
