// Screen-space contact occlusion in linear lighting, not a full-image multiply.
// The original beauty pass still owns antialiasing, transmission, tone mapping,
// fog and output color conversion. No normal/roughness texture is sampled here.
export const CONTACT_VERTEX = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const CONTACT_FRAGMENT = /* glsl */`
#include <packing>
varying vec2 vUv;
uniform sampler2D cDepth;
uniform mat4 cProjection;
uniform mat4 cInverseProjection;
uniform vec2 cTexel;
uniform float cRadius;
uniform float cBias;
uniform float cIntensity;
uniform float cMaxDarkening;
uniform float cOrthographic;
uniform int cSamples;
float depthAt(vec2 uv) { return unpackRGBAToDepth(texture2D(cDepth, uv)); }
vec3 positionAt(vec2 uv, float depth) {
  vec4 p = cInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
void main() {
  float depth = depthAt(vUv);
  if (depth >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = positionAt(vUv, depth);
  vec2 dx = vec2(cTexel.x, 0.0), dy = vec2(0.0, cTexel.y);
  vec3 left = positionAt(vUv - dx, depthAt(vUv - dx));
  vec3 right = positionAt(vUv + dx, depthAt(vUv + dx));
  vec3 down = positionAt(vUv - dy, depthAt(vUv - dy));
  vec3 up = positionAt(vUv + dy, depthAt(vUv + dy));
  // Choose the nearer depth derivative at silhouettes; do not invent a normal
  // spanning the foreground and a distant background (the usual halo source).
  vec3 tx = abs(right.z - p.z) < abs(p.z - left.z) ? right - p : p - left;
  vec3 ty = abs(up.z - p.z) < abs(p.z - down.z) ? up - p : p - down;
  vec3 crossNormal = cross(tx, ty);
  if (dot(crossNormal, crossNormal) < 1e-18) { gl_FragColor = vec4(1.0); return; }
  vec3 n = normalize(crossNormal);
  if (dot(n, -p) < 0.0) n = -n;
  float projectionDepth = mix(max(-p.z, 0.001), 1.0, cOrthographic);
  vec2 radiusUV = 0.5 * cRadius * vec2(cProjection[0][0], cProjection[1][1]) / projectionDepth;
  float radiusPixels = radiusUV.y / cTexel.y;
  if (radiusPixels < 1.5) { gl_FragColor = vec4(1.0); return; }
  // Fixed per-pixel pattern: no temporal noise/history or stale accumulation.
  float rotation = fract(sin(dot(floor(vUv / cTexel), vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  float sum = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= cSamples) break;
    // Interleave close contacts and the full envelope in the same sample budget.
    // The earlier single wide disk often missed narrow seals and profile recesses.
    float sampleRadius = mod(float(i), 2.0) < 0.5 ? 0.4 : 1.0;
    float distanceScale = sqrt((floor(float(i) * 0.5) + 0.5) / ceil(float(cSamples) * 0.5));
    float angle = rotation + float(i) * 2.39996323;
    vec2 sampleUV = vUv + vec2(cos(angle), sin(angle)) * radiusUV * distanceScale * sampleRadius;
    if (any(lessThan(sampleUV, cTexel * 0.5)) || any(greaterThan(sampleUV, vec2(1.0) - cTexel * 0.5))) continue;
    // Reconstruct at the fetched depth texel's centre, not an arbitrary UV
    // inside that texel. Otherwise even a flat floor acquires false relief.
    sampleUV = (floor(sampleUV / cTexel) + 0.5) * cTexel;
    float sampleDepth = depthAt(sampleUV);
    if (sampleDepth >= 0.99999) continue;
    vec3 delta = positionAt(sampleUV, sampleDepth) - p;
    float lengthDelta = length(delta);
    float localRadius = cRadius * sampleRadius;
    if (lengthDelta < cBias || lengthDelta > localRadius) continue;
    float horizon = max(0.0, (dot(n, delta) - cBias) / lengthDelta - 0.08);
    float falloff = 1.0 - smoothstep(localRadius * 0.25, localRadius, lengthDelta);
    sum += horizon * falloff;
  }
  float occlusion = clamp(sum * (3.0 * cIntensity / float(cSamples)), 0.0, cMaxDarkening);
  // Fade the last two pixels at the viewport edge, where screen information ends.
  vec2 edge = min(vUv, vec2(1.0) - vUv) / cTexel;
  occlusion *= smoothstep(0.0, 2.0, min(edge.x, edge.y)) * smoothstep(1.5, 3.0, radiusPixels);
  gl_FragColor = vec4(vec3(1.0 - occlusion), 1.0);
}`;


