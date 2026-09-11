import * as THREE from 'three';

import { Level1 } from './levels/Level1.js';
import { Level1 as Level2 } from './levels/Level2.js';
import { Level3 } from './levels/Level3.js';


// =====================================================
// CURRENT LEVEL
// =====================================================

let currentLevel = null;
let currentLevelNumber = 1;


// =====================================================
// CAMERAS
// =====================================================

// -----------------------------------------------------
// LEVEL 1 CAMERA
// ORTHOGRAPHIC = 2D / PIXEL ART STYLE
// -----------------------------------------------------

const level1Camera = new THREE.OrthographicCamera(
    -12,
    12,
    9,
    -9,
    0.1,
    1000
);

// Look straight down at the arena
level1Camera.position.set(
    0,
    20,
    0
);

level1Camera.rotation.set(
    -Math.PI / 2,
    0,
    0
);


// -----------------------------------------------------
// LEVEL 2 / LEVEL 3 CAMERA
// NORMAL 3D PERSPECTIVE
// -----------------------------------------------------

const perspectiveCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

perspectiveCamera.position.set(
    0,
    1.8,
    25
);


// -----------------------------------------------------
// ACTIVE CAMERA
// -----------------------------------------------------

let camera = level1Camera;


// =====================================================
// RENDERER
// =====================================================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);

renderer.shadowMap.enabled = true;

renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

renderer.outputColorSpace =
    THREE.SRGBColorSpace;

document.body.appendChild(
    renderer.domElement
);


// =====================================================
// PLAYER MOVEMENT
// =====================================================

const keys = {};

const moveSpeed = 8;
const sprintSpeed = 15;


// =====================================================
// LEVEL LOADING
// =====================================================

function loadLevel(number) {

    // Dispose previous level
    if (
        currentLevel &&
        currentLevel.dispose
    ) {
        currentLevel.dispose();
    }


    currentLevelNumber = number;


    // =================================================
    // LEVEL 1
    // =================================================

    if (number === 1) {

        currentLevel = new Level1();

        // Use ORTHOGRAPHIC camera
        camera = level1Camera;

        // Put camera above centre of arena
        camera.position.set(
            0,
            20,
            0
        );

        // Look straight down
        camera.rotation.set(
            -Math.PI / 2,
            0,
            0
        );

        // Reset mouse values
        yaw = 0;
        pitch = 0;

        console.log(
            'LEVEL 1 - ORTHOGRAPHIC 2D CAMERA'
        );
    }


    // =================================================
    // LEVEL 2
    // =================================================

    else if (number === 2) {

        currentLevel = new Level2();

        // Use normal 3D camera
        camera = perspectiveCamera;

        camera.position.set(
            0,
            1.8,
            25
        );

        camera.rotation.set(
            0,
            0,
            0
        );

        yaw = 0;
        pitch = 0;

        console.log(
            'LEVEL 2 - 3D PERSPECTIVE CAMERA'
        );
    }


    // =================================================
    // LEVEL 3
    // =================================================

    else if (number === 3) {

        currentLevel = new Level3();

        // Use normal 3D camera
        camera = perspectiveCamera;

        camera.position.set(
            0,
            1.8,
            25
        );

        camera.rotation.set(
            0,
            0,
            0
        );

        yaw = 0;
        pitch = 0;

        console.log(
            'LEVEL 3 - 3D PERSPECTIVE CAMERA'
        );
    }

}


// =====================================================
// KEYBOARD INPUT
// =====================================================

window.addEventListener(
    'keydown',
    (event) => {

        keys[event.code] = true;


        // -------------------------------------------------
        // LEVEL SELECTOR
        // -------------------------------------------------

        if (event.code === 'Digit1') {

            loadLevel(1);

        }


        if (event.code === 'Digit2') {

            loadLevel(2);

        }


        if (event.code === 'Digit3') {

            loadLevel(3);

        }

    }
);


window.addEventListener(
    'keyup',
    (event) => {

        keys[event.code] = false;

    }
);


// =====================================================
// MOUSE LOOK
// ONLY FOR LEVEL 2 / LEVEL 3
// =====================================================

let yaw = 0;
let pitch = 0;

const mouseSensitivity = 0.0025;


// -----------------------------------------------------
// CLICK TO LOCK MOUSE
// -----------------------------------------------------

renderer.domElement.addEventListener(
    'click',
    () => {

        // DO NOT lock mouse in Level 1
        if (currentLevelNumber === 1) {
            return;
        }

        renderer.domElement.requestPointerLock();

    }
);


// -----------------------------------------------------
// MOUSE MOVEMENT
// -----------------------------------------------------

