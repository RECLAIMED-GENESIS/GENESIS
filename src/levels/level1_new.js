import * as THREE from 'three'
import * as CANNON from 'cannon-es'

import { physicsWorld } from '../physics/PhysicsWorld.js'
import { playerBody } from '../player/PlayerPhysics.js'
import {
    playerMesh,
    attackIndicator,
    setupCombatInput,
    setupJump,
    updatePlayer,
    getGameOver,
    getPlayerHealth,
    getPlayerMaxHealth
} from '../player/Player.js'

import {
    updateEnemies,
    getEnemies
} from '../enemies/Enemy.js'

import {
    initWaves,
    onWaveComplete,
    getCurrentWave,
    getTotalWaves,
    isWaveInProgress,
    setWaveInProgress
} from '../enemies/EnemyWave.js'

import {
    spawnCommander,
    updateCommander,
    isCommanderAlive
} from '../enemies/Boss.js'

import {
    initHUD,
    updateHUD,
    showGameOver
} from '../ui/HUD.js'

import createMineShader from '../shaders/mineShader.js'


// ============================================================
// SCENE REFERENCES
// ============================================================

let scene = null
let camera = null

let onLevel1Complete = null

let mineMaterials = []
let mineLights = []

let floorBody = null

// Mine dimensions
const MINE_WIDTH = 60
const MINE_LENGTH = 40
const MINE_HEIGHT = 8


// ============================================================
// FRAGMENTS
// ============================================================

let fragmentsCollected = 0
const FRAGMENTS_NEEDED = 8
const fragments = []

let fragmentTemplate = null


// ============================================================
// TERMINAL
// ============================================================

let terminalActive = false
let terminalVisible = false
let terminalMesh = null
let screenMesh = null


// ============================================================
// PORTAL
// ============================================================

let portalActive = false
let portalMesh = null


// ============================================================
// CREATE MINE FLOOR
// ============================================================

function createMineFloor() {

    const material = createMineShader({
        baseColor: 0x4b443d,
        darkColor: 0x24211f,
        lightColor: 0xff9d45
    })

    mineMaterials.push(material)

    const geometry = new THREE.PlaneGeometry(
        MINE_WIDTH,
        MINE_LENGTH,
        40,
        30
    )

    const floor = new THREE.Mesh(
        geometry,
        material
    )

    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0

    floor.receiveShadow = true

    scene.add(floor)
}


// ============================================================
// CREATE ROCK WALL
// ============================================================

function createRockWall(
    position,
    scale,
    rotation = [0, 0, 0]
) {

    const material = createMineShader({
        baseColor: 0x51463e,
        darkColor: 0x211d1b,
        lightColor: 0xffa04a
    })

    mineMaterials.push(material)

    const geometry = new THREE.DodecahedronGeometry(1, 1)

    const rock = new THREE.Mesh(
        geometry,
        material
    )

    rock.position.set(
        position[0],
        position[1],
        position[2]
    )

    rock.scale.set(
        scale[0],
        scale[1],
        scale[2]
    )

    rock.rotation.set(
        rotation[0],
        rotation[1],
        rotation[2]
    )

    rock.castShadow = true
    rock.receiveShadow = true

    scene.add(rock)

    return rock
}


// ============================================================
// CREATE ROCK WALLS
// ============================================================

function createMineWalls() {

    // Back wall
    for (let x = -28; x <= 28; x += 3) {

        createRockWall(
            [x, 3.5, -19.5],
            [2.0, 3.5, 1.5],
            [0, Math.random() * Math.PI, 0]
        )
    }

    // Front wall
    for (let x = -28; x <= 28; x += 3) {

        createRockWall(
            [x, 3.5, 19.5],
            [2.0, 3.5, 1.5],
            [0, Math.random() * Math.PI, 0]
        )
    }

    // Left wall
    for (let z = -17; z <= 17; z += 3) {

        createRockWall(
            [-29.5, 3.5, z],
            [1.5, 3.5, 2.0],
            [0, Math.random() * Math.PI, 0]
        )
    }

    // Right wall
    for (let z = -17; z <= 17; z += 3) {

        createRockWall(
            [29.5, 3.5, z],
            [1.5, 3.5, 2.0],
            [0, Math.random() * Math.PI, 0]
        )
    }
}


// ============================================================
// WOODEN SUPPORT
// ============================================================

