// Run from the repository root: node --test scripts/validation/configurator-color-editor.test.mjs
// No Firebase credentials/network/dependencies: exercise real handlers with in-memory adapters.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const source = await read('firebase-share-backend/functions/configurator-colors.js');
const defaults = JSON.parse(await read('firebase-share-backend/functions/window-color-defaults.json'));
const pergolaDefaults = JSON.parse(await read('firebase-share-backend/functions/pergola-color-defaults.json'));
const fenceDefaults = JSON.parse(await read('firebase-share-backend/functions/fence-color-defaults.json'));
const sizeDefaults = JSON.parse(await read('firebase-share-backend/functions/window-size-defaults.json'));
const loaderSource = await read('window-configurator/src/client/js/finish-catalog-loader.js');
const { mergeWindowFinishCatalog, loadWindowFinishCatalog } = await import(`data:text/javascript;base64,${Buffer.from(loaderSource).toString('base64')}`);
const configSource = await read('window-configurator/src/client/js/config.js');
const factoryLiteral = configSource.slice(configSource.indexOf('Object.freeze({', configSource.indexOf('const DEFAULT_ALUMINIUM_FINISH_CATALOG')), configSource.indexOf('\n// Resolve the published'));
const factory = vm.runInNewContext(factoryLiteral.replace(/;\s*$/, ''));

function harness(configuratorId = 'window') {
  const productDefaults = { window: defaults, pergola: pergolaDefaults, fence: fenceDefaults }[configuratorId];
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
    './pergola-color-defaults.json': copy(pergolaDefaults),
    './fence-color-defaults.json': copy(fenceDefaults),
    './window-size-defaults.json': copy(sizeDefaults),
  };
  const mod = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + source + '\n})', { console: { error() {} } })(
    id => { assert.ok(modules[id], `Unexpected dependency: ${id}`); return modules[id]; }, mod, mod.exports,
  );
  const request = (data = { configuratorId }, overrides = {}) => ({
    data, auth: { uid: 'admin-uid', token: { auth_time: 1788940000 } },
    rawRequest: { get: () => 'https://www.360configurator.com' }, ...overrides,
  });
  const save = (groups = copy(productDefaults), expectedRevision = 0, overrides = {}) => mod.exports.saveConfiguratorColors(request({ configuratorId, expectedRevision, groups }, overrides));
  const publicGet = async (method = 'GET', query = { configuratorId }) => {
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
  assert.match(editor, /dataset\.configuratorId \|\| 'window'/);
  assert.match(editor, /configuratorId, expectedRevision:/);
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
  assert.match(html, /href="\/shared-ui\/styles\/configuratorEditor\.css\?v=4"/);
  assert.match(html, /src="\/shared-ui\/src\/configuratorEditor\.js\?v=5"/);
  assert.doesNotMatch(html, /(?:src|href)="(?:\.\.?\/)?shared-ui\//);
});

// Pergola palettes use their existing catalog arrays and the same protected backend.
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const pergolaCatalogUrl = dataUrl(await read('pergola-configurator/src/catalog.js'));
const pergolaCatalog = await import(pergolaCatalogUrl);
const pergolaSource = await read('pergola-configurator/src/color-catalog.js');
const { mergePergolaColorCatalog, loadPergolaColorCatalog, initializePergolaColorCatalog } = await import(dataUrl(
  pergolaSource.replace("'./catalog.js'", JSON.stringify(pergolaCatalogUrl)),
));
const pergolaArrays = {
  frame: pergolaCatalog.FRAME_COLORS,
  louvers: pergolaCatalog.LOUVER_COLORS,
  screens: pergolaCatalog.SCREEN_COLORS,
  'privacy-wall': pergolaCatalog.PRIVACY_WALL_COLORS,
  led: pergolaCatalog.LED_COLORS,
};
const pergolaFactory = copy(pergolaArrays);
const pergolaPalette = (groups = copy(pergolaDefaults), revision = 1) => ({ schemaVersion: 1, configuratorId: 'pergola', revision, groups });
const helpersSource = await read('pergola-configurator/src/ui/renderHelpers.js');
const { colorSwatches } = await import(dataUrl(helpersSource.replace(
  "'../../../shared-ui/src/index.js'", JSON.stringify(dataUrl(await read('shared-ui/src/utils.js'))),
)));

