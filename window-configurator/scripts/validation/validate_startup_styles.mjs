import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function attributes(tag) {
  const result = new Map();
  const source = tag.replace(/^<\/?[\w-]+/, '').replace(/\/?\s*>$/, '');
  for (const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function hasClass(tag, name) {
  return (attributes(tag).get('class') || '').split(/\s+/).includes(name);
}

function validate(indexPath, shellPath, label) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const shell = fs.readFileSync(shellPath, 'utf8');
  const version = shell.match(/\bconst\s+SHARED_STANDALONE_STYLE_VERSION\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(version, `${label}: cannot find the shared shell's stylesheet version.`);

  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].filter(([tag]) => {
    const attrs = attributes(tag);
    return (attrs.get('rel') || '').split(/\s+/).includes('stylesheet')
      && /shared-ui\/styles\/standalone\.css(?:[?#]|$)/.test(attrs.get('href') || '');
  });
  assert.equal(links.length, 1, `${label}: load exactly one shared standalone stylesheet in <head>.`);
  const link = attributes(links[0][0]);
  const url = new URL(link.get('href'), 'https://startup-test.invalid/');
  assert.equal(url.searchParams.get('v'), version[1],
    `${label}: stylesheet version must match ${version[1]}; a mount-time href replacement causes the unstyled SVG flash.`);
  assert.ok(!link.has('disabled') && (!link.has('media') || link.get('media') === 'all'),
    `${label}: the shared stylesheet must apply before first paint, not load as a disabled/print-only sheet.`);
  assert.ok(!link.has('onload'), `${label}: do not defer stylesheet activation with an onload handler.`);
  const firstModule = head.search(/<script\b[^>]*\btype\s*=\s*['"]module['"]/i);
  assert.ok(firstModule < 0 || links[0].index < firstModule,
    `${label}: the shared stylesheet must precede the module entry points.`);

  // The shared shell adopts an existing body/footer. Keep the initial markup in
  // that final layout so attaching the shell cannot change the panel's padding,
  // scroll container or reserved footer space while the CAD model is loading.
  const controls = [...html.matchAll(/<div\b[^>]*>/gi)]
    .find(([tag]) => attributes(tag).get('id') === 'controls');
  assert.ok(controls, `${label}: missing settings panel.`);
  assert.ok(hasClass(controls[0], 'shared-configurator-panel'), `${label}: missing initial shared-panel class.`);
  const panelAttrs = attributes(controls[0]);
  assert.equal(panelAttrs.get('data-shared-panel-layout'), 'managed', `${label}: panel must start in its managed layout.`);
  assert.match(panelAttrs.get('style') || '', /padding\s*:\s*0(?:px)?\s*!important/i,
    `${label}: outer panel padding must already be moved into the scroll body.`);
  const afterPanel = html.slice(controls.index + controls[0].length);
  const bodyTag = afterPanel.match(/^\s*(<div\b[^>]*>)/i)?.[1];
  assert.ok(bodyTag && hasClass(bodyTag, 'shared-configurator-panel__body'),
    `${label}: the first panel child must be the existing shared scroll body.`);
  assert.match(attributes(bodyTag).get('style') || '', /padding\s*:\s*24px\s*;?$/i,
    `${label}: preserve the original 24px content padding.`);
  const footerTags = [...html.matchAll(/<footer\b[^>]*>/gi)]
    .filter(([tag]) => attributes(tag).has('data-shared-configurator-panel-footer'));
  assert.equal(footerTags.length, 1, `${label}: reserve one shared quote footer, not a duplicate.`);
  assert.ok(hasClass(footerTags[0][0], 'shared-configurator-panel__footer'),
    `${label}: the quote footer must have its layout class before shell mount.`);
  assert.match(html.slice(footerTags[0].index + footerTags[0][0].length),
    /^\s*<\/footer>\s*<\/div>\s*<button\b[^>]*\bid=["']sidebar-toggle["']/i,
    `${label}: the empty quote footer must be the last direct child of the panel.`);

  console.log(`[window-startup] OK ${label}: CSS v${version[1]} and initial managed panel layout.`);
}

try {
  validate(
    path.join(projectRoot, 'src/client/index.html'),
    path.join(projectRoot, '../shared-ui/src/standaloneShell.js'),
    'src/client/index.html',
  );
  // A prepared site carries its own shared UI snapshot: compare against that
  // copy, not a potentially newer workspace version.
  const builtIndex = path.join(projectRoot, 'dist/site/index.html');
  if (fs.existsSync(builtIndex)) {
    validate(builtIndex, path.join(projectRoot, 'dist/site/shared-ui/src/standaloneShell.js'), 'dist/site/index.html');
  }
} catch (error) {
  console.error(`[window-startup] ${error.message}`);
  process.exitCode = 1;
}
