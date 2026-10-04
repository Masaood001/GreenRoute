/**
 * Central Travel-Speed Model & Configuration
 * Standardized velocities in meters per second (m/s).
 */
export const TRAVEL_MODE_SPEEDS = Object.freeze({
  walking: 1.39, // ~5.0 km/h average pedestrian walking speed
  cycling: 4.17, // ~15.0 km/h average cycling speed (3x faster than walking)
});

export const DEFAULT_TRAVEL_MODE = 'walking';

/**
 * Resolves travel speed in meters per second for a given travel mode.
 * @param {string} [mode='walking']
 * @returns {number} Speed in m/s
 */
export function getSpeedForTravelMode(mode = 'walking') {
  const cleanMode = String(mode || '').toLowerCase().trim();
  return TRAVEL_MODE_SPEEDS[cleanMode] || TRAVEL_MODE_SPEEDS.walking;
}

/**
 * Calculates estimated travel duration in seconds for distance and travel mode.
 * @param {number} distanceMeters
 * @param {string} [mode='walking']
 * @returns {number} Travel time in seconds (minimum 1 second for non-zero distance)
 */
export function calculateDurationSeconds(distanceMeters, mode = 'walking') {
  const dist = Math.max(0, Number(distanceMeters) || 0);
  if (dist === 0) return 0;
  const speed = getSpeedForTravelMode(mode);
  return Math.max(1, Math.round(dist / speed));
}
