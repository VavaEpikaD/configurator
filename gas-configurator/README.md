# Gas Pipe Configurator

Early-stage route and trench configurator for natural-gas distribution connections.

The current slice is deliberately preliminary. It provides route editing, synchronized
plan/profile/section views, a public-terrain elevation profile with editable pipe-depth controls,
a versioned PE pipe catalogue, multiple configurable route events, public road/rail/water
screening, variable-depth quantity estimates and traceable data-quality checks, plus a narrow
versioned regulatory screening pack. It does not replace the OSD connection solution, the ATR, a technical design, permits, survey, utility
location work or geotechnical investigation.

## Local development

```bash
npm install
npm run dev
```

The Vite server must be started from this folder. It is configured to allow imports from
the repository-level `shared-ui` package.

## Current prototype boundaries

- Underground PE distribution connection/extension scenarios only.
- Manual A/B points and optional waypoints.
- Terrain elevations are sampled automatically along the route from Mapzen Terrain Tiles;
  they are public screening data rather than surveyed design levels.
- Horizontal plan length, terrain-surface length and designed pipe-centreline length are shown.
  The last two values inherit the active terrain source, so they remain screening estimates when
  public or fallback terrain is used rather than surveyed levels.
- The longitudinal profile supports piecewise-linear cover control points. Users can add, drag,
  edit and remove manual controls; inherited A/B controls remain attached to the route endpoints.
  Excavation, backfill, preliminary work cost and procurement pipe length update from the designed
  profile rather than silently retaining a uniform-depth assumption.
- The company-supplied Vâlcea KMZ is displayed with its served UATs. An existing line can be
  selected as a geometric connection candidate, and point A can be snapped to its exact
  mapped position with a configurable tolerance.
- Ground and surface classifications are user assumptions.
- The versioned prototype catalogue currently contains PE100 and PE100-RC products for
  outside diameters 32, 40, 63, 90 and 110 mm, with SDR11 and SDR17 choices. It derives wall
  thickness, internal diameter and an indexed prototype rate; it is not a supplier catalogue,
  pressure-rating declaration or procurement quotation.
- Multiple utility, road, railway and watercourse crossing events can be added at route
  chainages. Each event records its source, confirmation state, crossing angle, corridor width,
  execution method and optional protective sleeve. Utility-crossing rules are evaluated for
  every configured utility event; special road/rail/water engineering rules remain outside the
  encoded rule pack.
- Public OpenStreetMap/Overpass screening detects geometric road, railway and waterway
  intersections and nearby features. Exact intersections can be promoted into editable project
  events. These results are orientation and screening data only, not verified survey or
  underground-utility evidence.
- Article 75 minimum cover, Articles 194/196 trench construction and Article 82 utility-
  crossing geometry are evaluated as preliminary checks with exact rule IDs and source links.
- Unit rates and rule results are visibly marked as prototype inputs or screening outputs.
- Hydraulic and official upstream-capacity calculations are intentionally deferred.

The existing-network connection result proves only coincidence with the supplied map
geometry. The KMZ does not contain design-grade location, diameter, material, pressure,
condition or available-capacity attributes, so the OSD must still establish and approve the
technical connection solution.

See [`docs/regulatory-notes.md`](docs/regulatory-notes.md) for the reviewed sources,
product boundaries, implemented rules and remaining review requirements.

## Versioned pipe catalogue and state model

The gas state is currently `schemaVersion: 4` and the product catalogue is
`RO-PE-PROTOTYPE@1`. Existing local saves from the former v1/v2/v3 keys are loaded and normalized
automatically. A legacy single `crossing` is migrated into one `routeEvents` entry while a
compatibility projection is retained for older calculation and rendering paths.

The normalized state now contains:

- `pipe`: the current default catalogue selection;
- `pipeSections`: route-chainage intervals prepared for later per-section material/diameter/SDR
  editing;
- `depthPoints`: editable cover controls with stable IDs, source metadata, inherited endpoints
  and optional route-event depth-zone roles;
- `routeEvents`: multiple source-aware utility/road/rail/watercourse crossings;
- `screening`: public obstacle-screening preferences.

The current UI still edits one default pipe selection; `pipeSections` remain a foundation for
later per-section product editing. The default cover remains the inherited value for route areas
without a manual control. In profile-edit mode, clicking the chart creates a manual control,
dragging changes its station and cover, and numeric controls expose ground, crown, centreline and
invert elevations. A/B endpoint controls are not removable and continue to follow route edits.
Crossing events with a configured corridor width can create locked entry/centre/exit stations;
their cover values remain editable while their chainages follow the event geometry.

