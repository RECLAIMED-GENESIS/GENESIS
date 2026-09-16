import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/**
 * Loads a GLTF/GLB model from a given URL path.
 * @param {string} url - Path to the asset file in public/
 * @returns {Promise<{scene: THREE.Group, animations: Array}>}
 */
export function loadModel(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        resolve({ scene: model, animations: gltf.animations });
      },
      undefined,
      (error) => {
        console.error(`Error loading model at ${url}:`, error);
        reject(error);
      }
    );
  });
}
