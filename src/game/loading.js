import { DefaultLoadingManager } from 'three';

const screen = document.getElementById('loading-screen');
const label = document.getElementById('loading-label');
const detail = document.getElementById('loading-detail');
let pending = 0;
let completed = 0;
let total = 0;
const start = DefaultLoadingManager.itemStart.bind(DefaultLoadingManager);
const end = DefaultLoadingManager.itemEnd.bind(DefaultLoadingManager);
DefaultLoadingManager.itemStart = url => {
  pending++; total++;
  start(url);
  detail.textContent = `Preparing assets · ${completed} / ${total}`;
};
DefaultLoadingManager.itemEnd = url => {
  end(url);
  pending--; completed++;
  detail.textContent = `Preparing assets · ${completed} / ${total}`;
};

export function showLoading(title) {
  if (pending === 0) { completed = 0; total = 0; }
  label.textContent = title;
  detail.textContent = 'Preparing your investigation…';
  screen.hidden = false;
  screen.setAttribute('aria-busy', 'true');
  window.__loading = true;
}
export function hideLoading() {
  screen.hidden = true;
  screen.setAttribute('aria-busy', 'false');
  window.__loading = false;
}
export const paintLoading = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
export async function prepareGraphics(renderer, scene, camera, timeoutMs = 60000) {
  detail.textContent = 'Preparing graphics…';
  await paintLoading();
  let timeout;
  try {
    await Promise.race([
      renderer.compileAsync(scene, camera),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Graphics preparation timed out. Please retry or enable hardware acceleration in your browser.')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
export async function waitForAssets() {
  const deadline = performance.now() + 120000;
  // Allow loader callbacks and dependent model/texture requests to settle.
  let quiet = 0;
  while (quiet < 2) {
    await new Promise(resolve => setTimeout(resolve, 100));
    quiet = pending === 0 ? quiet + 1 : 0;
    if (performance.now() > deadline) throw new Error('Asset loading timed out. Check your connection and retry.');
  }
}
