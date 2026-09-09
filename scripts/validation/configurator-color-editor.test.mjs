// Run from the repository root: node --test scripts/validation/configurator-color-editor.test.mjs
// No Firebase credentials/network/dependencies: exercise real handlers with in-memory adapters.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const source = await read('firebase-share-backend/functions/configurator-colors.js');
const defaults = JSON.parse(await read('firebase-share-backend/functions/window-color-defaults.json'));
const loaderSource = await read('window-configurator/src/client/js/finish-catalog-loader.js');
const { mergeWindowFinishCatalog, loadWindowFinishCatalog } = await import(`data:text/javascript;base64,${Buffer.from(loaderSource).toString('base64')}`);
const configSource = await read('window-configurator/src/client/js/config.js');
const factoryLiteral = configSource.slice(configSource.indexOf('Object.freeze({', configSource.indexOf('const DEFAULT_ALUMINIUM_FINISH_CATALOG')), configSource.indexOf('\n// Resolve the published'));
const factory = vm.runInNewContext(factoryLiteral.replace(/;\s*$/, ''));

function harness() {
  const docs = new Map();
  const stats = { reads: 0, commits: 0, auth: 0 };
  let authUser = { uid: 'admin-uid', email: 'office@360design.ro', emailVerified: true, disabled: false };
  let authError = null;
  let databaseError = null;
  let failAudit = false;
  let queue = Promise.resolve();
  const snapshot = ref => ({ exists: docs.has(ref.path), data: () => docs.get(ref.path) });
  const document = path => ({
    path,
    get: async () => { stats.reads++; if (databaseError) throw databaseError; return snapshot({ path }); },
    collection: name => ({ doc: id => document(`${path}/${name}/${id}`) }),
  });
  const db = {
    collection: name => ({ doc: id => document(`${name}/${id}`) }),
    runTransaction: callback => {
      const run = queue.then(async () => {
        if (databaseError) throw databaseError;
        const pending = [];
        const result = await callback({
          get: async ref => { stats.reads++; return snapshot(ref); },
          set: (ref, data) => pending.push([ref.path, data]),
          create: (ref, data) => {
            if (failAudit || docs.has(ref.path)) throw new Error('Audit write failed');
            pending.push([ref.path, data]);
          },
        });
        for (const [path, data] of pending) docs.set(path, data);
        stats.commits++;
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const wrap = (options, handler) => Object.assign(handler, { options });
  const modules = {
    'firebase-functions/v2/https': { HttpsError, onCall: wrap, onRequest: wrap },
    'firebase-admin/auth': { getAuth: () => ({ getUser: async () => { stats.auth++; if (authError) throw authError; return authUser; } }) },
    'firebase-admin/firestore': { getFirestore: () => db, Timestamp: { now: () => ({ toMillis: () => 1788945000000 }) } },
    './window-color-defaults.json': copy(defaults),
  };
  const mod = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + source + '\n})', { console: { error() {} } })(
    id => { assert.ok(modules[id], `Unexpected dependency: ${id}`); return modules[id]; }, mod, mod.exports,
  );
  const request = (data = { configuratorId: 'window' }, overrides = {}) => ({
    data, auth: { uid: 'admin-uid', token: { auth_time: 1788940000 } },
    rawRequest: { get: () => 'https://www.360configurator.com' }, ...overrides,
  });
  const save = (groups = copy(defaults), expectedRevision = 0, overrides = {}) => mod.exports.saveConfiguratorColors(request({ configuratorId: 'window', expectedRevision, groups }, overrides));
  const publicGet = async (method = 'GET', query = { configuratorId: 'window' }) => {
    const res = { headers: {}, code: null, body: null,
      set(key, value) { this.headers[key] = value; return this; },
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await mod.exports.getConfiguratorColors({ method, query }, res);
    return res;
  };
  return { ...mod.exports, docs, stats, request, save, publicGet,
    user: value => { authUser = { ...authUser, ...value }; },
    authError: value => { authError = value; },
    databaseError: value => { databaseError = value; },
    failAudit: () => { failAudit = true; },
  };
}
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code);
const palette = (groups = copy(defaults), revision = 1) => ({ schemaVersion: 1, configuratorId: 'window', revision, groups });
const response = data => ({ ok: true, text: async () => JSON.stringify(data) });
const quiet = () => {};

test('backend factory palettes exactly match the window source, including all 21 names, IDs and hex values', () => {
  assert.deepEqual(defaults, copy(Object.fromEntries(Object.entries(factory).map(([id, group]) => [id, group.presets]))));
  assert.equal(Object.values(defaults).flat().length, 21);
});
test('window-only admin response contains its three finish groups and no configurator list', async () => {
  const h = harness();
  const result = await h.getConfiguratorColorEditor(h.request());
  assert.deepEqual(copy(result.groups), defaults);
  assert.equal(result.revision, 0);
  assert.equal(result.configuratorId, 'window');
  assert.equal(Object.hasOwn(result, 'configurators'), false);
  assert.deepEqual(copy(result.finishGroups.map(g => g.id)), ['mill', 'anodized', 'coated']);
});
for (const [label, user] of [
  ['ordinary user', { email: 'customer@example.test' }],
  ['unverified admin email', { emailVerified: false }],
  ['disabled admin', { disabled: true }],
]) {
  test(`${label} cannot read or save editor data, and causes no database access`, async () => {
    const h = harness(); h.user(user);
    await rejectsCode(h.getConfiguratorColorEditor(h.request()), 'permission-denied');
    await rejectsCode(h.save(), 'permission-denied');
    assert.equal(h.stats.reads, 0); assert.equal(h.stats.commits, 0);
  });
}
test('anonymous requests and forged client-side admin flags cannot authorize', async () => {
  const h = harness();
  await rejectsCode(h.getConfiguratorColorEditor(h.request({ configuratorId: 'window', admin: true, email: 'office@360design.ro' }, { auth: null })), 'unauthenticated');
  await rejectsCode(h.save(copy(defaults), 0, { auth: null }), 'unauthenticated');
  h.user({ email: 'customer@example.test' });
  await rejectsCode(h.save(copy(defaults), 0, { auth: { uid: 'ordinary-user', token: { admin: true, email: 'office@360design.ro' } } }), 'permission-denied');
  assert.equal(h.stats.reads, 0);
});
test('unknown/deleted users and revoked sessions cannot use an old editor tab', async () => {
  const h = harness(); h.authError(Object.assign(new Error('deleted'), { code: 'auth/user-not-found' }));
  await rejectsCode(h.save(), 'unauthenticated');
  h.authError(null); h.user({ tokensValidAfterTime: '2026-09-09T09:00:00Z' });
  await rejectsCode(h.save(), 'unauthenticated');
  assert.equal(h.stats.commits, 0);
});
for (const origin of ['', 'https://customer.360configurator.com', 'https://www.360configurator.com.evil.test', 'https://www.360configurator.ro']) {
  test(`admin endpoint rejects non-editor origin ${JSON.stringify(origin)}`, async () => {
    const h = harness();
    await rejectsCode(h.save(copy(defaults), 0, { rawRequest: { get: () => origin } }), 'permission-denied');
    assert.equal(h.stats.auth, 0); assert.equal(h.stats.reads, 0);
  });
}
test('both .com hosts and localhost development are allowed for authenticated admins', async () => {
  for (const origin of ['https://360configurator.com', 'https://www.360configurator.com', 'http://localhost:8080', 'http://127.0.0.1:8123']) {
    const h = harness();
    assert.equal((await h.getConfiguratorColorEditor(h.request(undefined, { rawRequest: { get: () => origin } }))).revision, 0);
  }
});
test('server refuses other configurators, unknown fields, path traversal, and invalid revisions', async () => {
  const h = harness();
  for (const id of ['roof', '../window', '__proto__', '']) {
    await rejectsCode(h.getConfiguratorColorEditor(h.request({ configuratorId: id })), 'invalid-argument');
    await rejectsCode(h.saveConfiguratorColors(h.request({ configuratorId: id, expectedRevision: 0, groups: defaults })), 'invalid-argument');
  }
  await rejectsCode(h.saveConfiguratorColors(h.request({ configuratorId: 'window', expectedRevision: 0, groups: defaults, admin: true })), 'invalid-argument');
  for (const revision of [null, '0', -1, 0.2, Number.MAX_SAFE_INTEGER]) await rejectsCode(h.save(copy(defaults), revision), 'invalid-argument');
  assert.equal(h.stats.reads, 0);
});
for (const [label, mutate] of [
  ['empty group', g => { g.mill = []; }],
  ['missing group', g => { delete g.mill; }],
  ['unknown group', g => { g.extra = []; }],
  ['too many colors', g => { g.coated = Array.from({ length: 101 }, (_, i) => ({ id: `test-${i}`, name: 'Name', color: '#123456' })); }],
  ['duplicate IDs', g => { g.anodized.push(g.anodized[0]); }],
  ['invalid ID', g => { g.mill[0].id = '../evil'; }],
  ['empty name', g => { g.mill[0].name = '  '; }],
  ['long name', g => { g.mill[0].name = 'x'.repeat(121); }],
  ['control character', g => { g.mill[0].name = 'a\u0000b'; }],
  ['invalid hex', g => { g.mill[0].color = 'red'; }],
  ['CSS injection', g => { g.mill[0].color = 'url(https://evil.test)'; }],
  ['extra object fields', g => { g.mill[0].admin = true; }],
]) {
  test(`invalid palette: ${label} is rejected without a database write`, async () => {
    const h = harness(); const groups = copy(defaults); mutate(groups);
    await rejectsCode(h.save(groups), 'invalid-argument'); assert.equal(h.stats.commits, 0); assert.equal(h.stats.reads, 0);
  });
}
test('publish adds/deletes/renames colors, normalizes them, persists across reads and creates private audit history', async () => {
  const h = harness(); const groups = copy(defaults);
  groups.coated.shift();
  groups.coated.push({ id: 'new-blue', name: '  New blue  ', color: '#AABBCC' });
  groups.anodized[0].name = 'My anodized finish';
  const saved = await h.save(groups);
  assert.equal(saved.revision, 1);
  assert.deepEqual(copy(saved.groups.coated.at(-1)), { id: 'new-blue', name: 'New blue', color: '#aabbcc' });
  assert.ok(!saved.groups.coated.some(c => c.id === 'ral-9016'));
  const loaded = await h.getConfiguratorColorEditor(h.request());
  assert.deepEqual(copy(loaded.groups), copy(saved.groups));
  const publicResult = await h.publicGet();
  assert.equal(publicResult.code, 200);
  assert.deepEqual(copy(publicResult.body), copy(saved));
  assert.ok(publicResult.headers['Cache-Control'].includes('no-store'));
  assert.equal(publicResult.body.updatedBy, undefined);
  assert.equal(publicResult.body.history, undefined);
  assert.equal(h.docs.get('configuratorColorPalettes/window/history/1').updatedBy, 'admin-uid');
});
test('stale or simultaneous saves cannot silently overwrite published changes', async () => {
  const h = harness(); const groups = copy(defaults); groups.mill[0].name = 'First save';
  const [a, b] = await Promise.allSettled([h.save(groups, 0), h.save(defaults, 0)]);
  assert.equal(a.status, 'fulfilled'); assert.equal(b.status, 'rejected'); assert.equal(b.reason.code, 'aborted');
  assert.equal((await h.publicGet()).body.groups.mill[0].name, 'First save');
  assert.equal(h.stats.commits, 1);
  assert.equal((await h.save(defaults, 1)).revision, 2);
});
test('audit failure aborts the whole transaction without partially publishing', async () => {
  const h = harness(); h.failAudit(); await assert.rejects(h.save(), /Audit write failed/);
  assert.equal(h.docs.size, 0); assert.equal(h.stats.commits, 0);
});
test('public endpoint works for visitors but never accepts a write or another product', async () => {
  const h = harness(); const result = await h.publicGet();
  assert.equal(result.code, 200); assert.equal(result.body.revision, 0); assert.equal(h.stats.auth, 0);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await h.publicGet(method)).code, 405);
  assert.equal((await h.publicGet('GET', { configuratorId: 'roof' })).code, 400);
  assert.equal(h.stats.commits, 0);
});
test('database outages and corrupt stored data do not falsely return a successful published response', async () => {
  const h = harness(); h.databaseError(new Error('Offline'));
  assert.equal((await h.publicGet()).code, 503);
  await assert.rejects(h.save(), /Offline/);
  h.databaseError(null); h.docs.set('configuratorColorPalettes/window', { schemaVersion: 99, revision: 1 });
  assert.equal((await h.publicGet()).code, 503);
});
test('window loader replaces only presets, preserving finish materials and untouched translations', () => {
  const groups = copy(defaults); groups.coated.shift();
  groups.coated[0].name = 'Custom white'; groups.coated.push({ id: 'custom', name: '<b>Plain text name</b>', color: '#AbCdEf' });
  const result = mergeWindowFinishCatalog(factory, palette(groups));
  assert.equal(result.mill.material, factory.mill.material);
  assert.equal(result.anodized.label, factory.anodized.label);
  assert.equal(result.coated.presets[0].nameOverridden, true);
  assert.equal(result.mill.presets[0].nameOverridden, false);
  assert.equal(result.coated.presets.at(-1).color, '#abcdef');
  assert.ok(!result.coated.presets.some(c => c.id === 'ral-9016'));
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.coated.presets));
});
test('window loader validates server data before replacing any finish', () => {
  for (const payload of [null, {}, { ...palette(), schemaVersion: 2 }, { ...palette(), revision: -1 }, palette({ ...defaults, coated: [] }), palette({ ...defaults, coated: [defaults.coated[0], defaults.coated[0]] }), palette({ ...defaults, coated: [{ id: 'x', name: 'X', color: 'red' }] })]) {
    assert.throws(() => mergeWindowFinishCatalog(factory, payload));
  }
});
test('window loader makes one read-only uncached request before returning published colors', async () => {
  let requestOptions;
  const result = await loadWindowFinishCatalog(factory, { fetchImpl: async (url, options) => {
    assert.match(url, /getConfiguratorColors\?configuratorId=window$/); requestOptions = options;
    return response(palette());
  } });
  assert.equal(result.coated.presets.length, 15);
  assert.equal(requestOptions.method, 'GET'); assert.equal(requestOptions.cache, 'no-store'); assert.equal(requestOptions.credentials, 'omit');
});
test('window loader falls back safely for offline, HTTP, malformed and oversized responses', async () => {
  for (const fetchImpl of [async () => { throw new Error('Offline'); }, async () => ({ ok: false, status: 503 }), async () => response({}), async () => ({ ok: true, text: async () => 'x'.repeat(100001) })]) {
    assert.equal(await loadWindowFinishCatalog(factory, { fetchImpl, warn: quiet }), factory);
  }
});
test('window loader bounds both a stalled request and a stalled response body', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => ({ ok: true, text: () => new Promise(() => {}) })]) {
    assert.equal(await loadWindowFinishCatalog(factory, { fetchImpl, timeoutMs: 10, warn: quiet }), factory);
  }
});
test('Node CAD/build tools do not fetch the live palette', async () => {
  assert.equal(await loadWindowFinishCatalog(factory), factory);
});
test('deployment entry, explicit function list and static editor route are connected', async () => {
  const entry = await read('firebase-share-backend/functions/entry.js');
  const workflow = await read('.github/workflows/deploy-firebase-share.yml');
  const html = await read('website/public/edit/window-configurator/index.html');
  const materials = await read('window-configurator/src/client/js/materials.js');
  assert.match(entry, /require\('\.\/configurator-colors\.js'\)/);
  for (const name of ['getConfiguratorColorEditor', 'saveConfiguratorColors', 'getConfiguratorColors']) {
    assert.ok(workflow.includes(`functions:${name}`)); assert.ok(workflow.includes(`'${name}'`));
  }
  assert.match(html, /id="editor" hidden/); assert.match(html, /noindex, nofollow/);
  assert.match(html, /\/shared-ui\/src\/configuratorEditor\.js/);
  assert.match(configSource, /await loadWindowFinishCatalog/);
  assert.match(materials, /preset\.nameOverridden/); assert.match(materials, /selectedPreset\?\.nameOverridden/);
});

