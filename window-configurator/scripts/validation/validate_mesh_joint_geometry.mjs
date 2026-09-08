import assert from 'node:assert/strict';
import { splitTriangleAtScalarZero } from '../../../shared-3d/src/geometry/scalarGeometry.js';

const result = splitTriangleAtScalarZero([
    { x: -2, y: 0, z: 0, scalar: -2 },
    { x: 2, y: 0, z: 0, scalar: 2 },
    { x: 2, y: 1, z: 0, scalar: 2 },
]);

assert.ok(result.length >= 2, 'Crossing triangle should be split.');
const inserted = result.flat().filter(point => Math.abs(point.scalar) < 1e-9);
assert.ok(inserted.length >= 2, 'Split must insert centerline vertices.');
assert.ok(inserted.some(point => Math.abs(point.x) < 1e-9), 'Expected a vertex at x=0.');

const untouched = splitTriangleAtScalarZero([
    { x: 1, y: 0, z: 0, scalar: 1 },
    { x: 2, y: 0, z: 0, scalar: 2 },
    { x: 1, y: 1, z: 0, scalar: 1 },
]);
assert.equal(untouched.length, 1, 'Triangle on one side must remain one triangle.');

console.log('Mesh joint geometry validation passed.');
