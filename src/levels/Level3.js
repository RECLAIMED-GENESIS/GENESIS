import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
    moonVertexShader,
    moonFragmentShader
} from '../shaders/moon.js';

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
    // This is deliberately still MeshStandardMaterial.
    // We will replace this with moon.js later.

    const material =
    new THREE.ShaderMaterial({
        vertexShader: moonVertexShader,
        fragmentShader: moonFragmentShader,

        side: THREE.FrontSide,

        depthWrite: true,
        depthTest: true
    });


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

        const material =
            new THREE.MeshStandardMaterial({

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

    const spaceship = new THREE.Group();

    spaceship.name = 'GenesisSpaceship';

    this.spaceship = spaceship;

    this.level.add(spaceship);


    // =====================================================
    // LOAD EXTERIOR FBX
    // =====================================================

    const fbxLoader = new FBXLoader();

    fbxLoader.load(
        './assets/models/Spaceship.fbx',

        (fbx) => {

            const exterior = fbx;

            exterior.name = 'SpaceshipExterior';


            // ---------------------------------------------
            // SCALE
            // ---------------------------------------------
            //
            // This FBX is already authored in meters
            // (measured hull: roughly 52 x 20 x 68 units),
            // so no centimeter conversion is applied.

            exterior.scale.set(
                1,
                1,
                1
            );


            // ---------------------------------------------
            // POSITION
            // ---------------------------------------------
            //
            // The FBX pivot is offset from the hull, so
            // re-center the model on the ship group and
            // rest its belly just above the regolith
            // (terrain under the footprint sits near -2).

            exterior.updateMatrixWorld(true);

            const hullBox =
                new THREE.Box3().setFromObject(exterior);

            const hullCenter =
                hullBox.getCenter(
                    new THREE.Vector3()
                );

            exterior.position.set(
                -hullCenter.x +20,
                -hullBox.min.y-5 ,
                -hullCenter.z +15
            );


            // ---------------------------------------------
            // ROTATION
            // ---------------------------------------------

            exterior.rotation.set(
                0,
                0,
                0
            );


            // ---------------------------------------------
            // SHADOWS + WHITE PLACEHOLDER MATERIAL
            // ---------------------------------------------
            //
            // The source FBX renders nearly black in this
            // scene, so every mesh is swapped to a plain
            // white placeholder material in the meantime.
            // DoubleSide guards against flipped mesh
            // winding, which Maya exports often carry.

            const hullMaterial =
                new THREE.MeshStandardMaterial({

                    // Plain white placeholder.
                    color: 0xffffff,

                    roughness: 0.65,

                    // Placeholder must stay non-metallic.
                    metalness: 0.0,

                    side: THREE.DoubleSide
                });


            exterior.traverse((object) => {

                if (object.isMesh) {

                    object.castShadow = true;
                    object.receiveShadow = true;

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

                    object.material = hullMaterial;

                }

            });


            // ---------------------------------------------
            // ADD EXTERIOR
            // ---------------------------------------------

            spaceship.add(exterior);


            console.log(
                'GENESIS: Spaceship FBX loaded.'
            );

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

    const gltfLoader = new GLTFLoader();

    gltfLoader.load(
        './assets/models/space_ship_hallway.glb',

        (gltf) => {

            const corridor = gltf.scene;

            corridor.name = 'SpaceshipCorridor';


            // ---------------------------------------------
            // SCALE
            // ---------------------------------------------

            corridor.scale.set(
                1,
                2,
                1.5
            );


            // ---------------------------------------------
            // POSITION
            // ---------------------------------------------

            corridor.position.set(
                0,
                0,
                45
            );


            // ---------------------------------------------
            // ROTATION
            // ---------------------------------------------

            corridor.rotation.set(
                0,
                0,
                0
            );


            // ---------------------------------------------
            // SHADOWS + INTERIOR IMAGE-BASED LIGHTING
            // ---------------------------------------------
            //
            // The corridor keeps its ORIGINAL materials so
            // the authored look (black walls, cyan light
            // strips, vent lights, glass) is preserved.
            // The PMREM room environment is attached per
            // material so metallic surfaces get reflections
            // instead of rendering black inside the hull.

            corridor.traverse((object) => {

                if (object.isMesh) {

                    object.castShadow = true;
                    object.receiveShadow = true;

                    if (this.envTexture) {

                        const materials =
                            Array.isArray(
                                object.material
                            )
                                ? object.material
                                : [object.material];

                        materials.forEach(
                            (material) => {

                                material.envMap =
                                    this.envTexture;

                                material.envMapIntensity =
                                    0.5;

                                material.needsUpdate =
                                    true;
                            }
                        );

                    }

                }

            });


            // ---------------------------------------------
            // ADD CORRIDOR
            // ---------------------------------------------

            spaceship.add(corridor);


            // ---------------------------------------------
            // DOOR EMBLEM
            // ---------------------------------------------
            //
            // A GENESIS emblem floating in the entrance
            // mouth of the corridor. Parented to the
            // corridor so it follows position tweaks, and
            // counter-scaled against the corridor stretch
            // (scale 1 / 2 / 1.5) so it keeps its true
            // size. The corridor opening spans local
            // x 15.9 - 24.4, y up to 3.9, z up to 3.6.

            const doorLogo =
                this.createGenesisLogo(6, 3);

            doorLogo.scale.set(
                1,
                0.5,
                1
            );

            doorLogo.position.set(
                20.1,
                2.25,
                3.75
            );

            corridor.add(doorLogo);


            console.log(
                'GENESIS: Spaceship corridor loaded.'
            );

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
    // WHOLE SHIP POSITION
    // =====================================================

    spaceship.position.set(
        0,
        0,
        5
    );


    // =====================================================
    // WHOLE SHIP ROTATION
    // =====================================================

    spaceship.rotation.set(
        0,
        0,
        0
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