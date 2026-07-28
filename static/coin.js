/**
 * Voxel Coins, Diamonds and Chests (Minecraft Voxel style).
 */
import { GAME_SETTINGS } from './settings.js';
import { randomChoice } from './utils.js';

export class Collectible {
    constructor(type, xPos, yPos, zPos) {
        this.type = type;
        this.mesh = new THREE.Group();
        this.mesh.position.set(xPos, yPos, zPos);
        this.collected = false;

        this.buildMesh();
    }

    buildMesh() {
        if (this.type === 'coin') {
            // Gold Block (Voxel style)
            const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0xfbbf24, 
                roughness: 0.2,
                metalness: 0.1,
                emissive: 0xd97706,
                emissiveIntensity: 0.15
            });
            const goldBlock = new THREE.Mesh(geo, mat);
            goldBlock.castShadow = true;
            this.mesh.add(goldBlock);
            
            // Add darker core pattern
            const coreGeo = new THREE.BoxGeometry(0.18, 0.18, 0.36);
            const coreMat = new THREE.MeshStandardMaterial({ color: 0xd97706 });
            const core = new THREE.Mesh(coreGeo, coreMat);
            this.mesh.add(core);
        } else if (this.type === 'diamond') {
            // Olmos Block (Cyan voxel cube)
            const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x06b6d4, 
                roughness: 0.1,
                metalness: 0.1,
                emissive: 0x0891b2,
                emissiveIntensity: 0.25
            });
            const diamondBlock = new THREE.Mesh(geo, mat);
            diamondBlock.castShadow = true;
            this.mesh.add(diamondBlock);
        } else if (this.type === 'mystery_box') {
            // Minecraft Lucky/Chest Block (Voxel box)
            const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x78350f, 
                roughness: 0.9,
                emissive: 0x451a03,
                emissiveIntensity: 0.1
            });
            const box = new THREE.Mesh(geo, mat);
            box.castShadow = true;
            this.mesh.add(box);
            
            // Black voxel details
            const lockGeo = new THREE.BoxGeometry(0.08, 0.12, 0.52);
            const lockMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24 });
            const lock = new THREE.Mesh(lockGeo, lockMat);
            this.mesh.add(lock);
        }
    }

    update(delta) {
        this.mesh.rotation.y += delta * 2.5;
        this.mesh.rotation.x += delta * 0.8; // Wobble spin
    }
}

export class CoinManager {
    constructor(scene) {
        this.scene = scene;
        this.items = [];
        this.spawnZ = 50;
        this.spawnInterval = 15;
    }

    update(playerMesh, hasMagnet, playerZ, delta) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.update(delta);

            if (hasMagnet && item.type === 'coin' && !item.collected) {
                const dist = item.mesh.position.distanceTo(playerMesh.position);
                if (dist < 12) {
                    const targetPos = playerMesh.position.clone();
                    targetPos.y += 0.8;
                    item.mesh.position.lerp(targetPos, delta * 8);
                }
            }

            if (item.mesh.position.z < playerZ - 20) {
                this.scene.remove(item.mesh);
                this.items.splice(i, 1);
            }
        }

        while (this.spawnZ < playerZ + 200) {
            this.spawnCoinPattern(this.spawnZ);
            this.spawnZ += this.spawnInterval;
        }
    }

    spawnCoinPattern(zPos) {
        const lane = randomChoice([0, 1, 2]);
        const xPos = (lane - 1) * GAME_SETTINGS.LANE_WIDTH;
        const patternType = randomChoice(['straight', 'jump_arc', 'diamond_rare']);
        
        if (patternType === 'straight') {
            for (let i = 0; i < 4; i++) {
                const coin = new Collectible('coin', xPos, 0.6, zPos + i * 2.5);
                this.scene.add(coin.mesh);
                this.items.push(coin);
            }
        } else if (patternType === 'jump_arc') {
            const arcY = [0.6, 1.4, 2.0, 1.4, 0.6];
            for (let i = 0; i < 5; i++) {
                const coin = new Collectible('coin', xPos, arcY[i], zPos + i * 2.5);
                this.scene.add(coin.mesh);
                this.items.push(coin);
            }
        } else if (patternType === 'diamond_rare') {
            if (Math.random() > 0.85) {
                const type = Math.random() > 0.7 ? 'mystery_box' : 'diamond';
                const col = new Collectible(type, xPos, 0.7, zPos + 5);
                this.scene.add(col.mesh);
                this.items.push(col);
            } else {
                const coin = new Collectible('coin', xPos, 0.6, zPos + 5);
                this.scene.add(coin.mesh);
                this.items.push(coin);
            }
        }
    }

    reset() {
        for (const item of this.items) {
            this.scene.remove(item.mesh);
        }
        this.items = [];
        this.spawnZ = 50;
    }
}
export default CoinManager;
