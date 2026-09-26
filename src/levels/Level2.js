import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import {
    riverVertexShader,
    riverFragmentShader
} from '../shaders/river.js';

// Street light colour (bulb glow, halo and light pools)
//   cyan:                 0x00e5ff
//   white:                0xffffff
//   white with cyan tint: 0xe0f7ff
const STREET_LIGHT_COLOR = 0x00e5ff;

// Ruined building shader patch (see applyRuinShader)
const RUIN_SHADER_COMMON = /* glsl */ `
    varying vec3 vRuinWorld;
    varying vec3 vRuinNormal;

    uniform float uRuinTime;
    uniform float uGrimeHeight;
    uniform float uCrack;
    uniform vec3 uCrackColor;
    uniform vec2 uPane;
    uniform vec2 uPaneOffset;
    uniform float uDead;
    uniform float uFlicker;

    float ruinHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float ruinNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(ruinHash(i), ruinHash(i + vec2(1.0, 0.0)), f.x),
            mix(ruinHash(i + vec2(0.0, 1.0)), ruinHash(i + vec2(1.0, 1.0)), f.x),
            f.y
        );
    }

    // World position on the surface's dominant plane; walls keep
    // world y as their second axis so streaks run downward
    vec2 ruinPlane() {
        vec3 n = abs(vRuinNormal);
        if (n.y > n.x && n.y > n.z) return vRuinWorld.xz;
        return n.x > n.z ? vRuinWorld.zy : vRuinWorld.xy;
    }

    // Voronoi cell edges = crack network
    float ruinCracks(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float d1 = 8.0;
        float d2 = 8.0;
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec2 g = vec2(float(x), float(y));
                vec2 o = vec2(ruinHash(i + g), ruinHash(i + g + 17.3));
                float d = length(g + o - f);
                if (d < d1) { d2 = d1; d1 = d; }
                else if (d < d2) { d2 = d; }
            }
        }
        float e = d2 - d1;
        return 1.0 - smoothstep(0.0, fwidth(e) + 0.02, e);
    }
`;

const RUIN_SHADER_GRIME = /* glsl */ `
    #ifdef RUIN_GRIME
    {
        vec2 rp = ruinPlane();
        float rise = smoothstep(0.0, uGrimeHeight, vRuinWorld.y);
        float streak = ruinNoise(vec2(rp.x * 1.6, rp.y * 0.12));
        float blotch = ruinNoise(rp * 0.35 + 7.0);
        diffuseColor.rgb *=
            mix(0.45, 1.0, rise) *
            mix(0.72, 1.0, streak) *
            mix(0.8, 1.0, blotch);
    }
    #endif
`;

const RUIN_SHADER_EMISSIVE = /* glsl */ `
    #ifdef RUIN_WINDOWS
    {
        vec2 cell = floor((ruinPlane() - uPaneOffset) / uPane);
        float h = ruinHash(cell + 0.37);
        float lit = step(uDead, h);
        float flickering = step(1.0 - uFlicker, h);
        float blink = step(0.35, ruinHash(vec2(floor(uRuinTime * 12.0 + h * 50.0), h)));
        totalEmissiveRadiance *=
            lit *
            mix(1.0, blink, flickering) *
            (0.55 + 0.45 * ruinHash(cell + 9.1));
        diffuseColor.rgb *= mix(0.35, 1.0, lit);
    }
    #endif

    #ifdef RUIN_CRACKS
    {
        vec2 rp = ruinPlane();
        float crackPatch = smoothstep(0.74, 0.82, ruinNoise(rp * 0.1 + 3.1));
        float c = ruinCracks(rp * 0.9) * crackPatch;
        c *= smoothstep(0.4, 0.6, ruinNoise(rp * 1.7 + 11.0));
        float id = ruinHash(floor(rp * 0.12));
        float pulse = 0.55 + 0.45 * sin(uRuinTime * 2.3 + id * 40.0);
        pulse *= step(0.08, ruinHash(vec2(floor(uRuinTime * 9.0), id)));
        totalEmissiveRadiance += uCrackColor * c * uCrack * pulse;
        diffuseColor.rgb *= 1.0 - c * 0.6;
    }
    #endif
`;

export class Level2 {

    constructor() {

        // =========================================================
        // SCENE
        // =========================================================

        this.scene = new THREE.Scene();

        this.scene.background =
            new THREE.Color(0x09051c);

        this.scene.fog =
            new THREE.Fog(
                0x10082a,
                55,
                270
            );

        this.level =
            new THREE.Group();

        this.scene.add(
            this.level
        );

        const textureLoader =
            new THREE.TextureLoader();

        // Banner texture for the street lights
        this.bannerTexture =
            textureLoader.load(
                './assets/textures/burner.png'
            );

        this.bannerTexture.colorSpace =
            THREE.SRGBColorSpace;


        // =========================================================
        // SKY
        // =========================================================

        const skyTexture =
            textureLoader.load(
                './assets/textures/skybox1.png'
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

        // Lowered from 2.2 so the sunset and street light
        // pools stand out
        const ambient =
            new THREE.HemisphereLight(
                0x756fa8,
                0x171321,
                1.6
            );

        this.level.add(
            ambient
        );


        // ---------------------------------------------------------
        // SUNSET SUN
        // Matches the sun painted in skybox1.png: pixel (998, 431)
        // of 1774 x 887 = 2.5 degrees above the horizon, towards
        // (0.92, -0.38) in x/z, i.e. setting over the sea.
        // Raised to 10 degrees so shadows are long (about 5.7x an
        // object's height) without putting the whole road in shadow.
        // ---------------------------------------------------------

        const SUN_ELEVATION = THREE.MathUtils.degToRad(10);
        const SUN_AZIMUTH = Math.atan2(-0.3844, 0.9221);
        const SUN_DISTANCE = 250;

        this.sunDirection =
            new THREE.Vector3(
                Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH),
                Math.sin(SUN_ELEVATION),
                Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH)
            );

        const sunset =
            new THREE.DirectionalLight(
                0xffb46b,
                2.8
            );

        // Aim at the middle of the road
        sunset.target.position.set(
            0,
            0,
            -10
        );

        this.level.add(
            sunset.target
        );

        sunset.position
            .copy(this.sunDirection)
            .multiplyScalar(SUN_DISTANCE)
            .add(sunset.target.position);

        sunset.castShadow = true;

        // Low sun: bias stops shadow speckle on grazing surfaces
        sunset.shadow.bias =
            -0.0005;

        sunset.shadow.normalBias =
            0.05;

        sunset.shadow.camera.near =
            1;

        sunset.shadow.camera.far =
            600;

        sunset.shadow.mapSize.width =
            2048;

        sunset.shadow.mapSize.height =
            2048;

        // Shadow area fitted to the low sun: wide across the
        // road's length, shorter vertically
        sunset.shadow.camera.left =
            -150;

        sunset.shadow.camera.right =
            150;

        sunset.shadow.camera.top =
            70;

        sunset.shadow.camera.bottom =
            -70;

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


        // =========================================================
        // ROAD
        // =========================================================

        const roadTexture =
            textureLoader.load(
                './assets/textures/Road.png'
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
                './assets/textures/ground.png'
            );

        groundTexture.wrapS =
            THREE.RepeatWrapping;

        groundTexture.wrapT =
            THREE.RepeatWrapping;

        // Ground stops at the road edge on the sea side (x 8)
        // so the lowered sea and the cliffs are not covered.
        // Repeat scaled to keep the same texture density.
        const GROUND_X_MIN = -300;
        const GROUND_X_MAX = 8;
        const GROUND_WIDTH = GROUND_X_MAX - GROUND_X_MIN;

        groundTexture.repeat.set(
            80 * GROUND_WIDTH / 600,
            80
        );

        groundTexture.colorSpace =
            THREE.SRGBColorSpace;

        const ground =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    GROUND_WIDTH,
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
            (GROUND_X_MIN + GROUND_X_MAX) / 2,
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

        this.createCoastline();

        this.createRiver();

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
        // RUINED CITY MATERIALS
        // Shared by the five -X side buildings
        // =========================================================

        this.createRuinMaterials();

        // =========================================================
        // CITY BUILDING #1
        // right
        // =========================================================

