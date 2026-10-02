import { CAMPUS_NODES } from '../algorithm/data/campusGraph.js';

/**
 * Deterministically maps an input string (e.g. node ID, exact name, or partial name)
 * to a valid campus graph node ID.
 *
 * Mapping Order:
 * 1. Exact node ID match, case-insensitive.
 * 2. Exact node name match, case-insensitive.
 * 3. Partial node name match, case-insensitive.
 * 4. Safe fallback to defaultNodeId.
 *
 * @param {string} inputString
 * @param {string} [defaultNodeId='N1']
 * @returns {string} Node ID (e.g. 'N1')
 */
export function mapInputToNodeId(inputString, defaultNodeId = 'N1') {
  if (!inputString || typeof inputString !== 'string' || !inputString.trim()) {
    return defaultNodeId;
  }
  const cleanInput = inputString.trim().toLowerCase();

  // 1. Exact node ID match, case-insensitive
  const exactIdMatch = CAMPUS_NODES.find(
    (node) => node.id.toLowerCase() === cleanInput
  );
  if (exactIdMatch) return exactIdMatch.id;

  // 2. Exact node name match, case-insensitive
  const exactNameMatch = CAMPUS_NODES.find(
    (node) => node.name.toLowerCase() === cleanInput
  );
  if (exactNameMatch) return exactNameMatch.id;

  // 3. Partial node name match, case-insensitive
  const partialNameMatch = CAMPUS_NODES.find(
    (node) =>
      node.name.toLowerCase().includes(cleanInput) ||
      cleanInput.includes(node.name.toLowerCase())
  );
  if (partialNameMatch) return partialNameMatch.id;

  // 4. Safe fallback to defaultNodeId
  return defaultNodeId;
}

/**
 * Maps PreferenceControls weights ({ timeWeight, distanceWeight, environmentWeight })
 * to a runtime preference profile string supported by calculateLiveCampusRoutes().
 *
 * - Environment dominant -> "greenest"
 * - Time dominant -> "quickest"
 * - Otherwise -> "balanced"
 *
 * @param {Object} preferences
 * @returns {'greenest'|'quickest'|'balanced'}
 */
export function resolvePreferenceProfile(preferences = {}) {
  const time = Number(preferences?.timeWeight) || 0;
  const dist = Number(preferences?.distanceWeight) || 0;
  const env = Number(preferences?.environmentWeight) || 0;

  if (env > time && env > dist) {
    return 'greenest';
  }
  if (time > env && time > dist) {
    return 'quickest';
  }
  return 'balanced';
}

/**
 * Generates numeric factor weights based on user preferences slider values.
 *
 * @param {Object} preferences
 * @param {string} profile
 * @returns {Object} Numeric weights map
 */
export function getPreferenceWeights(preferences = {}, profile = 'balanced') {
  const timeScale = (Number(preferences?.timeWeight) || 50) / 50;
  const distScale = (Number(preferences?.distanceWeight) || 50) / 50;
  const envScale = (Number(preferences?.environmentWeight) || 50) / 50;

  if (profile === 'greenest') {
    return {
      time: 0.5 * timeScale,
      distance: 0.5 * distScale,
      pollution: 3.0 * envScale,
      heat: 2.0 * envScale,
      greenery: 3.0 * envScale,
      shade: 3.0 * envScale,
    };
  }
  if (profile === 'quickest') {
    return {
      time: 4.0 * timeScale,
      distance: 3.0 * distScale,
      pollution: 0.5,
      heat: 0.5,
      greenery: 0.5,
      shade: 0.5,
    };
  }
  return {
    time: 1.0 * timeScale,
    distance: 1.0 * distScale,
    pollution: 1.0 * envScale,
    heat: 1.0 * envScale,
    greenery: 1.0 * envScale,
    shade: 1.0 * envScale,
  };
}

/**
 * Transforms an algorithm Route model object into the UI route schema.
 *
 * @param {Object} route - Algorithm Route object
 * @param {number} [index=0] - Candidate route rank index
 * @param {boolean} [isFallback=false] - Whether route set is using offline fallback
 * @returns {Object} UI formatted route object
 */
export function transformRouteToUI(route = {}, index = 0, isFallback = false) {
  const totalTimeSec = Number(route.totalTime) || 0;
  const totalDistMeters = Number(route.totalDistance) || 0;
  const durationStr = totalTimeSec < 60 ? `${Math.round(totalTimeSec)} sec` : `${Math.round(totalTimeSec / 60)} min`;
  const distanceStr = `${(totalDistMeters / 1000).toFixed(1)} km`;

  const scoreVal = route.score != null ? Math.min(100, Math.max(0, Math.round(route.score))) : 75;
  const greeneryPct = Math.min(100, Math.max(0, Math.round((route.aggregatedEnvironmental?.greenery ?? 0) * 100)));
  const shadePct = Math.min(100, Math.max(0, Math.round((route.aggregatedEnvironmental?.shade ?? 0) * 100)));

  const polVal = route.aggregatedEnvironmental?.pollution ?? 20;
  const pollutionStr = polVal <= 25 ? 'Low' : polVal <= 50 ? 'Moderate' : 'High';

  const heatVal = route.aggregatedEnvironmental?.heat ?? 20;
  const trafficStr = heatVal > 28 ? 'High' : heatVal > 22 ? 'Moderate' : 'Low';
  const heatStr = heatVal <= 20 ? 'Low' : heatVal <= 28 ? 'Medium' : 'High';

  const rawName = route.name || `Campus Route ${index + 1}`;
  let category = 'Balanced';
  if (rawName.toLowerCase().includes('green') || rawName.toLowerCase().includes('eco') || greeneryPct > 70) {
    category = 'Greenest';
  } else if (rawName.toLowerCase().includes('fast') || rawName.toLowerCase().includes('distance') || rawName.toLowerCase().includes('time')) {
    category = 'Fastest';
  } else if (index === 0) {
    category = 'Greenest';
  } else if (index === 1) {
    category = 'Fastest';
  }

  let warning = route.warning || null;
  if (!warning && isFallback) {
    warning = 'Using static campus graph fallback.';
  }

  let explanation = route.explanation;
  if (!explanation) {
    if (category === 'Greenest') {
      explanation = 'This route prioritizes maximum vegetation canopy, high tree shade, and low air pollution along eco-friendly campus paths.';
    } else if (category === 'Fastest') {
      explanation = 'This route optimizes direct physical travel distance and minimum time to reach your destination quickly.';
    } else {
      explanation = 'A balanced campus route offering comfortable shade, good air quality, and efficient travel time.';
    }
  }

  return {
    id: route.id || `route-${index + 1}`,
    name: rawName,
    category,
    duration: durationStr,
    distance: distanceStr,
    environmentalScore: scoreVal,
    greenery: greeneryPct,
    shade: shadePct,
    pollution: pollutionStr,
    traffic: trafficStr,
    heat: heatStr,
    warning,
    explanation,
    nodeIds: route.nodeIds || [],
  };
}
