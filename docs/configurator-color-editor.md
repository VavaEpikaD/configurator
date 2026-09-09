# Window configurator color editor

Source baseline: `office-360design/configurator-360`, `window` branch, commit
`6d3cc58411681935ed1287c2360a9f47f2b203cf`.

## What is included

The dedicated `/edit/window-configurator/` page uses the existing Google sign-in. Only verified, enabled
accounts in the same four-account allowlist as the internal sales dashboard can
load or publish editor settings. The allowlist is enforced by the backend in
`firebase-share-backend/functions/configurator-colors.js`, not by a browser flag.

This page contains only window configurator settings. There is no configurator
dropdown, product list, or placeholder for other configurators. The old `/edit/`
address is now a redirect to `/edit/window-configurator/`, not a second editor.
The redirect replaces browser history and preserves query/hash parameters when
JavaScript is enabled; a meta redirect and link also work without JavaScript.

Window colors are edited separately for **Mill finish**, **Anodized**, and
**Color coated**. Each row has a native color picker, a six-digit hex field, an
editable display name, and a delete button. “Add color” creates a stable new ID.
The preview shows the unsaved picker. Switching finish tabs retains draft edits.
Each finish must retain 1–100 colors; names must contain 1–120 characters.

“Save and publish” saves all three finish groups together to Firestore. This is
shared server-side configuration, not localStorage or a browser-only change.
“Reload published colors” discards the local draft after confirmation. Conflicting
saves are rejected instead of overwriting another administrator's work.

## Apply and deploy

### Apply this route update over the previous ZIP

This is an **incremental update** for a repository that already has
`window_admin_color_editor_changed_files.zip` applied locally. Keep those earlier
files, then extract `window_editor_route_update_changed_files.zip` at the repository
root and overwrite matching files. No manual deletion or rollback is needed.

The update adds `website/public/edit/window-configurator/index.html` and overwrites
`website/public/edit/index.html` with the redirect. It also removes the product
selector and unrelated product metadata from the editor frontend/backend. The
existing function names, admin allowlist, palette document, publishing logic, and
window runtime integration are unchanged. No data migration is necessary.

Extract the ZIP **at the repository root**, preserving its paths. Do not extract
it into `website/` or `window-configurator/` alone. No CAD conversion is needed.

Both the Firebase feature and the static website/window source must be deployed
before the feature can be tested on the production domain. Merely uploading the
HTML page does not install its backend.

### 1. Firebase backend

The existing deployment workflow has been updated to export, validate, and deploy:

- `getConfiguratorColorEditor` — authenticated, admin-only editor read.
- `saveConfiguratorColors` — authenticated, admin-only publish.
- `getConfiguratorColors` — public GET of the published picker data, never a write.

Use your normal **Deploy Firebase share backend** workflow for the version that
contains these files. Its existing automatic trigger remains `main`; this patch
does not change branches or trigger a workflow. An authorized manual deployment
of only the new functions is also possible from `firebase-share-backend/`:

```sh
# Install backend dependencies first, if not already installed:
npm ci --prefix functions --ignore-scripts

npx firebase-tools deploy --project configurator-360 \
  --only functions:getConfiguratorColorEditor,functions:saveConfiguratorColors,functions:getConfiguratorColors
```

These commands require your existing Firebase/Google Cloud deployment access.
The functions reuse region `europe-west1`, project `configurator-360`, and the
existing runtime service account. No new secrets or browser API keys are needed.

The document `configuratorColorPalettes/window` and private
`configuratorColorPalettes/window/history/{revision}` snapshots are created on
the first successful publish. No initial seed or database migration is required.
Before that, the original 21 window colors are returned by the backend.

The existing Firestore rules default-deny access to this new collection and its
history. Browser clients use only the functions. **Do not add a public-write rule.**
No Firestore index or rules change is required by this patch.

### 2. Website and window assets

Run the normal static-site/Cloud Run release that includes these files.
`website/public/edit/window-configurator/index.html` and the old-address redirect
at `website/public/edit/index.html` are copied by the website public-assets build.
`shared-ui/` is copied by the existing site assembly, and the window static build
copies `src/client/` including the palette loader. The existing generic Nginx
static-file routing resolves the nested editor path; a marketing route or sitemap
entry is unnecessary.

For a manually assembled release, verify these final files exist:

