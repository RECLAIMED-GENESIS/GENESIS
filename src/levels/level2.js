import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AlienLevel {

    constructor(sceneOrRenderer = null, rendererMaybe = null) {

        // =========================================================
        // SCENE — supports both `new AlienLevel(scene, renderer)` (main.js)
        // and legacy `new AlienLevel()` (standalone)
        // =========================================================
        let outerScene = null;
        if (sceneOrRenderer && sceneOrRenderer.isScene) outerScene = sceneOrRenderer;
        // (renderer param ignored — level2 doesn't need PMREM)
        if (outerScene) {
            this.scene = outerScene;
            this.scene.background = new THREE.Color(0x09051c);
            this.scene.fog = new THREE.Fog(0x10082a, 55, 270);
        } else {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x09051c);
            this.scene.fog = new THREE.Fog(0x10082a, 55, 270);
        }

        // Contract expected by main.js — must exist before physics runs
        this.name = 'LEVEL 2 — NEON STREET';
        this.colliders = [];
        this.spawn = new THREE.Vector3(0, 0.1, 55);
        this.root = null; // will alias to this.level after creation

        this.level =
            new THREE.Group();

        this.scene.add(
            this.level
        );
        this.root = this.level;

        const textureLoader =
            new THREE.TextureLoader();

        // Banner texture for the street lights
        this.bannerTexture =
            textureLoader.load(
                '/assets/textures/burner.png'
            );

        this.bannerTexture.colorSpace =
            THREE.SRGBColorSpace;

        // Living-scene tracking arrays: every point light pushed here
        // gets a subtle organic flicker in update(); every banner
        // sways gently; the drift particles are the ambient "living
        // air" (embers/dust) moving through the whole street.
        this.livingLights = [];
        this.banners = [];
        this.driftParticles = null;


        // =========================================================
        // SKY
        // =========================================================

        const skyTexture =
            textureLoader.load(
                '/assets/textures/skybox1.png'
            );

        skyTexture.colorSpace =
            THREE.SRGBColorSpace;

        this.sky =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    500,
                    64,
                    32
                ),
                new THREE.MeshBasicMaterial({
                    map: skyTexture,
                    side: THREE.BackSide,
                    depthWrite: false,
                    fog: false
                })
            );

        this.scene.add(
            this.sky
        );


        // =========================================================
        // LIGHTING
        // =========================================================

        const ambient =
            new THREE.HemisphereLight(
                0x756fa8,
                0x171321,
                2.2
            );

        this.level.add(
            ambient
        );


        const sunset =
            new THREE.DirectionalLight(
                0xffd6cf,
                1.7
            );

        sunset.position.set(
            -80,
            100,
            -40
        );

        sunset.castShadow = true;

        sunset.shadow.mapSize.width =
            2048;

        sunset.shadow.mapSize.height =
            2048;

        sunset.shadow.camera.left =
            -120;

        sunset.shadow.camera.right =
            120;

        sunset.shadow.camera.top =
            120;

        sunset.shadow.camera.bottom =
            -120;

        this.level.add(
            sunset
        );


        const cyanLight =
            new THREE.PointLight(
                0x00d9ff,
                32,
                80
            );

        cyanLight.position.set(
            0,
            12,
            -85
        );

        this.level.add(
            cyanLight
        );

        this._registerLiving(cyanLight);


        const purpleLight =
            new THREE.PointLight(
                0xb000ff,
                25,
                100
            );

        purpleLight.position.set(
            30,
            25,
            120
        );

        this.level.add(
            purpleLight
        );

        this._registerLiving(purpleLight);


        // =========================================================
        // ROAD
        // =========================================================

        const roadTexture =
            textureLoader.load(
                '/assets/textures/Road.png'
            );

        roadTexture.wrapS =
            THREE.RepeatWrapping;

        roadTexture.wrapT =
            THREE.RepeatWrapping;

        roadTexture.repeat.set(
            1,
            8
        );

        const roadMaterial =
            new THREE.MeshStandardMaterial({
                map: roadTexture,
                roughness: 0.15,
                metalness: 0.7
            });

        const road =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    16,
                    0.5,
                    260
                ),
                roadMaterial
            );

        road.position.set(
            0,
            -0.25,
            0
        );

        road.receiveShadow = true;

        this.level.add(
            road
        );


        // =========================================================
        // GROUND
        // =========================================================

        const groundTexture =
            textureLoader.load(
                '/assets/textures/ground.png'
            );

        groundTexture.wrapS =
            THREE.RepeatWrapping;

        groundTexture.wrapT =
            THREE.RepeatWrapping;

        groundTexture.repeat.set(
            80,
            80
        );

        groundTexture.colorSpace =
            THREE.SRGBColorSpace;

        const ground =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    600,
                    600
                ),
                new THREE.MeshStandardMaterial({
                    map: groundTexture,
                    color: 0x66666a,
                    roughness: 0.95,
                    metalness: 0.05
                })
            );

        ground.rotation.x =
            -Math.PI / 2;

        ground.position.set(
            0,
            -0.01,
            0
        );

        ground.receiveShadow = true;

        this.level.add(
            ground
        );


        // =========================================================
        // ROAD NEON
        // =========================================================

        const roadNeon =
            new THREE.MeshStandardMaterial({
                color: 0x00d9ff,
                emissive: 0x00d9ff,
                emissiveIntensity: 3.5,
                metalness: 0.25,
                roughness: 0.3
            });

        this.createLongLine(
            -6.5,
            roadNeon
        );

        this.createLongLine(
            6.5,
            roadNeon
        );


        // =========================================================
        // CENTER ROAD MARKINGS
        // =========================================================

        for (
            let z = -125;
            z < 130;
            z += 12
        ) {

            const line =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.16,
                        0.06,
                        5
                    ),
                    roadNeon
                );

            line.position.set(
                0,
                0.05,
                z
            );

            this.level.add(
                line
            );
        }


        this.createStreetLights();

        // =========================================================
        // CITY BUILDING #1
        // LEFT
        // =========================================================

        this.createParkingBuilding(
            -24,
            -79
        );


        // =========================================================
        // CITY BUILDING #2
        // RIGHT
        // =========================================================

        this.createOrganicBuilding(
            24,
            -47
        );


        // =========================================================
        // CITY BUILDING #3
        // RIGHT SIDE
        // ALONG THE ROAD
        // =========================================================

        this.createCubeBuilding(
            24,
            -15
        );


        // =========================================================
        // CITY BUILDING #4
        // LEFT SIDE
        // CANTILEVERED GLASS CLUSTER
        // =========================================================

        this.createGlassClusterBuilding(
            -24,
            -47
        );


        // =========================================================
        // CITY BUILDING #5
        // RIGHT SIDE
        // STACKED RING TOWER
        // =========================================================

        this.createRingTowerBuilding(
            24,
            -79
        );


        // =========================================================
        // CITY BUILDING #6
        // LEFT SIDE
        // GLASS DOME
        // =========================================================

        this.createGlassDomeBuilding(
            -24,
            -15
        );


        // =========================================================
        // CITY BUILDING #7
        // TWIN SPIRE GATEWAY
        // ONE TOWER EACH SIDE OF THE ROAD, JOINED BY A SUSPENDED
        // SKY BRIDGE - THE THRESHOLD BEFORE THE BOSS AREA
        // =========================================================

        this.createTwinSpireGateway(
            30
        );


        // =========================================================
        // END OF CITY
        // =========================================================
        this.createCityBackground();

        this.createBossArea(
            125
        );


        // =========================================================
        // PORTAL
        // =========================================================

        this.createPortal(
            0,
            5,
            145
        );


        // =========================================================
        // ATMOSPHERE
        // Drifting embers/dust through the whole street corridor -
        // this is the biggest single fix for a scene that otherwise
        // has zero moving air.
        // =========================================================

        this.createAtmosphere();


        // =========================================================
        // SHADOWS
        // =========================================================

        this.level.traverse(
            (object) => {

                if (
                    object.isMesh &&
                    !object.userData.noShadow
                ) {

                    object.castShadow =
                        true;

                    object.receiveShadow =
                        true;
                }
            }
        );

        // =========================================================
        // COLLIDERS — AABB boxes for buildings / solid props
        // This fixes "level.colliders is undefined" and gives the
        // player something to collide against on the neon street.
        // =========================================================
        try { this._buildColliders(); } catch (e) { console.warn('AlienLevel collider build failed', e); }

        // Spawn is already set — ensure it sits on flat ground
        if (typeof this.getSurfaceHeight === 'function') {
            this.spawn.y = this.getSurfaceHeight(this.spawn.x, this.spawn.z) + 0.1;
        }
    }

    _buildColliders() {
        // Buildings are placed at known world positions — create a Box3
        // a little larger than the mesh so the player can't phase through.
        // These are conservative; the visual mesh is a bit smaller inside.
        const defs = [
            { x: -24, z: -79, w: 26, d: 30, h: 14 }, // parking building
            { x:  24, z: -47, w: 26, d: 24, h: 19 }, // organic building
            { x:  24, z: -15, w: 14, d: 14, h: 16 }, // cube building
            { x: -24, z: -47, w: 18, d: 18, h: 18 }, // glass cluster
            { x:  24, z: -79, w: 16, d: 16, h: 20 }, // ring tower
            { x: -24, z: -15, w: 18, d: 18, h: 16 }, // dome
            // Gateway twin spires straddle the road at z~30
            { x: -18, z: 30, w: 10, d: 10, h: 22 },
            { x:  18, z: 30, w: 10, d: 10, h: 22 },
        ];
        this.colliders = [];
        for (const b of defs) {
            const min = new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2);
            const max = new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2);
            this.colliders.push(new THREE.Box3(min, max));
        }
    }

    // main.js expects getSurfaceHeight(x,z) — street is flat at y=0
    getSurfaceHeight(x, z) { return 0; }
    groundHeight(x, z, feetY = 0) { return 0; }
    terrainHeight(x, z) { return 0; }


    // =============================================================
    // REGISTER LIVING LIGHT
    // Stores a light's base intensity plus a randomized flicker
    // phase/speed/amplitude so update() can make it breathe subtly
    // instead of sitting at a dead-flat value all game long.
    // =============================================================

    _registerLiving(light, options = {}) {

        light.userData.baseIntensity =
            light.intensity;

        light.userData.flickerAmp =
            options.amp !== undefined ? options.amp : 0.28;

        light.userData.flickerSpeed =
            options.speed !== undefined ? options.speed : (1.2 + Math.random() * 2.6);

        light.userData.flickerPhase =
            Math.random() * Math.PI * 2;

        this.livingLights.push(light);
    }


    // =============================================================
    // ROAD LIGHT
    // =============================================================

    createLongLine(
        x,
        material
    ) {

        const line =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.16,
                    0.07,
                    260
                ),
                material
            );

        line.position.set(
            x,
            0.05,
            0
        );

        this.level.add(
            line
        );
    }
    // =============================================================
// STREET LIGHTS
// Reuses / clones assets/models/light.glb
// =============================================================

