const DEFAULT_PLACEMENT = Object.freeze({
  side: 'left',
  direction: 'down',
  offsetX: 12,
  offsetY: 12,
});

function freezeTool(tool) {
  return Object.freeze({
    configurable: true,
    ...tool,
    defaults: Object.freeze({ ...(tool.defaults ?? {}) }),
  });
}

/**
 * Shared tools are opt-in UI contracts, not automatically enabled features.
 * Each configurator developer selects the tools that make sense and supplies
 * the scene-specific behavior and placement overrides.
 */
const TOOL_ICONS = Object.freeze({
  environment: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>`,
  dimensions: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7v10M20 7v10M7 12h10"/><path d="m9 9-3 3 3 3M15 9l3 3-3 3"/></svg>`,
  compass: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-1.8 3.8-3.8 1.8 1.8-3.8 3.8-1.8Z"/><path d="M12 1.8v2.1M12 20.1v2.1"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5h3l1.4-2h7.2l1.4 2h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z"/><circle cx="12" cy="14" r="3.4"/><path d="M18.5 11h.01"/></svg>`,
  technicalEdges: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 21 12 12 21 3 12 12 3Z"/><path d="M7.8 12h8.4M12 7.8v8.4"/></svg>`,
  explode: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8.5 6.5 3.5-2 3.5 2-3.5 2-3.5-2ZM4.5 12l3.5-2 3.5 2-3.5 2-3.5-2ZM12.5 12l3.5-2 3.5 2-3.5 2-3.5-2ZM8.5 17.5l3.5-2 3.5 2-3.5 2-3.5-2Z"/></svg>`,
  windowLayoutControls: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 12s3.4-5.7 9.2-5.7 9.2 5.7 9.2 5.7-3.4 5.7-9.2 5.7S2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>`,
});

export const SHARED_TOOL_DEFINITIONS = Object.freeze({
  environment: freezeTool({
    id: 'environment',
    action: 'toggle-environment',
    label: 'Light & orientation',
    icon: TOOL_ICONS.environment,
    defaults: { panelPlacement: 'near-launcher' },
  }),
  dimensions: freezeTool({
    id: 'dimensions',
    action: 'toggle-dimensions',
    label: 'Toggle dimensions',
    icon: TOOL_ICONS.dimensions,
    defaults: { visible: true },
  }),
  compass: freezeTool({
    id: 'compass',
    action: 'toggle-compass',
    label: 'Toggle compass',
    icon: TOOL_ICONS.compass,
    defaults: {
      visible: false,
      // Scene placement is deliberately supplied by each configurator.
      placement: null,
      heightOffset: 0,
      rotationOffset: 0,
      scale: 1,
    },
  }),
  camera: freezeTool({
    id: 'camera',
    action: 'cycle-camera',
    label: 'Change camera',
    icon: TOOL_ICONS.camera,
    defaults: { presets: [] },
  }),
  technicalEdges: freezeTool({
    id: 'technical-edges',
    action: 'toggle-technical-edges',
    label: 'Technical edges',
    tooltip: false,
    icon: TOOL_ICONS.technicalEdges,
    defaults: { active: false },
  }),
  explode: freezeTool({
    id: 'explode',
    action: 'toggle-explode-tool',
    label: 'Exploded view',
    icon: TOOL_ICONS.explode,
    defaults: { amount: 0 },
  }),
  'window-layout-controls': freezeTool({
    id: 'window-layout-controls',
    action: 'toggle-window-layout-controls',
    label: 'Window edit buttons',
    icon: TOOL_ICONS.windowLayoutControls,
    defaults: { visible: true },
  }),
});

export function resolveSharedTool(id, overrides = {}) {
  const definition = SHARED_TOOL_DEFINITIONS[id];
  if (!definition) throw new Error(`Unknown shared tool: ${id}`);
  return {
    ...definition,
    ...overrides,
    config: {
      ...definition.defaults,
      ...(overrides.config ?? {}),
    },
  };
}

export function resolveSharedTools(requested = []) {
  return requested.map((entry) => {
    if (typeof entry === 'string') return resolveSharedTool(entry);
    return resolveSharedTool(entry.id, entry);
  });
}

export function normalizeToolsPlacement(placement = {}) {
  return {
    ...DEFAULT_PLACEMENT,
    ...placement,
  };
}
