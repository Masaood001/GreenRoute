/**
 * Route scoring and ranking module.
 * Provides multi-objective scoring and Min-Max factor normalization
 * combining travel time, distance, pollution, heat, greenery, and shade.
 * 
 * SCORING FORMULA EXPLANATION:
 * ----------------------------
 * 1. Factor Extraction & Sanitization:
 *    Extracts 6 metrics for candidate routes: distance, time, pollution, heat, greenery, shade.
 *    Missing attributes default to 0. Invalid or negative numeric values are clamped to 0.
 * 
 * 2. Min-Max Normalization:
 *    Factors are normalized to a [0.0, 1.0] scale across candidate routes so varying units
 *    (e.g., meters, seconds, AQI index, °C) are compared fairly.
 * 
 *    - POSITIVE factors (greenery, shade): Higher values yield higher score.
 *      Norm_Factor = (val - min) / (max - min)
 * 
 *    - NEGATIVE factors (distance, time, pollution, heat): Lower values yield higher score.
 *      Norm_Factor = (max - val) / (max - min)
 * 
 *    - EQUAL MIN/MAX EDGE CASE (min === max):
 *      When all candidate routes have the exact same value for a factor, Norm_Factor = 1.0.
 * 
 * 3. Composite Weighted Score (0.0 to 100.0 scale):
 *    Score = ( Σ (weight_f * Norm_Factor_f) / Σ weight_f ) * 100
 * 
 *    - Higher composite score means a better overall route matching user preferences.
 *    - Direction is consistent: worse time/distance/pollution/heat reduces score;
 *      better greenery/shade improves score.
 */

/**
 * Default equal weights for all candidate factors.
 */
export const DEFAULT_WEIGHTS = Object.freeze({
  time: 1.0,
  distance: 1.0,
  pollution: 1.0,
  heat: 1.0,
  greenery: 1.0,
  shade: 1.0,
});

/**
 * Predefined user preference profiles for routing preferences.
 */
export const WEIGHT_PROFILES = Object.freeze({
  BALANCED: Object.freeze({
    time: 1.0,
    distance: 1.0,
    pollution: 1.0,
    heat: 1.0,
    greenery: 1.0,
    shade: 1.0,
  }),
  TIME_FOCUSED: Object.freeze({
    time: 4.0,
    distance: 3.0,
    pollution: 0.5,
    heat: 0.5,
    greenery: 0.5,
    shade: 0.5,
  }),
  ENVIRONMENT_FOCUSED: Object.freeze({
    time: 0.5,
    distance: 0.5,
    pollution: 3.0,
    heat: 2.0,
    greenery: 3.0,
    shade: 3.0,
  }),
});

/**
 * Negative factors where lower raw values are better.
 */
const NEGATIVE_FACTORS = ['time', 'distance', 'pollution', 'heat'];

/**
 * Positive factors where higher raw values are better.
 */
const POSITIVE_FACTORS = ['greenery', 'shade'];

/**
 * All factor keys in scoring order.
 */
export const ALL_FACTORS = [...NEGATIVE_FACTORS, ...POSITIVE_FACTORS];

/**
 * Safely extracts raw factor values from a Route object or generic route structure.
 * Handles missing environmental attributes and invalid/negative values gracefully.
 * 
 * @param {import('./models/Route.js').Route|Object} route 
 * @returns {{ distance: number, time: number, pollution: number, heat: number, greenery: number, shade: number }}
 */
export function extractRouteFactors(route = {}) {
  if (!route) route = {};
  const env = route.aggregatedEnvironmental || route.environmental || {};

  return {
    distance: Math.max(0, Number(route.totalDistance ?? route.distance ?? 0) || 0),
    time: Math.max(0, Number(route.totalTime ?? route.time ?? 0) || 0),
    pollution: Math.max(0, Number(env.pollution ?? route.pollution ?? 0) || 0),
    heat: Math.max(0, Number(env.heat ?? route.heat ?? 0) || 0),
    greenery: Math.max(0, Number(env.greenery ?? route.greenery ?? 0) || 0),
    shade: Math.max(0, Number(env.shade ?? route.shade ?? 0) || 0),
  };
}

/**
 * Computes minimum and maximum values for all factors across a collection of candidate routes.
 * 
 * @param {Array<Object>} routes 
 * @returns {{ min: Object, max: Object }}
 */
