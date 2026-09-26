import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
    moonVertexShader,
    moonFragmentShader
} from '../shaders/moon.js';

// Spaceship + corridor palette: two body colours, cool
// white light, coral only for the door status light.
const SHIP_BLACK = 0x0a0c10;
const SHIP_WHITE = 0xe8f4ff;
const SHIP_CORAL = 0xff6f61;

const SHIP_SCALE = 1.25;

// 1 px transparent GIF, stands in for the FBX's missing textures.
const EMPTY_IMAGE =
    'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// Door: opens on approach, E toggles within key range.
const DOOR_OPEN_DISTANCE = 10;
const DOOR_KEY_DISTANCE = 30;
const DOOR_OPEN_SECONDS = 0.6;
const DOOR_CLOSED_COLOR = new THREE.Color(SHIP_CORAL);
const DOOR_OPEN_COLOR = new THREE.Color(SHIP_WHITE);

export class Level3 {

    constructor(renderer = null) {

        // =====================================================
        // SCENE
        // =====================================================

        this.scene = new THREE.Scene();

        // Almost pure black outer space.
        this.scene.background =
            new THREE.Color(0x010204);

        // No atmospheric fog.
        // The Moon has no atmosphere.
        this.scene.fog = null;


        // =====================================================
        // INTERIOR IMAGE-BASED LIGHTING
        // =====================================================
        //
        // Parts of the corridor use metallic PBR materials
        // that render pure black without an environment
        // map. A small neutral PMREM room is generated once
        // here and attached ONLY to the corridor's materials
        // further below, so the lunar surface keeps its hard
        // sunlight-only look.

        this.pmremGenerator = null;

        this.envTexture = null;

        if (renderer) {

            this.pmremGenerator =
                new THREE.PMREMGenerator(
                    renderer
                );

            this.envTexture =
                this.pmremGenerator
                    .fromScene(
                        new RoomEnvironment(),
                        0.04
                    )
                    .texture;
        }


        this.level =
            new THREE.Group();

        this.scene.add(
            this.level
        );

        // Environment references.
        this.rocks = [];
        this.stars = null;
        this.sky = null;
        this.moonSurface = null;
        this.regolithParticles = null;
        this.earth = null;
        this.earthLight = null;

        // GENESIS branding references.
        this.logoCanvas = null;
        this.logoTexture = null;
        this.flagTexture = null;
        this.flagCloth = null;
        this.flagClothBase = null;
        this.flagTime = 0;

        // Landing path reference.
        this.pathGroup = null;

        // =====================================================
        // BUILD MOON ENVIRONMENT
        // =====================================================

        this.createLighting();

        this.createMoonSurface();

        this.createDistantLunarTerrain();


        this.createStars();

        this.createEarth();


        this.createSpaceship();

        this.createFlag();

        this.createPath();
    }


    // =========================================================
    // LIGHTING
    // =========================================================

    createLighting() {

        // -----------------------------------------------------
        // HARD SUNLIGHT
        // -----------------------------------------------------
        //
        // The Moon receives extremely hard direct sunlight.
        // This produces the strong shadows visible in the
        // reference image.

        const sun =
            new THREE.DirectionalLight(
                0xffffff,
                4.2
            );

        sun.position.set(
            120,
            150,
            80
        );

        sun.castShadow = true;

        sun.shadow.mapSize.width =
            4096;

        sun.shadow.mapSize.height =
            4096;

        sun.shadow.camera.left =
            -180;

        sun.shadow.camera.right =
            180;

        sun.shadow.camera.top =
            180;

        sun.shadow.camera.bottom =
            -180;

        sun.shadow.camera.near =
            1;

        sun.shadow.camera.far =
            500;

        sun.shadow.bias =
            -0.0002;

        this.level.add(
            sun
        );

        this.sun = sun;


        // -----------------------------------------------------
        // VERY LOW FILL LIGHT
        // -----------------------------------------------------
        //
        // Keeps completely shadowed areas visible without
        // destroying the high-contrast lunar appearance.

        const fill =
            new THREE.HemisphereLight(
                0x20252c,
                0x08090b,
                0.22
            );

        this.level.add(
            fill
        );
    }


    // =========================================================
    // REALISTIC LUNAR SURFACE
    // =========================================================

    
createMoonSurface() {

    const size = 700;

    // More geometry gives the terrain enough resolution
    // for smoother crater walls and natural surface breakup.
    const segments = 300;

    const geometry =
        new THREE.PlaneGeometry(
            size,
            size,
            segments,
            segments
        );

    const positions =
        geometry.attributes.position;


    // =====================================================
    // DETERMINISTIC NOISE
    // =====================================================

    function hash(x, y) {

        const value =
            Math.sin(
                x * 127.1 +
                y * 311.7
            ) *
            43758.5453123;

        return (
            value -
            Math.floor(value)
        );
    }


    function noise(x, y) {

        const ix =
            Math.floor(x);

        const iy =
            Math.floor(y);

        const fx =
            x - ix;

        const fy =
            y - iy;


        const a =
            hash(ix, iy);

        const b =
            hash(ix + 1, iy);

        const c =
            hash(ix, iy + 1);

        const d =
            hash(ix + 1, iy + 1);


        const ux =
            fx * fx *
            (3 - 2 * fx);

        const uy =
            fy * fy *
            (3 - 2 * fy);


        return (
            a * (1 - ux) * (1 - uy) +
            b * ux * (1 - uy) +
            c * (1 - ux) * uy +
            d * ux * uy
        );
    }


    function fbm(x, y) {

        let value = 0;

        let amplitude = 0.5;

        let frequency = 1.0;


        for (
            let i = 0;
            i < 6;
            i++
        ) {

            value +=
                noise(
                    x * frequency,
                    y * frequency
                ) *
                amplitude;

            frequency *= 2.0;

            amplitude *= 0.5;
        }


        return value;
    }


    // =====================================================
    // LARGE LUNAR CRATERS
    // =====================================================
    //
    // Larger and more irregular than the previous version.
    // The different sizes help prevent the terrain from
    // looking like repeated procedural circles.

    const craters = [

        {
            x: -125,
            z: -65,
            radius: 31,
            depth: 4.8
        },

        {
            x: 115,
            z: -95,
            radius: 37,
            depth: 5.5
        },

        {
            x: 80,
            z: 40,
            radius: 23,
            depth: 3.8
        },

        {
            x: -155,
            z: 75,
            radius: 21,
            depth: 3.4
        },

        {
            x: 160,
            z: 105,
            radius: 28,
            depth: 4.2
        },

        {
            x: -35,
            z: -145,
            radius: 21,
            depth: 3.5
        },

        {
            x: 15,
            z: 125,
            radius: 15,
            depth: 2.5
        },

        {
            x: -205,
            z: -110,
            radius: 13,
            depth: 2.2
        },

        {
            x: 205,
            z: -10,
            radius: 17,
            depth: 2.8
        },

        {
            x: -85,
            z: 145,
            radius: 12,
            depth: 2.0
        },

        {
            x: 145,
            z: 155,
            radius: 10,
            depth: 1.7
        }
    ];


    // =====================================================
    // TERRAIN
    // =====================================================

    for (
        let i = 0;
        i < positions.count;
        i++
    ) {

        const x =
            positions.getX(i);

        const z =
            positions.getY(i);


        // -------------------------------------------------
        // BROAD LUNAR TOPOGRAPHY
        // -------------------------------------------------

        const broad =
            (
                fbm(
                    x * 0.006,
                    z * 0.006
                ) -
                0.5
            ) *
            7.0;


        // -------------------------------------------------
        // MEDIUM REGOLITH
        // -------------------------------------------------

        const medium =
            (
                fbm(
                    x * 0.018,
                    z * 0.018
                ) -
                0.5
            ) *
            3.2;


        // -------------------------------------------------
        // SMALL ROCKY TERRAIN
        // -------------------------------------------------

        const fine =
            (
                fbm(
                    x * 0.075,
                    z * 0.075
                ) -
                0.5
            ) *
            0.95;


        // -------------------------------------------------
        // VERY FINE REGOLITH
        // -------------------------------------------------

        const micro =
            (
                noise(
                    x * 0.38,
                    z * 0.38
                ) -
                0.5
            ) *
            0.22;


        let height =
            broad +
            medium +
            fine +
            micro;


        // =================================================
        // CRATER FORMATION
        // =================================================

        for (
            const crater of craters
        ) {

            const dx =
                x -
                crater.x;

            const dz =
                z -
                crater.z;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );


            if (
                distance <
                crater.radius
            ) {

                const normalized =
                    distance /
                    crater.radius;


                // -----------------------------------------
                // MAIN BOWL
                // -----------------------------------------

                const bowl =
                    Math.pow(
                        1.0 -
                        normalized,
                        2.2
                    );


                height -=
                    crater.depth *
                    bowl;


                // -----------------------------------------
                // RAISED CRATER RIM
                // -----------------------------------------

                const rimStart =
                    0.68;

                if (
                    normalized >
                    rimStart
                ) {

                    const rimT =
                        (
                            normalized -
                            rimStart
                        ) /
                        (
                            1.0 -
                            rimStart
                        );


                    const rim =
                        Math.sin(
                            rimT *
                            Math.PI
                        );


                    height +=
                        crater.depth *
                        0.32 *
                        rim;
                }


                // -----------------------------------------
                // IRREGULAR CRATER FLOOR
                // -----------------------------------------
                //
                // Prevents the crater from looking like a
                // mathematically perfect bowl.

                const floorNoise =
                    (
                        noise(
                            x * 0.12,
                            z * 0.12
                        ) -
                        0.5
                    ) *
                    0.8 *
                    (
                        1.0 -
                        normalized
                    );


                height +=
                    floorNoise;
            }
        }


        // =================================================
        // SECONDARY SMALL IMPACTS
        // =================================================
        //
        // Small deterministic depressions scattered around
        // the surface.

        const secondary =
            noise(
                x * 0.055 + 17.0,
                z * 0.055 + 41.0
            );


        if (
            secondary > 0.82
        ) {

            const impact =
                (
                    secondary -
                    0.82
                ) *
                4.0;


            height -=
                impact *
                0.35;
        }


        // =================================================
        // KEEP THE PLAYABLE AREA RELATIVELY STABLE
        // =================================================

        height *= 0.62;


        positions.setZ(
            i,
            height
        );
    }


