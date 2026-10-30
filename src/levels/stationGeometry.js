import * as THREE from 'three';

// Identical props can share immutable vertex buffers even when their materials
// and transforms differ. Surface-textured boxes use a separate UV layout.
export function stationBoxGeometry(cache, w, h, d, surface = false) {
  const key = `${w},${h},${d},${surface}`;
  if (cache.has(key)) return cache.get(key);
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (surface) {
    const { uv, normal } = geometry.attributes;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (Math.abs(normal.getX(i)) > .5 ? d : w) / 2,
        uv.getY(i) * (Math.abs(normal.getY(i)) > .5 ? d : h) / 2);
    }
  }
  cache.set(key, geometry);
  return geometry;
}
