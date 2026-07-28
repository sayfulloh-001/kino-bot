/**
 * 3D Minecraft+PUBG Stylized Player Voxel Mesh & Controller.
 */
import { GAME_SETTINGS } from './settings.js';
import { lerp } from './utils.js';
import { animationManager } from './animations.js';
import { audioManager } from './audio.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        
        // Group containing all character body meshes
        this.mesh = new THREE.Group();
        this.parts = {}; // Limb references for animation
        
        // Movement state
        this.currentLane = 1; // 0 = Left, 1 = Center, 2 = Right
        this.targetX = 0;
        this.posY = 0;
        this.velY = 0;
        
        this.state = 'run'; // 'idle', 'run', 'jump', 'roll', 'hit'
        this.rollTimer = 0;
        this.isGrounded = true;
        
        // Powerup status
        this.hasJetpack = false;
        this.jetpackTimer = 0;
        this.hasShield = false;
        
        this.activeSkin = 'classic';
        
        this.createCharacter();
        this.scene.add(this.mesh);
    }

    /**
     * Build the voxel character model (Minecraft style) with a blocky PUBG rifle.
     */
    createCharacter() {
        // Clear previous meshes
        while (this.mesh.children.length > 0) {
            this.mesh.remove(this.mesh.children[0]);
        }

        // Setup material colors based on active outfit
        let primaryColor = 0x0284c7; // Steve Blue Shirt
        let secondaryColor = 0x7c2d12; // Steve brown pants
        let skinColor = 0xfbcfe8; // Steve skin
        let gunColor = 0x1e293b; // Slated steel gun
        
        if (this.activeSkin === 'cyber') {
            primaryColor = 0x1e1b4b; // Cyber Indigo
            secondaryColor = 0x10b981; // Neon Green
            skinColor = 0x475569;
            gunColor = 0x06b6d4;
        } else if (this.activeSkin === 'gold') {
            primaryColor = 0xf59e0b; // Gold shirt
            secondaryColor = 0xd97706; // Dark Gold pants
            skinColor = 0xfef08a; // Golden face
            gunColor = 0x1e1b4b;
        }

        // Materials
        const bodyMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.8 }); // Voxel look is matte
        const pantsMat = new THREE.MeshStandardMaterial({ color: secondaryColor, roughness: 0.8 });
        const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x2563eb }); // Blue eyes
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
        const gunMat = new THREE.MeshStandardMaterial({ color: gunColor, roughness: 0.5, metalness: 0.5 });

        // 1. Torso/Body (Minecraft Box)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.35);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.95;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.mesh.add(bodyMesh);
        this.parts.body = bodyMesh;

        // 2. Head (Voxel Cube)
        const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const headMesh = new THREE.Mesh(headGeo, skinMat);
        headMesh.position.y = 0.525; // Relative to torso center
        headMesh.castShadow = true;
        bodyMesh.add(headMesh);
        this.parts.head = headMesh;

        // Hair block overlay
        const hairGeo = new THREE.BoxGeometry(0.36, 0.1, 0.36);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.y = 0.15;
        headMesh.add(hair);

        // Voxel eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.04, 0.02);
        
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.08, 0.04, 0.18);
        const pupilL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), pupilMat);
        pupilL.position.set(-0.02, 0, 0.01);
        eyeL.add(pupilL);
        headMesh.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.08, 0.04, 0.18);
        const pupilR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), pupilMat);
        pupilR.position.set(0.02, 0, 0.01);
        eyeR.add(pupilR);
        headMesh.add(eyeR);

        // 3. Left Leg (Voxel Box)
        const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
        leftLegMesh.position.set(-0.13, -0.65, 0); // Relative to body
        leftLegMesh.castShadow = true;
        bodyMesh.add(leftLegMesh);
        this.parts.leftLeg = leftLegMesh;

        // 4. Right Leg
        const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
        rightLegMesh.position.set(0.13, -0.65, 0);
        rightLegMesh.castShadow = true;
        bodyMesh.add(rightLegMesh);
        this.parts.rightLeg = rightLegMesh;

        // 5. Left Arm
        const armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
        const leftArmMesh = new THREE.Mesh(armGeo, bodyMat);
        leftArmMesh.position.set(-0.35, 0.05, 0);
        leftArmMesh.castShadow = true;
        bodyMesh.add(leftArmMesh);
        this.parts.leftArm = leftArmMesh;

        // Skin cuffs on hand
        const handGeo = new THREE.BoxGeometry(0.18, 0.1, 0.18);
        const leftHand = new THREE.Mesh(handGeo, skinMat);
        leftHand.position.y = -0.3;
        leftArmMesh.add(leftHand);

        // 6. Right Arm (Carries the PUBG blocky gun)
        const rightArmMesh = new THREE.Mesh(armGeo, bodyMat);
        rightArmMesh.position.set(0.35, 0.05, 0);
        rightArmMesh.castShadow = true;
        bodyMesh.add(rightArmMesh);
        this.parts.rightArm = rightArmMesh;
        
        const rightHand = new THREE.Mesh(handGeo, skinMat);
        rightHand.position.y = -0.3;
        rightArmMesh.add(rightHand);

        // ================= PUBG VOXEL RIFLE =================
        // Construct gun model using box primitives
        this.gunGroup = new THREE.Group();
        this.gunGroup.position.set(0, -0.3, 0.15); // Attach to right hand position
        this.gunGroup.rotation.x = Math.PI / 2; // Point forward

        // Main body of rifle
        const gunBodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.5);
        const gunBody = new THREE.Mesh(gunBodyGeo, gunMat);
        gunBody.castShadow = true;
        this.gunGroup.add(gunBody);

        // Rifle Barrel
        const barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.4);
        const barrel = new THREE.Mesh(barrelGeo, gunMat);
        barrel.position.set(0, 0.04, -0.4);
        barrel.castShadow = true;
        this.gunGroup.add(barrel);

        // Magazine
        const magGeo = new THREE.BoxGeometry(0.06, 0.18, 0.1);
        magGeo.rotateX(0.2); // Curved magazine
        const mag = new THREE.Mesh(magGeo, gunMat);
        mag.position.set(0, -0.12, -0.05);
        this.gunGroup.add(mag);

        // Stock (butt of rifle)
        const stockGeo = new THREE.BoxGeometry(0.07, 0.1, 0.2);
        const stock = new THREE.Mesh(stockGeo, gunMat);
        stock.position.set(0, -0.02, 0.3);
        this.gunGroup.add(stock);

        // Scope/Sight on top
        const scopeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.12);
        const scope = new THREE.Mesh(scopeGeo, gunMat);
        scope.position.set(0, 0.09, 0);
        this.gunGroup.add(scope);

        // Attach gun group to right arm
        rightArmMesh.add(this.gunGroup);

        // 7. Voxel Hoverboard (Jetpack Mode)
        const boardGeo = new THREE.BoxGeometry(0.7, 0.1, 1.4);
        const boardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.1, roughness: 0.8 }); // Red block
        const boardMesh = new THREE.Mesh(boardGeo, boardMat);
        boardMesh.position.set(0, -0.75, 0);
        boardMesh.visible = false;
        bodyMesh.add(boardMesh);
        this.parts.board = boardMesh;

        // Initial position
        this.mesh.position.set(0, 0, 0);
    }

    /**
     * Trigger skin change.
     */
    setSkin(skinName) {
        this.activeSkin = skinName;
        this.createCharacter();
    }

    /**
     * Controls.
     */
    moveLeft() {
        if (this.state === 'hit') return;
        if (this.currentLane > 0) {
            this.currentLane--;
            audioManager.playSFX('footstep');
        }
    }

    moveRight() {
        if (this.state === 'hit') return;
        if (this.currentLane < GAME_SETTINGS.LANE_COUNT - 1) {
            this.currentLane++;
            audioManager.playSFX('footstep');
        }
    }

    jump() {
        if (this.state === 'hit' || this.hasJetpack) return;
        if (this.isGrounded) {
            this.velY = GAME_SETTINGS.JUMP_FORCE;
            this.isGrounded = false;
            this.state = 'jump';
            audioManager.playSFX('jump');
        }
    }

    roll() {
        if (this.state === 'hit' || this.hasJetpack) return;
        this.state = 'roll';
        this.rollTimer = GAME_SETTINGS.ROLL_DURATION;
        if (!this.isGrounded) {
            this.velY = -GAME_SETTINGS.JUMP_FORCE * 1.2;
        }
        audioManager.playSFX('footstep');
    }

    /**
     * Frame Update.
     */
    update(delta, speed) {
        // Calculate lane X
        this.targetX = (this.currentLane - 1) * GAME_SETTINGS.LANE_WIDTH;
        this.mesh.position.x = lerp(this.mesh.position.x, this.targetX, delta * 15);

        // Physics Y
        if (this.hasJetpack) {
            this.state = 'jump';
            const flyHeight = 6.0;
            this.mesh.position.y = lerp(this.mesh.position.y, flyHeight, delta * 5);
            this.parts.board.visible = true;
        } else {
            this.parts.board.visible = false;
            if (!this.isGrounded) {
                this.velY += GAME_SETTINGS.GRAVITY * delta;
                this.mesh.position.y += this.velY * delta;
                
                if (this.mesh.position.y <= 0) {
                    this.mesh.position.y = 0;
                    this.velY = 0;
                    this.isGrounded = true;
                    if (this.state !== 'roll') {
                        this.state = 'run';
                    }
                }
            }
        }

        // Roll decays
        if (this.state === 'roll') {
            this.rollTimer -= delta;
            if (this.rollTimer <= 0) {
                this.state = this.isGrounded ? 'run' : 'jump';
            }
        }

        // Procedural joint oscillations
        animationManager.animate(this.parts, this.state, delta, speed);

        // Extra holding-gun pose
        if (this.state === 'run' || this.state === 'idle') {
            // Point gun forward: raise right arm slightly
            this.parts.rightArm.rotation.x = -1.2; // Angle forward
            this.parts.rightArm.rotation.y = -0.3; // cross chest slightly
        }
    }
}
