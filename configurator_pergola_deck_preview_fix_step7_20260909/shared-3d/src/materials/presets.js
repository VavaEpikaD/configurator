// Material identities describe the visible surface, not the component underneath it.
// Values are calibrated starting points, not manufacturer-certified finish measurements.
export const MATERIAL_PRESETS = Object.freeze({
  'aluminium.powderCoated': Object.freeze({
    type: 'standard', color: '#383e42', metalness: 0, roughness: 0.58, envMapIntensity: 0.72,
    // Subtle fine-grain coating. It should read clean in a full product view
    // and become visible only at close range under grazing light.
    textureSet: 'powder.fine', texture: 'powder', normalStrength: 0.16, tile: [0.035, 0.035],
  }),
  'aluminium.bare': Object.freeze({
    type: 'standard', color: '#d6dade', metalness: 1, roughness: 0.3, envMapIntensity: 1.12,
    textureSet: 'aluminium.brushed', texture: 'brushed', normalStrength: 0.07, tile: [0.8, 0.025],
  }),
  'aluminium.anodized': Object.freeze({
    type: 'standard', color: '#bfc5ca', metalness: 0.85, roughness: 0.43, envMapIntensity: 0.96,
    textureSet: 'aluminium.brushed', texture: 'brushed', normalStrength: 0.05, tile: [0.8, 0.025],
  }),
  'glass.clear': Object.freeze({
    type: 'glass', color: '#ffffff', metalness: 0, roughness: 0.045, envMapIntensity: 1,
    ior: 1.5, transmission: 0.96, thickness: 0.006,
  }),
  'wood.deck': Object.freeze({
    type: 'standard', color: '#ffffff', metalness: 0, roughness: 0.76, envMapIntensity: 0.28,
    texture: 'oak', textureSet: 'wood.deck', normalStrength: 0.12, assetNormalStrength: 0.14,
    tile: [2.4, 0.24], assetTile: [1.5, 1.5],
  }),
  'wood.oak': Object.freeze({
    type: 'standard', color: '#ffffff', metalness: 0, roughness: 0.76, envMapIntensity: 0.28,
    texture: 'oak', normalStrength: 0.12, tile: [2.4, 0.24],
  }),
});
