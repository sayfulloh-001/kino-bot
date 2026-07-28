/**
 * Voxel Power-ups (Minecraft style).
 */
import { GAME_SETTINGS } from './settings.js';
import { randomChoice } from './utils.js';

export class PowerUpItem {
    constructor(type, xPos, yPos, zPos) {
        this.type = type;
        this.mesh = new THREE.Group();
        this.mesh.position.set(xPos, yPos, zPos);
        this.originalX = xPos;
        this.collected = false;

        this.buildMesh();
    }

    buildMesh() {
        let mat;
        
        switch (this.type) {
            case 'magnet': {
                // Voxel U-Magnet
                mat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.8 }); // Orange
                const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                
                const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), mat);
                base.castShadow = true;
                this.mesh.add(base);

                const prongL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), mat);
                prongL.position.set(-0.19, 0.15, 0);
                prongL.castShadow = true;
                
                const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), tipMat);
                tipL.position.set(-0.19, 0.34, 0);
                
                const prongR = prongL.clone();
                prongR.position.x = 0.19;
                
                const tipR = tipL.clone();
                tipR.position.x = 0.19;

                this.mesh.add(prongL, prongR, tipL, tipR);
                break;
            }
            case 'jetpack': {
                // Voxel Double Rockets
                mat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.8 }); // Purple
                const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
                
                const tankL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), mat);
                tankL.position.set(-0.15, 0, 0);
                tankL.castShadow = true;
                
                const nozzleL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), nozzleMat);
                nozzleL.position.set(-0.15, -0.3, 0);
                
                const tankR = tankL.clone();
                tankR.position.x = 0.15;
                
                const nozzleR = nozzleL.clone();
                nozzleR.position.x = 0.15;

                const connector = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), mat);
                
                this.mesh.add(tankL, tankR, nozzleL, nozzleR, connector);
                break;
            }
            case 'multiplier': {
                // Voxel Double Arrows/Cross (2X)
                mat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.8 }); // Red
                
                const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), mat);
                bar1.rotation.z = Math.PI / 4;
                bar1.castShadow = true;
                
                const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), mat);
                bar2.rotation.z = -Math.PI / 4;
                bar2.castShadow = true;
                
                this.mesh.add(bar1, bar2);
                break;
            }
            case 'shield': {
                // Voxel Shield (Green blocky shield)
                mat = new THREE.MeshStandardMaterial({ 
                    color: 0x0d9488, 
                    roughness: 0.8,
                    emissive: 0x14b8a6,
                    emissiveIntensity: 0.2
                });
                
                const face = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.1), mat);
                face.castShadow = true;
                
                const trim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0x056658 }));
                trim.position.y = 0.2;
                
                this.mesh.add(face, trim);
                break;
            }
        }
    }

    update(delta) {
        this.mesh.rotation.y += delta * 2.0;
        this.mesh.position.y += Math.sin(Date.now() * 0.005) * 0.003;
    }
}

export class PowerUpManager {
    constructor(scene) {
        this.scene = scene;
        this.items = [];
        this.spawnZ = 120;
        this.spawnInterval = 75;
    }

    update(playerZ, delta) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.update(delta);

            if (item.mesh.position.z < playerZ - 20) {
                this.scene.remove(item.mesh);
                this.items.splice(i, 1);
            }
        }

        while (this.spawnZ < playerZ + 200) {
            this.spawnPowerUp(this.spawnZ);
            this.spawnZ += this.spawnInterval;
        }
    }

    spawnPowerUp(zPos) {
        const lane = randomChoice([0, 1, 2]);
        const xPos = (lane - 1) * GAME_SETTINGS.LANE_WIDTH;
        const type = randomChoice(['magnet', 'jetpack', 'multiplier', 'shield']);
        const yPos = Math.random() > 0.5 ? 0.6 : 3.2;
        
        const powerup = new PowerUpItem(type, xPos, yPos, zPos);
        this.scene.add(powerup.mesh);
        this.items.push(powerup);
    }

    reset() {
        for (const item of this.items) {
            this.scene.remove(item.mesh);
        }
        this.items = [];
        this.spawnZ = 120;
    }
}
export default PowerUpManager;