        this.createParkingBuilding(
            -24,
            -79
        );


        // =========================================================
        // CITY BUILDING #2
        // Left-comes after stacked building with thinga attached to it 
        // =========================================================

        this.createOrganicBuilding(
            -24,
            -117
        );


        // =========================================================
        // CITY BUILDING #4
        // right SIDE-comes after parking building 
        // CANTILEVERED GLASS CLUSTER
        // =========================================================

        this.createGlassClusterBuilding(
            -24,
            -44
        );


        // =========================================================
        // CITY BUILDING #6
        // right SIDE
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
            20
        );


        // =========================================================
        // DEFORESTATION BACKGROUND
        // Behind the buildings on the -X side
        // =========================================================

        this.createDeforestation();



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
// SEA-SIDE COASTLINE
// Rocky cliffs between the road edge (x 8) and the sea, loose
// boulders in the water, a shore-distance map for the surf
// foam, and an invisible barrier where the old wall stood.
// =============================================================

createCoastline() {

    // ---------------------------------------------------------
    // LAYOUT
    // ---------------------------------------------------------
    // Road top = y 0, road edge = x 8
    // Cliff top sits just below road level, the sea is 6 lower.
    // Land (cliff top) is:
    //   - a strip from the road edge out to about x 12
    //   - a headland under the Twin Spire Gateway plaza
    //     (plaza x 11.5 to 36.5, z 4.5 to 95.5)
    //   - a ledge under the poster (x 15, z -16 to 14)

    const coast = {
        seaLevel: -6,
        topY: -0.05,          // cliff top, just under the road
        floorY: -9.5,         // rock floor, under the water
        cliffRun: 3.5,        // metres the face takes to drop
        xMin: 8,              // never build over the road
        xMax: 52,
        zMin: -300,
        zMax: 300
    };

    this.coast = coast;
    this.seaLevel = coast.seaLevel;


    // ---------------------------------------------------------
    // SHARED ROCK MATERIAL
    // Dark, rough, faceted. Colour comes from vertex colours:
    // darker and wet near the water, lighter on top.
    // ---------------------------------------------------------

    const rockMaterial =
        new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.96,
            metalness: 0.0,
            flatShading: true
        });

    this.rockMaterial = rockMaterial;


    this.createCliffs(coast, rockMaterial);

    const boulders =
        this.createBoulders(coast, rockMaterial);

    this.createShoreDistanceMap(coast, boulders);

    this.createSeaBarrier();
}


// -------------------------------------------------------------
// SMALL DETERMINISTIC NOISE (same rocks every time)
// -------------------------------------------------------------

coastHash(x, y) {

    let h =
        Math.imul(x | 0, 374761393) ^
        Math.imul(y | 0, 668265263);

    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967295;
}

coastNoise(x, y) {

    const xi = Math.floor(x);
    const yi = Math.floor(y);

    let fx = x - xi;
    let fy = y - yi;

    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);

    const a = this.coastHash(xi, yi);
    const b = this.coastHash(xi + 1, yi);
    const c = this.coastHash(xi, yi + 1);
    const d = this.coastHash(xi + 1, yi + 1);

    return (
        a +
        (b - a) * fx +
        (c - a) * fy +
        (a - b - c + d) * fx * fy
    );
}

// 0..1 fractal noise
coastFbm(x, y, octaves = 4) {

    let total = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let norm = 0;

    for (let i = 0; i < octaves; i++) {
        total += this.coastNoise(x * frequency + i * 17.3, y * frequency - i * 9.1) * amplitude;
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2.03;
    }

    return total / norm;
}

