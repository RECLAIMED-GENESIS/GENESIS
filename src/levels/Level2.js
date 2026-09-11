import * as THREE from 'three';

export class Level1 {

    constructor() {

        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(0x09051c);

        this.scene.fog = new THREE.Fog(
            0x10082a,
            45,
            260
        );

        this.level = new THREE.Group();
        this.scene.add(this.level);


        // =====================================================
        // TEXTURE LOADER
        // =====================================================

        const textureLoader = new THREE.TextureLoader();
        // =====================================================
// BUILDING TEXTURE
// =====================================================

const buildingTexture = textureLoader.load(
    '/assets/textures/brick.png'
);

buildingTexture.wrapS = THREE.RepeatWrapping;
buildingTexture.wrapT = THREE.RepeatWrapping;

// Repeat the texture instead of stretching it over the building
buildingTexture.repeat.set(2, 4);

// The texture is a colour/albedo texture
buildingTexture.colorSpace = THREE.SRGBColorSpace;

this.buildingTexture = buildingTexture;

        // =====================================================
        // SKYBOX
        // =====================================================

const skyTexture = textureLoader.load(
    '/assets/textures/skybox1.png'
);

skyTexture.colorSpace = THREE.SRGBColorSpace;

const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
});

const skyGeometry = new THREE.SphereGeometry(
    500,
    64,
    32
);

this.sky = new THREE.Mesh(
    skyGeometry,
    skyMaterial
);

this.sky.position.set(
    0,
    0,
    0
);

this.scene.add(this.sky);

        // =====================================================
        // LIGHTING
        // =====================================================

        const ambient = new THREE.AmbientLight(
            0x625b9c,
            2.0
        );

        this.level.add(ambient);


        const sunset = new THREE.DirectionalLight(
    0xd8d4ff,
    1.5
);

        sunset.position.set(
            -60,
            80,
            40
        );

        sunset.castShadow = true;

        sunset.shadow.mapSize.width = 2048;
        sunset.shadow.mapSize.height = 2048;

        this.level.add(sunset);


        const cyanLight = new THREE.PointLight(
            0x00d9ff,
            40,
            70
        );

        cyanLight.position.set(
            0,
            15,
            -80
        );

        this.level.add(cyanLight);


        const purpleLight = new THREE.PointLight(
            0xb000ff,
            35,
            80
        );

        purpleLight.position.set(
            20,
            20,
            100
        );

        this.level.add(purpleLight);


        // =====================================================
        // MAIN ROAD
        // =====================================================

        const roadTexture = textureLoader.load(
            '/assets/textures/Level2-road.png'
        );

        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;

        roadTexture.repeat.set(1, 8);


        const roadMaterial =
            new THREE.MeshStandardMaterial({

                map: roadTexture,

                roughness: 0.18,

                metalness: 0.65

            });


        const roadGeometry =
            new THREE.BoxGeometry(
                16,
                0.5,
                260
            );


        const road =
            new THREE.Mesh(
                roadGeometry,
                roadMaterial
            );


        road.position.set(
            0,
            -0.25,
            0
        );


        road.receiveShadow = true;

        this.level.add(road);

        // =====================================================
// WORLD GROUND
// =====================================================

const groundTexture = textureLoader.load(
    '/assets/textures/ground.png'
);

groundTexture.wrapS = THREE.RepeatWrapping;
groundTexture.wrapT = THREE.RepeatWrapping;

groundTexture.repeat.set(80, 80);

groundTexture.colorSpace = THREE.SRGBColorSpace;

const groundMaterial =
    new THREE.MeshStandardMaterial({

        map: groundTexture,

        color: 0x777777,

        roughness: 0.95,

        metalness: 0.05

    });

const ground =
    new THREE.Mesh(

        new THREE.PlaneGeometry(
            600,
            600
        ),

        groundMaterial

    );

ground.rotation.x = -Math.PI / 2;

ground.position.set(
    0,
    -0.01,
    0
);

ground.receiveShadow = true;

