/**
 * Procedural Minecraft Voxel Map Generator.
 */
import { GAME_SETTINGS } from './settings.js';
import { randomRange, randomChoice } from './utils.js';

export class MapGenerator {
    constructor(scene) {
        this.scene = scene;
        this.activeChunks = [];
        this.chunkIdCounter = 0;
        
        // Voxel materials
        this.grassMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.9 }); // Minecraft Grass Green
        this.dirtMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 }); // Minecraft Dirt Brown
        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 }); // Wood trunk
        this.leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 }); // Voxel Leaves
        this.gravelMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 }); // Gray gravel
        
        this.generateInitialMap();
    }

    /**
     * Generate first visible chunks.
     */
    generateInitialMap() {
        // Chunk 0 is starting zone
        const chunk = this.createChunk(0, true);
        this.activeChunks.push(chunk);
        
        for (let i = 1; i < GAME_SETTINGS.MAX_VISIBLE_CHUNKS; i++) {
            const zOffset = i * GAME_SETTINGS.CHUNK_SIZE;
            const nextChunk = this.createChunk(zOffset, false);
            this.activeChunks.push(nextChunk);
        }
    }

    /**
     * Create voxel ground chunk.
     */
    createChunk(zOffset, isSafeStart) {
        const chunkGroup = new THREE.Group();
        chunkGroup.position.z = zOffset;
        chunkGroup.name = `chunk_${this.chunkIdCounter++}`;

        const width = 14;
        const length = GAME_SETTINGS.CHUNK_SIZE;

        // 1. Voxel grass road bed
        // We compose it of block units or a single styled box representing a voxel layer
        const grassGeo = new THREE.BoxGeometry(width, 0.2, length);
        const grassMesh = new THREE.Mesh(grassGeo, this.grassMat);
        grassMesh.position.set(0, -0.1, length / 2);
        grassMesh.receiveShadow = true;
        chunkGroup.add(grassMesh);

        const dirtGeo = new THREE.BoxGeometry(width, 0.8, length);
        const dirtMesh = new THREE.Mesh(dirtGeo, this.dirtMat);
        dirtMesh.position.set(0, -0.6, length / 2);
        dirtMesh.receiveShadow = true;
        chunkGroup.add(dirtMesh);

        // 2. Lanes (Gravel bed instead of steel rail tracks to fit Minecraft)
        this.buildVoxelTracks(chunkGroup, -GAME_SETTINGS.LANE_WIDTH, length);
        this.buildVoxelTracks(chunkGroup, 0, length);
        this.buildVoxelTracks(chunkGroup, GAME_SETTINGS.LANE_WIDTH, length);

        // 3. Sidewalks (Stone voxel curbs)
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 }); // Stone blocks
        const curbGeo = new THREE.BoxGeometry(1.2, 0.3, length);
        
        const leftCurb = new THREE.Mesh(curbGeo, curbMat);
        leftCurb.position.set(-width/2 - 0.6, 0.15, length/2);
        leftCurb.receiveShadow = true;
        chunkGroup.add(leftCurb);

        const rightCurb = leftCurb.clone();
        rightCurb.position.x = width/2 + 0.6;
        chunkGroup.add(rightCurb);

        // 4. Voxel Trees (Instead of skyscrapers)
        if (!isSafeStart) {
            this.buildVoxelForest(chunkGroup, -width/2 - 4.5, length);
            this.buildVoxelForest(chunkGroup, width/2 + 4.5, length);
        }

        this.scene.add(chunkGroup);
        return chunkGroup;
    }

    /**
     * Build voxel pathways for player lanes using stone brick style.
     */
    buildVoxelTracks(group, xPos, length) {
        // Center paths
        const pathGeo = new THREE.BoxGeometry(1.8, 0.04, length);
        const pathMesh = new THREE.Mesh(pathGeo, this.gravelMat);
        pathMesh.position.set(xPos, 0.02, length/2);
        pathMesh.receiveShadow = true;
        group.add(pathMesh);
        
        // Voxel borders
        const borderMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
        const borderGeo = new THREE.BoxGeometry(0.1, 0.08, length);
        
        const borderL = new THREE.Mesh(borderGeo, borderMat);
        borderL.position.set(xPos - 0.9, 0.04, length/2);
        group.add(borderL);

        const borderR = borderL.clone();
        borderR.position.x = xPos + 0.9;
        group.add(borderR);
    }

    /**
     * Spawn Minecraft-style blocky trees on the sides.
     */
    buildVoxelForest(group, xPos, length) {
        const spacing = 15;
        const count = length / spacing;

        for (let i = 0; i < count; i++) {
            // Random tree coordinates
            const zOffset = i * spacing + randomRange(2, 8);
            const finalX = xPos + randomRange(-1.5, 1.5);
            
            // 1. Trunk (Minecraft brown log column)
            const trunkHeight = randomRange(2.5, 4.0);
            const trunkGeo = new THREE.BoxGeometry(0.4, trunkHeight, 0.4);
            const trunk = new THREE.Mesh(trunkGeo, this.woodMat);
            trunk.position.set(finalX, trunkHeight / 2, zOffset);
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            // 2. Voxel leaves (Minecraft blocky canopy)
            const leavesGroup = new THREE.Group();
            leavesGroup.position.set(finalX, trunkHeight, zOffset);

            // Bottom leaves layer
            const leavesGeo1 = new THREE.BoxGeometry(1.4, 0.6, 1.4);
            const leavesL1 = new THREE.Mesh(leavesGeo1, this.leavesMat);
            leavesL1.position.y = 0.3;
            leavesL1.castShadow = true;
            leavesGroup.add(leavesL1);

            // Middle leaves layer
            const leavesGeo2 = new THREE.BoxGeometry(1.0, 0.6, 1.0);
            const leavesL2 = new THREE.Mesh(leavesGeo2, this.leavesMat);
            leavesL2.position.y = 0.9;
            leavesL2.castShadow = true;
            leavesGroup.add(leavesL2);

            // Top leaf crown
            const leavesGeo3 = new THREE.BoxGeometry(0.6, 0.4, 0.6);
            const leavesL3 = new THREE.Mesh(leavesGeo3, this.leavesMat);
            leavesL3.position.y = 1.4;
            leavesL3.castShadow = true;
            leavesGroup.add(leavesL3);

            group.add(leavesGroup);
        }
    }

    /**
     * Endless updates: Recycle old chunks.
     */
    update(playerZ) {
        if (this.activeChunks.length > 0) {
            const oldest = this.activeChunks[0];
            const cleanupDist = playerZ - GAME_SETTINGS.CHUNK_SIZE * 1.5;
            
            if (oldest.position.z < cleanupDist) {
                this.activeChunks.shift();
                this.scene.remove(oldest);
                
                const newestZ = this.activeChunks[this.activeChunks.length - 1].position.z + GAME_SETTINGS.CHUNK_SIZE;
                const newChunk = this.createChunk(newestZ, false);
                this.activeChunks.push(newChunk);
            }
        }
    }

    reset() {
        for (const chunk of this.activeChunks) {
            this.scene.remove(chunk);
        }
        this.activeChunks = [];
        this.chunkIdCounter = 0;
        this.generateInitialMap();
    }

    setSeason(season) {
        let grassColor = 0x16a34a; // Bahor (Spring green)
        let leavesColor = 0x15803d;
        let dirtColor = 0x78350f;

        if (season === 'yoz') {
            grassColor = 0xa3e635; // Yoz (Bright lime green)
            leavesColor = 0x16a34a; 
            dirtColor = 0x854d0e;
        } else if (season === 'kuz') {
            grassColor = 0xd97706; // Kuz (Autumn orange/brown)
            leavesColor = 0xea580c; // Autumn red-orange leaves
            dirtColor = 0x451a03;
        } else if (season === 'qish') {
            grassColor = 0xffffff; // Qish (Snow white)
            leavesColor = 0x0f766e; // Winter frosted dark teal pine leaves
            dirtColor = 0x374151; // Frozen grey dirt
        }

        this.grassMat.color.setHex(grassColor);
        this.leavesMat.color.setHex(leavesColor);
        this.dirtMat.color.setHex(dirtColor);
    }
}
