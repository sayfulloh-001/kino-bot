/**
 * Voxel Obstacles (Minecraft block walls & PUBG AirDrop Supply Crates).
 */
import { GAME_SETTINGS } from './settings.js';
import { randomChoice, randomRange } from './utils.js';

export class Obstacle {
    constructor(type, xPos, zPos) {
        this.type = type;
        this.mesh = new THREE.Group();
        this.mesh.position.set(xPos, 0, zPos);
        this.originalX = xPos;
        
        // Bounding box size dimensions
        this.size = { width: 1.0, height: 1.0, depth: 1.0 };
        this.isMoving = false;
        this.moveSpeed = 0;
        this.hasRamp = false;
        this.health = 1; // Number of gun hits required to destroy it
        this.destructible = true;

        this.buildMesh();
    }

    buildMesh() {
        let mat;
        
        switch (this.type) {
            case 'barrier_low':
                // Red Brick Wall (Minecraft style)
                this.size = { width: 2.2, height: 0.8, depth: 0.4 };
                this.health = 1;
                mat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.9 }); // Brick Red
                
                const wallGeo = new THREE.BoxGeometry(this.size.width, this.size.height, this.size.depth);
                const wall = new THREE.Mesh(wallGeo, mat);
                wall.position.y = this.size.height / 2;
                wall.castShadow = true;
                wall.receiveShadow = true;
                this.mesh.add(wall);
                
                // Add brick line detail
                const brickLineMat = new THREE.MeshBasicMaterial({ color: 0x450a0a });
                const line1 = new THREE.Mesh(new THREE.BoxGeometry(this.size.width + 0.02, 0.04, this.size.depth + 0.02), brickLineMat);
                line1.position.y = 0.4;
                this.mesh.add(line1);
                break;

            case 'barrier_high':
                // Voxel military wire/wood gate (Slide/roll under)
                this.size = { width: 2.4, height: 2.2, depth: 0.4 };
                this.health = 2; // Stronger
                mat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }); // Dark wood
                
                const topBarGeo = new THREE.BoxGeometry(this.size.width, 0.2, this.size.depth);
                const topBar = new THREE.Mesh(topBarGeo, mat);
                topBar.position.y = 2.1;
                topBar.castShadow = true;
                
                const legTL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), mat);
                legTL.position.set(-1.1, 1.1, 0);
                legTL.castShadow = true;
                
                const legTR = legTL.clone();
                legTR.position.x = 1.1;
                
                // Barbed wire diagonal crossbars (voxel style)
                const wireMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
                const wireGeo = new THREE.BoxGeometry(0.06, 2.0, 0.06);
                wireGeo.rotateZ(0.6);
                const wireL = new THREE.Mesh(wireGeo, wireMat);
                wireL.position.set(0, 1.1, 0);
                this.mesh.add(wireL);

                this.mesh.add(topBar, legTL, legTR);
                break;

            case 'train_static':
                // Static military supply cargo containers
                this.size = { width: 2.2, height: 2.6, depth: 15.0 };
                this.hasRamp = true; 
                this.destructible = false; // Cannot destroy large shipping containers
                this.buildCargoMesh(0x1e3a8a); // Blue container
                break;

            case 'train_moving':
                // Moving voxel military transport truck
                this.size = { width: 2.2, height: 2.6, depth: 12.0 };
                this.isMoving = true;
                this.moveSpeed = -15; // Drives towards player
                this.destructible = false;
                this.buildCargoMesh(0x065f46); // Green military cargo
                break;

            case 'traffic_cone':
                // PUBG AirDrop Supply Crate (Red box with blue tarp cover!)
                this.size = { width: 1.0, height: 1.0, depth: 1.0 };
                this.health = 1;
                
                // Red crate body
                const crateGeo = new THREE.BoxGeometry(this.size.width, this.size.height - 0.2, this.size.depth);
                const crateMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.8 }); // Red
                const crate = new THREE.Mesh(crateGeo, crateMat);
                crate.position.y = 0.4;
                crate.castShadow = true;
                this.mesh.add(crate);

                // Blue tarp covering top
                const tarpGeo = new THREE.BoxGeometry(this.size.width + 0.08, 0.3, this.size.depth + 0.08);
                const tarpMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 }); // Blue
                const tarp = new THREE.Mesh(tarpGeo, tarpMat);
                tarp.position.y = 0.85;
                tarp.castShadow = true;
                this.mesh.add(tarp);
                break;
        }
    }

    buildCargoMesh(colorVal) {
        const containerMat = new THREE.MeshStandardMaterial({ color: colorVal, metalness: 0.1, roughness: 0.8 });
        const stripMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.1 });

        // Voxel shipping container box
        const boxGeo = new THREE.BoxGeometry(this.size.width, this.size.height - 0.2, this.size.depth);
        const container = new THREE.Mesh(boxGeo, containerMat);
        container.position.y = this.size.height / 2 + 0.1;
        container.castShadow = true;
        container.receiveShadow = true;
        this.mesh.add(container);

        // Voxel ridges/stripes decals (container corrugated walls)
        for (let i = -this.size.depth/2 + 1; i < this.size.depth/2; i += 1.5) {
            const ridgeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, this.size.height - 0.22, 0.4), stripMat);
            ridgeL.position.set(-this.size.width/2 - 0.01, this.size.height/2 + 0.1, i);
            this.mesh.add(ridgeL);

            const ridgeR = ridgeL.clone();
            ridgeR.position.x = this.size.width/2 + 0.01;
            this.mesh.add(ridgeR);
        }

        // Ramp for static container
        if (this.hasRamp) {
            const rampGeo = new THREE.BoxGeometry(this.size.width - 0.2, 0.1, 4.0);
            rampGeo.rotateX(-0.5); // Ramp angle
            const ramp = new THREE.Mesh(rampGeo, containerMat);
            ramp.position.set(0, 1.1, -this.size.depth / 2 - 1.2);
            this.mesh.add(ramp);
        }
    }

    update(delta) {
        if (this.isMoving) {
            this.mesh.position.z += this.moveSpeed * delta;
        }
    }
}

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.spawnZ = 80;
        this.spawnInterval = 32;
    }

    update(playerZ, delta) {
        // 1. Update and recycle
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.update(delta);

            if (obs.mesh.position.z < playerZ - 20) {
                this.scene.remove(obs.mesh);
                this.obstacles.splice(i, 1);
            }
        }

        // 2. Spawn ahead
        while (this.spawnZ < playerZ + 200) {
            this.spawnObstacleSet(this.spawnZ);
            this.spawnZ += this.spawnInterval;
        }
    }

    spawnObstacleSet(zPos) {
        // Random layout
        const pattern = randomChoice([
            ['barrier_low', null, 'train_static'],
            ['train_moving', 'barrier_high', null],
            [null, 'traffic_cone', 'barrier_low'],
            ['barrier_high', 'train_static', 'traffic_cone'],
            ['traffic_cone', 'barrier_high', 'train_moving'],
            [null, 'barrier_low', null]
        ]);

        for (let lane = 0; lane < 3; lane++) {
            const type = pattern[lane];
            if (type) {
                const xPos = (lane - 1) * GAME_SETTINGS.LANE_WIDTH;
                const obstacle = new Obstacle(type, xPos, zPos);
                
                this.scene.add(obstacle.mesh);
                this.obstacles.push(obstacle);
            }
        }
    }

    reset() {
        for (const obs of this.obstacles) {
            this.scene.remove(obs.mesh);
        }
        this.obstacles = [];
        this.spawnZ = 80;
    }
}
