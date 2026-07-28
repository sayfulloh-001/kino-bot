/**
 * Utility functions for 3D Runner Game.
 */

// Generate a random float between min and max (inclusive)
export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Generate a random integer between min and max (inclusive)
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Select a random element from an array
export function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Easing function for smooth lane switching (linear interpolation)
export function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

// Clamp a value between min and max
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// Format score with leading zeros
export function formatScore(score) {
    return String(Math.floor(score)).padStart(6, '0');
}