createStreetLights() {

    const loader = new GLTFLoader();

    loader.load(
        '/assets/models/light.glb',

        (gltf) => {

            const originalLight = gltf.scene;

            // -------------------------------------------------
            // Positions along the road
            // -------------------------------------------------
            //
            // Road width = 16
            // Road edges = approximately x ±8
            //
            // Lights sit slightly outside the road.
            //

            const lightPositions = [];

            for (
                let z = -115;
                z <= 4;
                z += 60
            ) {

                // LEFT side
                lightPositions.push({
                    x: -8,
                    z: z+20,
                    side: 'left'
                });

                // RIGHT side
                lightPositions.push({
                    x: 9,
                    z: z-5,
                    side: 'right'
                });
            }


            // -------------------------------------------------
            // Create each light by cloning the original GLB
            // -------------------------------------------------

            lightPositions.forEach((data) => {

                const light =
                    originalLight.clone(true);

                light.position.set(
                    data.x,
                    0,
                    data.z
                );


                // -------------------------------------------------
                // Scale
                // -------------------------------------------------

                light.scale.set(
                    0.45,
                    0.45,
                    0.45
                );


                // -------------------------------------------------
                // Face toward the road
                // -------------------------------------------------

                if (data.side === 'left') {

                    light.rotation.y =
                        -Math.PI / 2;

                } else {

                    light.rotation.y =
                        Math.PI / 2;

                }


                // -------------------------------------------------
                // Shadows
                // -------------------------------------------------

                light.traverse(
                    (object) => {

                        if (object.isMesh) {

                            object.castShadow = true;
                            object.receiveShadow = true;

                        }

                    }
                );


                // -------------------------------------------------
                // Banner
                // Added after the shadow pass so the transparent
                // banner does not cast a solid rectangular shadow
                // -------------------------------------------------

                const bannerGeometry =
                    new THREE.PlaneGeometry(
                        6.5,
                        17.5
                    );

                const bannerMaterial =
                    new THREE.MeshStandardMaterial({
                        map: this.bannerTexture,
                        transparent: true,
                        roughness: 0.9,
                        side: THREE.DoubleSide
                    });

                const banner =
                    new THREE.Mesh(
                        bannerGeometry,
                        bannerMaterial
                    );

                // Hang the banner on the road side of the pole.
                // Local -Z points toward the road on both sides,
                // and 5.3 clears this model's column radius (~3.6)
                banner.position.set(
                    0,
                    20,
                    -5.3
                );

                // Face the road
                banner.rotation.y =
                    Math.PI / 2;

                light.add(banner);

                this.banners.push(banner);


                // -------------------------------------------------
                // Banner mounting arm
                // Thin bar from the pole out to the banner
                // -------------------------------------------------

                const bannerArm =
                    new THREE.Mesh(
                        new THREE.CylinderGeometry(
                            0.08,
                            0.08,
                            6,
                            8
                        ),
                        new THREE.MeshStandardMaterial({
                            color: 0x33363d,
                            roughness: 0.6,
                            metalness: 0.4
                        })
                    );

                // Run the arm along Z so it reaches the banner
                bannerArm.rotation.x =
                    Math.PI / 2;

                bannerArm.position.set(
                    0.12,
                    28.7,
                    -3
                );

                light.add(bannerArm);


                this.level.add(
                    light
                );

            });

        },

        undefined,

        (error) => {

            console.error(
                'Could not load street light:',
                error
            );

        }
    );
}


    // =============================================================
    // BUILDING #1
    // FUTURISTIC PARKING / TRANSPORT
    // LEFT SIDE
    // =============================================================

    createParkingBuilding(
        x,
        z
    ) {

        // Create the building group FIRST so every
        // later mesh can be added to it immediately.

        const building =
            new THREE.Group();

        building.position.set(
            x,
            0,
            z
        );

        this.level.add(
            building
        );

        const textureLoader =
            new THREE.TextureLoader();


// =============================================================
// BRICK TEXTURE
// =============================================================

const brickTexture =
    textureLoader.load(
        '/assets/textures/brick.png'
    );

brickTexture.wrapS =
    THREE.RepeatWrapping;

brickTexture.wrapT =
    THREE.RepeatWrapping;

brickTexture.repeat.set(
    6,
    3
);

brickTexture.colorSpace =
    THREE.SRGBColorSpace;

const brickMaterial =
    new THREE.MeshStandardMaterial({
        map: brickTexture,
        roughness: 0.9,
        metalness: 0.05
    });


// =============================================================
// BRICK WALL
// =============================================================

const brickWall =
    new THREE.Mesh(
        new THREE.BoxGeometry(
            8,
            6,
            0.4
        ),
        brickMaterial
    );

brickWall.position.set(
    -5,
    7,
    -14.45
);

building.add(
    brickWall
);


// =============================================================
// POSTER
// =============================================================

const bannerTexture =
    textureLoader.load(
        '/assets/textures/poster.png'
    );

// sRGB so the artwork keeps its real colours
bannerTexture.colorSpace =
    THREE.SRGBColorSpace;

const posterMaterial =
    new THREE.MeshStandardMaterial({
        map: bannerTexture,
        emissive: 0xffffff,
        emissiveMap: bannerTexture,
        emissiveIntensity: 1.5,
        transparent: true,
        roughness: 0.85,
        side: THREE.DoubleSide
    });

const poster =
    new THREE.Mesh(
        new THREE.PlaneGeometry(
            30,
            12
        ),
        posterMaterial
    );

poster.position.set(
    15,
    6,
    -1
);

poster.rotation.y =Math.PI/2;

// Transparent decal must not cast a solid
// rectangle shadow - same rule as the street
// light banners. The constructor shadow pass
// reads userData.noShadow.
poster.userData.noShadow =
    true;

building.add(
    poster
);

// Warm floodlight washing the brick wall and
// poster so both textures read on the shaded
// night facade
const posterWash =
    new THREE.PointLight(
        0xffc98a,
        12,
        16
    );

posterWash.position.set(
    -5,
    9.5,
    -17
);

building.add(
    posterWash
);

this._registerLiving(posterWash);

       const concrete =
    new THREE.MeshStandardMaterial({
        map: brickTexture,
        roughness: 0.85,
        metalness: 0.1
    });

        const concreteDark =
            new THREE.MeshStandardMaterial({
                color: 0x777b80,
                roughness: 0.72,
                metalness: 0.28
            });

        const structuralWhite =
            new THREE.MeshStandardMaterial({
                color: 0xdcdedb,
                roughness: 0.4,
                metalness: 0.35
            });

        const darkInterior =
            new THREE.MeshStandardMaterial({
                color: 0x10141b,
                roughness: 0.42,
                metalness: 0.7
            });

        const glass =
            new THREE.MeshStandardMaterial({
                color: 0x183b48,
                roughness: 0.12,
                metalness: 0.75,
                transparent: true,
                opacity: 0.68
            });

        const glassDark =
            new THREE.MeshStandardMaterial({
                color: 0x08151d,
                roughness: 0.1,
                metalness: 0.85,
                transparent: true,
                opacity: 0.8
            });

        const redGlow =
            new THREE.MeshStandardMaterial({
                color: 0xff2638,
                emissive: 0xff1022,
                emissiveIntensity: 2.5,
                roughness: 0.25,
                metalness: 0.25
            });


        const internalBody =
    new THREE.Mesh(
        new THREE.BoxGeometry(
            25,
            12.5,
            30
        ),
        brickMaterial
    );

        internalBody.position.y =
            6.25;

        building.add(
            internalBody
        );


        // ---------------------------------------------------------
        // FLOORS
        // ---------------------------------------------------------

        for (
            let floor = 0;
            floor < 3;
            floor++
        ) {

            const y =
                1.9 +
                floor * 4;

            const slab =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        27,
                        0.55,
                        31
                    ),
                    concrete
                );

            slab.position.y =
                y;

            building.add(
                slab
            );


            const recessed =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        23.5,
                        3.15,
                        28.5
                    ),
                    darkInterior
                );

            recessed.position.y =
                y + 1.85;

            building.add(
                recessed
            );


            const frontGlass =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        21,
                        2.7,
                        0.12
                    ),
                    glassDark
                );

            frontGlass.position.set(
                0,
                y + 1.75,
                -14.65
            );

            building.add(
                frontGlass
            );


            const redBand =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        20,
                        0.16,
                        0.18
                    ),
                    redGlow
                );

            redBand.position.set(
                0,
                y + 0.45,
                -15.15
            );

            building.add(
                redBand
            );
        }


        // ---------------------------------------------------------
        // FRONT COLUMNS
        // ---------------------------------------------------------

        for (
            let i = -5;
            i <= 5;
            i++
        ) {

            const column =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.55,
                        13.2,
                        0.7
                    ),
                    structuralWhite
                );

            column.position.set(
                i * 2.45,
                6.6,
                -15
            );

            building.add(
                column
            );
        }


        // ---------------------------------------------------------
        // CURVED RIBS
        // ---------------------------------------------------------

        const ribPositions = [
            -13.2,
            -6.6,
            0,
            6.6,
            13.2
        ];

        for (
            const ribX of ribPositions
        ) {

            building.add(
                this.createCurvedRib(
                    ribX,
                    structuralWhite
                )
            );
        }


        // ---------------------------------------------------------
        // ROOF
        // ---------------------------------------------------------

        const roof =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    27.8,
                    0.75,
                    31.5
                ),
                brickMaterial
            );

        roof.position.y =
            13.35;

        building.add(
            roof
        );


        const roofEdge =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    27,
                    0.22,
                    0.35
                ),
                redGlow
            );

        roofEdge.position.set(
            0,
            14.05,
            -15.9
        );

        building.add(
            roofEdge
        );


        // ---------------------------------------------------------
        // FRONT CURVED FRAME
        // ---------------------------------------------------------

        building.add(
            this.createFrontCurve(
                structuralWhite
            )
        );


        // ---------------------------------------------------------
        // SIDE SHELLS
        // ---------------------------------------------------------

       const sideShell =
    new THREE.Mesh(
        new THREE.BoxGeometry(
            0.75,
            11.5,
            30
        ),
        brickMaterial
    );

        sideShell.position.set(
            -14,
            6.6,
            0
        );

        building.add(
            sideShell
        );


        const rightShell =
            sideShell.clone();

        rightShell.position.x =
            14;

        building.add(
            rightShell
        );


        // ---------------------------------------------------------
        // ENTRANCE
        // ---------------------------------------------------------

        const entrance =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    7,
                    5.8,
                    0.18
                ),
                glass
            );

        entrance.position.set(
            7,
            2.9,
            -15.45
        );

        building.add(
            entrance
        );


        // ---------------------------------------------------------
        // DAMAGE
        // ---------------------------------------------------------

        this.createBuildingDamage(
            building,
            concreteDark
        );


        // ---------------------------------------------------------
        // RUBBLE
        // ---------------------------------------------------------

        this.createRubble(
            building
        );


        const light =
            new THREE.PointLight(
                0xff2638,
                10,
                32
            );

        light.position.set(
            0,
            5,
            -13
        );

        building.add(
            light
        );

        this._registerLiving(light);
    }


    // =============================================================
    // CURVED RIB
    // =============================================================

    createCurvedRib(
        x,
        material
    ) {

        const curve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    x,
                    0.6,
                    -15.5
                ),

                new THREE.Vector3(
                    x,
                    4.0,
                    -16.2
                ),

                new THREE.Vector3(
                    x,
                    8.5,
                    -16.0
                ),

                new THREE.Vector3(
                    x,
                    12.2,
                    -14.0
                ),

                new THREE.Vector3(
                    x,
                    14,
                    -9
                )
            ]);

        return new THREE.Mesh(
            new THREE.TubeGeometry(
                curve,
                20,
                0.32,
                8,
                false
            ),
            material
        );
    }


    // =============================================================
    // FRONT CURVE
    // =============================================================

    createFrontCurve(
        material
    ) {

        const curve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    -13,
                    0.8,
                    -15.8
                ),

                new THREE.Vector3(
                    -12,
                    4.5,
                    -16.4
                ),

                new THREE.Vector3(
                    -9,
                    8.8,
                    -16.5
                ),

                new THREE.Vector3(
                    -5,
                    12.5,
                    -15
                ),

                new THREE.Vector3(
                    0,
                    14.2,
                    -12
                ),

                new THREE.Vector3(
                    6,
                    13,
                    -14
                ),

                new THREE.Vector3(
                    10,
                    9,
                    -16
                ),

                new THREE.Vector3(
                    13,
                    3.5,
                    -15.8
                )
            ]);

        return new THREE.Mesh(
            new THREE.TubeGeometry(
                curve,
                40,
                0.65,
                10,
                false
            ),
            material
        );
    }


    // =============================================================
    // BUILDING DAMAGE
    // =============================================================

    createBuildingDamage(
        building,
        material
    ) {

        for (
            let i = 0;
            i < 8;
            i++
        ) {

            const size =
                0.4 +
                Math.random() * 1.5;

            const piece =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size,
                        size,
                        size * 1.8
                    ),
                    material
                );

            piece.position.set(
                -11 +
                Math.random() * 20,

                14.2 +
                Math.random() * 1.8,

                -10 +
                Math.random() * 17
            );

            piece.rotation.set(
                Math.random() * 1.5,
                Math.random() * 1.5,
                Math.random() * 1.5
            );

            building.add(
                piece
            );
        }


        const brokenPanel =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    4.5,
                    2.8,
                    0.35
                ),
                material
            );

        brokenPanel.position.set(
            -7,
            7.8,
            -15.7
        );

        brokenPanel.rotation.z =
            -0.12;

        brokenPanel.rotation.y =
            0.08;

        building.add(
            brokenPanel
        );
    }


    // =============================================================
    // RUBBLE
    // =============================================================

    createRubble(
        building
    ) {

        const rubbleMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x55585b,
                roughness: 0.9,
                metalness: 0.15
            });

        for (
            let i = 0;
            i < 24;
            i++
        ) {

            const size =
                0.15 +
                Math.random() * 0.8;

            const rubble =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size,
                        size *
                        (0.5 +
                        Math.random()),

                        size *
                        (0.5 +
                        Math.random())
                    ),
                    rubbleMaterial
                );

            rubble.position.set(
                -13 +
                Math.random() * 26,

                size / 2,

                -17 +
                Math.random() * 34
            );

            rubble.rotation.set(
                Math.random() * 2,
                Math.random() * 2,
                Math.random() * 2
            );

            building.add(
                rubble
            );
        }
    }


    // =============================================================
    // BUILDING #2
    // ORGANIC FUTURISTIC MEGASTRUCTURE
    // RIGHT SIDE OF STREET
    // =============================================================

    createOrganicBuilding(
        x,
        z
    ) {

        const shell =
            new THREE.MeshStandardMaterial({
                color: 0xd8d9d5,
                roughness: 0.38,
                metalness: 0.32
            });

        const shellBright =
            new THREE.MeshStandardMaterial({
                color: 0xf0f0ec,
                roughness: 0.3,
                metalness: 0.28
            });

        const shellDark =
            new THREE.MeshStandardMaterial({
                color: 0x8d9295,
                roughness: 0.5,
                metalness: 0.35
            });

        const glass =
            new THREE.MeshStandardMaterial({
                color: 0x183842,
                roughness: 0.1,
                metalness: 0.8,
                transparent: true,
                opacity: 0.65
            });

        const darkGlass =
            new THREE.MeshStandardMaterial({
                color: 0x08151b,
                roughness: 0.08,
                metalness: 0.9,
                transparent: true,
                opacity: 0.78
            });

        const cyan =
            new THREE.MeshStandardMaterial({
                color: 0x00d9e8,
                emissive: 0x00cfe0,
                emissiveIntensity: 2.2,
                roughness: 0.2,
                metalness: 0.25
            });

        const warmInterior =
            new THREE.MeshStandardMaterial({
                color: 0xc58c72,
                emissive: 0x5a3023,
                emissiveIntensity: 0.8,
                roughness: 0.3,
                metalness: 0.15
            });


        const building =
            new THREE.Group();

        building.position.set(
            x,
            0,
            z
        );

        this.level.add(
            building
        );


        // =========================================================
        // CENTRAL GLASS CORE
        // =========================================================

        const core =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    13,
                    17,
                    23
                ),
                glass
            );

        core.position.set(
            0,
            8.5,
            1
        );

        building.add(
            core
        );


        // =========================================================
        // DARK INNER CORE
        // =========================================================

        const innerCore =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    9.5,
                    15.5,
                    20
                ),
                darkGlass
            );

        innerCore.position.set(
            0,
            8.2,
            1
        );

        building.add(
            innerCore
        );


        // =========================================================
        // LOWER OPEN ATRIUM
        // =========================================================

        const leftLower =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    5,
                    4,
                    14
                ),
                shell
            );

        leftLower.position.set(
            -8.5,
            2,
            1
        );

        building.add(
            leftLower
        );


        const rightLower =
            leftLower.clone();

        rightLower.position.x =
            8.5;

        building.add(
            rightLower
        );


        // =========================================================
        // LOWER ROOF / PLATFORM
        // =========================================================

        const lowerPlatform =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    25,
                    0.65,
                    24
                ),
                shell
            );

        lowerPlatform.position.set(
            0,
            4.2,
            1
        );

        lowerPlatform.rotation.z =
            -0.025;

        building.add(
            lowerPlatform
        );


        // =========================================================
        // SECOND LEVEL
        // =========================================================

        const middlePlatform =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    25,
                    0.65,
                    23
                ),
                shellBright
            );

        middlePlatform.position.set(
            0,
            9.1,
            1
        );

        middlePlatform.rotation.z =
            0.035;

        building.add(
            middlePlatform
        );


        // =========================================================
        // UPPER PLATFORM
        // =========================================================

        const upperPlatform =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    23,
                    0.6,
                    20
                ),
                shell
            );

        upperPlatform.position.set(
            0,
            14,
            1
        );

        upperPlatform.rotation.z =
            -0.04;

        building.add(
            upperPlatform
        );


        // =========================================================
        // TOP ROOF
        // =========================================================

        const roof =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    19,
                    0.65,
                    17
                ),
                shellBright
            );

        roof.position.set(
            0,
            18.2,
            2
        );

        roof.rotation.z =
            0.055;

        building.add(
            roof
        );


        // =========================================================
        // GIANT LEFT SWEEPING LOOP
        // =========================================================

        const leftLoopCurve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    -12,
                    1,
                    -10
                ),

                new THREE.Vector3(
                    -16,
                    4,
                    -7
                ),

                new THREE.Vector3(
                    -17,
                    9,
                    -2
                ),

                new THREE.Vector3(
                    -14,
                    14,
                    5
                ),

                new THREE.Vector3(
                    -8,
                    17,
                    10
                ),

                new THREE.Vector3(
                    0,
                    18.5,
                    12
                )
            ]);

        const leftLoop =
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    leftLoopCurve,
                    45,
                    1.15,
                    12,
                    false
                ),
                shellBright
            );

        building.add(
            leftLoop
        );


        // =========================================================
        // RIGHT SWEEPING LOOP
        // =========================================================

        const rightLoopCurve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    12,
                    2,
                    -8
                ),

                new THREE.Vector3(
                    16,
                    5,
                    -5
                ),

                new THREE.Vector3(
                    17,
                    9,
                    0
                ),

                new THREE.Vector3(
                    14,
                    12,
                    6
                ),

                new THREE.Vector3(
                    8,
                    15,
                    10
                ),

                new THREE.Vector3(
                    -1,
                    17,
                    12
                )
            ]);

        const rightLoop =
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    rightLoopCurve,
                    45,
                    1.05,
                    12,
                    false
                ),
                shell
            );

        building.add(
            rightLoop
        );


        // =========================================================
        // FRONT LOWER CURVE
        // =========================================================

        const frontCurve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    -13,
                    4.2,
                    -11
                ),

                new THREE.Vector3(
                    -7,
                    5.5,
                    -15
                ),

                new THREE.Vector3(
                    0,
                    6.2,
                    -16
                ),

                new THREE.Vector3(
                    8,
                    5.6,
                    -14
                ),

                new THREE.Vector3(
                    14,
                    4,
                    -9
                )
            ]);

        const frontTube =
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    frontCurve,
                    35,
                    0.85,
                    10,
                    false
                ),
                shellBright
            );

        building.add(
            frontTube
        );


        // =========================================================
        // SECOND FRONT CURVE
        // =========================================================

        const upperFrontCurve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    -11,
                    9,
                    -10
                ),

                new THREE.Vector3(
                    -6,
                    10.5,
                    -14
                ),

                new THREE.Vector3(
                    1,
                    11.5,
                    -15
                ),

                new THREE.Vector3(
                    8,
                    10.8,
                    -12
                ),

                new THREE.Vector3(
                    13,
                    9,
                    -7
                )
            ]);

        const upperFrontTube =
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    upperFrontCurve,
                    35,
                    0.65,
                    10,
                    false
                ),
                shell
            );

        building.add(
            upperFrontTube
        );


        // =========================================================
        // CURVED SIDE SUPPORTS
        // =========================================================

        const supportXs = [
            -11,
            -5.5,
            5.5,
            11
        ];

        for (
            const sx of supportXs
        ) {

            const supportCurve =
                new THREE.CatmullRomCurve3([
                    new THREE.Vector3(
                        sx,
                        0.7,
                        -10
                    ),

                    new THREE.Vector3(
                        sx * 1.05,
                        5,
                        -11
                    ),

                    new THREE.Vector3(
                        sx * 0.9,
                        10,
                        -8
                    ),

                    new THREE.Vector3(
                        sx * 0.7,
                        15,
                        -3
                    ),

                    new THREE.Vector3(
                        sx * 0.45,
                        18,
                        4
                    )
                ]);

            const support =
                new THREE.Mesh(
                    new THREE.TubeGeometry(
                        supportCurve,
                        25,
                        0.38,
                        8,
                        false
                    ),
                    shellDark
                );

            building.add(
                support
            );
        }


        // =========================================================
        // FRONT GLASS PANELS
        // =========================================================

        for (
            let i = -3;
            i <= 3;
            i++
        ) {

            const panel =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        2.4,
                        3.3,
                        0.12
                    ),
                    glass
                );

            panel.position.set(
                i * 2.8,
                7.1,
                -13.8
            );

            panel.rotation.z =
                i * 0.012;

            building.add(
                panel
            );
        }


        // =========================================================
        // UPPER GLASS PANELS
        // =========================================================

        for (
            let i = -3;
            i <= 3;
            i++
        ) {

            const panel =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        2.2,
                        3.0,
                        0.12
                    ),
                    glass
                );

            panel.position.set(
                i * 2.5,
                12.4,
                -11.8
            );

            panel.rotation.z =
                -i * 0.018;

            building.add(
                panel
            );
        }


        // =========================================================
        // WARM INTERIOR LIGHTS
        // =========================================================

        for (
            let floor = 0;
            floor < 3;
            floor++
        ) {

            for (
                let i = -2;
                i <= 2;
                i++
            ) {

                const interior =
                    new THREE.Mesh(
                        new THREE.BoxGeometry(
                            0.5,
                            0.12,
                            0.08
                        ),
                        warmInterior
                    );

                interior.position.set(
                    i * 2.4,
                    6 +
                    floor * 4,
                    -14
                );

                building.add(
                    interior
                );
            }
        }


        // =========================================================
        // CYAN ARCHITECTURAL LIGHT
        // =========================================================

        const cyanStrip =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    13,
                    0.12,
                    0.15
                ),
                cyan
            );

        cyanStrip.position.set(
            0,
            9.55,
            -15.3
        );

        building.add(
            cyanStrip
        );


        // =========================================================
        // ROOF SPINE
        // =========================================================

        const spineCurve =
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(
                    -8,
                    18.4,
                    -2
                ),

                new THREE.Vector3(
                    -3,
                    19.2,
                    4
                ),

                new THREE.Vector3(
                    4,
                    19.5,
                    7
                ),

                new THREE.Vector3(
                    10,
                    18.7,
                    4
                )
            ]);

        const spine =
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    spineCurve,
                    25,
                    0.45,
                    10,
                    false
                ),
                shellBright
            );

        building.add(
            spine
        );


        // =========================================================
        // SMALL ROOF SUPPORTS
        // =========================================================

        for (
            let i = -2;
            i <= 2;
            i++
        ) {

            const roofSupport =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.18,
                        0.24,
                        3.5,
                        8
                    ),
                    shellDark
                );

            roofSupport.position.set(
                i * 3,
                16.5,
                5
            );

            roofSupport.rotation.z =
                i * 0.035;

            building.add(
                roofSupport
            );
        }


        // =========================================================
        // DAMAGE
        // =========================================================

        this.createOrganicDamage(
            building,
            shellDark
        );


        // =========================================================
        // RUBBLE
        // =========================================================

        this.createOrganicRubble(
            building
        );


        // =========================================================
        // BUILDING LIGHT
        // =========================================================

        const organicLight =
            new THREE.PointLight(
                0x00d9ff,
                12,
                45
            );

        organicLight.position.set(
            0,
            7,
            -11
        );

        building.add(
            organicLight
        );

        this._registerLiving(organicLight);
    }


    // =============================================================
    // BUILDING #2 DAMAGE
    // =============================================================

    createOrganicDamage(
        building,
        material
    ) {

        for (
            let i = 0;
            i < 10;
            i++
        ) {

            const size =
                0.35 +
                Math.random() * 1.1;

            const piece =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size * 1.8,
                        size,
                        size
                    ),
                    material
                );

            piece.position.set(
                -9 +
                Math.random() * 18,

                17 +
                Math.random() * 3,

                -5 +
                Math.random() * 15
            );

            piece.rotation.set(
                Math.random() * 1.2,
                Math.random() * 1.5,
                Math.random() * 1.2
            );

            building.add(
                piece
            );
        }


        const broken =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    3.5,
                    2.4,
                    0.3
                ),
                material
            );

        broken.position.set(
            -10,
            11,
            -13.7
        );

        broken.rotation.z =
            -0.15;

        building.add(
            broken
        );
    }


    // =============================================================
    // BUILDING #2 RUBBLE
    // =============================================================

    createOrganicRubble(
        building
    ) {

        const rubbleMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x5b5d60,
                roughness: 0.9,
                metalness: 0.15
            });

        for (
            let i = 0;
            i < 30;
            i++
        ) {

            const size =
                0.15 +
                Math.random() * 0.7;

            const rubble =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size,
                        size *
                        (0.5 +
                        Math.random()),
                        size *
                        (0.7 +
                        Math.random())
                    ),
                    rubbleMaterial
                );

            rubble.position.set(
                -13 +
                Math.random() * 26,

                size / 2,

                -17 +
                Math.random() * 34
            );

            rubble.rotation.set(
                Math.random() * 2,
                Math.random() * 2,
                Math.random() * 2
            );

            building.add(
                rubble
            );
        }
    }


    // =============================================================
    // BUILDING #3
    // FUTURISTIC CUBE STRUCTURE
    // RIGHT SIDE OF ROAD
    // =============================================================

    createCubeBuilding(
        x,
        z
    ) {

        const concrete =
            new THREE.MeshStandardMaterial({
                color: 0xcfd1cf,
                roughness: 0.45,
                metalness: 0.3
            });

        const concreteDark =
            new THREE.MeshStandardMaterial({
                color: 0x686d72,
                roughness: 0.65,
                metalness: 0.35
            });

        const dark =
            new THREE.MeshStandardMaterial({
                color: 0x10151c,
                roughness: 0.35,
                metalness: 0.7
            });

        const glass =
            new THREE.MeshStandardMaterial({
                color: 0x173944,
                roughness: 0.08,
                metalness: 0.8,
                transparent: true,
                opacity: 0.7
            });

        const cyan =
            new THREE.MeshStandardMaterial({
                color: 0x00d9ff,
                emissive: 0x00d9ff,
                emissiveIntensity: 2.8,
                roughness: 0.2,
                metalness: 0.25
            });

        const building =
            new THREE.Group();

        building.position.set(
            x,
            0,
            z
        );

        this.level.add(
            building
        );


        // ---------------------------------------------------------
        // MAIN CUBE
        // ---------------------------------------------------------

        const mainBody =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    24,
                    20,
                    28
                ),
                dark
            );

        mainBody.position.set(
            0,
            10,
            0
        );

        building.add(
            mainBody
        );


        // ---------------------------------------------------------
        // OUTER SHELL
        // ---------------------------------------------------------

        const leftWall =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    1.2,
                    20,
                    28
                ),
                concrete
            );

        leftWall.position.set(
            -12,
            10,
            0
        );

        building.add(
            leftWall
        );


        const rightWall =
            leftWall.clone();

        rightWall.position.x =
            12;

        building.add(
            rightWall
        );


        const topShell =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    25,
                    1.2,
                    29
                ),
                concrete
            );

        topShell.position.set(
            0,
            20,
            0
        );

        building.add(
            topShell
        );


        // ---------------------------------------------------------
        // HORIZONTAL FLOOR BANDS
        // ---------------------------------------------------------

        for (
            let floor = 0;
            floor < 4;
            floor++
        ) {

            const y =
                2 +
                floor * 5;

            const band =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        25,
                        0.45,
                        29
                    ),
                    concrete
                );

            band.position.set(
                0,
                y,
                0
            );

            building.add(
                band
            );
        }


        // ---------------------------------------------------------
        // FRONT GLASS GRID
        // ---------------------------------------------------------

        for (
            let floor = 0;
            floor < 4;
            floor++
        ) {

            for (
                let i = -3;
                i <= 3;
                i++
            ) {

                const window =
                    new THREE.Mesh(
                        new THREE.BoxGeometry(
                            2.5,
                            3.2,
                            0.16
                        ),
                        glass
                    );

                window.position.set(
                    i * 3.2,
                    4.2 +
                    floor * 5,
                    -14.55
                );

                building.add(
                    window
                );
            }
        }


        // ---------------------------------------------------------
        // FRONT STRUCTURAL FRAME
        // ---------------------------------------------------------

        for (
            let i = -4;
            i <= 4;
            i++
        ) {

            const column =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.45,
                        20.5,
                        0.6
                    ),
                    concrete
                );

            column.position.set(
                i * 2.9,
                10,
                -14.9
            );

            building.add(
                column
            );
        }


        // ---------------------------------------------------------
        // SIDE WINDOWS
        // ---------------------------------------------------------

        for (
            let floor = 0;
            floor < 4;
            floor++
        ) {

            const sideWindow =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.16,
                        3,
                        20
                    ),
                    glass
                );

            sideWindow.position.set(
                -12.65,
                4.2 +
                floor * 5,
                0
            );

            building.add(
                sideWindow
            );
        }


        // ---------------------------------------------------------
        // CYAN HORIZONTAL LIGHTS
        // ---------------------------------------------------------

        for (
            let floor = 0;
            floor < 4;
            floor++
        ) {

            const strip =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        20,
                        0.16,
                        0.18
                    ),
                    cyan
                );

            strip.position.set(
                0,
                2.6 +
                floor * 5,
                -15.05
            );

            building.add(
                strip
            );
        }


        // ---------------------------------------------------------
        // LARGE ROOF FRAME
        // ---------------------------------------------------------

        const roofFrame =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    27,
                    1,
                    31
                ),
                concreteDark
            );

        roofFrame.position.set(
            0,
            21,
            0
        );

        building.add(
            roofFrame
        );


        // ---------------------------------------------------------
        // RAISED ROOF CORE
        // ---------------------------------------------------------

        const roofCore =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    13,
                    3,
                    12
                ),
                concrete
            );

        roofCore.position.set(
            0,
            23,
            2
        );

        building.add(
            roofCore
        );


        // ---------------------------------------------------------
        // ROOF LIGHT
        // ---------------------------------------------------------

        const roofLight =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    8,
                    0.2,
                    8
                ),
                cyan
            );

        roofLight.position.set(
            0,
            24.55,
            2
        );

        building.add(
            roofLight
        );


        // ---------------------------------------------------------
        // ATTACHMENT TO BUILDING #2
        // ---------------------------------------------------------

        const connector =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    4,
                    6,
                    14
                ),
                concrete
            );

        connector.position.set(
            -13,
            8,
            0
        );

        building.add(
            connector
        );


        const connectorGlass =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.2,
                    4,
                    10
                ),
                glass
            );

        connectorGlass.position.set(
            -15.1,
            8,
            0
        );

        building.add(
            connectorGlass
        );


        // ---------------------------------------------------------
        // RUINED CORNER
        // ---------------------------------------------------------

        const brokenCorner =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    5,
                    4,
                    5
                ),
                concreteDark
            );

        brokenCorner.position.set(
            8,
            19,
            -9
        );

        brokenCorner.rotation.z =
            -0.12;

        brokenCorner.rotation.x =
            0.08;

        building.add(
            brokenCorner
        );


        // ---------------------------------------------------------
        // BROKEN PANELS
        // ---------------------------------------------------------

        for (
            let i = 0;
            i < 8;
            i++
        ) {

            const size =
                0.35 +
                Math.random() * 1.1;

            const debris =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size * 1.8,
                        size,
                        size
                    ),
                    concreteDark
                );

            debris.position.set(
                -10 +
                Math.random() * 20,

                20 +
                Math.random() * 4,

                -12 +
                Math.random() * 24
            );

            debris.rotation.set(
                Math.random() * 1.4,
                Math.random() * 1.4,
                Math.random() * 1.4
            );

            building.add(
                debris
            );
        }


        // ---------------------------------------------------------
        // GROUND RUBBLE
        // ---------------------------------------------------------

        const rubbleMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x55585c,
                roughness: 0.9,
                metalness: 0.15
            });

        for (
            let i = 0;
            i < 20;
            i++
        ) {

            const size =
                0.15 +
                Math.random() * 0.8;

            const rubble =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size,
                        size *
                        (0.5 +
                        Math.random()),
                        size *
                        (0.5 +
                        Math.random())
                    ),
                    rubbleMaterial
                );

            rubble.position.set(
                -13 +
                Math.random() * 26,

                size / 2,

                -16 +
                Math.random() * 32
            );

            rubble.rotation.set(
                Math.random() * 2,
                Math.random() * 2,
                Math.random() * 2
            );

            building.add(
                rubble
            );
        }


        // ---------------------------------------------------------
        // BUILDING LIGHT
        // ---------------------------------------------------------

        const cubeLight =
            new THREE.PointLight(
                0x00d9ff,
                10,
                40
            );

        cubeLight.position.set(
            0,
            8,
            -13
        );

        building.add(
            cubeLight
        );

        this._registerLiving(cubeLight);
    }


    // =============================================================
    // GLASS POD
    // A single cantilevered curtain-wall volume: a mirrored glass
    // box plus a wireframe mullion grid overlaid on it (a segmented
    // BoxGeometry run through WireframeGeometry draws every pane
    // seam, including the ones on the flat faces that EdgesGeometry
    // would drop as "coplanar").
    // =============================================================

    createGlassPod(
        w,
        h,
        d,
        material,
        mullionMaterial
    ) {

        const pod =
            new THREE.Group();

        const hSeg =
            Math.max(
                2,
                Math.round(w / 1.3)
            );

        const vSeg =
            Math.max(
                2,
                Math.round(h / 1.1)
            );

        const dSeg =
            Math.max(
                1,
                Math.round(d / 1.3)
            );

        const boxGeo =
            new THREE.BoxGeometry(
                w,
                h,
                d,
                hSeg,
                vSeg,
                dSeg
            );

        const glassMesh =
            new THREE.Mesh(
                boxGeo,
                material
            );

        pod.add(
            glassMesh
        );

        const wireGeo =
            new THREE.WireframeGeometry(
                boxGeo
            );

        const mullions =
            new THREE.LineSegments(
                wireGeo,
                mullionMaterial
            );

        pod.add(
            mullions
        );

        return pod;
    }


    // =============================================================
    // BUILDING #4
    // CANTILEVERED GLASS CLUSTER
    // LEFT SIDE
    // =============================================================

    createGlassClusterBuilding(
        x,
        z
    ) {

        // Lower metalness + added transparency: at metalness 0.9
        // with no envMap in the scene, these read almost pure black
        // (a metal surface gets its color from reflected environment
        // light, and there isn't one). Transparency lets the fog /
        // sky color show through instead, the same trick the other
        // buildings' glass already uses.

        const glassLight =
            new THREE.MeshStandardMaterial({
                color: 0x2c545c,
                roughness: 0.2,
                metalness: 0.4,
                transparent: true,
                opacity: 1
            });

        const glassDark =
            new THREE.MeshStandardMaterial({
                color: 0x14343a,
                roughness: 0.15,
                metalness: 0.5,
                transparent: true,
                opacity: 1
            });

        const mullionMaterial =
            new THREE.LineBasicMaterial({
                color: 0x05080a
            });

        const concrete =
            new THREE.MeshStandardMaterial({
                color: 0x9a9c9e,
                roughness: 0.75,
                metalness: 0.15
            });

        const concreteDark =
            new THREE.MeshStandardMaterial({
                color: 0x6b6d70,
                roughness: 0.8,
                metalness: 0.2
            });

        const warmInterior =
            new THREE.MeshStandardMaterial({
                color: 0xffd9a0,
                emissive: 0xffb15c,
                emissiveIntensity: 1.8,
                roughness: 0.3,
                metalness: 0.1
            });

        const building =
            new THREE.Group();

        building.position.set(
            x,
            0,
            z
        );

        // All the pods cantilever toward local -Z (same convention
        // as the other buildings), which points along the street
        // rather than sideways at it. Rotating the whole group -90°
        // around Y turns that -Z face to world +X, i.e. toward the
        // road, since this building sits on the left (x < 0). If it
        // ends up facing away instead, flip the sign to +Math.PI / 2.

        building.rotation.y =
            -Math.PI / 2;

        this.level.add(
            building
        );


        // ---------------------------------------------------------
        // BASE PLATFORM
        // ---------------------------------------------------------

        const base =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    22,
                    0.6,
                    20
                ),
                concreteDark
            );

        base.position.y =
            0.3;

        building.add(
            base
        );


        // ---------------------------------------------------------
        // CONCRETE CORE
        // A solid vertical spine behind the pods, glimpsed in the
        // gaps between cantilevers the way stone shows through in
        // the reference photo.
        // ---------------------------------------------------------

        const core =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    9,
                    37,
                    9
                ),
                concrete
            );

        core.position.set(
            0,
            18.8,
            3
        );

        building.add(
            core
        );


        // ---------------------------------------------------------
        // CANTILEVERED GLASS PODS
        // Stacked bottom to top, each rotated and offset from the
        // one below so the volumes jut and twist against each
        // other rather than forming a clean tower.
        // ---------------------------------------------------------

        const podConfigs = [
            { w: 14, h: 5.2, d: 10, x:  0.5, y:  2.6,  z: -3.0, rotY:  0.05, mat: glassLight },
            { w: 16, h: 5.2, d: 11, x: -1.5, y:  7.7,  z: -4.5, rotY: -0.16, mat: glassDark  },
            { w: 13, h: 5.0, d:  9, x:  2.0, y: 12.6,  z: -2.0, rotY:  0.26, mat: glassLight },
            { w: 15, h: 5.2, d: 10, x: -2.2, y: 17.6,  z: -5.0, rotY: -0.32, mat: glassDark  },
            { w: 12, h: 4.8, d:  8, x:  1.2, y: 22.4,  z: -1.5, rotY:  0.36, mat: glassLight },
            { w: 14, h: 5.0, d:  9, x: -1.0, y: 27.1,  z: -4.0, rotY: -0.22, mat: glassDark  },
            { w: 10, h: 4.5, d:  7, x:  0.8, y: 31.6,  z: -2.0, rotY:  0.18, mat: glassLight },
            { w:  8, h: 4.0, d:  6, x: -0.3, y: 35.7,  z: -1.0, rotY: -0.12, mat: glassDark  }
        ];

        podConfigs.forEach(
            (cfg) => {

                const pod =
                    this.createGlassPod(
                        cfg.w,
                        cfg.h,
                        cfg.d,
                        cfg.mat,
                        mullionMaterial
                    );

                pod.position.set(
                    cfg.x,
                    cfg.y,
                    cfg.z
                );

                pod.rotation.y =
                    cfg.rotY;

                building.add(
                    pod
                );
            }
        );


        // ---------------------------------------------------------
        // WARM INTERIOR GLOW
        // A few lit panes scattered through the cluster.
        // ---------------------------------------------------------

        const interiorSpots = [
            [ 3,  4,  -8],
            [-4, 14,  -9],
            [ 2, 23,  -6],
            [-2, 30,  -6.5]
        ];

        interiorSpots.forEach(
            ([ix, iy, iz]) => {

                const glow =
                    new THREE.Mesh(
                        new THREE.BoxGeometry(
                            1.6,
                            1.2,
                            0.1
                        ),
                        warmInterior
                    );

                glow.position.set(
                    ix,
                    iy,
                    iz
                );

                building.add(
                    glow
                );
            }
        );


        // ---------------------------------------------------------
        // MINOR GROUND DAMAGE
        // Kept light — this structure reads mostly intact, just
        // fractured in form rather than in condition.
        // ---------------------------------------------------------

        const rubbleMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x55585b,
                roughness: 0.9,
                metalness: 0.15
            });

        for (
            let i = 0;
            i < 10;
            i++
        ) {

            const size =
                0.15 +
                Math.random() * 0.55;

            const rubble =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size,
                        size *
                        (0.5 +
                        Math.random()),
                        size *
                        (0.5 +
                        Math.random())
                    ),
                    rubbleMaterial
                );

            rubble.position.set(
                -10 +
                Math.random() * 20,

                size / 2,

                -9 +
                Math.random() * 18
            );

            rubble.rotation.set(
                Math.random() * 2,
                Math.random() * 2,
                Math.random() * 2
            );

            building.add(
                rubble
            );
        }


        // ---------------------------------------------------------
        // BUILDING LIGHT
        // ---------------------------------------------------------

        const clusterLight =
            new THREE.PointLight(
                0x8fd6ff,
                10,
                42
            );

        clusterLight.position.set(
            0,
            16,
            -10
        );

        building.add(
            clusterLight
        );

        this._registerLiving(clusterLight);
    }


    // =============================================================
    // BUILDING #5
    // STACKED RING TOWER
    // RIGHT SIDE
    // Radially symmetric, so no rotation is needed to "face" the
    // road the way the earlier buildings did.
    // =============================================================

    createRingTowerBuilding(
        x,
        z
    ) {

        const concreteWhite =
            new THREE.MeshStandardMaterial({
                color: 0xf1e9e6,
                roughness: 0.45,
                metalness: 0.08
            });

        const concreteWhiteWarm =
            new THREE.MeshStandardMaterial({
                color: 0xf4d9cf,
                roughness: 0.4,
                metalness: 0.08
            });

        const glassDark =
            new THREE.MeshStandardMaterial({
                color: 0x141a1e,
                roughness: 0.15,
                metalness: 0.4,
                transparent: true,
                opacity: 0.55,
                side: THREE.DoubleSide
            });

        const mullionMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x0a0c0e,
                roughness: 0.5,
                metalness: 0.3
            });

        const coreGlow =
            new THREE.MeshStandardMaterial({
                color: 0xffb35c,
                emissive: 0xffb35c,
                emissiveIntensity: 4,
                roughness: 0.3,
                metalness: 0.1,
                side: THREE.DoubleSide
            });

        const rubbleMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x55585b,
                roughness: 0.9,
                metalness: 0.15
            });

        const building =
            new THREE.Group();

        building.position.set(
            x,
            0,
            z
        );

        this.level.add(
            building
        );


        // ---------------------------------------------------------
        // GROUND PLINTH
        // Wide flat platform the tower rises out of, echoing the
        // plaza/dock deck in the reference.
        // ---------------------------------------------------------

        const plinth =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    14,
                    14,
                    0.8,
                    48
                ),
                concreteWhite
            );

        plinth.position.y =
            0.4;

        building.add(
            plinth
        );

        const plinthRim =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    14,
                    0.12,
                    8,
                    64
                ),
                coreGlow
            );

        plinthRim.rotation.x =
            Math.PI / 2;

        plinthRim.position.y =
            0.82;

        building.add(
            plinthRim
        );


        // ---------------------------------------------------------
        // RING FLOORS
        // Each a solid disc slab; one near the top is left broken
        // (a partial arc) as this street's one nod to ruin on an
        // otherwise mostly-intact structure.
        // ---------------------------------------------------------

        const ringConfigs = [
            { y:  3.0, r: 9.0, h: 0.4, material: concreteWhite     },
            { y:  7.0, r: 9.3, h: 0.4, material: concreteWhite     },
            { y: 11.0, r: 9.6, h: 0.4, material: concreteWhiteWarm },
            { y: 15.0, r: 9.9, h: 0.4, material: concreteWhite     },
            { y: 19.0, r: 10.2, h: 0.4, material: concreteWhiteWarm, broken: true },
            { y: 22.6, r: 9.0, h: 0.9, material: concreteWhite     }
        ];

        ringConfigs.forEach(
            (cfg) => {

                const thetaLength =
                    cfg.broken ?
                        Math.PI * 1.6 :
                        Math.PI * 2;

                const ring =
                    new THREE.Mesh(
                        new THREE.CylinderGeometry(
                            cfg.r,
                            cfg.r,
                            cfg.h,
                            48,
                            1,
                            false,
                            0,
                            thetaLength
                        ),
                        cfg.material
                    );

                ring.position.y =
                    cfg.y;

                building.add(
                    ring
                );

                if (cfg.broken) {

                    for (
                        let i = 0;
                        i < 6;
                        i++
                    ) {

                        const size =
                            0.3 +
                            Math.random() * 0.7;

                        const debris =
                            new THREE.Mesh(
                                new THREE.BoxGeometry(
                                    size,
                                    size * 0.5,
                                    size
                                ),
                                cfg.material
                            );

                        const angle =
                            Math.PI * 1.8 +
                            Math.random() * 0.5;

                        debris.position.set(
                            Math.cos(angle) * cfg.r,
                            cfg.y -
                            0.5 +
                            Math.random() * 1.2,
                            Math.sin(angle) * cfg.r
                        );

                        debris.rotation.set(
                            Math.random() * 1.5,
                            Math.random() * 1.5,
                            Math.random() * 1.5
                        );

                        building.add(
                            debris
                        );
                    }
                }
            }
        );


        // ---------------------------------------------------------
        // CONTINUOUS GLASS CORE
        // One drum running the full height of the tower; the rings
        // above cantilever out past it, so it only reads as a dark
        // band in the gaps between floors, same as the reference.
        // ---------------------------------------------------------

        const coreRadius = 8.6;
        const coreBottom = 0.8;
        const coreTop = 22.6;

        const core =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    coreRadius,
                    coreRadius,
                    coreTop - coreBottom,
                    48,
                    1,
                    true
                ),
                glassDark
            );

        core.position.y =
            (coreTop + coreBottom) / 2;

        building.add(
            core
        );


        // ---------------------------------------------------------
        // VERTICAL MULLIONS
        // Thin fins ringing the glass core at even angular spacing.
        // ---------------------------------------------------------

        const mullionCount = 32;

        for (
            let i = 0;
            i < mullionCount;
            i++
        ) {

            const angle =
                (i / mullionCount) *
                Math.PI * 2;

            const mullion =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.12,
                        coreTop - coreBottom,
                        0.2
                    ),
                    mullionMaterial
                );

            mullion.position.set(
                Math.cos(angle) * coreRadius,
                (coreTop + coreBottom) / 2,
                Math.sin(angle) * coreRadius
            );

            mullion.rotation.y =
                -angle;

            building.add(
                mullion
            );
        }


        // ---------------------------------------------------------
        // WARM CORE LIGHT COLUMN
        // The glowing vertical beam visible through the glass gaps
        // in the reference image.
        // ---------------------------------------------------------

        const lightColumn =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    1.3,
                    1.3,
                    coreTop - 1,
                    24,
                    1,
                    true
                ),
                coreGlow
            );

        lightColumn.position.y =
            (coreTop + 1) / 2;

        building.add(
            lightColumn
        );

        const coreLight =
            new THREE.PointLight(
                0xffb15c,
                22,
                55
            );

        coreLight.position.set(
            0,
            12,
            0
        );

        building.add(
            coreLight
        );

        this._registerLiving(coreLight);


        // ---------------------------------------------------------
        // GROUND RUBBLE
        // ---------------------------------------------------------

        for (
            let i = 0;
            i < 10;
            i++
        ) {

            const size =
                0.15 +
                Math.random() * 0.6;

            const rubble =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size,
                        size *
                        (0.5 +
                        Math.random()),
                        size *
                        (0.5 +
                        Math.random())
                    ),
                    rubbleMaterial
                );

            const angle =
                Math.random() * Math.PI * 2;

            const dist =
                10 +
                Math.random() * 3.5;

            rubble.position.set(
                Math.cos(angle) * dist,
                size / 2,
                Math.sin(angle) * dist
            );

            rubble.rotation.set(
                Math.random() * 2,
                Math.random() * 2,
                Math.random() * 2
            );

            building.add(
                rubble
            );
        }
    }

    // =============================================================
    // =============================================================
    // BUILDING #6
    // GLASS GEODESIC DOME
    // LEFT SIDE
    // A hemisphere glass shell with curved meridian ribs, lit
    // interior floor rings, an asymmetric dark visor band swept
    // across the lower front, and an entrance stair.
    // =============================================================

    createGlassDomeBuilding(
        x,
        z
    ) {

        const domeGlass =
            new THREE.MeshStandardMaterial({
                color: 0x9fd0e8,
                roughness: 0.1,
                metalness: 0.2,
                transparent: true,
                opacity: 1,
                side: THREE.DoubleSide
            });

        const ribMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x2a3138,
                roughness: 0.4,
                metalness: 0.6
            });

        const visorMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x232a30,
                roughness: 0.25,
                metalness: 0.55
            });

        const amberGlow =
            new THREE.MeshStandardMaterial({
                color: 0xff8c33,
                emissive: 0xff7a1a,
                emissiveIntensity: 1.6,
                roughness: 0.3,
                metalness: 0.2
            });

        const plazaMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x3a3f45,
                roughness: 0.6,
                metalness: 0.3
            });

        const stairMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x4a5057,
                roughness: 0.55,
                metalness: 0.35
            });

        const building =
            new THREE.Group();

        building.position.set(
            x,
            0.5,
            z
        );

        this.level.add(
            building
        );


        // ---------------------------------------------------------
        // PLAZA BASE
        // ---------------------------------------------------------

        const plaza =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    16,
                    16,
                    0.6,
                    48
                ),
                plazaMaterial
            );

        plaza.position.y =
            0.3;

        building.add(
            plaza
        );


        // ---------------------------------------------------------
        // ENTRANCE STAIRS
        // Stacked shrinking slabs leading up to the dome's base.
        // ---------------------------------------------------------

        const stairCount = 5;

        for (
            let i = 0;
            i < stairCount;
            i++
        ) {

            const stepDepth =
                14 - i * 1.8;

            const stepWidth =
                10 - i * 1.2;

            const step =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        stepWidth,
                        0.3,
                        stepDepth
                    ),
                    stairMaterial
                );

            step.position.set(
                0,
                0.6 + i * 0.3,
                -6 - i * 0.6
            );

            building.add(
                step
            );
        }


        // ---------------------------------------------------------
        // DOME SHELL
        // Hemisphere, flat side down, sitting on the plaza.
        // ---------------------------------------------------------

        const domeRadius = 13;
        const domeBaseY = 1.5;

        const dome =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    domeRadius,
                    32,
                    16,
                    0,
                    Math.PI * 2,
                    0,
                    Math.PI / 2
                ),
                domeGlass
            );

        dome.position.y =
            domeBaseY;

        building.add(
            dome
        );


        // ---------------------------------------------------------
        // MERIDIAN RIBS
        // Curved tubes traced along the dome's surface from apex
        // to base, at even angular spacing - the geodesic framework
        // seen through the glass in the reference.
        // ---------------------------------------------------------

        const ribCount = 16;

        for (
            let i = 0;
            i < ribCount;
            i++
        ) {

            const az =
                (i / ribCount) *
                Math.PI * 2;

            const ribPoints = [];

            const steps = 10;

            for (
                let s = 0;
                s <= steps;
                s++
            ) {

                const phi =
                    (s / steps) *
                    (Math.PI / 2);

                const px =
                    domeRadius *
                    Math.sin(phi) *
                    Math.cos(az);

                const py =
                    domeBaseY +
                    domeRadius *
                    Math.cos(phi);

                const pz =
                    domeRadius *
                    Math.sin(phi) *
                    Math.sin(az);

                ribPoints.push(
                    new THREE.Vector3(
                        px,
                        py,
                        pz
                    )
                );
            }

            const ribCurve =
                new THREE.CatmullRomCurve3(
                    ribPoints
                );

            const rib =
                new THREE.Mesh(
                    new THREE.TubeGeometry(
                        ribCurve,
                        20,
                        0.12,
                        6,
                        false
                    ),
                    ribMaterial
                );

            building.add(
                rib
            );
        }


        // ---------------------------------------------------------
        // LATITUDE RIBS
        // Horizontal rings at a couple of heights, matching the
        // dome's curvature at that latitude.
        // ---------------------------------------------------------

        const latitudes = [
            Math.PI * 0.28,
            Math.PI * 0.42
        ];

        latitudes.forEach(
            (phi) => {

                const ringRadius =
                    domeRadius *
                    Math.sin(phi);

                const ringY =
                    domeBaseY +
                    domeRadius *
                    Math.cos(phi);

                const ring =
                    new THREE.Mesh(
                        new THREE.TorusGeometry(
                            ringRadius,
                            0.1,
                            6,
                            48
                        ),
                        ribMaterial
                    );

                ring.rotation.x =
                    Math.PI / 2;

                ring.position.y =
                    ringY;

                building.add(
                    ring
                );
            }
        );


        // ---------------------------------------------------------
        // INTERIOR AMBER FLOOR RINGS
        // Glowing floor-plate edges visible through the glass.
        // Reuses the same latitude angles as the structural ribs
        // (not separate ones) so they hug flush under them instead
        // of drifting to a different height, and the tube radius is
        // much thinner - a trim line, not a fat glowing pipe. Lower
        // emissiveIntensity so it reads as warm amber instead of
        // blowing out toward yellow-white.
        // ---------------------------------------------------------

        latitudes.forEach(
            (phi) => {

                const ringRadius =
                    domeRadius *
                    Math.sin(phi) -
                    0.25;

                const ringY =
                    domeBaseY +
                    domeRadius *
                    Math.cos(phi);

                const glowRing =
                    new THREE.Mesh(
                        new THREE.TorusGeometry(
                            ringRadius,
                            0.06,
                            8,
                            56
                        ),
                        amberGlow
                    );

                glowRing.rotation.x =
                    Math.PI / 2;

                glowRing.position.y =
                    ringY;

                building.add(
                    glowRing
                );

                const floorLight =
                    new THREE.PointLight(
                        0xffa94d,
                        7,
                        26
                    );

                floorLight.position.set(
                    0,
                    ringY,
                    0
                );

                building.add(
                    floorLight
                );

                this._registerLiving(floorLight);
            }
        );


        // ---------------------------------------------------------
        // DARK VISOR BAND
        // A tube following an actual arc across the dome's surface
        // (computed in spherical coordinates, same technique as the
        // meridian ribs) rather than a flattened torus - it dips
        // toward the base rim at both ends and arches up toward the
        // apex in the middle, like an eyebrow swept across the
        // front face. Because every point genuinely sits on the
        // dome's curvature, it reads correctly from any angle
        // instead of only looking right face-on.
        // ---------------------------------------------------------

        const visorPoints = [];

        const visorSteps = 40;
        const visorPhiRim = Math.PI * 0.48;
        const visorBump = Math.PI * 0.28;
        const visorAzStart = Math.PI * 1.15;
        const visorAzEnd = -Math.PI * 0.15;
        const visorSurfaceOffset = domeRadius + 0.2;

        for (
            let s = 0;
            s <= visorSteps;
            s++
        ) {

            const t =
                s / visorSteps;

            const phi =
                visorPhiRim -
                visorBump *
                Math.sin(Math.PI * t);

            const az =
                visorAzStart +
                (visorAzEnd - visorAzStart) * t;

            const vx =
                visorSurfaceOffset *
                Math.sin(phi) *
                Math.cos(az);

            const vy =
                domeBaseY +
                visorSurfaceOffset *
                Math.cos(phi);

            const vz =
                visorSurfaceOffset *
                Math.sin(phi) *
                Math.sin(az);

            visorPoints.push(
                new THREE.Vector3(
                    vx,
                    vy,
                    vz
                )
            );
        }

        const visorCurve =
            new THREE.CatmullRomCurve3(
                visorPoints
            );

        const visor =
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    visorCurve,
                    50,
                    0.45,
                    10,
                    false
                ),
                visorMaterial
            );

        building.add(
            visor
        );


        // ---------------------------------------------------------
        // GROUND RUBBLE
        // Kept minimal - this one reads as largely intact.
        // ---------------------------------------------------------

        const rubbleMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x55585b,
                roughness: 0.9,
                metalness: 0.15
            });

        for (
            let i = 0;
            i < 8;
            i++
        ) {

            const size =
                0.15 +
                Math.random() * 0.5;

            const rubble =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        size,
                        size *
                        (0.5 +
                        Math.random()),
                        size *
                        (0.5 +
                        Math.random())
                    ),
                    rubbleMaterial
                );

            const angle =
                Math.random() * Math.PI * 2;

            const dist =
                13 +
                Math.random() * 2.5;

            rubble.position.set(
                Math.cos(angle) * dist,
                size / 2,
                Math.sin(angle) * dist
            );

            rubble.rotation.set(
                Math.random() * 2,
                Math.random() * 2,
                Math.random() * 2
            );

            building.add(
                rubble
            );
        }
    }


    // =============================================================
    // BEAM BETWEEN
    // Orients a thin cylinder to span two arbitrary points - used
    // for the base struts and the bridge's suspension cables.
    // =============================================================

    createBeamBetween(
        pointA,
        pointB,
        radius,
        material
    ) {

        const direction =
            new THREE.Vector3().subVectors(
                pointB,
                pointA
            );

        const length =
            direction.length();

        const beam =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    radius,
                    radius,
                    length,
                    8
                ),
                material
            );

        const midpoint =
            new THREE.Vector3().addVectors(
                pointA,
                pointB
            ).multiplyScalar(0.5);

        beam.position.copy(
            midpoint
        );

        beam.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
        );

        return beam;
    }


    // =============================================================
