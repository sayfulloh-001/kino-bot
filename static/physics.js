/**
 * Simple collision detection and movement physics.
 */
import { GAME_SETTINGS } from './settings.js';

export class PhysicsManager {
    constructor() {
        // Player's dynamic bounding box
        this.playerBox = new THREE.Box3();
        this.obstacleBox = new THREE.Box3();
    }

    /**
     * Compute and update the player's bounding box based on state.
     * @param {THREE.Object3D} playerMesh - The 3D player mesh group
     * @param {string} state - Player's current action state ('run', 'jump', 'roll')
     */
    updatePlayerBox(playerMesh, state) {
        if (!playerMesh) return;
        
        // Define bounding box dimensions based on player state
        let width = 0.8;
        let height = (state === 'roll') ? 0.8 : 1.8;
        let depth = 0.6;
        
        const pos = playerMesh.position;
        
        // Set box coordinates centered around the player's position
        // Roll moves the bounding box center down
        const yOffset = (state === 'roll') ? height / 2 : height / 2;
        
        this.playerBox.set(
            new THREE.Vector3(pos.x - width/2, pos.y, pos.z - depth/2),
            new THREE.Vector3(pos.x + width/2, pos.y + height, pos.z + depth/2)
        );
    }

    /**
     * Determine if a player collides with an obstacle.
     * @param {THREE.Object3D} playerMesh - Player's 3D object
     * @param {string} playerState - 'run', 'jump', or 'roll'
     * @param {object} obstacle - Obstacle instance with size/pos parameters
     * @returns {boolean} True if collision detected
     */
    checkCollision(playerMesh, playerState, obstacle) {
        this.updatePlayerBox(playerMesh, playerState);
        
        const mesh = obstacle.mesh;
        if (!mesh) return false;
        
        const pos = mesh.position;
        const size = obstacle.size; // { width, height, depth }
        
        // Set obstacle bounding box
        this.obstacleBox.set(
            new THREE.Vector3(pos.x - size.width/2, pos.y, pos.z - size.depth/2),
            new THREE.Vector3(pos.x + size.width/2, pos.y + size.height, pos.z + size.depth/2)
        );
        
        return this.playerBox.intersectsBox(this.obstacleBox);
    }

    /**
     * Verify if player collects a coin.
     * @param {THREE.Object3D} playerMesh - Player
     * @param {THREE.Object3D} coinMesh - Coin
     * @returns {boolean} True if collected
     */
    checkCoinCollection(playerMesh, coinMesh) {
        if (!playerMesh || !coinMesh) return false;
        const dist = playerMesh.position.distanceTo(coinMesh.position);
        return dist < 1.5; // Collection radius
    }
}

export const physicsManager = new PhysicsManager();
export default physicsManager;
