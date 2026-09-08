export const WINDOW_CASES = [
  { name: 'single-default' },
  { name: 'single-small', width: 0.6, height: 0.9 },
  { name: 'single-large', width: 3.6, height: 2.2 },
  { name: 'glass-16', glass: 16 },
  { name: 'glass-29', glass: 29 },
  { name: 'turn-open', angle: 60 },
  { name: 'tilt-open', angle: 12, tilt: true },
  { name: 'left-handle', handle: 'left', angle: 45 },
  { name: 'exploded', exploded: true },
  { name: 'vertical-divider', layout: 'vertical-divider', width: 2.4 },
  { name: 'horizontal-divider', layout: 'horizontal-divider', height: 2.2 },
  { name: 'three-fixed', layout: 'vertical-fixed-fixed-fixed', width: 3.0 },
  { name: 'two-sashes', layout: 'vertical-sash-sash', width: 2.4, angle: 35 },
];
export function applyWindowCase(fixture, item) {
  if (item.width) fixture.elements.get('widthA').value = String(item.width);
  if (item.height) fixture.elements.get('heightB').value = String(item.height);
  if (item.glass) fixture.elements.get('glassThickness').value = String(item.glass);
  if (item.tilt) fixture.elements.get('mBatant').checked = false;
  fixture.builder.setExploded(item.exploded ?? false);
  fixture.builder.buildWindow();
  if (item.angle) fixture.elements.get('openAngle').value = String(item.angle);
  fixture.builder.applyCurrentPoseInstantly();
}