export function computeFactorBounds(routes = []) {
  const min = {};
  const max = {};

  for (const factor of ALL_FACTORS) {
    min[factor] = Infinity;
    max[factor] = -Infinity;
  }

  if (!Array.isArray(routes) || routes.length === 0) {
    for (const factor of ALL_FACTORS) {
      min[factor] = 0;
      max[factor] = 0;
    }
    return { min, max };
  }

  for (const route of routes) {
    const factors = extractRouteFactors(route);
    for (const factor of ALL_FACTORS) {
      const val = factors[factor];
      if (val < min[factor]) min[factor] = val;
      if (val > max[factor]) max[factor] = val;
    }
  }

  return { min, max };
}

/**
 * Normalizes raw route factors into [0.0, 1.0] normalized scores relative to factor bounds.
 * 
 * @param {Object} factors - Raw factor object extracted from extractRouteFactors
 * @param {{ min: Object, max: Object }} bounds - Min/Max bounds calculated across candidate routes
 * @returns {Object} Normalized factors (0.0 to 1.0 where 1.0 is best)
 */
export function normalizeFactors(factors = {}, bounds = { min: {}, max: {} }) {
  const normalized = {};

  for (const factor of ALL_FACTORS) {
    const val = factors[factor] ?? 0;
    const minVal = bounds.min?.[factor] ?? val;
    const maxVal = bounds.max?.[factor] ?? val;

    // Edge case: when min and max are equal (or single route compared)
    if (maxVal === minVal) {
      normalized[factor] = 1.0;
      continue;
    }

    if (NEGATIVE_FACTORS.includes(factor)) {
      // Lower is better: (max - val) / (max - min)
      const norm = (maxVal - val) / (maxVal - minVal);
      normalized[factor] = Number(Math.max(0, Math.min(1, norm)).toFixed(4));
    } else {
      // Higher is better: (val - min) / (max - min)
      const norm = (val - minVal) / (maxVal - minVal);
      normalized[factor] = Number(Math.max(0, Math.min(1, norm)).toFixed(4));
    }
  }

  return normalized;
}

/**
 * Calculates composite route score based on environmental and trip preferences.
 * 
 * @param {import('./models/Route.js').Route|Object} route 
 * @param {Object} [weights] - User weights for { time, distance, pollution, heat, greenery, shade }
 * @param {{ min: Object, max: Object }} [bounds] - Pre-calculated factor bounds
 * @returns {number} Calculated composite score (0.0 to 100.0)
 */
export function calculateRouteScore(route, weights = DEFAULT_WEIGHTS, bounds = null) {
  if (!route) return 0;

  const rawFactors = extractRouteFactors(route);
  const activeBounds = bounds || computeFactorBounds([route]);
  const normFactors = normalizeFactors(rawFactors, activeBounds);

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const factor of ALL_FACTORS) {
    const w = Math.max(0, Number(weights?.[factor]) || 0);
    const norm = normFactors[factor] ?? 0;
    totalWeightedScore += w * norm;
    totalWeight += w;
  }

  if (totalWeight === 0) return 0;

  const compositeScore = (totalWeightedScore / totalWeight) * 100;
  return Number(compositeScore.toFixed(2));
}

/**
 * Ranks multiple candidate routes according to composite eco/preference scores.
 * 
 * @param {Array<import('./models/Route.js').Route|Object>} routes 
 * @param {Object} [weights] - User weights/preference profile
 * @returns {Array<import('./models/Route.js').Route|Object>} Ranked routes sorted by composite score descending
 */
export function rankRoutes(routes = [], weights = DEFAULT_WEIGHTS) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return [];
  }

  const bounds = computeFactorBounds(routes);

  const scoredRoutes = routes.map((route) => {
    const rawFactors = extractRouteFactors(route);
    const normFactors = normalizeFactors(rawFactors, bounds);
    const score = calculateRouteScore(route, weights, bounds);

    route.normalizedFactors = normFactors;
    route.score = score;
    return route;
  });

  // Sort descending by score
  scoredRoutes.sort((a, b) => b.score - a.score);

  // Assign rank numbers (1 = best)
  scoredRoutes.forEach((route, idx) => {
    route.rank = idx + 1;
  });

  return scoredRoutes;
}