document.addEventListener(
    'mousemove',
    (event) => {

        // Level 1 does NOT use mouse look
        if (currentLevelNumber === 1) {
            return;
        }


        // Make sure pointer is locked
        if (
            document.pointerLockElement !==
            renderer.domElement
        ) {
            return;
        }


        yaw -=
            event.movementX *
            mouseSensitivity;


        pitch -=
            event.movementY *
            mouseSensitivity;


        // Prevent camera flipping

        const maxPitch =
            Math.PI / 2 - 0.05;


        pitch =
            Math.max(
                -maxPitch,
                Math.min(
                    maxPitch,
                    pitch
                )
            );

    }
);


// =====================================================
// RESIZE
// =====================================================

window.addEventListener(
    'resize',
    () => {

        // =================================================
        // LEVEL 1 ORTHOGRAPHIC CAMERA
        // =================================================

        const aspect =
            window.innerWidth /
            window.innerHeight;


        const viewHeight = 18;

        const viewWidth =
            viewHeight * aspect;


        level1Camera.left =
            -viewWidth / 2;

        level1Camera.right =
            viewWidth / 2;

        level1Camera.top =
            viewHeight / 2;

        level1Camera.bottom =
            -viewHeight / 2;


        level1Camera.updateProjectionMatrix();


        // =================================================
        // LEVEL 2 / LEVEL 3 PERSPECTIVE CAMERA
        // =================================================

        perspectiveCamera.aspect =
            aspect;

        perspectiveCamera.updateProjectionMatrix();


        // =================================================
        // RENDERER
        // =================================================

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }
);


// =====================================================
// CLOCK
// =====================================================

const clock =
    new THREE.Clock();


// =====================================================
// PLAYER / CAMERA MOVEMENT
// =====================================================

function updatePlayer(delta) {

    let speed =
        moveSpeed;


    // SHIFT = sprint

    if (
        keys['ShiftLeft'] ||
        keys['ShiftRight']
    ) {

        speed =
            sprintSpeed;

    }


    const distance =
        speed * delta;


    // =================================================
    // LEVEL 1
    // ORTHOGRAPHIC 2D MOVEMENT
    // =================================================

    if (currentLevelNumber === 1) {

        // W = move up on the arena
        if (keys['KeyW']) {

            camera.position.z -=
                distance;

        }


        // S = move down on the arena
        if (keys['KeyS']) {

            camera.position.z +=
                distance;

        }


        // A = move left
        if (keys['KeyA']) {

            camera.position.x -=
                distance;

        }


        // D = move right
        if (keys['KeyD']) {

            camera.position.x +=
                distance;

        }


        // Keep camera/player inside Level 1 arena
        camera.position.x =
            THREE.MathUtils.clamp(
                camera.position.x,
                -10,
                10
            );


        camera.position.z =
            THREE.MathUtils.clamp(
                camera.position.z,
                -6,
                6
            );


        // IMPORTANT:
        // Keep Level 1 looking straight down

        camera.rotation.set(
            -Math.PI / 2,
            0,
            0
        );


        return;
    }


    // =================================================
    // LEVEL 2 / LEVEL 3
    // NORMAL 3D MOVEMENT
    // =================================================

    if (keys['KeyW']) {

        camera.translateZ(
            -distance
        );

    }


    if (keys['KeyS']) {

        camera.translateZ(
            distance
        );

    }


    if (keys['KeyA']) {

        camera.translateX(
            -distance
        );

    }


    if (keys['KeyD']) {

        camera.translateX(
            distance
        );

    }


    // =================================================
    // CAMERA LOOK
    // =================================================

    camera.rotation.order =
        'YXZ';

    camera.rotation.y =
        yaw;

    camera.rotation.x =
        pitch;


    // =================================================
    // KEEP PLAYER ABOVE GROUND
    // =================================================

    if (
        camera.position.y < 1.5
    ) {

        camera.position.y =
            1.5;

    }

}


// =====================================================
// ANIMATION LOOP
// =====================================================

function animate() {

    requestAnimationFrame(
        animate
    );


    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );


    // -------------------------------------------------
    // PLAYER
    // -------------------------------------------------

    updatePlayer(delta);


    // -------------------------------------------------
    // KEEP LEVEL 2 SKY CENTERED ON CAMERA
    // -------------------------------------------------

    if (
        currentLevel &&
        currentLevel.sky
    ) {

        currentLevel.sky.position.copy(
            camera.position
        );

    }


    // -------------------------------------------------
    // UPDATE CURRENT LEVEL
    // -------------------------------------------------

    if (
        currentLevel &&
        currentLevel.update &&
        typeof currentLevel.update ===
        'function'
    ) {

        currentLevel.update(
            delta
        );

    }


    // -------------------------------------------------
    // RENDER ACTUAL LEVEL SCENE
    // -------------------------------------------------

    if (currentLevel) {

        renderer.render(
            currentLevel.scene,
            camera
        );

    }

}


// =====================================================
// START GAME
// =====================================================

// Automatically start Level 1
// This means the orthographic camera is used
// immediately when the game opens.

loadLevel(1);


// Start animation
animate();