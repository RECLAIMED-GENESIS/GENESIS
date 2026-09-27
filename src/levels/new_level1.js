import * as THREE from 'three';

export class Level1 {

    constructor() {

        // =====================================================
        // SCENE
        // =====================================================

        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(0x120d09);

        this.scene.fog = new THREE.Fog(
            0x120d09,
            30,
            90
        );


        // =====================================================
        // LEVEL
        // =====================================================

        this.level = new THREE.Group();

        this.scene.add(this.level);


        // =====================================================
        // MINE DIMENSIONS
        // =====================================================

        this.MINE_WIDTH = 60;
        this.MINE_LENGTH = 40;


        // =====================================================
        // GAMEPLAY OBJECTS
        // =====================================================

        this.enemies = [];

        this.fragments = [];

        this.portalParts = [];

        this.portal = null;


        // =====================================================
        // LIGHTS
        // =====================================================

        this.mineLights = [];

        this.mineMaterials = [];

        this.createLighting();


        // =====================================================
        // BUILD MINE (no external model — built in code)
        // =====================================================

        this.buildLevel();
    }


    // =========================================================
    // LIGHTING
    // =========================================================

    createLighting() {

        // Dim, dusty ambient — a mine has almost no natural light

        const ambient =
            new THREE.AmbientLight(
                0x4a3a2c,
                0.6
            );

        this.level.add(ambient);


        // Faint shaft of light standing in for daylight above

        const mainLight =
            new THREE.DirectionalLight(
                0xffcf9e,
                0.7
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


        // Warm lantern lights strung down the shaft

        for (
            let z = -14;
            z <= 14;
            z += 7
        ) {

            this.createLantern(
                -3.8,
                5.7,
                z
            );

            this.createLantern(
                3.8,
                5.7,
                z
            );
        }


        // A little glow near the gold vein

        const goldGlow =
            new THREE.PointLight(
                0xff9d2e,
                10,
                25
            );

        goldGlow.position.set(
            -20,
            4,
            -6
        );

        this.level.add(goldGlow);
    }


    // =========================================================
    // LANTERN
    // =========================================================

    createLantern(x, y, z) {

        const lanternMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x3b3027,
                metalness: 0.4,
                roughness: 0.8
            });

        const lantern =
            new THREE.Mesh(
                new THREE.BoxGeometry(0.45, 0.7, 0.45),
                lanternMaterial
            );

        lantern.position.set(x, y, z);

        this.level.add(lantern);


        const light =
            new THREE.PointLight(
                0xffa34d,
                5,
                18,
                2
            );

        light.position.set(x, y + 0.1, z);

        light.castShadow = true;

        this.level.add(light);

        this.mineLights.push(light);


        // Visible glowing bulb

