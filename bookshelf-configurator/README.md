# Modular Bookshelf Configurator

Client-specific 360Configurator implementation based on `Simulare_configurator_biblioteca_modulara.pdf`.

## Supported configuration

- Two mutually exclusive dimensional families:
  - Compact: straight 800 x 350 x 2150 mm; L-corner 800 x 800 x 2150 mm.
  - Tall: straight 900 x 350 x 2300 mm; L-corner 900 x 900 x 2300 mm.
- One height family applies to the complete connected configuration.
- Modules form a single continuous chain with a start and an end.
- Straight modules extend the current run.
- L-corner modules turn the run by 90 degrees left or right.
- Plus buttons are shown at both open endpoints.
- A geometrically closed loop hides both plus buttons.
- Non-adjacent path intersections are rejected so the configuration cannot branch through itself.
- Per-module door options:
  - Open / no doors.
  - Lower solid doors.
  - Full-height glazed doors (`usi vitrate`).
- Per-module finish colour.
- Module deletion keeps the remaining sequence connected by rebuilding the downstream path.
- Automatic aluminium connection sets are generated visually and in the component list for every module-to-module joint.
- Component list contains no prices.
- Shared Common UI provides save, share, undo, reset, account, language and preferences.
- Tools are limited to dimensions and view/camera.

## Product-reference assumptions kept deliberately conservative

The supplied client document specifies overall module dimensions, a 350 mm depth, the two door families, L-corner behavior and automatic aluminium connections. It does not provide manufacturing part numbers, exact connector quantities inside one connection set, board thicknesses or a full per-board BOM. The configurator therefore reports module-level components and one `Aluminium connection set` per joint instead of inventing unsupported individual hardware quantities.

The colour palette is a placeholder presentation palette because the supplied document does not define approved finishes. It is centralized in `js/app.js` and can be replaced with the client's exact finishes later.
