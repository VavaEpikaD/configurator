import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const checks = [
  ['firebase-share-backend/functions/index.js', [
    "TENANT_PLAN_CHANGE_SCHEMA_VERSION = 1",
    "TENANT_PLAN_CHANGE_STATUS_PENDING = 'pending'",
    'shortName:',
    'description:',
    'features: Object.freeze([',
    'recommended: true',
    'annualPriceCents: null',
    'function normalizedTenantPendingPlanChange',
    'function tenantPendingPlanChangeView',
    'function createTenantPendingPlanChange',
    "type: 'plan_change_requested'",
    "type: 'plan_change_cancelled'",
    "type: 'plan_change_approved'",
    "type: 'plan_change_rejected'",
    'exports.cancelTenantPlanChange = onCall(',
    'exports.resolveTenantPlanChange = onCall(',
    'exports.getPublicTenantPlans = onCall(',
    'pendingPlanChange: tenantPendingPlanChangeView(data.pendingPlanChange)',
    'pendingPlanChange: tenantPendingPlanChangeView(data.pendingPlanChange, { includeActor: true })',
  ]],
  ['shared-ui/tenant-dashboard/index.html', [
    'id="pendingPlanCard"',
    'id="cancelPlanChangeButton"',
    'tenantDashboard.js?v=',
    'tenantDashboard.css?v=4',
  ]],
  ['shared-ui/src/tenantDashboard.js', [
    'cancelTenantPlanChange',
    'pendingPlanChange',
    'Pending confirmation',
    'Plan change request cancelled.',
  ]],
  ['shared-ui/admin/tenant-provisioning/index.html', [
    'id="managePendingPlanFieldset"',
    'id="approvePlanChangeButton"',
    'id="rejectPlanChangeButton"',
    'tenantProvisioningAdmin.js?v=',
    'tenantProvisioningAdmin.css?v=8',
  ]],
  ['shared-ui/src/tenantProvisioningAdmin.js', [
    'resolveTenantPlanChange',
    'resolvePendingPlanChange',
    'Pending:',
  ]],
  ['.github/workflows/deploy-firebase-share.yml', [
    'Validate Tier-1 plan-change workflow',
    'functions:getPublicTenantPlans',
    'functions:resolveTenantPlanChange',
    'functions:cancelTenantPlanChange',
  ]],
  ['package.json', [
    'check:tenant-plan-changes',
    'validate_tenant_plan_changes.mjs',
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
const dashboardUpdateStart = functions.indexOf('exports.updateTenantDashboard = onCall(');
const dashboardUpdateEnd = functions.indexOf('exports.cancelTenantPlanChange = onCall(', dashboardUpdateStart);
const dashboardUpdate = functions.slice(dashboardUpdateStart, dashboardUpdateEnd);
if (!dashboardUpdate.includes('const isPlanChangeRequest = requestedPlanId !== currentPlanId;')) {
  failures.push('Dashboard updates must distinguish current settings from plan-change requests.');
}
if (!dashboardUpdate.includes('const configurators = isPlanChangeRequest\n        ? existingConfigurators')) {
  failures.push('A pending plan change must not activate requested configurators before confirmation.');
}
if (!dashboardUpdate.includes('transaction.update(publicRef, synchronizedFields);')) {
  failures.push('Dashboard plan-change requests must update tenantPublic only through synchronized current-tenant fields.');
}

if (failures.length) {
  console.error('Tenant plan-change validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Tier-1 plan-change workflow validation passed.');