// REALISTIC FUTURISTIC TWIN GATEWAY
// Large architectural buildings with simple futuristic forms,
// glass curtain walls, vertical fins and a connected skybridge.
// =============================================================

// =============================================================
    // TWISTED SPIRE TOWER
    // A stack of rotated, shrinking floor plates (Turning-Torso
    // style) with the four vertical edges traced as smooth curved
    // tubes through every floor's corner - that's what reads as a
    // twisting diagrid exoskeleton rather than a pile of boxes.
    // Returns the per-floor half-width function and total height so
    // the bridge can attach at the right point.
    // =============================================================
    createTwistedTower(building, localX, cfg) {
    const tower = new THREE.Group();
    tower.position.x = localX;
    building.add(tower);

    // ------------------------------------------------------------
    // MAIN DIMENSIONS
    // ------------------------------------------------------------
    const totalHeight = cfg.floors * cfg.floorHeight;
    const towerWidth = 18;
    const towerDepth = 28;

    // Long rear section used to fill the empty space toward the end
    const rearLength = 56;
    const rearHeight = 38;

    // ------------------------------------------------------------
    // MAIN TOWER
    // ------------------------------------------------------------

    // Main glass body
    const mainBody = new THREE.Mesh(
        new THREE.BoxGeometry(
            towerWidth,
            totalHeight,
            towerDepth
        ),
        cfg.materials.glass
    );

    mainBody.position.set(
        0,
        totalHeight / 2,
        0
    );

    tower.add(mainBody);

    // Dark structural core
    const core = new THREE.Mesh(
        new THREE.BoxGeometry(
            5.2,
            totalHeight,
            towerDepth - 2
        ),
        cfg.materials.frame
    );

    core.position.set(
        0,
        totalHeight / 2,
        0
    );

    tower.add(core);

    // Front glass section over the core
    const frontGlass = new THREE.Mesh(
        new THREE.BoxGeometry(
            towerWidth - 2,
            totalHeight - 2,
            1.0
        ),
        cfg.materials.glass
    );

    frontGlass.position.set(
        0,
        totalHeight / 2,
        -towerDepth / 2 - 0.1
    );

    tower.add(frontGlass);

    // ------------------------------------------------------------
    // HORIZONTAL FLOOR BANDS
    // ------------------------------------------------------------

    for (let i = 0; i <= cfg.floors; i++) {
        const y = i * cfg.floorHeight;

        const band = new THREE.Mesh(
            new THREE.BoxGeometry(
                towerWidth + 0.8,
                0.28,
                towerDepth + 0.8
            ),
            cfg.materials.edge
        );

        band.position.set(
            0,
            y,
            0
        );

        tower.add(band);
    }

    // ------------------------------------------------------------
    // VERTICAL FRONT STRUCTURES
    // ------------------------------------------------------------

    const frontColumnPositions = [
        -towerWidth / 2,
        -towerWidth / 4,
        0,
        towerWidth / 4,
        towerWidth / 2
    ];

    frontColumnPositions.forEach((x) => {
        const column = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.35,
                totalHeight,
                0.45
            ),
            cfg.materials.edge
        );

        column.position.set(
            x,
            totalHeight / 2,
            -towerDepth / 2 - 0.35
        );

        tower.add(column);
    });

    // ------------------------------------------------------------
    // SIDE VERTICAL STRUCTURES
    // ------------------------------------------------------------

    [-1, 1].forEach((side) => {
        [-towerDepth / 2, 0, towerDepth / 2].forEach((z) => {
            const column = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.4,
                    totalHeight,
                    0.5
                ),
                cfg.materials.edge
            );

            column.position.set(
                side * (towerWidth / 2 + 0.3),
                totalHeight / 2,
                z
            );

            tower.add(column);
        });
    });

    // ------------------------------------------------------------
    // FRONT HORIZONTAL FRAME
    // ------------------------------------------------------------

    for (let i = 0; i < cfg.floors; i++) {
        const y = i * cfg.floorHeight + cfg.floorHeight / 2;

        const frontFrame = new THREE.Mesh(
            new THREE.BoxGeometry(
                towerWidth + 0.5,
                0.18,
                0.5
            ),
            cfg.materials.edge
        );

        frontFrame.position.set(
            0,
            y,
            -towerDepth / 2 - 0.4
        );

        tower.add(frontFrame);
    }

    // ------------------------------------------------------------
    // ROOFTOP STRUCTURE
    // ------------------------------------------------------------

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(
            towerWidth + 2,
            1.0,
            towerDepth + 2
        ),
        cfg.materials.frame
    );

    roof.position.set(
        0,
        totalHeight + 0.5,
        0
    );

    tower.add(roof);

    // Smaller futuristic rooftop block
    const roofBlock = new THREE.Mesh(
        new THREE.BoxGeometry(
            11,
            3.2,
            14
        ),
        cfg.materials.glass
    );

    roofBlock.position.set(
        0,
        totalHeight + 2.1,
        0
    );

    tower.add(roofBlock);

    const roofFrame = new THREE.Mesh(
        new THREE.BoxGeometry(
            12,
            0.45,
            15
        ),
        cfg.materials.edge
    );

    roofFrame.position.set(
        0,
        totalHeight + 3.7,
        0
    );

    tower.add(roofFrame);

    // ------------------------------------------------------------
    // ROOFTOP BEACON STRUCTURE
    // ------------------------------------------------------------

    const mastHeight = 9;

    const mast = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.55,
            mastHeight,
            0.55
        ),
        cfg.materials.edge
    );

    mast.position.set(
        0,
        totalHeight + 3.7 + mastHeight / 2,
        0
    );

    tower.add(mast);

    // Cross support near top
    const mastTop = new THREE.Mesh(
        new THREE.BoxGeometry(
            3.2,
            0.35,
            0.35
        ),
        cfg.materials.edge
    );

    mastTop.position.set(
        0,
        totalHeight + 10.7,
        0
    );

    tower.add(mastTop);

    // Original red beacon
    const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 16, 16),
        cfg.materials.beacon
    );

    beacon.position.set(
        0,
        totalHeight + 12.4,
        0
    );

    tower.add(beacon);

    // ORIGINAL LIGHT — DO NOT CHANGE
    const beaconLight = new THREE.PointLight(
        0xff3355,
        14,
        26
    );

    beaconLight.position.set(
        0,
        totalHeight + 12.4,
        0
    );

    beaconLight.userData.baseIntensity = 14;

    tower.add(beaconLight);
    this.gatewayLights.push(beaconLight);

    // ------------------------------------------------------------
    // LONG REAR BUILDING SECTION
    // ------------------------------------------------------------

    const rear = new THREE.Mesh(
        new THREE.BoxGeometry(
            15,
            rearHeight,
            rearLength
        ),
        cfg.materials.glass
    );

    rear.position.set(
        0,
        rearHeight / 2,
        towerDepth / 2 + rearLength / 2 - 2
    );

    tower.add(rear);

    // Rear structural core
    const rearCore = new THREE.Mesh(
        new THREE.BoxGeometry(
            4.5,
            rearHeight,
            rearLength - 1
        ),
        cfg.materials.frame
    );

    rearCore.position.set(
        0,
        rearHeight / 2,
        towerDepth / 2 + rearLength / 2 - 2
    );

    tower.add(rearCore);

    // Rear floor bands
    for (let i = 0; i <= Math.floor(rearHeight / cfg.floorHeight); i++) {
        const y = i * cfg.floorHeight;

        const rearBand = new THREE.Mesh(
            new THREE.BoxGeometry(
                15.7,
                0.25,
                rearLength + 0.6
            ),
            cfg.materials.edge
        );

        rearBand.position.set(
            0,
            y,
            towerDepth / 2 + rearLength / 2 - 2
        );

        tower.add(rearBand);
    }

    // Rear vertical supports
    [-1, 1].forEach((side) => {
        const rearColumn = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.4,
                rearHeight,
                rearLength
            ),
            cfg.materials.edge
        );

        rearColumn.position.set(
            side * 7.7,
            rearHeight / 2,
            towerDepth / 2 + rearLength / 2 - 2
        );

        tower.add(rearColumn);
    });

    // Rear roof
    const rearRoof = new THREE.Mesh(
        new THREE.BoxGeometry(
            16,
            0.7,
            rearLength + 1
        ),
        cfg.materials.frame
    );

    rearRoof.position.set(
        0,
        rearHeight + 0.35,
        towerDepth / 2 + rearLength / 2 - 2
    );

    tower.add(rearRoof);

    // ------------------------------------------------------------
    // CONNECTION BETWEEN MAIN TOWER AND REAR SECTION
    // ------------------------------------------------------------

    const connector = new THREE.Mesh(
        new THREE.BoxGeometry(
            towerWidth,
            rearHeight * 0.7,
            8
        ),
        cfg.materials.glass
    );

    connector.position.set(
        0,
        (rearHeight * 0.7) / 2,
        towerDepth / 2 + 2
    );

    tower.add(connector);

    const connectorRoof = new THREE.Mesh(
        new THREE.BoxGeometry(
            towerWidth + 0.6,
            0.45,
            8.5
        ),
        cfg.materials.edge
    );

    connectorRoof.position.set(
        0,
        rearHeight * 0.7 + 0.2,
        towerDepth / 2 + 2
    );

    tower.add(connectorRoof);

    // ------------------------------------------------------------
    // BASE / PLAZA
    // ------------------------------------------------------------

    const plaza = new THREE.Mesh(
        new THREE.BoxGeometry(
            towerWidth + 7,
            0.6,
            towerDepth + rearLength + 7
        ),
        cfg.materials.plaza
    );

    plaza.position.set(
        0,
        0.3,
        rearLength / 2 + 2
    );

    tower.add(plaza);

    // Raised front entrance
    const entrance = new THREE.Mesh(
        new THREE.BoxGeometry(
            9,
            4,
            4
        ),
        cfg.materials.frame
    );

    entrance.position.set(
        0,
        2,
        -towerDepth / 2 - 1.5
    );

    tower.add(entrance);

    // Glass entrance
    const entranceGlass = new THREE.Mesh(
        new THREE.BoxGeometry(
            7,
            3.2,
            0.25
        ),
        cfg.materials.glass
    );

    entranceGlass.position.set(
        0,
        2,
        -towerDepth / 2 - 3.5
    );

    tower.add(entranceGlass);

    // ------------------------------------------------------------
    // RETURN VALUES USED BY THE BRIDGE
    // ------------------------------------------------------------

    const halfWidthAt = () => towerWidth / 2;

    return {
        halfWidthAt,
        topY: totalHeight
    };
}