function createWoodSupport(x, z) {

    const woodMaterial = new THREE.MeshStandardMaterial({
        color: 0x633d24,
        roughness: 0.9
    })

    const beamGeometry = new THREE.BoxGeometry(
        0.7,
        7,
        0.7
    )

    const leftPost = new THREE.Mesh(
        beamGeometry,
        woodMaterial
    )

    leftPost.position.set(
        x - 4,
        3.5,
        z
    )

    leftPost.castShadow = true

    scene.add(leftPost)


    const rightPost = leftPost.clone()

    rightPost.position.x = x + 4

    scene.add(rightPost)


    // Top beam
    const topGeometry = new THREE.BoxGeometry(
        8.7,
        0.7,
        0.7
    )

    const topBeam = new THREE.Mesh(
        topGeometry,
        woodMaterial
    )

    topBeam.position.set(
        x,
        7,
        z
    )

    topBeam.castShadow = true

    scene.add(topBeam)
}


// ============================================================
// CREATE MINE SUPPORTS
// ============================================================

function createMineSupports() {

    for (
        let z = -15;
        z <= 15;
        z += 7
    ) {
        createWoodSupport(0, z)
    }
}


// ============================================================
// CREATE RAILS
// ============================================================

function createRails() {

    const railMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.7,
        roughness: 0.5
    })

    const railGeometry = new THREE.BoxGeometry(
        0.18,
        0.18,
        MINE_LENGTH - 4
    )

    const leftRail = new THREE.Mesh(
        railGeometry,
        railMaterial
    )

    leftRail.position.set(
        -1.2,
        0.12,
        0
    )

    scene.add(leftRail)


    const rightRail = leftRail.clone()

    rightRail.position.x = 1.2

    scene.add(rightRail)


    // Wooden sleepers
    const sleeperMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x5b3824
        })

    for (
        let z = -17;
        z <= 17;
        z += 1.5
    ) {

        const sleeper = new THREE.Mesh(
            new THREE.BoxGeometry(
                3.5,
                0.15,
                0.45
            ),
            sleeperMaterial
        )

        sleeper.position.set(
            0,
            0.05,
            z
        )

        scene.add(sleeper)
    }
}


// ============================================================
// CREATE ROCKS
// ============================================================

function createDecorativeRocks() {

    const material = createMineShader({
        baseColor: 0x5a5048,
        darkColor: 0x292522,
        lightColor: 0xff9d45
    })

    mineMaterials.push(material)

    for (let i = 0; i < 35; i++) {

        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(
                0.4 + Math.random() * 0.7,
                1
            ),
            material
        )

        rock.position.set(
            THREE.MathUtils.randFloat(
                -25,
                25
            ),

            0.35,

            THREE.MathUtils.randFloat(
                -17,
                17
            )
        )

        rock.rotation.set(
            Math.random(),
            Math.random(),
            Math.random()
        )

        rock.castShadow = true

        scene.add(rock)
    }
}


// ============================================================
// CREATE LANTERN
// ============================================================

function createLantern(x, y, z) {

    const lanternMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x3b3027,
            metalness: 0.4,
            roughness: 0.8
        })

    const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.45,
            0.7,
            0.45
        ),
        lanternMaterial
    )

    lantern.position.set(
        x,
        y,
        z
    )

    scene.add(lantern)


    const light = new THREE.PointLight(0xffa34d, 5, 18, 2);

    light.position.set(
        x,
        y + 0.1,
        z
    )

    light.castShadow = true

    scene.add(light)

    mineLights.push(light)


    // Visible glowing bulb
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.18,
            12,
            12
        ),
        new THREE.MeshBasicMaterial({
            color: 0xffb35c
        })
    )

    bulb.position.copy(
        light.position
    )

    scene.add(bulb)
}


// ============================================================
// CREATE LANTERNS
// ============================================================

function createMineLanterns() {

    for (
        let z = -14;
        z <= 14;
        z += 7
    ) {

        createLantern(
            -3.8,
            5.7,
            z
        )

        createLantern(
            3.8,
            5.7,
            z
        )
    }
}


// ============================================================
// CREATE CRATE
// ============================================================

function createCrate(x, z) {

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x70472b,
            roughness: 0.9
        })

    const crate = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.3,
            1.3,
            1.3
        ),
        material
    )

    crate.position.set(
        x,
        0.65,
        z
    )

    crate.rotation.y =
        Math.random() * Math.PI

    crate.castShadow = true

    scene.add(crate)
}


// ============================================================
// CREATE MINE CART
// ============================================================

function createMineCart() {

    const cartMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.7,
            roughness: 0.5
        })

    const cart = new THREE.Mesh(
        new THREE.BoxGeometry(
            2.4,
            1,
            1.5
        ),
        cartMaterial
    )

    cart.position.set(
        8,
        0.65,
        -5
    )

    cart.castShadow = true

    scene.add(cart)


    // Wheels
    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.8
        })

    for (const x of [-0.8, 0.8]) {

        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.35,
                0.35,
                0.2,
                16
            ),
            wheelMaterial
        )

        wheel.rotation.z =
            Math.PI / 2

        wheel.position.set(
            8 + x,
            0.35,
            -5
        )

        scene.add(wheel)
    }
}


