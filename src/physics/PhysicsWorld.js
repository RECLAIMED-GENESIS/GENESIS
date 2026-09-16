import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -15, 0)
});

export let floorBody = null;
const wallBodies = [];

/**
 * Create floor mesh + static physics plane.
 * @param {THREE.Scene} scene
 * @returns {{ mesh: THREE.Mesh, body: CANNON.Body }}
 */
export function createFloor(scene) {
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane()
    });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    physicsWorld.addBody(floorBody);

    return { mesh: floor, body: floorBody };
}

/**
 * Create 4 invisible arena walls (visual + physics).
 * @param {THREE.Scene} scene
 */
export function createArenaWalls(scene) {
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.3
    });

    const wallConfigs = [
        { pos: [0, 2.5, -10], rot: [0, 0, 0], size: [20, 5, 0.5] },
        { pos: [0, 2.5, 10], rot: [0, 0, 0], size: [20, 5, 0.5] },
        { pos: [-10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
        { pos: [10, 2.5, 0], rot: [0, Math.PI / 2, 0], size: [20, 5, 0.5] },
    ];

    wallConfigs.forEach(({ pos, rot, size }) => {
        const wallGeo = new THREE.BoxGeometry(...size);
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(...pos);
        wall.rotation.set(...rot);
        scene.add(wall);

        const wallBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2))
        });
        wallBody.position.set(...pos);
        wallBody.quaternion.setFromEuler(...rot);
        physicsWorld.addBody(wallBody);
        wallBodies.push({ mesh: wall, body: wallBody });
    });

    return wallBodies;
}

/**
 * Step physics world — call every frame.
 * @param {number} delta
 */
export function stepPhysics(delta) {
    physicsWorld.step(1 / 60, delta, 3);
}

/**
 * Sync a THREE mesh to a CANNON body (copy position/quaternion).
 */
export function syncMeshToBody(mesh, body) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
}
