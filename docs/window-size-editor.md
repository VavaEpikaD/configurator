# Window settings editor: colors and size sliders

Route: `/edit/window-configurator/`.

## Applying this update

Extract the changed-files ZIP at the repository root over the current `window`
branch. No files need to be deleted. This update is based on
`06494fcd05f78a38e95be47d2bdda45db001201c` (the fence color-editor update), including
the earlier merge from `main`. The window geometry/builders, other product
editors, and the combined-site release validator are not replaced.

Deploy the updated Firebase backend first, then rebuild/deploy the website,
shared UI, and window assets using the normal deployment workflows. This update
extends the existing `getConfiguratorColorEditor`, `saveConfiguratorColors`, and
`getConfiguratorColors` functions; it adds no new function names, IAM roles,
Firestore rules, or dependencies. Include the new
`firebase-share-backend/functions/window-size-defaults.json` with the backend.

The window static build already copies the whole client tree and shared UI.
It will include the new `/window-configurator/editor-preview.html`, its script,
and its positioning stylesheet. Deploy that build together with the editor page;
otherwise the preview reports that its assets are unavailable. The updated editor
requires the new backend version marker, so an old backend cannot report a
successful size-settings save that it does not actually support.

## Editing

The **Colors** dropdown retains adding, deleting, recoloring and renaming the
existing Mill finish, Anodized and Color coated palettes.

The **Window sizes** dropdown exposes independent minimum and maximum values for
these four slider/number-field pairs, entered in whole millimetres:

| Controls | Default minimum | Default maximum |
| --- | ---: | ---: |
| Overall layout width | 450 mm | 25,000 mm |
| Overall layout height | 450 mm | 25,000 mm |
| Individual window width | 450 mm | 2,500 mm |
| Individual window height | 450 mm | 2,500 mm |

Each minimum must be less than its maximum. Values must be whole numbers between
450 and 25,000 mm. An individual axis maximum cannot exceed the corresponding
overall maximum. The 450 mm lower floor retains the existing geometry support;
this update does not introduce smaller profile assemblies.

**Save and publish** commits both sections in one transaction and one revision.
Reload asks before discarding drafts. Enter in a limit field validates the draft;
it does not publish it. Administrators still need the same server-verified Google
account authorization as before. Signing out or losing permission clears access.

## Preview

The preview uses the actual window configurator styles in an isolated same-origin
document, not the admin form's controls. It includes Uniform/Bicolor finish mode,
inside/outside finish types, color swatches with names, and the overall and
selected-window dimension sliders with number fields and one-millimetre buttons.
The open editor dropdown determines the preview section.

These are interactive control samples, not a second 3D configuration or a model
resize. Preview interactions never publish settings or alter a saved configuration.
Invalid size drafts show an error and use the last published limits in the preview
until the draft is valid again. Color names are rendered as text, not HTML.

## Public configurator behavior

Opening or refreshing the public window configurator reads the published colors
and size settings once, with caching disabled. The existing defaults remain the
fallback when the service is unavailable or when a legacy backend has no size
settings. No database migration or initial palette publication is required.

Published bounds apply to range inputs, number-field commits, plus/minus controls,
and the layout sizing manager's resize/preview requests. Overall slider maxima no
longer grow automatically while dragging. The individual minimum is checked
against other windows sharing the physical tracks. A layout may therefore impose
a higher overall minimum or narrower feasible individual resize than the nominal
slider range. When its geometric minimum is greater than the published overall
maximum, that overall axis is disabled rather than silently widening its range.

Changing the palette settings does not silently rescale saved/shared geometry.
A restored layout outside a new range still displays its actual numeric dimensions;
subsequent resize operations respect the published bounds. Existing layout
redistribution, modified-track locks, and frame offsets remain in use.

**Slider bounds are not manufacturing approvals.** The existing cart validation
still rejects individual leaves above 2,500 mm and opening sashes above its 130 kg
estimate. Raising a slider maximum does not remove those checks. Geometry,
material pricing, CAD profiles, and the house-background switching thresholds are
not redefined by these settings.

## Storage and compatibility

Window settings share the existing `configuratorColorPalettes/window` document.
A `sizeLimits` object and `windowSettingsVersion: 1` response field are added to
window responses. The database document stores `sizeLimits` with its existing
schema version, revision, author and update timestamp. The immutable audit snapshot
contains the same settings. Public responses continue to exclude administrator
identities and audit history.

Older window color-only clients preserve the stored size limits when publishing.
Their optimistic revision check still protects against overwriting a newer edit.
Pergola and fence keep separate documents and color-only payloads; they cannot
write window size settings through their product IDs.

## Validation

From the repository root:

```sh
node --test scripts/validation/configurator-color-editor.test.mjs
```

The tests include all previous window/pergola/fence color-editor regressions plus
size schema validation, authorization, atomic publication, old-client preservation,
revision conflicts, network fallbacks, unit conversions, source/build import paths,
release references, and layout sizing against published bounds.

Local Chromium checks use a network-free fixture with mocked Firebase
Authentication/API calls and production widget CSS excerpts. The editor and preview
ES modules are inlined for this fixture, with an opaque-origin message adapter;
this tests interactions and responsive layout but is not a deployed-origin test.
Full production builds, real Firebase sign-in, and final production routing must
still be verified through deployment.
