/**
 * Section-space shapes, engine-injected. Coordinates/tolerances use the SAME
 * caller-supplied units. No profile catalog, material tolerances or placement
 * rules belong here. Simplification is opt-in, never part of extrusion by default.
 */
function distanceToSegmentSquared(THREE, point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) return point.distanceToSquared(start);
    const t = THREE.MathUtils.clamp(
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
        0,
        1
    );
    const px = start.x + t * dx;
    const py = start.y + t * dy;
    const ox = point.x - px;
    const oy = point.y - py;
    return ox * ox + oy * oy;
}

function simplifyOpenPoints(THREE, points, toleranceSquared) {
    if (points.length <= 2) return points.slice();
    const first = points[0];
    const last = points[points.length - 1];
    let furthestIndex = -1;
    let furthestDistance = -1;

    for (let index = 1; index < points.length - 1; index += 1) {
        const distance = distanceToSegmentSquared(THREE, points[index], first, last);
        if (distance > furthestDistance) {
            furthestDistance = distance;
            furthestIndex = index;
        }
    }

    if (furthestDistance <= toleranceSquared || furthestIndex < 0) {
        return [first.clone(), last.clone()];
    }

    const left = simplifyOpenPoints(THREE, points.slice(0, furthestIndex + 1), toleranceSquared);
    const right = simplifyOpenPoints(THREE, points.slice(furthestIndex), toleranceSquared);
    return left.slice(0, -1).concat(right);
}

export function simplifyClosedContour(THREE, sourcePoints, tolerance) {
    if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new RangeError('A positive finite contour tolerance is required.');
    const toleranceSquared = tolerance * tolerance;
    const duplicateToleranceSquared = Math.max(1e-12, toleranceSquared * 0.0004);
    const points = [];

    for (const sourcePoint of sourcePoints || []) {
        const point = new THREE.Vector2(sourcePoint.x, sourcePoint.y);
        if (
            points.length === 0
            || point.distanceToSquared(points[points.length - 1]) > duplicateToleranceSquared
        ) {
            points.push(point);
        }
    }

    if (
        points.length > 1
        && points[0].distanceToSquared(points[points.length - 1]) <= duplicateToleranceSquared
    ) {
        points.pop();
    }
    if (points.length <= 3) return points;

    let oppositeIndex = 1;
    let maximumDistance = -1;
    for (let index = 1; index < points.length; index += 1) {
        const distance = points[0].distanceToSquared(points[index]);
        if (distance > maximumDistance) {
            maximumDistance = distance;
            oppositeIndex = index;
        }
    }

    const firstChain = points.slice(0, oppositeIndex + 1);
    const secondChain = points.slice(oppositeIndex).concat(points[0]);
    const simplifiedFirst = simplifyOpenPoints(THREE, firstChain, toleranceSquared);
    const simplifiedSecond = simplifyOpenPoints(THREE, secondChain, toleranceSquared);
    const simplified = simplifiedFirst.slice(0, -1).concat(simplifiedSecond.slice(0, -1));
    return simplified.length >= 3 ? simplified : points;
}

function appendClosedContour(path, points) {
    if (!points || points.length < 3) return false;
    path.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        path.lineTo(points[index].x, points[index].y);
    }
    path.closePath();
    return true;
}

export function simplifySectionShape(THREE, sourceShape, { tolerance = 0.04, curveSegments = 3, holeToleranceFactor = 0.8 } = {}) {
    if (typeof sourceShape?.extractPoints !== 'function' || !Array.isArray(sourceShape.holes)) throw new TypeError('A Three.js Shape is required.');
    if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new RangeError('A positive finite contour tolerance is required.');
    if (!Number.isInteger(curveSegments) || curveSegments < 1 || curveSegments > 4096) throw new RangeError('Invalid curve segment count.');
    if (!(holeToleranceFactor > 0) || !Number.isFinite(holeToleranceFactor)) throw new RangeError('Invalid hole tolerance factor.');
    const extracted = sourceShape.extractPoints(curveSegments);
    const sourcePointCount = extracted.shape.length
        + (extracted.holes || []).reduce((sum, hole) => sum + hole.length, 0);
    const outer = simplifyClosedContour(THREE, extracted.shape, tolerance);
    if (outer.length < 3) return sourceShape;

    const shape = new THREE.Shape();
    appendClosedContour(shape, outer);
    let optimizedPointCount = outer.length;
    for (const sourceHole of extracted.holes || []) {
        const holePoints = simplifyClosedContour(THREE, sourceHole, tolerance * holeToleranceFactor);
        const hole = new THREE.Path();
        if (appendClosedContour(hole, holePoints)) {
            shape.holes.push(hole);
            optimizedPointCount += holePoints.length;
        }
    }
    shape.userData = {
        sourcePointCount,
        optimizedPointCount,
        tolerance,
    };
    return shape;
}

export function createRoundedRectangleShape(THREE, width, height, radius) {
    if (![width, height].every(v => Number.isFinite(v) && v > 0) || !Number.isFinite(radius) || radius < 0) {
        throw new RangeError('Rectangle dimensions must be positive; radius must be finite and non-negative.');
    }
    const w = width / 2;
    const h = height / 2;
    const r = Math.min(radius, w, h);

    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    return shape;
}
