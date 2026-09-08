import { createHash } from 'node:crypto';

export function productGeometrySnapshot(root) {
  root.updateMatrixWorld(true);
  const hash = createHash('sha256'), meshes = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    geometry.computeBoundingBox();
    // Include every original buffer, not UUID/userData or lazy derived bounds.
    for (const key of Object.keys(geometry.attributes).sort()) {
      const attribute = geometry.attributes[key];
      hash.update(key); hash.update(JSON.stringify(Array.from(attribute.array)));
    }
    hash.update(JSON.stringify(geometry.index ? Array.from(geometry.index.array) : null));
    hash.update(JSON.stringify(geometry.groups));
    hash.update(JSON.stringify(object.matrixWorld.toArray()));
    meshes.push({ count: geometry.attributes.position.count, indices: geometry.index?.count ?? 0,
      bounds: [geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray()],
      matrix: object.matrixWorld.toArray(), castShadow: object.castShadow, receiveShadow: object.receiveShadow });
  });
  return { hash: hash.digest('hex'), meshes };
}