        const bulb =
            new THREE.Mesh(
                new THREE.SphereGeometry(0.18, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0xffb35c })
            );

        bulb.position.copy(light.position);

        this.level.add(bulb);
    }


    // =========================================================
    // BUILD LEVEL — procedural mine, no external model needed
    // =========================================================

    buildLevel() {

        this.createMineFloor();

        this.createMineWalls();

        this.createMineSupports();

        this.createRails();

        this.createDecorativeRocks();

        this.createGoldVeins();

        this.createCrates();

        this.createMineCart();

        this.createFragments();

        this.createEnemies();

        this.createPortal();

        this.setPortalVisible(false);

        console.log('========================');
        console.log('LEVEL 1 (MINE) BUILT');
        console.log('Enemies:', this.enemies.length);
        console.log('Fragments:', this.fragments.length);
        console.log('========================');
    }


    // =========================================================
    // MINE FLOOR
    // =========================================================

    createMineFloor() {

        const material =
            this.createFloorMaterial(0x4b443d);

        const geometry =
            new THREE.PlaneGeometry(
                this.MINE_WIDTH,
                this.MINE_LENGTH,
                40,
                30
            );

        const floor =
            new THREE.Mesh(geometry, material);

        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;

        floor.receiveShadow = true;

        this.level.add(floor);
    }


    // =========================================================
    // ROCK WALL PIECE
    // =========================================================

    createRockWall(position, scale, rotation = [0, 0, 0]) {

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x51463e,
                roughness: 1.0,
                metalness: 0.05
            });

        const geometry =
            new THREE.DodecahedronGeometry(1, 1);

        const rock =
            new THREE.Mesh(geometry, material);

        rock.position.set(
            position[0],
            position[1],
            position[2]
        );

        rock.scale.set(
            scale[0],
            scale[1],
            scale[2]
        );

        rock.rotation.set(
            rotation[0],
            rotation[1],
            rotation[2]
        );

        rock.castShadow = true;
        rock.receiveShadow = true;

        this.level.add(rock);

        return rock;
    }


    // =========================================================
    // MINE WALLS
    // =========================================================

    createMineWalls() {

        // Back wall
        for (let x = -28; x <= 28; x += 3) {

            this.createRockWall(
                [x, 3.5, -19.5],
                [2.0, 3.5, 1.5],
                [0, Math.random() * Math.PI, 0]
            );
        }

        // Front wall
        for (let x = -28; x <= 28; x += 3) {

            this.createRockWall(
                [x, 3.5, 19.5],
                [2.0, 3.5, 1.5],
                [0, Math.random() * Math.PI, 0]
            );
        }

        // Left wall
        for (let z = -17; z <= 17; z += 3) {

            this.createRockWall(
                [-29.5, 3.5, z],
                [1.5, 3.5, 2.0],
                [0, Math.random() * Math.PI, 0]
            );
        }

        // Right wall
        for (let z = -17; z <= 17; z += 3) {

            this.createRockWall(
                [29.5, 3.5, z],
                [1.5, 3.5, 2.0],
                [0, Math.random() * Math.PI, 0]
            );
        }
    }


    // =========================================================
    // WOODEN SUPPORT
    // =========================================================

    createWoodSupport(x, z) {

        const woodMaterial =
            this.createWoodMaterial(0x633d24);

        const beamGeometry =
            new THREE.BoxGeometry(0.7, 7, 0.7);

        const leftPost =
            new THREE.Mesh(beamGeometry, woodMaterial);

        leftPost.position.set(x - 4, 3.5, z);
        leftPost.castShadow = true;

        this.level.add(leftPost);


        const rightPost = leftPost.clone();

        rightPost.position.x = x + 4;

        this.level.add(rightPost);


        // Top beam

        const topGeometry =
            new THREE.BoxGeometry(8.7, 0.7, 0.7);

        const topBeam =
            new THREE.Mesh(topGeometry, woodMaterial);

        topBeam.position.set(x, 7, z);
        topBeam.castShadow = true;

        this.level.add(topBeam);
    }


    // =========================================================
    // MINE SUPPORTS
    // =========================================================

    createMineSupports() {

        for (let z = -15; z <= 15; z += 7) {

            this.createWoodSupport(0, z);
        }
    }


    // =========================================================
    // RAILS
    // =========================================================

    createRails() {

        const railMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x555555,
                metalness: 0.7,
                roughness: 0.5
            });

        const railGeometry =
            new THREE.BoxGeometry(
                0.18,
                0.18,
                this.MINE_LENGTH - 4
            );

        const leftRail =
            new THREE.Mesh(railGeometry, railMaterial);

        leftRail.position.set(-1.2, 0.12, 0);

        this.level.add(leftRail);


        const rightRail = leftRail.clone();

        rightRail.position.x = 1.2;

        this.level.add(rightRail);


        // Wooden sleepers

        const sleeperMaterial =
            new THREE.MeshStandardMaterial({ color: 0x5b3824 });

        for (let z = -17; z <= 17; z += 1.5) {

            const sleeper =
                new THREE.Mesh(
                    new THREE.BoxGeometry(3.5, 0.15, 0.45),
                    sleeperMaterial
                );

            sleeper.position.set(0, 0.05, z);

            this.level.add(sleeper);
        }
    }


    // =========================================================
    // DECORATIVE ROCKS
    // =========================================================

    createDecorativeRocks() {

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x5a5048,
                roughness: 1.0,
                metalness: 0.05
            });

        for (let i = 0; i < 35; i++) {

            const rock =
                new THREE.Mesh(
                    new THREE.DodecahedronGeometry(
                        0.4 + Math.random() * 0.7,
                        1
                    ),
                    material
                );

            rock.position.set(
                THREE.MathUtils.randFloat(-25, 25),
                0.35,
                THREE.MathUtils.randFloat(-17, 17)
            );

            rock.rotation.set(
                Math.random(),
                Math.random(),
                Math.random()
            );

            rock.castShadow = true;

            this.level.add(rock);
        }
    }


    // =========================================================
    // GOLD VEINS
    // =========================================================

    createGoldVeins() {

        const veinPositions = [
            [-27, 2.5, -6],
            [-26, 3.2, -3],
            [27, 2.5, 8],
            [26, 3.2, 11]
        ];

        for (const [x, y, z] of veinPositions) {

            const material =
                new THREE.MeshStandardMaterial({
                    color: 0xffa51f,
                    roughness: 0.35,
                    metalness: 0.2,
                    emissive: 0xff5a00,
                    emissiveIntensity: 1.4
                });

            const ore =
                new THREE.Mesh(
                    new THREE.DodecahedronGeometry(0.5, 0),
                    material
                );

            ore.position.set(x, y, z);

            this.level.add(ore);
        }
    }


    // =========================================================
    // CRATES
    // =========================================================

    createCrate(x, z) {

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x70472b,
                roughness: 0.9
            });

        const crate =
            new THREE.Mesh(
                new THREE.BoxGeometry(1.3, 1.3, 1.3),
                material
            );

        crate.position.set(x, 0.65, z);
        crate.rotation.y = Math.random() * Math.PI;
        crate.castShadow = true;

        this.level.add(crate);
    }


    createCrates() {

        this.createCrate(-8, 8);
        this.createCrate(-10, 10);
        this.createCrate(10, 12);
    }


    // =========================================================
    // MINE CART
    // =========================================================

    createMineCart() {

        const cartMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x444444,
                metalness: 0.7,
                roughness: 0.5
            });

        const cart =
            new THREE.Mesh(
                new THREE.BoxGeometry(2.4, 1, 1.5),
                cartMaterial
            );

        cart.position.set(8, 0.65, -5);
        cart.castShadow = true;

        this.level.add(cart);


        const wheelMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x222222,
                metalness: 0.8
            });

        for (const x of [-0.8, 0.8]) {

            const wheel =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16),
                    wheelMaterial
                );

            wheel.rotation.z = Math.PI / 2;

            wheel.position.set(8 + x, 0.35, -5);

            this.level.add(wheel);
        }
    }


    // =========================================================
    // FRAGMENTS
    // =========================================================

    createFragments() {

        const fragmentPositions = [
            [-20, 1.2, -12],
            [20, 1.2, -12],
            [-20, 1.2, 12],
            [20, 1.2, 12],
            [0, 1.2, -14],
            [0, 1.2, 14]
        ];

        for (const [x, y, z] of fragmentPositions) {

            const material =
                new THREE.MeshStandardMaterial({
                    color: 0xff7a00,
                    emissive: 0xff3500,
                    emissiveIntensity: 4,
                    roughness: 0.25,
                    metalness: 0.2
                });

            const fragment =
                new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.45),
                    material
                );

            fragment.position.set(x, y, z);

            fragment.userData.isFragment = true;

            this.level.add(fragment);

            this.fragments.push(fragment);
        }
    }


    // =========================================================
    // ENEMIES
    // =========================================================

    createEnemies() {

        const enemyPositions = [
            [-14, 1, -8],
            [14, 1, -8],
            [-14, 1, 8],
            [14, 1, 8]
        ];

        for (const [x, y, z] of enemyPositions) {

            const material =
                new THREE.MeshStandardMaterial({
                    color: 0x8b1824,
                    roughness: 0.55,
                    metalness: 0.2
                });

            const enemy =
                new THREE.Mesh(
                    new THREE.ConeGeometry(0.6, 1.4, 6),
                    material
                );

            enemy.position.set(x, y, z);

            enemy.userData.isEnemy = true;

            this.level.add(enemy);

            this.enemies.push(enemy);
        }
    }


    // =========================================================
    // PORTAL
    // =========================================================

    createPortal() {

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x00d9ff,
                emissiveIntensity: 7,
                transparent: true,
                opacity: 0.8,
                roughness: 0.15,
                metalness: 0.1
            });

        this.portal =
            new THREE.Mesh(
                new THREE.TorusGeometry(2, 0.35, 20, 60),
                material
            );

        this.portal.position.set(0, 2, -18);
        this.portal.rotation.x = Math.PI / 2;

        this.portal.userData.isPortalPart = true;

        this.level.add(this.portal);

        this.portalParts.push(this.portal);
    }


    // =========================================================
    // PIXEL FLOOR MATERIAL
    // =========================================================

    createFloorMaterial(baseColor) {

        const texture =
            this.generatePixelTexture(baseColor);

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        texture.repeat.set(6, 4);

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
            this.generateWoodTexture(baseColor);

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

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

        const canvas = document.createElement('canvas');

        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');

        const color = new THREE.Color(baseColor);

        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, size, size);

        // Pixel grid

        ctx.strokeStyle = 'rgba(120,100,80,0.18)';
        ctx.lineWidth = 1;

        for (let x = 0; x <= size; x += 8) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
        }

        for (let y = 0; y <= size; y += 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        // Pixel noise (dust / grit)

        for (let i = 0; i < 35; i++) {

            ctx.fillStyle = 'rgba(255,240,220,0.06)';

            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);

            ctx.fillRect(x, y, 2, 2);
        }

        const texture = new THREE.CanvasTexture(canvas);

        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        texture.colorSpace = THREE.SRGBColorSpace;

        return texture;
    }


    // =========================================================
    // WOOD TEXTURE
    // =========================================================

    generateWoodTexture(baseColor) {

        const size = 64;

        const canvas = document.createElement('canvas');

        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');

        const color = new THREE.Color(baseColor);

        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, size, size);

        // Wood pixel lines

        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;

        for (let y = 5; y < size; y += 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);

        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        texture.colorSpace = THREE.SRGBColorSpace;

        return texture;
    }


    // =========================================================
    // PORTAL VISIBILITY
    // =========================================================

    setPortalVisible(visible) {

        for (const part of this.portalParts) {
            part.visible = visible;
        }
    }


    // =========================================================
    // COLLECT FRAGMENT
    // =========================================================

    collectFragment(fragment) {

        if (!fragment) return;

        fragment.visible = false;

        const index = this.fragments.indexOf(fragment);

        if (index !== -1) {
            this.fragments.splice(index, 1);
        }

        console.log('Fragment collected!');
        console.log('Fragments remaining:', this.fragments.length);

        if (this.fragments.length === 0) {

            console.log('ALL FRAGMENTS COLLECTED!');
            console.log('PORTAL ACTIVATED!');

            this.setPortalVisible(true);
        }
    }


    // =========================================================
    // UPDATE
    // =========================================================

    update(deltaTime) {

        const time = performance.now() * 0.001;


        // Fragments float

        for (let i = 0; i < this.fragments.length; i++) {

            const fragment = this.fragments[i];

            fragment.rotation.y += deltaTime * 1.5;

            fragment.position.y +=
                Math.sin(time * 3 + i) * deltaTime * 0.35;
        }


        // Enemy idle movement

        for (let i = 0; i < this.enemies.length; i++) {

            this.enemies[i].rotation.y += deltaTime * 0.2;
        }


        // Lantern flicker

        for (let i = 0; i < this.mineLights.length; i++) {

            this.mineLights[i].intensity =
                5 + Math.sin(time * 6 + i) * 0.6;
        }


        // Portal animation

        if (this.portal && this.portal.visible) {

            this.portal.rotation.y += deltaTime * 1.2;

            const pulse = 1 + Math.sin(time * 5) * 0.08;

            this.portal.scale.set(pulse, pulse, pulse);
        }
    }


    // =========================================================
    // DISPOSE
    // =========================================================

    dispose() {

        this.level.traverse((object) => {

            if (!object.isMesh) return;

            if (object.geometry) {
                object.geometry.dispose();
            }

            if (object.material) {

                if (Array.isArray(object.material)) {

                    object.material.forEach((material) => {

                        if (material.map) material.map.dispose();

                        material.dispose();
                    });

                } else {

                    if (object.material.map) {
                        object.material.map.dispose();
                    }

                    object.material.dispose();
                }
            }
        });

        this.scene.clear();

        this.enemies = [];
        this.fragments = [];
        this.portalParts = [];
        this.mineLights = [];

        this.portal = null;
    }
}