test('pergola backend defaults exactly match all 28 original swatches, in their existing order', () => {
  assert.equal(Object.values(pergolaDefaults).flat().length, 28);
  for (const id of Object.keys(pergolaArrays)) {
    assert.deepEqual(pergolaDefaults[id].map(color => ({ value: color.color, label: color.name })), pergolaFactory[id]);
  }
});
test('pergola editor loads only its five named groups, without a product dropdown or window groups', async () => {
  const h = harness('pergola');
  const result = await h.getConfiguratorColorEditor(h.request());
  assert.equal(result.configuratorId, 'pergola'); assert.equal(result.revision, 0);
  assert.deepEqual(copy(result.groups), pergolaDefaults);
  assert.deepEqual(copy(result.finishGroups.map(group => group.id)), Object.keys(pergolaDefaults));
  assert.ok(result.finishGroups.every(group => group.hasNames));
  assert.equal(result.configurators, undefined);
  assert.equal(result.groups.mill, undefined);
});
for (const [label, authUser] of [
  ['ordinary customer', { email: 'customer@example.test' }],
  ['unverified admin', { emailVerified: false }],
  ['disabled admin', { disabled: true }],
  ['revoked admin session', { tokensValidAfterTime: '2026-09-09T09:00:00Z' }],
]) {
  test(`pergola ${label} cannot load or publish editor data`, async () => {
    const h = harness('pergola'); h.user(authUser);
    await assert.rejects(h.getConfiguratorColorEditor(h.request()));
    await assert.rejects(h.save());
    assert.equal(h.stats.reads, 0); assert.equal(h.stats.commits, 0);
  });
}
test('anonymous and forged-role pergola requests have no write access', async () => {
  const h = harness('pergola');
  await rejectsCode(h.save(copy(pergolaDefaults), 0, { auth: null }), 'unauthenticated');
  h.user({ email: 'customer@example.test' });
  await rejectsCode(h.save(copy(pergolaDefaults), 0, { auth: { uid: 'customer', token: { admin: true, role: 'admin' } } }), 'permission-denied');
  assert.equal(h.stats.reads, 0);
});
for (const groupId of Object.keys(pergolaDefaults)) {
  test(`pergola ${groupId}: adding, deleting and renaming persists through the public picker response`, async () => {
    const h = harness('pergola'); const groups = copy(pergolaDefaults);
    const removed = groups[groupId].shift();
    groups[groupId][0].name = 'Renamed color';
    groups[groupId].push({ id: 'custom-color', name: '  New named color  ', color: '#12AbEf' });
    const saved = await h.save(groups);
    const readBack = await h.publicGet();
    assert.equal(readBack.code, 200); assert.equal(saved.revision, 1);
    assert.deepEqual(copy(readBack.body), copy(saved));
    assert.ok(!saved.groups[groupId].some(color => color.id === removed.id));
    assert.equal(saved.groups[groupId][0].name, 'Renamed color');
    assert.deepEqual(copy(saved.groups[groupId].at(-1)), { id: 'custom-color', name: 'New named color', color: '#12abef' });
    const catalog = mergePergolaColorCatalog(pergolaFactory, readBack.body);
    assert.equal(catalog[groupId].at(-1).publishedName, 'New named color');
    assert.equal(catalog[groupId].at(-1).value, '#12abef');
    assert.equal(catalog[groupId][0].publishedName, 'Renamed color');
    assert.equal(readBack.body.updatedBy, undefined); assert.equal(readBack.body.history, undefined);
    assert.equal(h.docs.get('configuratorColorPalettes/pergola/history/1').updatedBy, 'admin-uid');
    assert.equal(h.docs.has('configuratorColorPalettes/window'), false);
    for (const other of Object.keys(groups).filter(id => id !== groupId)) assert.deepEqual(copy(saved.groups[other]), pergolaDefaults[other]);
  });
}
test('window and pergola revisions, documents and histories stay independent', async () => {
  const h = harness();
  const w = { configuratorId: 'window', groups: copy(defaults), expectedRevision: 0 };
  const p = { configuratorId: 'pergola', groups: copy(pergolaDefaults), expectedRevision: 0 };
  w.groups.mill[0].name = 'Window only'; p.groups.frame[0].name = 'Pergola only';
  const [windowSaved, pergolaSaved] = await Promise.all([
    h.saveConfiguratorColors(h.request(w)), h.saveConfiguratorColors(h.request(p)),
  ]);
  assert.equal(windowSaved.revision, 1); assert.equal(pergolaSaved.revision, 1);
  const before = copy((await h.publicGet()).body);
  p.expectedRevision = 1; p.groups.led[0].name = 'Pergola revision 2';
  assert.equal((await h.saveConfiguratorColors(h.request(p))).revision, 2);
  assert.deepEqual(copy((await h.publicGet()).body), before);
  assert.equal(h.docs.has('configuratorColorPalettes/window/history/2'), false);
  assert.equal(h.docs.has('configuratorColorPalettes/pergola/history/2'), true);
});
test('pergola rejects stale concurrent saves and aborts publishing if audit creation fails', async () => {
  const h = harness('pergola');
  const [a, b] = await Promise.allSettled([h.save(), h.save()]);
  assert.equal(a.status, 'fulfilled'); assert.equal(b.status, 'rejected'); assert.equal(b.reason.code, 'aborted');
  const before = copy((await h.publicGet()).body); h.failAudit();
  await assert.rejects(h.save(copy(pergolaDefaults), 1), /Audit write failed/);
  assert.deepEqual(copy((await h.publicGet()).body), before);
});
test('cross-product palettes cannot overwrite the other product', async () => {
  const h = harness('pergola');
  await rejectsCode(h.save(defaults), 'invalid-argument');
  await rejectsCode(h.saveConfiguratorColors(h.request({ configuratorId: 'window', expectedRevision: 0, groups: pergolaDefaults })), 'invalid-argument');
  assert.equal(h.stats.reads, 0); assert.equal(h.stats.commits, 0);
});
for (const [label, mutate] of [
  ['empty group', groups => { groups.led = []; }],
  ['missing group', groups => { delete groups.louvers; }],
  ['unknown group', groups => { groups.coated = defaults.coated; }],
  ['too many colors', groups => { groups.frame = Array.from({ length: 101 }, (_, n) => ({ id: `c${n}`, name: 'Color', color: `#${n.toString(16).padStart(6, '0')}` })); }],
  ['duplicate ID', groups => { groups.frame[1].id = groups.frame[0].id; }],
  ['duplicate hex ignoring case', groups => { groups.frame[1].color = groups.frame[0].color.toUpperCase(); }],
  ['invalid hex', groups => { groups.screens[0].color = 'transparent'; }],
  ['CSS injection', groups => { groups.screens[0].color = '#123456;display:none'; }],
  ['empty name', groups => { groups['privacy-wall'][0].name = '   '; }],
  ['control characters', groups => { groups['privacy-wall'][0].name = 'Bad\u0000name'; }],
  ['name too long', groups => { groups.led[0].name = 'a'.repeat(121); }],
  ['path in ID', groups => { groups.frame[0].id = '../window'; }],
]) {
  test(`pergola ${label} is rejected by both server and public loader`, async () => {
    const h = harness('pergola'); const groups = copy(pergolaDefaults); mutate(groups);
    await rejectsCode(h.save(groups), 'invalid-argument');
    assert.throws(() => mergePergolaColorCatalog(pergolaFactory, pergolaPalette(groups)));
    assert.equal(h.stats.reads, 0); assert.equal(h.stats.commits, 0);
  });
}
test('the same hex in different pergola groups is valid; existing window same-hex preset IDs remain valid', async () => {
  assert.equal((await harness('pergola').save()).revision, 1);
  const groups = copy(defaults); groups.mill.push({ ...groups.mill[0], id: 'alternate-id', name: 'Alternate name' });
  assert.equal((await harness().save(groups)).revision, 1);
});
test('public pergola palette is read-only and unsupported IDs never access the database', async () => {
  const h = harness('pergola');
  assert.equal((await h.publicGet()).code, 200); assert.equal(h.stats.auth, 0);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await h.publicGet(method)).code, 405);
  const reads = h.stats.reads;
  for (const id of ['../window', '__proto__', 'constructor', 'roof', '', ['pergola'], null]) {
    assert.equal((await h.publicGet('GET', { configuratorId: id })).code, 400);
  }
  assert.equal(h.stats.reads, reads); assert.equal(h.stats.commits, 0);
});
test('pergola preserves translated built-in names and treats custom/renamed names as plain text', () => {
  const groups = copy(pergolaDefaults);
  groups.frame[0].name = '<img src=x onerror="alert(1)"> & "Black"';
  groups.louvers[0].color = '#abcdef';
  const result = mergePergolaColorCatalog(pergolaFactory, pergolaPalette(groups));
  assert.equal(result.screens[0].publishedName, undefined);
  assert.equal(result.louvers[0].publishedName, 'Graphite');
  // Match the existing i18n adapter's object spread: a translated label must not
  // hide a deliberately renamed swatch; an untouched swatch keeps translation.
  const localized = result.frame.map(color => ({ ...color, label: 'Old translated label' }));
  const html = colorSwatches(localized, groups.frame[0].color, 'roof.frameColor');
  assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&quot;Black&quot;')); assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('Old translated label'));
});
test('pergola loader rejects wrong-product data and malformed envelope metadata', () => {
  for (const value of [null, {}, palette(), { ...pergolaPalette(), revision: -1 }, { ...pergolaPalette(), schemaVersion: 2 }, { ...pergolaPalette(), groups: [] }]) {
    assert.throws(() => mergePergolaColorCatalog(pergolaFactory, value));
  }
});
test('pergola fetch is public, uncached, read-only and installs all five catalog arrays in place', async () => {
  const identities = { ...pergolaArrays }; const groups = copy(pergolaDefaults);
  for (const colors of Object.values(groups)) { colors.shift(); colors.push({ id: 'new-blue', name: 'New blue', color: '#12abef' }); }
  let calls = 0;
  await initializePergolaColorCatalog({ fetchImpl: async (url, options) => {
    calls++; assert.match(url, /getConfiguratorColors\?configuratorId=pergola$/);
    assert.equal(options.method, 'GET'); assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'omit');
    assert.equal(options.headers?.Authorization, undefined);
    return response(pergolaPalette(groups));
  } });
  assert.equal(calls, 1);
  for (const id of Object.keys(pergolaArrays)) {
    assert.equal(pergolaArrays[id], identities[id]);
    assert.equal(pergolaArrays[id].at(-1).publishedName, 'New blue');
    assert.equal(pergolaArrays[id].at(-1).value, '#12abef');
    assert.ok(!pergolaArrays[id].some(color => color.value === pergolaDefaults[id][0].color));
  }
  await initializePergolaColorCatalog(); // Node-safe reset to factory for later tests.
});
test('pergola loader handles offline/HTTP/malformed/oversized responses without breaking startup', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('Offline'); },
    async () => ({ ok: false, status: 503 }),
    async () => response({}),
    async () => ({ ok: true, text: async () => '<html>Server error</html>' }),
    async () => ({ ok: true, text: async () => 'x'.repeat(256001) }),
  ]) assert.equal(await loadPergolaColorCatalog(pergolaFactory, { fetchImpl, warn: quiet }), pergolaFactory);
});
test('pergola loader bounds stalled headers and body, and a late response never changes the installed colors', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => ({ ok: true, text: () => new Promise(() => {}) })]) {
    assert.equal(await loadPergolaColorCatalog(pergolaFactory, { fetchImpl, timeoutMs: 5, warn: quiet }), pergolaFactory);
  }
  let finish;
  await initializePergolaColorCatalog({ fetchImpl: () => new Promise(resolve => { finish = resolve; }), timeoutMs: 5, warn: quiet });
  const groups = copy(pergolaDefaults); groups.frame[0].name = 'Late rename';
  finish(response(pergolaPalette(groups)));
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.deepEqual(copy(pergolaArrays), pergolaFactory);
});
test('pergola build imports never fetch production and initialization finishes before creating the UI', async () => {
  assert.equal(await loadPergolaColorCatalog(pergolaFactory), pergolaFactory);
  const main = await read('pergola-configurator/src/main.js');
  assert.match(main, /import \{ initializePergolaColorCatalog \} from '\.\/color-catalog\.js'/);
  assert.ok(main.indexOf('initializePergolaColorCatalog(),') < main.indexOf('new ConfiguratorUI('));
  assert.ok(main.indexOf('initializePergolaColorCatalog(),') < main.indexOf('new ConfiguratorStore('));
});
test('pergola has its own non-indexed page and versioned root-relative assets, without replacing the window page', async () => {
  const html = await read('website/public/edit/pergola-configurator/index.html');
  assert.match(html, /data-configurator-id="pergola"/);
  assert.match(html, /<h1>Pergola configurator editor<\/h1>/);
  assert.match(html, /href="\/pergola-configurator\/"/);
  assert.match(html, /id="editor" hidden/); assert.match(html, /noindex, nofollow/);
  assert.match(html, /src="\/shared-ui\/src\/configuratorEditor\.js\?v=3"/);
  assert.match(html, /href="\/shared-ui\/styles\/configuratorEditor\.css\?v=3"/);
  assert.doesNotMatch(html, /<select\b|window-configurator\/|Mill finish|Anodized/);
  const css = await read('shared-ui/styles/configuratorEditor.css');
  assert.match(css, /html\[data-configurator-id="pergola"\] \.finish-tabs \{\s*flex-wrap:wrap/);
});

// Exercise the actual website release validator at the same pre-composition
// stage as Cloud Run. No generated website output or credentials are required.
async function releaseFixture(run) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'pergola-editor-release-'));
  const put = async (relative, contents = '') => {
    const file = path.join(temporary, relative);
    await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, contents);
  };
  const release = 'website/outputs/release-site/';
  try {
    const routesSource = await read('website/scripts/static-routes.mjs');
    const { pageRoutes, routeOutputPath } = await import(dataUrl(routesSource));
    await put('website/scripts/static-routes.mjs', routesSource);
    await put('website/scripts/validate-static-release.mjs', await read('website/scripts/validate-static-release.mjs'));
    const domains = { en: 'https://www.360configurator.com', ro: 'https://www.360configurator.ro', de: 'https://www.360konfigurator.de' };
    for (const route of pageRoutes) {
      const locale = /^\/ro(?:\/|$)/.test(route) ? 'ro' : /^\/de(?:\/|$)/.test(route) ? 'de' : 'en';
      await put(release + routeOutputPath(route), `<html lang="${locale}"><head><link rel="canonical" href="${domains[locale]}${route}"></head><body class="site-shell detail-page"><a href="https://www.360configurator.com/roof-configurator/">Roof</a></body></html>`);
    }
    for (const file of ['404.html', '.nojekyll', 'release-manifest.json', 'robots.txt', 'favicon-32x32.png', 'favicon-192x192.png', 'favicon-512x512.png', 'apple-touch-icon.png']) await put(release + file);
    const apps = {
      en: ['/pergola-configurator/', '/roof-configurator/', '/window-configurator/', '/hall-configurator/', '/solar-configurator/', '/fence-configurator/', '/cardbox-configurator/'],
      ro: ['/configurator-pergola/', '/configurator-acoperis/', '/configurator-ferestre/', '/configurator-hala/', '/configurator-solar/', '/configurator-garduri/', '/configurator-cutii-carton/'],
      de: ['/pergola-konfigurator/', '/dach-konfigurator/', '/fenster-konfigurator/', '/hallen-konfigurator/', '/solar-konfigurator/', '/zaun-konfigurator/', '/karton-konfigurator/'],
    };
    for (const [locale, domain] of Object.entries(domains)) {
      const urls = ['/', '/about', '/contact', '/pricing', '/book-a-demo', ...['pergola', 'roof', 'window', 'hall', 'solar', 'fence'].map(id => `/configurators/${id}`), ...apps[locale]];
      const xml = `<urlset>${urls.map(url => `<url><loc>${domain}${url}</loc></url>`).join('')}</urlset>`;
      await put(`${release}sitemap-${locale}.xml`, xml);
      if (locale === 'en') await put(`${release}sitemap.xml`, xml);
    }
    for (const product of ['window', 'pergola', 'fence']) await put(`${release}edit/${product}-configurator/index.html`, await read(`website/public/edit/${product}-configurator/index.html`));
    await put(release + 'edit/index.html', await read('website/public/edit/index.html'));
    for (const file of ['styles/configuratorEditor.css', 'styles/windowSettingsEditor.css', 'src/configuratorEditor.js']) await put(`shared-ui/${file}`, await read(`shared-ui/${file}`));
    await put('dist/window-configurator-build/index.html', '<html>Window build</html>');
    await put('dist/window-configurator-build/editor-preview.html', await read('window-configurator/src/client/editor-preview.html'));
    await put('pergola-configurator/dist/index.html', '<html>Pergola build</html>');
    await put('fence-configurator/index.html', '<html>Fence source</html>');
    const validate = () => spawnSync(process.execPath, ['website/scripts/validate-static-release.mjs'], { cwd: temporary, encoding: 'utf8', timeout: 10000 });
    await run({ temporary, put, release, validate });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
test('website-only release validates all three editors against the real composed-site mount paths', () => releaseFixture(async ({ validate }) => {
  const result = validate(); assert.equal(result.status, 0, result.stdout + result.stderr);
}));
for (const [file, reference] of [
  ['fence-configurator/index.html', '/fence-configurator/'],
  ['pergola-configurator/dist/index.html', '/pergola-configurator/'],
  ['dist/window-configurator-build/index.html', '/window-configurator/'],
  ['shared-ui/src/configuratorEditor.js', '/shared-ui/src/configuratorEditor.js'],
  ['shared-ui/styles/configuratorEditor.css', '/shared-ui/styles/configuratorEditor.css'],
]) {
  test(`release validator still fails on missing dependency ${file}`, () => releaseFixture(async ({ temporary, validate }) => {
    await rm(path.join(temporary, file));
    const result = validate(); assert.equal(result.status, 1); assert.ok(result.stderr.includes(reference), result.stderr);
  }));
}
test('release mount support does not hide a misspelled pergola asset or unrelated broken link', () => releaseFixture(async ({ release, put, validate }) => {
  await put(release + 'invalid.html', '<script src="/pergola-configurator/missing.js"></script><a href="/not-a-real-page/">Missing</a>');
  const result = validate(); assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('/pergola-configurator/missing.js')); assert.ok(result.stderr.includes('/not-a-real-page/'));
}));