createTwinSpireGateway(z) {
    this.gatewayLights = this.gatewayLights || [];

    // ------------------------------------------------------------
    // ORIGINAL MATERIALS — UNCHANGED
    // ------------------------------------------------------------

    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2f36,
        roughness: 0.4,
        metalness: 0.75
    });

    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x14171c,
        roughness: 0.3,
        metalness: 0.85
    });

    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x1c3a42,
        roughness: 0.12,
        metalness: 0.5,
        transparent: true,
        opacity: 0.5
    });

    const beaconMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3355,
        emissive: 0xff3355,
        emissiveIntensity: 3.5,
        roughness: 0.3,
        metalness: 0.1
    });

    const plazaMaterial = new THREE.MeshStandardMaterial({
        color: 0x2e3238,
        roughness: 0.6,
        metalness: 0.3
    });

    const bridgeGlassMaterial = new THREE.MeshStandardMaterial({
        color: 0x152028,
        roughness: 0.12,
        metalness: 0.4,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
    });

    const cableMaterial = new THREE.MeshStandardMaterial({
        color: 0x15171a,
        roughness: 0.35,
        metalness: 0.85
    });

    const cyanAccent = new THREE.MeshStandardMaterial({
        color: 0x00d9ff,
        emissive: 0x00d9ff,
        emissiveIntensity: 2.8,
        roughness: 0.2,
        metalness: 0.25
    });

    // ------------------------------------------------------------
    // MAIN BUILDING GROUP
    // ------------------------------------------------------------

    const building = new THREE.Group();

    building.position.set(
        0,
        0,
        z
    );

    this.level.add(building);

    const towerMaterials = {
        frame: frameMaterial,
        edge: edgeMaterial,
        glass: glassMaterial,
        beacon: beaconMaterial,
        plaza: plazaMaterial
    };

    // Keep original floor/height scale
    const towerConfig = {
        floors: 14,
        floorHeight: 3.2,
        baseHalf: 9,
        topHalf: 9,
        twistTotal: 0,
        materials: towerMaterials
    };

    // ------------------------------------------------------------
    // TWO LARGE BUILDINGS
    // ------------------------------------------------------------

    const leftTower = this.createTwistedTower(
        building,
        -24,
        towerConfig
    );

    const rightTower = this.createTwistedTower(
        building,
        24,
        towerConfig
    );

    // ------------------------------------------------------------
    // BRIDGE
    // ------------------------------------------------------------

    const bridgeFloorIndex = Math.floor(
        towerConfig.floors * 0.68
    );

    const bridgeT =
        bridgeFloorIndex /
        (towerConfig.floors - 1);

    const bridgeY =
        bridgeFloorIndex *
        towerConfig.floorHeight +
        towerConfig.floorHeight / 2;

    const halfAtBridge =
        leftTower.halfWidthAt(bridgeT);

    const xStart =
        -24 +
        halfAtBridge +
        0.5;

    const xEnd =
        24 -
        halfAtBridge -
        0.5;

    const bridgeLength =
        xEnd - xStart;

    const bridgeRadius = 2.4;

    // ------------------------------------------------------------
    // MAIN ENCLOSED SKYBRIDGE
    // ------------------------------------------------------------

    const bridgeBody = new THREE.Mesh(
        new THREE.BoxGeometry(
            bridgeLength,
            5.8,
            7.5
        ),
        bridgeGlassMaterial
    );

    bridgeBody.position.set(
        (xStart + xEnd) / 2,
        bridgeY,
        0
    );

    building.add(bridgeBody);

    // Bridge floor
    const bridgeFloor = new THREE.Mesh(
        new THREE.BoxGeometry(
            bridgeLength + 1,
            0.45,
            8
        ),
        frameMaterial
    );

    bridgeFloor.position.set(
        (xStart + xEnd) / 2,
        bridgeY - 2.85,
        0
    );

    building.add(bridgeFloor);

    // Bridge roof
    const bridgeRoof = new THREE.Mesh(
        new THREE.BoxGeometry(
            bridgeLength + 1,
            0.45,
            8
        ),
        frameMaterial
    );

    bridgeRoof.position.set(
        (xStart + xEnd) / 2,
        bridgeY + 2.85,
        0
    );

    building.add(bridgeRoof);

    // ------------------------------------------------------------
    // BRIDGE FRONT AND BACK FRAMES
    // ------------------------------------------------------------

    [-1, 1].forEach((side) => {
        const glassPanel = new THREE.Mesh(
            new THREE.BoxGeometry(
                bridgeLength - 1,
                5,
                0.18
            ),
            bridgeGlassMaterial
        );

        glassPanel.position.set(
            (xStart + xEnd) / 2,
            bridgeY,
            side * 3.82
        );

        building.add(glassPanel);

        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry(
                bridgeLength,
                0.3,
                0.35
            ),
            edgeMaterial
        );

        topFrame.position.set(
            (xStart + xEnd) / 2,
            bridgeY + 2.65,
            side * 3.95
        );

        building.add(topFrame);

        const bottomFrame = new THREE.Mesh(
            new THREE.BoxGeometry(
                bridgeLength,
                0.3,
                0.35
            ),
            edgeMaterial
        );

        bottomFrame.position.set(
            (xStart + xEnd) / 2,
            bridgeY - 2.65,
            side * 3.95
        );

        building.add(bottomFrame);
    });

    // ------------------------------------------------------------
    // CYAN BRIDGE ACCENTS
    // ------------------------------------------------------------

    const frontAccent = new THREE.Mesh(
        new THREE.BoxGeometry(
            bridgeLength,
            0.08,
            0.12
        ),
        cyanAccent
    );

    frontAccent.position.set(
        (xStart + xEnd) / 2,
        bridgeY - 2.35,
        4.05
    );

    building.add(frontAccent);

    const backAccent = frontAccent.clone();

    backAccent.position.z = -4.05;

    building.add(backAccent);

    // ------------------------------------------------------------
    // BRIDGE SUPPORT FRAME
    // ------------------------------------------------------------

    const supportCount = 7;

    for (let i = 1; i < supportCount; i++) {
        const t = i / supportCount;

        const x =
            xStart +
            bridgeLength * t;

        const support = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.3,
                5.8,
                8
            ),
            edgeMaterial
        );

        support.position.set(
            x,
            bridgeY,
            0
        );

        building.add(support);
    }

    // ------------------------------------------------------------
    // CENTRAL BRIDGE MAST
    // ------------------------------------------------------------

    const pylonBaseY = bridgeY + 2.85;
    const pylonHeight = 10.9;

    const pylon = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.65,
            pylonHeight,
            0.65
        ),
        edgeMaterial
    );

    pylon.position.set(
        0,
        pylonBaseY + pylonHeight / 2,
        0
    );

    building.add(pylon);

    const pylonTop = new THREE.Mesh(
        new THREE.BoxGeometry(
            2.8,
            0.3,
            0.3
        ),
        edgeMaterial
    );

    pylonTop.position.set(
        0,
        pylonBaseY + pylonHeight,
        0
    );

    building.add(pylonTop);

    // Original red bridge beacon
    const pylonBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.5,
            16,
            16
        ),
        beaconMaterial
    );

    pylonBeacon.position.set(
        0,
        pylonBaseY + pylonHeight + 0.7,
        0
    );

    building.add(pylonBeacon);

    // ORIGINAL PYLON LIGHT — UNCHANGED
    const pylonLight = new THREE.PointLight(
        0xff3355,
        10,
        22
    );

    pylonLight.position.set(
        0,
        pylonBaseY + pylonHeight + 0.7,
        0
    );

    pylonLight.userData.baseIntensity = 10;

    building.add(pylonLight);
    this.gatewayLights.push(pylonLight);

    // ------------------------------------------------------------
    // UNDER-BRIDGE LIGHT — ORIGINAL VALUE
    // ------------------------------------------------------------

    const underLight = new THREE.PointLight(
        0x00d9ff,
        12,
        45
    );

    underLight.position.set(
        0,
        bridgeY - bridgeRadius - 1,
        0
    );

    building.add(underLight);

    this._registerLiving(underLight);

    // ------------------------------------------------------------
    // BRIDGE END CAPS
    // ------------------------------------------------------------

    [-1, 1].forEach((side) => {
        const endCap = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.7,
                6.2,
                8.5
            ),
            frameMaterial
        );

        endCap.position.set(
            side === -1 ? xStart : xEnd,
            bridgeY,
            0
        );

        building.add(endCap);

        const endGlass = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.12,
                4.8,
                6.5
            ),
            bridgeGlassMaterial
        );

        endGlass.position.set(
            side === -1
                ? xStart - 0.38
                : xEnd + 0.38,
            bridgeY,
            0
        );

        building.add(endGlass);
    });
}

