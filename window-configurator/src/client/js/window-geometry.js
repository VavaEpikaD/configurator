import * as THREE from 'three';
import { GeometryLibrary, disposeObjectResources } from '../shared-3d/src/index.js?v=2';

/** Window owns CAD transforms, profile choice, join rules and assembly placement. */
export function createWindowGeometry(library = null, { captureMode = false } = {}) {
    const geometry = library ?? new GeometryLibrary(THREE);
    const shadows = !captureMode;
    const surfaceUV = material => (Array.isArray(material) ? material : [material])
        .some(entry => entry?.userData?.surface) ? {} : false;
    return {
        library: geometry,
        // The source's XY may be millimetres while Z is a unit-depth parameter.
        // Do NOT globally scale this template; the CAD adapter transforms XYZ.
        profile(shape, settings) {
            return geometry.create('profile.extrusion', { shape, settings }, { units: 'source' });
        },
        solidProfile(shape, settings) {
            return geometry.create('profile.extrusion', { shape, settings });
        },
        clone: source => geometry.clone(source),
        mesh(source, material, options = {}) {
            return geometry.mesh(source, material, {
                uv: surfaceUV(material), castShadow: shadows, receiveShadow: shadows, ...options,
            });
        },
        panel(width, height, thickness, material) {
            return geometry.mesh(geometry.create('panel.rectangular', { width, height, thickness }), material, {
                castShadow: false, receiveShadow: shadows, role: 'glazing',
            });
        },
        prepare(source, material, options = {}) {
            return geometry.prepare(source, { uv: surfaceUV(material), ...options });
        },
        split: (source, resolver) => geometry.splitAtScalarZero(source, resolver),
        clip: (source, resolver) => geometry.clipToScalarHalfspace(source, resolver),
        disposeGenerated(root, retainedGeometries = new Set()) {
            return disposeObjectResources(root, {
                geometryFilter: item => !retainedGeometries.has(item),
                materialFilter: (_material, object) => object.isSprite === true,
                ownedTextures: material => [material.map],
            });
        },
    };
}
