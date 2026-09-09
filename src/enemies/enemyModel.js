import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class EnemyMesh {
  constructor(scene) {
    this.scene = scene
    this.mesh = new THREE.Group()
    this.scene.add(this.mesh)
  }

  load() {
    const loader = new GLTFLoader()
    loader.load(
      '/models/enemy.glb',
      (gltf) => {
        const model = gltf.scene
        // Correct pitch rotation so enemy stands upright
        model.rotation.x = -Math.PI / 2
        model.scale.set(0.5, 0.5, 0.5)

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        this.mesh.add(model)
      },
      undefined,
      (error) => {
        console.error('Error loading enemy model:', error)
      }
    )
  }

  updatePosition(body) {
    this.mesh.position.copy(body.position)
    this.mesh.quaternion.copy(body.quaternion)
  }
}