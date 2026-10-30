import test from 'node:test';
import assert from 'node:assert/strict';

const elements = new Map();
globalThis.document = { getElementById(id) {
  if (!elements.has(id)) elements.set(id, { textContent: '', setAttribute() {} });
  return elements.get(id);
}};
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
const { prepareGraphics } = await import('../src/game/loading.js');

test('graphics preparation shows its phase and waits for compilation', async () => {
  let finish;
  let started;
  const compiling = new Promise(resolve => { started = resolve; });
  const scene = {}, camera = {};
  const preparation = prepareGraphics({ compileAsync(s, c) {
    assert.equal(s, scene);
    assert.equal(c, camera);
    started();
    return new Promise(resolve => { finish = resolve; });
  }}, scene, camera, 1000);
  await compiling;
  assert.equal(elements.get('loading-detail').textContent, 'Preparing graphics…');
  finish();
  await preparation;
});

test('stalled compilation reports an actionable error instead of waiting forever', async () => {
  await assert.rejects(prepareGraphics({ compileAsync: () => new Promise(() => {}) }, {}, {}, 10), /Graphics preparation timed out/);
});

test('shader compilation failures reach the existing error screen', async () => {
  await assert.rejects(prepareGraphics({ compileAsync: () => Promise.reject(new Error('compile failed')) }, {}, {}, 1000), /compile failed/);
});
