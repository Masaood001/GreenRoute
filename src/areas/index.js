import { pankiAreaConfig } from './panki/areaConfig.js';

/**
 * GreenRoute Study Area Registry
 *
 * Provides a modular, decoupled index of project study areas.
 * New geographic areas can be added here without modifying the core routing engine.
 */

export { pankiAreaConfig };

export const REGISTERED_AREAS = [pankiAreaConfig];

/**
 * Retrieve area configuration by unique area ID.
 * @param {string} areaId
 * @returns {object|null} Area configuration object or null if not found.
 */
export function getAreaConfigById(areaId) {
  if (!areaId) return null;
  return REGISTERED_AREAS.find((area) => area.id === areaId) || null;
}

/**
 * Get default study area configuration.
 * @returns {object} Default area config (Panki study area).
 */
export function getDefaultAreaConfig() {
  return pankiAreaConfig;
}

export default {
  pankiAreaConfig,
  REGISTERED_AREAS,
  getAreaConfigById,
  getDefaultAreaConfig,
};
