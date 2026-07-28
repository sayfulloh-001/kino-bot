/**
 * Core 3D Endless Runner Game Engine - GameManager (Minecraft + PUBG Crossover Style).
 */
import { GAME_SETTINGS } from './settings.js';
import { saveManager } from './save.js';
import { audioManager } from './audio.js';
import { formatScore, randomRange } from './utils.js';
import { Player } from './player.js';
import { followCamera } from './camera.js';
import { MapGenerator } from './map.js';
import { ObstacleManager } from './obstacle.js';
import { CoinManager } from './coin.js';
import { PowerUpManager } from './powerups.js';
import { physicsManager } from './physics.js';
import { UIManager } from './ui.js';

class GameManager {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.clock = new THREE.Clock();
        
        // Game stats
        this.score = 0;
        this.distance = 0;
        this.coinsCollected = 0;
        this.currentSpeed = GAME_SETTINGS.INITIAL_SPEED;
        
        // Active power-up durations in seconds
        this.activePowerups = {
            magnet: 0,
            jetpack: 0,
            multiplier: 0,
            shield: 0
        };

        // Active bullets and particles for Mine PUBG shooting mechanics
        this.activeBullets = [];
        this.activeParticles = [];
        this.muzzleFlashActive = false;
        this.muzzleFlashTimer = 0;
        this.muzzleFlashLight = null;

        // Weather particles
        this.weatherParticles = null;
        this.weatherType = saveManager.data.settings.weather; // 'normal', 'rain', 'snow'
        this.currentSeason = 'bahor';
        
        // Setup Three.js core components
        this.initThree();
        
        // Instantiate managers
        this.player = new Player(this.scene);
        this.player.setSkin(saveManager.data.activeSkin);
        
        this.mapGen = new MapGenerator(this.scene);
        this.obstacleMgr = new ObstacleManager(this.scene);
        this.coinMgr = new CoinManager(this.scene);
        this.powerupMgr = new PowerUpManager(this.scene);
        
        this.ui = new UIManager(this);

        // Bind control listeners
        this.initControls();
        
        // Handle window resizing
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        // Hide loading screen and display main menu
        setTimeout(() => {
            this.ui.screens.loading.classList.remove('active');
            this.ui.showMainMenu();
        }, 1200);

