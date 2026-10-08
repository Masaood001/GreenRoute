/**
 * GreenRoute Automatic Off-Route Rerouting Service (STEP GPS-8)
 * Manages automatic rerouting triggers, route recalculation using current trusted GPS
 * position as new origin, destination preservation, safe concurrency locking,
 * reroute cooldown, state resets, and failure handling.
 */

import { calculateLiveCampusRoutes } from './routingIntegrationService.js';
import { createGpsLocation, resolvePankiLocationToNode } from '../areas/panki/locationSearch.js';
import { resolveNodeInArea } from '../areas/graphAdapter.js';
import {
  mapInputToNodeId,
  resolvePreferenceProfile,
  getPreferenceWeights,
  transformRouteToUI,
} from '../utils/routingHelpers.js';

export const DEFAULT_REROUTE_COOLDOWN_MS = 10000;

export const REROUTE_STATUS = Object.freeze({
  IDLE: 'IDLE',
  OFF_ROUTE: 'OFF_ROUTE',
  REROUTING: 'REROUTING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
});

/**
 * Evaluates whether automatic rerouting should be initiated.
 * Rerouting triggers ONLY when GPS-7 offRouteState returns status === 'OFF_ROUTE'.
 *
 * @param {object} params
 * @param {object|null} params.offRouteState - GPS-7 off-route state payload
 * @param {boolean} [params.isRerouting=false] - Whether a reroute operation is currently active
 * @param {number|null} [params.lastRerouteTime=null] - Timestamp of the last reroute completion/attempt
 * @param {boolean} [params.isArrived=false] - Whether the user has arrived at destination
 * @param {number} [params.cooldownMs=DEFAULT_REROUTE_COOLDOWN_MS] - Reroute cooldown in milliseconds
 * @param {number} [params.currentTime=Date.now()] - Current timestamp
 * @returns {boolean} True if automatic reroute should start
 */
export function shouldTriggerReroute({
  offRouteState = null,
  isRerouting = false,
  lastRerouteTime = null,
  isArrived = false,
  cooldownMs = DEFAULT_REROUTE_COOLDOWN_MS,
  currentTime = Date.now(),
  lastReroutedGpsKey = null,
  currentGpsKey = null,
  currentRouteId = null,
} = {}) {
  // 1. Do not reroute if arrived at destination
  if (isArrived) {
    return false;
  }

  // 2. Do not reroute if another reroute operation is currently running
  if (isRerouting) {
    return false;
  }

  // 3. Must have a confirmed OFF_ROUTE status from GPS-7
  if (
    !offRouteState ||
    !offRouteState.isOffRoute ||
    offRouteState.status !== 'OFF_ROUTE'
  ) {
    return false;
  }

  // 4. Do not reroute if offRouteState belongs to a different route
  if (
    offRouteState.routeId &&
    currentRouteId &&
    offRouteState.routeId !== currentRouteId
  ) {
    return false;
  }

  // 5. Do not reroute again from the exact same GPS location fix / event
  if (
    currentGpsKey &&
    lastReroutedGpsKey &&
    currentGpsKey === lastReroutedGpsKey
  ) {
    return false;
  }

  // 6. Respect configurable reroute cooldown period
  if (typeof lastRerouteTime === 'number' && lastRerouteTime > 0) {
    const elapsed = currentTime - lastRerouteTime;
    if (elapsed < cooldownMs) {
      return false;
    }
  }

  return true;
}

/**
 * Executes automatic route calculation using current trusted GPS coordinates as the new origin.
 * Strictly preserves the user's existing destination, travel mode, preferences, and environmental conditions.
 *
 * @param {object} params
 * @param {object} params.currentUserLocation - Current trusted live GPS coordinates { latitude, longitude }
 * @param {object|string} params.destinationLocation - Existing destination location object or ID string
 * @param {string} [params.destination] - Existing destination name/string label
 * @param {'walking'|'cycling'} [params.travelMode='walking'] - Selected travel mode
 * @param {object|null} [params.preferences=null] - User route preferences
 * @param {string} [params.areaId='panki-kanpur'] - Target routing area ID
 * @param {Array} [params.activeConditions=[]] - Active campus conditions
 * @param {function} [params.calculateRoutesFn=calculateLiveCampusRoutes] - Routing calculation engine
 * @returns {Promise<{
 *   success: boolean,
 *   routes: Array,
 *   selectedRoute: object|null,
 *   newOriginLocation: object|null,
 *   error: string|null
 * }>} Reroute result payload
 */
