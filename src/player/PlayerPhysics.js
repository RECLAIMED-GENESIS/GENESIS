import * as CANNON from 'cannon-es'
import { physicsWorld } from '../physics/PhysicsWorld.js'

const playerBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
  position: new CANNON.Vec3(0, 3, 0),
  linearDamping: 0.9
})

physicsWorld.addBody(playerBody)

export { playerBody }
