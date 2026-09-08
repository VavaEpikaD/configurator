# Cardboard Box Configurator

Static 3D corrugated-packaging configurator built on the shared 360Configurator interface.

## Box catalogue

The configurator offers nine approachable manufacturing-oriented structures while retaining the relevant FEFCO style or family:

1. Standard shipping box — FEFCO 0201
2. Full-overlap box — FEFCO 0203
3. Telescope lid box — FEFCO 03 family
4. Archive box — FEFCO 04 family
5. Pizza box — FEFCO 0426
6. Postal mailer — FEFCO 0427
7. Self-erecting / automatic-bottom box — FEFCO 07 ready-glued family
8. Two-point glued box — FEFCO 07 ready-glued family
9. Sleeve and drawer box — FEFCO 05 sliding-box family

Family-level codes remain intentionally broad until the customer's exact production constructions are confirmed.

## Closures and physical features

Top and bottom closures are configured independently and filtered according to the selected box type. The available structures include simple, folded, full-overlap and interlocking flaps, tuck and self-locking lids, telescope caps, hinged pizza/mailer lids, snap-lock and automatic bottoms, two-point glued bottoms, sleeves and drawers.

Handles, circular or oval holes, and ventilation slots are generated as actual cut-outs in the relevant box surfaces. Their dimensions, quantity and placement are configurable.

## Corrugated-board specification

The material model stores:

- CO3 single-wall or CO5 double-wall construction;
- E, B, C, EB or BC flute profile;
- TFT, AFT or AFA paper preset;
- an editable physical paper-layer stack with grade and grammage for every liner and fluting medium.

The summary uses this information to estimate board thickness, combined grammage, blank area, finished mass and price.

## Surface decoration

Double-click a box surface to open its decoration actions.

### Surface colours

A selected outside or inside surface can receive an individual palette colour. The active colour can also be applied to:

- every outside surface;
- every inside surface;
- every outside and inside surface.

Surface colour overrides are part of the saved/shared configuration state.

### Text

Text can be styled, previewed, placed, wrapped around connected edges, selected again, dragged, constrained, resized through font settings, edited and deleted. Existing text-selection guides and the manual lid-lift control remain supported.

### Images and logos

JPG and PNG files can be uploaded and placed on outside or inside vertical surfaces, the top/lid, and the bottom. Initial dimensions preserve the source aspect ratio:

- landscape artwork starts at half the selected face width;
- portrait artwork starts at half the selected face height.

Placed images can be selected again, dragged between surfaces, wrapped around connected edges, resized while preserving their proportions, lifted with the lid, or deleted.

Uploaded artwork is normalized client-side and stored as an immutable embedded snapshot. The configurator limits individual and aggregate image payload sizes so saved configurations, Share links, cart snapshots and quotation snapshots remain within the platform's document-size budget.

## Shared UI

The configurator uses `shared-ui/src/standaloneShell.js` for authentication, profile, Save/New Save, saved configurations, Share, cart and quotation flows, Help, Book a demo, language/domain switching, reset, undo and tenant access handling.
