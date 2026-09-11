import * as THREE from 'three';

export class Level3 {

    constructor() {

        // =====================================================
        // SCENE
        // =====================================================

        this.scene = new THREE.Scene();

        // Pure white endless void
        this.scene.background = new THREE.Color(0xfafafa);
        this.scene.fog = new THREE.Fog(0xfafafa, 100, 500);

        this.level = new THREE.Group();
        this.scene.add(this.level);

        // =====================================================
        // BOSS
        // =====================================================

        this.maxBossHealth = 100;
        this.bossHealth = 100;

        this.tiles = [];
        this.weakPoints = [];
        this.bossLights = [];
        this.energyRings = [];
        this.shards = [];

        // =====================================================
        // BUILD LEVEL
        // =====================================================

        this.createLighting();
        this.createVoidFloor();
        this.createArena();
        this.createArenaBorder();
        this.createVoidGeometry();
        this.createArchitect();
        this.createWeakPoints();
        this.createEnergyRings();
        this.createBossLights();
        this.createParticles();
    }


    // =========================================================
    // LIGHTING
    // =========================================================

    createLighting() {

        const ambient = new THREE.AmbientLight(
            0xffffff,
            1.8
        );

        this.level.add(ambient);


        const mainLight = new THREE.DirectionalLight(
            0xffffff,
            3.5
        );

        mainLight.position.set(
            40,
            100,
            50
        );

        mainLight.castShadow = true;

        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;

        mainLight.shadow.camera.left = -100;
        mainLight.shadow.camera.right = 100;
        mainLight.shadow.camera.top = 100;
        mainLight.shadow.camera.bottom = -100;

        this.level.add(mainLight);
    }


    // =========================================================
    // INFINITE WHITE FLOOR
    // =========================================================

    createVoidFloor() {

        const geometry = new THREE.PlaneGeometry(
            1000,
            1000
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1.0,
            metalness: 0.0
        });

        const floor = new THREE.Mesh(
            geometry,
            material
        );

        floor.rotation.x = -Math.PI / 2;

        floor.position.y = -8;

        floor.receiveShadow = true;

        this.level.add(floor);