// =========================================================
// FUTURISTIC BACKGROUND CITY
// =========================================================

createCityBackground() {

    // ---------------------------------------------------------
    // SIDE OFFSET
    // ---------------------------------------------------------
    // How far the background rows are pushed sideways so they
    // sit behind the main buildings instead of inside them.
    // Increase this value to move the background further out.

    const SIDE_OFFSET = 35;


    // ---------------------------------------------------------
    // MATERIALS
    // ---------------------------------------------------------

    const darkGlass = new THREE.MeshStandardMaterial({
        color: 0x26343b,
        roughness: 0.22,
        metalness: 0.65
    });

    const silverStructure = new THREE.MeshStandardMaterial({
        color: 0x59636a,
        roughness: 0.32,
        metalness: 0.78
    });

    const darkStructure = new THREE.MeshStandardMaterial({
        color: 0x1b2025,
        roughness: 0.3,
        metalness: 0.82
    });

    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x3e7f89,
        roughness: 0.15,
        metalness: 0.55,
        emissive: 0x163c43,
        emissiveIntensity: 0.7
    });

    const cyanMaterial = new THREE.MeshStandardMaterial({
        color: 0x00bcd4,
        roughness: 0.2,
        metalness: 0.4,
        emissive: 0x007c91,
        emissiveIntensity: 1.5
    });


    // =========================================================
    // CREATE ONE BACKGROUND BUILDING
    // =========================================================

    const createBackgroundBuilding = (
        x,
        z,
        width,
        depth,
        height,
        variant
    ) => {

        const building = new THREE.Group();


        // -----------------------------------------------------
        // MAIN BUILDING
        // -----------------------------------------------------

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                height,
                depth
            ),
            darkGlass
        );

        body.position.y = height / 2;

        building.add(body);


        // -----------------------------------------------------
        // VERTICAL STRUCTURE
        // -----------------------------------------------------

        const columnCount = Math.max(
            2,
            Math.floor(width / 4)
        );

        for (let i = 0; i <= columnCount; i++) {

            const columnX =
                -width / 2 +
                (width / columnCount) * i;


            // FRONT COLUMN

            const column = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.22,
                    height + 0.2,
                    0.22
                ),
                silverStructure
            );

            column.position.set(
                columnX,
                height / 2,
                depth / 2 + 0.12
            );

            building.add(column);


            // BACK COLUMN

            const backColumn = column.clone();

            backColumn.position.z =
                -depth / 2 - 0.12;

            building.add(backColumn);
        }


        // -----------------------------------------------------
        // FLOOR DIVISIONS
        // -----------------------------------------------------

        const floorSpacing = 3.2;

        for (
            let y = 3;
            y < height;
            y += floorSpacing
        ) {

            const floorBand = new THREE.Mesh(
                new THREE.BoxGeometry(
                    width + 0.25,
                    0.12,
                    0.18
                ),
                darkStructure
            );

            floorBand.position.set(
                0,
                y,
                depth / 2 + 0.16
            );

            building.add(floorBand);
        }


        // -----------------------------------------------------
        // WINDOWS
        // -----------------------------------------------------

        const windowRows =
            Math.floor(height / 3.2);

        for (let row = 0; row < windowRows; row++) {

            const y =
                1.5 +
                row * 3.2;


            const window = new THREE.Mesh(
                new THREE.BoxGeometry(
                    width * 0.78,
                    1.45,
                    0.06
                ),
                windowMaterial
            );

            window.position.set(
                0,
                y,
                depth / 2 + 0.19
            );

            building.add(window);
        }


        // -----------------------------------------------------
        // VERTICAL FACADE FINS
        // -----------------------------------------------------

        if (variant % 2 === 0) {

            const finCount =
                Math.max(
                    2,
                    Math.floor(width / 5)
                );

            for (let i = 0; i < finCount; i++) {

                const finX =
                    -width / 2 +
                    2 +
                    i * 5;


                const fin = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.28,
                        height * 0.92,
                        0.35
                    ),
                    silverStructure
                );

                fin.position.set(
                    finX,
                    height * 0.48,
                    depth / 2 + 0.24
                );

                building.add(fin);
            }
        }


        // -----------------------------------------------------
        // ROOFTOP MECHANICAL UNIT
        // -----------------------------------------------------

        const roofWidth =
            width * 0.45;

        const roofDepth =
            depth * 0.45;

        const roofHeight =
            Math.min(
                3,
                height * 0.08
            );


        const roofUnit = new THREE.Mesh(
            new THREE.BoxGeometry(
                roofWidth,
                roofHeight,
                roofDepth
            ),
            darkStructure
        );

        roofUnit.position.y =
            height +
            roofHeight / 2;

        building.add(roofUnit);


        // -----------------------------------------------------
        // ROOFTOP ARCHITECTURAL SPINE
        // -----------------------------------------------------

        if (variant % 3 === 0) {

            const spine = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.7,
                    5,
                    0.7
                ),
                silverStructure
            );

            spine.position.y =
                height +
                roofHeight +
                2.5;

            building.add(spine);


            const cyanCap = new THREE.Mesh(
                new THREE.BoxGeometry(
                    1.4,
                    0.18,
                    1.4
                ),
                cyanMaterial
            );

            cyanCap.position.y =
                height +
                roofHeight +
                5;

            building.add(cyanCap);
        }


        // -----------------------------------------------------
        // SIDE FACADE FINS
        // -----------------------------------------------------

        const sideFinCount =
            Math.max(
                2,
                Math.floor(depth / 5)
            );


        for (let i = 0; i < sideFinCount; i++) {

            const sideZ =
                -depth / 2 +
                2 +
                i * 5;


            const sideFin = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.3,
                    height * 0.7,
                    0.5
                ),
                darkStructure
            );

            sideFin.position.set(
                width / 2 + 0.18,
                height * 0.42,
                sideZ
            );

            building.add(sideFin);
        }


        // -----------------------------------------------------
        // ADD BUILDING TO LEVEL
        // -----------------------------------------------------

        // Push the side rows outward so they sit behind the main
        // buildings. The far wall at the end of the road (z ~ 143)
        // stays where it is.
        const placedX =
            Math.abs(z) < 140
                ? x + Math.sign(x) * SIDE_OFFSET
                : x;

        building.position.set(
            placedX,
            0,
            z
        );

        this.level.add(building);
    };


    // =========================================================
    // BACKGROUND BUILDINGS
    // =========================================================

    // LEFT SIDE

    createBackgroundBuilding(
        -20,
        -115,
        16,
        14,
        42,
        0
    );

    createBackgroundBuilding(
        -20,
        -82,
        18,
        15,
        55,
        1
    );

    createBackgroundBuilding(
        -20,
        -47,
        15,
        14,
        38,
        2
    );

    createBackgroundBuilding(
        -20,
        -12,
        19,
        15,
        62,
        3
    );

    createBackgroundBuilding(
        -20,
        24,
        16,
        14,
        48,
        4
    );

    createBackgroundBuilding(
        -20,
        59,
        19,
        15,
        67,
        5
    );

    createBackgroundBuilding(
        -20,
        94,
        16,
        14,
        52,
        6
    );

    createBackgroundBuilding(
        -20,
        127,
        19,
        15,
        72,
        7
    );


    // RIGHT SIDE

    createBackgroundBuilding(
        20,
        -115,
        17,
        14,
        52,
        8
    );

    createBackgroundBuilding(
        20,
        -80,
        15,
        15,
        40,
        9
    );

    createBackgroundBuilding(
        20,
        -45,
        19,
        14,
        65,
        10
    );

    createBackgroundBuilding(
        20,
        -10,
        16,
        15,
        47,
        11
    );

    createBackgroundBuilding(
        20,
        25,
        19,
        14,
        70,
        12
    );

    createBackgroundBuilding(
        20,
        60,
        15,
        15,
        44,
        13
    );

    createBackgroundBuilding(
        20,
        95,
        19,
        14,
        60,
        14
    );

    createBackgroundBuilding(
        20,
        128,
        17,
        15,
        75,
        15
    );


    // =========================================================
    // DENSE CITY AT THE END OF THE ROAD
    // =========================================================

    createBackgroundBuilding(
        -35,
        142,
        18,
        20,
        55,
        20
    );

    createBackgroundBuilding(
        -17,
        143,
        20,
        20,
        70,
        21
    );

    createBackgroundBuilding(
        5,
        143,
        18,
        20,
        58,
        22
    );

    createBackgroundBuilding(
        24,
        143,
        21,
        20,
        78,
        23
    );

    createBackgroundBuilding(
        43,
        143,
        16,
        20,
        48,
        24
    );

    // =========================================================
    // CITY ROW
    // =========================================================

    // Road is 16 units wide.
    // Existing buildings should already be outside this area.
    //
    // These are placed behind the existing buildings.
    // Left side = negative X
    // Right side = positive X
    //
    // Z runs along the road.

    const leftBuildings = [
        [-19, -110, 13, 12, 34, 0],
        [-19,  -78, 16, 13, 43, 1],
        [-20,  -44, 12, 14, 31, 2],
        [-19,  -10, 17, 12, 48, 3],
        [-20,   26, 14, 15, 38, 4],
        [-19,   61, 17, 13, 52, 5],
        [-20,   96, 13, 14, 42, 6],
        [-19,  128, 18, 15, 57, 7]
    ];

    const rightBuildings = [
        [19, -118, 15, 13, 45, 2],
        [20,  -86, 12, 15, 35, 3],
        [19,  -52, 17, 12, 50, 4],
        [20,  -20, 14, 14, 40, 5],
        [19,   14, 17, 13, 55, 6],
        [20,   49, 13, 15, 37, 7],
        [19,   83, 17, 13, 49, 8],
        [20,  119, 14, 16, 60, 9]
    ];


    // ---------------------------------------------------------
    // Create left side
    // ---------------------------------------------------------

    leftBuildings.forEach(data => {

        createBackgroundBuilding(
            data[0],
            data[1],
            data[2],
            data[3],
            data[4],
            data[5]
        );

    });


    // ---------------------------------------------------------
    // Create right side
    // ---------------------------------------------------------

    rightBuildings.forEach(data => {

        createBackgroundBuilding(
            data[0],
            data[1],
            data[2],
            data[3],
            data[4],
            data[5]
        );

    });


    // =========================================================
    // FAR CITY WALL
    // =========================================================

    // This creates a dense skyline at the end of the road
    // so the world doesn't look like it suddenly stops.

    const farZ = 143;

    const farBuildings = [
        [-31, 28, 15, 42],
        [-15, 40, 18, 55],
        [2, 30, 16, 46],
        [17, 42, 19, 62],
        [33, 27, 14, 38],
        [-43, 23, 13, 35],
        [45, 24, 16, 44]
    ];

    farBuildings.forEach((data, index) => {

        createBackgroundBuilding(
            data[0],
            farZ,
            data[2],
            data[3],
            data[4],
            index
        );

    });
}



    // GIANT CIRCULAR END AREA
    // =============================================================

    createBossArea(
        z
    ) {

        const arenaMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x171329,
                metalness: 0.8,
                roughness: 0.3,
                emissive: 0x120b28,
                emissiveIntensity: 1.2
            });

        const arena =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    24,
                    24,
                    0.7,
                    48
                ),
                arenaMaterial
            );

        arena.position.set(
            0,
            0,
            z-20
        );

        this.level.add(
            arena
        );


        // =========================================================
        // OUTER PILLARS
        // =========================================================

        for (
            let i = 0;
            i < 8;
            i++
        ) {

            const angle =
                (i / 8) *
                Math.PI *
                2;

            const px =
                Math.cos(angle) *
                22;

            const pz =
                z +
                Math.sin(angle) *
                22;

            this.createBossPillar(
                px,
                pz
            );
        }


        // =========================================================
        // CENTRAL PLATFORM
        // =========================================================

        const bossGlow =
            new THREE.MeshStandardMaterial({
                color: 0xff20c8,
                emissive: 0xff20c8,
                emissiveIntensity: 4,
                roughness: 0.2,
                metalness: 0.25
            });

        const bossPlatform =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    6,
                    6,
                    0.5,
                    12
                ),
                bossGlow
            );

        bossPlatform.position.set(
            0,
            0.6,
            z-20
        );

        this.level.add(
            bossPlatform
        );


        // =========================================================
        // RING
        // =========================================================

        const ring =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    17,
                    0.22,
                    10,
                    96
                ),
                bossGlow
            );

        ring.rotation.x =
            Math.PI / 2;

        ring.position.set(
            0,
            0.5,
            z-20
        );

        this.level.add(
            ring
        );


        const bossLight =
            new THREE.PointLight(
                0xff20c8,
                30,
                60
            );

        bossLight.position.set(
            0,
            5,
            z-20
        );

        this.level.add(
            bossLight
        );

        this._registerLiving(bossLight, { amp: 0.45, speed: 1.2 });
    }


    // =============================================================
    // BOSS PILLAR
    // =============================================================

    createBossPillar(
        x,
        z
    ) {

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x241b42,
                metalness: 0.8,
                roughness: 0.3,
                emissive: 0x120b25,
                emissiveIntensity: 1
            });

        const pillar =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    3,
                    14,
                    3
                ),
                material
            );

        pillar.position.set(
            x,
            7,
            z-20
        );

        this.level.add(
            pillar
        );


        const glow =
            new THREE.MeshStandardMaterial({
                color: 0xff20c8,
                emissive: 0xff20c8,
                emissiveIntensity: 3
            });

        const strip =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.25,
                    12,
                    0.25
                ),
                glow
            );

        strip.position.set(
            x,
            7,
            z - 1.55-20
        );

        this.level.add(
            strip
        );
    }


    // =============================================================
    // ATMOSPHERE
    // Slow-drifting embers/dust motes filling the street corridor
    // and boss arena, tinted to pick up the cyan/purple/red neon
    // already in the scene. Wraps vertically so it reads as
    // continuous ambient "living air" rather than a one-shot burst.
    // =============================================================

    createAtmosphere() {

        const count = 1100;

        const positions =
            new Float32Array(count * 3);

        const colors =
            new Float32Array(count * 3);

        this.driftSpeeds =
            new Float32Array(count);

        this.driftSway =
            new Float32Array(count * 2);

        // A warm ember palette mixed with cool neon, so particles
        // read differently depending on which light they drift near.
        const palette = [
            [1.0, 0.65, 0.35],   // ember orange
            [0.4, 0.85, 1.0],    // cyan neon
            [0.75, 0.35, 1.0],   // purple neon
            [1.0, 0.85, 0.6]     // warm streetlight
        ];

        for (
            let i = 0;
            i < count;
            i++
        ) {

            positions[i * 3] =
                (Math.random() - 0.5) * 60;

            positions[i * 3 + 1] =
                Math.random() * 26;

            positions[i * 3 + 2] =
                (Math.random() - 0.5) * 300;

            const c =
                palette[Math.floor(Math.random() * palette.length)];

            colors[i * 3] = c[0];
            colors[i * 3 + 1] = c[1];
            colors[i * 3 + 2] = c[2];

            this.driftSpeeds[i] =
                0.3 + Math.random() * 0.9;

            this.driftSway[i * 2] =
                (Math.random() - 0.5) * 0.35;

            this.driftSway[i * 2 + 1] =
                (Math.random() - 0.5) * 0.35;
        }

        const geometry =
            new THREE.BufferGeometry();

        geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );

        geometry.setAttribute(
            'color',
            new THREE.BufferAttribute(colors, 3)
        );

        const material =
            new THREE.PointsMaterial({
                size: 0.16,
                vertexColors: true,
                transparent: true,
                opacity: 0.5,
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

        const particles =
            new THREE.Points(geometry, material);

        particles.userData.noShadow = true;

        this.level.add(particles);

        this.driftParticles = particles;
    }


    // =============================================================
    // PORTAL
    // =============================================================

    createPortal(
        x,
        y,
        z
    ) {

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x00d9ff,
                emissive: 0x00d9ff,
                emissiveIntensity: 5,
                metalness: 0.25,
                roughness: 0.2
            });

        this.portal =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    5,
                    0.45,
                    16,
                    64
                ),
                material
            );

        this.portal.position.set(
            x,
            y,
            z-29
        );

        this.level.add(
            this.portal
        );


        const core =
            new THREE.Mesh(
                new THREE.CircleGeometry(
                    4.55,
                    48
                ),
                new THREE.MeshBasicMaterial({
                    color: 0x07152a,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide
                })
            );

        core.position.set(
            x,
            y,
            z-29
        );

        core.rotation.y =
            Math.PI;

        this.level.add(
            core
        );


        this.portalLight =
            new THREE.PointLight(
                0x00d9ff,
                30,
                35
            );

        this.portalLight.position.set(
            x,
            y,
            z-29
        );

        this.level.add(
            this.portalLight
        );
    }


    // =============================================================
    // UPDATE
    // =============================================================

    update(
        deltaTime
    ) {

        const now = performance.now();

        if (this.portal) {

            this.portal.rotation.z +=
                deltaTime * 0.8;
        }

        if (this.portalLight) {

            this.portalLight.intensity =
                25 +
                Math.sin(
                    performance.now() *
                    0.005
                ) * 8;
        }

        if (this.gatewayLights) {

            this.gatewayLights.forEach(
                (light, i) => {

                    light.intensity =
                        light.userData.baseIntensity +
                        Math.sin(
                            performance.now() *
                            0.004 +
                            i * 1.7
                        ) *
                        light.userData.baseIntensity *
                        0.6;
                }
            );
        }


        // =========================================================
        // LIVING LIGHTS
        // Every building/boss/bridge light registered via
        // _registerLiving() breathes on its own randomized phase -
        // this alone is most of what makes the street feel alive
        // instead of a lit but frozen diorama.
        // =========================================================

        if (this.livingLights) {

            this.livingLights.forEach(
                (light) => {

                    const d = light.userData;

                    light.intensity =
                        d.baseIntensity +
                        Math.sin(
                            now * 0.001 * d.flickerSpeed +
                            d.flickerPhase
                        ) *
                        d.baseIntensity *
                        d.flickerAmp;
                }
            );
        }


        // =========================================================
        // DRIFTING ATMOSPHERE
        // Embers/dust rise slowly and sway sideways, wrapping back
        // to the ground once they clear the rooflines.
        // =========================================================

        if (this.driftParticles) {

            const pos =
                this.driftParticles.geometry.attributes.position;

            for (
                let i = 0;
                i < pos.count;
                i++
            ) {

                let y =
                    pos.getY(i) +
                    this.driftSpeeds[i] * deltaTime;

                if (y > 26) {
                    y = 0;
                }

                pos.setY(i, y);

                pos.setX(
                    i,
                    pos.getX(i) +
                    this.driftSway[i * 2] * deltaTime
                );

                pos.setZ(
                    i,
                    pos.getZ(i) +
                    this.driftSway[i * 2 + 1] * deltaTime
                );
            }

            pos.needsUpdate = true;
        }


        // =========================================================
        // BANNER SWAY
        // Gentle wind sway on every street-light banner.
        // =========================================================

        if (this.banners) {

            this.banners.forEach(
                (banner, i) => {

                    banner.rotation.z =
                        Math.sin(now * 0.0006 + i) * 0.035;
                }
            );
        }
    }

    // =============================================================
    // DISPOSE — called by main.js on level switch
    // =============================================================
    dispose(outerScene = null) {
        const sceneToClean = outerScene && outerScene.isScene ? outerScene : this.scene;
        // detach primary group / sky from whatever scene they live in
        if (this.level && this.level.parent) this.level.parent.remove(this.level);
        if (this.sky && this.sky.parent) this.sky.parent.remove(this.sky);
        if (this.level) {
            this.level.traverse((object) => {
                if (!object.isMesh && !object.isPoints) return;
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const mats = Array.isArray(object.material) ? object.material : [object.material];
                    mats.forEach((m) => {
                        for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
                        m.dispose();
                    });
                }
            });
        }
        if (this.sky) {
            if (this.sky.geometry) this.sky.geometry.dispose();
            if (this.sky.material) {
                if (this.sky.material.map) this.sky.material.map.dispose();
                this.sky.material.dispose();
            }
        }
        // clear tracking arrays so a disposed level never gets reused
        this.colliders = [];
        this.livingLights = [];
        this.banners = [];
        this.driftParticles = null;
        this.sky = null;
    }
}
