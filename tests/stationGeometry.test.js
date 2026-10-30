import test from 'node:test';
import assert from 'node:assert/strict';
import { stationBoxGeometry } from '../src/levels/stationGeometry.js';

test('identical props reuse buffers without changing surface texture scale', () => {
  const cache = new Map();
  const plain = stationBoxGeometry(cache, 4, 3, 2);
  const surface = stationBoxGeometry(cache, 4, 3, 2, true);
  assert.notEqual(plain, surface);
  assert.equal(stationBoxGeometry(cache, 4, 3, 2), plain);
  assert.equal(stationBoxGeometry(cache, 4, 3, 2, true), surface);
  const { uv, normal } = plain.attributes;
  for (let i = 0; i < uv.count; i++) {
    assert.equal(surface.attributes.uv.getX(i), uv.getX(i) * (Math.abs(normal.getX(i)) > .5 ? 2 : 4) / 2);
    assert.equal(surface.attributes.uv.getY(i), uv.getY(i) * (Math.abs(normal.getY(i)) > .5 ? 2 : 3) / 2);
  }
  assert.equal(cache.size, 2);
  for (const geometry of cache.values()) geometry.dispose();
});