export async function executeAutomaticReroute({
  currentUserLocation = null,
  destinationLocation = null,
  destination = '',
  travelMode = 'walking',
  preferences = null,
  areaId = 'panki-kanpur',
  activeConditions = [],
  calculateRoutesFn = calculateLiveCampusRoutes,
} = {}) {
  if (
    !currentUserLocation ||
    typeof currentUserLocation.latitude !== 'number' ||
    typeof currentUserLocation.longitude !== 'number' ||
    isNaN(currentUserLocation.latitude) ||
    isNaN(currentUserLocation.longitude)
  ) {
    return {
      success: false,
      routes: [],
      selectedRoute: null,
      newOriginLocation: null,
      error: 'Invalid or missing current GPS position.',
    };
  }

  const currentDest = destinationLocation || destination;
  if (!currentDest) {
    return {
      success: false,
      routes: [],
      selectedRoute: null,
      newOriginLocation: null,
      error: 'Destination is missing.',
    };
  }

  // 1. Create normalized GPS origin location preserving exact raw GPS coordinates
  const newOriginLocation = createGpsLocation(
    currentUserLocation.latitude,
    currentUserLocation.longitude
  );

  if (newOriginLocation?.error) {
    return {
      success: false,
      routes: [],
      selectedRoute: null,
      newOriginLocation: null,
      error: newOriginLocation.error,
    };
  }

  // 2. Resolve start node ID (from GPS location) and target node ID (from preserved destination)
  let startNodeId = resolvePankiLocationToNode(newOriginLocation) || resolveNodeInArea(areaId, newOriginLocation);
  let targetNodeId = resolvePankiLocationToNode(currentDest) || resolveNodeInArea(areaId, currentDest);

  let targetAreaId = areaId;
  if (!startNodeId || !targetNodeId) {
    startNodeId = mapInputToNodeId(typeof newOriginLocation === 'string' ? newOriginLocation : newOriginLocation?.name, 'N1');
    targetNodeId = mapInputToNodeId(typeof currentDest === 'string' ? currentDest : currentDest?.name, 'N7');
    if (startNodeId.startsWith('N') && targetNodeId.startsWith('N')) {
      targetAreaId = 'sample-campus';
    } else {
      startNodeId = startNodeId || 'osm-node-8820570755';
      targetNodeId = targetNodeId || 'osm-node-3156228563';
    }
  }

  const preferenceProfile = resolvePreferenceProfile(preferences);
  const weights = getPreferenceWeights(preferences, preferenceProfile);

  try {
    const rawRoutes = await calculateRoutesFn({
      areaId: targetAreaId,
      startNodeId,
      targetNodeId,
      preference: preferenceProfile,
      travelMode,
      activeConditions,
      options: { weights, avoidHazards: true, useConditions: true, travelMode },
    });

    const fallbackStatus = Boolean(rawRoutes?.isFallback);
    const formattedRoutes = (rawRoutes || []).map((r, index) =>
      transformRouteToUI(r, index, fallbackStatus, travelMode)
    );

    if (formattedRoutes.length === 0) {
      return {
        success: false,
        routes: [],
        selectedRoute: null,
        newOriginLocation,
        error: 'No valid routes found from current position.',
      };
    }

    return {
      success: true,
      routes: formattedRoutes,
      selectedRoute: formattedRoutes[0],
      newOriginLocation,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      routes: [],
      selectedRoute: null,
      newOriginLocation: null,
      error: err.message || 'Unable to reroute',
    };
  }
}