// ============================================================
// CREATE ENTIRE MINE
// ============================================================

function createMine() {

    createMineFloor()

    createMineWalls()

    createMineSupports()

    createRails()

    createDecorativeRocks()

    createMineLanterns()

    createCrate(-8, 8)
    createCrate(-10, 10)
    createCrate(10, 12)

    createMineCart()
}


// ============================================================
// PHYSICS
// ============================================================

function createPhysics() {

    // Floor
    floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane()
    })

    floorBody.quaternion.setFromEuler(
        -Math.PI / 2,
        0,
        0
    )

    physicsWorld.addBody(
        floorBody
    )

    setupJump(floorBody)


    // Four invisible collision walls
    const wallConfigs = [

        {
            pos: [0, 4, -20],
            size: [60, 8, 1]
        },

        {
            pos: [0, 4, 20],
            size: [60, 8, 1]
        },

        {
            pos: [-30, 4, 0],
            size: [1, 8, 40]
        },

        {
            pos: [30, 4, 0],
            size: [1, 8, 40]
        }
    ]


    wallConfigs.forEach(
        ({ pos, size }) => {

            const body =
                new CANNON.Body({
                    type: CANNON.Body.STATIC,

                    shape: new CANNON.Box(
                        new CANNON.Vec3(
                            size[0] / 2,
                            size[1] / 2,
                            size[2] / 2
                        )
                    )
                })

            body.position.set(
                ...pos
            )

            physicsWorld.addBody(
                body
            )
        }
    )
}


// ============================================================
// TERMINAL
// ============================================================

function createTerminal() {

    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x202a2d,
            metalness: 0.5,
            roughness: 0.5
        })

    terminalMesh = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.5,
            2,
            0.6
        ),
        bodyMaterial
    )

    terminalMesh.position.set(
        0,
        1,
        -14
    )

    terminalMesh.visible = false

    scene.add(
        terminalMesh
    )


    const screenMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8
        })

    screenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(
            1,
            1.2
        ),
        screenMaterial
    )

    screenMesh.position.set(
        0,
        1.2,
        -13.68
    )

    screenMesh.visible = false

    scene.add(
        screenMesh
    )
}


// ============================================================
// PORTAL
// ============================================================

function createPortal() {

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x9900ff,
            emissive: 0x9900ff,
            emissiveIntensity: 1
        })

    portalMesh = new THREE.Mesh(
        new THREE.TorusGeometry(
            2,
            0.35,
            20,
            60
        ),
        material
    )

    portalMesh.position.set(
        0,
        2,
        -17
    )

    portalMesh.rotation.x =
        Math.PI / 2

    portalMesh.visible = false

    scene.add(
        portalMesh
    )
}


// ============================================================
// TERMINAL / PORTAL LOGIC
// ============================================================

function showTerminal() {

    terminalVisible = true

    if (terminalMesh)
        terminalMesh.visible = true

    if (screenMesh)
        screenMesh.visible = true

    console.log(
        'Terminal appeared - press E'
    )
}


function activatePortal() {

    portalActive = true

    if (portalMesh)
        portalMesh.visible = true

    console.log(
        'Portal is open'
    )
}


// ============================================================
// FRAGMENTS
// ============================================================

function spawnFragment(position) {

    let fragmentMesh

    if (fragmentTemplate) {

        fragmentMesh =
            fragmentTemplate.clone()

    } else {

        const geometry =
            new THREE.OctahedronGeometry(
                0.45
            )

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x00ffff,
                emissiveIntensity: 0.8
            })

        fragmentMesh =
            new THREE.Mesh(
                geometry,
                material
            )
    }

    fragmentMesh.position.set(
        position.x,
        1,
        position.z
    )

    scene.add(
        fragmentMesh
    )

    fragments.push(
        fragmentMesh
    )
}


function checkFragmentCollection() {

    for (
        let i = fragments.length - 1;
        i >= 0;
        i--
    ) {

        const fragment =
            fragments[i]

        const distance =
            fragment.position.distanceTo(
                playerMesh.position
            )

        if (distance < 1.5) {

            scene.remove(
                fragment
            )

            fragments.splice(
                i,
                1
            )

            fragmentsCollected++

            console.log(
                'Fragment collected:',
                fragmentsCollected,
                '/',
                FRAGMENTS_NEEDED
            )
        }
    }
}


