/**
 * LocalStorage Save Manager for Retro Runner 3D.
 */

class SaveManager {
    constructor() {
        this.key = 'retro_runner_save';
        this.data = this.getDefaultData();
        this.load();
    }

    // Default structure for new players
    getDefaultData() {
        return {
            coins: 100,
            diamonds: 0,
            highScore: 0,
            totalRuns: 0,
            totalDistance: 0,
            totalPowerups: 0,
            activeSkin: 'classic',
            unlockedSkins: ['classic'],
            upgrades: {
                magnet: 0,     // Level 0 (1 to 5)
                jetpack: 0,    // Level 0
                multiplier: 0, // Level 0
                shield: 0      // Level 0
            },
            settings: {
                graphics: 'high',
                bgmVolume: 0.5,
                sfxVolume: 0.8,
                weather: 'normal'
            },
            missions: {
                coins: 0,
                jumps: 0,
                lastClaimDay: 0,
                claimStreak: 0
            }
        };
    }

    // Load save from LocalStorage
    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Deep merge default data to ensure backwards compatibility with additions
                this.data = this.deepMerge(this.getDefaultData(), parsed);
            } else {
                this.data = this.getDefaultData();
                this.save();
            }
        } catch (e) {
            console.error("Error loading save data:", e);
            this.data = this.getDefaultData();
        }
    }

    // Save current data to LocalStorage
    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.error("Error writing save data:", e);
        }
    }

    // Helper for merging objects safely
    deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], this.deepMerge(target[key], source[key]));
            }
        }
        return Object.assign(target, source);
    }

    // Reset all data
    reset() {
        this.data = this.getDefaultData();
        this.save();
    }
}

// Export a single instance to be used everywhere
export const saveManager = new SaveManager();
export default saveManager;