        this.voidFloor = floor;
    }


    // =========================================================
    // MAIN BOSS ARENA
    // =========================================================

    createArena() {

        this.tiles = [];

        const tileSize = 5;
        const gap = 0.08;

        const columns = 12;
        const rows = 12;

        const totalWidth = columns * tileSize;
        const totalLength = rows * tileSize;

        const startX =
            -totalWidth / 2 +
            tileSize / 2;

        const startZ =
            -totalLength / 2 +
            tileSize / 2;


        for (let x = 0; x < columns; x++) {

            for (let z = 0; z < rows; z++) {

                const geometry =
                    new THREE.BoxGeometry(
                        tileSize - gap,
                        0.6,
                        tileSize - gap
                    );


                const material =
                    new THREE.MeshStandardMaterial({
                        color:
                            (x + z) % 2 === 0
                                ? 0xf4f4f4
                                : 0xe8e8e8,

                        roughness: 0.65,
                        metalness: 0.15
                    });


                const tile = new THREE.Mesh(
                    geometry,
                    material
                );


                tile.position.set(
                    startX + x * tileSize,
                    0,
                    startZ + z * tileSize
                );


                tile.castShadow = true;
                tile.receiveShadow = true;


                this.level.add(tile);


                this.tiles.push({
                    mesh: tile,
                    x: x,
                    z: z,
                    fallen: false,
                    velocity: 0
                });
            }
        }
    }


    // =========================================================
    // ARENA BORDER
    // =========================================================

    createArenaBorder() {

        const borderMaterial =
            new THREE.MeshStandardMaterial({
                color: 0xd7d7d7,
                roughness: 0.5,
                metalness: 0.4
            });


        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(
                65,
                2,
                1
            ),
            borderMaterial
        );

        backWall.position.set(
            0,
            -0.2,
            -31
        );

        this.level.add(backWall);


        // Left wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(
                1,
                2,
                65
            ),
            borderMaterial
        );

        leftWall.position.set(
            -31,
            -0.2,
            0
        );

        this.level.add(leftWall);


        // Right wall
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(
                1,
                2,
                65
            ),
            borderMaterial
        );

        rightWall.position.set(
            31,
            -0.2,
            0
        );

        this.level.add(rightWall);


        // Front wall
        const frontWall = new THREE.Mesh(
            new THREE.BoxGeometry(
                65,
                2,
                1
            ),
            borderMaterial
        );

        frontWall.position.set(
            0,
            -0.2,
            31
        );

        this.level.add(frontWall);
    }


    // =========================================================
    // GIANT VOID GEOMETRY
    // =========================================================

    createVoidGeometry() {

        const material =
            new THREE.MeshStandardMaterial({
                color: 0xe0e0e0,
                roughness: 0.4,
                metalness: 0.5
            });


        // Giant monoliths in the distance

        const positions = [
            [-70, 35, -100],
            [70, 50, -120],
            [-110, 20, -170],
            [110, 40, -180],
            [-150, 65, -250],
            [150, 75, -280]
        ];


        positions.forEach((position, index) => {

            const width =
                8 + (index % 3) * 5;

            const height =
                25 + (index % 4) * 15;

            const depth =
                8 + (index % 2) * 6;


            const geometry =
                new THREE.BoxGeometry(
                    width,
                    height,
                    depth
                );


            const object =
                new THREE.Mesh(
                    geometry,
                    material.clone()
                );


            object.position.set(
                position[0],
                height / 2 - 5,
                position[2]
            );


            object.rotation.y =
                index * 0.35;


            object.castShadow = true;

            this.level.add(object);
        });


        // =====================================================
        // GIANT FLOATING SHARDS
        // =====================================================

        for (let i = 0; i < 18; i++) {

            const geometry =
                new THREE.IcosahedronGeometry(
                    2 + Math.random() * 5,
                    0
                );


            const shard =
                new THREE.Mesh(
                    geometry,
                    material.clone()
                );


            shard.position.set(
                (Math.random() - 0.5) * 180,
                15 + Math.random() * 70,
                -60 - Math.random() * 220
            );


            shard.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );


            shard.userData.rotationSpeed =
                0.1 + Math.random() * 0.3;


            this.level.add(shard);

            this.shards.push(shard);
        }
    }


    // =========================================================
    // ARCHITECT
    // =========================================================

    createArchitect() {

        this.architect = new THREE.Group();

        // Far enough away to feel huge
        this.architect.position.set(
            0,
            20,
            -25
        );


        this.level.add(this.architect);


        // =====================================================
        // MATERIAL
        // =====================================================

        const bodyMaterial =
            new THREE.MeshStandardMaterial({
                color: 0xbfc4c9,
                roughness: 0.3,
                metalness: 0.5
            });


        const darkMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x777d84,
                roughness: 0.4,
                metalness: 0.65
            });


        // =====================================================
        // TORSO
        // =====================================================

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(
                14,
                28,
                8
            ),
            bodyMaterial
        );

        body.position.y = 0;

        body.castShadow = true;
        body.receiveShadow = true;

        this.architect.add(body);


        // =====================================================
        // CHEST PLATE
        // =====================================================

        const chest = new THREE.Mesh(
            new THREE.BoxGeometry(
                10,
                13,
                1.5
            ),
            darkMaterial
        );

        chest.position.set(
            0,
            2,
            -4.5
        );

        chest.castShadow = true;

        this.architect.add(chest);


        // =====================================================
        // HEAD
        // =====================================================

        const head = new THREE.Mesh(
            new THREE.BoxGeometry(
                10,
                10,
                10
            ),
            bodyMaterial
        );

        head.position.y = 20;

        head.castShadow = true;

        this.architect.add(head);


        // =====================================================
        // HEAD TOP
        // =====================================================

        const crown = new THREE.Mesh(
            new THREE.BoxGeometry(
                5,
                8,
                5
            ),
            darkMaterial
        );

        crown.position.y = 29;

        crown.castShadow = true;

        this.architect.add(crown);


        // =====================================================
        // SHOULDERS
        // =====================================================

        const shoulderGeometry =
            new THREE.BoxGeometry(
                6,
                6,
                8
            );


        const leftShoulder =
            new THREE.Mesh(
                shoulderGeometry,
                bodyMaterial
            );

        leftShoulder.position.set(
            -9,
            9,
            0
        );

        this.architect.add(leftShoulder);


        const rightShoulder =
            new THREE.Mesh(
                shoulderGeometry,
                bodyMaterial
            );

        rightShoulder.position.set(
            9,
            9,
            0
        );

        this.architect.add(rightShoulder);


        // =====================================================
        // ARMS
        // =====================================================

        const armGeometry =
            new THREE.BoxGeometry(
                4,
                25,
                4
            );


        const leftArm =
            new THREE.Mesh(
                armGeometry,
                bodyMaterial
            );

        leftArm.position.set(
            -10,
            -4,
            0
        );

        leftArm.rotation.z = -0.08;

        leftArm.castShadow = true;

        this.architect.add(leftArm);


        const rightArm =
            new THREE.Mesh(
                armGeometry,
                bodyMaterial
            );

        rightArm.position.set(
            10,
            -4,
            0
        );

        rightArm.rotation.z = 0.08;

        rightArm.castShadow = true;

        this.architect.add(rightArm);


        // =====================================================
        // HANDS
        // =====================================================

        const handGeometry =
            new THREE.BoxGeometry(
                5,
                7,
                5
            );


        const leftHand =
            new THREE.Mesh(
                handGeometry,
                darkMaterial
            );

        leftHand.position.set(
            -10,
            -17,
            0
        );

        this.architect.add(leftHand);


        const rightHand =
            new THREE.Mesh(
                handGeometry,
                darkMaterial
            );

        rightHand.position.set(
            10,
            -17,
            0
        );

        this.architect.add(rightHand);


        // =====================================================
        // LEGS
        // =====================================================

        const legGeometry =
            new THREE.BoxGeometry(
                5,
                22,
                5
            );


        const leftLeg =
            new THREE.Mesh(
                legGeometry,
                bodyMaterial
            );

        leftLeg.position.set(
            -4,
            -24,
            0
        );

        leftLeg.castShadow = true;

        this.architect.add(leftLeg);


        const rightLeg =
            new THREE.Mesh(
                legGeometry,
                bodyMaterial
            );

        rightLeg.position.set(
            4,
            -24,
            0
        );

        rightLeg.castShadow = true;

        this.architect.add(rightLeg);


        // =====================================================
        // FEET
        // =====================================================

        const footGeometry =
            new THREE.BoxGeometry(
                6,
                4,
                9
            );


        const leftFoot =
            new THREE.Mesh(
                footGeometry,
                darkMaterial
            );

        leftFoot.position.set(
            -4,
            -36,
            -1
        );

        this.architect.add(leftFoot);


        const rightFoot =
            new THREE.Mesh(
                footGeometry,
                darkMaterial
            );

        rightFoot.position.set(
            4,
            -36,
            -1
        );

        this.architect.add(rightFoot);
    }


    // =========================================================
    // WEAK POINTS
    // =========================================================

    createWeakPoints() {

        const cyanMaterial =
            new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0x00ffff,
                emissiveIntensity: 12,
                metalness: 0.1,
                roughness: 0.2
            });


        const purpleMaterial =
            new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0xff00ff,
                emissiveIntensity: 12,
                metalness: 0.1,
                roughness: 0.2
            });


        // =====================================================
        // CHEST CORE
        // =====================================================

        const chestCore =
            new THREE.Mesh(
                new THREE.OctahedronGeometry(
                    2.2,
                    0
                ),
                cyanMaterial
            );


        chestCore.position.set(
            0,
            2,
            -5
        );


        this.architect.add(chestCore);

        this.weakPoints.push(chestCore);


        // =====================================================
        // HEAD CORE
        // =====================================================

        const headCore =
            new THREE.Mesh(
                new THREE.OctahedronGeometry(
                    1.8,
                    0
                ),
                purpleMaterial
            );


        headCore.position.set(
            0,
            20,
            -5.2
        );


        this.architect.add(headCore);

        this.weakPoints.push(headCore);


        // =====================================================
        // LEFT CORE
        // =====================================================

        const leftCore =
            new THREE.Mesh(
                new THREE.OctahedronGeometry(
                    1.6,
                    0
                ),
                cyanMaterial.clone()
            );


        leftCore.position.set(
            -10,
            -4,
            -2.5
        );


        this.architect.add(leftCore);

        this.weakPoints.push(leftCore);


        // =====================================================
        // RIGHT CORE
        // =====================================================

        const rightCore =
            new THREE.Mesh(
                new THREE.OctahedronGeometry(
                    1.6,
                    0
                ),
                purpleMaterial.clone()
            );


        rightCore.position.set(
            10,
            -4,
            -2.5
        );


        this.architect.add(rightCore);

        this.weakPoints.push(rightCore);
    }


    // =========================================================
    // ENERGY RINGS
    // =========================================================

    createEnergyRings() {

        const cyanMaterial =
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });


        const purpleMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                transparent: true,
                opacity: 0.55,
                side: THREE.DoubleSide
            });


        // Giant ring behind Architect

        const ring1 =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    30,
                    0.35,
                    8,
                    64
                ),
                cyanMaterial
            );


        ring1.position.set(
            0,
            15,
            -35
        );


        ring1.rotation.x =
            Math.PI / 2;


        this.level.add(ring1);

        this.energyRings.push(ring1);


        // Second ring

        const ring2 =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    22,
                    0.25,
                    8,
                    64
                ),
                purpleMaterial
            );


        ring2.position.set(
            0,
            18,
            -38
        );


        ring2.rotation.x =
            Math.PI / 2;


        this.level.add(ring2);

        this.energyRings.push(ring2);


        // Third vertical ring

        const ring3 =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    14,
                    0.2,
                    8,
                    64
                ),
                cyanMaterial
            );


        ring3.position.set(
            0,
            15,
            -32
        );


        this.level.add(ring3);

        this.energyRings.push(ring3);
    }


    // =========================================================
    // BOSS LIGHTS
    // =========================================================

    createBossLights() {

        const cyanLight =
            new THREE.PointLight(
                0x00ffff,
                180,
                90
            );


        cyanLight.position.set(
            0,
            5,
            -30
        );


        this.level.add(cyanLight);

        this.bossLights.push(cyanLight);


        const purpleLight =
            new THREE.PointLight(
                0xff00ff,
                150,
                80
            );


        purpleLight.position.set(
            -15,
            20,
            -30
        );


        this.level.add(purpleLight);

        this.bossLights.push(purpleLight);


        const cyanLight2 =
            new THREE.PointLight(
                0x00ffff,
                150,
                80
            );


        cyanLight2.position.set(
            15,
            20,
            -30
        );


        this.level.add(cyanLight2);

        this.bossLights.push(cyanLight2);
    }


    // =========================================================
    // FLOATING PARTICLES
    // =========================================================

    createParticles() {

        const particleGeometry =
            new THREE.BufferGeometry();

        const positions = [];

        for (let i = 0; i < 250; i++) {

            positions.push(
                (Math.random() - 0.5) * 160,
                Math.random() * 100,
                -Math.random() * 250
            );
        }


        particleGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(
                positions,
                3
            )
        );


        const particleMaterial =
            new THREE.PointsMaterial({
                color: 0x9b9b9b,
                size: 0.35,
                transparent: true,
                opacity: 0.45
            });


        this.particles =
            new THREE.Points(
                particleGeometry,
                particleMaterial
            );


        this.level.add(this.particles);
    }


    // =========================================================
    // UPDATE
    // =========================================================

    update(deltaTime) {

        const time =
            performance.now() * 0.001;


        // =====================================================
        // ARCHITECT BREATHING / FLOATING
        // =====================================================

        if (this.architect) {

            this.architect.position.y =
                20 +
                Math.sin(time * 0.8) * 0.35;

            this.architect.rotation.y =
                Math.sin(time * 0.25) * 0.03;
        }


        // =====================================================
        // WEAK POINT PULSE
        // =====================================================

        const pulse =
            9 +
            Math.sin(time * 5) * 5;


        for (const point of this.weakPoints) {

            point.material.emissiveIntensity =
                pulse;

            const scale =
                1 +
                Math.sin(time * 4) * 0.12;

            point.scale.set(
                scale,
                scale,
                scale
            );
        }


        // =====================================================
        // ENERGY RINGS
        // =====================================================

        if (this.energyRings[0]) {

            this.energyRings[0].rotation.z +=
                deltaTime * 0.15;

            this.energyRings[0].rotation.y +=
                deltaTime * 0.2;
        }


        if (this.energyRings[1]) {

            this.energyRings[1].rotation.z -=
                deltaTime * 0.25;

            this.energyRings[1].rotation.y +=
                deltaTime * 0.15;
        }


        if (this.energyRings[2]) {

            this.energyRings[2].rotation.x +=
                deltaTime * 0.2;

            this.energyRings[2].rotation.y +=
                deltaTime * 0.3;
        }


        // =====================================================
        // FLOATING SHARDS
        // =====================================================

        for (const shard of this.shards) {

            shard.rotation.x +=
                deltaTime *
                shard.userData.rotationSpeed;

            shard.rotation.y +=
                deltaTime *
                shard.userData.rotationSpeed *
                0.7;
        }


        // =====================================================
        // BOSS LIGHTS FOLLOW HEALTH
        // =====================================================

        const healthPercent =
            this.bossHealth /
            this.maxBossHealth;


        for (const light of this.bossLights) {

            light.intensity =
                180 *
                healthPercent;
        }


        // =====================================================
        // FALLING TILES
        // =====================================================

        for (const tileData of this.tiles) {

            if (!tileData.fallen) {
                continue;
            }


            tileData.velocity +=
                20 * deltaTime;


            tileData.mesh.position.y -=
                tileData.velocity *
                deltaTime;


            tileData.mesh.rotation.x +=
                deltaTime * 1.5;


            tileData.mesh.rotation.z +=
                deltaTime * 0.8;
        }
    }


    // =========================================================
    // DAMAGE BOSS
    // =========================================================

    damageBoss(amount) {

        this.bossHealth -= amount;

        this.bossHealth =
            Math.max(
                0,
                this.bossHealth
            );


        console.log(
            'ARCHITECT HP:',
            this.bossHealth
        );


        // Phase 2
        if (
            this.bossHealth <= 66 &&
            this.bossHealth > 33
        ) {

            this.startPhaseTwo();
        }


        // Phase 3
        if (this.bossHealth <= 33) {

            this.startPhaseThree();
        }
    }


    // =========================================================
    // PHASE 2
    // =========================================================

    startPhaseTwo() {

        if (this.phaseTwoStarted) {
            return;
        }

        this.phaseTwoStarted = true;

        console.log(
            'ARCHITECT PHASE 2'
        );


        // Drop random floor tiles

        for (let i = 0; i < 15; i++) {

            const index =
                Math.floor(
                    Math.random() *
                    this.tiles.length
                );


            this.dropTile(index);
        }
    }


    // =========================================================
    // PHASE 3
    // =========================================================

    startPhaseThree() {

        if (this.phaseThreeStarted) {
            return;
        }

        this.phaseThreeStarted = true;

        console.log(
            'ARCHITECT PHASE 3'
        );


        // Make weak points extremely bright

        for (const point of this.weakPoints) {

            point.material.emissiveIntensity =
                25;
        }


        // Increase ring speed

        for (const ring of this.energyRings) {

            ring.userData.phaseThree = true;
        }
    }


    // =========================================================
    // DROP TILE
    // =========================================================

    dropTile(index) {

        if (!this.tiles[index]) {
            return;
        }


        const tileData =
            this.tiles[index];


        if (tileData.fallen) {
            return;
        }


        tileData.fallen = true;
        tileData.velocity = 2;


        tileData.mesh.userData.falling =
            true;
    }


    // =========================================================
    // DISPOSE
    // =========================================================

    dispose() {

        this.level.traverse((object) => {

            if (!object.isMesh) {
                return;
            }


            if (object.geometry) {
                object.geometry.dispose();
            }


            if (object.material) {

                if (Array.isArray(object.material)) {

                    object.material.forEach(
                        material =>
                            material.dispose()
                    );

                } else {

                    object.material.dispose();
                }
            }
        });


        this.tiles = [];
        this.weakPoints = [];
        this.bossLights = [];
        this.energyRings = [];
        this.shards = [];
    }
}