// Fence uses stable finish IDs (and their existing price/material treatments),
// unlike pergola's plain hex selections. Saved finish display data is snapshotted.
const fenceCatalog = await import(new URL('fence-configurator/js/finish-catalog.js?v=1', root));
const fenceState = await import(new URL('fence-configurator/js/state.js?v=4', root));
const fencePalette = (groups = copy(fenceDefaults), revision = 1) => ({ schemaVersion: 1, configuratorId: 'fence', revision, groups });
const installFence = groups => fenceCatalog.initializeFenceFinishCatalog({ fetchImpl: async () => response(fencePalette(groups)), warn: quiet });

test('fence defaults match the five original IDs, names, hex values and price multipliers', () => {
  const sourceColors = Object.values(fenceCatalog.DEFAULT_FENCE_FINISHES);
  assert.deepEqual(fenceDefaults.finish, sourceColors.map(({ id, name, color }) => ({ id, name, color })));
  assert.deepEqual(sourceColors.map(finish => finish.multiplier), [1, 1.04, 1.05, 1.08, 1.18]);
});
test('fence-only editor response has one named finish group and no configurator list', async () => {
  const h = harness('fence'); const result = await h.getConfiguratorColorEditor(h.request());
  assert.deepEqual(copy(result.groups), fenceDefaults);
  assert.deepEqual(copy(result.finishGroups), [{ id: 'finish', label: 'Fence finish', hasNames: true }]);
  assert.equal(result.maxColorsPerGroup, 100); assert.equal(result.revision, 0);
  assert.equal(result.configuratorId, 'fence'); assert.equal(result.configurators, undefined);
});
for (const [label, authUser] of [
  ['ordinary customer', { email: 'customer@example.test' }],
  ['unverified admin', { emailVerified: false }],
  ['disabled admin', { disabled: true }],
  ['revoked session', { tokensValidAfterTime: '2026-09-09T09:00:00Z' }],
]) {
  test(`fence ${label} cannot load or publish editor data`, async () => {
    const h = harness('fence'); h.user(authUser);
    await assert.rejects(h.getConfiguratorColorEditor(h.request())); await assert.rejects(h.save());
    assert.equal(h.stats.reads, 0); assert.equal(h.stats.commits, 0);
  });
}
test('fence rejects anonymous users, forged roles and non-editor origins', async () => {
  const h = harness('fence');
  await rejectsCode(h.save(copy(fenceDefaults), 0, { auth: null }), 'unauthenticated');
  await rejectsCode(h.save(copy(fenceDefaults), 0, { rawRequest: { get: () => 'https://customer.360configurator.com' } }), 'permission-denied');
  h.user({ email: 'customer@example.test' });
  await rejectsCode(h.save(copy(fenceDefaults), 0, { auth: { uid: 'customer', token: { admin: true, email: 'office@360design.ro' } } }), 'permission-denied');
  assert.equal(h.stats.reads, 0); assert.equal(h.stats.commits, 0);
});
test('fence add/delete/recolor/rename publishes exactly the edited palette and creates private audit history', async () => {
  const h = harness('fence'); const groups = copy(fenceDefaults);
  groups.finish.splice(1, 1);
  groups.finish[0] = { ...groups.finish[0], color: '#ABCDEF', name: '  Renamed finish  ' };
  groups.finish.push({ id: 'custom-blue', name: 'Blue', color: '#124578' });
  const saved = await h.save(groups); const result = await h.publicGet();
  assert.equal(saved.revision, 1); assert.deepEqual(copy(result.body), copy(saved));
  assert.equal(saved.groups.finish[0].name, 'Renamed finish'); assert.equal(saved.groups.finish[0].color, '#abcdef');
  assert.equal(saved.groups.finish.some(color => color.id === 'black'), false);
  assert.deepEqual(copy((await h.getConfiguratorColorEditor(h.request())).groups), copy(saved.groups));
  assert.equal(result.body.updatedBy, undefined); assert.equal(result.body.history, undefined);
  assert.equal(h.docs.get('configuratorColorPalettes/fence/history/1').updatedBy, 'admin-uid');
  assert.equal(h.docs.has('configuratorColorPalettes/window'), false); assert.equal(h.docs.has('configuratorColorPalettes/pergola'), false);
});
test('fence saves cannot overwrite window/pergola data or advance their revisions', async () => {
  const h = harness('fence');
  for (const [id, groups] of [['window', defaults], ['pergola', pergolaDefaults]]) {
    await h.saveConfiguratorColors(h.request({ configuratorId: id, expectedRevision: 0, groups: copy(groups) }));
  }
  const before = copy([...h.docs.entries()]);
  await h.save(); await h.save(copy(fenceDefaults), 1);
  assert.deepEqual(copy([...h.docs.entries()].filter(([key]) => !key.startsWith('configuratorColorPalettes/fence'))), before);
  await rejectsCode(h.save(defaults, 2), 'invalid-argument');
  await rejectsCode(h.save(pergolaDefaults, 2), 'invalid-argument');
  await rejectsCode(h.saveConfiguratorColors(h.request({ configuratorId: 'window', expectedRevision: 1, groups: fenceDefaults })), 'invalid-argument');
});
test('fence simultaneous saves conflict, and audit failure rolls back publishing', async () => {
  const h = harness('fence'); const [a, b] = await Promise.allSettled([h.save(), h.save()]);
  assert.equal(a.status, 'fulfilled'); assert.equal(b.status, 'rejected'); assert.equal(b.reason.code, 'aborted');
  h.failAudit(); await assert.rejects(h.save(copy(fenceDefaults), 1), /Audit write failed/);
  assert.equal((await h.publicGet()).body.revision, 1);
});
for (const [label, mutate] of [
  ['empty finish group', g => { g.finish = []; }],
  ['missing finish group', g => { delete g.finish; }],
  ['foreign group', g => { g.frame = g.finish; }],
  ['too many colors', g => { g.finish = Array.from({ length: 101 }, (_, n) => ({ id: `c-${n}`, name: 'Name', color: '#112233' })); }],
  ['duplicate ID', g => { g.finish[1].id = g.finish[0].id; }],
  ['path ID', g => { g.finish[0].id = '../window'; }],
  ['invalid hex', g => { g.finish[0].color = 'red'; }],
  ['CSS injection', g => { g.finish[0].color = '#123456;background:red'; }],
  ['empty name', g => { g.finish[0].name = '   '; }],
  ['long name', g => { g.finish[0].name = 'x'.repeat(121); }],
  ['control character', g => { g.finish[0].name = 'bad\u0000name'; }],
  ['price override', g => { g.finish[0].multiplier = 0; }],
]) {
  test(`fence ${label} is rejected by server and public loader`, async () => {
    const h = harness('fence'); const groups = copy(fenceDefaults); mutate(groups);
    await rejectsCode(h.save(groups), 'invalid-argument');
    assert.throws(() => fenceCatalog.parseFenceFinishPalette(fencePalette(groups)));
    assert.equal(h.stats.reads, 0); assert.equal(h.stats.commits, 0);
  });
}
test('fence different finish IDs may use the same hex and remain independently selectable', async () => {
  const h = harness('fence'); const groups = copy(fenceDefaults); groups.finish[1].color = groups.finish[0].color;
  await h.save(groups); await installFence(groups);
  const state = fenceState.createFenceState();
  assert.ok(fenceCatalog.selectFenceFinish(state, 'black')); assert.equal(state.finish, 'black');
  assert.equal(fenceCatalog.resolveFenceFinish(state).multiplier, 1.04);
});
test('fence public endpoint has no login requirement, is non-cacheable and refuses all write methods', async () => {
  const h = harness('fence'); const result = await h.publicGet();
  assert.equal(result.code, 200); assert.equal(h.stats.auth, 0);
  assert.match(result.headers['Cache-Control'], /no-store/);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await h.publicGet(method)).code, 405);
  assert.equal(h.stats.commits, 0);
});
test('fence public loader uses one bounded anonymous, uncached GET and retains trusted price metadata', async () => {
  const calls = []; const groups = copy(fenceDefaults);
  groups.finish[1].name = 'Night black'; groups.finish[1].color = '#010203';
  groups.finish.push({ id: 'custom-new', name: 'New color', color: '#fedcba' });
  const colors = await fenceCatalog.loadFenceFinishCatalog({ fetchImpl: async (url, init) => { calls.push({ url, init }); return response(fencePalette(groups)); } });
  assert.equal(calls.length, 1); assert.match(calls[0].url, /configuratorId=fence$/);
  assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.headers, undefined); assert.ok(calls[0].init.signal);
  assert.equal(colors[1].name, 'Night black'); assert.equal(colors[1].labelKey, null); assert.equal(colors[1].multiplier, 1.04);
  assert.equal(colors.at(-1).multiplier, 1); assert.equal(colors.at(-1).labelKey, null);
});
for (const [name, fetchImpl] of [
  ['network error', async () => { throw new Error('offline'); }],
  ['HTTP error', async () => ({ ok: false, status: 503 })],
  ['malformed JSON', async () => ({ ok: true, text: async () => '<html>Proxy error</html>' })],
  ['oversized body', async () => ({ ok: true, text: async () => 'x'.repeat(256001) })],
  ['wrong product', async () => response(palette())],
  ['invalid revision', async () => response(fencePalette(copy(fenceDefaults), -1))],
]) {
  test(`fence ${name} falls back to the complete original palette`, async () => {
    const colors = await fenceCatalog.loadFenceFinishCatalog({ fetchImpl, warn: quiet });
    assert.deepEqual(colors, Object.values(fenceCatalog.DEFAULT_FENCE_FINISHES));
  });
}
test('fence timeout covers a hanging body and cannot apply a late palette', async () => {
  let resolveBody; let signal;
  const pending = fenceCatalog.initializeFenceFinishCatalog({ timeoutMs: 10, warn: quiet, fetchImpl: async (_url, init) => {
    signal = init.signal; return { ok: true, text: () => new Promise(resolve => { resolveBody = resolve; }) };
  } });
  await pending; assert.equal(signal.aborted, true);
  const groups = { finish: [{ id: 'late', name: 'Late', color: '#112233' }] };
  resolveBody(JSON.stringify(fencePalette(groups))); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(fenceCatalog.getAvailableFenceFinishes().length, 5);
  assert.equal(fenceCatalog.getAvailableFenceFinishes().some(color => color.id === 'late'), false);
});
test('fence built-in names stay localized but administrator names are not replaced by old translation keys', async () => {
  await installFence(copy(fenceDefaults));
  assert.equal(fenceCatalog.FINISHES.wood.labelKey, 'finish.wood');
  const groups = copy(fenceDefaults); groups.finish[4].name = 'My oak finish'; await installFence(groups);
  assert.equal(fenceCatalog.FINISHES.wood.labelKey, null); assert.equal(fenceCatalog.FINISHES.wood.name, 'My oak finish');
});
test('fence new/custom finishes survive normalization, capture and restore without changing dimensions or gate placements', async () => {
  const groups = copy(fenceDefaults); groups.finish.push({ id: 'custom-blue', name: 'Custom blue', color: '#134567' }); await installFence(groups);
  for (const layout of ['straight', 'l', 'u', 'closed', 'closed5']) {
    const state = fenceState.createFenceState({ layout }); const metrics = fenceState.deriveFenceMetrics(state);
    assert.ok(fenceCatalog.selectFenceFinish(state, 'custom-blue')); fenceState.normalizeFenceState(state);
    const restored = fenceState.createFenceState(copy(state));
    assert.equal(restored.finish, 'custom-blue'); assert.equal(fenceCatalog.resolveFenceFinish(restored).color, '#134567');
    assert.deepEqual(fenceState.deriveFenceMetrics(restored), metrics);
  }
});
test('saved fence snapshots retain their old display data after deletion/recoloring; deleted IDs are not offered', async () => {
  const groups = { finish: [{ id: 'custom-blue', name: 'First blue', color: '#134567' }] }; await installFence(groups);
  const saved = copy(fenceState.createFenceState());
  await installFence({ finish: [{ id: 'custom-blue', name: 'Changed blue', color: '#abcdef' }] });
  assert.equal(fenceCatalog.resolveFenceFinish(fenceState.createFenceState(saved)).color, '#134567');
  assert.equal(fenceCatalog.resolveFenceFinish(fenceState.createFenceState()).color, '#abcdef');
  await installFence(copy(fenceDefaults));
  const restored = fenceState.createFenceState(saved);
  assert.equal(restored.finish, 'custom-blue'); assert.equal(restored.finishSnapshot.name, 'First blue');
  assert.equal(fenceCatalog.selectFenceFinish(restored, 'custom-blue'), false);
  assert.equal(fenceCatalog.getAvailableFenceFinishes().some(f => f.id === 'custom-blue'), false);
});
test('fresh/reset fence configurations use an offered finish when anthracite is deleted; legacy shares still render', async () => {
  await installFence({ finish: [{ id: 'new-green', name: 'Green', color: '#235634' }] });
  assert.equal(fenceState.createFenceState().finish, 'new-green');
  const old = fenceState.createFenceState({ finish: 'wood' });
  assert.equal(old.finish, 'wood'); assert.equal(fenceCatalog.resolveFenceFinish(old).multiplier, 1.18);
  assert.equal(fenceCatalog.getAvailableFenceFinishes().length, 1);
});
test('fence saved display data cannot inject pricing/material metadata, prototypes, CSS or HTML into attributes', async () => {
  await installFence(copy(fenceDefaults));
  const forged = fenceState.createFenceState({ finish: 'wood', finishSnapshot: { id: 'wood', name: '<img src=x onerror=alert(1)>', color: '#abcdef', multiplier: 0, material: 'gold' } });
  const finish = fenceCatalog.resolveFenceFinish(forged);
  assert.equal(finish.multiplier, 1.18); assert.equal(finish.material, undefined);
  assert.deepEqual(Object.keys(forged.finishSnapshot).sort(), ['color', 'id', 'name']);
  for (const invalid of ['__proto__', 'constructor', 'toString', '../bad']) {
    assert.equal(fenceState.createFenceState({ finish: invalid }).finish, 'anthracite');
  }
  const bad = fenceState.createFenceState({ finish: 'wood', finishSnapshot: { id: 'wood', name: 'Wood', color: 'url(evil)' } });
  assert.equal(fenceCatalog.resolveFenceFinish(bad).color, '#8a5734');
});
test('fence code loads published choices before state/UI, and price factors are compatible across state module versions', async () => {
  const main = await read('fence-configurator/js/app.js');
  assert.ok(main.indexOf('await initializeFenceFinishCatalog()') < main.indexOf('let state = createFenceState()'));
  assert.match(main, /Object\.assign\(state, createFenceState\(\)\)/);
  await installFence(copy(fenceDefaults));
  const rendererState = await import(new URL('fence-configurator/js/state.js?v=5', root));
  assert.equal(rendererState.FINISHES, fenceState.FINISHES);
  assert.equal(fenceState.FINISHES.bronze.multiplier, 1.08);
});
test('fence 3D material path uses the saved/published color, keeps bronze properties and tints the original wood maps', async () => {
  await installFence(copy(fenceDefaults));
  const source = await read('fence-configurator/js/fenceFactory.js');
  const tintSource = source.slice(source.indexOf('function woodFinishTint('), source.indexOf('\nconst POST_SIZE'));
  const materialSource = source.slice(source.indexOf('  const finish = resolveFenceFinish(state);'), source.indexOf('  const darkMaterial'));
  class Color {
    constructor(hex) { const n = parseInt(hex.slice(1), 16); this.r = (n >> 16) / 255; this.g = ((n >> 8) & 255) / 255; this.b = (n & 255) / 255; }
    setRGB(r, g, b) { Object.assign(this, { r, g, b }); return this; }
  }
  class Material {
    constructor(options) { Object.assign(this, options); this.normalScale = { set() {} }; }
  }
  const material = vm.runInNewContext(`(state) => { ${tintSource}\n${materialSource}\nreturn finishMaterial; }`, {
    THREE: { Color, MeshPhysicalMaterial: Material }, DEFAULT_FENCE_FINISHES: fenceCatalog.DEFAULT_FENCE_FINISHES,
    resolveFenceFinish: fenceCatalog.resolveFenceFinish, surfaceTexture: path => path,
  });
  const wood = material(fenceState.createFenceState({ finish: 'wood' }));
  assert.deepEqual([wood.color.r, wood.color.g, wood.color.b], [1, 1, 1]);
  assert.match(wood.map, /fence-wood-color\.jpg$/); assert.match(wood.normalMap, /fence-wood-normal\.jpg$/);
  const tinted = material(fenceState.createFenceState({ finish: 'wood', finishSnapshot: { id: 'wood', name: 'Edited wood', color: '#223344' } }));
  assert.notDeepEqual([tinted.color.r, tinted.color.g, tinted.color.b], [1, 1, 1]); assert.equal(tinted.map, wood.map);
  const bronze = material(fenceState.createFenceState({ finish: 'bronze' }));
  assert.equal(bronze.color, '#5f544c'); assert.equal(bronze.roughness, 0.27); assert.equal(bronze.metalness, 0.14); assert.equal(bronze.clearcoat, 0.52);
  const custom = material(fenceState.createFenceState({ finish: 'custom-saved', finishSnapshot: { id: 'custom-saved', name: 'Saved blue', color: '#123456' } }));
  assert.equal(custom.color, '#123456'); assert.equal(custom.map, null); assert.equal(custom.metalness, 0.24);
});
test('dedicated fence page and named preview preserve server-gated access and link only to the fence configurator', async () => {
  const html = await read('website/public/edit/fence-configurator/index.html');
  assert.match(html, /data-configurator-id="fence"/); assert.match(html, /<form id="editor" hidden/);
  assert.match(html, /noindex/); assert.match(html, /href="\/fence-configurator\/"/);
  assert.doesNotMatch(html, /<select|pergola-configurator|window-configurator|Mill finish|Roof louvers/);
  const ui = await read('fence-configurator/js/ui.js');
  assert.match(ui, /getAvailableFenceFinishes\(\)/); assert.match(ui, /label\.textContent = name/);
  assert.match(ui, /selectFenceFinish\(this\.state/);
  assert.match(ui, /finish\.color === selection\.color/);
});
test('release validation still catches misspelled fence files instead of bypassing the fence mount', () => releaseFixture(async ({ release, put, validate }) => {
  await put(release + 'fence-broken.html', '<script src="/fence-configurator/js/missing-color-loader.js"></script>');
  const result = validate(); assert.equal(result.status, 1); assert.match(result.stderr, /missing-color-loader\.js/);
}));

// Window settings extend the same protected, revisioned palette document.
const sizeModelUrl = dataUrl(await read('shared-ui/src/windowSizeSettings.js'));
const sizeModel = await import(sizeModelUrl);
const sizeUpdate = (h, sizeLimits = copy(sizeDefaults), expectedRevision = 0, groups = copy(defaults), overrides = {}) =>
  h.saveConfiguratorColors(h.request({ configuratorId: 'window', expectedRevision, groups, sizeLimits }, overrides));

test('window size defaults match in browser/backend and existing palettes need no migration', async () => {
  assert.deepEqual(copy(sizeModel.DEFAULT_WINDOW_SIZE_LIMITS), sizeDefaults);
  const h = harness();
  const editor = await h.getConfiguratorColorEditor(h.request());
  assert.equal(editor.windowSettingsVersion, 1);
  assert.deepEqual(copy(editor.sizeLimits), sizeDefaults);
  assert.deepEqual(copy((await h.publicGet()).body.sizeLimits), sizeDefaults);
  h.docs.set('configuratorColorPalettes/window', { schemaVersion: 1, revision: 5, groups: copy(defaults) });
  const legacy = await h.getConfiguratorColorEditor(h.request());
  assert.equal(legacy.revision, 5); assert.deepEqual(copy(legacy.sizeLimits), sizeDefaults);
});
test('colors and all four dimension ranges publish together with one revision and one audit snapshot', async () => {
  const h = harness(); const limits = copy(sizeDefaults); const groups = copy(defaults);
  limits.overall.width = { minMm: 900, maxMm: 9000 };
  limits.overall.height = { minMm: 800, maxMm: 8000 };
  limits.individual.width = { minMm: 600, maxMm: 3000 };
  limits.individual.height = { minMm: 700, maxMm: 2400 };
  groups.coated[0].name = 'Edited white';
  const result = await sizeUpdate(h, limits, 0, groups);
  assert.equal(result.revision, 1); assert.equal(h.stats.commits, 1);
  assert.deepEqual(copy(result.sizeLimits), limits);
  assert.equal(result.groups.coated[0].name, 'Edited white');
  const record = h.docs.get('configuratorColorPalettes/window');
  assert.deepEqual(copy(record), copy(h.docs.get('configuratorColorPalettes/window/history/1')));
  assert.deepEqual(copy((await h.publicGet()).body.sizeLimits), limits);
  assert.equal(Object.hasOwn((await h.publicGet()).body, 'updatedBy'), false);
});
test('legacy color-only window clients preserve previously published dimension limits', async () => {
  const h = harness(); const limits = copy(sizeDefaults); limits.individual.width.minMm = 600;
  await sizeUpdate(h, limits);
  const groups = copy(defaults); groups.anodized[0].name = 'Renamed by older editor';
  const result = await h.save(groups, 1);
  assert.deepEqual(copy(result.sizeLimits), limits); assert.equal(result.revision, 2);
  assert.equal(result.groups.anodized[0].name, 'Renamed by older editor');
});
test('a size publish and a stale color publish cannot overwrite one another', async () => {
  const h = harness(); const limits = copy(sizeDefaults); limits.overall.width.maxMm = 8000;
  const outcomes = await Promise.allSettled([sizeUpdate(h, limits), h.save()]);
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(o => o.status === 'rejected').reason.code, 'aborted');
  assert.equal(h.stats.commits, 1);
  assert.deepEqual(copy((await h.publicGet()).body.sizeLimits), limits);
});
test('failed audit writing rolls back both size limits and colors', async () => {
  const h = harness(); h.failAudit();
  await assert.rejects(sizeUpdate(h)); assert.equal(h.docs.size, 0); assert.equal(h.stats.commits, 0);
});
for (const [label, mutate] of [
  ['null', () => null], ['array', () => []], ['missing scope', value => { delete value.individual; return value; }],
  ['unknown scope', value => ({ ...value, glass: {} })],
  ['missing axis', value => { delete value.overall.height; return value; }],
  ['unknown range field', value => { value.individual.width.stepMm = 5; return value; }],
  ['equal endpoints', value => { value.individual.width.minMm = value.individual.width.maxMm; return value; }],
  ['reversed endpoints', value => { value.individual.width.minMm = 2600; return value; }],
  ['individual maximum above overall', value => { value.overall.width.maxMm = 2000; return value; }],
  ['fractional value', value => { value.individual.height.minMm = 600.5; return value; }],
  ['numeric string', value => { value.individual.height.minMm = '600'; return value; }],
  ['boolean', value => { value.individual.height.minMm = true; return value; }],
  ['blank', value => { value.individual.height.minMm = ''; return value; }],
  ['below geometry floor', value => { value.individual.height.minMm = 449; return value; }],
  ['above supported envelope', value => { value.overall.height.maxMm = 25001; return value; }],
  ['NaN', value => { value.overall.height.maxMm = NaN; return value; }],
  ['infinity', value => { value.overall.height.maxMm = Infinity; return value; }],
]) {
  test(`backend and browser reject invalid size limits: ${label}`, async () => {
    const value = mutate(copy(sizeDefaults)); const h = harness();
    assert.throws(() => sizeModel.validateWindowSizeLimits(value));
    await rejectsCode(sizeUpdate(h, value), 'invalid-argument');
    assert.equal(h.stats.commits, 0); assert.equal(h.stats.reads, 0);
  });
}
for (const scope of ['overall', 'individual']) for (const axis of ['width', 'height']) {
  test(`${scope} ${axis} has independent configurable min/max values`, async () => {
    const h = harness(); const limits = copy(sizeDefaults);
    limits[scope][axis].minMm = 678; limits[scope][axis].maxMm = scope === 'overall' ? 8765 : 2345;
    const result = await sizeUpdate(h, limits);
    assert.deepEqual(copy(result.sizeLimits), limits);
  });
}
for (const configuratorId of ['pergola', 'fence']) {
  test(`${configuratorId} cannot read/write window dimensions through its editor`, async () => {
    const h = harness(configuratorId);
    assert.equal(Object.hasOwn(await h.getConfiguratorColorEditor(h.request()), 'sizeLimits'), false);
    await rejectsCode(h.saveConfiguratorColors(h.request({ configuratorId, expectedRevision: 0,
      groups: copy(configuratorId === 'pergola' ? pergolaDefaults : fenceDefaults), sizeLimits: copy(sizeDefaults) })), 'invalid-argument');
    assert.equal(h.stats.commits, 0);
  });
}
test('size updates retain server-side admin and revocation authorization', async () => {
  for (const user of [{ email: 'customer@example.test' }, { emailVerified: false }, { disabled: true }]) {
    const h = harness(); h.user(user); await rejectsCode(sizeUpdate(h), 'permission-denied'); assert.equal(h.stats.commits, 0);
  }
  const h = harness(); await rejectsCode(sizeUpdate(h, copy(sizeDefaults), 0, copy(defaults), { auth: null }), 'unauthenticated');
});
test('malformed persisted dimensions do not leak invalid public settings', async () => {
  const h = harness(); h.docs.set('configuratorColorPalettes/window', {
    schemaVersion: 1, revision: 1, groups: copy(defaults), sizeLimits: { arbitrary: true },
  });
  assert.equal((await h.publicGet()).code, 503);
});

