/** Fixed product cases, independent of the builder implementation. */
export function pergolaCases(stateAPI) {
  const { DEFAULT_STATE, getPoleGrid, getRoofRectangles, createPoleMount } = stateAPI;
  const cases = [];
  const make = (name, update = () => {}) => {
    const state = structuredClone(DEFAULT_STATE); update(state);
    cases.push({ name, state }); return state;
  };
  make('default');
  for (const model of ['lite', 'comfort', 'premium']) for (const orientation of ['width', 'depth']) {
    make(`${model}-${orientation}`, state => { state.model = model; state.roof.orientation = orientation; });
  }
  for (const [width, depth, height] of [[2000, 2000, 2200], [6000, 6000, 3000], [12000, 9000, 3200]]) {
    make(`dimensions-${width}-${depth}-${height}`, state => { state.dimensions = { width, depth, height }; });
  }
  for (const mountedSide of ['front', 'back', 'left', 'right']) make(`wall-${mountedSide}`, state => {
    state.installation = 'wall-mounted'; state.mountedSide = mountedSide;
  });
  for (const type of ['glass', 'privacy-wall', 'screen', 'motorized-screen']) {
    make(`sides-${type}`, state => { for (const segment of getPoleGrid(state).segments) state.sideSegments[segment.id] = { ...state.sideSegments[segment.id], type }; });
  }
  for (const tilt of [0, 45, 90]) make(`louvers-${tilt}`, state => { state.roof.louverTilt = tilt; });
  make('drainage-none', state => { state.roof.drainage = 'none'; });
  make('manual', state => { state.automation = 'manual'; });
  make('perimeter-led', state => { state.accessories.perimeterLed.enabled = true; });
  make('night-led', state => { state.environment.night = true; state.accessories.perimeterLed.enabled = true; });
  make('spotlights', state => { for (const cell of getRoofRectangles(state)) state.accessories.spotlights[cell.id] = 6; });
  for (const outletType of ['eu', 'us']) make(`outlet-${outletType}`, state => {
    const pole = getPoleGrid(state).poles[0].id;
    state.poleMounts[pole].front.outlet = createPoleMount('outlet', { outletType, height: 40 });
  });
  return cases;
}