        // Start animating three scene
        this.animateLoop();
    }

    /**
     * Setup WebGLRenderer, Scene, Lights and Shadows.
     */
    initThree() {
        const container = document.getElementById('game-container');
        
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a); // Deep blue-gray night sky
        
        // 2. Fog
        const qProfile = GAME_SETTINGS.graphics[saveManager.data.settings.graphics];
        this.scene.fog = new THREE.FogExp2(0x0f172a, qProfile.fogDensity);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: qProfile.antialias,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(qProfile.pixelRatio);
        this.renderer.shadowMap.enabled = qProfile.shadows;
        if (qProfile.shadows) {
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        container.appendChild(this.renderer.domElement);

        // 4. Lighting
        // Ambient soft sky light
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        // Directional Sun Light casting shadows
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(10, 20, 15);
        if (qProfile.shadows) {
            this.dirLight.castShadow = true;
            this.dirLight.shadow.mapSize.width = qProfile.shadowMapSize;
            this.dirLight.shadow.mapSize.height = qProfile.shadowMapSize;
            this.dirLight.shadow.camera.near = 0.5;
            this.dirLight.shadow.camera.far = 40;
            const d = 10;
            this.dirLight.shadow.camera.left = -d;
            this.dirLight.shadow.camera.right = d;
            this.dirLight.shadow.camera.top = d;
            this.dirLight.shadow.camera.bottom = -d;
        }
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        // Decorative Cyan/Magenta street light highlights
        this.blueGlow = new THREE.PointLight(0x00ffff, 1.5, 30);
        this.blueGlow.position.set(-6, 3, 20);
        this.scene.add(this.blueGlow);

        this.pinkGlow = new THREE.PointLight(0xff00ff, 1.5, 30);
        this.pinkGlow.position.set(6, 3, 40);
        this.scene.add(this.pinkGlow);

        // Muzzle flash point light at weapon barrel tip
        this.muzzleFlashLight = new THREE.PointLight(0xffaa00, 0, 8);
        this.scene.add(this.muzzleFlashLight);
        
        // Initialize weather
        this.changeWeather(this.weatherType);
    }

    /**
     * Setup Keyboard controls and Touch/Mouse clicks.
     */
    initControls() {
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            if (!this.isRunning || this.isPaused) return;

            switch (e.key) {
                case 'ArrowLeft':
                case 'a':
                    this.player.moveLeft();
                    break;
                case 'ArrowRight':
                case 'd':
                    this.player.moveRight();
                    break;
                case 'ArrowUp':
                case 'w':
                case ' ':
                    this.player.jump();
                    break;
                case 'ArrowDown':
                case 's':
                    this.player.roll();
                    break;
                case 'Escape':
                case 'p':
                    this.pauseGame();
                    break;
            }
        });

        // Touch swiping controls for mobile devices
        let touchStartX = 0;
        let touchStartY = 0;
        
        window.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].clientX;
            touchStartY = e.changedTouches[0].clientY;
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (!this.isRunning || this.isPaused) return;

            const diffX = e.changedTouches[0].clientX - touchStartX;
            const diffY = e.changedTouches[0].clientY - touchStartY;

            const threshold = 30; // Minimum pixel drag to consider swipe

            if (Math.abs(diffX) > Math.abs(diffY)) {
                // Horizontal Swipe
                if (diffX > threshold) {
                    this.player.moveRight();
                } else if (diffX < -threshold) {
                    this.player.moveLeft();
                }
            } else {
                // Vertical Swipe
                if (diffY < -threshold) {
                    this.player.jump();
                } else if (diffY > threshold) {
                    this.player.roll();
                }
            }
        }, { passive: true });

        // Weapon firing click / tap listener on canvas using pointerdown for faster responsiveness
        window.addEventListener('pointerdown', (e) => {
            if (!this.isRunning || this.isPaused) return;
            // Prevent weapon firing when clicking on UI buttons
            if (e.target.closest('#ui-container')) return;
            this.shootWeapon();
        });
    }

    /**
     * Shoot voxel bullet.
     */
    shootWeapon() {
        if (this.player.state === 'hit' || this.player.hasJetpack) return;
        
        audioManager.playSFX('shoot');
        
        const pPos = this.player.mesh.position.clone();
        
        // Spawn bullet box at gun muzzle position (right hand offset)
        const bPos = new THREE.Vector3(
            pPos.x + 0.35,
            pPos.y + 0.65,
            pPos.z + 0.6
        );

        const bulletGeo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
        bulletMesh.position.copy(bPos);
        
        this.scene.add(bulletMesh);
        
        this.activeBullets.push({
            mesh: bulletMesh,
            zStart: pPos.z
        });

        // Trigger flash light
        if (this.muzzleFlashLight) {
            this.muzzleFlashLight.position.copy(bPos);
            this.muzzleFlashLight.intensity = 4.0;
            this.muzzleFlashActive = true;
            this.muzzleFlashTimer = 0.06; // 60ms flash duration
        }
    }

    /**
     * Spawn custom voxel particles on impact.
     */
    spawnVoxelParticles(pos, color, count, duration) {
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            mesh.position.x += randomRange(-0.3, 0.3);
            mesh.position.y += randomRange(0, 0.4);
            mesh.position.z += randomRange(-0.3, 0.3);
            
            this.scene.add(mesh);
            
            // Random explosive trajectory velocities
            const vel = new THREE.Vector3(
                randomRange(-5, 5),
                randomRange(3, 10),
                randomRange(-3, 3)
            );
            
            this.activeParticles.push({
                mesh: mesh,
                velocity: vel,
                time: duration
            });
        }
    }

    /**
     * Start/Launch a fresh run session.
     */
    startGame() {
        this.isRunning = true;
        this.isPaused = false;
        
        this.score = 0;
        this.distance = 0;
        this.coinsCollected = 0;
        this.currentSpeed = GAME_SETTINGS.INITIAL_SPEED;
        
        // Reset powerup timers
        for (const key of Object.keys(this.activePowerups)) {
            this.activePowerups[key] = 0;
        }

        // Clean up left-over bullets/particles
        for (const bullet of this.activeBullets) this.scene.remove(bullet.mesh);
        this.activeBullets = [];
        for (const p of this.activeParticles) this.scene.remove(p.mesh);
        this.activeParticles = [];

        // Reset positions
        this.player.mesh.position.set(0, 0, 0);
        this.player.currentLane = 1;
        this.player.state = 'run';
        this.player.isGrounded = true;
        
        this.mapGen.reset();
        this.obstacleMgr.reset();
        this.coinMgr.reset();
        this.powerupMgr.reset();

        this.currentSeason = 'bahor';
        this.applySeasonSettings('bahor');

        this.clock.getDelta(); // Clear delta timer accumulator
        this.ui.showHUD();
        audioManager.playBGM();
    }

    /**
     * Pause the running game loop.
     */
    pauseGame() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        audioManager.stopBGM();
        this.ui.screens.pause.classList.add('active');
    }

    /**
     * Resume running from pause modal.
     */
    resumeGame() {
        this.isPaused = false;
        this.ui.screens.pause.classList.remove('active');
        audioManager.playBGM();
        this.clock.getDelta();
    }

    /**
     * Quit from pause/gameover screen back to main menu.
     */
    quitToMenu() {
        this.isRunning = false;
        this.isPaused = false;
        audioManager.stopBGM();
        this.ui.showMainMenu();
    }

    /**
     * Restart instantly.
     */
    restartGame() {
        this.isPaused = false;
        this.ui.screens.pause.classList.remove('active');
        this.ui.screens.gameOver.classList.remove('active');
        this.startGame();
    }

    /**
     * Trigger crash and game over sequence.
     */
    gameOver() {
        this.isRunning = false;
        audioManager.stopBGM();
        audioManager.playSFX('crash');
        followCamera.shake(1.2);
        
        this.player.state = 'hit';

        // Update achievements/missions counts in saveManager
        const d = saveManager.data;
        d.totalRuns++;
        d.totalDistance += this.distance;
        
        // Verify daily missions progress
        d.missions.coins = Math.max(d.missions.coins, this.coinsCollected);
        if (this.player.state === 'jump') {
            d.missions.jumps++; // Add jumps count locally
        }

        let isNewHigh = false;
        if (this.score > d.highScore) {
            d.highScore = this.score;
            isNewHigh = true;
        }

        // Add coins gathered to total wallet
        d.coins += this.coinsCollected;
        saveManager.save();

        // Render UI values
        document.getElementById('go-distance').textContent = `${Math.floor(this.distance)} m`;
        document.getElementById('go-coins').textContent = this.coinsCollected;
        document.getElementById('go-score').textContent = formatScore(this.score);
        
        const highBanner = document.getElementById('new-high-score-banner');
        if (isNewHigh) {
            highBanner.classList.remove('hidden');
        } else {
            highBanner.classList.add('hidden');
        }

        this.ui.renderLeaderboard();
        this.ui.updateMissionsUI();

        setTimeout(() => {
            this.ui.screens.gameOver.classList.add('active');
        }, 1000);
    }

    /**
     * Dynamically change quality presets.
     */
    changeGraphicsQuality(preset) {
        saveManager.data.settings.graphics = preset;
        saveManager.save();
        
        const qProfile = GAME_SETTINGS.graphics[preset];
        
        this.renderer.antialias = qProfile.antialias;
        this.renderer.setPixelRatio(qProfile.pixelRatio);
        this.renderer.shadowMap.enabled = qProfile.shadows;
        this.scene.fog.density = qProfile.fogDensity;
        
        // Re-align Directional shadow casting
        this.dirLight.castShadow = qProfile.shadows;
        if (qProfile.shadows) {
            this.dirLight.shadow.mapSize.width = qProfile.shadowMapSize;
            this.dirLight.shadow.mapSize.height = qProfile.shadowMapSize;
        }
    }

    checkSeasonCycle() {
        const seasonIndex = Math.floor(this.distance / 300) % 4;
        const seasons = ['bahor', 'yoz', 'kuz', 'qish'];
        const newSeason = seasons[seasonIndex];
        
        if (newSeason !== this.currentSeason) {
            this.currentSeason = newSeason;
            this.applySeasonSettings(newSeason);
        }
    }

    applySeasonSettings(season) {
        if (this.mapGen) {
            this.mapGen.setSeason(season);
        }
        
        if (season === 'bahor') {
            this.changeWeather('normal');
            if (this.dirLight) this.dirLight.color.setHex(0xffffff);
            if (this.ambientLight) this.ambientLight.color.setHex(0xdbeafe);
        } else if (season === 'yoz') {
            this.changeWeather('rain'); // Yoz has rain/weather
            if (this.dirLight) this.dirLight.color.setHex(0xfef08a);
            if (this.ambientLight) this.ambientLight.color.setHex(0xfef08a);
        } else if (season === 'kuz') {
            this.changeWeather('autumn'); // Autumn leaf storm
            if (this.dirLight) this.dirLight.color.setHex(0xfb923c);
            if (this.ambientLight) this.ambientLight.color.setHex(0xffedd5);
        } else if (season === 'qish') {
            this.changeWeather('snow'); // Winter snow storm
            if (this.dirLight) this.dirLight.color.setHex(0xe2e8f0);
            if (this.ambientLight) this.ambientLight.color.setHex(0xf1f5f9);
        }
    }

    /**
     * Spawn weather particles (Rain drops, Snow flakes, or Autumn leaves).
     */
    changeWeather(weather) {
        this.weatherType = weather;
        saveManager.data.settings.weather = weather;
        saveManager.save();

        if (this.weatherParticles) {
            this.scene.remove(this.weatherParticles);
            this.weatherParticles = null;
        }

        if (weather === 'normal') return;

        // Construct weather particle system
        const pCount = weather === 'rain' ? 300 : (weather === 'autumn' ? 100 : 150);
        const geo = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < pCount; i++) {
            positions.push(
                randomRange(-15, 15), // X
                randomRange(5, 15),   // Y
                randomRange(-20, 20)  // Z
            );
            
            let velY = -3;
            if (weather === 'rain') velY = -15;
            else if (weather === 'autumn') velY = -2.2;
            velocities.push(velY);
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        let colorVal = 0xffffff;
        if (weather === 'rain') colorVal = 0x22d3ee;
        else if (weather === 'autumn') colorVal = 0xd97706; // Autumn orange
        
        let sizeVal = 0.15;
        if (weather === 'rain') sizeVal = 0.08;
        else if (weather === 'autumn') sizeVal = 0.22;
        
        const mat = new THREE.PointsMaterial({ 
            color: colorVal, 
            size: sizeVal, 
            transparent: true, 
            opacity: 0.7 
        });

        this.weatherParticles = new THREE.Points(geo, mat);
        this.weatherParticles.velocities = velocities;
        this.scene.add(this.weatherParticles);
    }

    /**
     * Animate weather particles along with camera coordinates.
     */
    updateWeather(playerZ, delta) {
        if (!this.weatherParticles) return;

        const positions = this.weatherParticles.geometry.attributes.position.array;
        const vels = this.weatherParticles.velocities;
        
        for (let i = 0; i < positions.length; i += 3) {
            // Apply gravity/falling velocity to Y
            positions[i + 1] += vels[i / 3] * delta;
            
            // Apply horizontal wind drift for autumn leaves
            if (this.weatherType === 'autumn') {
                positions[i] += (Math.sin(positions[i + 1] * 0.4 + i) * 1.5 - 2.0) * delta;
                positions[i + 2] += (Math.cos(positions[i + 1] * 0.4 + i) * 0.4) * delta;
            }
            
            // Loop particles if they hit ground level
            if (positions[i + 1] < 0) {
                positions[i + 1] = randomRange(8, 15);
                positions[i] = randomRange(-15, 15);
                positions[i + 2] = playerZ + randomRange(-20, 20); // Keep centered around player
            }
        }
        this.weatherParticles.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Main Animation Frame.
     */
    animateLoop() {
        requestAnimationFrame(this.animateLoop.bind(this));
        
        const delta = this.clock.getDelta();
        
        if (this.isRunning && !this.isPaused) {
            // 1. Progress forward speeds
            this.currentSpeed = Math.min(
                this.currentSpeed + GAME_SETTINGS.SPEED_INCREMENT * delta,
                GAME_SETTINGS.MAX_SPEED
            );

            // 2. Increment scores/distance
            const multiFactor = this.activePowerups.multiplier > 0 ? 2 : 1;
            this.score += delta * this.currentSpeed * 0.5 * multiFactor;
            this.distance += delta * this.currentSpeed;
            
            // Move player position forward along Z axis
            this.player.mesh.position.z += this.currentSpeed * delta;

            // 3. Update player movement constraints
            this.player.update(delta, this.currentSpeed);
            
            // 4. Update cameras
            followCamera.update(this.player.mesh, this.currentSpeed, delta);
            
            // Light follow player to avoid shadow dropouts
            this.dirLight.position.x = this.player.mesh.position.x + 10;
            this.dirLight.position.y = this.player.mesh.position.y + 20;
            this.dirLight.position.z = this.player.mesh.position.z + 15;
            this.dirLight.target.position.copy(this.player.mesh.position);
            
            this.blueGlow.position.z = this.player.mesh.position.z + 20;
            this.pinkGlow.position.z = this.player.mesh.position.z + 40;

            // 5. Update maps and obstacles
            const pZ = this.player.mesh.position.z;
            this.mapGen.update(pZ);
            this.obstacleMgr.update(pZ, delta);
            this.coinMgr.update(this.player.mesh, this.activePowerups.magnet > 0, pZ, delta);
            this.powerupMgr.update(pZ, delta);
            this.checkSeasonCycle();

            // World Bending calculation (qiyshaytirib)
            const curveStrength = Math.sin(pZ * 0.003) * 0.0006;

            // 1. Bend active map chunks
            for (const chunk of this.mapGen.activeChunks) {
                const dz = chunk.position.z - pZ;
                if (dz > 0) {
                    chunk.position.x = curveStrength * dz * dz;
                } else {
                    chunk.position.x = 0;
                }
            }

            // 2. Bend obstacles
            for (const obs of this.obstacleMgr.obstacles) {
                const dz = obs.mesh.position.z - pZ;
                if (dz > 0) {
                    obs.mesh.position.x = obs.originalX + curveStrength * dz * dz;
                } else {
                    obs.mesh.position.x = obs.originalX;
                }
            }

            // 3. Bend coins
            for (const coin of this.coinMgr.items) {
                const dz = coin.mesh.position.z - pZ;
                if (dz > 0) {
                    coin.mesh.position.x = coin.originalX + curveStrength * dz * dz;
                } else {
                    coin.mesh.position.x = coin.originalX;
                }
            }

            // 4. Bend powerups
            for (const pu of this.powerupMgr.items) {
                const dz = pu.mesh.position.z - pZ;
                if (dz > 0) {
                    pu.mesh.position.x = pu.originalX + curveStrength * dz * dz;
                } else {
                    pu.mesh.position.x = pu.originalX;
                }
            }

            // 6. Physics Collision Checks
            this.checkGameCollisions(delta);

            // 7. Shoot updates (Decay muzzle flash, fly bullets, update shard particles)
            this.updateWeaponsAndParticles(delta);

            // 8. Decay power-ups
            this.updatePowerupTimers(delta);
            
            // 9. Animate weather particles
            this.updateWeather(pZ, delta);

            // 10. Update HUD texts
            document.getElementById('hud-score').textContent = formatScore(this.score);
            document.getElementById('hud-distance').textContent = `${Math.floor(this.distance)} m`;
            document.getElementById('hud-coins').textContent = this.coinsCollected;
        } else {
            // Idle menu animations
            this.player.update(delta, 0);
            followCamera.update(this.player.mesh, 0, delta);
            
            // Reset bending when in menu
            for (const chunk of this.mapGen.activeChunks) {
                chunk.position.x = 0;
            }
        }

        // Render scene
        this.renderer.render(this.scene, followCamera.camera);
    }

    /**
     * Shoot mechanics: Fly bullets, check impacts, decay flash light, pull shard particles.
     */
    updateWeaponsAndParticles(delta) {
        // Decay muzzle flash light
        if (this.muzzleFlashActive) {
            this.muzzleFlashTimer -= delta;
            if (this.muzzleFlashTimer <= 0) {
                this.muzzleFlashLight.intensity = 0;
                this.muzzleFlashActive = false;
            }
        }

        // Fly bullets
        for (let i = this.activeBullets.length - 1; i >= 0; i--) {
            const bullet = this.activeBullets[i];
            bullet.mesh.position.z += delta * 150; // Bullet velocity
            
            // Cleanup far bullet
            if (bullet.mesh.position.z - bullet.zStart > 70) {
                this.scene.remove(bullet.mesh);
                this.activeBullets.splice(i, 1);
                continue;
            }

            // Bullet impact on destructible obstacles
            let hit = false;
            for (const obs of this.obstacleMgr.obstacles) {
                if (obs.destructible && Math.abs(obs.mesh.position.z - bullet.mesh.position.z) < 1.5) {
                    // Check lane coordinate match
                    if (Math.abs(obs.mesh.position.x - bullet.mesh.position.x) < 1.0) {
                        hit = true;
                        obs.health--;

                        // Yellow sparks at impact point
                        this.spawnVoxelParticles(bullet.mesh.position, 0xffff00, 4, 0.2);

                        if (obs.health <= 0) {
                            // Shatter block
                            audioManager.playSFX('shatter');
                            
                            let colorVal = 0x991b1b; // default brick red
                            if (obs.type === 'traffic_cone') colorVal = 0xef4444; // PUBG crate red/blue
                            else if (obs.type === 'barrier_high') colorVal = 0x78350f; // wood brown
                            
                            this.spawnVoxelParticles(obs.mesh.position, colorVal, 16, 0.5);

                            this.scene.remove(obs.mesh);
                            const idx = this.obstacleMgr.obstacles.indexOf(obs);
                            this.obstacleMgr.obstacles.splice(idx, 1);
                            
                            this.score += 50; // Bonus points for breaking obstacle
                        } else {
                            audioManager.playSFX('shield_break'); // Hit alert
                        }
                        break;
                    }
                }
            }

            if (hit) {
                this.scene.remove(bullet.mesh);
                this.activeBullets.splice(i, 1);
            }
        }

        // Pull shard particles
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.time -= delta;
            
            p.mesh.position.addScaledVector(p.velocity, delta);
            // Apply gravity pull to falling fragments
            p.velocity.y += GAME_SETTINGS.GRAVITY * 0.4 * delta;

            if (p.time <= 0) {
                this.scene.remove(p.mesh);
                this.activeParticles.splice(i, 1);
            }
        }
    }

    /**
     * Check Bounding Box collisions for obstacles, coins and powerups.
     */
    checkGameCollisions(delta) {
        const pZ = this.player.mesh.position.z;

        // 1. Obstacles Collision
        for (const obs of this.obstacleMgr.obstacles) {
            // Check if within collision distance range
            if (Math.abs(obs.mesh.position.z - pZ) < 15) {
                // If it has a ramp and player is landing/running, allow stepping up
                if (obs.hasRamp && Math.abs(obs.mesh.position.x - this.player.mesh.position.x) < 1.0) {
                    const rampStart = obs.mesh.position.z - 8.7;
                    const rampEnd = obs.mesh.position.z - 5;
                    
                    if (pZ >= rampStart && pZ <= obs.mesh.position.z + 7.5) {
                        if (pZ < rampEnd) {
                            // Scale height up the slope
                            const ratio = (pZ - rampStart) / (rampEnd - rampStart);
                            this.player.mesh.position.y = THREE.MathUtils.lerp(0, obs.size.height, ratio);
                        } else {
                            this.player.mesh.position.y = obs.size.height;
                        }
                        this.player.isGrounded = true; // Stay on top of train
                        this.player.state = 'run';
                        continue;
                    }
                }

                // Standard box collision
                if (physicsManager.checkCollision(this.player.mesh, this.player.state, obs)) {
                    if (this.activePowerups.shield > 0) {
                        // Absorb hit with shield
                        this.activePowerups.shield = 0;
                        audioManager.playSFX('shield_break');
                        followCamera.shake(0.6);
                        
                        // Delete obstacle to prevent double hit
                        this.scene.remove(obs.mesh);
                        const idx = this.obstacleMgr.obstacles.indexOf(obs);
                        this.obstacleMgr.obstacles.splice(idx, 1);
                        break;
                    } else {
                        this.gameOver();
                        return;
                    }
                }
            }
        }

        // 2. Coins Collision
        for (const coin of this.coinMgr.items) {
            if (!coin.collected && Math.abs(coin.mesh.position.z - pZ) < 5) {
                if (physicsManager.checkCoinCollection(this.player.mesh, coin.mesh)) {
                    coin.collected = true;
                    this.coinsCollected++;
                    audioManager.playSFX('coin');
                    
                    // Simple pop scale effect
                    coin.mesh.scale.set(0,0,0);
                    this.scene.remove(coin.mesh);
                }
            }
        }

        // 3. Powerups Collision
        for (const pu of this.powerupMgr.items) {
            if (!pu.collected && Math.abs(pu.mesh.position.z - pZ) < 5) {
                if (physicsManager.checkCoinCollection(this.player.mesh, pu.mesh)) {
                    pu.collected = true;
                    audioManager.playSFX('powerup');
                    
                    // Set powerup duration (base 10 seconds + 2 seconds per upgrade level)
                    const level = saveManager.data.upgrades[pu.type] || 0;
                    const duration = 10 + level * 2;
                    this.activePowerups[pu.type] = duration;
                    
                    // Increment stats count
                    saveManager.data.totalPowerups++;
                    
                    this.scene.remove(pu.mesh);
                }
            }
        }
    }

    /**
     * Decay powerup active timers.
     */
    updatePowerupTimers(delta) {
        const ratios = {};
        
        for (const [pName, time] of Object.entries(this.activePowerups)) {
            if (time > 0) {
                this.activePowerups[pName] -= delta;
                const maxTime = 10 + (saveManager.data.upgrades[pName] || 0) * 2;
                ratios[pName] = Math.max(0, this.activePowerups[pName] / maxTime);
                
                // Extra actions for jetpack
                if (pName === 'jetpack') {
                    this.player.hasJetpack = true;
                }
            } else {
                ratios[pName] = 0;
                if (pName === 'jetpack') {
                    this.player.hasJetpack = false;
                }
            }
        }

        // Notify UIManager
        this.ui.updateActivePowerups(ratios);
    }

    onWindowResize() {
        followCamera.camera.aspect = window.innerWidth / window.innerHeight;
        followCamera.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Start GameManager instantly when imported
window.onload = () => {
    new GameManager();
};
