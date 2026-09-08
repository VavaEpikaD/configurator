// Keep "balanced" as the persisted middle-tier ID used by Common UI and old saves.
export const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({ pixelRatio: 1, shadows: false, shadowSize: 512, environmentWidth: 256, surfaceDetail: false, transmission: false, anisotropy: 1 }),
  balanced: Object.freeze({ pixelRatio: 1.5, shadows: true, shadowSize: 1024, environmentWidth: 512, surfaceDetail: true, transmission: true, anisotropy: 4 }),
  high: Object.freeze({ pixelRatio: 2, shadows: true, shadowSize: 2048, environmentWidth: 1024, surfaceDetail: true, transmission: true, anisotropy: 8 }),
});

export function normalizeQuality(value) {
  if (value === 'medium') return 'balanced';
  return Object.hasOwn(QUALITY_PROFILES, value) ? value : 'balanced';
}

export function getQualityProfile(value, { devicePixelRatio = 1, compact = false, capture = false } = {}) {
  const quality = capture ? 'low' : normalizeQuality(value);
  const base = QUALITY_PROFILES[quality];
  return {
    ...base,
    quality,
    // A phone retains the requested surface tier; only framebuffer/shadow budgets are capped.
    pixelRatio: Math.min(Math.max(0.5, Number(devicePixelRatio) || 1), base.pixelRatio, compact ? 1.5 : 2),
    shadowSize: Math.min(base.shadowSize, compact ? 1024 : 2048),
  };
}