test('dedicated window editor contains no product dropdown or other-product placeholders', async () => {
  const html = await read('website/public/edit/window-configurator/index.html');
  const editor = await read('shared-ui/src/configuratorEditor.js');
  assert.match(html, /<title>Window configurator editor/);
  assert.match(html, /<h1>Window configurator editor<\/h1>/);
  assert.match(html, /href="\/window-configurator\/"/);
  assert.doesNotMatch(html, /<select\b|id="configurator"|WINDOW PILOT|More configurators|not available yet/i);
  assert.doesNotMatch(editor, /ui\.configurator\b|result\.configurators\b/);
  assert.match(editor, /configuratorId: 'window'/);
});
test('old edit URL is a history-replacing redirect, never a second editor', async () => {
  const html = await read('website/public/edit/index.html');
  assert.match(html, /http-equiv="refresh" content="0; url=\/edit\/window-configurator\/"/);
  assert.match(html, /window\.location\.replace\('\/edit\/window-configurator\/' \+ window\.location\.search \+ window\.location\.hash\)/);
  assert.match(html, /href="\/edit\/window-configurator\/"/);
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /<form\b|id="editor"|configuratorEditor\.js|firebaseAuth/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const redirects = [];
  vm.runInNewContext(script, { window: { location: {
    search: '?return=test', hash: '#palette', replace: url => redirects.push(url),
  } } });
  assert.deepEqual(redirects, ['/edit/window-configurator/?return=test#palette']);
});
test('nested editor loads shared assets from the site root with the revised version', async () => {
  const html = await read('website/public/edit/window-configurator/index.html');
  assert.match(html, /href="\/shared-ui\/styles\/configuratorEditor\.css\?v=2"/);
  assert.match(html, /src="\/shared-ui\/src\/configuratorEditor\.js\?v=2"/);
  assert.doesNotMatch(html, /(?:src|href)="(?:\.\.?\/)?shared-ui\//);
});
