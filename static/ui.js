/**
 * UI Overlay Manager for Menu Windows, Buttons, Shop and HUD.
 */
import { saveManager } from './save.js';
import { audioManager } from './audio.js';
import { formatScore } from './utils.js';

export class UIManager {
    /**
     * @param {object} gameManager - Reference to the core game loop manager
     */
    constructor(gameManager) {
        this.gm = gameManager;
        
        // Cache DOM elements
        this.screens = {
            loading: document.getElementById('loading-screen'),
            mainMenu: document.getElementById('main-menu'),
            hud: document.getElementById('hud'),
            pause: document.getElementById('pause-menu'),
            gameOver: document.getElementById('game-over-screen'),
            shop: document.getElementById('shop-panel'),
            leaderboard: document.getElementById('leaderboard-panel'),
            missions: document.getElementById('missions-panel'),
            settings: document.getElementById('settings-panel'),
            dailyReward: document.getElementById('daily-reward-modal'),
            profile: document.getElementById('profile-modal')
        };
        
        this.initButtons();
        this.initSettingsValues();
        this.updateMenuCurrency();
        this.renderLeaderboard();
        this.updateMissionsUI();
    }

    /**
     * Bind click listeners to all UI buttons.
     */
    initButtons() {
        // --- Main Menu ---
        document.getElementById('play-btn').onclick = () => {
            audioManager.playSFX('powerup');
            this.gm.startGame();
        };
        document.getElementById('shop-btn').onclick = () => this.showPanel('shop');
        document.getElementById('leaderboard-btn').onclick = () => this.showPanel('leaderboard');
        document.getElementById('missions-btn').onclick = () => this.showPanel('missions');
        document.getElementById('settings-btn').onclick = () => this.showPanel('settings');
        document.getElementById('daily-reward-btn').onclick = () => this.showPanel('dailyReward');
        document.getElementById('profile-btn').onclick = () => this.showProfile();

        // --- HUD ---
        document.getElementById('pause-btn').onclick = () => this.gm.pauseGame();

        // --- Pause Menu ---
        document.getElementById('resume-btn').onclick = () => this.gm.resumeGame();
        document.getElementById('restart-btn').onclick = () => this.gm.restartGame();
        document.getElementById('quit-btn').onclick = () => this.gm.quitToMenu();

        // --- Game Over ---
        document.getElementById('go-restart-btn').onclick = () => this.gm.restartGame();
        document.getElementById('go-home-btn').onclick = () => this.gm.quitToMenu();

        // --- Close Panel Buttons ---
        document.querySelectorAll('.close-panel-btn').forEach(btn => {
            btn.onclick = () => this.closeAllPanels();
        });

        // --- Profile Close ---
        document.getElementById('close-profile-btn').onclick = () => {
            this.screens.profile.classList.remove('active');
        };

        // --- Settings Options ---
        // Quality selector
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.gm.changeGraphicsQuality(e.target.dataset.quality);
            };
        });

        // Weather selector
        document.querySelectorAll('.weather-btn').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.gm.changeWeather(e.target.dataset.weather);
            };
        });

        // Volume controls
        const bgmSlider = document.getElementById('bgm-volume');
        bgmSlider.oninput = (e) => {
            audioManager.setBGMVolume(parseFloat(e.target.value));
        };
        const sfxSlider = document.getElementById('sfx-volume');
        sfxSlider.oninput = (e) => {
            audioManager.setSFXVolume(parseFloat(e.target.value));
        };

        // --- Shop Tab toggles ---
        document.querySelectorAll('.shop-tab-toggle').forEach(tab => {
            tab.onclick = (e) => {
                document.querySelectorAll('.shop-tab-toggle').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                const targetContent = document.getElementById(`shop-tab-${e.target.dataset.tab}`);
                if (targetContent) targetContent.classList.add('active');
            };
        });

        // --- Shop Powerup Upgrades ---
        document.querySelectorAll('.buy-upgrade-btn').forEach(btn => {
            btn.onclick = (e) => {
                const button = e.currentTarget;
                const pName = button.dataset.powerup;
                this.buyPowerupUpgrade(pName);
            };
        });

        // --- Shop Outfits/Skins ---
        document.querySelectorAll('.skin-card').forEach(card => {
            card.onclick = (e) => {
                const sCard = e.currentTarget;
                const skinName = sCard.dataset.skin;
                this.selectSkin(skinName);
            };
        });

        // --- Daily Reward Claim ---
        document.getElementById('claim-reward-btn').onclick = () => {
            this.claimDailyReward();
        };
    }

    /**
     * Load current settings values from saveManager into DOM controls.
     */
    initSettingsValues() {
        const set = saveManager.data.settings;
        document.getElementById('bgm-volume').value = set.bgmVolume;
        document.getElementById('sfx-volume').value = set.sfxVolume;
        
        // Quality
        document.querySelectorAll('.quality-btn').forEach(b => {
            b.classList.remove('active');
            if (b.dataset.quality === set.graphics) b.classList.add('active');
        });

        // Weather
        document.querySelectorAll('.weather-btn').forEach(b => {
            b.classList.remove('active');
            if (b.dataset.weather === set.weather) b.classList.add('active');
        });
    }

    /**
     * Hide all overlays.
     */
    hideAllScreens() {
        Object.values(this.screens).forEach(scr => {
            if (scr) scr.classList.remove('active');
        });
    }

    /**
     * Show target panel, hide other modal panels.
     */
    showPanel(panelName) {
        audioManager.playSFX('footstep');
        
        // Hide panel screens
        const panels = ['shop', 'leaderboard', 'missions', 'settings', 'dailyReward'];
        panels.forEach(p => this.screens[p].classList.remove('active'));
        
        if (this.screens[panelName]) {
            this.screens[panelName].classList.add('active');
        }
        
        if (panelName === 'shop') {
            this.updateShopPanels();
        }
    }

    closeAllPanels() {
        audioManager.playSFX('footstep');
        const panels = ['shop', 'leaderboard', 'missions', 'settings', 'dailyReward'];
        panels.forEach(p => this.screens[p].classList.remove('active'));
    }

    /**
     * Switch view back to main menu.
     */
    showMainMenu() {
        this.hideAllScreens();
        this.updateMenuCurrency();
        this.screens.mainMenu.classList.add('active');
    }

    /**
     * Switch view to in-game HUD.
     */
    showHUD() {
        this.hideAllScreens();
        this.screens.hud.classList.add('active');
    }

    /**
     * Display profile stats.
     */
    showProfile() {
        audioManager.playSFX('footstep');
        const d = saveManager.data;
        document.getElementById('p-total-runs').textContent = d.totalRuns;
        document.getElementById('p-total-distance').textContent = `${Math.floor(d.totalDistance)} m`;
        document.getElementById('p-total-powerups').textContent = d.totalPowerups;
        document.getElementById('p-high-score').textContent = Math.floor(d.highScore);
        
        this.screens.profile.classList.add('active');
    }

    /**
     * Update coins/diamonds displayed on Main Menu.
     */
    updateMenuCurrency() {
        document.getElementById('menu-coin-count').textContent = saveManager.data.coins;
        document.getElementById('menu-diamond-count').textContent = saveManager.data.diamonds;
        document.getElementById('menu-high-score').textContent = formatScore(saveManager.data.highScore);
    }

    /**
     * Refresh upgrades prices and indicators in Do'kon.
     */
    updateShopPanels() {
        document.getElementById('shop-coin-count').textContent = saveManager.data.coins;
        
        const upgrades = saveManager.data.upgrades;
        const prices = { magnet: 500, jetpack: 750, multiplier: 1000, shield: 600 };
        const priceMultiplier = 1.6;

        for (const [pName, level] of Object.entries(upgrades)) {
            const container = document.getElementById(`${pName}-levels`);
            if (container) {
                // Clear dots
                container.innerHTML = '';
                for (let l = 0; l < 5; l++) {
                    const dot = document.createElement('span');
                    dot.className = `level-dot ${l < level ? 'filled' : ''}`;
                    container.appendChild(dot);
                }
            }

            // Price calculation
            const btn = document.querySelector(`.buy-upgrade-btn[data-powerup="${pName}"]`);
            if (btn) {
                if (level >= 5) {
                    btn.textContent = 'MAX';
                    btn.disabled = true;
                } else {
                    const cost = Math.floor(prices[pName] * Math.pow(priceMultiplier, level));
                    btn.innerHTML = `${cost} <i class="fa-solid fa-coins icon-gold"></i>`;
                    btn.disabled = saveManager.data.coins < cost;
                }
            }
        }
        
        // Update skin states
        document.querySelectorAll('.skin-card').forEach(card => {
            const skinName = card.dataset.skin;
            card.classList.remove('active');
            
            if (saveManager.data.activeSkin === skinName) {
                card.classList.add('active');
                card.querySelector('.skin-status').textContent = 'Tanlangan';
            } else if (saveManager.data.unlockedSkins.includes(skinName)) {
                card.classList.remove('locked');
                const meta = card.querySelector('.skin-meta');
                meta.innerHTML = `<h4>${meta.querySelector('h4').textContent}</h4><span class="skin-status" style="color:var(--color-secondary)">Ochilgan</span>`;
            }
        });
    }

    buyPowerupUpgrade(pName) {
        const prices = { magnet: 500, jetpack: 750, multiplier: 1000, shield: 600 };
        const priceMultiplier = 1.6;
        const currentLevel = saveManager.data.upgrades[pName];
        
        if (currentLevel >= 5) return;

        const cost = Math.floor(prices[pName] * Math.pow(priceMultiplier, currentLevel));
        
        if (saveManager.data.coins >= cost) {
            saveManager.data.coins -= cost;
            saveManager.data.upgrades[pName]++;
            saveManager.save();
            audioManager.playSFX('powerup');
            
            this.updateShopPanels();
        } else {
            audioManager.playSFX('shield_break'); // Buzz error sound
        }
    }

    selectSkin(skinName) {
        if (saveManager.data.unlockedSkins.includes(skinName)) {
            // Select skin
            saveManager.data.activeSkin = skinName;
            saveManager.save();
            audioManager.playSFX('footstep');
            this.gm.player.setSkin(skinName);
            this.updateShopPanels();
        } else {
            // Attempt unlock
            const card = document.querySelector(`.skin-card[data-skin="${skinName}"]`);
            const cost = parseInt(card.dataset.price);
            
            if (saveManager.data.coins >= cost) {
                saveManager.data.coins -= cost;
                saveManager.data.unlockedSkins.push(skinName);
                saveManager.data.activeSkin = skinName;
                saveManager.save();
                audioManager.playSFX('powerup');
                this.gm.player.setSkin(skinName);
                this.updateShopPanels();
            } else {
                audioManager.playSFX('shield_break');
            }
        }
    }

    /**
     * Render high scores list.
     */
    renderLeaderboard() {
        const itemsContainer = document.getElementById('leaderboard-items');
        if (!itemsContainer) return;
        itemsContainer.innerHTML = '';

        // Generate mock scores combined with player high score
        const myHighScore = Math.floor(saveManager.data.highScore);
        const entries = [
            { name: 'Xorazmlik_Run', score: 25000 },
            { name: 'Gamer_99', score: 18500 },
            { name: 'Shoxruz_Uz', score: 12000 },
            { name: 'ThreeJS_Fan', score: 8500 },
            { name: 'Siz (Rekord)', score: myHighScore }
        ];

        // Sort desc
        entries.sort((a, b) => b.score - a.score);

        entries.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-row';
            
            const isMe = item.name.includes('Siz');
            if (isMe) row.style.borderColor = 'var(--color-primary)';
            
            let rankClass = `l-rank`;
            if (idx === 0) rankClass += ' top-1';
            else if (idx === 1) rankClass += ' top-2';
            else if (idx === 2) rankClass += ' top-3';
            
            const rankText = idx < 3 ? `<i class="fa-solid fa-trophy"></i>` : `${idx + 1}`;
            
            row.innerHTML = `
                <div class="l-left">
                    <span class="${rankClass}">${rankText}</span>
                    <span class="l-name">${item.name}</span>
                </div>
                <span class="l-score">${formatScore(item.score)}</span>
            `;
            itemsContainer.appendChild(row);
        });
    }

    updateMissionsUI() {
        const coins = saveManager.data.missions.coins;
        const jumps = saveManager.data.missions.jumps;
        
        // Mission 1: Coins
        const coinsGoal = 200;
        const coinsPct = Math.min((coins / coinsGoal) * 100, 100);
        document.querySelector('#mission-coins .mission-progress').textContent = `${coins} / ${coinsGoal}`;
        document.querySelector('#mission-coins .mission-bar').style.width = `${coinsPct}%`;
        
        // Mission 2: Jumps
        const jumpsGoal = 20;
        const jumpsPct = Math.min((jumps / jumpsGoal) * 100, 100);
        document.querySelector('#mission-jumps .mission-progress').textContent = `${jumps} / ${jumpsGoal}`;
        document.querySelector('#mission-jumps .mission-bar').style.width = `${jumpsPct}%`;

        // Total runs ach
        const dist = Math.floor(saveManager.data.totalDistance);
        document.querySelector('#ach-distance .ach-progress').textContent = `${dist} / 10000 m`;
        
        // Total coins collected ach
        const totCoins = saveManager.data.coins;
        document.querySelector('#ach-coins .ach-progress').textContent = `${totCoins} / 5000`;
    }

    claimDailyReward() {
        const lastDay = saveManager.data.missions.lastClaimDay;
        const today = new Date().getDate();
        
        if (lastDay === today) {
            alert("Bugungi mukofotni olib bo'lgansiz. Ertaga kiring!");
            return;
        }

        saveManager.data.coins += 200;
        saveManager.data.missions.lastClaimDay = today;
        saveManager.save();
        audioManager.playSFX('powerup');
        
        this.updateMenuCurrency();
        this.screens.dailyReward.classList.remove('active');
        alert("Tabriklaymiz! +200 tanga qo'shildi!");
    }

    /**
     * Render dynamic active power-up bars in HUD.
     */
    updateActivePowerups(activeList) {
        const container = document.getElementById('active-powerups-container');
        if (!container) return;
        
        container.innerHTML = '';

        for (const [pName, ratio] of Object.entries(activeList)) {
            if (ratio > 0) {
                const labelMap = {
                    magnet: 'MAGNET',
                    jetpack: 'JETPACK',
                    multiplier: '2X SCORE',
                    shield: 'SHIELD'
                };
                
                const bar = document.createElement('div');
                bar.className = `active-powerup-bar ${pName}-bar`;
                
                bar.innerHTML = `
                    <span>${labelMap[pName]}</span>
                    <div class="powerup-fill-container">
                        <div class="powerup-fill" style="width: ${ratio * 100}%"></div>
                    </div>
                `;
                container.appendChild(bar);
            }
        }
    }
}
export default UIManager;
