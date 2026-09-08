import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const checks = [
  ['firebase-share-backend/functions/index.js', [
    "TENANT_AUDIT_COLLECTION = 'tenantAuditLogs'",
    'function createTenantAuditPayload',
    'async function tenantAuditEventsForTenant',
    "type: 'tenant_created'",
    "type: 'dashboard_owner_claimed'",
    "type: 'tenant_dashboard_updated'",
    "type: 'tenant_admin_updated'",
    "type: 'subscription_state_changed'",
    'includeDetails: false',
    'includeDetails: true',
  ]],
  ['firebase-share-backend/firestore.rules', [
    'match /tenantAuditLogs/{tenantSlug}/{document=**}',
    'allow read, write: if false;',
  ]],
  ['shared-ui/tenant-dashboard/index.html', [
    'id="activityList"',
    'id="activityEmpty"',
    'tenantDashboard.js?v=',
    'tenantDashboard.css?v=4',
  ]],
  ['shared-ui/src/tenantDashboard.js', [
    'function renderActivityLog',
    'renderActivityLog(data.auditEvents)',
    "admin: '360Configurator admin'",
  ]],
  ['shared-ui/admin/tenant-provisioning/index.html', [
    'id="manageActivityList"',
    'id="manageActivityEmpty"',
    'tenantProvisioningAdmin.js?v=',
  ]],
  ['shared-ui/src/tenantProvisioningAdmin.js', [
    'function populateTenantActivity',
    'populateTenantActivity(tenant)',
    'event?.details?.changes',
  ]],
  ['.github/workflows/deploy-firebase-share.yml', [
    'Validate Tier-1 tenant audit log',
    'validate_tenant_audit_log.mjs',
  ]],
  ['package.json', [
    'check:tenant-audit',
    'validate_tenant_audit_log.mjs',
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
const dashboardViewStart = functions.indexOf('function tenantDashboardViewFromSnapshot');
const dashboardViewEnd = functions.indexOf('// ---------------------------------------------------------------------------\n// Private per-user saved configurations', dashboardViewStart);
const dashboardView = functions.slice(dashboardViewStart, dashboardViewEnd);
if (/actorEmail|details/.test(dashboardView)) {
  failures.push('Tenant dashboard view must not expose audit actor email addresses or internal event details.');
}
if (!functions.includes("result.actorEmail = String(data.actorEmail || '')")) {
  failures.push('Internal audit view must preserve actor email for administrators.');
}
if (!functions.includes('transaction.create(auditRef, createTenantAuditPayload')) {
  failures.push('Tenant changes must append audit events within the same Firestore transaction.');
}

if (failures.length) {
  console.error('Tenant audit-log validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Tenant audit-log validation passed.');
