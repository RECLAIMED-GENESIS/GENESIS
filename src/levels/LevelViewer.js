// src/levels/LevelViewer.js
// Free-camera viewer for Level 1-3.
// Press 1, 2 or 3 to open a level, Escape to go back to the menu.
// Runs its own render loop while active so it does not touch the
// arena game loop in main.js.

import * as THREE from 'three';

import { Level1 } from './Level1.js';
import { Level2 } from './Level2.js';
import { Level3 } from './Level3.js';


export function createLevelViewer(renderer, { onEnter, onExit } = {}) {

    // =====================================================
    // CURRENT LEVEL
    // =====================================================

    let currentLevel = null;
    let currentLevelNumber = 1;
    let active = false;


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
    level1Camera.position.set(0, 20, 0);
    level1Camera.rotation.set(-Math.PI / 2, 0, 0);


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

    perspectiveCamera.position.set(0, 1.8, 25);


    // -----------------------------------------------------
    // ACTIVE CAMERA
    // -----------------------------------------------------

    let camera = level1Camera;


    // =====================================================
    // RENDERER SETTINGS USED BY THE LEVELS
    // Applied while the viewer is open, restored on exit
    // so the arena game keeps its own settings.
    // =====================================================

    let savedRendererSettings = null;

    function applyRendererSettings() {
        savedRendererSettings = {
            pixelRatio: renderer.getPixelRatio(),
            shadowType: renderer.shadowMap.type,
            colorSpace: renderer.outputColorSpace
        };
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    function restoreRendererSettings() {
        if (!savedRendererSettings) return;
        renderer.setPixelRatio(savedRendererSettings.pixelRatio);
        renderer.shadowMap.type = savedRendererSettings.shadowType;
        renderer.outputColorSpace = savedRendererSettings.colorSpace;
        savedRendererSettings = null;
    }


    // =====================================================
    // PLAYER MOVEMENT
    // =====================================================

    const keys = {};

    const moveSpeed = 8;
    const sprintSpeed = 15;


    // =====================================================
    // MOUSE LOOK
    // ONLY FOR LEVEL 2 / LEVEL 3
    // =====================================================

    let yaw = 0;
    let pitch = 0;

    const mouseSensitivity = 0.0025;


    // =====================================================
    // LEVEL LOADING
    // =====================================================

    function loadLevel(number) {

        // Dispose previous level
        if (currentLevel && currentLevel.dispose) {
            currentLevel.dispose();
        }

        currentLevelNumber = number;

        if (!active) {
            active = true;
            applyRendererSettings();
            clock.getDelta();
            if (onEnter) onEnter(number);
            animate();
        }


        // =================================================
        // LEVEL 1
        // =================================================

        if (number === 1) {

            currentLevel = new Level1();

            // Use ORTHOGRAPHIC camera
            camera = level1Camera;

            // Put camera above centre of arena, looking straight down
            camera.position.set(0, 20, 0);
            camera.rotation.set(-Math.PI / 2, 0, 0);

            // Reset mouse values
            yaw = 0;
            pitch = 0;

            console.log('LEVEL 1 - ORTHOGRAPHIC 2D CAMERA');
        }


        // =================================================
        // LEVEL 2
        // =================================================

        else if (number === 2) {

            currentLevel = new Level2();

            // Use normal 3D camera
            camera = perspectiveCamera;

            // Start at the +Z end of the road (road runs z -130 to 130),
            // facing down the road towards -Z
            camera.position.set(0, 1.8, 129);

            yaw = 0;
            pitch = 0;

            camera.rotation.order = 'YXZ';
            camera.rotation.set(0, yaw, pitch);

            console.log('LEVEL 2 - 3D PERSPECTIVE CAMERA');
        }


        // =================================================
        // LEVEL 3
        // =================================================

        else if (number === 3) {

            currentLevel = new Level3(renderer);

            // Use normal 3D camera
            camera = perspectiveCamera;

            camera.position.set(110, 1.8, 73);

            yaw = Math.PI / 2.5;
            pitch = 0;
            camera.rotation.set(0, yaw, pitch);

            console.log('LEVEL 3 - 3D PERSPECTIVE CAMERA');
        }
    }


    function exit() {

        if (!active) return;

        active = false;

        if (currentLevel && currentLevel.dispose) {
            currentLevel.dispose();
        }
        currentLevel = null;

        if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock();
        }

        restoreRendererSettings();

        if (onExit) onExit();
    }


    // =====================================================
    // KEYBOARD INPUT
    // =====================================================

    window.addEventListener('keydown', (event) => {

        keys[event.code] = true;

        // -------------------------------------------------
        // LEVEL SELECTOR
        // -------------------------------------------------

        if (event.code === 'Digit1') loadLevel(1);
        if (event.code === 'Digit2') loadLevel(2);
        if (event.code === 'Digit3') loadLevel(3);

        if (event.code === 'Escape') exit();
    });


    window.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });


    // -----------------------------------------------------
    // CLICK TO LOCK MOUSE
    // -----------------------------------------------------

    renderer.domElement.addEventListener('click', () => {

        // DO NOT lock mouse in Level 1
        if (!active || currentLevelNumber === 1) {
            return;
        }

        renderer.domElement.requestPointerLock();
    });


    // -----------------------------------------------------
    // MOUSE MOVEMENT
    // -----------------------------------------------------

    document.addEventListener('mousemove', (event) => {

        // Level 1 does NOT use mouse look
        if (!active || currentLevelNumber === 1) {
            return;
        }

        // Make sure pointer is locked
        if (document.pointerLockElement !== renderer.domElement) {
            return;
        }

        yaw -= event.movementX * mouseSensitivity;
        pitch -= event.movementY * mouseSensitivity;

        // Prevent camera flipping
        const maxPitch = Math.PI / 2 - 0.05;

        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
    });


    // =====================================================
    // RESIZE
    // =====================================================

    window.addEventListener('resize', () => {

        // =================================================
        // LEVEL 1 ORTHOGRAPHIC CAMERA
        // =================================================

        const aspect = window.innerWidth / window.innerHeight;

        const viewHeight = 18;
        const viewWidth = viewHeight * aspect;

        level1Camera.left = -viewWidth / 2;
        level1Camera.right = viewWidth / 2;
        level1Camera.top = viewHeight / 2;
        level1Camera.bottom = -viewHeight / 2;

        level1Camera.updateProjectionMatrix();


        // =================================================
        // LEVEL 2 / LEVEL 3 PERSPECTIVE CAMERA
        // =================================================

        perspectiveCamera.aspect = aspect;
        perspectiveCamera.updateProjectionMatrix();
    });


    // =====================================================
    // CLOCK
    // =====================================================

    const clock = new THREE.Clock();


    // =====================================================
    // PLAYER / CAMERA MOVEMENT
    // =====================================================

    function updatePlayer(delta) {

        let speed = moveSpeed;

        // SHIFT = sprint
        if (keys['ShiftLeft'] || keys['ShiftRight']) {
            speed = sprintSpeed;
        }

        const distance = speed * delta;


        // =================================================
        // LEVEL 1
        // ORTHOGRAPHIC 2D MOVEMENT
        // =================================================

        if (currentLevelNumber === 1) {

            if (keys['KeyW']) camera.position.z -= distance;
            if (keys['KeyS']) camera.position.z += distance;
            if (keys['KeyA']) camera.position.x -= distance;
            if (keys['KeyD']) camera.position.x += distance;

            // Keep camera/player inside Level 1 arena
            camera.position.x = THREE.MathUtils.clamp(camera.position.x, -10, 10);
            camera.position.z = THREE.MathUtils.clamp(camera.position.z, -6, 6);

            // IMPORTANT:
            // Keep Level 1 looking straight down
            camera.rotation.set(-Math.PI / 2, 0, 0);

            return;
        }


        // =================================================
        // LEVEL 2 / LEVEL 3
        // NORMAL 3D MOVEMENT
        // =================================================

        if (keys['KeyW']) camera.translateZ(-distance);
        if (keys['KeyS']) camera.translateZ(distance);
        if (keys['KeyA']) camera.translateX(-distance);
        if (keys['KeyD']) camera.translateX(distance);


        // =================================================
        // CAMERA LOOK
        // =================================================

        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;


        // =================================================
        // KEEP PLAYER ABOVE GROUND
        // =================================================

        if (camera.position.y < 1.5) {
            camera.position.y = 1.5;
        }
    }


    // =====================================================
    // ANIMATION LOOP
    // =====================================================

    function animate() {

        if (!active) return;

        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.05);


        // -------------------------------------------------
        // PLAYER
        // -------------------------------------------------

        updatePlayer(delta);


        // -------------------------------------------------
        // KEEP LEVEL SKY CENTERED ON CAMERA
        // (LEVEL 2 SKYBOX / LEVEL 3 STAR SHELL)
        // -------------------------------------------------

        if (currentLevel && currentLevel.sky) {
            currentLevel.sky.position.copy(camera.position);
        }


        // -------------------------------------------------
        // UPDATE CURRENT LEVEL
        // -------------------------------------------------

        if (currentLevel && typeof currentLevel.update === 'function') {
            currentLevel.update(delta);
        }


        // -------------------------------------------------
        // RENDER ACTUAL LEVEL SCENE
        // -------------------------------------------------

        if (currentLevel) {
            renderer.render(currentLevel.scene, camera);
        }
    }


    return {
        loadLevel,
        exit,
        isActive: () => active
    };
}
