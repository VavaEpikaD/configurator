import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const checks = [
  ['firebase-share-backend/functions/index.js', [
    "go_live_now_1",
    "go_live_now_3",
    "go_live_now_all",
    'TENANT_PLAN_CATALOG',
    'maxConfigurators: 1',
    'maxConfigurators: 3',
    'maxConfigurators: 7',
    "TENANT_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'suspended', 'cancelled'])",
    'defaultTenantSubscription(now)',
    'validateConfiguratorsForPlan',
    'planId,',
    'subscription,',
    'exports.getTenantPlans = onCall(',
    'exports.setTenantSubscriptionState = onCall(',
    'tenantRuntimeStatusForSubscription',
    'validateTenantSubscriptionTransition',
    "provider: 'manual'",
    "cancelAtPeriodEnd: false",
  ]],
  ['shared-ui/admin/tenant-provisioning/index.html', [
    'id="createPlan"',
    'id="managePlan"',
    'Subscription state',
    'id="manageSubscriptionStatus"',
    'id="manageCancelAtPeriodEnd"',
    'id="saveSubscriptionButton"',
    'tenantProvisioningAdmin.js?v=',
  ]],
  ['shared-ui/src/tenantProvisioningAdmin.js', [
    'getTenantPlans',
    'setTenantSubscriptionState',
    'validatePlanConfiguratorSelection',
    'planId,',
    'manageSubscriptionStatus',
    'cancelAtPeriodEnd',
    'applySubscriptionState',
  ]],
  ['.github/workflows/deploy-firebase-share.yml', [
    'Validate Tier-1 plan and subscription model',
    'functions:getTenantPlans',
    'functions:setTenantSubscriptionState',
  ]],
  ['package.json', [
    'check:tenant-subscription',
    'validate_tenant_subscription_model.mjs',
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
const publicCreate = functions.match(/transaction\.create\(publicRef, \{([\s\S]*?)\n      \}\);/);
if (publicCreate && /\n\s*subscription\s*:|\n\s*subscription\s*,/.test(publicCreate[1])) {
  failures.push('Private subscription details must not be copied into tenantPublic.');
}
if (!functions.includes("TENANT_ACCESSIBLE_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due'])")) {
  failures.push('Trialing/active/past_due must remain the accessible subscription states.');
}

if (failures.length) {
  console.error('Tenant plan/subscription validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Tenant plan/subscription validation passed.');
