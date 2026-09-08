import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = new Map([
  ['firebase-share-backend/functions/sales-dashboard.js', [
    'office@360design.ro',
    'alexandru.alexe@360design.ro',
    'vlamogusamogus@gmail.com',
    'exports.getSalesDashboardUsers = onCall(',
    'exports.getSalesDashboardUserDetails = onCall(',
    'exports.getSalesDashboardDemoRequests = onCall(',
    'exports.createSalesDashboardConfigurationLink = onCall(',
    'exports.attachDemoRequestUser = onCall(',
    "source: 'sales-dashboard'",
  ]],
  ['firebase-share-backend/functions/entry.js', ["...require('./sales-dashboard.js')"]],
  ['shared-ui/admin/sales-dashboard/index.html', ['Sales dashboard', 'Requested demos', 'Shopping cart']],
  ['shared-ui/src/salesDashboard.js', ['getSalesDashboardUsers', 'getSalesDashboardUserDetails', 'getSalesDashboardDemoRequests', 'createSalesDashboardConfigurationLink']],
  ['cloudrun/nginx.conf', ['/shared-ui/admin/sales-dashboard/index.html', 'location = /dashboard/']],
  ['website/components/demo-request-form.tsx', ['attachDemoRequestUser', 'attachLoggedInUser', 'SHARED_AUTH_MODULE_URL']],
  ['.github/workflows/deploy-firebase-share.yml', ['functions:getSalesDashboardUsers', 'functions:attachDemoRequestUser', 'validate_sales_dashboard.mjs']],
]);

let failed = false;
for (const [relative, needles] of checks) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename)) {
    console.error(`Missing sales dashboard file: ${relative}`);
    failed = true;
    continue;
  }
  const source = fs.readFileSync(filename, 'utf8');
  for (const needle of needles) {
    if (!source.includes(needle)) {
      console.error(`Missing token in ${relative}: ${needle}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('Internal sales dashboard integration OK.');
