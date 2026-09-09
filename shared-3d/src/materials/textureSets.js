// Literal new URL() paths are intentional: Vite emits these local images; Window
// keeps this same module tree in its static build. No root-domain URL assumption.
export const PBR_TEXTURE_VERSION = '20260909-pbr-6';
export const PBR_TEXTURE_SETS = Object.freeze({
  'powder.fine': {
    detail: { size: 256, flipY: false, maps: {
      normal: new URL('../../assets/pbr/v1/powder-normal-256.png', import.meta.url).href,
      roughness: new URL('../../assets/pbr/v1/powder-roughness-256.png', import.meta.url).href,
    } },
  },
  'aluminium.brushed': {
    detail: { size: 256, flipY: false, maps: {
      normal: new URL('../../assets/pbr/v1/brushed-normal-256.png', import.meta.url).href,
      roughness: new URL('../../assets/pbr/v1/brushed-roughness-256.png', import.meta.url).href,
    } },
  },
  'wood.deck': {
    low: { size: 256, flipY: true, maps: {
      color: new URL('../../assets/pbr/v1/deck-color-256.jpg', import.meta.url).href,
    } },
    detail: { size: 512, flipY: true, maps: {
      color: new URL('../../assets/pbr/v1/deck-color-512.jpg', import.meta.url).href,
      normal: new URL('../../assets/pbr/v1/deck-normal-512.png', import.meta.url).href,
      roughness: new URL('../../assets/pbr/v1/deck-roughness-512.png', import.meta.url).href,
    } },
  },
});