const settingsSource = await read('window-configurator/src/client/js/window-settings.js');
const { loadPublishedWindowSettings } = await import(dataUrl(settingsSource.replace(
  "'../../../../shared-ui/src/windowSizeSettings.js?v=1'", JSON.stringify(sizeModelUrl),
)));
test('public settings load one unauthenticated no-store response containing both colors and sizes', async () => {
  let calls = 0;
  const payload = { ...palette(), sizeLimits: copy(sizeDefaults) };
  const result = await loadPublishedWindowSettings({ fetchImpl: async (url, options) => {
    calls++; assert.match(url, /getConfiguratorColors\?configuratorId=window$/);
    assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'omit'); assert.equal(options.method, 'GET');
    assert.equal(options.headers?.Authorization, undefined);
    return response(payload);
  } });
  assert.equal(calls, 1); assert.deepEqual(result, payload);
  assert.ok(await loadWindowFinishCatalog(factory, { payload: result, fetchImpl: () => { throw new Error('duplicate fetch'); } }));
});
test('an older deployed public palette still loads without dimension fields', async () => {
  const result = await loadPublishedWindowSettings({ fetchImpl: async () => response(palette()) });
  assert.ok(result.groups.coated.length); assert.equal(result.sizeLimits, undefined);
});
test('public dimension loader is offline in Node tooling and fails safely on invalid/time-out responses', async () => {
  assert.equal(await loadPublishedWindowSettings(), null);
  for (const fetchImpl of [
    async () => ({ ok: false, status: 503 }),
    async () => response({ ...palette(), configuratorId: 'pergola' }),
    async () => response({ ...palette(), sizeLimits: {} }),
    async () => ({ ok: true, text: async () => '<html>Error</html>' }),
    async () => ({ ok: true, text: async () => 'a'.repeat(100001) }),
    () => new Promise(() => {}),
    async () => ({ ok: true, text: () => new Promise(() => {}) }),
  ]) assert.equal(await loadPublishedWindowSettings({ fetchImpl, timeoutMs: 10, warn: quiet }), null);
});
test('slider bounds use millimetres in number fields and metres in range controls, without changing saved values', () => {
  const elements = new Map();
  for (const control of sizeModel.WINDOW_SIZE_CONTROLS) for (const id of [control.rangeId, control.valueId]) {
    elements.set(id, { min: '', max: '', value: 'saved-value', dataset: {} });
  }
  const limits = copy(sizeDefaults); limits.individual.width = { minMm: 650, maxMm: 1800 };
  sizeModel.applyWindowSliderBounds(limits, { getElementById: id => elements.get(id) });
  assert.equal(elements.get('widthA').min, '0.650'); assert.equal(elements.get('widthA').max, '1.800');
  assert.equal(elements.get('valWidth').min, '650'); assert.equal(elements.get('valWidth').max, '1800');
  assert.ok([...elements.values()].every(element => element.value === 'saved-value'));
  elements.get('overallWidthA').dataset.layoutMinimumM = '1.950';
  sizeModel.applyWindowSliderBounds(limits, { getElementById: id => elements.get(id) });
  assert.equal(elements.get('overallWidthA').min, '1.950');
  assert.equal(elements.get('valOverallWidth').min, '1950');
});

