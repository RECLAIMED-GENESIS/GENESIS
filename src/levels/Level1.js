import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Level1 {

    constructor() {

        // =====================================================
        // SCENE
        // =====================================================

        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(0x05060b);

        this.scene.fog = new THREE.Fog(
            0x05060b,
            30,
            90
        );


        // =====================================================
        // LEVEL
        // =====================================================

        this.level = new THREE.Group();

        this.scene.add(this.level);


        // =====================================================
        // GAMEPLAY OBJECTS
        // =====================================================

        this.model = null;

        this.enemies = [];

        this.fragments = [];

        this.portalParts = [];

        this.portal = null;

        this.player = null;


        // =====================================================
        // LIGHTS
        // =====================================================

        this.createLighting();


        // =====================================================
        // LOAD BLENDER LEVEL
        // =====================================================

        this.loadLevel();
    }


    // =========================================================
    // LIGHTING
    // =========================================================

    createLighting() {

        const ambient =
            new THREE.AmbientLight(
                0x8b91b8,
                1.5
            );

        this.level.add(ambient);


        const mainLight =
            new THREE.DirectionalLight(
                0xc7d4ff,
                2.5
            );

        mainLight.position.set(
            15,
            30,
            20
        );

        mainLight.castShadow = true;

        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;

        mainLight.shadow.camera.left = -50;
        mainLight.shadow.camera.right = 50;
        mainLight.shadow.camera.top = 50;
        mainLight.shadow.camera.bottom = -50;

        mainLight.shadow.camera.near = 1;
        mainLight.shadow.camera.far = 150;

        this.level.add(mainLight);


        // Cyan atmosphere

        const cyanLight =
            new THREE.PointLight(
                0x00d9ff,
                12,
                40
            );

        cyanLight.position.set(
            0,
            5,
            0
        );

        this.level.add(cyanLight);


        // Purple atmosphere

        const purpleLight =
            new THREE.PointLight(
                0x7b2cff,
                10,
                35
            );

        purpleLight.position.set(
            -12,
            5,
            -5
        );

        this.level.add(purpleLight);
    }


    // =========================================================
    // LOAD BLENDER GLB
    // =========================================================

    loadLevel() {

        const loader = new GLTFLoader();

        loader.load(

            '/assets/models/Level1.glb',

            (gltf) => {

                this.model = gltf.scene;


                // Keep Blender scale
                this.model.scale.set(
                    1,
                    1,
                    1
                );


                this.model.position.set(
                    0,
                    0,
                    0
                );


                // =================================================
                // PROCESS BLENDER OBJECTS
                // =================================================

                this.model.traverse((object) => {

                    if (!object.isMesh) {
                        return;
                    }


                    object.castShadow = true;

                    object.receiveShadow = true;


                    // Save original material name
                    // BEFORE replacing material

                    const originalMaterial =
                        object.material;

                    const materialName =
                        originalMaterial &&
                        originalMaterial.name
                            ? originalMaterial.name
                            : '';


                    object.userData.originalMaterialName =
                        materialName;


                    // =================================================
                    // FLOOR
                    // =================================================

                    if (
                        materialName ===
                        'PIXEL_FLOOR'
                    ) {

                        object.material =
                            this.createFloorMaterial(
                                0x242735
                            );
                    }


                    if (
                        materialName ===
                        'PIXEL_FLOOR_LIGHT'
                    ) {

                        object.material =
                            this.createFloorMaterial(
                                0x3b4050
                            );
                    }


                    if (
                        materialName ===
                        'PIXEL_FLOOR_DARK'
                    ) {

                        object.material =
                            this.createFloorMaterial(
                                0x151821
                            );
                    }


                    // =================================================
                    // WOOD
                    // =================================================

                    if (
                        materialName ===
                        'WOOD_DARK'
                    ) {

                        object.material =
                            this.createWoodMaterial(
                                0x241b1c
                            );
                    }


                    if (
                        materialName ===
                        'WOOD_LIGHT'
                    ) {

                        object.material =
                            this.createWoodMaterial(
                                0x4a3530
                            );
                    }


                    if (
                        materialName ===
                        'WOOD_SHADOW'
                    ) {

                        object.material =
                            this.createWoodMaterial(
                                0x171316
                            );
                    }


                    if (
                        materialName ===
                        'WOOD_TOP'
                    ) {

                        object.material =
                            this.createWoodMaterial(
                                0x5a4034
                            );
                    }


                    // =================================================
                    // ROCK
                    // =================================================

                    if (
                        materialName ===
                        'MINE_ROCK'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x35343b,

                                roughness: 1.0,

                                metalness: 0.05
                            });
                    }


                    // =================================================
                    // GOLD ORE
                    // =================================================

                    if (
                        materialName ===
                        'GOLD_ORE'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x8c5720,

                                roughness: 0.5,

                                metalness: 0.25,

                                emissive: 0x321400,

                                emissiveIntensity: 0.5
                            });
                    }


                    if (
                        materialName ===
                        'GOLD_ORE_LIGHT'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0xffa51f,

                                roughness: 0.35,

                                metalness: 0.2,

                                emissive: 0xff5a00,

                                emissiveIntensity: 1.8
                            });
                    }


                    // =================================================
                    // ENEMY
                    // =================================================

                    if (
                        materialName ===
                        'ENEMY_RED'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x8b1824,

                                roughness: 0.55,

                                metalness: 0.2
                            });


                        object.userData.isEnemy = true;

                        this.enemies.push(
                            object
                        );
                    }


                    if (
                        materialName ===
                        'ENEMY_DARK'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x171923,

                                roughness: 0.4,

                                metalness: 0.65
                            });


                        object.userData.isEnemy = true;
                    }


                    if (
                        materialName ===
                        'ENEMY_RED_LIGHT'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0xff304f,

                                emissive: 0xff1028,

                                emissiveIntensity: 4,

                                roughness: 0.25,

                                metalness: 0.2
                            });


                        object.userData.isEnemy = true;
                    }


                    // =================================================
                    // GLITCH FRAGMENT
                    // =================================================

                    if (
                        materialName ===
                        'GLITCH_FRAGMENT_ORANGE'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0xff7a00,

                                emissive: 0xff3500,

                                emissiveIntensity: 4,

                                roughness: 0.25,

                                metalness: 0.2
                            });


                        object.userData.isFragment = true;

                        this.fragments.push(
                            object
                        );
                    }


                    if (
                        materialName ===
                        'GLITCH_FRAGMENT_CORE'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0xffffff,

                                emissive: 0xffd000,

                                emissiveIntensity: 6,

                                roughness: 0.1,

                                metalness: 0.1
                            });


                        object.userData.isFragment = true;
                    }


                    // =================================================
                    // PLAYER
                    // =================================================

                    if (
                        materialName ===
                        'PLAYER_BLUE'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x1677ff,

                                roughness: 0.4,

                                metalness: 0.25
                            });


                        object.userData.isPlayer = true;

                        this.player = object;
                    }


                    if (
                        materialName ===
                        'PLAYER_LIGHT_BLUE'
                    ) {

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x6cecff,

                                emissive: 0x008cff,

                                emissiveIntensity: 2.5,

                                roughness: 0.25
                            });


                        object.userData.isPlayer = true;
                    }


                    // =================================================
                    // PORTAL
                    // =================================================

                    if (
                        materialName ===
                        'PORTAL_CYAN'
                    ) {

                        object.userData.isPortalPart = true;

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x00ffff,

                                emissive: 0x00d9ff,

                                emissiveIntensity: 7,

                                transparent: true,

                                opacity: 0.8,

                                roughness: 0.15,

                                metalness: 0.1
                            });


                        this.portalParts.push(
                            object
                        );

                        this.portal = object;
                    }


                    if (
                        materialName ===
                        'PORTAL_CORE'
                    ) {

                        object.userData.isPortalPart = true;

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0xffffff,

                                emissive: 0x00ffff,

                                emissiveIntensity: 10
                            });


                        this.portalParts.push(
                            object
                        );
                    }


                    if (
                        materialName ===
                        'PORTAL_FRAME'
                    ) {

                        object.userData.isPortalPart = true;

                        object.material =
                            new THREE.MeshStandardMaterial({

                                color: 0x303744,

                                roughness: 0.35,

                                metalness: 0.75
                            });


                        this.portalParts.push(
                            object
                        );
                    }

                });


                // =================================================
                // ADD MODEL
                // =================================================

                this.level.add(
                    this.model
                );


                // =================================================
                // HIDE PORTAL
                // =================================================

                this.setPortalVisible(
                    false
                );


                console.log(
                    '========================'
                );

                console.log(
                    'LEVEL 1 LOADED'
                );

                console.log(
                    'Enemies:',
                    this.enemies.length
                );

                console.log(
                    'Fragments:',
                    this.fragments.length
                );

                console.log(
                    'Portal parts:',
                    this.portalParts.length
                );

                console.log(
                    '========================'
                );
            },


            // Loading progress

            (progress) => {

                if (
                    progress.total > 0
                ) {

                    const percent =
                        Math.round(
                            progress.loaded /
                            progress.total *
                            100
                        );

                    console.log(
                        'Level 1 loading:',
                        percent + '%'
                    );
                }
            },


            // Error

            (error) => {

                console.error(
                    'ERROR: Could not load Level1.glb'
                );

                console.error(error);
            }
        );
    }


    // =========================================================
    // PIXEL FLOOR MATERIAL
    // =========================================================

    createFloorMaterial(baseColor) {

        const texture =
            this.generatePixelTexture(
                baseColor
            );


        texture.wrapS =
            THREE.RepeatWrapping;

        texture.wrapT =
            THREE.RepeatWrapping;


        texture.repeat.set(
            2,
            2
        );


        return new THREE.MeshStandardMaterial({

            map: texture,

            roughness: 0.9,

            metalness: 0.05
        });
    }


    // =========================================================
    // WOOD MATERIAL
    // =========================================================

    createWoodMaterial(baseColor) {

        const texture =
            this.generateWoodTexture(
                baseColor
            );


        texture.wrapS =
            THREE.RepeatWrapping;

        texture.wrapT =
            THREE.RepeatWrapping;


        return new THREE.MeshStandardMaterial({

            map: texture,

            roughness: 0.85,

            metalness: 0.05
        });
    }


    // =========================================================
    // PIXEL TEXTURE
    // =========================================================

    generatePixelTexture(baseColor) {

        const size = 64;


        const canvas =
            document.createElement(
                'canvas'
            );


        canvas.width = size;
        canvas.height = size;


        const ctx =
            canvas.getContext(
                '2d'
            );


        const color =
            new THREE.Color(
                baseColor
            );


        const r =
            Math.floor(
                color.r * 255
            );

        const g =
            Math.floor(
                color.g * 255
            );

        const b =
            Math.floor(
                color.b * 255
            );


        ctx.fillStyle =
            `rgb(${r},${g},${b})`;


        ctx.fillRect(
            0,
            0,
            size,
            size
        );


        // Pixel grid

        ctx.strokeStyle =
            'rgba(120,140,180,0.18)';

        ctx.lineWidth = 1;


        for (
            let x = 0;
            x <= size;
            x += 8
        ) {

            ctx.beginPath();

            ctx.moveTo(
                x,
                0
            );

            ctx.lineTo(
                x,
                size
            );

            ctx.stroke();
        }


        for (
            let y = 0;
            y <= size;
            y += 8
        ) {

            ctx.beginPath();

            ctx.moveTo(
                0,
                y
            );

            ctx.lineTo(
                size,
                y
            );

            ctx.stroke();
        }


        // Pixel noise

        for (
            let i = 0;
            i < 35;
            i++
        ) {

            ctx.fillStyle =
                'rgba(255,255,255,0.06)';


            const x =
                Math.floor(
                    Math.random() * size
                );


            const y =
                Math.floor(
                    Math.random() * size
                );


            ctx.fillRect(
                x,
                y,
                2,
                2
            );
        }


        const texture =
            new THREE.CanvasTexture(
                canvas
            );


        texture.magFilter =
            THREE.NearestFilter;

        texture.minFilter =
            THREE.NearestFilter;


        texture.colorSpace =
            THREE.SRGBColorSpace;


        return texture;
    }


    // =========================================================
    // WOOD TEXTURE
    // =========================================================

    generateWoodTexture(baseColor) {

        const size = 64;


        const canvas =
            document.createElement(
                'canvas'
            );


        canvas.width = size;
        canvas.height = size;


        const ctx =
            canvas.getContext(
                '2d'
            );


        const color =
            new THREE.Color(
                baseColor
            );


        const r =
            Math.floor(
                color.r * 255
            );

        const g =
            Math.floor(
                color.g * 255
            );

        const b =
            Math.floor(
                color.b * 255
            );


        ctx.fillStyle =
            `rgb(${r},${g},${b})`;


        ctx.fillRect(
            0,
            0,
            size,
            size
        );


        // Wood pixel lines

        ctx.strokeStyle =
            'rgba(0,0,0,0.25)';

        ctx.lineWidth = 2;


        for (
            let y = 5;
            y < size;
            y += 8
        ) {

            ctx.beginPath();

            ctx.moveTo(
                0,
                y
            );

            ctx.lineTo(
                size,
                y
            );

            ctx.stroke();
        }


        const texture =
            new THREE.CanvasTexture(
                canvas
            );


        texture.magFilter =
            THREE.NearestFilter;

        texture.minFilter =
            THREE.NearestFilter;


        texture.colorSpace =
            THREE.SRGBColorSpace;


        return texture;
    }


    // =========================================================
    // PORTAL VISIBILITY
    // =========================================================

    setPortalVisible(visible) {

        for (
            const part
            of this.portalParts
        ) {

            part.visible =
                visible;
        }
    }


    // =========================================================
    // COLLECT FRAGMENT
    // =========================================================

    collectFragment(fragment) {

        if (!fragment) {
            return;
        }


        fragment.visible = false;


        const index =
            this.fragments.indexOf(
                fragment
            );


        if (index !== -1) {

            this.fragments.splice(
                index,
                1
            );
        }


        console.log(
            'Fragment collected!'
        );


        console.log(
            'Fragments remaining:',
            this.fragments.length
        );


        // =====================================================
        // ALL FRAGMENTS COLLECTED
        // =====================================================

        if (
            this.fragments.length === 0
        ) {

            console.log(
                'ALL FRAGMENTS COLLECTED!'
            );


            console.log(
                'PORTAL ACTIVATED!'
            );


            this.setPortalVisible(
                true
            );
        }
    }


    // =========================================================
    // UPDATE
    // =========================================================

    update(deltaTime) {

        const time =
            performance.now() *
            0.001;


        // =====================================================
        // FRAGMENTS FLOAT
        // =====================================================

        for (
            let i = 0;
            i < this.fragments.length;
            i++
        ) {

            const fragment =
                this.fragments[i];


            fragment.rotation.y +=
                deltaTime * 1.5;


            fragment.position.y +=
                Math.sin(
                    time * 3 + i
                ) *
                deltaTime *
                0.35;
        }


        // =====================================================
        // ENEMY IDLE MOVEMENT
        // =====================================================

        for (
            let i = 0;
            i < this.enemies.length;
            i++
        ) {

            const enemy =
                this.enemies[i];


            enemy.rotation.y +=
                deltaTime * 0.2;
        }


        // =====================================================
        // PORTAL ANIMATION
        // =====================================================

        if (
            this.portal &&
            this.portal.visible
        ) {

            this.portal.rotation.y +=
                deltaTime * 1.2;


            const pulse =
                1 +
                Math.sin(
                    time * 5
                ) *
                0.08;


            this.portal.scale.set(
                pulse,
                pulse,
                pulse
            );
        }
    }


    // =========================================================
    // DISPOSE
    // =========================================================

    dispose() {

        if (!this.model) {
            return;
        }


        this.model.traverse(
            (object) => {

                if (!object.isMesh) {
                    return;
                }


                // Geometry

                if (
                    object.geometry
                ) {

                    object.geometry.dispose();
                }


                // Material

                if (
                    object.material
                ) {

                    if (
                        Array.isArray(
                            object.material
                        )
                    ) {

                        object.material.forEach(
                            (material) => {

                                if (
                                    material.map
                                ) {

                                    material.map.dispose();
                                }


                                material.dispose();
                            }
                        );

                    } else {

                        if (
                            object.material.map
                        ) {

                            object.material.map.dispose();
                        }


                        object.material.dispose();
                    }
                }
            }
        );


        this.scene.clear();


        this.enemies = [];

        this.fragments = [];

        this.portalParts = [];

        this.portal = null;

        this.player = null;

        this.model = null;
    }
}