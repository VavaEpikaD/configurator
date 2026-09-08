/** Engine-independent triangle subdivision, shared by manufactured-profile adapters. */
const EPSILON = 1e-9;

function clonePoint(point) {
    return { x: point.x, y: point.y, z: point.z, scalar: point.scalar };
}

function interpolatePoint(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        scalar: 0,
    };
}

function clipPolygon(vertices, keepPositive) {
    if (!vertices.length) return [];

    const result = [];
    const isInside = value => keepPositive ? value >= -EPSILON : value <= EPSILON;

    for (let index = 0; index < vertices.length; index += 1) {
        const current = vertices[index];
        const next = vertices[(index + 1) % vertices.length];
        const currentInside = isInside(current.scalar);
        const nextInside = isInside(next.scalar);

        if (currentInside) {
            result.push(clonePoint(current));
        }

        if (currentInside !== nextInside) {
            const denominator = current.scalar - next.scalar;
            const t = Math.abs(denominator) <= EPSILON
                ? 0
                : current.scalar / denominator;
            result.push(interpolatePoint(current, next, t));
        }
    }

    return result;
}

function triangulatePolygon(vertices) {
    if (vertices.length < 3) return [];
    const triangles = [];
    for (let index = 1; index < vertices.length - 1; index += 1) {
        triangles.push([
            vertices[0],
            vertices[index],
            vertices[index + 1],
        ]);
    }
    return triangles;
}

export function splitTriangleAtScalarZero(vertices) {
    const normalized = vertices.map(vertex => ({
        x: Number(vertex.x) || 0,
        y: Number(vertex.y) || 0,
        z: Number(vertex.z) || 0,
        scalar: Number(vertex.scalar) || 0,
    }));

    const hasPositive = normalized.some(vertex => vertex.scalar > EPSILON);
    const hasNegative = normalized.some(vertex => vertex.scalar < -EPSILON);

    if (!hasPositive || !hasNegative) {
        return [normalized.map(clonePoint)];
    }

    return [
        ...triangulatePolygon(clipPolygon(normalized, true)),
        ...triangulatePolygon(clipPolygon(normalized, false)),
    ];
}


function resolveScalar(resolver, point, index) {
    const value = Number(resolver(point, index));
    if (!Number.isFinite(value)) throw new RangeError('A cut resolver returned a non-finite scalar.');
    return value;
}

/**
 * Position-only intermediate mesh operations. They preserve the source, winding
 * and triangulation order. They intentionally discard UVs/normals/material
 * groups, and do NOT add cut caps. Use before adapter deformation, then finalize
 * normals/UVs; never use as a general-purpose solid boolean or on skinned meshes.
 */
export function splitPositionGeometryAtScalarZero(THREE, geometry, scalarResolver) {
    if (!geometry?.isBufferGeometry || !geometry.getAttribute('position')) throw new TypeError('Position geometry is required.');
    if (typeof scalarResolver !== 'function') throw new TypeError('A scalar resolver is required.');
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    try {
        const positions = source.attributes.position;
        const output = [];

        for (let base = 0; base + 2 < positions.count; base += 3) {
            const triangle = [];
            for (let offset = 0; offset < 3; offset += 1) {
                const index = base + offset;
                const point = {
                    x: positions.getX(index),
                    y: positions.getY(index),
                    z: positions.getZ(index),
                };
                triangle.push({
                    ...point,
                    scalar: resolveScalar(scalarResolver, point, index),
                });
            }

            splitTriangleAtScalarZero(triangle).forEach(splitTriangle => {
                splitTriangle.forEach(point => {
                    output.push(point.x, point.y, point.z);
                });
            });
        }

        const result = new THREE.BufferGeometry();
        result.setAttribute('position', new THREE.Float32BufferAttribute(output, 3));
        result.computeBoundingBox();
        result.computeBoundingSphere();

        return result;
    } finally {
        if (source !== geometry) source.dispose();
    }
}

export function clipPositionGeometryToScalarHalfspace(THREE, geometry, scalarResolver) {
    if (!geometry?.isBufferGeometry || !geometry.getAttribute('position')) throw new TypeError('Position geometry is required.');
    if (typeof scalarResolver !== 'function') throw new TypeError('A scalar resolver is required.');
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    try {
        const positions = source.attributes.position;
        const output = [];
        const EPSILON = 1e-10;

        const interpolate = (a, b) => {
            const denominator = a.scalar - b.scalar;
            const t = Math.abs(denominator) <= EPSILON
                ? 0
                : a.scalar / denominator;
            return {
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t,
                z: a.z + (b.z - a.z) * t,
                scalar: 0,
            };
        };

        for (let base = 0; base + 2 < positions.count; base += 3) {
            let polygon = [];
            for (let offset = 0; offset < 3; offset += 1) {
                const index = base + offset;
                const point = {
                    x: positions.getX(index),
                    y: positions.getY(index),
                    z: positions.getZ(index),
                };
                polygon.push({
                    ...point,
                    scalar: resolveScalar(scalarResolver, point, index),
                });
            }

            const clipped = [];
            for (let index = 0; index < polygon.length; index += 1) {
                const current = polygon[index];
                const previous = polygon[(index + polygon.length - 1) % polygon.length];
                const currentInside = current.scalar >= -EPSILON;
                const previousInside = previous.scalar >= -EPSILON;

                if (currentInside) {
                    if (!previousInside) clipped.push(interpolate(previous, current));
                    clipped.push(current);
                } else if (previousInside) {
                    clipped.push(interpolate(previous, current));
                }
            }

            if (clipped.length < 3) continue;
            for (let index = 1; index + 1 < clipped.length; index += 1) {
                [clipped[0], clipped[index], clipped[index + 1]].forEach(point => {
                    output.push(point.x, point.y, point.z);
                });
            }
        }

        const result = new THREE.BufferGeometry();
        result.setAttribute('position', new THREE.Float32BufferAttribute(output, 3));
        result.computeBoundingBox();
        result.computeBoundingSphere();

        return result;
    } finally {
        if (source !== geometry) source.dispose();
    }
}