// Seeded random for boulder placement
coastRandom(seed) {

    let s = seed >>> 0;

    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


// -------------------------------------------------------------
// DISTANCE OUTSIDE THE LAND (<= 0 means on the cliff top)
// -------------------------------------------------------------

coastLandDistance(x, z) {

    // Uneven cliff edge along the road
    const edgeNoise =
        (this.coastFbm(z * 0.06, 3.7, 3) - 0.5) * 2.4;

    const strip =
        x - (12 + edgeNoise);

    // Box distance helper
    const box = (x0, x1, z0, z1) => {
        const dx = Math.max(x0 - x, 0, x - x1);
        const dz = Math.max(z0 - z, 0, z - z1);
        const outside = Math.hypot(dx, dz);
        const inside = Math.min(0, Math.max(x0 - x, x - x1, z0 - z, z - z1));
        return outside + inside;
    };

    const wobble =
        (this.coastFbm(x * 0.09, z * 0.09, 3) - 0.5) * 2.0;

    // Headland under the gateway plaza (always >= 1 m beyond it)
    const headland =
        box(8, 38.5, 2.5, 97.5) - wobble * 0.5;

    // Ledge under the poster
    const ledge =
        box(8, 17.5, -18, 16) - wobble * 0.4;

    return Math.min(strip, headland, ledge);
}


// -------------------------------------------------------------
// ROCK HEIGHT AT (x, z)
// -------------------------------------------------------------

coastHeight(x, z) {

    const c = this.coast;

    const d = this.coastLandDistance(x, z);

    // Cliff top: slightly rough, never above the road
    if (d <= 0) {
        return c.topY - this.coastFbm(x * 0.8, z * 0.8, 3) * 0.18;
    }

    // Cliff face: steep drop with jagged ledges
    const t = Math.min(d / c.cliffRun, 1);
    const s = t * t * (3 - 2 * t);

    let h = c.topY + (c.floorY - c.topY) * s;

    const faceNoise =
        (this.coastFbm(x * 0.35, z * 0.35, 4) - 0.5) * 3.0;

    h += faceNoise * Math.sin(Math.PI * t);

    // Rocky shoals just beyond the cliff foot. Some break the
    // surface so rocks stick out of the water.
    const beyond = Math.max(d - c.cliffRun, 0);

    const reef =
        Math.max(this.coastFbm(x * 0.22 + 40, z * 0.22, 4) - 0.52, 0) *
        18 *
        Math.exp(-beyond / 7);

    h += reef * (d > c.cliffRun * 0.6 ? 1 : 0.4);

    return Math.min(h, c.topY);
}


// -------------------------------------------------------------
// CLIFF SURFACE (one mesh)
// -------------------------------------------------------------

createCliffs(coast, rockMaterial) {

    const step = 0.75;

    const nx = Math.round((coast.xMax - coast.xMin) / step);
    const nz = Math.round((coast.zMax - coast.zMin) / 0.8);

    const vertexCount = (nx + 1) * (nz + 1);

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    const top = new THREE.Color(0x3b3733);
    const mid = new THREE.Color(0x2a2724);
    const wet = new THREE.Color(0x141618);
    const tmp = new THREE.Color();

    let i = 0;

    for (let iz = 0; iz <= nz; iz++) {

        const z = coast.zMin + (iz / nz) * (coast.zMax - coast.zMin);

        for (let ix = 0; ix <= nx; ix++) {

            let x = coast.xMin + (ix / nx) * (coast.xMax - coast.xMin);

            const y = this.coastHeight(x, z);

            // Push face vertices sideways a little so the cliff
            // does not look like a regular grid. Face vertices stay
            // at x >= 11 so the street lights' buried poles
            // (x 7.4 to 10.6, down to y -5.1) stay inside the rock.
            if (y < coast.topY - 0.3 && ix > 0) {
                x += (this.coastFbm(x * 0.5, z * 0.5 + 11, 2) - 0.5) * 1.2;
                x = Math.max(x, 11);
            }

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Colour: wet near the waterline, lighter on top
            const heightT =
                THREE.MathUtils.clamp(
                    (y - (coast.seaLevel + 0.8)) / (coast.topY - coast.seaLevel - 0.8),
                    0,
                    1
                );

            tmp.copy(wet).lerp(mid, THREE.MathUtils.smoothstep(heightT, 0, 0.25));
            tmp.lerp(top, THREE.MathUtils.smoothstep(heightT, 0.6, 1.0));

            const variation =
                0.8 + this.coastFbm(x * 0.4 + 5, z * 0.4, 3) * 0.4;

            colors[i * 3] = tmp.r * variation;
            colors[i * 3 + 1] = tmp.g * variation;
            colors[i * 3 + 2] = tmp.b * variation;

            i++;
        }
    }

    const indices = [];

    for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {

            const a = iz * (nx + 1) + ix;
            const b = a + 1;
            const c = a + (nx + 1);
            const d = c + 1;

            // Counter-clockwise seen from above
            indices.push(a, c, b, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const cliffs = new THREE.Mesh(geometry, rockMaterial);

    cliffs.receiveShadow = true;
    cliffs.castShadow = true;

    this.level.add(cliffs);

    this.cliffs = cliffs;
}


// -------------------------------------------------------------
// BOULDERS IN THE WATER (one InstancedMesh)
// -------------------------------------------------------------

createBoulders(coast, rockMaterial) {

    // One lumpy rock shape shared by every boulder
    const geometry =
        new THREE.IcosahedronGeometry(1, 2);

    const pos = geometry.attributes.position;
    const v = new THREE.Vector3();
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0x2c2926);
    const wet = new THREE.Color(0x151719);

    for (let i = 0; i < pos.count; i++) {

        v.fromBufferAttribute(pos, i).normalize();

        const n =
            this.coastFbm(v.x * 1.7 + v.z * 0.6 + 3, v.y * 1.7 - v.z * 0.9, 4);

        const radius = 0.72 + n * 0.55;

        pos.setXYZ(i, v.x * radius, v.y * radius * 0.8, v.z * radius);

        // Darker underneath (wet), lighter on top
        const c = wet.clone().lerp(base, THREE.MathUtils.smoothstep(v.y, -0.2, 0.5));
        const variation = 0.85 + n * 0.3;

        colors[i * 3] = c.r * variation;
        colors[i * 3 + 1] = c.g * variation;
        colors[i * 3 + 2] = c.b * variation;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const random = this.coastRandom(20260925);

    const count = 70;
    const boulders = [];

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    for (let tries = 0; boulders.length < count && tries < count * 20; tries++) {

        // Most boulders near the playable road stretch
        const z =
            random() < 0.8
                ? -160 + random() * 320
                : coast.zMin + random() * (coast.zMax - coast.zMin);

        // Find the foot of the cliff at this z
        let foot = null;

        for (let x = coast.xMin; x < coast.xMax; x += 0.5) {
            if (this.coastHeight(x, z) < coast.seaLevel - 1.5) {
                foot = x;
                break;
            }
        }

        if (foot === null) continue;

        const size = 0.8 + Math.pow(random(), 2.2) * 3.2;

        const x = foot - 1 + random() * 13;

        // Keep well clear of the road and the cliff top
        if (x - size * 1.3 < 13) continue;

        const y =
            coast.seaLevel - size * (0.1 + random() * 0.5);

        boulders.push({
            x,
            y,
            z,
            sx: size * (0.8 + random() * 0.5),
            sy: size * (0.7 + random() * 0.5),
            sz: size * (0.8 + random() * 0.5),
            yaw: random() * Math.PI * 2,
            tilt: (random() - 0.5) * 0.5
        });
    }

    const mesh =
        new THREE.InstancedMesh(geometry, rockMaterial, boulders.length);

    boulders.forEach((b, i) => {

        position.set(b.x, b.y, b.z);
        euler.set(b.tilt, b.yaw, b.tilt * 0.5);
        quaternion.setFromEuler(euler);
        scale.set(b.sx, b.sy, b.sz);

        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(i, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.level.add(mesh);

    this.boulders = mesh;

    return boulders;
}


// -------------------------------------------------------------
// SHORE DISTANCE MAP (for the surf foam in river.js)
// For each point of water near the coast: distance in metres
// to the nearest rock at sea level, stored 0..10 m as 0..255.
// -------------------------------------------------------------

createShoreDistanceMap(coast, boulders) {

    const res = 0.5;
    const maxDistance = 10;

    const x0 = coast.xMin;
    const z0 = coast.zMin;
    const width = 72 - x0;
    const depth = coast.zMax - coast.zMin;

    const W = Math.round(width / res);
    const H = Math.round(depth / res);

    const dist = new Float32Array(W * H);
    const BIG = 1e6;

    // 1. Mark rock cells (rock above the water surface)
    for (let j = 0; j < H; j++) {

        const z = z0 + (j + 0.5) * res;

        for (let i = 0; i < W; i++) {

            const x = x0 + (i + 0.5) * res;

            dist[j * W + i] =
                this.coastHeight(x, z) > coast.seaLevel ? 0 : BIG;
        }
    }

    // Boulders: ellipse where each rock cuts the water surface
    boulders.forEach((b) => {

        const dy = (coast.seaLevel - b.y) / (b.sy * 0.8);

        if (Math.abs(dy) >= 1) return;

        const r = Math.sqrt(1 - dy * dy);
        const rx = b.sx * r * 0.95;
        const rz = b.sz * r * 0.95;
        const reach = Math.max(rx, rz);

        const cos = Math.cos(b.yaw);
        const sin = Math.sin(b.yaw);

        const iMin = Math.max(0, Math.floor((b.x - reach - x0) / res));
        const iMax = Math.min(W - 1, Math.ceil((b.x + reach - x0) / res));
        const jMin = Math.max(0, Math.floor((b.z - reach - z0) / res));
        const jMax = Math.min(H - 1, Math.ceil((b.z + reach - z0) / res));

        for (let j = jMin; j <= jMax; j++) {
            for (let i = iMin; i <= iMax; i++) {

                const px = x0 + (i + 0.5) * res - b.x;
                const pz = z0 + (j + 0.5) * res - b.z;

                // Into the rock's local frame (yaw only)
                const lx = px * cos - pz * sin;
                const lz = px * sin + pz * cos;

                if ((lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) <= 1) {
                    dist[j * W + i] = 0;
                }
            }
        }
    });

    // 2. Two-pass chamfer distance transform (in cells)
    const D1 = 1;
    const D2 = Math.SQRT2;

    for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; i++) {
            const k = j * W + i;
            let d = dist[k];
            if (i > 0) d = Math.min(d, dist[k - 1] + D1);
            if (j > 0) {
                d = Math.min(d, dist[k - W] + D1);
                if (i > 0) d = Math.min(d, dist[k - W - 1] + D2);
                if (i < W - 1) d = Math.min(d, dist[k - W + 1] + D2);
            }
            dist[k] = d;
        }
    }

    for (let j = H - 1; j >= 0; j--) {
        for (let i = W - 1; i >= 0; i--) {
            const k = j * W + i;
            let d = dist[k];
            if (i < W - 1) d = Math.min(d, dist[k + 1] + D1);
            if (j < H - 1) {
                d = Math.min(d, dist[k + W] + D1);
                if (i < W - 1) d = Math.min(d, dist[k + W + 1] + D2);
                if (i > 0) d = Math.min(d, dist[k + W - 1] + D2);
            }
            dist[k] = d;
        }
    }

    // 3. Pack into a texture
    const data = new Uint8Array(W * H);

    for (let k = 0; k < W * H; k++) {
        data[k] = Math.min(255, Math.round((dist[k] * res / maxDistance) * 255));
    }

    const texture =
        new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);

    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    this.shoreDistanceTexture = texture;

    // x0, z0, width, depth of the area the map covers
    this.shoreDistanceBounds =
        new THREE.Vector4(x0, z0, width, depth);

    this.shoreDistanceMax = maxDistance;
}


// -------------------------------------------------------------
// INVISIBLE BARRIER WHERE THE OLD WALL WAS
// Not rendered. For future player collision:
//   this.colliders -> array of THREE.Box3
// -------------------------------------------------------------

createSeaBarrier() {

    const barrier =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.2,      // thickness (same as the old wall)
                3,        // height
                260       // road length
            ),
            new THREE.MeshBasicMaterial()
        );

    barrier.position.set(
        9.8,
        1.5,
        0
    );

    barrier.visible = false;
    barrier.name = 'SeaBarrier';

    this.level.add(barrier);

    this.seaBarrier = barrier;

    this.colliders = this.colliders || [];

    this.colliders.push(
        new THREE.Box3().setFromCenterAndSize(
            barrier.position.clone(),
            new THREE.Vector3(1.2, 3, 260)
        )
    );
}

// =============================================================
// RIVER
// =============================================================

createRiver() {

    // ---------------------------------------------------------
    // SEA TEXTURE
    // Lives in public/ so it is copied into dist/ on build
    // ---------------------------------------------------------

    const seaTexture =
        new THREE.TextureLoader().load(
            './assets/textures/sea.jpg'
        );

    seaTexture.colorSpace =
        THREE.SRGBColorSpace;

    // Mirrored so the photo's edges line up between tiles
    seaTexture.wrapS =
        THREE.MirroredRepeatWrapping;

    seaTexture.wrapT =
        THREE.MirroredRepeatWrapping;


    const riverMaterial =
        new THREE.ShaderMaterial({

            uniforms:
                THREE.UniformsUtils.merge([
                    THREE.UniformsLib.fog,
                    {
                        uTime: {
                            value: 0
                        },

                        uSeaTexture: {
                            value: null
                        },

                        // One texture tile = 24 x 16 world units
                        // (same 3:2 shape as sea.jpg)
                        uTileSize: {
                            value: new THREE.Vector2(24, 16)
                        },

                        // Surf foam: distance to the rocks,
                        // from createShoreDistanceMap()
                        uShoreDistance: {
                            value: null
                        },

                        uShoreBounds: {
                            value: this.shoreDistanceBounds.clone()
                        },

                        uShoreMax: {
                            value: this.shoreDistanceMax
                        }
                    }
                ]),

            vertexShader:
                riverVertexShader,

            fragmentShader:
                riverFragmentShader,

            // Fade into the scene fog so the far edge is hidden
            fog: true
        });

    // Set after merge() - merge() clones textures
    riverMaterial.uniforms.uSeaTexture.value =
        seaTexture;

    riverMaterial.uniforms.uShoreDistance.value =
        this.shoreDistanceTexture;


    // ---------------------------------------------------------
    // SEA SIZE
    // ---------------------------------------------------------
    // Road = x 0, width 16
    // Sea = x 10.51 to 310.51, z -300 to 300, so its far edges
    // sit beyond the fog (270). The part under the cliffs is
    // hidden by the rock.

    const SEA_START_X = 10.51;
    const SEA_WIDTH = 300;
    const SEA_LENGTH = 600;

    const river =
        new THREE.Mesh(

            new THREE.PlaneGeometry(
                SEA_WIDTH,
                SEA_LENGTH,
                200,    // ~1.5 units per segment
                400
            ),

            riverMaterial
        );


    // Lay the plane flat
    river.rotation.x =
        -Math.PI / 2;


    // Sea level from createCoastline() (y -6, below the cliff
    // top). Waves move -0.17 to +0.39 around it.

    river.position.set(
        SEA_START_X + SEA_WIDTH / 2,
        this.seaLevel,
        0
    );


    this.level.add(
        river
    );


    // Save material so update() can animate it
    this.riverMaterial =
        riverMaterial;
}
    // =============================================================
// STREET LIGHTS
// Reuses / clones assets/models/light.glb
// =============================================================

createStreetLights() {

    const loader = new GLTFLoader();

    loader.load(
        './assets/models/light.glb',

        (gltf) => {

            const originalLight = gltf.scene;

            // -------------------------------------------------
            // Glowing bulbs
            // The lamp heads use the model's "Light" material,
            // shared by every clone, so this lights them all
            // -------------------------------------------------

            originalLight.traverse((object) => {
                if (
                    object.isMesh &&
                    object.material &&
                    object.material.name === 'Light'
                ) {
                    object.material.emissive =
                        new THREE.Color(STREET_LIGHT_COLOR);
                    object.material.emissiveIntensity = 2.5;
                }
            });

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

                this.addStreetLightBulbs(light);

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
// STREET LIGHT BULBS
// One downward spotlight per lamp head (no shadows) plus a
// soft additive halo sprite. Bulb positions are read from the
// model's "Light" meshes, so they follow the model.
// =============================================================

addStreetLightBulbs(light) {

    if (!this.streetLightHaloMaterial) {

        // Radial glow texture, made once and shared
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        const gradient =
            ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

        gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.55)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        gradient.addColorStop(1.0, 'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        this.streetLightHaloMaterial =
            new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(canvas),
                color: STREET_LIGHT_COLOR,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false
            });

        this.streetLightSpots = [];
    }

    light.updateMatrixWorld(true);

    const box = new THREE.Box3();

    light.traverse((object) => {

        if (
            !object.isMesh ||
            !object.material ||
            object.material.name !== 'Light'
        ) {
            return;
        }

        box.setFromObject(object);

        const center = box.getCenter(new THREE.Vector3());

        // -------------------------------------------------
        // Light pool on the ground below the lamp head
        // -------------------------------------------------

        const spot =
            new THREE.SpotLight(
                STREET_LIGHT_COLOR,
                3000,                         // candela
                45,                           // range
                THREE.MathUtils.degToRad(40), // cone half-angle
                0.65,                         // soft edge
                2                             // physical falloff
            );

        spot.position.set(center.x, box.min.y - 0.1, center.z);
        spot.target.position.set(center.x, 0, center.z);

        this.level.add(spot);
        this.level.add(spot.target);

        this.streetLightSpots.push(spot);

        // -------------------------------------------------
        // Halo around the bulb
        // -------------------------------------------------

        const halo =
            new THREE.Sprite(this.streetLightHaloMaterial);

        halo.position.set(center.x, box.min.y + 0.2, center.z);
        halo.scale.set(5, 5, 1);

        this.level.add(halo);
    });
}


    // =============================================================
    // RUINED CITY MATERIALS
    // An abandoned simulation city that was never finished.
    // Only brick.png and Road.png (the glass skin) are used, each
    // loaded once; ageing comes from tinting and the shader patch
    // below. Every patched material reads the same uTime, so the
    // flicker costs one uniform update per frame (see update()).
    // =============================================================

    createRuinMaterials() {

        const textureLoader =
            new THREE.TextureLoader();

        this.ruinTime =
            { value: 0 };

        const brickTexture =
            textureLoader.load(
                './assets/textures/brick.png'
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

        const glassTexture =
            textureLoader.load(
                './assets/textures/Road.png'
            );

        glassTexture.wrapS =
            THREE.RepeatWrapping;

        glassTexture.wrapT =
            THREE.RepeatWrapping;

        glassTexture.repeat.set(
            2,
            2
        );

        glassTexture.colorSpace =
            THREE.SRGBColorSpace;

        const ruin = {
            brickTexture,
            glassTexture
        };

        // Weathered panel walls, cyan cracks break through
        ruin.brick =
            this.applyRuinShader(
                new THREE.MeshStandardMaterial({
                    map: brickTexture,
                    color: 0xb3aca6,
                    roughness: 0.95,
                    metalness: 0.05
                }),
                { grime: 6, crack: 0.9 }
            );

        // Same texture, cooler grey tint: cast concrete slabs
        ruin.concrete =
            this.applyRuinShader(
                new THREE.MeshStandardMaterial({
                    map: brickTexture,
                    color: 0x6f7176,
                    roughness: 0.9,
                    metalness: 0.1
                }),
                { grime: 5 }
            );

        // Formerly white structure, now dirty bone
        ruin.bone =
            this.applyRuinShader(
                new THREE.MeshStandardMaterial({
                    color: 0x6f706c,
                    roughness: 0.7,
                    metalness: 0.2
                }),
                { grime: 5, crack: 0.7 }
            );

        // Broken chunks and debris
        ruin.debris =
            this.applyRuinShader(
                new THREE.MeshStandardMaterial({
                    color: 0x4a4c50,
                    roughness: 0.9,
                    metalness: 0.15
                }),
                { grime: 3 }
            );

        // Smudged glass: Road.png's streaks read as dirt
        ruin.glass =
            this.applyRuinShader(
                new THREE.MeshStandardMaterial({
                    map: glassTexture,
                    color: 0x6f8a90,
                    roughness: 0.3,
                    metalness: 0.35,
                    transparent: true,
                    opacity: 0.78
                }),
                { grime: 5 }
            );

        // Broken / blacked-out panes
        ruin.deadGlass =
            new THREE.MeshStandardMaterial({
                map: glassTexture,
                color: 0x1a1f22,
                roughness: 0.5,
                metalness: 0.3,
                transparent: true,
                opacity: 0.92
            });

        // Glitch accent, same cyan as the street lights
        ruin.glitch =
            new THREE.MeshStandardMaterial({
                color: STREET_LIGHT_COLOR,
                emissive: STREET_LIGHT_COLOR,
                emissiveIntensity: 1.5,
                roughness: 0.3,
                metalness: 0.2
            });

        // Parts the simulation never finished rendering
        ruin.wire =
            new THREE.MeshBasicMaterial({
                color: STREET_LIGHT_COLOR,
                wireframe: true,
                transparent: true,
                opacity: 0.35,
                depthWrite: false
            });

        this.ruin = ruin;
    }


    // =============================================================
    // RUIN WINDOWS
    // Emissive glass split into a world-space pane grid: each pane
    // is lit, dead or flickering. pane / offset line the grid up
    // with the building's mullions, so each building gets its own
    // material (they still share one shader program).
    // =============================================================

    createRuinWindows(
        color,
        pane,
        offset,
        dead = 0.3,
        flicker = 0.12
    ) {

        return this.applyRuinShader(
            new THREE.MeshStandardMaterial({
                map: this.ruin.glassTexture,
                color: 0x2a3a40,
                emissive: color,
                emissiveIntensity: 0.9,
                roughness: 0.3,
                metalness: 0.3,
                transparent: true,
                opacity: 0.9
            }),
            {
                grime: 5,
                window: { pane, offset, dead, flicker }
            }
        );
    }


    // =============================================================
    // RUIN SHADER PATCH
    // grime:  darkens toward the base up to this height (m), with
    //         vertical streaks and blotches
    // crack:  strength of glowing cyan voronoi cracks, in patches
    // window: per-pane lit / dead / flicker states
    // All patterns are in world space on the surface's dominant
    // plane, so no UVs or extra textures are needed.
    // =============================================================

    applyRuinShader(
        material,
        {
            grime = 0,
            crack = 0,
            window = null
        } = {}
    ) {

        material.defines = {
            ...material.defines,
            RUIN: ''
        };

        if (grime > 0) material.defines.RUIN_GRIME = '';
        if (crack > 0) material.defines.RUIN_CRACKS = '';
        if (window) material.defines.RUIN_WINDOWS = '';

        const uniforms = {
            uRuinTime: this.ruinTime,
            uGrimeHeight: { value: grime },
            uCrack: { value: crack },
            uCrackColor: { value: new THREE.Color(STREET_LIGHT_COLOR) },
            uPane: { value: new THREE.Vector2(...(window ? window.pane : [1, 1])) },
            uPaneOffset: { value: new THREE.Vector2(...(window ? window.offset : [0, 0])) },
            uDead: { value: window ? window.dead : 0 },
            uFlicker: { value: window ? window.flicker : 0 }
        };

        material.onBeforeCompile = (shader) => {

            Object.assign(
                shader.uniforms,
                uniforms
            );

            shader.vertexShader = shader.vertexShader
                .replace(
                    '#include <common>',
                    `#include <common>
                    varying vec3 vRuinWorld;
                    varying vec3 vRuinNormal;`
                )
                .replace(
                    '#include <project_vertex>',
                    `#include <project_vertex>
                    vRuinWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
                    vRuinNormal = normalize(mat3(modelMatrix) * objectNormal);`
                );

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <common>',
                    `#include <common>
                    ${RUIN_SHADER_COMMON}`
                )
                .replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>
                    ${RUIN_SHADER_GRIME}`
                )
                .replace(
                    '#include <emissivemap_fragment>',
                    `#include <emissivemap_fragment>
                    ${RUIN_SHADER_EMISSIVE}`
                );
        };

        return material;
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
// BRICK
// Shared ruined brick: grime at the base, cyan cracks
// =============================================================

const brickMaterial =
    this.ruin.brick;


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
        './assets/textures/poster.png'
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

        // Ruined city palette (shared, see createRuinMaterials)
        const concrete =
            this.ruin.concrete;

        const concreteDark =
            this.ruin.debris;

        const structuralWhite =
            this.ruin.bone;

        const darkInterior =
            new THREE.MeshStandardMaterial({
                color: 0x10141b,
                roughness: 0.42,
                metalness: 0.7
            });

        const glass =
            this.ruin.glass;

        // Floor-height panes lined up with the front columns
        // (world x = x + i * 2.45, floors every 4 from y 1.9)
        const glassDark =
            this.createRuinWindows(
                0x8fdcff,
                [2.45, 4],
                [x - 2.45 * 5, 1.9],
                0.35,
                0.15
            );

        // Red warning bands kept as this building's own colour,
        // dimmed so they read as accents against the sunset
        const redGlow =
            new THREE.MeshStandardMaterial({
                color: 0xa81c28,
                emissive: 0xff1022,
                emissiveIntensity: 0.8,
                roughness: 0.4,
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


            // Top floor: the last two bays were never rendered
            const unfinished =
                floor === 2;

            const glassWidth =
                unfinished ? 16 : 21;

            const frontGlass =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        glassWidth,
                        2.7,
                        0.12
                    ),
                    glassDark
                );

            frontGlass.position.set(
                (glassWidth - 21) / 2,
                y + 1.75,
                -14.65
            );

            building.add(
                frontGlass
            );

            if (unfinished) {

                const ghostBays =
                    new THREE.Mesh(
                        new THREE.BoxGeometry(
                            5,
                            2.7,
                            0.6,
                            2,
                            2,
                            1
                        ),
                        this.ruin.wire
                    );

                ghostBays.position.set(
                    8,
                    y + 1.75,
                    -14.65
                );

                ghostBays.userData.noShadow =
                    true;

                building.add(
                    ghostBays
                );
            }


            // Middle floor band is snapped in two
            const bandPieces =
                floor === 1
                    ? [[-5.5, 9], [7.2, 5.6]]
                    : [[0, 20]];

            bandPieces.forEach(
                ([bandX, bandWidth]) => {

                    const redBand =
                        new THREE.Mesh(
                            new THREE.BoxGeometry(
                                bandWidth,
                                0.16,
                                0.18
                            ),
                            redGlow
                        );

                    redBand.position.set(
                        bandX,
                        y + 0.45,
                        -15.15
                    );

                    building.add(
                        redBand
                    );
                }
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

        // A fourth storey the simulation started but never
        // finished: only its wireframe was generated
        const ghostStorey =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    12,
                    4,
                    14,
                    4,
                    2,
                    4
                ),
                this.ruin.wire
            );

        ghostStorey.position.set(
            -6,
            15.75,
            5
        );

        ghostStorey.userData.noShadow =
            true;

        building.add(
            ghostStorey
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


        // Dimmed from 10: the emissive windows and cracks
        // now carry the facade
        const light =
            new THREE.PointLight(
                0xff2638,
                6,
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
            this.ruin.debris;

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

        // Formerly bright white shells, now weathered ash.
        // Colour-only ageing: the brick panels don't suit the
        // smooth tubes, so grime and cracks come from the shader.
        const shell =
            this.applyRuinShader(
                new THREE.MeshStandardMaterial({
                    color: 0x8c8a84,
                    roughness: 0.65,
                    metalness: 0.2
                }),
                { grime: 6, crack: 0.8 }
            );

        const shellBright =
            this.applyRuinShader(
                new THREE.MeshStandardMaterial({
                    color: 0x9e9b94,
                    roughness: 0.6,
                    metalness: 0.2
                }),
                { grime: 6, crack: 0.8 }
            );

        const shellDark =
            this.ruin.bone;

        const glass =
            this.ruin.glass;

        const darkGlass =
            this.ruin.deadGlass;

        const cyan =
            this.ruin.glitch;

        // One warm strip behind each front panel (x every
        // 1.85, rows centred on y 7.1 and 12.4), some dead,
        // some flickering
        const warmInterior =
            this.createRuinWindows(
                0xc58c72,
                [1.85, 5.3],
                [x - 1.85 * 3.5, 4.45],
                0.4,
                0.2
            );


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
        // Two storeys of panels set flush on the glass core's
        // front face (z -10.5, 13 wide), one storey between each
        // pair of platforms.
        // Per slot: dead (blacked out), gone (missing) or
        // wire (never rendered); anything else is smudged glass
        // =========================================================

        const coreFrontZ =
            1 - 23 / 2;

        const panelSpacing =
            1.85;

        const panelRows = [
            {
                y: 7.1,
                height: 3.3,
                slots: { '-2': 'dead', '1': 'gone', '3': 'wire' }
            },
            {
                y: 12.4,
                height: 3.0,
                slots: { '-3': 'gone', '0': 'dead', '2': 'dead' }
            }
        ];

        const panelMaterial = {
            dead: darkGlass,
            wire: this.ruin.wire
        };

        panelRows.forEach(
            (row) => {

                for (
                    let i = -3;
                    i <= 3;
                    i++
                ) {

                    const state =
                        row.slots[i];

                    // Warm light behind every slot, even missing
                    // ones, just inside the core glass
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
                        i * panelSpacing,
                        row.y - 0.9,
                        coreFrontZ + 0.2
                    );

                    building.add(
                        interior
                    );

                    if (state === 'gone') continue;

                    const panel =
                        new THREE.Mesh(
                            new THREE.BoxGeometry(
                                panelSpacing - 0.1,
                                row.height,
                                0.12
                            ),
                            panelMaterial[state] || glass
                        );

                    panel.position.set(
                        i * panelSpacing,
                        row.y,
                        coreFrontZ - 0.08
                    );

                    panel.userData.noShadow =
                        state === 'wire';

                    building.add(
                        panel
                    );
                }
            }
        );


        // =========================================================
        // CYAN ARCHITECTURAL LIGHT
        // Along the front edge of the middle platform, following
        // its tilt, broken into three pieces with dark gaps
        // =========================================================

        const stripTilt =
            middlePlatform.rotation.z;

        [[-4.3, 4.4], [0.9, 3.0], [5.0, 2.8]].forEach(
            ([stripX, stripWidth]) => {

                const cyanStrip =
                    new THREE.Mesh(
                        new THREE.BoxGeometry(
                            stripWidth,
                            0.12,
                            0.15
                        ),
                        cyan
                    );

                cyanStrip.position.set(
                    stripX,
                    9.1 + stripX * Math.sin(stripTilt),
                    coreFrontZ - 0.1
                );

                cyanStrip.rotation.z =
                    stripTilt;

                building.add(
                    cyanStrip
                );
            }
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

        // Dimmed from 12: the glitch strip and flickering
        // windows now carry the facade
        const organicLight =
            new THREE.PointLight(
                0x00d9ff,
                8,
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

        // Hangs off the core's front-left corner
        broken.position.set(
            -7.2,
            11,
            -10.75
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
            this.ruin.debris;

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

        // Glassy Road.png skin with a clearcoat for the shine. The
        // scene has no environment, so the skybox is loaded as an
        // equirect reflection map for the dome alone - without it a
        // glossy surface has nothing to reflect and reads flat.
        const textureLoader =
            new THREE.TextureLoader();

        const domeTexture =
            textureLoader.load(
                './assets/textures/Road.png'
            );

        domeTexture.colorSpace =
            THREE.SRGBColorSpace;

        domeTexture.wrapS =
            THREE.RepeatWrapping;

        domeTexture.wrapT =
            THREE.RepeatWrapping;

        domeTexture.repeat.set(
            4,
            2
        );

        const domeEnvMap =
            textureLoader.load(
                './assets/textures/skybox1.png'
            );

        domeEnvMap.mapping =
            THREE.EquirectangularReflectionMapping;

        domeEnvMap.colorSpace =
            THREE.SRGBColorSpace;

        const domeGlass =
            new THREE.MeshPhysicalMaterial({
                map: domeTexture,
                envMap: domeEnvMap,
                envMapIntensity: 1.5,
                roughness: 0.05,
                metalness: 0.4,
                clearcoat: 1,
                clearcoatRoughness: 0.02,
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
            0,
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
        const domeBaseY = 0.6;

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




    // =============================================================
    // DEFORESTATION BACKGROUND
    // Cleared dry land behind the buildings (-X side): cut stumps,
    // a few dead trees still standing, fallen logs and a dark line
    // of remaining forest in the distance.
    // Background only, so it is kept cheap:
    //   - stumps / dead trees / logs are one InstancedMesh each,
    //     sharing one Lambert material; bark and cut-wood colours
    //     are baked into vertex colours so there are no extra
    //     draw calls for the pale cut faces
    //   - the distant forest is one flat textured strip
    //   - nothing casts shadows, no lights, the fog hides the far
    //     edge
    // Everything stays at x <= -48; the furthest building edge is
    // at x -42.2.
    // =============================================================

    createDeforestation() {

        const CLEAR_X_NEAR = -48;   // edge nearest the buildings
        const CLEAR_X_FAR = -200;   // where the forest line stands
        const CLEAR_Z_MIN = -290;
        const CLEAR_Z_MAX = 290;

        // Size of stumps, dead trees and logs, scaled up so they read
        // against the large buildings
        const PROP_SCALE = 1.8;

        // Seeded random (mulberry32) so the layout is identical on
        // every load
        let seed = 1337;

        const rand = () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let t = seed;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        const range = (a, b) => a + (b - a) * rand();

        // Random x inside the cleared band. bias > 1 pushes points
        // away from the city, so the clearing gets busier further
        // out. margin keeps wide pieces clear of the city edge.
        const randomX = (bias, margin = 4) => {
            const near = CLEAR_X_NEAR - margin;
            const far = CLEAR_X_FAR + 6;
            return near + (far - near) * Math.pow(rand(), 1 / bias);
        };

        const randomZ = () => range(CLEAR_Z_MIN, CLEAR_Z_MAX);

        // Background pieces: receive the buildings' long sunset
        // shadows (free - no extra draw calls) but never cast any.
        // noShadow keeps the constructor's shadow pass off them.
        const markBackground = (mesh, receive) => {
            mesh.userData.noShadow = true;
            mesh.castShadow = false;
            mesh.receiveShadow = receive;
        };


        // ---------------------------------------------------------
        // DRY DIRT
        // One plane over the existing ground, with a dusty dirt
        // texture drawn on a canvas (no new image file). An alpha
        // map fades its edges so there is no hard line against the
        // flagstone ground.
        // ---------------------------------------------------------

        const dirtCanvas = document.createElement('canvas');
        dirtCanvas.width = 512;
        dirtCanvas.height = 512;

        const dirt = dirtCanvas.getContext('2d');

        dirt.fillStyle = '#6b5d4c';
        dirt.fillRect(0, 0, 512, 512);

        // Soft lighter (dry) and darker (bare earth) patches, drawn
        // wrapped so the tile repeats without seams
        for (let i = 0; i < 60; i++) {

            const x = range(0, 512);
            const y = range(0, 512);
            const r = range(20, 90);

            const gradient = dirt.createRadialGradient(x, y, 0, x, y, r);

            gradient.addColorStop(
                0,
                rand() < 0.5
                    ? 'rgba(150, 132, 106, 0.35)'
                    : 'rgba(58, 48, 38, 0.35)'
            );
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            dirt.fillStyle = gradient;

            for (const ox of [-512, 0, 512]) {
                for (const oy of [-512, 0, 512]) {
                    dirt.save();
                    dirt.translate(ox, oy);
                    dirt.fillRect(x - r, y - r, r * 2, r * 2);
                    dirt.restore();
                }
            }
        }

        // Dry cracks: short random walks kept away from the tile
        // edges
        dirt.strokeStyle = 'rgba(40, 32, 24, 0.45)';

        for (let i = 0; i < 25; i++) {

            let x = range(60, 452);
            let y = range(60, 452);
            let angle = range(0, Math.PI * 2);

            dirt.lineWidth = range(0.8, 1.8);
            dirt.beginPath();
            dirt.moveTo(x, y);

            for (let s = 0; s < 8; s++) {
                angle += range(-0.7, 0.7);
                x += Math.cos(angle) * range(4, 9);
                y += Math.sin(angle) * range(4, 9);
                dirt.lineTo(x, y);
            }

            dirt.stroke();
        }

        // Small stones and wood chips
        for (let i = 0; i < 500; i++) {

            dirt.fillStyle =
                rand() < 0.5
                    ? 'rgba(160, 145, 120, 0.6)'
                    : 'rgba(45, 38, 30, 0.6)';

            dirt.fillRect(range(0, 512), range(0, 512), range(1, 3), range(1, 3));
        }

        // Fine grain
        const dirtPixels = dirt.getImageData(0, 0, 512, 512);

        for (let i = 0; i < dirtPixels.data.length; i += 4) {

            const grain = (rand() - 0.5) * 28;

            dirtPixels.data[i] += grain;
            dirtPixels.data[i + 1] += grain;
            dirtPixels.data[i + 2] += grain;
        }

        dirt.putImageData(dirtPixels, 0, 0);

        const DIRT_X_FAR = CLEAR_X_FAR - 10;   // runs under the forest line
        const DIRT_WIDTH = CLEAR_X_NEAR - DIRT_X_FAR;
        const DIRT_LENGTH = CLEAR_Z_MAX - CLEAR_Z_MIN;

        const dirtTexture = new THREE.CanvasTexture(dirtCanvas);

        dirtTexture.colorSpace = THREE.SRGBColorSpace;
        dirtTexture.wrapS = THREE.RepeatWrapping;
        dirtTexture.wrapT = THREE.RepeatWrapping;
        dirtTexture.anisotropy = 4;

        // One tile = about 16 x 16 units
        dirtTexture.repeat.set(
            DIRT_WIDTH / 16,
            DIRT_LENGTH / 16
        );

        // Alpha map: u runs from the far edge (0) to the city edge
        // (1), v along the road. Fades 12 units at the city edge and
        // 20 units at each end.
        const fadeCanvas = document.createElement('canvas');
        fadeCanvas.width = 64;
        fadeCanvas.height = 64;

        const fade = fadeCanvas.getContext('2d');
        const fadePixels = fade.createImageData(64, 64);

        const smooth = (t) => {
            const c = Math.min(Math.max(t, 0), 1);
            return c * c * (3 - 2 * c);
        };

        for (let py = 0; py < 64; py++) {
            for (let px = 0; px < 64; px++) {

                const u = (px + 0.5) / 64;
                const v = (py + 0.5) / 64;

                const alpha =
                    smooth((1 - u) * DIRT_WIDTH / 12) *
                    smooth(v * DIRT_LENGTH / 20) *
                    smooth((1 - v) * DIRT_LENGTH / 20);

                const i = (py * 64 + px) * 4;

                fadePixels.data[i] = alpha * 255;
                fadePixels.data[i + 1] = alpha * 255;
                fadePixels.data[i + 2] = alpha * 255;
                fadePixels.data[i + 3] = 255;
            }
        }

        fade.putImageData(fadePixels, 0, 0);

        const dirtPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(DIRT_WIDTH, DIRT_LENGTH),
            new THREE.MeshLambertMaterial({
                map: dirtTexture,
                alphaMap: new THREE.CanvasTexture(fadeCanvas),
                color: 0xd4cabb,
                transparent: true,
                depthWrite: false,
                // Stops flicker against the ground plane below
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            })
        );

        dirtPlane.rotation.x = -Math.PI / 2;

        dirtPlane.position.set(
            (CLEAR_X_NEAR + DIRT_X_FAR) / 2,
            0.03,
            (CLEAR_Z_MIN + CLEAR_Z_MAX) / 2
        );

        markBackground(dirtPlane, true);

        this.level.add(dirtPlane);


        // ---------------------------------------------------------
        // SHARED WOOD MATERIAL
        // Vertex colours hold bark vs cut wood; the per-instance
        // colour multiplies on top for variation.
        // ---------------------------------------------------------

        const woodMaterial = new THREE.MeshLambertMaterial({
            vertexColors: true
        });

        // Bakes a colour per vertex: cut colour where isCut(normal)
        // is true, bark everywhere else
        const paintWood = (geometry, barkHex, cutHex, isCut) => {

            const bark = new THREE.Color(barkHex);
            const cut = new THREE.Color(cutHex);
            const normals = geometry.attributes.normal;
            const colors = new Float32Array(normals.count * 3);

            for (let i = 0; i < normals.count; i++) {

                const colour =
                    isCut(normals.getX(i), normals.getY(i), normals.getZ(i))
                        ? cut
                        : bark;

                colour.toArray(colors, i * 3);
            }

            geometry.setAttribute(
                'color',
                new THREE.BufferAttribute(colors, 3)
            );

            return geometry;
        };

        // Weathered grey-brown shade with a slight warm/cool shift
        const woodTint = new THREE.Color();

        const randomWoodTint = () => {
            const value = range(0.75, 1.1);
            const warm = range(-0.06, 0.06);
            return woodTint.setRGB(
                value * (1 + warm),
                value,
                value * (1 - warm)
            );
        };

        const dummy = new THREE.Object3D();


        // ---------------------------------------------------------
        // CUT STUMPS
        // 7-sided tapered cylinder with a pale sawn top. The unseen
        // bottom cap is dropped (21 triangles each).
        // ---------------------------------------------------------

        const STUMP_COUNT = 600;

        const stumpGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1, 7, 1);

        // Groups are [sides, top cap, bottom cap]: keep the first two
        stumpGeometry.setIndex(
            Array.from(stumpGeometry.index.array).slice(
                0,
                stumpGeometry.groups[2].start
            )
        );
        stumpGeometry.clearGroups();
        stumpGeometry.translate(0, 0.5, 0);

        paintWood(stumpGeometry, 0x4e443a, 0x9c8a6e, (x, y) => y > 0.5);

        const stumps = new THREE.InstancedMesh(
            stumpGeometry,
            woodMaterial,
            STUMP_COUNT
        );

        for (let i = 0; i < STUMP_COUNT; i++) {

            // Mostly low stumps, the odd tall broken snag
            const height =
                rand() < 0.1
                    ? range(1.4, 2.2)
                    : range(0.35, 1.1);

            const girth = range(0.55, 1.4);

            dummy.position.set(randomX(1.4), -0.05, randomZ());

            // Tilt makes the sawn tops slanted and uneven
            dummy.rotation.set(
                range(-0.08, 0.08),
                range(0, Math.PI * 2),
                range(-0.08, 0.08)
            );

            dummy.scale.set(girth, height, girth).multiplyScalar(PROP_SCALE);
            dummy.updateMatrix();

            stumps.setMatrixAt(i, dummy.matrix);
            stumps.setColorAt(i, randomWoodTint());
        }

        markBackground(stumps, true);

        this.level.add(stumps);


        // ---------------------------------------------------------
        // DEAD TREES
        // Bare trunk plus five crooked branches, merged into one
        // geometry. Open-ended cylinders: the ends are never seen.
        // ---------------------------------------------------------

        const DEAD_TREE_COUNT = 50;

        const deadTreeParts = [];

        const trunk = new THREE.CylinderGeometry(0.1, 0.32, 9, 6, 1, true);
        trunk.translate(0, 4.5, 0);
        deadTreeParts.push(trunk);

        const branchSpecs = [
            // height on trunk, length, lean out, direction
            [3.6, 2.8, 0.9, 0.3],
            [4.8, 2.2, 0.75, 2.4],
            [5.9, 2.0, 0.8, 4.1],
            [6.8, 1.5, 0.6, 1.2],
            [7.6, 1.1, 0.5, 5.3]
        ];

        for (const [y, length, lean, direction] of branchSpecs) {

            const branch = new THREE.CylinderGeometry(0.02, 0.1, length, 5, 1, true);

            branch.translate(0, length / 2, 0);
            branch.rotateZ(lean);
            branch.rotateY(direction);
            branch.translate(0, y, 0);

            deadTreeParts.push(branch);
        }

        const deadTreeGeometry = mergeGeometries(deadTreeParts);

        deadTreeParts.forEach((part) => part.dispose());

        paintWood(deadTreeGeometry, 0x6e665d, 0x6e665d, () => false);

        const deadTrees = new THREE.InstancedMesh(
            deadTreeGeometry,
            woodMaterial,
            DEAD_TREE_COUNT
        );

        for (let i = 0; i < DEAD_TREE_COUNT; i++) {

            const size = range(0.7, 1.5);
            const thickness = size * range(0.8, 1.2);

            // Branches reach about 5 units out at full size
            dummy.position.set(randomX(1, 10), -0.1, randomZ());

            dummy.rotation.set(
                range(-0.1, 0.1),
                range(0, Math.PI * 2),
                range(-0.1, 0.1)
            );

            dummy.scale.set(thickness, size, thickness).multiplyScalar(PROP_SCALE);
            dummy.updateMatrix();

            deadTrees.setMatrixAt(i, dummy.matrix);
            deadTrees.setColorAt(i, randomWoodTint());
        }

        markBackground(deadTrees, true);

        this.level.add(deadTrees);


        // ---------------------------------------------------------
        // FALLEN LOGS
        // Lying along x before rotation, pale sawn ends. Placed in
        // small clumps like felled and abandoned timber.
        // ---------------------------------------------------------

        const LOG_COUNT = 80;
        const LOGS_PER_CLUMP = 4;

        const logGeometry = new THREE.CylinderGeometry(0.33, 0.38, 1, 7, 1);

        logGeometry.rotateZ(Math.PI / 2);

        paintWood(
            logGeometry,
            0x4a4036,
            0x8a785e,
            (x) => Math.abs(x) > 0.5
        );

        const logs = new THREE.InstancedMesh(
            logGeometry,
            woodMaterial,
            LOG_COUNT
        );

        let clumpX = 0;
        let clumpZ = 0;

        for (let i = 0; i < LOG_COUNT; i++) {

            if (i % LOGS_PER_CLUMP === 0) {
                // Long logs need extra room from the city edge
                clumpX = Math.min(randomX(1.2), CLEAR_X_NEAR - 16);
                clumpZ = randomZ();
            }

            const length = range(3, 8);
            const girth = range(0.7, 1.4);

            dummy.position.set(
                clumpX + range(-4, 4),
                0.36 * girth * PROP_SCALE - 0.05,
                clumpZ + range(-6, 6)
            );

            dummy.rotation.set(
                range(0, Math.PI * 2),   // roll: hides the 7 sides
                range(0, Math.PI * 2),
                range(-0.04, 0.04)
            );
            dummy.rotation.order = 'YZX';

            dummy.scale.set(length, girth, girth).multiplyScalar(PROP_SCALE);
            dummy.updateMatrix();

            logs.setMatrixAt(i, dummy.matrix);
            logs.setColorAt(i, randomWoodTint());
        }

        markBackground(logs, true);

        this.level.add(logs);


        // ---------------------------------------------------------
        // DISTANT FOREST LINE
        // A single gently curving strip with a treeline silhouette
        // drawn on a canvas. Unlit (MeshBasicMaterial) and fogged,
        // so it reads as a dark wall of remaining forest.
        // ---------------------------------------------------------

        const FOREST_HEIGHT = 42;
        const FOREST_TILE = 126;        // units of z per texture repeat
        const FOREST_SEGMENTS = 48;
        const FOREST_Z_MIN = -300;
        const FOREST_Z_MAX = 300;

        const forestCanvas = document.createElement('canvas');
        forestCanvas.width = 1024;
        forestCanvas.height = 256;

        const forest = forestCanvas.getContext('2d');

        // Canvas y for a tree of a given height in units
        const treeTopY = (height) => 256 * (1 - height / FOREST_HEIGHT);

        const TREE_BASE_Y = 180;

        const drawConifer = (cx, top, width) => {

            const tiers = Math.floor(range(6, 10));
            const right = [];
            const left = [];

            for (let k = 1; k <= tiers; k++) {

                const y = top + (k / tiers) * (TREE_BASE_Y - top);
                const half = (width / 2) * (k / tiers);

                right.push([cx + half * range(0.8, 1.1), y]);
                right.push([cx + half * 0.55, y + range(1, 4)]);
                left.push([cx - half * range(0.8, 1.1), y]);
                left.push([cx - half * 0.55, y + range(1, 4)]);
            }

            forest.beginPath();
            forest.moveTo(cx + range(-1, 1), top);
            right.forEach(([x, y]) => forest.lineTo(x, y));
            left.reverse().forEach(([x, y]) => forest.lineTo(x, y));
            forest.closePath();
            forest.fill();
        };

        const drawBroadleaf = (cx, top, width) => {

            const blobs = Math.floor(range(5, 9));

            for (let b = 0; b < blobs; b++) {

                const r = range(0.25, 0.45) * width;

                forest.beginPath();
                forest.arc(
                    cx + range(-0.35, 0.35) * width,
                    top + r + range(0, 0.4) * (TREE_BASE_Y - top),
                    r,
                    0,
                    Math.PI * 2
                );
                forest.fill();
            }

            forest.fillRect(cx - width * 0.3, top + width * 0.4, width * 0.6, TREE_BASE_Y);
        };

        // Back layer slightly lighter, front layer near black
        const forestLayers = [
            { colour: '#262820', minHeight: 28, maxHeight: 39 },
            { colour: '#15180f', minHeight: 20, maxHeight: 34 }
        ];

        for (const layer of forestLayers) {

            forest.fillStyle = layer.colour;

            let x = range(0, 30);

            while (x < 1024) {

                const width = range(40, 90);
                const top = treeTopY(range(layer.minHeight, layer.maxHeight));
                const conifer = rand() < 0.7;

                // Drawn again one tile to each side so the strip
                // repeats without a seam
                for (const offset of [-1024, 0, 1024]) {
                    if (conifer) {
                        drawConifer(x + offset, top, width);
                    } else {
                        drawBroadleaf(x + offset, top, width);
                    }
                }

                x += width * range(0.35, 0.6);
            }
        }

        // Solid undergrowth band down to the ground
        forest.fillStyle = forestLayers[1].colour;
        forest.fillRect(0, TREE_BASE_Y - 10, 1024, 256);

        const forestTexture = new THREE.CanvasTexture(forestCanvas);

        forestTexture.colorSpace = THREE.SRGBColorSpace;
        forestTexture.wrapS = THREE.RepeatWrapping;
        forestTexture.anisotropy = 4;

        // Strip vertices: bottom and top at each z step, with a gentle
        // wobble in x so the forest edge is not a ruler-straight line
        const forestPositions = [];
        const forestUvs = [];
        const forestIndices = [];

        for (let s = 0; s <= FOREST_SEGMENTS; s++) {

            const z =
                FOREST_Z_MIN +
                (s / FOREST_SEGMENTS) * (FOREST_Z_MAX - FOREST_Z_MIN);

            const x =
                CLEAR_X_FAR - 4 +
                Math.sin(z * 0.011) * 5 +
                Math.sin(z * 0.037 + 1.3) * 2;

            const u = (z - FOREST_Z_MIN) / FOREST_TILE;

            forestPositions.push(x, -0.5, z, x, FOREST_HEIGHT, z);
            forestUvs.push(u, 0, u, 1);

            if (s < FOREST_SEGMENTS) {
                const a = s * 2;
                forestIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
            }
        }

        const forestGeometry = new THREE.BufferGeometry();

        forestGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(forestPositions, 3)
        );
        forestGeometry.setAttribute(
            'uv',
            new THREE.Float32BufferAttribute(forestUvs, 2)
        );
        forestGeometry.setIndex(forestIndices);

        const forestLine = new THREE.Mesh(
            forestGeometry,
            new THREE.MeshBasicMaterial({
                map: forestTexture,
                alphaTest: 0.5,
                side: THREE.DoubleSide
            })
        );

        markBackground(forestLine, false);

        this.level.add(forestLine);
    }


    // =============================================================
    // UPDATE
    // =============================================================

    update(
        deltaTime
    ) {

        if (this.riverMaterial) {

    this.riverMaterial.uniforms.uTime.value +=
        deltaTime;
}

        // Ruined buildings: one shared time uniform drives every
        // crack pulse and window flicker; one material update
        // makes all the unrendered wireframes shimmer
        if (this.ruinTime) {

            this.ruinTime.value +=
                deltaTime;

            const t =
                this.ruinTime.value;

            this.ruin.wire.opacity =
                0.28 +
                Math.sin(t * 3.1) * 0.06 +
                (Math.sin(t * 23.0) > 0.97 ? 0.25 : 0);
        }

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
    }
}