// ============================================================
// INIT LEVEL
// ============================================================

function initLevel1(
    gameScene,
    gameCamera,
    keys,
    onComplete
) {

    scene = gameScene
    camera = gameCamera
    onLevel1Complete = onComplete


    // Background
    scene.background =
        new THREE.Color(
            0x080706
        )


    // Fog makes the mine feel deeper
    scene.fog =
        new THREE.Fog(
            0x080706,
            25,
            70
        )


    // Basic ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);

    scene.add(
        ambientLight
    )


    // Build mine
    createMine()


    // Physics
    createPhysics()


    // Gameplay objects
    createTerminal()
    createPortal()


    // Player
    scene.add(
        playerMesh
    )

    scene.add(
        attackIndicator
    )


    // Combat
    setupCombatInput()


    // HUD
    initHUD()


    // Enemy waves
    initWaves(
        scene,
        () => {

            spawnCommander(
                scene,
                () => {
                    showTerminal()
                }
            )
        }
    )


    console.log(
        'Level 1 mine initialized'
    )
}


// ============================================================
// UPDATE
// ============================================================

function updateLevel1(
    delta,
    keys
) {

    if (getGameOver()) {

        showGameOver()

        return
    }


    // -----------------------------
    // PLAYER
    // -----------------------------

    updatePlayer(
        delta,
        keys,
        camera
    )


    // -----------------------------
    // ENEMIES
    // -----------------------------

    updateEnemies(
        delta,
        playerBody,
        playerMesh,
        camera
    )


    updateCommander(
        delta,
        playerBody,
        spawnFragment
    )


    // -----------------------------
    // FRAGMENTS
    // -----------------------------

    checkFragmentCollection()


    // -----------------------------
    // TERMINAL
    // -----------------------------

    if (
        terminalVisible &&
        !terminalActive
    ) {

        const distance =
            terminalMesh.position.distanceTo(
                playerMesh.position
            )

        if (
            distance < 3 &&
            keys['KeyE']
        ) {

            if (
                fragmentsCollected >=
                FRAGMENTS_NEEDED
            ) {

                terminalActive = true

                activatePortal()

            } else {

                console.log(
                    'Need all fragments:',
                    fragmentsCollected,
                    '/',
                    FRAGMENTS_NEEDED
                )
            }
        }
    }


    // -----------------------------
    // PORTAL
    // -----------------------------

    if (portalActive) {

        const distance =
            portalMesh.position.distanceTo(
                playerMesh.position
            )

        if (distance < 2.5) {

            console.log(
                'ENTERING LEVEL 2'
            )

            if (onLevel1Complete) {
                onLevel1Complete()
            }
        }

        portalMesh.rotation.z +=
            delta * 2
    }


    // -----------------------------
    // FRAGMENT ANIMATION
    // -----------------------------

    fragments.forEach(
        fragment => {

            fragment.rotation.y +=
                delta * 2

            fragment.position.y =
                1 +
                Math.sin(
                    Date.now() * 0.003
                ) * 0.15
        }
    )


    // -----------------------------
    // TERMINAL ANIMATION
    // -----------------------------

    if (
        terminalVisible &&
        screenMesh
    ) {

        const pulse =
            Math.sin(
                Date.now() * 0.003
            ) * 0.3 + 0.7

        screenMesh.material
            .emissiveIntensity =
            pulse
    }


    // -----------------------------
    // SHADER ANIMATION
    // -----------------------------

    mineMaterials.forEach(
        material => {

            if (
                material.uniforms &&
                material.uniforms.time
            ) {

                material.uniforms.time.value +=
                    delta
            }
        }
    )


    // -----------------------------
    // LANTERN FLICKER
    // -----------------------------

    mineLights.forEach(
        (light, index) => {

            light.intensity =
                2.3 +
                Math.sin(
                    Date.now() * 0.006 +
                    index
                ) * 0.3
        }
    )


    // -----------------------------
    // WAVES
    // -----------------------------

    const enemies =
        getEnemies()

    if (
        enemies.length === 0 &&
        isWaveInProgress()
    ) {

        setWaveInProgress(
            false
        )

        onWaveComplete(
            spawnFragment
        )
    }


    // -----------------------------
    // PHYSICS
    // -----------------------------

    physicsWorld.step(
        1 / 60,
        delta,
        3
    )


    // -----------------------------
    // HUD
    // -----------------------------

    updateHUD(
        getPlayerHealth(),
        getPlayerMaxHealth(),
        fragmentsCollected,
        getCurrentWave(),
        getTotalWaves(),
        isCommanderAlive()
    )
}


export {
    initLevel1,
    updateLevel1
}