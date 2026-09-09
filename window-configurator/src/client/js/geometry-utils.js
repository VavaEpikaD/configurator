import * as THREE from 'three';
import { createRoundedRectangleShape, simplifySectionShape } from '../shared-3d/src/index.js?v=6';

// CAD/DXF exports contain circles and rounded profile edges as hundreds of
// tiny straight SVG segments. A sub-0.05 mm contour tolerance is visually
// imperceptible at real scale, but removes most redundant points before
// Three.js creates caps and extrusion side walls.
export const PROFILE_CURVE_SEGMENTS = 3;
const PROFILE_SIMPLIFY_TOLERANCE_MM = Object.freeze({
    alu: 0.04,
    epdm: 0.025,
    centralSeal: 0.025,
    glass: 0.03,
    iso: 0.05,
    foam: 0.05,
    default: 0.04,
});

export function simplifyProfileShape(sourceShape, materialKey) {
    const shape = simplifySectionShape(THREE, sourceShape, {
        tolerance: PROFILE_SIMPLIFY_TOLERANCE_MM[materialKey] ?? PROFILE_SIMPLIFY_TOLERANCE_MM.default,
        curveSegments: PROFILE_CURVE_SEGMENTS,
    });
    if (shape !== sourceShape) shape.userData.toleranceMm = shape.userData.tolerance;
    return shape;
}

export function createRoundedRectShape(width, height, radius) {
    return createRoundedRectangleShape(THREE, width, height, radius);
}