this.level.add(ground);

        // =====================================================
        // ROAD NEON EDGES
        // =====================================================

        const neon =
            new THREE.MeshStandardMaterial({

                color: 0x00d9ff,

                emissive: 0x00d9ff,

                emissiveIntensity: 5,

                metalness: 0.2,

                roughness: 0.25

            });


        this.createLongLine(-6.5, neon);
        this.createLongLine(6.5, neon);


        // =====================================================
        // BROKEN CENTER ROAD MARKINGS
        // =====================================================

        for (
            let z = -125;
            z < 130;
            z += 10
        ) {

            const geometry =
                new THREE.BoxGeometry(
                    0.2,
                    0.08,
                    5
                );


            const line =
                new THREE.Mesh(
                    geometry,
                    neon
                );


            line.position.set(
                0,
                0.05,
                z
            );


            this.level.add(line);

        }


        // =====================================================
        // CITY SECTIONS
        // =====================================================

        this.createCityBlock(-105);
        this.createCityBlock(-65);

        this.createCombatZone(-25);

        this.createIntersection(10);

        this.createUpperCity(50);

        this.createFloatingSection(90);

        this.createBossArea(125);


        // =====================================================
        // DISTANT CITY
        // =====================================================

        this.createDistantCity();


        // =====================================================
        // PORTAL
        // =====================================================

        this.createPortal(
            0,
            5,
            145
        );


        // =====================================================
        // SHADOWS
        // =====================================================

        this.level.traverse(object => {

            if (object.isMesh) {

                object.castShadow = true;

                object.receiveShadow = true;

            }

        });

    }


    // =========================================================
    // ROAD LINE
    // =========================================================

    createLongLine(x, material) {

        const geometry =
            new THREE.BoxGeometry(
                0.18,
                0.08,
                260
            );


        const line =
            new THREE.Mesh(
                geometry,
                material
            );


        line.position.set(
            x,
            0.05,
            0
        );


        this.level.add(line);

    }


    // =========================================================
    // CITY BLOCK
    // =========================================================

    createCityBlock(z) {

        // Left buildings

        this.createBuilding(
            -16,
            z - 10,
            10,
            18 + Math.random() * 10,
            12,
            0x292442
        );


        this.createBuilding(
            -17,
            z + 10,
            8,
            12 + Math.random() * 12,
            11,
            0x33284c
        );


        // Right buildings

        this.createBuilding(
            16,
            z - 10,
            11,
            20 + Math.random() * 12,
            13,
            0x252743
        );


        this.createBuilding(
            17,
            z + 10,
            9,
            15 + Math.random() * 15,
            12,
            0x39294c
        );


        // Rubble

        this.createRubble(-10, z - 5);
        this.createRubble(10, z + 5);

    }


    // =========================================================
    // COMBAT ZONE
    // =========================================================

    createCombatZone(z) {

        // Open arena

        const arenaMaterial =
            new THREE.MeshStandardMaterial({

                color: 0x211b38,

                metalness: 0.65,

                roughness: 0.4

            });


        const arenaGeometry =
            new THREE.BoxGeometry(
                28,
                0.35,
                28
            );


        const arena =
            new THREE.Mesh(
                arenaGeometry,
                arenaMaterial
            );


        arena.position.set(
            0,
            -0.05,
            z
        );


        this.level.add(arena);


        // Broken structures around arena

        this.createBuilding(
            -18,
            z,
            7,
            15,
            10,
            0x302746
        );


        this.createBuilding(
            18,
            z,
            7,
            21,
            10,
            0x292441
        );


        // Neon arena corners

        this.createGlowBlock(-12, 1, z - 12);
        this.createGlowBlock(12, 1, z - 12);
        this.createGlowBlock(-12, 1, z + 12);
        this.createGlowBlock(12, 1, z + 12);

    }


    // =========================================================
    // INTERSECTION
    // =========================================================

    createIntersection(z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x29233f,

                roughness: 0.65,

                metalness: 0.45

            });


        const geometry =
            new THREE.BoxGeometry(
                36,
                0.35,
                32
            );


        const intersection =
            new THREE.Mesh(
                geometry,
                material
            );


        intersection.position.set(
            0,
            -0.05,
            z
        );


        this.level.add(intersection);


        // Destroyed buildings

        this.createBuilding(
            -19,
            z,
            7,
            10,
            12,
            0x34294a
        );


        this.createBuilding(
            19,
            z,
            8,
            14,
            12,
            0x282541
        );


        // Lots of rubble

        for (
            let i = 0;
            i < 5;
            i++
        ) {

            this.createRubble(
                -13 + Math.random() * 26,
                z - 10 + Math.random() * 20
            );

        }

    }


    // =========================================================
    // UPPER CITY
    // =========================================================

    createUpperCity(z) {

        // Tall buildings

        this.createBuilding(
            -17,
            z - 10,
            10,
            30,
            14,
            0x29234a
        );


        this.createBuilding(
            -18,
            z + 12,
            9,
            25,
            12,
            0x35274d
        );


        this.createBuilding(
            17,
            z - 10,
            11,
            34,
            14,
            0x252849
        );


        this.createBuilding(
            18,
            z + 12,
            9,
            28,
            12,
            0x39274c
        );


        // Giant digital towers

        this.createTower(
            -27,
            z
        );


        this.createTower(
            27,
            z + 15
        );

    }


    // =========================================================
    // FLOATING PLATFORM SECTION
    // =========================================================

    createFloatingSection(z) {

        // Broken road

        const brokenRoad =
            new THREE.MeshStandardMaterial({

                color: 0x17142d,

                metalness: 0.7,

                roughness: 0.4

            });


        const geometry =
            new THREE.BoxGeometry(
                10,
                0.5,
                35
            );


        const road =
            new THREE.Mesh(
                geometry,
                brokenRoad
            );


        road.position.set(
            0,
            0,
            z
        );


        this.level.add(road);


        // Floating platforms

        this.createPlatform(
            -8,
            5,
            z - 12
        );


        this.createPlatform(
            8,
            8,
            z - 2
        );


        this.createPlatform(
            -7,
            11,
            z + 10
        );


        this.createPlatform(
            6,
            14,
            z + 20
        );


        // Broken chunks

        this.createRubble(
            -12,
            z
        );


        this.createRubble(
            12,
            z + 15
        );

    }


    // =========================================================
    // BOSS AREA
    // =========================================================

    createBossArea(z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x18142f,

                metalness: 0.8,

                roughness: 0.25,

                emissive: 0x160d35,

                emissiveIntensity: 1.5

            });


        const geometry =
            new THREE.CylinderGeometry(
                24,
                24,
                0.7,
                32
            );


        const arena =
            new THREE.Mesh(
                geometry,
                material
            );


        arena.position.set(
            0,
            0,
            z
        );


        this.level.add(arena);


        // Giant surrounding pillars

        for (
            let i = 0;
            i < 8;
            i++
        ) {

            const angle =
                (i / 8) *
                Math.PI *
                2;


            const x =
                Math.cos(angle) * 22;


            const zz =
                z +
                Math.sin(angle) * 22;


            this.createBossPillar(
                x,
                zz
            );

        }


        // Central boss platform

        const bossGlow =
            new THREE.MeshStandardMaterial({

                color: 0xff20c8,

                emissive: 0xff20c8,

                emissiveIntensity: 4

            });


        const bossGeometry =
            new THREE.CylinderGeometry(
                6,
                6,
                0.5,
                8
            );


        const bossPlatform =
            new THREE.Mesh(
                bossGeometry,
                bossGlow
            );


        bossPlatform.position.set(
            0,
            0.6,
            z
        );


        this.level.add(bossPlatform);

    }


    // =========================================================
    // BUILDING
    // =========================================================
    // =========================================================
    // =========================================================
