/**
 * Dispose each selected resource once, even when meshes share it. Does not
 * detach/clear objects, preserving the host's pooling and scene-graph policy.
 * Materials/textures are deliberately opt-in: most profile materials and PBR
 * maps outlive a product rebuild. Return owned textures from the explicit
 * callback; never discover/dispose every material map indiscriminately.
 */
export function disposeObjectResources(roots, {
  geometryFilter = () => true,
  materialFilter = () => false,
  ownedTextures = () => [],
} = {}) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  for (const root of (Array.isArray(roots) ? roots : [roots])) {
    root?.traverse?.(object => {
      if (object.geometry && geometryFilter(object.geometry, object)) geometries.add(object.geometry);
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (!material || !materialFilter(material, object)) continue;
        materials.add(material);
        for (const texture of ownedTextures(material, object) ?? []) if (texture) textures.add(texture);
      }
    });
  }
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}
