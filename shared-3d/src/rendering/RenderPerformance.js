import { SceneRevision } from './SceneRevision.js?v=perf-15';
export const PERFORMANCE_VERSION = '20260909-perf-15';

/** Reuse unchanged frames and static shadows. Dynamic resolution is temporary:
 * only a slow moving view is reduced; settled/explicit renders use full quality.
 * The host still owns its animation/AR loop. No GPU readbacks or driver queries.
 */
export class RenderPerformance {
  constructor(THREE, renderer, scene) {
    this.renderer = renderer; this.scene = scene; this.revisions = new SceneRevision(THREE);
    this.profile = null; this.scale = 1; this.lastMotionAt = -Infinity; this.lastTick = null;
    this.motionSamples = 0; this.frameInterval = 0; this.lastScaleChange = -Infinity;
    this.drawnFrames = 0; this.skippedFrames = 0; this.hiddenFrames = 0; this.shadowUpdates = 0; this.shadowReuses = 0;
    this.lastCpuMs = 0; this.lastState = null; this.disposed = false;
    this.onResume = () => { this.revisions.invalidate(); this.lastTick = null; };
    renderer.domElement?.addEventListener?.('webglcontextrestored', this.onResume);
    globalThis.document?.addEventListener?.('visibilitychange', this.onResume);
  }
  setQuality(profile) {
    this.profile = profile; this.scale = 1; this.motionSamples = 0; this.frameInterval = 0; this.lastTick = null;
    this.lastMotionAt = -Infinity; this.revisions.invalidate();
  }
  invalidate() { this.revisions.invalidate(); }
  begin(camera, { onDemand = false, now = globalThis.performance?.now?.() ?? Date.now() } = {}) {
    if (onDemand && globalThis.document?.hidden) { this.hiddenFrames++; this.lastTick = null; return null; }
    const r = this.renderer, state = this.revisions.inspect(this.scene, camera, r);
    const special = r.xr?.isPresenting || camera.isArrayCamera || r.getRenderTarget?.() || this.scene.overrideMaterial || r.getScissorTest?.();
    // Partial-viewport and export/AR rendering always use the unmodified path.
    const vp = this.revisions.viewport, sz = this.revisions.size, pr = r.getPixelRatio?.() ?? 1;
    state.special = !!special || vp.x !== 0 || vp.y !== 0 || Math.abs(vp.z * pr - sz.x) > 1 || Math.abs(vp.w * pr - sz.y) > 1;
    const interval = this.lastTick === null ? 0 : now - this.lastTick; this.lastTick = now;
    const changedView = state.cameraChanged || state.sceneChanged || state.dynamic;
    if (changedView && !state.forced) this.lastMotionAt = now;
    const moving = now - this.lastMotionAt < 220;
    let nextScale = this.scale;
    if (!onDemand || state.special || !moving || !this.profile?.transmission) {
      nextScale = 1; this.motionSamples = 0; this.frameInterval = 0;
    } else if (changedView && interval >= 4 && interval <= 1000 && !state.viewportChanged && !state.forced) {
      const boundedInterval = Math.min(interval, 250);
      this.frameInterval = this.frameInterval ? this.frameInterval * .75 + boundedInterval * .25 : boundedInterval;
      this.motionSamples++;
      // Quantised changes, cooldown and a separate restore delay avoid per-frame
      // framebuffer reallocations. Do not count first-load/shader stalls as FPS.
      if (this.motionSamples >= 8 && now - this.lastScaleChange > 500) {
        if (this.frameInterval > 27 && this.scale > .66) nextScale = this.scale === 1 ? .82 : .66;
        else if (this.frameInterval < 18 && this.scale < 1) nextScale = this.scale === .66 ? .82 : 1;
      }
    }
    if (!state.special && this.profile) {
      const desired = this.profile.pixelRatio * nextScale;
      if (Math.abs((r.getPixelRatio?.() ?? desired) - desired) > .0001) {
        r.setPixelRatio(desired); state.changed = true; state.viewportChanged = true;
        state.revision = ++this.revisions.revision;
      }
      if (nextScale !== this.scale) { this.lastScaleChange = now; this.motionSamples = 0; }
      this.scale = nextScale;
      // r160 has no public transmission resolution control. Never pretend to
      // apply it or patch the vendored engine; use it only on supporting hosts.
      if ('transmissionResolutionScale' in r) {
        r.transmissionResolutionScale = moving && onDemand && nextScale < 1 ? .75 : 1;
      }
    }
    this.lastState = { ...state, moving: moving && onDemand, scale: this.scale };
    if (onDemand && !state.special && !state.changed && !state.dynamic) { this.skippedFrames++; return null; }
    return this.lastState;
  }
  end(state, elapsedMs) {
    this.drawnFrames++; this.lastCpuMs = elapsedMs;
    if (state.shadowUpdated) this.shadowUpdates++; else this.shadowReuses++;
    this.revisions.commit(this.renderer);
    if (state.special) this.invalidate();
  }
  getDiagnostics() {
    return { version: PERFORMANCE_VERSION, enabled: true, strategy: 'change-driven-frames-and-static-shadows',
      drawnFrames: this.drawnFrames, skippedIdleFrames: this.skippedFrames, skippedHiddenFrames: this.hiddenFrames,
      shadowUpdates: this.shadowUpdates, shadowReuses: this.shadowReuses,
      currentPixelRatio: this.renderer.getPixelRatio?.() ?? null, settledPixelRatio: this.profile?.pixelRatio ?? null,
      motionResolutionScale: this.scale, moving: this.lastState?.moving ?? false,
      activeFrameIntervalMs: this.frameInterval, lastFrameCpuMs: this.lastCpuMs,
      nativeTransmissionScaleSupported: 'transmissionResolutionScale' in this.renderer,
      transmissionResolutionScale: this.renderer.transmissionResolutionScale ?? null,
      visibleObjects: this.lastState?.visibleObjects ?? 0, continuousContent: this.lastState?.dynamic ?? false };
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.revisions.dispose();
    this.renderer.domElement?.removeEventListener?.('webglcontextrestored', this.onResume);
    globalThis.document?.removeEventListener?.('visibilitychange', this.onResume);
  }
}