    positions.needsUpdate = true;

    geometry.computeVertexNormals();


    // =====================================================
    // LUNAR MATERIAL
    // =====================================================
    //
    // moon.js shader with moon.jpg, lit by the scene's sun and
    // fill light and receiving the sun's shadows.

    const moonTexture =
        new THREE.TextureLoader().load(
            './assets/textures/moon.jpg'
        );

    moonTexture.colorSpace =
        THREE.SRGBColorSpace;

    // Mirrored so tiles meet without seams
    moonTexture.wrapS =
        THREE.MirroredRepeatWrapping;

    moonTexture.wrapT =
        THREE.MirroredRepeatWrapping;

    moonTexture.anisotropy = 8;

    const material =
    new THREE.ShaderMaterial({
        vertexShader: moonVertexShader,
        fragmentShader: moonFragmentShader,

        uniforms:
            THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                {
                    uMoonTexture: {
                        value: null
                    },

                    // World size of one tile for the two
                    // texture layers (38 m and 97 m)
                    uTileSizes: {
                        value: new THREE.Vector2(38, 97)
                    }
                }
            ]),

        lights: true,

        side: THREE.FrontSide,

        depthWrite: true,
        depthTest: true
    });

    // Set after merge() - merge() clones textures
    material.uniforms.uMoonTexture.value =
        moonTexture;


    const moon =
        new THREE.Mesh(
            geometry,
            material
        );


    moon.rotation.x =
        -Math.PI / 2;


    moon.position.y =
        -2;


    moon.receiveShadow = true;

    moon.castShadow = true;


    moon.name =
        'RealisticLunarRegolith';


    this.level.add(
        moon
    );


    this.moonSurface =
        moon;


    // =====================================================
    // REGOLITH PARTICLES
    // =====================================================
    //
    // IMPORTANT:
    // These now sit close to the actual terrain instead of
    // floating at one completely flat height.

    const particleCount = 4500;

    const particlePositions =
        new Float32Array(
            particleCount * 3
        );


    for (
        let i = 0;
        i < particleCount;
        i++
    ) {

        const x =
            (
                Math.random() -
                0.5
            ) *
            620;


        const z =
            (
                Math.random() -
                0.5
            ) *
            620;


        // Approximate local terrain height.
        const terrain =
            (
                fbm(
                    x * 0.006,
                    z * 0.006
                ) -
                0.5
            ) *
            7.0

            +

            (
                fbm(
                    x * 0.018,
                    z * 0.018
                ) -
                0.5
            ) *
            3.2

            +

            (
                fbm(
                    x * 0.075,
                    z * 0.075
                ) -
                0.5
            ) *
            0.95;


        particlePositions[
            i * 3
        ] = x;


        particlePositions[
            i * 3 + 1
        ] =
            terrain *
            0.62 -
            1.88 +
            Math.random() * 0.08;


        particlePositions[
            i * 3 + 2
        ] = z;
    }


    const particleGeometry =
        new THREE.BufferGeometry();


    particleGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
            particlePositions,
            3
        )
    );


    const particleMaterial =
        new THREE.PointsMaterial({

            color: 0x555555,

            size: 0.14,

            transparent: true,

            opacity: 0.32,

            sizeAttenuation: true
        });


    const regolithParticles =
        new THREE.Points(
            particleGeometry,
            particleMaterial
        );


    this.level.add(
        regolithParticles
    );


    this.regolithParticles =
        regolithParticles;
}
    // =========================================================
    // DISTANT LUNAR HORIZON
    // =========================================================

    createDistantLunarTerrain() {

        // Same moon.js material as the ground, so the ridge has
        // the same moon.jpg texture, lighting and shadows.
        // Plain grey only if the ground wasn't built first.
        const material =
            this.moonSurface
                ? this.moonSurface.material
                : new THREE.MeshStandardMaterial({

                    color: 0x777777,

                    roughness: 1.0,

                    metalness: 0.0
                });


        // One long irregular lunar ridge instead of artificial
        // cone-shaped mountains.

        const segments = 80;


        const geometry =
            new THREE.PlaneGeometry(
                760,
                90,
                segments,
                10
            );


        const positions =
            geometry.attributes.position;


        for (
            let i = 0;
            i < positions.count;
            i++
        ) {

            const x =
                positions.getX(i);

            const z =
                positions.getY(i);


            // Low, irregular lunar horizon.
            const ridge =
                Math.sin(
                    x * 0.025
                ) *
                10

                +

                Math.sin(
                    x * 0.061
                ) *
                5

                +

                Math.sin(
                    x * 0.11
                ) *
                2;


            const depth =
                (
                    z + 45
                ) /
                90;


            positions.setZ(
                i,
                ridge *
                depth
            );
        }


        positions.needsUpdate =
            true;

        geometry.computeVertexNormals();


        const ridge =
            new THREE.Mesh(
                geometry,
                material
            );


        ridge.rotation.x =
            -Math.PI / 2.5;


        ridge.position.set(
            -175,
            -1.5,
            -20
        );


        ridge.scale.y =
            1.2;


        ridge.receiveShadow =
            true;

        ridge.castShadow =
            true;


        this.level.add(
            ridge
        );


        this.distantTerrain =
            ridge;
    }



    // =========================================================
    // BLACK SKY / SPARSE STARS
    // =========================================================

    createStars() {

        // Stars wrap the whole battlefield: every look
        // direction finds them, instead of one band
        // swung toward the spawn view. The sky still
        // reads as mostly empty.
        const count = 2800;


        // The shell rides beyond the distant Earth and
        // the horizon ridge, and inside the camera far
        // plane, because the render loop recentres it
        // on the camera every frame (level.sky in
        // main.js).
        const radius = 750;


        const positions =
            new Float32Array(
                count * 3
            );


        for (
            let i = 0;
            i < count;
            i++
        ) {

            // Uniform spread over the full sphere: a
            // random height on the Y axis plus a random
            // angle around it.
            const y =
                Math.random() *
                2 -
                1;


            const theta =
                Math.random() *
                Math.PI *
                2;


            const ringRadius =
                Math.sqrt(
                    1 -
                    y * y
                );


            positions[
                i * 3
            ] =
                Math.cos(theta) *
                ringRadius *
                radius;


            positions[
                i * 3 + 1
            ] =
                y *
                radius;


            positions[
                i * 3 + 2
            ] =
                Math.sin(theta) *
                ringRadius *
                radius;
        }


        const geometry =
            new THREE.BufferGeometry();


        geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(
                positions,
                3
            )
        );


        const material =
            new THREE.PointsMaterial({

                color: 0xffffff,

                // Same apparent dot size the old nearby
                // band had, now that every star sits at
                // the full shell distance.
                size: 1.0,

                sizeAttenuation: true,

                transparent: true,

                opacity: 0.75
            });


        this.stars =
            new THREE.Points(
                geometry,
                material
            );


        // Exposing the shell as level.sky makes the
        // render loop pin it to the camera, so the
        // stars surround the player wherever they walk
        // - no parallax, no far-plane clipping.
        this.sky =
            this.stars;


        this.level.add(
            this.stars
        );
    }


    // =========================================================
    // SMALL DISTANT EARTH
    // =========================================================

    createEarth() {

        // Earth is deliberately very small.
        // It should never compete with the lunar battlefield.

        const earth =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    7,
                    32,
                    32
                ),

                new THREE.MeshStandardMaterial({

                    color: 0x4d6878,

                    roughness: 0.8,

                    metalness: 0.0,

                    emissive: 0x101820,

                    emissiveIntensity: 0.35
                })
            );


        // Place Earth high and very far away.
        earth.position.set(
            -260,
            105,
            -40
        );


        earth.name =
            'DistantEarth';


        this.level.add(
            earth
        );


        this.earth =
            earth;


        // Extremely subtle illumination.
        const rim =
            new THREE.PointLight(
                0xbfdfff,
                3.0,
                80
            );


        rim.position.copy(
            earth.position
        );


        rim.position.add(
            new THREE.Vector3(
                -5,
                5,
                10
            )
        );


        this.level.add(
            rim
        );


        this.earthLight =
            rim;
    }

    createSpaceship() {

        // =====================================================
        // GENESIS SPACESHIP + CORRIDOR
        // =====================================================
        //
        // Both models load asynchronously into one group.
        // Once BOTH are in, finishSpaceship() scales the
        // group, seats it on the regolith and adds the detail
        // pass and the corridor door, since those need the
        // final world-space shapes.

        const spaceship = new THREE.Group();

        spaceship.name = 'GenesisSpaceship';

        this.spaceship = spaceship;

        this.level.add(spaceship);

        this.shipExterior = null;
        this.shipCorridor = null;
        this.shipFinished = false;
        this.shipBlinkers = null;
        this.shipTime = 0;
        this.door = null;

        // One material set shared by the hull, the corridor
        // and every detail part.
        const materials =
            this.createShipMaterials();

        this.shipMaterials = materials;


        // E toggles the corridor door when close enough.
        this.onShipKeyDown = (event) => {

            const door = this.door;

            if (
                event.code !== 'KeyE' ||
                !door ||
                !door.inRange
            ) {
                return;
            }

            door.forced =
                !(door.forced ?? door.near);
        };

        window.addEventListener(
            'keydown',
            this.onShipKeyDown
        );


        // =====================================================
        // LOAD EXTERIOR FBX
        // =====================================================

        // Spaceship.fbx still references four Maya textures
        // (Spaceship 3 front / back / bridge / bridge holder.jpg)
        // that were never exported. Its materials are replaced
        // below anyway, so those requests get a 1 px placeholder
        // instead of failing.

        const fbxManager = new THREE.LoadingManager();

        fbxManager.setURLModifier((url) =>
            /\.jpe?g$/i.test(url)
                ? EMPTY_IMAGE
                : url
        );

        const fbxLoader = new FBXLoader(fbxManager);

        fbxLoader.load(
            './assets/models/Spaceship.fbx',

            (fbx) => {

                const exterior = fbx;

                exterior.name = 'SpaceshipExterior';

                // Authored in meters (hull roughly
                // 52 x 20 x 68), the group scale in
                // finishSpaceship() makes it bigger.
                exterior.scale.set(1, 1, 1);


                // Re-center the hull on the ship group. The
                // final height is set by seatHullOnTerrain().

                exterior.updateMatrixWorld(true);

                const hullBox =
                    new THREE.Box3().setFromObject(exterior);

                const hullCenter =
                    hullBox.getCenter(
                        new THREE.Vector3()
                    );

                exterior.position.set(
                    -hullCenter.x + 20,
                    -hullBox.min.y - 5,
                    -hullCenter.z + 15
                );

                exterior.rotation.set(0, 0, 0);


                // The FBX carries its own Maya lights, one of them
                // an invisible (intensity 0) shadow-casting point
                // light that re-rendered the scene into a 6-face
                // shadow cube every frame. Level 3 lights the
                // ship itself, so all embedded lights are removed.

                const embeddedLights = [];

                exterior.traverse((object) => {

                    if (object.isLight) {
                        embeddedLights.push(object);
                    }
                });

                embeddedLights.forEach((light) => {

                    light.removeFromParent();

                    light.dispose();
                });


                // The source FBX renders nearly black, so
                // every mesh takes the shared cool white
                // hull; the cylinders (engine / thruster
                // parts) take the dark metal instead.

                exterior.traverse((object) => {

                    if (!object.isMesh) {
                        return;
                    }

                    object.castShadow = true;
                    object.receiveShadow = true;

                    const old =
                        Array.isArray(object.material)
                            ? object.material
                            : [object.material];

                    old.forEach((material) => {
                        material.dispose();
                    });

                    object.material =
                        object.name.startsWith('pCylinder')
                            ? materials.darkMetal
                            : materials.hullWhite;
                });

                spaceship.add(exterior);

                this.shipExterior = exterior;

                console.log(
                    'GENESIS: Spaceship FBX loaded.'
                );

                this.finishSpaceship();
            },

            undefined,

            (error) => {

                console.error(
                    'GENESIS: Could not load Spaceship.fbx',
                    error
                );
            }
        );


        // =====================================================
        // LOAD INTERIOR CORRIDOR
        // =====================================================

        // Authored corridor material -> shared ship material.
        // Wall_blue was the cyan light strip, now cool white.
        const corridorMaterials = {
            Wall_Black: materials.darkMetal,
            lambert1: materials.hullMatte,
            Wall_Roof_White: materials.hullWhite,
            Wall_blue: materials.glow,
            Floor_and_vent: materials.darkMatte,
            Floor_vent: materials.darkMetal,
            Vent_light: materials.glow
        };

        const gltfLoader = new GLTFLoader();

        gltfLoader.load(
            './assets/models/space_ship_hallway.glb',

            (gltf) => {

                const corridor = gltf.scene;

                corridor.name = 'SpaceshipCorridor';

                corridor.scale.set(1, 2, 1.5);

                corridor.position.set(0, 0, 45);

                corridor.rotation.set(0, 0, 0);


                corridor.traverse((object) => {

                    if (!object.isMesh) {
                        return;
                    }

                    object.castShadow = true;
                    object.receiveShadow = true;

                    this.cutCorridorEndWall(
                        object.geometry
                    );

                    const shared =
                        corridorMaterials[
                            object.material.name
                        ];

                    if (shared) {

                        object.material.dispose();

                        object.material = shared;

                        return;
                    }

                    // Glass keeps its own transparent
                    // material, tinted cool white.
                    object.material.color.set(SHIP_WHITE);

                    if (this.envTexture) {

                        object.material.envMap =
                            this.envTexture;

                        object.material.envMapIntensity =
                            0.5;

                        object.material.needsUpdate =
                            true;
                    }
                });

                spaceship.add(corridor);

                this.shipCorridor = corridor;

                console.log(
                    'GENESIS: Spaceship corridor loaded.'
                );

                this.finishSpaceship();
            },

            undefined,

            (error) => {

                console.error(
                    'GENESIS: Could not load space_ship_hallway.glb',
                    error
                );
            }
        );


        // =====================================================
        // WHOLE SHIP POSITION + ROTATION
        // =====================================================

        spaceship.position.set(0, 0, 5);

        spaceship.rotation.set(0, 0, 0);
    }


    // =========================================================
    // CORRIDOR END WALL CUT
    // =========================================================
    //
    // The corridor model ends at +Z in a solid wall with a
    // painted-on door. Triangles of that wall inside the
    // side walls, floor and ceiling are dropped so the
    // sliding door in createCorridorDoor() can fill the
    // hole; the model's white frame ring stays around it.
    // Corridor-local units (end wall: z 2.9 - 3.58).

    cutCorridorEndWall(geometry) {

        const index = geometry.index;

        if (!index) {
            return;
        }

        const position =
            geometry.attributes.position;

        const kept = [];

        for (let i = 0; i < index.count; i += 3) {

            let inEndWall = true;

            let x = 0;
            let y = 0;

            for (let k = 0; k < 3; k++) {

                const vertex =
                    index.getX(i + k);

                if (position.getZ(vertex) <= 2.9) {
                    inEndWall = false;
                }

                x += position.getX(vertex) / 3;
                y += position.getY(vertex) / 3;
            }

            const inDoorway =
                inEndWall &&
                x > 16.37 && x < 23.87 &&
                y > -2.9 && y < 2.95;

            if (!inDoorway) {

                kept.push(
                    index.getX(i),
                    index.getX(i + 1),
                    index.getX(i + 2)
                );
            }
        }

        geometry.setIndex(kept);
    }


    // =========================================================
    // SHARED SHIP MATERIALS
    // =========================================================
    //
    // Two body colours only. Variety comes from roughness and
    // metalness; lights are cool white, and coral is kept for
    // the door status light. Only the metals get a real share
    // of the room environment (they render pure black
    // without one), so the sunlit hull keeps its hard look.

    createShipMaterials() {

        const envMap =
            this.envTexture;

        return {

            // Main hull skin, corridor walls and roof.
            hullWhite: new THREE.MeshStandardMaterial({
                color: SHIP_WHITE,
                roughness: 0.55,
                metalness: 0.05,
                envMap,
                envMapIntensity: 0.2,
                side: THREE.DoubleSide
            }),

            // Hatches, door frame, inset panels.
            hullMatte: new THREE.MeshStandardMaterial({
                color: SHIP_WHITE,
                roughness: 0.9,
                metalness: 0.0,
                envMap,
                envMapIntensity: 0.2,
                side: THREE.DoubleSide
            }),

            // Trims, vents, engines, bulkhead, floor.
            darkMetal: new THREE.MeshStandardMaterial({
                color: SHIP_BLACK,
                roughness: 0.35,
                metalness: 0.8,
                envMap,
                envMapIntensity: 0.6,
                side: THREE.DoubleSide
            }),

            // Panel lines, vent slats, door grooves.
            darkMatte: new THREE.MeshStandardMaterial({
                color: SHIP_BLACK,
                roughness: 0.85,
                metalness: 0.1,
                envMap,
                envMapIntensity: 0.2,
                side: THREE.DoubleSide
            }),

            // Every light and light strip.
            glow: new THREE.MeshBasicMaterial({
                color: SHIP_WHITE,
                side: THREE.DoubleSide
            }),

            // Door status light, coral -> cool white.
            status: new THREE.MeshBasicMaterial({
                color: SHIP_CORAL
            })
        };
    }


    // =========================================================
    // FINISH SPACESHIP
    // =========================================================
    //
    // Runs once both models are loaded.

    finishSpaceship() {

        if (
            !this.shipExterior ||
            !this.shipCorridor ||
            this.shipFinished
        ) {
            return;
        }

        this.shipFinished = true;

        const spaceship = this.spaceship;

        const corridor = this.shipCorridor;


        // -----------------------------------------------------
        // SCALE AROUND THE CORRIDOR MOUTH
        // -----------------------------------------------------
        //
        // The corridor mouth (local x 20.1, z 3.58) stays
        // where the landing path ends; the ship grows back
        // and to the sides. Rotation is zero, so the ship
        // group maps local -> world as position + scale.

        const mouth =
            new THREE.Vector3(20.1, 0, 3.58)
                .multiply(corridor.scale)
                .add(corridor.position);

        const pivot =
            mouth.clone().add(spaceship.position);

        spaceship.scale.setScalar(SHIP_SCALE);

        spaceship.position.x =
            pivot.x - SHIP_SCALE * mouth.x;

        spaceship.position.z =
            pivot.z - SHIP_SCALE * mouth.z;


        // -----------------------------------------------------
        // CORRIDOR FLOOR AT GROUND LEVEL
        // -----------------------------------------------------
        //
        // The corridor floor is found by casting down from
        // mid-height a few meters inside the mouth, then the
        // whole ship is lifted so that floor meets the
        // regolith just outside the door.

        spaceship.position.y = 0;

        spaceship.updateMatrixWorld(true);

        const raycaster = new THREE.Raycaster();

        raycaster.set(
            spaceship.localToWorld(
                new THREE.Vector3(20.1, 0, mouth.z - 3)
            ),
            new THREE.Vector3(0, -1, 0)
        );

        const floorHit =
            raycaster
                .intersectObject(corridor, true)
                .find((hit) =>
                    !hit.object.material.transparent
                );

        const floorWorldY =
            floorHit
                ? floorHit.point.y
                : SHIP_SCALE * -6;

        const ground =
            this.getSurfaceHeight(
                pivot.x,
                pivot.z + 2
            );

        spaceship.position.y =
            ground - floorWorldY;

        spaceship.updateMatrixWorld(true);

        // Floor height in ship-local space, for the door.
        this.shipFloorY =
            spaceship.worldToLocal(
                new THREE.Vector3(0, ground, 0)
            ).y;


        this.seatHullOnTerrain();

        this.createShipDetails();

        this.createCorridorDoor(mouth.z);
    }


    // =========================================================
    // SEAT HULL ON TERRAIN
    // =========================================================
    //
    // Casts up at the belly across the hull footprint and
    // compares each hit with the regolith below it. The hull
    // moves so its lowest contact sinks 0.3 m into the
    // ground: nothing floats, nothing is buried deep.

    seatHullOnTerrain() {

        const exterior = this.shipExterior;

        const box =
            new THREE.Box3().setFromObject(exterior);

        const raycaster = new THREE.Raycaster();

        const up = new THREE.Vector3(0, 1, 0);

        const origin = new THREE.Vector3();

        const steps = 10;

        let lowestGap = Infinity;

        for (let i = 0; i <= steps; i++) {

            for (let j = 0; j <= steps; j++) {

                origin.set(
                    THREE.MathUtils.lerp(
                        box.min.x,
                        box.max.x,
                        i / steps
                    ),
                    box.min.y - 5,
                    THREE.MathUtils.lerp(
                        box.min.z,
                        box.max.z,
                        j / steps
                    )
                );

                raycaster.set(origin, up);

                const hit =
                    raycaster.intersectObject(
                        exterior,
                        true
                    )[0];

                if (!hit) {
                    continue;
                }

                const gap =
                    hit.point.y -
                    this.getSurfaceHeight(
                        origin.x,
                        origin.z
                    );

                lowestGap =
                    Math.min(lowestGap, gap);
            }
        }

        if (lowestGap === Infinity) {
            return;
        }

        // Local units: the ship group is scaled.
        exterior.position.y -=
            (lowestGap + 0.3) / SHIP_SCALE;

        exterior.updateMatrixWorld(true);
    }


    // =========================================================
    // SHIP DETAILS
    // =========================================================
    //
    // Panel seams, vents, hatches, running lights and
    // antennas. The hull is a single imported shape with
    // generic mesh names, so every part is placed by casting
    // rays at the real surface and lying flat against it.
    // Parts are built in world space, batched into six
    // InstancedMeshes (one per geometry + material) and then
    // attached to the ship group.

    createShipDetails() {

        const exterior = this.shipExterior;

        const materials = this.shipMaterials;

        const box =
            new THREE.Box3().setFromObject(exterior);

        const center =
            box.getCenter(new THREE.Vector3());

        const size =
            box.getSize(new THREE.Vector3());

        const reach =
            size.length();

        const raycaster = new THREE.Raycaster();


        // Surface hit with a world normal facing the ray.
        const hitHull = (origin, direction) => {

            raycaster.set(origin, direction);

            const hit =
                raycaster.intersectObject(
                    exterior,
                    true
                )[0];

            if (!hit || !hit.face) {
                return null;
            }

            const normal =
                hit.face.normal
                    .clone()
                    .transformDirection(
                        hit.object.matrixWorld
                    );

            if (normal.dot(direction) > 0) {
                normal.negate();
            }

            return {
                point: hit.point,
                normal
            };
        };


        // Matrix lists, one per InstancedMesh.
        const parts = {
            darkMatte: [],
            darkMetal: [],
            hullMatte: [],
            glow: [],
            mast: [],
            tip: []
        };

        const basis = new THREE.Matrix4();

        // Box lying on the surface: local Y = normal, local X
        // = tangent. offset is in that local frame (meters).
        const place = (
            list,
            surface,
            tangent,
            dimensions,
            offset = new THREE.Vector3()
        ) => {

            const y = surface.normal;

            const x =
                tangent
                    .clone()
                    .addScaledVector(y, -tangent.dot(y));

            if (x.lengthSq() < 1e-6) {
                x.set(1, 0, 0)
                    .addScaledVector(y, -y.x);
            }

            x.normalize();

            const z =
                new THREE.Vector3()
                    .crossVectors(x, y);

            basis.makeBasis(x, y, z);

            const position =
                surface.point
                    .clone()
                    .addScaledVector(x, offset.x)
                    .addScaledVector(y, offset.y)
                    .addScaledVector(z, offset.z);

            list.push(
                basis
                    .clone()
                    .scale(dimensions)
                    .setPosition(position)
            );
        };

        const alongZ = new THREE.Vector3(0, 0, 1);

        const alongX = new THREE.Vector3(1, 0, 0);

        const down = new THREE.Vector3(0, -1, 0);


        // -----------------------------------------------------
        // PANEL SEAM RINGS
        // -----------------------------------------------------
        //
        // Rays fan around the hull at a few stations along
        // its length; neighbouring hits are joined by a thin
        // dark strip. Big jumps (wing edges, gaps) are
        // skipped, so the seams only follow smooth skin.

        const ringSteps = 48;

        [0.18, 0.34, 0.5, 0.66, 0.82].forEach(
            (fraction) => {

                const z =
                    THREE.MathUtils.lerp(
                        box.min.z,
                        box.max.z,
                        fraction
                    );

                const hits = [];

                for (let i = 0; i < ringSteps; i++) {

                    const angle =
                        (i / ringSteps) * Math.PI * 2;

                    const direction =
                        new THREE.Vector3(
                            -Math.cos(angle),
                            -Math.sin(angle),
                            0
                        );

                    hits.push(
                        hitHull(
                            new THREE.Vector3(
                                center.x,
                                center.y,
                                z
                            ).addScaledVector(
                                direction,
                                -reach
                            ),
                            direction
                        )
                    );
                }

                for (let i = 0; i < ringSteps; i++) {

                    const a = hits[i];

                    const b =
                        hits[(i + 1) % ringSteps];

                    if (!a || !b) {
                        continue;
                    }

                    const chord =
                        b.point.clone().sub(a.point);

                    const length =
                        chord.length();

                    if (
                        length < 0.05 ||
                        length > 4 ||
                        a.normal.dot(b.normal) < 0.6
                    ) {
                        continue;
                    }

                    place(
                        parts.darkMatte,
                        {
                            point: a.point
                                .clone()
                                .lerp(b.point, 0.5),
                            normal: a.normal
                                .clone()
                                .add(b.normal)
                                .normalize()
                        },
                        chord,
                        new THREE.Vector3(
                            length + 0.04,
                            0.1,
                            0.16
                        ),
                        new THREE.Vector3(0, 0.02, 0)
                    );
                }
            }
        );


        // -----------------------------------------------------
        // RUNNING LIGHTS
        // -----------------------------------------------------
        //
        // A row down each flank in a dark metal housing.

        const lightY =
            box.min.y + size.y * 0.3;

        for (let i = 1; i <= 9; i++) {

            const z =
                THREE.MathUtils.lerp(
                    box.min.z,
                    box.max.z,
                    i / 10
                );

            [-1, 1].forEach((side) => {

                const direction =
                    new THREE.Vector3(-side, 0, 0);

                const surface =
                    hitHull(
                        new THREE.Vector3(
                            center.x + side * reach,
                            lightY,
                            z
                        ),
                        direction
                    );

                if (!surface) {
                    return;
                }

                place(
                    parts.darkMetal,
                    surface,
                    alongZ,
                    new THREE.Vector3(0.9, 0.12, 0.5)
                );

                place(
                    parts.glow,
                    surface,
                    alongZ,
                    new THREE.Vector3(0.6, 0.1, 0.22),
                    new THREE.Vector3(0, 0.06, 0)
                );
            });
        }


        // -----------------------------------------------------
        // ROOF VENTS
        // -----------------------------------------------------
        //
        // Dark metal frame with five matte slats. Only
        // placed where the roof is close to flat.

        [0.3, 0.45, 0.6, 0.75].forEach((fraction) => {

            [-0.18, 0.18].forEach((across) => {

                const surface =
                    hitHull(
                        new THREE.Vector3(
                            center.x + size.x * across,
                            box.max.y + 5,
                            THREE.MathUtils.lerp(
                                box.min.z,
                                box.max.z,
                                fraction
                            )
                        ),
                        down
                    );

                if (
                    !surface ||
                    surface.normal.y < 0.75
                ) {
                    return;
                }

                place(
                    parts.darkMetal,
                    surface,
                    alongX,
                    new THREE.Vector3(2.6, 0.14, 1.6)
                );

                for (let s = -2; s <= 2; s++) {

                    place(
                        parts.darkMatte,
                        surface,
                        alongX,
                        new THREE.Vector3(0.22, 0.12, 1.3),
                        new THREE.Vector3(s * 0.46, 0.12, 0)
                    );
                }
            });
        });


        // -----------------------------------------------------
        // SIDE HATCHES
        // -----------------------------------------------------
        //
        // Matte white plate on a dark metal rim, with a small
        // dark handle.

        [0.28, 0.72].forEach((fraction) => {

            [-1, 1].forEach((side) => {

                const surface =
                    hitHull(
                        new THREE.Vector3(
                            center.x + side * reach,
                            box.min.y + size.y * 0.45,
                            THREE.MathUtils.lerp(
                                box.min.z,
                                box.max.z,
                                fraction
                            )
                        ),
                        new THREE.Vector3(-side, 0, 0)
                    );

                if (!surface) {
                    return;
                }

                place(
                    parts.darkMetal,
                    surface,
                    alongZ,
                    new THREE.Vector3(2.2, 0.08, 2.6)
                );

                place(
                    parts.hullMatte,
                    surface,
                    alongZ,
                    new THREE.Vector3(1.8, 0.1, 2.2),
                    new THREE.Vector3(0, 0.03, 0)
                );

                place(
                    parts.darkMetal,
                    surface,
                    alongZ,
                    new THREE.Vector3(0.7, 0.12, 0.14),
                    new THREE.Vector3(0, 0.1, -0.6)
                );
            });
        });


        // -----------------------------------------------------
        // ANTENNAS
        // -----------------------------------------------------
        //
        // Upright masts on the roof with blinking tips.

        const mastMatrix = new THREE.Matrix4();

        [
            { fraction: 0.38, across: 0.0, height: 5.5 },
            { fraction: 0.52, across: -0.08, height: 3.5 },
            { fraction: 0.52, across: 0.08, height: 4.2 }
        ].forEach((antenna) => {

            const surface =
                hitHull(
                    new THREE.Vector3(
                        center.x + size.x * antenna.across,
                        box.max.y + 5,
                        THREE.MathUtils.lerp(
                            box.min.z,
                            box.max.z,
                            antenna.fraction
                        )
                    ),
                    down
                );

            if (!surface) {
                return;
            }

            place(
                parts.darkMetal,
                surface,
                alongX,
                new THREE.Vector3(0.8, 0.3, 0.8)
            );

            const base = surface.point;

            parts.mast.push(
                mastMatrix
                    .clone()
                    .makeScale(1, antenna.height, 1)
                    .setPosition(
                        base.x,
                        base.y + antenna.height / 2,
                        base.z
                    )
            );

            parts.tip.push(
                mastMatrix
                    .clone()
                    .makeTranslation(
                        base.x,
                        base.y + antenna.height + 0.1,
                        base.z
                    )
            );
        });


        // -----------------------------------------------------
        // BUILD INSTANCED MESHES
        // -----------------------------------------------------

        const boxGeometry =
            new THREE.BoxGeometry(1, 1, 1);

        const batches = [
            [parts.darkMatte, boxGeometry, materials.darkMatte],
            [parts.darkMetal, boxGeometry, materials.darkMetal],
            [parts.hullMatte, boxGeometry, materials.hullMatte],
            [parts.glow, boxGeometry, materials.glow],
            [
                parts.mast,
                new THREE.CylinderGeometry(0.07, 0.12, 1, 6),
                materials.darkMetal
            ],
            [
                parts.tip,
                new THREE.SphereGeometry(0.22, 8, 6),
                materials.glow
            ]
        ];

        const details = new THREE.Group();

        details.name = 'SpaceshipDetails';

        this.level.add(details);

        let triangles = 0;

        batches.forEach(([matrices, geometry, material]) => {

            if (matrices.length === 0) {
                return;
            }

            const mesh =
                new THREE.InstancedMesh(
                    geometry,
                    material,
                    matrices.length
                );

            matrices.forEach((matrix, index) => {
                mesh.setMatrixAt(index, matrix);
            });

            mesh.instanceMatrix.needsUpdate = true;

            mesh.computeBoundingSphere();

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            details.add(mesh);

            triangles +=
                matrices.length *
                geometry.index.count / 3;

            if (geometry.type === 'SphereGeometry') {
                this.shipBlinkers = mesh;
            }
        });

        // Built in world space; attach() keeps the world
        // transform while parenting to the ship group.
        this.spaceship.attach(details);

        console.log(
            `GENESIS: Spaceship details added (${triangles} triangles).`
        );
    }


    // =========================================================
    // CORRIDOR DOOR
    // =========================================================
    //
    // A dark metal bulkhead seals the corridor mouth around
    // a sliding double door. The door opens automatically
    // when the camera comes close, and E toggles it. The
    // status light above the door and the door light go
    // coral when closed and cool white when open.
    //
    // Built in ship-local units (the group scale makes the
    // opening about 4.4 m wide and 6.9 m tall). The bulkhead
    // fills the hole cut by cutCorridorEndWall(): x 16.37 -
    // 23.87 between the side walls, up to the ceiling at
    // corridor y 3 (ship y 6).

    createCorridorDoor(mouthZ) {

        const materials = this.shipMaterials;

        const floor = this.shipFloorY;

        const door = new THREE.Group();

        door.name = 'SpaceshipDoor';

        this.spaceship.add(door);


        const centerX = 20.1;

        const openWidth = 3.5;

        const openHeight = 5.5;

        const top = 3 * this.shipCorridor.scale.y;

        const wallLeft = 16.37;

        const wallRight = 23.87;

        // Bulkhead front face, just inside the frame ring.
        const front = mouthZ - 0.15;

        const thickness = 0.3;

        const left = centerX - openWidth / 2;

        const right = centerX + openWidth / 2;

        const boxGeometry =
            new THREE.BoxGeometry(1, 1, 1);

        const addBox = (
            material,
            x1, x2,
            y1, y2,
            z,
            depth,
            parent = door
        ) => {

            const mesh =
                new THREE.Mesh(boxGeometry, material);

            mesh.scale.set(x2 - x1, y2 - y1, depth);

            mesh.position.set(
                (x1 + x2) / 2,
                (y1 + y2) / 2,
                z
            );

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            parent.add(mesh);

            return mesh;
        };


        // -----------------------------------------------------
        // BULKHEAD
        // -----------------------------------------------------

        const bulkZ = front - thickness / 2;

        addBox(materials.darkMetal, wallLeft, left, floor, top, bulkZ, thickness);
        addBox(materials.darkMetal, right, wallRight, floor, top, bulkZ, thickness);
        addBox(materials.darkMetal, left, right, floor + openHeight, top, bulkZ, thickness);

        // Horizontal panel seams across the bulkhead.
        [floor + 3, floor + openHeight + 1.6, top - 0.8].forEach((y) => {
            addBox(materials.darkMatte, wallLeft, left, y - 0.04, y + 0.04, front + 0.01, 0.04);
            addBox(materials.darkMatte, right, wallRight, y - 0.04, y + 0.04, front + 0.01, 0.04);
        });


        // -----------------------------------------------------
        // DOOR FRAME + LIGHT STRIPS
        // -----------------------------------------------------

        const frame = 0.28;

        const frameZ = front + 0.1;

        addBox(materials.hullMatte, left - frame, left, floor, floor + openHeight + frame, frameZ, 0.2);
        addBox(materials.hullMatte, right, right + frame, floor, floor + openHeight + frame, frameZ, 0.2);
        addBox(materials.hullMatte, left, right, floor + openHeight, floor + openHeight + frame, frameZ, 0.2);

        // Vertical strips flanking the frame, one over it.
        addBox(materials.glow, left - frame - 0.3, left - frame - 0.18, floor + 0.4, floor + openHeight - 0.4, front + 0.03, 0.06);
        addBox(materials.glow, right + frame + 0.18, right + frame + 0.3, floor + 0.4, floor + openHeight - 0.4, front + 0.03, 0.06);
        addBox(materials.glow, left, right, floor + openHeight + 0.5, floor + openHeight + 0.6, front + 0.03, 0.06);

        // Status light, coral closed / cool white open.
        addBox(materials.status, centerX - 0.35, centerX + 0.35, floor + openHeight + 0.85, floor + openHeight + 1.1, front + 0.05, 0.1);


        // -----------------------------------------------------
        // GENESIS EMBLEM
        // -----------------------------------------------------

        const emblem =
            this.createGenesisLogo(6, 3);

        emblem.position.set(
            centerX,
            floor + openHeight + 3.6,
            front + 0.04
        );

        door.add(emblem);


        // -----------------------------------------------------
        // SLIDING LEAVES
        // -----------------------------------------------------
        //
        // Two leaves just behind the bulkhead. Each slides
        // its own width sideways, which keeps it inside the
        // corridor walls.

        const leafWidth = openWidth / 2;

        const leafZ = bulkZ - thickness / 2 - 0.15;

        const leaves = [-1, 1].map((side) => {

            const leaf = new THREE.Group();

            leaf.position.set(
                centerX + side * leafWidth / 2,
                floor,
                leafZ
            );

            door.add(leaf);

            const half = leafWidth / 2;

            // Panel with a groove on the meeting edge and two
            // horizontal panel lines.
            addBox(materials.hullWhite, -half, half, 0, openHeight, 0, 0.2, leaf);

            const edge = -side * (half - 0.08);

            addBox(materials.darkMatte, edge - 0.04, edge + 0.04, 0.2, openHeight - 0.2, 0.11, 0.04, leaf);

            [openHeight / 3, openHeight * 2 / 3].forEach((y) => {
                addBox(materials.darkMatte, -half + 0.15, half - 0.15, y - 0.03, y + 0.03, 0.11, 0.04, leaf);
            });

            leaf.userData.closedX = leaf.position.x;

            leaf.userData.openX =
                leaf.position.x + side * leafWidth;

            return leaf;
        });


        // -----------------------------------------------------
        // DOOR LIGHT
        // -----------------------------------------------------

        const light =
            new THREE.PointLight(
                SHIP_CORAL,
                30,
                14,
                2
            );

        light.position.set(
            centerX,
            floor + openHeight + 1,
            front + 1.5
        );

        door.add(light);


        // -----------------------------------------------------
        // CAMERA TRACKING
        // -----------------------------------------------------
        //
        // update() only receives deltaTime, so the door picks
        // up the viewer camera from its own render call.
        // Shadow passes use the sun's orthographic camera,
        // hence the perspective check.

        const sensor = leaves[0].children[0];

        sensor.onBeforeRender = (renderer, scene, camera) => {

            if (camera.isPerspectiveCamera) {
                this.door.camera = camera;
            }
        };


        this.door = {
            leaves,
            light,
            camera: null,
            near: false,
            inRange: false,
            forced: null,
            progress: 0,
            center: this.spaceship.localToWorld(
                new THREE.Vector3(
                    centerX,
                    floor + openHeight / 2,
                    front
                )
            )
        };
    }


    // =========================================================
    // SPACESHIP UPDATE
    // =========================================================

    updateSpaceship(deltaTime) {

        this.shipTime += deltaTime;

        // Antenna tips flash briefly every 1.6 s.
        if (this.shipBlinkers) {

            this.shipBlinkers.visible =
                this.shipTime % 1.6 < 0.18;
        }


        const door = this.door;

        if (!door) {
            return;
        }

        if (door.camera) {

            const distance =
                door.camera.position.distanceTo(
                    door.center
                );

            const near =
                distance < DOOR_OPEN_DISTANCE;

            // Walking in or out of range hands control
            // back to the proximity sensor.
            if (near !== door.near) {

                door.near = near;

                door.forced = null;
            }

            door.inRange =
                distance < DOOR_KEY_DISTANCE;
        }

        const target =
            (door.forced ?? door.near) ? 1 : 0;

        const step =
            deltaTime / DOOR_OPEN_SECONDS;

        door.progress =
            target > door.progress
                ? Math.min(target, door.progress + step)
                : Math.max(target, door.progress - step);

        const eased =
            THREE.MathUtils.smoothstep(
                door.progress,
                0,
                1
            );

        door.leaves.forEach((leaf) => {

            leaf.position.x =
                THREE.MathUtils.lerp(
                    leaf.userData.closedX,
                    leaf.userData.openX,
                    eased
                );
        });

        this.shipMaterials.status.color.lerpColors(
            DOOR_CLOSED_COLOR,
            DOOR_OPEN_COLOR,
            eased
        );

        door.light.color.copy(
            this.shipMaterials.status.color
        );
    }

    // =========================================================
    // GENESIS LOGO
    // =========================================================

    // Draws the GENESIS "K" symbol: a stem built from two
    // vertical bars split by a negative-space gap, with two
    // diagonal bars overlapping the stem to form the arms.

    drawGenesisSymbol(ctx, centerX, centerY, height) {

        // The mark is designed on a 218 x 300 grid and
        // scaled to the requested height.

        const scale =
            height / 300;

        const barWidth =
            30 * scale;

        ctx.fillStyle = '#ffffff';


        // -------------------------------------------------
        // STEM: TWO VERTICAL BARS
        // -------------------------------------------------

        ctx.fillRect(
            centerX - 109 * scale,
            centerY - 150 * scale,
            barWidth,
            height
        );

        ctx.fillRect(
            centerX - 59 * scale,
            centerY - 150 * scale,
            barWidth,
            height
        );


        // -------------------------------------------------
        // UPPER ARM
        // -------------------------------------------------

        ctx.save();

        ctx.translate(
            centerX + 8.5 * scale,
            centerY - 68.5 * scale
        );

        ctx.rotate(
            -0.6981
        );

        ctx.fillRect(
            -114.3 * scale,
            -barWidth / 2,
            228.5 * scale,
            barWidth
        );

        ctx.restore();


        // -------------------------------------------------
        // LOWER ARM
        // -------------------------------------------------

        ctx.save();

        ctx.translate(
            centerX + 8.5 * scale,
            centerY + 68.5 * scale
        );

        ctx.rotate(
            0.6981
        );

        ctx.fillRect(
            -114.3 * scale,
            -barWidth / 2,
            228.5 * scale,
            barWidth
        );

        ctx.restore();
    }


    createGenesisLogoTexture() {

        // The emblem is drawn once onto a single canvas so
        // the corridor door sign and the hull marking share
        // the same artwork.

        if (this.logoTexture) {

            return this.logoTexture;
        }


        const canvas =
            document.createElement('canvas');

        canvas.width = 1024;

        canvas.height = 512;

        const ctx =
            canvas.getContext('2d');

        // Transparent background.
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        // -------------------------------------------------
        // GENESIS SYMBOL
        // -------------------------------------------------

        this.drawGenesisSymbol(
            ctx,
            220,
            256,
            300
        );


        // -------------------------------------------------
        // GENESIS TEXT
        // -------------------------------------------------

        ctx.fillStyle = '#ffffff';

        ctx.font = 'bold 96px Arial';

        ctx.textAlign = 'center';

        ctx.textBaseline = 'middle';

        ctx.letterSpacing = '8px';

        ctx.fillText(
            'GENESIS',
            670,
            256
        );


        // -------------------------------------------------
        // TEXTURE
        // -------------------------------------------------

        const texture =
            new THREE.CanvasTexture(canvas);

        texture.colorSpace =
            THREE.SRGBColorSpace;

        this.logoCanvas = canvas;

        this.logoTexture = texture;

        return texture;
    }


    createGenesisLogo(width = 5, height = 2.5) {

        const material =
            new THREE.MeshBasicMaterial({
                map: this.createGenesisLogoTexture(),
                transparent: true,
                side: THREE.DoubleSide
            });


        const geometry =
            new THREE.PlaneGeometry(
                width,
                height
            );


        const logo =
            new THREE.Mesh(
                geometry,
                material
            );


        return logo;
    }

    // =========================================================
    // ANIMATED GENESIS FLAG
    // =========================================================

    createFlag() {

        // -----------------------------------------------------
        // FLAG CLOTH TEXTURE
        // -----------------------------------------------------
        //
        // A black banner with the GENESIS symbol on top,
        // the name below it and the tagline at the bottom.

        const flagCanvas =
            document.createElement('canvas');

        flagCanvas.width = 512;

        flagCanvas.height = 640;

        const ctx =
            flagCanvas.getContext('2d');

        ctx.fillStyle = '#0a0d12';

        ctx.fillRect(
            0,
            0,
            512,
            640
        );


        // -------------------------------------------------
        // SYMBOL
        // -------------------------------------------------

        this.drawGenesisSymbol(
            ctx,
            256,
            220,
            240
        );


        // -------------------------------------------------
        // NAME
        // -------------------------------------------------

        ctx.fillStyle = '#ffffff';

        ctx.font = 'bold 60px Arial';

        ctx.textAlign = 'center';

        ctx.textBaseline = 'middle';

        ctx.letterSpacing = '6px';

        ctx.fillText(
            'GENESIS',
            256,
            425
        );


        // -------------------------------------------------
        // TAGLINE
        // -------------------------------------------------

        ctx.font = '26px Arial';

        ctx.letterSpacing = '4px';

        ctx.fillText(
            'THE FUTURE BEGINS HERE',
            256,
            515
        );


        const flagTexture =
            new THREE.CanvasTexture(flagCanvas);

        flagTexture.colorSpace =
            THREE.SRGBColorSpace;

        this.flagTexture = flagTexture;


        // -----------------------------------------------------
        // FLAG GROUP
        // -----------------------------------------------------

        const flag =
            new THREE.Group();

        flag.name = 'GenesisFlag';


        // -----------------------------------------------------
        // POLE
        // -----------------------------------------------------

        const pole =
            new THREE.Mesh(

                new THREE.CylinderGeometry(
                    0.06,
                    0.09,
                    6.5,
                    12
                ),

                new THREE.MeshStandardMaterial({
                    color: 0x2a2d33,
                    roughness: 0.4,
                    metalness: 0.6
                })
            );

        pole.position.set(
            0,
            3.25,
            0
        );

        pole.castShadow = true;

        flag.add(pole);


        // -----------------------------------------------------
        // WAVING CLOTH
        // -----------------------------------------------------
        //
        // The extra segments give the cloth enough
        // geometry to bend in the wind animation.

        const clothGeometry =
            new THREE.PlaneGeometry(
                2.8,
                3.5,
                14,
                18
            );

        const cloth =
            new THREE.Mesh(
                clothGeometry,
                new THREE.MeshBasicMaterial({
                    map: flagTexture,
                    side: THREE.DoubleSide
                })
            );

        cloth.position.set(
            1.5,
            4.15,
            0
        );

        cloth.castShadow = true;

        flag.add(cloth);


        // -----------------------------------------------------
        // POSITION NEXT TO THE SPAWN
        // -----------------------------------------------------
        //
        // The camera starts at (110, 1.8, 73) looking at
        // the ship, so the flag stands just off to the
        // side of that view. The ground here sits near
        // -2.3, so the pole base is buried slightly.

        flag.position.set(
            96,
            -2.6,
            76
        );

        flag.rotation.y =
            1.78;

        this.level.add(flag);


        // -----------------------------------------------------
        // ANIMATION REFERENCES
        // -----------------------------------------------------

        this.flagCloth = cloth;

        this.flagClothBase =
            clothGeometry.attributes.position.array.slice();

        this.flagTime = 0;
    }

    // =========================================================
    // SURFACE HEIGHT SAMPLING
    // =========================================================

    getSurfaceHeight(worldX, worldZ) {

        // Reads the height straight off the lunar regolith
        // vertex grid, so anything laid on the ground always
        // follows the real terrain, craters included.
        //
        // The surface is a PlaneGeometry rotated flat onto
        // its back, which maps the grid like this:
        //
        // grid X = world X
        // grid Y = -world Z

        const geometry =
            this.moonSurface.geometry;

        const positions =
            geometry.attributes.position;

        const size =
            geometry.parameters.width;

        const segments =
            geometry.parameters.widthSegments;


        const gridX =
            (worldX + size / 2) /
            size *
            segments;

        const gridY =
            (worldZ + size / 2) /
            size *
            segments;


        // Clamp so samples near the mesh edge stay on
        // valid vertices.

        const ix =
            Math.min(
                segments - 1,
                Math.max(
                    0,
                    Math.floor(gridX)
                )
            );

        const iy =
            Math.min(
                segments - 1,
                Math.max(
                    0,
                    Math.floor(gridY)
                )
            );


        const fx =
            gridX - ix;

        const fy =
            gridY - iy;


        // Bilinear blend across the four vertices
        // surrounding the sample point.

        const stride =
            segments + 1;

        const h00 =
            positions.getZ(
                iy * stride + ix
            );

        const h10 =
            positions.getZ(
                iy * stride + ix + 1
            );

        const h01 =
            positions.getZ(
                (iy + 1) * stride + ix
            );

        const h11 =
            positions.getZ(
                (iy + 1) * stride + ix + 1
            );


        const height =

            (h00 * (1 - fx) + h10 * fx) * (1 - fy) +

            (h01 * (1 - fx) + h11 * fx) * fy;


        // The regolith mesh itself is sunk 2 units below
        // the origin.

        return height - 2;
    }

    // =========================================================
    // LANDING PATH
    // =========================================================

    createPath() {

        // -----------------------------------------------------
        // ROUTE
        // -----------------------------------------------------
        //
        // A walkway leading out of the corridor mouth,
        // curving wide across the plain past the GENESIS
        // flag, under the camera spawn and onward over the
        // regolith. The stretch in front of the door runs
        // straight along the corridor axis so the final
        // slabs meet the entrance face-on.

        const curve =
            new THREE.CatmullRomCurve3([

                // Corridor door mouth.
                new THREE.Vector3(
                    20.1,
                    0,
                    57.5
                ),

                // Dead in front of the entrance, pinning
                // the first slabs into a straight aisle
                // aimed at the door (the corridor mouth
                // faces +Z).
                new THREE.Vector3(
                    20.1,
                    0,
                    63.5
                ),

                new THREE.Vector3(
                    20.1,
                    0,
                    69.5
                ),

                // Curve wide by the door and swing across
                // the plain toward the flag.
                new THREE.Vector3(
                    46,
                    0,
                    72.5
                ),

                // Past the flag, just under the flying
                // cloth so the slabs clear the pole.
                new THREE.Vector3(
                    94,
                    0,
                    72.5
                ),

                // Camera spawn.
                new THREE.Vector3(
                    110,
                    0,
                    73
                ),

                // Beyond the camera, into the distance.
                new THREE.Vector3(
                    153,
                    0,
                    61
                )
            ]);


        // -----------------------------------------------------
        // SHARED SLAB + LIGHT STUD PARTS
        // -----------------------------------------------------

        const pathGroup =
            new THREE.Group();

        pathGroup.name =
            'LandingPath';


        const slabGeometry =
            new THREE.BoxGeometry(
                2.6,
                0.18,
                1.7
            );

        const slabMaterial =
            new THREE.MeshStandardMaterial({

                // Dark basalt plates, clearly darker than
                // the grey regolith around them.
                color: 0x3d4249,

                roughness: 0.15,

                metalness: 0.7
            });


        const studGeometry =
            new THREE.BoxGeometry(
                0.55,
                0.1,
                0.55
            );

        const studMaterial =
            new THREE.MeshBasicMaterial({

                // Cyan matches the corridor light strips
                // and stays bright no matter the lighting.
                color: 0xffffff
            });


        // -----------------------------------------------------
        // LAY THE SLABS
        // -----------------------------------------------------

        const spacing =
            2.15;

        const slabCount =
            Math.floor(
                curve.getLength() /
                spacing
            );


        for (
            let i = 0;
            i <= slabCount;
            i++
        ) {

            const t =
                i / slabCount;

            const point =
                curve.getPointAt(t);

            const tangent =
                curve.getTangentAt(t);


            // Turn the slab to face the walking direction.
            const angle =
                Math.atan2(
                    tangent.x,
                    tangent.z
                );

            // Tiny deterministic jitter so the plates read
            // as laid by hand rather than stamped out.
            const jitter =
                Math.sin(
                    i * 12.9898
                ) *
                0.04;


            const surfaceY =
                this.getSurfaceHeight(
                    point.x,
                    point.z
                );


            const slab =
                new THREE.Mesh(
                    slabGeometry,
                    slabMaterial
                );

            slab.position.set(
                point.x,
                surfaceY + 0.04,
                point.z
            );

            slab.rotation.y =
                angle + jitter;

            slab.receiveShadow =
                true;

            pathGroup.add(slab);


            // A glowing stud every few slabs marks the way
            // like runway lights.

            if (
                i % 4 === 0
            ) {

                const stud =
                    new THREE.Mesh(
                        studGeometry,
                        studMaterial
                    );

                stud.position.set(
                    point.x,
                    surfaceY + 0.16,
                    point.z
                );

                stud.rotation.y =
                    angle;

                pathGroup.add(stud);
            }
        }


        this.level.add(
            pathGroup
        );

        this.pathGroup =
            pathGroup;
    }

    // =========================================================
    // UPDATE
    // =========================================================

    update(deltaTime) {

        this.updateSpaceship(deltaTime);

        // The Moon environment remains static.

        // Very slow Earth rotation so it feels like a real
        // distant celestial body rather than a gameplay object.

        if (
            this.earth
        ) {

            this.earth.rotation.y +=
                deltaTime *
                0.015;
        }


        // =================================================
        // GENESIS FLAG WAVE
        // =================================================

        if (
            this.flagCloth
        ) {

            this.flagTime +=
                deltaTime;


            const clothPositions =
                this.flagCloth.geometry.attributes.position;


            for (
                let i = 0;
                i < clothPositions.count;
                i++
            ) {

                const x =
                    this.flagClothBase[i * 3];

                const y =
                    this.flagClothBase[i * 3 + 1];


                // Zero at the pole, fully loose at the
                // flying edge of the cloth.
                const looseness =
                    (x + 1.4) / 2.8;


                const wave =

                    Math.sin(
                        x * 1.8 -
                        this.flagTime * 5
                    ) *
                    0.32 *
                    looseness

                    +

                    Math.sin(
                        y * 1.6 +
                        this.flagTime * 3
                    ) *
                    0.12 *
                    looseness;


                clothPositions.setZ(
                    i,
                    wave
                );
            }


            clothPositions.needsUpdate =
                true;
        }
    }


    // =========================================================
    // DISPOSE
    // =========================================================

    dispose() {

        this.level.traverse(
            (object) => {

                if (
                    !object.isMesh &&
                    !object.isPoints
                ) {
                    return;
                }


                if (
                    object.geometry
                ) {

                    object.geometry.dispose();
                }


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

                                material.dispose();
                            }
                        );

                    } else {

                        object.material.dispose();
                    }
                }
            }
        );


        this.rocks = [];

        this.stars = null;

        this.sky = null;

        this.earth = null;

        this.earthLight = null;

        this.moonSurface = null;

        this.regolithParticles = null;

        this.distantTerrain = null;

        this.pathGroup = null;

        window.removeEventListener(
            'keydown',
            this.onShipKeyDown
        );

        this.spaceship = null;

        this.shipExterior = null;

        this.shipCorridor = null;

        this.shipBlinkers = null;

        this.shipMaterials = null;

        this.door = null;

        this.flagCloth = null;

        this.flagClothBase = null;

        this.logoCanvas = null;


        if (this.logoTexture) {

            this.logoTexture.dispose();

            this.logoTexture = null;
        }


        if (this.flagTexture) {

            this.flagTexture.dispose();

            this.flagTexture = null;
        }


        if (this.envTexture) {

            this.envTexture.dispose();

            this.envTexture = null;
        }


        if (this.pmremGenerator) {

            this.pmremGenerator.dispose();

            this.pmremGenerator = null;
        }
    }
}