// BUILDING
// =========================================================
createBuilding(
    x,
    z,
    width,
    height,
    depth,
    color
) {

    // =====================================================
    // BUILDING TEXTURE
    // =====================================================

    if (!this.buildingTexture) {

        const textureLoader =
            new THREE.TextureLoader();

        this.buildingTexture =
            textureLoader.load(
                '/assets/textures/brick.png'
            );

        this.buildingTexture.wrapS =
            THREE.RepeatWrapping;

        this.buildingTexture.wrapT =
            THREE.RepeatWrapping;

        this.buildingTexture.repeat.set(
            2,
            4
        );

        this.buildingTexture.colorSpace =
            THREE.SRGBColorSpace;
    }


    // =====================================================
    // MATERIAL
    // =====================================================

    const material =
        new THREE.MeshStandardMaterial({

            // Dark neutral grey.
            // This prevents the concrete becoming too red.
            color: 0xffffff,

            map: this.buildingTexture,

            roughness: 0.82,

            metalness: 0.12
        });


    // =====================================================
    // MAIN BUILDING
    // =====================================================

    const building =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                height,
                depth
            ),
            material
        );

    // IMPORTANT:
    // Bottom of building is exactly at y = 0.
    building.position.set(
        x,
        height / 2,
        z
    );

    building.castShadow = true;
    building.receiveShadow = true;

    this.level.add(building);


    // =====================================================
    // UPPER SECTION
    // =====================================================

    const upperWidth =
        width * 0.72;

    const upperHeight =
        height * 0.30;

    const upperDepth =
        depth * 0.78;


    const upper =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                upperWidth,
                upperHeight,
                upperDepth
            ),
            material
        );


    upper.position.set(

        x +
        (Math.random() - 0.5) *
        width *
        0.12,

        height +
        upperHeight / 2,

        z
    );


    upper.castShadow = true;
    upper.receiveShadow = true;

    this.level.add(upper);


    // =====================================================
    // TOP SECTION
    // =====================================================

    const topWidth =
        width * 0.40;

    const topHeight =
        height * 0.12;

    const topDepth =
        depth * 0.45;


    const top =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                topWidth,
                topHeight,
                topDepth
            ),
            material
        );


    top.position.set(

        x +
        (Math.random() - 0.5) *
        width *
        0.25,

        height +
        upperHeight +
        topHeight / 2,

        z
    );


    top.rotation.z =
        (Math.random() - 0.5) * 0.08;


    top.castShadow = true;
    top.receiveShadow = true;

    this.level.add(top);


    // =====================================================
    // DARK STRUCTURAL PIECES
    // =====================================================

    const frameMaterial =
        new THREE.MeshStandardMaterial({

            color: 0x101018,

            roughness: 0.75,

            metalness: 0.45
        });


    for (let i = 0; i < 3; i++) {

        const beam =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.35,
                    height * 0.72,
                    0.35
                ),
                frameMaterial
            );


        beam.position.set(

            x -
            width / 2 -
            0.18,

            height * 0.36,

            z -
            depth / 2 +
            1 +
            i * 2
        );


        beam.castShadow = true;

        this.level.add(beam);
    }


    // =====================================================
    // NEON PANELS
    // =====================================================

    const cyan =
        new THREE.MeshStandardMaterial({

            color: 0x00eaff,

            emissive: 0x00eaff,

            emissiveIntensity: 5
        });


    const pink =
        new THREE.MeshStandardMaterial({

            color: 0xff20c8,

            emissive: 0xff20c8,

            emissiveIntensity: 4
        });


    for (let i = 0; i < 3; i++) {

        const panel =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    width * 0.5,
                    1.2,
                    0.15
                ),

                i % 2 === 0
                    ? cyan
                    : pink
            );


        panel.position.set(

            x,

            4 + i * 5,

            z -
            depth / 2 -
            0.08
        );


        this.level.add(panel);
    }


    // =====================================================
    // BROKEN PIECES
    // =====================================================

    for (let i = 0; i < 3; i++) {

        const size =
            0.5 +
            Math.random() * 1.2;


        const chunk =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    size,
                    size,
                    size
                ),
                frameMaterial
            );


        chunk.position.set(

            x +
            (Math.random() - 0.5) *
            width,

            height +
            Math.random() * 2,

            z +
            (Math.random() - 0.5) *
            depth
        );


        chunk.rotation.set(
            Math.random(),
            Math.random(),
            Math.random()
        );


        this.level.add(chunk);
    }


    // =====================================================
    // EXISTING WINDOWS
    // =====================================================

    this.createWindows(
        x,
        z,
        width,
        height,
        depth
    );


    // =====================================================
    // EXISTING RUBBLE
    // =====================================================

    this.createRubble(
        x,
        z
    );
}

    // =========================================================
    // WINDOWS
    // =========================================================

    createWindows(
        x,
        z,
        width,
        height,
        depth
    ) {

        const cyan =
            new THREE.MeshStandardMaterial({

                color: 0x00eaff,

                emissive: 0x00eaff,

                emissiveIntensity: 5

            });


        const pink =
            new THREE.MeshStandardMaterial({

                color: 0xff20c8,

                emissive: 0xff20c8,

                emissiveIntensity: 4

            });


        for (
            let y = 4;
            y < height - 2;
            y += 5
        ) {

            const material =
                Math.random() > 0.5
                    ? cyan
                    : pink;


            const geometry =
                new THREE.BoxGeometry(
                    width * 0.45,
                    1.2,
                    0.12
                );


            const window =
                new THREE.Mesh(
                    geometry,
                    material
                );


            window.position.set(
                x,
                y,
                z - depth / 2 - 0.08
            );


            this.level.add(window);

        }

    }


    // =========================================================
    // RUBBLE
    // =========================================================

    createRubble(x, z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x3b3450,

                roughness: 0.9

            });


        for (
            let i = 0;
            i < 6;
            i++
        ) {

            const size =
                0.5 +
                Math.random() * 1.5;


            const rock =
                new THREE.Mesh(

                    new THREE.BoxGeometry(
                        size,
                        size,
                        size
                    ),

                    material

                );


            rock.position.set(

                x +
                (Math.random() - 0.5) * 7,

                size / 2,

                z +
                (Math.random() - 0.5) * 7

            );


            rock.rotation.y =
                Math.random() * Math.PI;


            rock.rotation.z =
                Math.random() * 0.5;


            this.level.add(rock);

        }

    }


    // =========================================================
    // GLOW BLOCK
    // =========================================================

    createGlowBlock(x, y, z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x00d9ff,

                emissive: 0x00d9ff,

                emissiveIntensity: 5

            });


        const block =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.4,
                    2,
                    0.4
                ),

                material

            );


        block.position.set(
            x,
            y,
            z
        );


        this.level.add(block);

    }


    // =========================================================
    // FLOATING PLATFORM
    // =========================================================

    createPlatform(x, y, z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x3d3470,

                metalness: 0.8,

                roughness: 0.25,

                emissive: 0x171052,

                emissiveIntensity: 1.5

            });


        const platform =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    7,
                    0.8,
                    7
                ),

                material

            );


        platform.position.set(
            x,
            y,
            z
        );


        this.level.add(platform);


        const edgeMaterial =
            new THREE.MeshStandardMaterial({

                color: 0x00d9ff,

                emissive: 0x00d9ff,

                emissiveIntensity: 5

            });


        const edge =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    7.1,
                    0.12,
                    0.15
                ),

                edgeMaterial

            );


        edge.position.set(
            x,
            y + 0.45,
            z - 3.5
        );


        this.level.add(edge);

    }


    // =========================================================
    // TOWER
    // =========================================================

    createTower(x, z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x17142e,

                roughness: 0.7,

                metalness: 0.7

            });


        const tower =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    6,
                    55,
                    6
                ),

                material

            );


        tower.position.set(
            x,
            27,
            z
        );


        this.level.add(tower);


        const neon =
            new THREE.MeshStandardMaterial({

                color: 0xff1bc7,

                emissive: 0xff1bc7,

                emissiveIntensity: 6

            });


        const strip =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.3,
                    50,
                    0.3
                ),

                neon

            );


        strip.position.set(
            x + 3.1,
            25,
            z
        );


        this.level.add(strip);

    }


    // =========================================================
    // BOSS PILLAR
    // =========================================================

    createBossPillar(x, z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x241b42,

                metalness: 0.8,

                roughness: 0.3,

                emissive: 0x130b2c,

                emissiveIntensity: 1

            });


        const pillar =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    3,
                    18,
                    3
                ),

                material

            );


        pillar.position.set(
            x,
            9,
            z
        );


        this.level.add(pillar);


        const light =
            new THREE.PointLight(
                0x00d9ff,
                15,
                20
            );


        light.position.set(
            x,
            10,
            z
        );


        this.level.add(light);

    }


    // =========================================================
    // DISTANT CITY
    // =========================================================

    createDistantCity() {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x15112b,

                roughness: 1

            });


        for (
            let i = 0;
            i < 35;
            i++
        ) {

            const height =
                10 +
                Math.random() * 40;


            const width =
                3 +
                Math.random() * 6;


            const side =
                i % 2 === 0
                    ? -1
                    : 1;


            const building =
                new THREE.Mesh(

                    new THREE.BoxGeometry(
                        width,
                        height,
                        width
                    ),

                    material

                );


            building.position.set(

                side *
                (27 +
                Math.random() * 35),

                height / 2,

                -135 +
                Math.random() * 280

            );


            this.level.add(building);

        }

    }


    // =========================================================
    // PORTAL TO LEVEL 3
    // =========================================================

    createPortal(x, y, z) {

        const material =
            new THREE.MeshStandardMaterial({

                color: 0x00ffff,

                emissive: 0x00ffff,

                emissiveIntensity: 8,

                metalness: 0.3,

                roughness: 0.15

            });


        const portal =
            new THREE.Mesh(

                new THREE.OctahedronGeometry(
                    4,
                    0
                ),

                material

            );


        portal.position.set(
            x,
            y,
            z
        );


        this.portal = portal;

        this.level.add(portal);


        const light =
            new THREE.PointLight(
                0x00ffff,
                80,
                35
            );


        light.position.set(
            x,
            y,
            z
        );


        this.level.add(light);

    }


    // =========================================================
    // UPDATE
    // =========================================================

    update(deltaTime) {

        // Make portal float and rotate

        if (this.portal) {

            this.portal.rotation.y +=
                deltaTime * 0.8;

            this.portal.rotation.x +=
                deltaTime * 0.25;

            this.portal.position.y =
                5 +
                Math.sin(
                    performance.now() * 0.002
                ) * 0.5;

        }

    }

}