// Joint bilateral denoise, guided by the solid depth prepass. Plane distance,
// rather than a raw Z difference, lets an oblique flat deck filter smoothly.
// Nearby samples across a silhouette or a different surface are rejected.
export const CONTACT_DENOISE_FRAGMENT = /* glsl */`
#include <packing>
varying vec2 vUv;
uniform sampler2D cDepth;
uniform sampler2D cRawAO;
uniform mat4 cProjection;
uniform mat4 cInverseProjection;
uniform vec2 cTexel;
uniform float cBias;
uniform float cOrthographic;
float depthAt(vec2 uv) { return unpackRGBAToDepth(texture2D(cDepth, uv)); }
vec3 positionAt(vec2 uv, float depth) {
  vec4 p = cInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
void main() {
  float depth = depthAt(vUv);
  if (depth >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = positionAt(vUv, depth);
  vec2 dx = vec2(cTexel.x, 0.0), dy = vec2(0.0, cTexel.y);
  vec3 left = positionAt(vUv - dx, depthAt(vUv - dx));
  vec3 right = positionAt(vUv + dx, depthAt(vUv + dx));
  vec3 down = positionAt(vUv - dy, depthAt(vUv - dy));
  vec3 up = positionAt(vUv + dy, depthAt(vUv + dy));
  vec3 tx = abs(right.z - p.z) < abs(p.z - left.z) ? right - p : p - left;
  vec3 ty = abs(up.z - p.z) < abs(p.z - down.z) ? up - p : p - down;
  vec3 crossNormal = cross(tx, ty);
  if (dot(crossNormal, crossNormal) < 1e-18) {
    gl_FragColor = vec4(vec3(texture2D(cRawAO, vUv).r), 1.0); return;
  }
  vec3 n = normalize(crossNormal);
  float projectionDepth = mix(max(-p.z, 0.001), 1.0, cOrthographic);
  float footprint = 2.0 * projectionDepth * cTexel.y / cProjection[1][1];
  float tolerance = max(cBias * 2.0, footprint * 0.45);
  float total = 0.0, weight = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 uv = vUv + vec2(float(x), float(y)) * cTexel;
      if (any(lessThan(uv, cTexel * 0.5)) || any(greaterThan(uv, vec2(1.0) - cTexel * 0.5))) continue;
      float d = depthAt(uv);
      if (d >= 0.99999) continue;
      vec3 delta = positionAt(uv, d) - p;
      float planeDistance = abs(dot(n, delta));
      float depthWeight = 1.0 - smoothstep(tolerance, tolerance * 2.0, planeDistance);
      // Also reject distant geometry almost parallel to the guide plane.
      depthWeight *= 1.0 - smoothstep(max(footprint * 6.0, cBias * 4.0), max(footprint * 12.0, cBias * 8.0), length(delta));
      float w = exp(-0.75 * float(x * x + y * y)) * depthWeight;
      total += texture2D(cRawAO, uv).r * w; weight += w;
    }
  }
  float factor = weight > 0.0001 ? total / weight : texture2D(cRawAO, vUv).r;
  gl_FragColor = vec4(vec3(factor), 1.0);
}`;

// Included after Three's <packing>, which supplies the depth conversion helpers.
// Project view-space position rather than gl_FragCoord: this also samples the
// correct location during Three's lower-resolution transmission prepass.
export const CONTACT_PARS = /* glsl */`
uniform sampler2D cContactDepth;
uniform sampler2D cContactAO;
uniform mat4 cContactProjection;
uniform vec2 cContactTexel;
uniform float cContactNear;
uniform float cContactFar;
uniform float cContactOrthographic;
uniform float cContactBias;
uniform float cContactEnabled;
float cContactViewZ(float depth) {
  return mix(perspectiveDepthToViewZ(depth, cContactNear, cContactFar),
    orthographicDepthToViewZ(depth, cContactNear, cContactFar), cContactOrthographic);
}
void cContactTap(vec2 uv, float z, float tolerance, float kernelWeight, inout float sum, inout float weight) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return;
  // Depth and occlusion are fetched from the same texel centre. This also
  // keeps the transmission prepass aligned with the main-view depth buffer.
  uv = (floor(uv / cContactTexel) + 0.5) * cContactTexel;
  float depth = unpackRGBAToDepth(texture2D(cContactDepth, uv));
  if (depth >= 0.99999) return;
  float delta = abs(cContactViewZ(depth) - z);
  float w = (1.0 - smoothstep(tolerance, tolerance * 2.0, delta)) * kernelWeight;
  sum += texture2D(cContactAO, uv).r * w;
  weight += w;
}
float cContactFactor(vec3 viewPosition) {
  if (cContactEnabled < 0.5) return 1.0;
  vec4 clip = cContactProjection * vec4(viewPosition, 1.0);
  if (clip.w <= 0.0) return 1.0;
  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
  float projectionDepth = mix(max(-viewPosition.z, 0.001), 1.0, cContactOrthographic);
  float footprint = 2.0 * projectionDepth * cContactTexel.y / cContactProjection[1][1];
  float tolerance = max(cContactBias * 4.0, footprint * 2.5);
  float sum = 0.0, weight = 0.0;
  cContactTap(uv, viewPosition.z, tolerance, 2.0, sum, weight);
  cContactTap(uv + vec2(cContactTexel.x, 0.0), viewPosition.z, tolerance, 1.0, sum, weight);
  cContactTap(uv - vec2(cContactTexel.x, 0.0), viewPosition.z, tolerance, 1.0, sum, weight);
  cContactTap(uv + vec2(0.0, cContactTexel.y), viewPosition.z, tolerance, 1.0, sum, weight);
  cContactTap(uv - vec2(0.0, cContactTexel.y), viewPosition.z, tolerance, 1.0, sum, weight);
  return weight > 0.0001 ? sum / weight : 1.0;
}`;

export const CONTACT_APPLY = /* glsl */`
float cContactAmount = cContactFactor(-vViewPosition);
reflectedLight.indirectDiffuse *= cContactAmount;
#if defined(USE_ENVMAP) && defined(STANDARD)
  reflectedLight.indirectSpecular *= computeSpecularOcclusion(
    saturate(dot(geometryNormal, geometryViewDir)), cContactAmount, material.roughness);
#endif
`;
