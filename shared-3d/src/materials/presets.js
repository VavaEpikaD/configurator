// Material identities describe the visible surface, not the component underneath it.
// Values are calibrated starting points, not manufacturer-certified finish measurements.
export const MATERIAL_PRESETS = Object.freeze({
  'aluminium.powderCoated': Object.freeze({
    type: 'standard', color: '#383e42', metalness: 0, roughness: 0.64,
    texture: 'powder', normalStrength: 0.13, tile: [0.025, 0.025],
  }),
  'aluminium.bare': Object.freeze({
    type: 'standard', color: '#d6dade', metalness: 1, roughness: 0.3,
    texture: 'brushed', normalStrength: 0.08, tile: [1, 0.025],
  }),
  'aluminium.anodized': Object.freeze({
    type: 'standard', color: '#bfc5ca', metalness: 0.85, roughness: 0.43,
    texture: 'brushed', normalStrength: 0.055, tile: [1, 0.025],
  }),
  'glass.clear': Object.freeze({
    type: 'glass', color: '#ffffff', metalness: 0, roughness: 0.045,
    ior: 1.5, transmission: 0.96, thickness: 0.006,
  }),
  'wood.oak': Object.freeze({
    type: 'standard', color: '#ffffff', metalness: 0, roughness: 0.76,
    texture: 'oak', normalStrength: 0.2, tile: [2.4, 0.24],
  }),
});
