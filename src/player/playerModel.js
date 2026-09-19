import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class PlayerMesh {
  constructor(scene) {
    this.scene = scene
    this.mesh = new THREE.Group()
    this.scene.add(this.mesh)
  }

  load() {
    const loader = new GLTFLoader()
    loader.load(
      '/models/player.glb',
      (gltf) => {
        const model = gltf.scene
        // Fix orientation and scale
        model.rotation.x = 0
        model.rotation.y = Math.PI
        model.scale.set(0.8, 0.8, 0.8)

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
        console.error('Error loading player model:', error)
      }
    )
  }

  updatePosition(body) {
    this.mesh.position.copy(body.position)
    this.mesh.quaternion.copy(body.quaternion)
  }
}