// Exercise the real grid-sizing implementation with isolated controller/network boundaries.
const managerSource = await read('window-configurator/src/client/js/layout-sizing-manager.js');
async function sizingHarness(sizeLimits) {
  const rangeModule = dataUrl(`const limits=${JSON.stringify(sizeLimits)}; export function getWindowSliderRange(scope, axis) {
    const range=limits[scope][axis==='x'?'width':axis==='y'?'height':axis]; return { minM:range.minMm/1000, maxM:range.maxMm/1000 };
  }`);
  const { createLayoutSizingManager, getOverallLayoutDimensions } = await import(dataUrl(managerSource.replace("'./window-settings.js'", JSON.stringify(rangeModule))));
  let state = {
    gridTracks: { x: [{ start: 0, end: 1, sizeM: 1.487 }, { start: 1, end: 2, sizeM: 1.487 }], y: [{ start: 0, end: 1, sizeM: 1.474 }] },
    windows: [{ id: 'left', rect: { x0: 0, x1: 1, y0: 0, y1: 1 } }, { id: 'right', rect: { x0: 1, x1: 2, y0: 0, y1: 1 } }],
  };
  const controller = {
    getWindowState: () => state,
    getConfigurationSnapshot: () => ({ windowState: state }),
    applyConfiguration: async ({ windowState }) => { state = windowState; return { windowState }; },
  };
  const manager = createLayoutSizingManager({ controller, widthMaxM: 25, heightMaxM: 25 });
  return { manager, state: () => state, dimensions: () => getOverallLayoutDimensions(state) };
}
const narrowLimits = () => ({
  overall: { width: { minMm: 2000, maxMm: 4000 }, height: { minMm: 1000, maxMm: 3000 } },
  individual: { width: { minMm: 700, maxMm: 2000 }, height: { minMm: 800, maxMm: 2000 } },
});
test('overall sizing respects published lower/upper bounds in preview and committed geometry', async () => {
  const { manager, dimensions } = await sizingHarness(narrowLimits());
  const preview = manager.previewOverall({ widthM: 100, heightM: .1 });
  assert.ok(Math.abs(preview.gridTracks.x.reduce((sum, track) => sum + track.sizeM, .026) - 4) < 1e-6);
  await manager.resizeOverall({ widthM: 100, heightM: .1 });
  assert.deepEqual(dimensions(), { widthM: 4, heightM: 1 });
  await manager.resizeOverall({ widthM: .1, heightM: 100 });
  assert.deepEqual(dimensions(), { widthM: 2, heightM: 3 });
});
test('individual resizing respects published caps and keeps overall size and sibling minimums', async () => {
  const { manager, state, dimensions } = await sizingHarness(narrowLimits());
  await manager.resizeWindow('left', { widthM: 100 });
  assert.ok(Math.abs(state().gridTracks.x[0].sizeM + .013 - 2) < 1e-6);
  assert.equal(dimensions().widthM, 3);
  await manager.resizeWindow('left', { widthM: .1 });
  assert.ok(Math.abs(state().gridTracks.x[0].sizeM + .013 - .7) < 1e-6);
  assert.equal(dimensions().widthM, 3);
});
test('multi-window geometry can raise the overall minimum without extending the published maximum', async () => {
  const limits = narrowLimits(); limits.individual.width.minMm = 1800;
  const { manager, dimensions } = await sizingHarness(limits);
  assert.equal(manager.getMinimumDimensions().widthM, 3.6);
  await manager.resizeOverall({ widthM: 1 }); assert.equal(dimensions().widthM, 3.6);
});
test('an impossible layout/minimum combination stays unchanged rather than silently widening the maximum', async () => {
  const limits = narrowLimits(); limits.overall.width.maxMm = 2000; limits.individual.width.minMm = 1500;
  const { manager, dimensions } = await sizingHarness(limits);
  assert.equal(manager.getMinimumDimensions().widthM, 3);
  await manager.resizeOverall({ widthM: 10 }); assert.equal(dimensions().widthM, 3);
});
test('window settings page has separate accessible menus and a same-style, isolated interactive preview', async () => {
  const html = await read('website/public/edit/window-configurator/index.html');
  assert.match(html, /<details[^>]+id="colors-menu"/); assert.match(html, /<details[^>]+id="sizes-menu"/);
  assert.match(html, /id="window-size-fields"/); assert.match(html, /<iframe[^>]+title="Window configurator controls preview"/);
  const preview = await read('window-configurator/src/client/editor-preview.html');
  for (const control of sizeModel.WINDOW_SIZE_CONTROLS) {
    assert.ok(preview.includes(`id="${control.rangeId}"`)); assert.ok(preview.includes(`id="${control.valueId}"`));
  }
  assert.match(preview, /\.\/shared-shell\.css\?v=4/); assert.match(preview, /\.\/css\/styles\.css\?v=3/);
  assert.match(preview, /finish-mode-toggle/); assert.match(preview, /finish-type-toggle/); assert.match(preview, /finish-swatches/);
  const script = await read('window-configurator/src/client/js/editor-preview.js');
  assert.match(script, /event\.origin !== location\.origin \|\| event\.source !== window\.parent/);
  assert.doesNotMatch(script, /saveConfiguratorColors|signInWithGoogle|innerHTML/);
  const limits = await read('window-configurator/src/client/js/window-size-limits.js');
  assert.match(limits, /MAX_INDIVIDUAL_WINDOW_WIDTH_M = 2\.5/);
  assert.match(limits, /MAX_OPENING_SASH_WEIGHT_KG = 130/);
});
test('release validation catches a missing new window preview and its editor stylesheet', () => releaseFixture(async ({ temporary, validate }) => {
  await rm(path.join(temporary, 'dist/window-configurator-build/editor-preview.html'));
  await rm(path.join(temporary, 'shared-ui/styles/windowSettingsEditor.css'));
  const result = validate(); assert.equal(result.status, 1);
  assert.match(result.stderr, /window-configurator\/editor-preview\.html/);
  assert.match(result.stderr, /shared-ui\/styles\/windowSettingsEditor\.css/);
}));

test('window settings schema imports resolve in source tooling and domain-root releases', async () => {
  const schema = await read('shared-ui/src/windowSizeSettings.js');
  for (const file of ['window-settings.js', 'window-size-limits.js', 'editor-preview.js']) {
    const filename = `window-configurator/src/client/js/${file}`;
    const source = await read(filename);
    const specifier = source.match(/from '([^']*windowSizeSettings\.js[^']*)'/)?.[1];
    assert.ok(specifier, filename);
    assert.equal(await readFile(new URL(specifier, new URL(filename, root)), 'utf8'), schema);
    for (const prefix of ['/window-configurator/js/', '/configurator-ferestre/js/', '/fenster-konfigurator/js/', '/js/']) {
      assert.equal(new URL(specifier, `https://example.test${prefix}${file}`).pathname, '/shared-ui/src/windowSizeSettings.js');
    }
  }
});
