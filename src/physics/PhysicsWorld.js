import * as CANNON from 'cannon-es'

const physicsWorld = new CANNON.World({
  gravity: new CANNON.Vec3(0, -15, 0)
})

export { physicsWorld }
