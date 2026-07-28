/**
 * Game Configuration & Graphics Settings.
 */

export const GAME_SETTINGS = {
    // Lane configuration
    LANE_WIDTH: 3.5, // Distance between center of lanes
    LANE_COUNT: 3,   // Total lanes (Left, Center, Right)
    
    // Physics parameters
    GRAVITY: -40,      // Gravity acceleration
    JUMP_FORCE: 15,    // Jump initial speed
    ROLL_DURATION: 0.6,// Duration of roll state in seconds
    
    // Game speeds
    INITIAL_SPEED: 18,    // Starting forward speed in m/s
    MAX_SPEED: 45,        // Absolute max speed
    SPEED_INCREMENT: 0.15, // Forward speed increment per second
    
    // Grid settings
    CHUNK_SIZE: 100,      // Procedural map segment size (z-axis length)
    MAX_VISIBLE_CHUNKS: 4,// Number of chunks rendered concurrently
    
    // Obstacle offsets
    COLLISION_DEPTH: 1.5, // Depth box offset for collision checks
    
    // Quality profiles
    graphics: {
        low: {
            shadows: false,
            antialias: false,
            pixelRatio: 1,
            fogDensity: 0.008,
            postprocessing: false,
            maxParticles: 50
        },
        medium: {
            shadows: true,
            shadowMapSize: 512,
            antialias: true,
            pixelRatio: Math.min(window.devicePixelRatio, 1.5),
            fogDensity: 0.006,
            postprocessing: false,
            maxParticles: 150
        },
        high: {
            shadows: true,
            shadowMapSize: 1024,
            antialias: true,
            pixelRatio: Math.min(window.devicePixelRatio, 2),
            fogDensity: 0.005,
            postprocessing: true,
            maxParticles: 300
        },
        ultra: {
            shadows: true,
            shadowMapSize: 2048,
            antialias: true,
            pixelRatio: window.devicePixelRatio,
            fogDensity: 0.004,
            postprocessing: true,
            maxParticles: 600
        }
    }
};
