/**
 * 3D Minecraft+PUBG Stylized Player Voxel Mesh & Controller.
 * Upgraded with realistic high-detail textures, materials, and correct screen-space lane switching.
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
        this.wheels = []; // Wheels reference for car skin rotation
        
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
     * Build the voxel character model with premium materials, shaders and high-detail meshes.
     */
    createCharacter() {
        // Clear previous meshes
        while (this.mesh.children.length > 0) {
            this.mesh.remove(this.mesh.children[0]);
        }
        this.wheels = [];

        // Setup base materials with high-quality physical properties
        const steelGunMat = new THREE.MeshStandardMaterial({ 
            color: 0x1e293b, 
            roughness: 0.4, 
            metalness: 0.8
        });

        if (this.activeSkin === 'car') {
            this.buildCarSkin();
            return;
        }

        // Voxel character parts
        // 1. Torso/Body (Base mesh)
        let bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.35);
        let bodyColor = 0x0284c7; // Classic blue shirt
        
        if (this.activeSkin === 'krosh') bodyColor = 0x0ea5e9; // Krosh light blue
        else if (this.activeSkin === 'tigress') bodyColor = 0xea580c; // Tigress orange
        else if (this.activeSkin === 'pubg_soldier') bodyColor = 0x1f2937; // Tactical dark grey
        else if (this.activeSkin === 'gojo') bodyColor = 0x111827; // Gojo dark uniform

        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: bodyColor, 
            roughness: 0.7,
            metalness: 0.1
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.95;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.mesh.add(bodyMesh);
        this.parts.body = bodyMesh;

        // 2. Head (Voxel Cube)
        let headColor = 0xfbcfe8; // Skin pink
        if (this.activeSkin === 'krosh') headColor = 0x0ea5e9;
        else if (this.activeSkin === 'tigress') headColor = 0xea580c;
        else if (this.activeSkin === 'pubg_soldier') headColor = 0xfbcfe8;
        else if (this.activeSkin === 'gojo') headColor = 0xfecdd3;

        let headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        if (this.activeSkin === 'krosh') {
            // Krosh is a single round sphere made of overlapping voxel boxes for smoother look
            headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.52);
            bodyMesh.scale.set(0.01, 0.01, 0.01); // Hide torso block
            bodyMesh.position.y = 0.5; // Offset anchor
        }

        const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.6 });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.y = this.activeSkin === 'krosh' ? 0.35 : 0.525;
        headMesh.castShadow = true;
        bodyMesh.add(headMesh);
        this.parts.head = headMesh;

        // High detail elements for each skin
        if (this.activeSkin === 'krosh') {
            // Krosh rabbit ears
            const earMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7 });
            const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xfda4af }); // Pink inner ears
            
            // Left Ear
            const earLGroup = new THREE.Group();
            earLGroup.position.set(-0.15, 0.3, 0);
            earLGroup.rotation.z = 0.15;
            
            const earLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), earMat);
            earLMesh.castShadow = true;
            const innerEarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.02), innerEarMat);
            innerEarL.position.set(0, 0.02, 0.06);
            earLGroup.add(earLMesh, innerEarL);
            headMesh.add(earLGroup);

            // Right Ear
            const earRGroup = new THREE.Group();
            earRGroup.position.set(0.15, 0.3, 0);
            earRGroup.rotation.z = -0.15;
            
            const earRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), earMat);
            earRMesh.castShadow = true;
            const innerEarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.02), innerEarMat);
            innerEarR.position.set(0, 0.02, 0.06);
            earRGroup.add(earRMesh, innerEarR);
            headMesh.add(earRGroup);

            // Krosh red nose
            const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
            nose.position.set(0, -0.02, 0.28);
            headMesh.add(nose);

            // Krosh bunny teeth
            const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            teeth.position.set(0, -0.12, 0.28);
            headMesh.add(teeth);

            // Krosh detailed eyes
            const eyeGeo = new THREE.BoxGeometry(0.11, 0.15, 0.02);
            const pupilGeo = new THREE.BoxGeometry(0.04, 0.06, 0.01);
            const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            
            const eyeL = new THREE.Mesh(eyeGeo, whiteMat);
            eyeL.position.set(-0.07, 0.08, 0.27);
            const pupilL = new THREE.Mesh(pupilGeo, blackMat);
            pupilL.position.set(0.02, -0.02, 0.01);
            eyeL.add(pupilL);
            
            const eyeR = new THREE.Mesh(eyeGeo, whiteMat);
            eyeR.position.set(0.07, 0.08, 0.27);
            const pupilR = new THREE.Mesh(pupilGeo, blackMat);
            pupilR.position.set(-0.02, -0.02, 0.01);
            eyeR.add(pupilR);

            headMesh.add(eyeL, eyeR);
        } else {
            // General eyes
            const eyeGeo = new THREE.BoxGeometry(0.08, 0.04, 0.02);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const pupilMat = new THREE.MeshBasicMaterial({ color: this.activeSkin === 'gojo' ? 0x00ffff : 0x2563eb });

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
        }

        if (this.activeSkin === 'gojo') {
            // Gojo spiky white hair with realistic standard material
            const hairMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
            const hairBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), hairMat);
            hairBase.position.y = 0.15;
            headMesh.add(hairBase);

            // Add spikes (small boxes rotated)
            const spikeGeo = new THREE.BoxGeometry(0.08, 0.16, 0.08);
            const spikeCoords = [
                [-0.12, 0.18, 0.1], [0.12, 0.18, 0.1], 
                [-0.12, 0.18, -0.1], [0.12, 0.18, -0.1],
                [0, 0.22, 0], [0, 0.18, 0.15], [-0.15, 0.12, 0]
            ];
            for (const coord of spikeCoords) {
                const spike = new THREE.Mesh(spikeGeo, hairMat);
                spike.position.set(coord[0], coord[1], coord[2]);
                spike.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
                headMesh.add(spike);
            }

            // Gojo Black blindfold
            const blindfoldMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
            const blindfold = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), blindfoldMat);
            blindfold.position.set(0, 0.04, 0.01);
            headMesh.add(blindfold);

            // Uniform high collar
            const collarMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
            const collar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.15, 0.28), collarMat);
            collar.position.y = 0.45;
            bodyMesh.add(collar);
        } else if (this.activeSkin === 'pubg_soldier') {
            // PUBG level 3 military helmet
            const helmetMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
            const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.38), helmetMat);
            helmet.position.y = 0.06;
            
            // Glossy black visor window
            const visorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.9 });
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.04), visorMat);
            visor.position.set(0, 0.04, 0.18);
            helmet.add(visor);
            headMesh.add(helmet);

            // Level 3 Backpack (attached to back of body)
            const packMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
            const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.2), packMat);
            backpack.position.set(0, 0, -0.25);
            bodyMesh.add(backpack);
        } else if (this.activeSkin === 'tigress') {
            // Tiger ears with pink details
            const earMat = new THREE.MeshStandardMaterial({ color: 0xea580c });
            const innerEarMat = new THREE.MeshBasicMaterial({ color: 0xfda4af });
            
            const earL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), earMat);
            earL.position.set(-0.14, 0.18, 0);
            earL.rotation.z = 0.3;
            const innerL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), innerEarMat);
            innerL.position.set(0, 0, 0.04);
            earL.add(innerL);
            
            const earR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), earMat);
            earR.position.set(0.14, 0.18, 0);
            earR.rotation.z = -0.3;
            const innerR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), innerEarMat);
            innerR.position.set(0, 0, 0.04);
            earR.add(innerR);
            
            headMesh.add(earL, earR);

            // Tigress yellow/gold vest
            const vestMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.1 });
            const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.37), vestMat);
            vest.position.y = 0.1;
            bodyMesh.add(vest);
        } else if (this.activeSkin === 'classic') {
            // Hair block overlay
            const hairMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
            const hairGeo = new THREE.BoxGeometry(0.36, 0.1, 0.36);
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.y = 0.15;
            headMesh.add(hair);
        }

        // Limbs configuration
        let legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        let armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
        
        let pantsColor = 0x7c2d12; // Steve brown pants
        let skinCuffColor = headColor;
        let armColor = bodyColor;
        
        if (this.activeSkin === 'krosh') {
            // Krosh stubby limbs
            legGeo = new THREE.BoxGeometry(0.16, 0.18, 0.16);
            armGeo = new THREE.BoxGeometry(0.12, 0.28, 0.12);
            pantsColor = 0x0ea5e9;
            armColor = 0x0ea5e9;
        } else if (this.activeSkin === 'tigress') {
            pantsColor = 0x111827; // Black pants
            armColor = 0xea580c; // Orange arms
        } else if (this.activeSkin === 'pubg_soldier') {
            pantsColor = 0x374151; // Grey pants
            armColor = 0x1f2937;
        } else if (this.activeSkin === 'gojo') {
            pantsColor = 0x111827; // Black pants
            armColor = 0x111827;
        }

        const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
        const armMat = new THREE.MeshStandardMaterial({ color: armColor, roughness: 0.8 });
        const handMat = new THREE.MeshStandardMaterial({ color: skinCuffColor, roughness: 0.8 });

        // 3. Left Leg
        const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
        leftLegMesh.position.set(
            this.activeSkin === 'krosh' ? -0.16 : -0.13, 
            this.activeSkin === 'krosh' ? -0.45 : -0.65, 
            0
        );
        leftLegMesh.castShadow = true;
        bodyMesh.add(leftLegMesh);
        this.parts.leftLeg = leftLegMesh;

        // 4. Right Leg
        const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
        rightLegMesh.position.set(
            this.activeSkin === 'krosh' ? 0.16 : 0.13, 
            this.activeSkin === 'krosh' ? -0.45 : -0.65, 
            0
        );
        rightLegMesh.castShadow = true;
        bodyMesh.add(rightLegMesh);
        this.parts.rightLeg = rightLegMesh;

        // 5. Left Arm
        const leftArmMesh = new THREE.Mesh(armGeo, armMat);
        leftArmMesh.position.set(
            this.activeSkin === 'krosh' ? -0.32 : -0.35, 
            this.activeSkin === 'krosh' ? 0.15 : 0.05, 
            0
        );
        leftArmMesh.castShadow = true;
        bodyMesh.add(leftArmMesh);
        this.parts.leftArm = leftArmMesh;

        if (this.activeSkin !== 'krosh') {
            const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), handMat);
            leftHand.position.y = -0.3;
            leftArmMesh.add(leftHand);
        }

        // 6. Right Arm (Weapon anchor)
        const rightArmMesh = new THREE.Mesh(armGeo, armMat);
        rightArmMesh.position.set(
            this.activeSkin === 'krosh' ? 0.32 : 0.35, 
            this.activeSkin === 'krosh' ? 0.15 : 0.05, 
            0
        );
        rightArmMesh.castShadow = true;
        bodyMesh.add(rightArmMesh);
        this.parts.rightArm = rightArmMesh;
        
        if (this.activeSkin !== 'krosh') {
            const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), handMat);
            rightHand.position.y = -0.3;
            rightArmMesh.add(rightHand);
        }

        // Attach blocky rifle
        this.gunGroup = new THREE.Group();
        this.gunGroup.position.set(0, -0.3, 0.15);
        this.gunGroup.rotation.x = Math.PI / 2; // Point forward

        const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), steelGunMat);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), steelGunMat);
        barrel.position.set(0, 0.04, -0.4);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), steelGunMat);
        mag.rotation.x = 0.2;
        mag.position.set(0, -0.12, -0.05);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.2), steelGunMat);
        stock.position.set(0, -0.02, 0.3);

        this.gunGroup.add(gunBody, barrel, mag, stock);
        rightArmMesh.add(this.gunGroup);

        // Voxel Hoverboard (Jetpack Mode)
        const boardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.8 });
        const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.4), boardMat);
        boardMesh.position.set(0, this.activeSkin === 'krosh' ? -0.65 : -0.75, 0);
        boardMesh.visible = false;
        bodyMesh.add(boardMesh);
        this.parts.board = boardMesh;

        this.mesh.position.set(0, 0, 0);
    }

    /**
     * Special builder for Sports Car skin.
     * Rendered with metallic textures and glowing lights.
     */
    buildCarSkin() {
        const carColor = 0x334155; // Metallic slate blue
        const windshieldColor = 0x22d3ee; // Glossy cyan glass
        const wheelColor = 0x0f172a; // Dark black rubber

        const carMat = new THREE.MeshStandardMaterial({ 
            color: carColor, 
            roughness: 0.15, 
            metalness: 0.9
        });
        const glassMat = new THREE.MeshStandardMaterial({ 
            color: windshieldColor, 
            roughness: 0.05,
            metalness: 0.1,
            transparent: true, 
            opacity: 0.65
        });
        const wheelMat = new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.7 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.9 });

        // 1. Core Car Body (mapped to body for animations)
        const bodyMesh = new THREE.Group();
        bodyMesh.position.y = 0.4;
        this.mesh.add(bodyMesh);
        this.parts.body = bodyMesh;

        // Main chassis
        const shell = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 1.35), carMat);
        shell.position.y = 0.15;
        shell.castShadow = true;
        bodyMesh.add(shell);

        // Cabin cockpit
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.65), glassMat);
        cabin.position.set(0, 0.4, 0.05);
        cabin.castShadow = true;
        bodyMesh.add(cabin);

        // Rear Spoiler wing
        const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
        const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.04, 0.16), spoilerMat);
        spoiler.position.set(0, 0.38, -0.62);
        spoiler.castShadow = true;
        bodyMesh.add(spoiler);

        const spoilerLegL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), spoilerMat);
        spoilerLegL.position.set(-0.32, 0.27, -0.62);
        const spoilerLegR = spoilerLegL.clone();
        spoilerLegR.position.x = 0.32;
        bodyMesh.add(spoilerLegL, spoilerLegR);

        // Neon glowing headlights (yellow emissive)
        const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.5 });
        const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), headlightMat);
        headlightL.position.set(-0.28, 0.15, 0.68);
        const headlightR = headlightL.clone();
        headlightR.position.x = 0.28;
        bodyMesh.add(headlightL, headlightR);

        // Neon glowing taillights (red emissive)
        const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 });
        const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.02), taillightMat);
        taillightL.position.set(-0.28, 0.18, -0.68);
        const taillightR = taillightL.clone();
        taillightR.position.x = 0.28;
        bodyMesh.add(taillightL, taillightR);

        // Voxel weapon on top (so car can still shoot!)
        const gunGroup = new THREE.Group();
        gunGroup.position.set(0, 0.35, 0.4);
        gunGroup.rotation.x = Math.PI / 2;
        
        const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
        barrel.position.z = -0.3;
        gunGroup.add(gunBody, barrel);
        bodyMesh.add(gunGroup);
        this.gunGroup = gunGroup; // reference for muzzle flash position

        // 2. Wheels with metallic rims
        const wheelGeo = new THREE.BoxGeometry(0.18, 0.28, 0.28);
        const rimGeo = new THREE.BoxGeometry(0.2, 0.14, 0.14);
        const wheelsCoords = [
            [-0.42, 0.1, 0.45],  // Front Left
            [0.42, 0.1, 0.45],   // Front Right
            [-0.42, 0.1, -0.45], // Rear Left
            [0.42, 0.1, -0.45]   // Rear Right
        ];

        for (const coord of wheelsCoords) {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(coord[0], coord[1], coord[2]);
            
            const tire = new THREE.Mesh(wheelGeo, wheelMat);
            tire.castShadow = true;
            
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.x = Math.PI / 2;
            
            wheelGroup.add(tire, rim);
            bodyMesh.add(wheelGroup);
            this.wheels.push(wheelGroup);
        }

        // Stub/Empty anchors to avoid JS crashes in animation script
        this.parts.head = new THREE.Group();
        this.parts.leftLeg = new THREE.Group();
        this.parts.rightLeg = new THREE.Group();
        this.parts.leftArm = new THREE.Group();
        this.parts.rightArm = new THREE.Group();
        this.parts.board = new THREE.Group();
        bodyMesh.add(this.parts.head, this.parts.leftLeg, this.parts.rightLeg, this.parts.leftArm, this.parts.rightArm, this.parts.board);

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
     * Controls - Corrected globally for screen-space matching.
     * moveLeft swaps from decreasing currentLane to increasing it, aligning with the camera.
     */
    moveLeft() {
        if (this.state === 'hit') return;
        if (this.currentLane < GAME_SETTINGS.LANE_COUNT - 1) {
            this.currentLane++; // Swap logic to correct flipped layout!
            audioManager.playSFX('footstep');
        }
    }

    moveRight() {
        if (this.state === 'hit') return;
        if (this.currentLane > 0) {
            this.currentLane--; // Swap logic to correct flipped layout!
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

        // Rotate wheels if car skin
        if (this.activeSkin === 'car' && this.wheels.length > 0) {
            const rotSpeed = speed * 1.5 * delta;
            for (const wheel of this.wheels) {
                wheel.rotation.x += rotSpeed;
            }
        }

        // Extra holding-gun pose (non-car skins only)
        if (this.activeSkin !== 'car' && (this.state === 'run' || this.state === 'idle')) {
            this.parts.rightArm.rotation.x = -1.2;
            this.parts.rightArm.rotation.y = -0.3;
        }
    }
}
