/**
 * Dynamic Third-Person Follow Camera.
 */
import { lerp } from './utils.js';

export class FollowCamera {
    constructor() {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Base offset relative to the player
        this.offset = new THREE.Vector3(0, 4.5, -6.5);
        this.lookAtOffset = new THREE.Vector3(0, 1.5, 3.5);
        
        // Dynamic effects variables
        this.shakeIntensity = 0;
        this.shakeDecay = 0.9;
        this.currentShake = new THREE.Vector3();
    }

    /**
     * Set camera shake intensity.
     */
    shake(intensity) {
        this.shakeIntensity = intensity;
    }

    /**
     * Follow player position.
     */
    update(playerMesh, speed, delta) {
        if (!playerMesh) return;

        const targetPos = playerMesh.position;

        // Dynamic adjustment for mobile screens (portrait aspect ratio)
        const aspect = window.innerWidth / window.innerHeight;
        let baseFov = 60;
        let currentOffset = this.offset.clone();

        if (aspect < 1) {
            // Narrow vertical screens: pull camera back and lift it higher
            // to ensure lanes and player mesh stay in frustum and are clearly visible.
            baseFov = 65 + (1 - aspect) * 15; // aspect = 0.5 => fov = 72.5
            
            const zoomMultiplier = Math.min(1.8, 1.3 / aspect);
            currentOffset.z *= zoomMultiplier; // Pull back
            currentOffset.y *= (1.0 + (1 - aspect) * 0.4); // Lift higher
            
            // Safety bounds to prevent extreme camera offsets
            currentOffset.z = Math.max(-12.0, currentOffset.z);
            currentOffset.y = Math.min(7.5, currentOffset.y);
        }

        // 1. Calculate base camera position (centered horizontally to prevent screen shaking)
        let targetCamX = 0;
        let targetCamY = targetPos.y + currentOffset.y;
        
        // If player is flying high with jetpack, pull camera back/down slightly for better view
        if (targetPos.y > 4) {
            targetCamY = targetPos.y + 3.0 * (currentOffset.y / 4.5);
        }

        let targetCamZ = targetPos.z + currentOffset.z;

        // 2. Smooth damping (Lerp)
        this.camera.position.x = lerp(this.camera.position.x, targetCamX, delta * 8);
        this.camera.position.y = lerp(this.camera.position.y, targetCamY, delta * 6);
        this.camera.position.z = lerp(this.camera.position.z, targetCamZ, delta * 12);

        // 3. Handle FOV based on forward velocity
        const targetFov = baseFov + (speed - 18) * 0.3; // Speed dependent FOV
        this.camera.fov = lerp(this.camera.fov, targetFov, delta * 2);
        this.camera.updateProjectionMatrix();

        // 4. Compute camera shake offset
        if (this.shakeIntensity > 0.01) {
            this.currentShake.set(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity
            );
            this.shakeIntensity *= this.shakeDecay; // Decay over time
        } else {
            this.currentShake.set(0, 0, 0);
            this.shakeIntensity = 0;
        }

        // Apply shake
        this.camera.position.add(this.currentShake);

        // 5. Update lookAt vector (looking straight down the center lane)
        const lookTarget = new THREE.Vector3(
            0,
            targetPos.y * 0.5 + this.lookAtOffset.y,
            targetPos.z + this.lookAtOffset.z
        );
        this.camera.lookAt(lookTarget);
    }
}

export const followCamera = new FollowCamera();
export default followCamera;
