# Fence color editor

## Page and scope

Open `/edit/fence-configurator/` on `360configurator.com` (which redirects to the
canonical `www` host). It is a separate fence-only page, not a configurator dropdown.
The existing window and pergola editors and their palettes stay independent.

The fence currently has one **Fence finish** picker shared by its colored panels,
posts and gate frames. The initial entries exactly match the current fence:
Anthracite, Black, Traffic white, Bronze grey and Wood tone. An authorized admin
can add, delete, recolor and rename entries, preview their names, then choose
**Save and publish**. Each palette must keep 1–100 entries. IDs are stable and
unique; the picker can distinguish two IDs that happen to share the same hex value.

Unchanged built-in names retain their existing translations. Renamed/new names
appear verbatim in all languages. Names are rendered as text, never HTML.

## Persistence and access

This extends the existing `getConfiguratorColorEditor`, `saveConfiguratorColors`
and `getConfiguratorColors` functions. There are **no new function names, admin
roles, Firestore rules or dependencies**. The same server-verified admin allowlist,
revocation checks, origin restrictions, transaction revision checks and private
audit trail apply. A browser-supplied admin flag never grants access.

The published document is `configuratorColorPalettes/fence`; audit revisions are
stored below its `history` collection. Window/pergola documents are not changed.
Public visitors receive only palette display data through an anonymous, read-only,
non-cacheable GET. No authentication token or App Check is required for that read.

## Public configurator behavior

The public fence application loads its palette before creating the state and UI.
Open or refresh it after publishing. Existing open configurator tabs do not poll
or change underneath customers. On a failed/invalid/oversized response or an
8-second request/body timeout, the complete original palette is used instead.
A late response cannot overwrite the initialized choices.

Existing finish IDs keep their original price factors and material treatments.
New entries use the standard powder-coated treatment with a price factor of 1.
The editor does not change geometry, panel pricing, gates, hardware colors,
foundations or the pricing formula. Editing Wood tone applies a relative tint to
the existing wood texture; its grain, normals and roughness remain. The original
Wood tone color leaves the current texture unchanged. Bronze grey retains its
existing powder-coat material properties.

Newly captured/shared/cart states include a `finishSnapshot` containing only ID,
name and hex value. These states retain their chosen display color if it is later
recolored or deleted; a deleted entry is not reintroduced as a selectable swatch.
Legacy states without a snapshot resolve by their finish ID; deleted built-in IDs
can still use their original definition. New/reset configurations select an
available finish even when Anthracite has been deleted. Saved data cannot supply
price factors or replace material definitions.

## Deployment

Apply the files at the repository root over the merged `window` branch. This
update is based on `5cbf020a632190f1fb63245eabcccc90b4a5a250` (the merge from `main`).
No files need to be deleted. The existing window/pergola release-validator mount
fixes are preserved; the fence mount is added beside them.

1. Deploy the updated Firebase palette functions, including the new
   `firebase-share-backend/functions/fence-color-defaults.json`. The existing
   Firebase deployment workflow already deploys these three functions. For a
   targeted deployment from the repository root:

   ```sh
   cd firebase-share-backend
   npx firebase-tools deploy --project configurator-360 --only functions:getConfiguratorColorEditor,functions:saveConfiguratorColors,functions:getConfiguratorColors
   ```

2. Deploy the updated website/shared UI and fence sources through the existing
   Cloud Run site workflow. Backend first avoids a temporary unsupported-product
   response. The fence is copied as static files; it has no separate build command.
   The website release validator checks `/fence-configurator/` against that actual
   source directory, not against a nonexistent website-only build directory.

3. Hard-refresh once after deploying the JavaScript, sign in at the editor, publish
   a test color, then open/refresh the public fence configurator in another browser
   or private window. Check that a non-admin account cannot open the editor controls.

## Local verification

```sh
node --test scripts/validation/configurator-color-editor.test.mjs
```

The suite includes window/pergola regressions, fence admin authorization, validation,
product isolation, atomic publishing/audit history, conflict handling, public
loading and fallback, saved colors, trusted price metadata, wood/bronze material
selection, and website-only release validation before the final site is assembled.
It uses in-memory Firebase adapters and stubbed external services; it is not a
production deployment or a live authentication test.