```text
edit/index.html                       # old-address redirect only
edit/window-configurator/index.html  # the only editor page
shared-ui/src/configuratorEditor.js
shared-ui/src/configuratorColorApi.js
shared-ui/styles/configuratorEditor.css
window-configurator/js/config.js
window-configurator/js/materials.js
window-configurator/js/finish-catalog-loader.js
```

Deploy the updated window `config.js` and `materials.js` together with the new
loader. Copying only the editor leaves the public window palette unchanged.

### 3. Test on the website

Open `https://www.360configurator.com/edit/window-configurator/` (the apex domain
uses the site's existing canonical redirect) and sign in with an approved admin account. Add a
color, set its name, and choose **Save and publish**. Open or refresh the public
window configurator and select the corresponding finish group. The new swatch
and its name should be available, including when inside/outside finishes differ.
Also verify that an ordinary account sees the access-denied screen, and that
opening `/edit/` redirects to the dedicated window editor.

## Runtime behavior and scope

Every freshly loaded window configurator reads the latest published palette with
`cache: no-store`. This includes localized public window routes and window
instances served from the same updated source. The palette is **global**, not
per-customer or per-tenant. Other configurators' palettes are untouched.

Already-open window tabs need a refresh after publishing; this first version does
not push changes into an in-progress configuration. The editor explicitly tells
admins when publication succeeds and when a refresh is needed.

Only finish presets are replaced. Aluminium material properties, glass and gasket
colors, CAD/debug colors, geometry, quantities, and pricing logic are unchanged.
Unchanged built-in names keep their existing translations. Added or renamed
colors use the administrator's name as plain text in every language, including
swatch labels and the selected-color label. There are no separate translation
fields in this pilot.

Existing preset IDs are kept when changing a name or hex value. A URL referring
to an existing preset uses its current published color; removed presets use the
window's existing fallback selection behavior. Editing the available palette
should therefore be treated as a catalog change, not a promise to preserve an
old saved configuration's rendered finish exactly.

If the public service is unavailable, malformed, or takes longer than eight
seconds, the window loads the original built-in palette rather than failing to
initialize. A warning is logged. New or removed colors therefore are not enforced
during that fallback. Admin read/save errors are not presented as successful
publishes; unsaved edits are retained unless access has been lost.

## Security boundary

As with the existing internal dashboard, this is a statically hosted sign-in
shell, not server-session-protected HTML. Anonymous visitors can retrieve the
shell and public client code; they cannot enter the authorized editor or publish
changes. Every editor read/write checks Firebase-authenticated identity against
the current verified account record, rejects disabled accounts and revoked
sessions, and restricts editor origins to the two `.com` hosts and localhost.
Manipulating hidden controls, email text, or JavaScript flags does not grant
backend access.

The public GET contains only palette fields, revision, and update time. It does
not return administrator identity or audit history. Transactions atomically save
the palette and an audit snapshot, with an expected-revision check to prevent
lost updates. Direct client database access is denied by existing rules.

## Validation

From the repository root, with Node.js 22 or newer:

```sh
node --test scripts/validation/configurator-color-editor.test.mjs
```

All **40 tests passed** after the route update. They execute the real backend
handlers with in-memory Auth/Firestore adapters and exercise the actual window
palette loader. They cover access restrictions, forged flags, revoked accounts,
origin checks, validation, add/delete/rename persistence, atomic audit writes,
conflicting saves, public-read-only behavior, fallback, factory palette parity,
and deployment wiring. The updated checks also verify the dedicated page path,
removal of the product dropdown/list, absolute asset URLs, and the old page's
redirect script, including query/hash preservation. They need no Firebase
credentials and make no network calls.

An additional **16 isolated Chromium browser checks passed** for this revision.
The new HTML, CSS, editor controller, and API client were loaded into a local DOM
with mocked authentication and request transport, not a live navigated website.
These checked access gating, add/delete/rename/hex fields, picker preview,
cross-finish drafts, publish/reload, invalid inputs, safe name rendering,
conflicts, sign-out, and revocation. Layouts at 1440, 1024, 768, 390, and 320 CSS
pixels had no horizontal overflow; no uncaught script errors occurred. Desktop
and mobile screenshots were inspected.

These are isolated tests, **not a live Firebase/OAuth, deployed-route, or full
production-build verification**. Browser URL navigation was unavailable in the
test environment; the new paths and redirect were checked in the automated
source/VM tests instead. Nothing was deployed or written to the remote repository.
Perform the live test above after your normal deployment.
