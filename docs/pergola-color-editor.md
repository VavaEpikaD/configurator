# Pergola color editor

## Page and scope

Open `https://360configurator.com/edit/pergola-configurator/` (the site's existing canonical-host redirect may lead to `www.360configurator.com`). Sign in with an existing authorized admin Google account.

This page edits only the pergola configurator. Its five groups are **Frame**, **Roof louvers**, **Screens**, **Privacy walls**, and **LED lighting**. Screens share one palette between manual and motorized screens. Every group supports adding and deleting colors, a native color picker, a six-digit hex field, editable display names, and a labeled picker preview.

The window editor remains at `/edit/window-configurator/`, with its existing three finish groups and its own published data. The `/edit/` redirect remains unchanged; no configurator dropdown is added.

Draft changes affect only the editor preview until **Save and publish** succeeds. Open or refresh the public pergola configurator afterward to load the published palette. Changes are stored centrally, not only in the admin's browser. Already-open public pages do not receive automatic live updates.

## Applying and deploying

Apply the patch at the repository root over the existing `window` branch editor code. No files need to be deleted. The implementation is based on `window` commit `bc85c879fe91a616a0696bf2ef316743bc725b11`.

`website/scripts/validate-static-release.mjs` preserves the earlier fix from `main` commit `0e10b1ea23a61216ec719f743275be90fa9313fd` and adds a mount for `/pergola-configurator/` pointing to `pergola-configurator/dist/`. It still checks that the actual target files exist. The existing Cloud Run workflow builds the pergola before validating the website, then assembles both into the final site. No unrelated changes from `main` are included.

Deploy **both** the updated Firebase backend and the rebuilt website/pergola assets. Deploying the backend first avoids exposing the new page while the backend still accepts only `window`.

The feature extends these existing Firebase functions; it does not introduce new function names:

- `getConfiguratorColorEditor`
- `saveConfiguratorColors`
- `getConfiguratorColors`

The existing Firebase deployment workflow already includes them. For an explicitly chosen manual deployment, use the normal authenticated Firebase CLI from the repository root:

```sh
cd firebase-share-backend
npx firebase-tools deploy --project configurator-360 \
  --only functions:getConfiguratorColorEditor,functions:saveConfiguratorColors,functions:getConfiguratorColors
```

Rebuild and deploy through the normal website/Cloud Run workflow to include the new static page, shared editor assets, and pergola bundle. There is no database migration or manual seeding step: the editor starts from the existing 28 built-in pergola colors until the first successful publication.

## Storage, validation, and compatibility

The pergola palette is stored at `configuratorColorPalettes/pergola`; the window palette remains at `configuratorColorPalettes/window`. Each product has independent revisions and immutable history snapshots. Reading or saving a pergola palette does not reset or overwrite a window palette.

Admin access is checked by the server on every editor read and save using the existing verified-account allowlist, account status, session validity, and allowed origins. The public endpoint returns only picker data and accepts no writes. Existing Firestore rules remain unchanged and continue to block direct browser writes to palette documents.

Each group must retain 1–100 colors. Names must contain 1–120 characters without control characters. Hex values must use `#RRGGBB`; duplicate hex values within a pergola group are rejected because pergola selections use hex values. The same hex may appear in different groups. Two admins cannot silently overwrite each other's changes: a stale editor must reload the published revision before saving.

Untouched built-in color names keep their existing translations. Renamed and newly added colors show the admin-entered name in every language. Names are rendered as text, not HTML.

Saved/shared configurations retain their existing hex selections, even when a color is subsequently removed from the available choices. This update does not silently recolor an existing design or change geometry, materials, pricing, or the stored model defaults. Select an available swatch to change the current model's color. The public palettes are refreshed on page load, with an eight-second request limit and built-in fallback palettes if the service is unavailable or its response is invalid.

## Validation

Run the automated regression suite from the repository root:

```sh
node --test scripts/validation/configurator-color-editor.test.mjs
```

The implementation passed 82 automated tests, including the existing window regressions, product-isolated backend transactions, input validation, public loading/fallback behavior, name rendering, and real release-validator execution against fixture release directories. Missing pergola/window build entries, shared editor assets, and unrelated broken links still fail validation.

It also passed 24 isolated Chromium browser checks using mocked authentication and services: five-group editing/publishing, fresh-page persistence, conflicts, unauthorized access, safe name rendering, window isolation, and layouts at 320, 390, 768, and 1440 pixels. These checks do not verify live Firebase login or production routing. Full Vite/website production builds and live deployment were not run in this environment.
