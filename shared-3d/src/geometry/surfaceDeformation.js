/** Fast, baseline-relative UV updates for a topology-preserving linear resize.
 * Capture once per drag; evaluate an affine UV gradient per vertex while the
 * host warps its positions. No normal recomputation, material changes, world
 * mapping, extra draw calls, or image requests. Curved/authored unwraps opt out.
 */
export function captureSurfaceUVDeformation(geometry, basePositions = null) {
  const mapping = geometry?.userData?.surfaceMapping;
  if (!mapping || !['extrusion', 'box', 'planar'].includes(mapping.mode)) return null;
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  if (!position || !uv || position.itemSize !== 3 || uv.itemSize !== 2 || position.count !== uv.count || position.isInterleavedBufferAttribute) return null;
  const base = basePositions ?? position.array.slice();
  if (base.length !== position.count * 3) throw new RangeError('UV deformation baseline must match the current position buffer.');
  const baseUV = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) { baseUV[i * 2] = uv.getX(i); baseUV[i * 2 + 1] = uv.getY(i); }
  const gradients = new Float32Array(position.count * 6), seen = new Uint8Array(position.count);
  const indices = geometry.index, count = indices ? indices.count : position.count;
  if (count % 3) return null;
  const idAt = i => indices ? indices.getX(i) : i;
  for (let i = 0; i < count; i += 3) {
    const a = idAt(i), b = idAt(i + 1), c = idAt(i + 2);
    const e1 = [base[b*3]-base[a*3],base[b*3+1]-base[a*3+1],base[b*3+2]-base[a*3+2]];
    const e2 = [base[c*3]-base[a*3],base[c*3+1]-base[a*3+1],base[c*3+2]-base[a*3+2]];
    const g11=e1.reduce((s,v)=>s+v*v,0), g22=e2.reduce((s,v)=>s+v*v,0), g12=e1.reduce((s,v,j)=>s+v*e2[j],0);
    const determinant=g11*g22-g12*g12;
    if (determinant <= Math.max(1e-30,g11*g22*1e-12)) continue;
    for (const vertex of [a,b,c]) {
      const candidate=[];
      for (let channel=0;channel<2;channel++) {
        const delta1=baseUV[b*2+channel]-baseUV[a*2+channel], delta2=baseUV[c*2+channel]-baseUV[a*2+channel];
        const w1=(delta1*g22-delta2*g12)/determinant, w2=(delta2*g11-delta1*g12)/determinant;
        for(let axis=0;axis<3;axis++) candidate.push(w1*e1[axis]+w2*e2[axis]);
      }
      // Smooth/curved indexed assets need a different deformer. Never choose
      // one arbitrary triangle for a shared vertex with incompatible gradients.
      if (seen[vertex] && candidate.some((v,j)=>Math.abs(v-gradients[vertex*6+j])>1e-4)) return null;
      gradients.set(candidate,vertex*6); seen[vertex]=1;
    }
  }
  const valid = () => geometry.getAttribute('position') === position && geometry.getAttribute('uv') === uv;
  return {
    update() {
      if (!valid()) return false;
      for(let i=0;i<position.count;i++) {
        const dx=position.getX(i)-base[i*3],dy=position.getY(i)-base[i*3+1],dz=position.getZ(i)-base[i*3+2],g=i*6;
        uv.setXY(i,baseUV[i*2]+gradients[g]*dx+gradients[g+1]*dy+gradients[g+2]*dz,
          baseUV[i*2+1]+gradients[g+3]*dx+gradients[g+4]*dy+gradients[g+5]*dz);
      }
      uv.needsUpdate=true; return true;
    },
    restore() {
      if (!valid()) return false;
      for(let i=0;i<uv.count;i++)uv.setXY(i,baseUV[i*2],baseUV[i*2+1]);
      uv.needsUpdate=true; return true;
    },
  };
}