Changing material, diameter or SDR now resolves a concrete catalogue product. SDR therefore
affects wall thickness, internal diameter and the indexed preliminary pipe rate instead of
being a display-only field. The catalogue caps the prototype design-pressure input at 6 bar;
that cap is only a product-scope guard and must not be read as an approved pressure rating for
every listed combination.

## Public road, railway and watercourse screening

The browser queries an Overpass endpoint for supported `highway`, `railway` and `waterway`
ways inside a padded route bounding box. The geometry engine then calculates exact plan
intersections, route chainage, acute crossing angle and nearest approach within the configured
proximity threshold. Requests are debounced, cancelled after route edits and cached in memory.

The default endpoint can be replaced at build time with `VITE_GAS_OVERPASS_URL` or at runtime
with `window.GAS_OVERPASS_ENDPOINT`. A failed or timed-out query is shown as unavailable and
does not block manual route-event configuration.

A detected exact crossing can be added to the project. The resulting route event keeps the
public feature ID and source, starts as unconfirmed, and appears in the map, longitudinal
profile, route-event editor and validation list. A nearby feature that does not geometrically
intersect the route remains a temporary screening result and cannot be promoted as a crossing.

Map intersections do not prove grade, construction method, ownership, surveyed position or
the absence/presence of underground utilities. Bridge, tunnel and layer metadata can also be
incomplete, so every promoted event must be checked against official plans and field data.

## Regulatory screening pack

The first rule pack is `RO-NTPEE-PE-PUBLIC-DOMAIN@2023-01-26.prototype-2`. Its scope is
limited to underground PE gas-distribution pipe in Romania's public domain at no more
than 6 bar. It currently evaluates:

- minimum 0.90 m cover from the pipe's upper generatrix under NTPEE Article 75;
- minimum trench width under Article 194: 0.40 m below DN 100, or 0.40 m plus
  the nominal diameter at DN 100 and above;
- a 0.10–0.15 m bed below the pipe made from 0.3–0.8 mm graded sand under Article 196;
- an explicit not-evaluated result for trench preparation and wall support that can only
  be verified during design/execution;
- documented approval from the owner of each crossed utility under Article 82;
- a normally perpendicular utility crossing under Article 82, with an exceptional minimum
  angle of 60 degrees;
- the normal requirement for the gas pipe to be at least 0.20 m above each crossed utility,
  with a declared protective sleeve treated as an exception requiring review.

Reduced cover is never automatically passed: when both OSD agreement and additional
protection are declared it remains a warning requiring documented authorized review.
Likewise, public map screening does not confirm a crossing. Promoted public crossings start
unconfirmed, and utility-owner plans/field verification remain separate evidence checks.
Road, railway and watercourse events receive an explicit `not-evaluated` result because the
applicable special-crossing rule packs have not yet been encoded.

For segments marked as sand/gravel, Article 194 dimensions remain case-specific and never
receive an automatic pass. Quantities and cost use the configured geometry even when a rule
blocks it; the application does not silently enlarge the trench.

## Terrain elevation profile

The browser samples the same public Terrarium tiles already used by the Solar configurator.
The source is the [Mapzen Terrain Tiles dataset on the AWS Registry of Open Data](https://registry.opendata.aws/terrain-tiles/).
For European routes, the dataset attribution states that the terrain data was produced using
Copernicus data and information funded by the European Union (EU-DEM layers).

The sampler includes every route vertex, adds intermediate chainage samples, caches decoded
tiles, cancels stale requests after route edits and limits the number of tiles requested. If
the source cannot be loaded, the profile visibly falls back to the two editable A/B elevation
values and remains dashed so screening data is not confused with surveyed levels.

The terrain and designed pipe-centreline lengths are both summed interval by interval as
`sqrt(horizontal distance² + elevation change²)`. Procurement pipe quantity uses the designed
centreline length plus the existing prototype allowance. This is useful for comparing profile
alternatives, but a public/fallback terrain source still does not turn the result into a surveyed
or procurement-approved length.

Excavation is integrated exactly over each piecewise-linear cover interval using the configured
trench width, pipe outside diameter and bedding thickness. Bedding/sand-envelope quantity remains
length-based under the existing prototype assumption; backfill is recalculated from excavation,
the sand envelope and pipe displacement. The results show minimum, maximum and average cover,
maximum trench depth and the excavation difference versus the same route at uniform default
cover.

The default tile template can be replaced at build time with
`VITE_GAS_TERRAIN_TILE_URL` or at runtime with `window.GAS_TERRAIN_TILE_ENDPOINT`.
