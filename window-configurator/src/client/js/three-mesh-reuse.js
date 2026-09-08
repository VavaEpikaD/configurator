// Thin compatibility layer around Three.js that reuses Mesh instances and,
// when possible, their BufferGeometry storage after scene groups are cleared.
//
// Window resizing rebuilds the logical assembly synchronously. The builder used
// to allocate a brand-new Mesh object for every profile on every rebuild even
// when the topology and vertex counts were unchanged. This pool keeps cleared
// meshes available and returns them from the next `new THREE.Mesh(...)` call.
// Internal builder references therefore point at the reused object immediately;
// there is no post-build swapping of meshes.

import * as THREE_BASE from '../lib/three.module.js';
export * from '../lib/three.module.js';

const MAX_POOL_SIZE = 768;
const meshPool = new Map();
const pooledMeshes = new WeakSet();
let pooledCount = 0;

function materialKey(material) {
    if (Array.isArray(material)) {
        return material.map(entry => entry?.uuid || 'null').join(',');
    }
    return material?.uuid || 'null';
}

function geometryLayoutKey(geometry) {
    if (!geometry?.isBufferGeometry) return 'none';
    const attributes = Object.keys(geometry.attributes || {})
        .sort()
        .map(name => {
            const attribute = geometry.getAttribute(name);
            return [
                name,
                attribute?.itemSize || 0,
                attribute?.count || 0,
                attribute?.normalized ? 1 : 0,
                attribute?.array?.constructor?.name || '',
            ].join(':');
        })
        .join('|');
    const index = geometry.index;
    const indexKey = index
        ? `${index.count}:${index.array?.constructor?.name || ''}`
        : 'none';
    return `${geometry.type || 'BufferGeometry'}|${attributes}|idx:${indexKey}`;
}

function poolKey(geometry, material) {
    return `${materialKey(material)}||${geometryLayoutKey(geometry)}`;
}

function canReuseGeometry(target, source) {
    if (!target?.isBufferGeometry || !source?.isBufferGeometry) return false;
    const targetNames = Object.keys(target.attributes || {}).sort();
    const sourceNames = Object.keys(source.attributes || {}).sort();
    if (targetNames.length !== sourceNames.length) return false;
    for (let index = 0; index < targetNames.length; index += 1) {
        if (targetNames[index] !== sourceNames[index]) return false;
        const targetAttribute = target.getAttribute(targetNames[index]);
        const sourceAttribute = source.getAttribute(sourceNames[index]);
        if (
            !targetAttribute
            || !sourceAttribute
            || targetAttribute.itemSize !== sourceAttribute.itemSize
            || targetAttribute.count !== sourceAttribute.count
            || targetAttribute.normalized !== sourceAttribute.normalized
            || targetAttribute.array?.constructor !== sourceAttribute.array?.constructor
        ) {
            return false;
        }
    }
    const targetIndex = target.index;
    const sourceIndex = source.index;
    if (Boolean(targetIndex) !== Boolean(sourceIndex)) return false;
    if (targetIndex && (
        targetIndex.count !== sourceIndex.count
        || targetIndex.array?.constructor !== sourceIndex.array?.constructor
    )) {
        return false;
    }
    return true;
}

function copyGeometryInto(target, source) {
    for (const name of Object.keys(source.attributes || {})) {
        const targetAttribute = target.getAttribute(name);
        const sourceAttribute = source.getAttribute(name);
        targetAttribute.array.set(sourceAttribute.array);
        targetAttribute.needsUpdate = true;
    }

    if (target.index && source.index) {
        target.index.array.set(source.index.array);
        target.index.needsUpdate = true;
    }

    target.clearGroups();
    for (const group of source.groups || []) {
        target.addGroup(group.start, group.count, group.materialIndex);
    }
    target.setDrawRange(source.drawRange.start, source.drawRange.count);
    target.name = source.name || '';
    target.userData = { ...(source.userData || {}) };
    target.boundingBox = source.boundingBox?.clone?.() || null;
    target.boundingSphere = source.boundingSphere?.clone?.() || null;

    // Morph data is uncommon in the window model. If it appears, preserve
    // correctness rather than attempting unsafe in-place reuse.
    const morphNames = Object.keys(source.morphAttributes || {});
    if (morphNames.length) return false;

    return true;
}

function resetMesh(mesh, geometry, material) {
    const previousGeometry = mesh.geometry;
    let reusedGeometry = false;

    if (canReuseGeometry(previousGeometry, geometry)) {
        reusedGeometry = copyGeometryInto(previousGeometry, geometry);
    }

    if (reusedGeometry) {
        geometry.dispose();
        mesh.geometry = previousGeometry;
    } else {
        mesh.geometry = geometry;
    }

    mesh.material = material;
    mesh.name = '';
    mesh.userData = {};
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.up.set(0, 1, 0);
    mesh.visible = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.renderOrder = 0;
    mesh.matrixAutoUpdate = true;
    mesh.matrixWorldAutoUpdate = true;
    mesh.layers.set(0);
    mesh.clear();
    mesh.updateMorphTargets?.();
    return mesh;
}

function releaseMesh(mesh) {
    if (
        !mesh?.isMesh
        || mesh.isSkinnedMesh
        || mesh.children?.length
        || pooledMeshes.has(mesh)
        || pooledCount >= MAX_POOL_SIZE
    ) {
        return;
    }

    const key = poolKey(mesh.geometry, mesh.material);
    const bucket = meshPool.get(key) || [];
    bucket.push(mesh);
    meshPool.set(key, bucket);
    pooledMeshes.add(mesh);
    pooledCount += 1;
}

function releaseSubtree(root) {
    root?.traverse?.(object => {
        if (object !== root && object?.isMesh) releaseMesh(object);
    });
}

function acquireMesh(geometry, material) {
    const key = poolKey(geometry, material);
    const bucket = meshPool.get(key);
    while (bucket?.length) {
        const mesh = bucket.pop();
        if (!bucket.length) meshPool.delete(key);
        if (!mesh) continue;
        pooledMeshes.delete(mesh);
        pooledCount = Math.max(0, pooledCount - 1);
        return resetMesh(mesh, geometry, material);
    }
    return null;
}

// Capture meshes immediately before Three.js detaches a cleared subtree. The
// window builder calls `geometry.dispose()` first; that only releases renderer
// resources, not the JavaScript geometry data, so compatible buffers can still
// be filled again and uploaded on the next render.
const originalClear = THREE_BASE.Object3D.prototype.clear;
if (!THREE_BASE.Object3D.prototype.__windowMeshReuseClearPatched) {
    Object.defineProperty(THREE_BASE.Object3D.prototype, '__windowMeshReuseClearPatched', {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
    });
    THREE_BASE.Object3D.prototype.clear = function clearWithMeshReuse() {
        for (const child of this.children || []) releaseSubtree(child);
        return originalClear.call(this);
    };
}

export class Mesh extends THREE_BASE.Mesh {
    constructor(geometry = new THREE_BASE.BufferGeometry(), material = new THREE_BASE.MeshBasicMaterial()) {
        const reused = acquireMesh(geometry, material);
        if (reused) return reused;
        super(geometry, material);
    }
}

// Small diagnostics hook for profiling without coupling the application to the
// reuse implementation.
export function getWindowMeshReuseStats() {
    return Object.freeze({ pooledMeshes: pooledCount, poolBuckets: meshPool.size });
}
