# Regulatory boundary for the gas prototype

Checked on 2026-09-03. This note records product and implementation decisions for the
prototype; it is not legal or engineering advice.

## Sources reviewed

- User-supplied consolidated text of the Regulation on connection to the natural-gas
  distribution system, approved by ANRE Order 7/2022. The supplied copy is consolidated
  to 2024-03-21 and includes the amendment made by Order 136/2022.
- User-supplied `legi-norme-gaz.txt`, treated as a research index rather than an
  authoritative rule source. It contains at least one superseded/inconsistent reference
  to the connection regulation, so its entries must be verified individually.
- [Official ANRE technical-norms index](https://arhiva.anre.ro/ro/gaze-naturale/legislatie/reglementari-tehnice/norme-tehnice1387184362),
  which identifies Order 89/2018 as the technical norms for design, execution and
  operation of gas-supply systems and identifies Order 2/2023 as an amendment.
- [Official legislative portal entry for the Order 89/2018 norms](https://legislatie.just.ro/Public/DetaliiDocumentAfis/201310).
- [Official legislative portal entry for Order 2/2023](https://legislatie.just.ro/Public/DetaliiDocumentAfis/264378),
  the amendment reflected in the 2023-01-26 consolidation used by this prototype.
- [Official legislative portal entry for Order 7/2022](https://legislatie.just.ro/Public/DetaliiDocumentAfis/252209).

## Product consequences already encoded

Order 7/2022 is primarily a connection-process regulation, not a complete geometric
design rulebook. The supplied consolidation supports several important boundaries:

- Article 3 defines OEP and OEE as ANRE-authorized economic operators for design and
  execution. The prototype therefore never labels its output an approved design.
- Article 23 says the OSD establishes the technical connection solution while considering
  distribution capacity and operating regimes, the technical norms, safety, economic
  efficiency and environmental protection. Pipe geometry alone therefore cannot produce
  an official capacity or connection solution.
- Article 23 also makes placement part of the OSD solution. A route drawn by the user is
  consequently a screening proposal, even when the geometry itself is valid.
- ATR, survey/ground investigation, utility-owner information and authorized technical
  review are tracked as evidence states instead of being silently assumed.

The prototype follows those boundaries: route geometry, quantities and costs can be
explored, while throughput and official network capacity remain unresolved. A narrow
numeric rule pack is available for screening, with each result linked to its rule ID, pack
version and official source.

The company-supplied Vâlcea KMZ is treated as a presentation and screening source. Point A
may be snapped exactly to one of its mapped lines and the corresponding service UAT is
highlighted, but this is labelled as a geometric connection candidate rather than an OSD
connection solution. The source has no pipe diameter, material, pressure, condition or
available-capacity attributes and is not utility-locating evidence.

## Pipe catalogue boundary

Catalogue `RO-PE-PROTOTYPE@1` gives the configurator stable product IDs and physical
dimensions for the currently supported PE100/PE100-RC, diameter and SDR combinations.
Wall thickness and internal diameter are calculated from outside diameter and SDR.

The catalogue is not a declaration that every combination is approved for every Romanian
gas project. Its design-pressure limit and rates are prototype constraints. The rates are
indexed from the existing PE100 SDR11 baseline rather than obtained from a manufacturer or
supplier. Before BOM procurement or hydraulic sizing, the product set, dimensional standard,
pressure class, coefficients and commercial catalogue must be replaced or approved by the
responsible designer/operator.

## Implemented screening rules

Rule pack `RO-NTPEE-PE-PUBLIC-DOMAIN@2023-01-26.prototype-2` applies only to underground
PE distribution pipe in the public domain with design pressure up to and including 6 bar.
It is marked `requires-authorized-engineer-signoff` and implements:

1. `RO-NTPEE-075-COVER-001`: Article 75 minimum 0.90 m cover, measured from the upper
   generatrix of the pipe or protective sleeve. A reduction is blocked unless both OSD
   agreement and additional protection are declared; with both declarations it remains
   an exception warning, not a pass.
2. `RO-NTPEE-082-APPROVAL-001`: Article 82 requires the approval of the owner of the
   crossed installation or construction. Each configured utility crossing is blocked
   until that approval is declared as documented.
3. `RO-NTPEE-082-ANGLE-001`: Article 82 normally requires a perpendicular crossing. A
   configured angle from 60 degrees up to, but not perpendicular to, 90 degrees is treated
   as an exceptional warning; below 60 degrees is blocked.
4. `RO-NTPEE-082-SEPARATION-001`: Article 82 normally requires the gas pipe to be at least
   0.20 m above the crossed installation. If that relation is not met, the result is blocked
   unless a protective sleeve is declared, in which case it remains an exceptional warning.
5. `RO-NTPEE-194-WIDTH-001`: Article 194(2) sets the trench width at 0.40 m below DN 100,
   and at 0.40 m plus DN (expressed in metres) from DN 100 upward. The prototype interprets
   the selected PE nominal outside diameter as `DN`; this interpretation must be confirmed
   by the authorized reviewer. A segment classified as sand/gravel is kept `not-evaluated`
   because Article 194(4) requires case-specific dimensions for sandy/fill-type ground.
6. `RO-NTPEE-196-BEDDING-001`: Article 196(3) requires a 0.10–0.15 m bed of sand with
   0.3–0.8 mm grading. Thickness outside that range is blocked; missing material information
   is reported as missing, and another material is blocked.
7. `RO-NTPEE-196-PREPARATION-001`: Article 194(5) and Article 196(1)–(2) concern wall
   support, excavation timing and a level, clean trench bottom without stones or roughness.
   These remain `not-evaluated` because they need project-specific and execution-stage field
   verification rather than a self-declaration that could create a false pass.

Utility crossings are independent route events. Every event is evaluated separately and
its results include event identity and chainage, so one compliant crossing cannot conceal a
second unresolved or blocked crossing. Utility plan provenance (`missing`, utility-owner
plan, or field verified) remains an independent evidence result so plausible geometry cannot
conceal weak input data.

Quantity and cost calculations use the width and bedding thickness actually configured,
including when either value is blocked. The application does not silently enlarge the trench
to hide a regulatory mismatch. The 0.10 m sand surround above the pipe remains a fixed
prototype quantity assumption associated with Article 197; it is not yet an editable or
separately evaluated rule.

## Editable longitudinal depth profile

State schema v4 exposes piecewise-linear cover controls along the main route. The default A/B
controls inherit the global cover; manual and surveyed-labelled controls can override it between
stations. The profile derives pipe crown, centreline and invert elevations from the active terrain
source and selected pipe outside diameter.

The quantity engine integrates excavation over the resulting cover intervals and recalculates
backfill and preliminary work cost. It also reports terrain-surface length and designed
pipe-centreline length. When the source is public or fallback terrain, these remain screening
outputs rather than surveyed levels or approved procurement quantities. Marking a control as
`surveyed` is provenance metadata only; the prototype does not authenticate a survey file or the
person entering the value.

Minimum-cover screening now evaluates the minimum of the entire designed profile, not only the
global default field. Reduced-cover declarations still follow the same Article 75 exception
behaviour: they can prevent an immediate block only when both required declarations are present,
and the result remains a warning requiring authorized review.

A configured route event with a non-zero obstacle/corridor width can create entry, centre and
exit depth controls. Their station positions follow the event chainage and width, but the
prototype deliberately does not invent a required crossing depth. Missing or stale crossing
zones, duplicate controls and abrupt profile gradients are design warnings, not encoded legal or
engineering pass/fail rules. The current abrupt-gradient threshold is a prototype usability
warning and must not be treated as a gas-network slope requirement.

## Public road, railway and watercourse screening

The application can query OpenStreetMap geometry through Overpass and identify exact
plan-view intersections or features entering a configurable proximity buffer. Exact public
findings can be promoted to editable road, railway or watercourse route events. They start
unconfirmed and retain their source feature ID.

This is screening, not a regulatory conclusion:

- a plan-view intersection does not prove that two assets conflict vertically;
- bridge, tunnel and layer tags are useful hints but not design evidence;
- route/event angle is approximate and depends on public geometry quality;
- a nearby-only finding is not converted into a crossing;
- public basemaps cannot establish the position or absence of underground utilities;
- public data does not replace cadastral, road-administrator, railway-administrator,
  water-management, utility-owner, survey or field-verification documents.

The current regulatory pack intentionally returns `not-evaluated` for configured road,
railway and watercourse events. It does not yet encode special-crossing cover, sleeve,
installation-method, corridor, approval or restoration requirements.

## Rules intentionally not encoded yet

The current pack does not cover the Article 75 connection-endpoint depth, Article 30/Table 1
horizontal clearances, Article 194 welding-pit geometry, Article 195 pavement breakout widths,
detailed sleeve dimensions, or road, rail, water and protected-area crossing rules. Article
197's sand surround/backfill requirements are not yet independently configurable or evaluated.
The catalogue does not yet validate manufacturer-specific product availability or hydraulic
suitability.

Every additional numeric rule should follow the same registry contract:

1. jurisdiction and asset scope;
2. pressure/material/diameter/placement applicability conditions;
3. exact source, article/table and consolidation date;
4. normal rule, exceptions and required evidence;
5. `pass`, `warning`, `blocked` or `not-evaluated` behavior;
6. sign-off by a Romanian ANRE-authorized gas designer and verifier.

## Recommended next implementation slice

Have a Romanian ANRE-authorized gas designer and verifier review the current rule pack,
product catalogue assumptions, PE diameter interpretation, wording and exception behavior.
With editable pipe-depth controls now implemented, the most useful continuation is:

1. structured BOM rows for pipe, warning tape, sand, backfill, sleeves and crossing works;
2. full protective-sleeve configuration and quantities;
3. utility-owner GeoJSON/KML/KMZ import with provenance;
4. Article 30/Table 1 proximity/clearance rules after review;
5. CSV and printable/PDF report output from a versioned project snapshot;
6. branch-route topology, followed by approved hydraulic inputs and calculations.

Separately, replace the prototype KMZ schema with stable customer asset identifiers and
verified network attributes when the operator can supply them.
