/**
 * GreenRoute Navigation Progress & ETA Service
 * Computes live spatial route progress, remaining distance, ETA, current speed, and arrival state
 * based on trusted GPS coordinates and the currently selected route.
 */

import { calculateDistanceMeters, getAccuracyClassification } from './geolocationService.js';
import { routeToPolyline } from '../areas/panki/mapDataAdapter.js';
import { evaluateOffRouteState } from './offRouteService.js';

export const DEFAULT_TRAVEL_SPEEDS_MS = Object.freeze({
  walking: 1.39, // ~5.0 km/h
  cycling: 4.17, // ~15.0 km/h
});

export const DEFAULT_ARRIVAL_THRESHOLD_METERS = 25;
export const STATIONARY_SPEED_THRESHOLD_MS = 0.3; // ~1.08 km/h
export const MAX_REALISTIC_SPEED_MS = 40; // ~144 km/h

/**
 * Projects a geographic point P [lat, lon] onto a line segment between A [lat, lon] and B [lat, lon].
 * Uses local equirectangular planar projection for short segment distances.
 *
 * @param {Array<number>} p - Point [lat, lng]
 * @param {Array<number>} a - Segment start [lat, lng]
 * @param {Array<number>} b - Segment end [lat, lng]
 * @returns {{
 *   projectedPoint: [number, number],
 *   distanceFromA: number,
 *   distanceToSegment: number
 * }} Projection results
 */
export function projectPointToSegment(p, a, b) {
  const pLat = p[0];
  const pLng = p[1];
  const aLat = a[0];
  const aLng = a[1];
  const bLat = b[0];
  const bLng = b[1];

  const segLengthMeters = calculateDistanceMeters(aLat, aLng, bLat, bLng);

  if (segLengthMeters < 0.01) {
    const dist = calculateDistanceMeters(pLat, pLng, aLat, aLng);
    return {
      projectedPoint: [aLat, aLng],
      distanceFromA: 0,
      distanceToSegment: dist,
    };
  }

  // Equirectangular projection to local Cartesian meters
  const cosLat = Math.cos((aLat * Math.PI) / 180);
  const degToRad = Math.PI / 180;

  const dxAB = (bLng - aLng) * degToRad * 6371000 * cosLat;
  const dyAB = (bLat - aLat) * degToRad * 6371000;

  const dxAP = (pLng - aLng) * degToRad * 6371000 * cosLat;
  const dyAP = (pLat - aLat) * degToRad * 6371000;

  const abSq = dxAB * dxAB + dyAB * dyAB;
  let t = 0;
  if (abSq > 0) {
    t = (dxAP * dxAB + dyAP * dyAB) / abSq;
  }

  // Clamp t to [0, 1] segment bounds
  const clampedT = Math.max(0, Math.min(1, t));

  const projLat = aLat + clampedT * (bLat - aLat);
  const projLng = aLng + clampedT * (bLng - aLng);

  const distanceFromA = clampedT * segLengthMeters;
  const distanceToSegment = calculateDistanceMeters(pLat, pLng, projLat, projLng);

  return {
    projectedPoint: [projLat, projLng],
    distanceFromA,
    distanceToSegment,
  };
}

/**
 * Projects a GPS point onto the closest segment of a route polyline.
 * Computes spatial distance travelled along route and remaining distance.
 *
 * @param {{ latitude: number, longitude: number }} gpsPoint
 * @param {Array<Array<number>>} polyline - Array of [lat, lng] points
 * @returns {{
 *   projectedPoint: { latitude: number, longitude: number },
 *   travelledDistanceMeters: number,
 *   remainingDistanceMeters: number,
 *   totalDistanceMeters: number,
 *   progressPercent: number,
 *   distanceToRouteMeters: number,
 *   closestSegmentIndex: number
 * }|null} Polyline projection details or null
 */
export function projectPointOntoPolyline(gpsPoint, polyline) {
  if (
    !gpsPoint ||
    typeof gpsPoint.latitude !== 'number' ||
    typeof gpsPoint.longitude !== 'number' ||
    !Array.isArray(polyline) ||
    polyline.length === 0
  ) {
    return null;
  }

  const p = [gpsPoint.latitude, gpsPoint.longitude];

  if (polyline.length === 1) {
    const single = polyline[0];
    const dist = calculateDistanceMeters(p[0], p[1], single[0], single[1]);
    return {
      projectedPoint: { latitude: single[0], longitude: single[1] },
      travelledDistanceMeters: 0,
      remainingDistanceMeters: 0,
      totalDistanceMeters: 0,
      progressPercent: 100,
      distanceToRouteMeters: dist,
      closestSegmentIndex: 0,
    };
  }

  // 1. Calculate cumulative segment distances
  const segmentDistances = [];
  let totalDistanceMeters = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const d = calculateDistanceMeters(
      polyline[i][0],
      polyline[i][1],
      polyline[i + 1][0],
      polyline[i + 1][1]
    );
    segmentDistances.push(d);
    totalDistanceMeters += d;
  }

  // 2. Find closest segment to GPS point
  let minDistanceToSegment = Infinity;
  let bestProjection = null;
  let closestSegmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i];
    const segEnd = polyline[i + 1];

    const proj = projectPointToSegment(p, segStart, segEnd);

    if (proj.distanceToSegment < minDistanceToSegment) {
      minDistanceToSegment = proj.distanceToSegment;
      bestProjection = proj;
      closestSegmentIndex = i;
    }
  }

  if (!bestProjection) {
    return null;
  }

  // 3. Compute distance travelled up to closest segment projection
  let travelledDistanceMeters = 0;
  for (let i = 0; i < closestSegmentIndex; i++) {
    travelledDistanceMeters += segmentDistances[i];
  }
  travelledDistanceMeters += bestProjection.distanceFromA;

  // 4. Compute remaining distance & progress
  const remainingDistanceMeters = Math.max(0, totalDistanceMeters - travelledDistanceMeters);
  let progressPercent = 0;

  if (totalDistanceMeters > 0) {
    progressPercent = Math.max(0, Math.min(100, (travelledDistanceMeters / totalDistanceMeters) * 100));
  } else {
    progressPercent = 100;
  }

  return {
    projectedPoint: {
      latitude: bestProjection.projectedPoint[0],
      longitude: bestProjection.projectedPoint[1],
    },
    travelledDistanceMeters,
    remainingDistanceMeters,
    totalDistanceMeters,
    progressPercent: Math.round(progressPercent * 10) / 10,
    distanceToRouteMeters: minDistanceToSegment,
    closestSegmentIndex,
  };
}

/**
 * Smooths raw speed using exponential moving average when valid.
 *
 * @param {number} rawSpeedMs
 * @param {number|null} [previousSpeedMs]
 * @param {number} [weight]
 * @returns {number}
 */
export function smoothSpeedMs(rawSpeedMs, previousSpeedMs = null, weight = 0.4) {
  if (typeof rawSpeedMs !== 'number' || isNaN(rawSpeedMs) || rawSpeedMs <= 0) {
    return 0;
  }
  if (typeof previousSpeedMs !== 'number' || isNaN(previousSpeedMs) || previousSpeedMs <= 0) {
    return Math.round(rawSpeedMs * 100) / 100;
  }
  const smoothed = weight * rawSpeedMs + (1 - weight) * previousSpeedMs;
  return Math.round(smoothed * 100) / 100;
}

/**
 * Converts meters per second to kilometers per hour.
 *
 * @param {number} speedMs
 * @returns {number} Speed in km/h rounded to 1 decimal place
 */
export function convertMsToKmh(speedMs) {
  if (typeof speedMs !== 'number' || isNaN(speedMs) || speedMs < 0) {
    return 0;
  }
  return Math.round(speedMs * 3.6 * 10) / 10;
}

/**
 * Calculates effective navigation speed state using real GPS / derived observations.
 * Does NOT return walking/cycling mode fallback as live current speed when stationary or detecting.
 *
 * @param {number|null} gpsSpeed - Speed reported by browser GPS in m/s
 * @param {'walking'|'cycling'} [travelMode] - Travel mode
 * @param {object|null} [previousGPS] - Previous location fix
 * @param {object|null} [currentGPS] - Current location fix
 * @param {object} [options] - Options (e.g. previousSpeedMs)
 * @returns {{
 *   effectiveSpeedMs: number,
 *   liveSpeedKmh: number,
 *   speedSource: 'gps'|'derived'|'unknown',
 *   speedStatus: 'moving'|'stopped'|'detecting'|'unavailable',
 *   isStationary: boolean,
 *   currentSpeedFormatted: string,
 *   isFromGps: boolean,
 *   planningFallbackSpeedMs: number
 * }}
 */
export function calculateEffectiveSpeed(
  gpsSpeed,
  travelMode = 'walking',
  previousGPS = null,
  currentGPS = null,
  options = {}
) {
  const planningFallbackSpeedMs = DEFAULT_TRAVEL_SPEEDS_MS[travelMode] || DEFAULT_TRAVEL_SPEEDS_MS.walking;

  // 1. Check browser-reported GPS speed first
  if (typeof gpsSpeed === 'number' && !isNaN(gpsSpeed) && gpsSpeed >= 0) {
    if (gpsSpeed < STATIONARY_SPEED_THRESHOLD_MS) {
      return {
        effectiveSpeedMs: 0,
        liveSpeedKmh: 0,
        speedSource: 'gps',
        speedStatus: 'stopped',
        isStationary: true,
        currentSpeedFormatted: '0 km/h',
        isFromGps: true,
        planningFallbackSpeedMs,
      };
    }
    const speedMs = options.previousSpeedMs
      ? smoothSpeedMs(gpsSpeed, options.previousSpeedMs)
      : gpsSpeed;
    const speedKmh = convertMsToKmh(speedMs);
    return {
      effectiveSpeedMs: speedMs,
      liveSpeedKmh: speedKmh,
      speedSource: 'gps',
      speedStatus: 'moving',
      isStationary: false,
      currentSpeedFormatted: `${speedKmh} km/h`,
      isFromGps: true,
      planningFallbackSpeedMs,
    };
  }

  // 2. Check derived speed from consecutive trusted GPS fixes
  if (
    previousGPS && currentGPS &&
    typeof previousGPS.latitude === 'number' && typeof previousGPS.longitude === 'number' &&
    typeof currentGPS.latitude === 'number' && typeof currentGPS.longitude === 'number'
  ) {
    const t1 = previousGPS.timestamp;
    const t2 = currentGPS.timestamp;

    if (typeof t1 === 'number' && typeof t2 === 'number' && !isNaN(t1) && !isNaN(t2)) {
      const timeDeltaSec = (t2 - t1) / 1000;

      if (timeDeltaSec <= 0) {
        return {
          effectiveSpeedMs: 0,
          liveSpeedKmh: 0,
          speedSource: 'unknown',
          speedStatus: 'detecting',
          isStationary: false,
          currentSpeedFormatted: 'Detecting speed…',
          isFromGps: false,
          planningFallbackSpeedMs,
        };
      }

      if (timeDeltaSec > 30) {
        return {
          effectiveSpeedMs: 0,
          liveSpeedKmh: 0,
          speedSource: 'unknown',
          speedStatus: 'unavailable',
          isStationary: false,
          currentSpeedFormatted: 'Speed unavailable',
          isFromGps: false,
          planningFallbackSpeedMs,
        };
      }

      const distMeters = calculateDistanceMeters(
        previousGPS.latitude, previousGPS.longitude,
        currentGPS.latitude, currentGPS.longitude
      );

      // Noise filter for small jitter when stationary
      if (distMeters < 1.0) {
        return {
          effectiveSpeedMs: 0,
          liveSpeedKmh: 0,
          speedSource: 'derived',
          speedStatus: 'stopped',
          isStationary: true,
          currentSpeedFormatted: '0 km/h',
          isFromGps: false,
          planningFallbackSpeedMs,
        };
      }

      const rawDerivedSpeed = distMeters / timeDeltaSec;

      if (rawDerivedSpeed > MAX_REALISTIC_SPEED_MS) {
        // Impossible speed spike rejected
        return {
          effectiveSpeedMs: 0,
          liveSpeedKmh: 0,
          speedSource: 'unknown',
          speedStatus: 'detecting',
          isStationary: false,
          currentSpeedFormatted: 'Detecting speed…',
          isFromGps: false,
          planningFallbackSpeedMs,
        };
      }

      if (rawDerivedSpeed < STATIONARY_SPEED_THRESHOLD_MS) {
        return {
          effectiveSpeedMs: 0,
          liveSpeedKmh: 0,
          speedSource: 'derived',
          speedStatus: 'stopped',
          isStationary: true,
          currentSpeedFormatted: '0 km/h',
          isFromGps: false,
          planningFallbackSpeedMs,
        };
      }

      const speedMs = options.previousSpeedMs
        ? smoothSpeedMs(rawDerivedSpeed, options.previousSpeedMs)
        : rawDerivedSpeed;
      const speedKmh = convertMsToKmh(speedMs);

      return {
        effectiveSpeedMs: speedMs,
        liveSpeedKmh: speedKmh,
        speedSource: 'derived',
        speedStatus: 'moving',
        isStationary: false,
        currentSpeedFormatted: `${speedKmh} km/h`,
        isFromGps: false,
        planningFallbackSpeedMs,
      };
    }
  }

  // 3. Unknown / Detecting speed state (before enough GPS data exists)
  return {
    effectiveSpeedMs: 0,
    liveSpeedKmh: 0,
    speedSource: 'unknown',
    speedStatus: 'detecting',
    isStationary: false,
    currentSpeedFormatted: 'Detecting speed…',
    isFromGps: false,
    planningFallbackSpeedMs,
  };
}

/**
 * Calculates live estimated time to arrival (ETA) in seconds and human-readable string format.
 * Pauses ETA when user is stopped/stationary and uses measured speed when moving.
 *
 * @param {number} remainingDistanceMeters
 * @param {number|object} effectiveSpeedMsOrState
 * @param {number} [arrivalThreshold]
 * @param {'walking'|'cycling'} [travelMode]
 * @returns {{ etaSeconds: number, etaFormatted: string, isEtaPaused: boolean }}
 */
export function calculateLiveETA(
  remainingDistanceMeters,
  effectiveSpeedMsOrState,
  arrivalThreshold = DEFAULT_ARRIVAL_THRESHOLD_METERS
) {
  if (
    typeof remainingDistanceMeters !== 'number' ||
    isNaN(remainingDistanceMeters) ||
    remainingDistanceMeters <= arrivalThreshold
  ) {
    return { etaSeconds: 0, etaFormatted: '0 min', isEtaPaused: false };
  }

  let effectiveSpeedMs = 0;
  let isStationary = false;
  let speedStatus = 'moving';

  if (typeof effectiveSpeedMsOrState === 'object' && effectiveSpeedMsOrState !== null) {
    effectiveSpeedMs = effectiveSpeedMsOrState.effectiveSpeedMs || 0;
    isStationary = Boolean(effectiveSpeedMsOrState.isStationary);
    speedStatus = effectiveSpeedMsOrState.speedStatus || (isStationary ? 'stopped' : 'moving');
  } else if (typeof effectiveSpeedMsOrState === 'number' && !isNaN(effectiveSpeedMsOrState)) {
    effectiveSpeedMs = effectiveSpeedMsOrState;
    if (effectiveSpeedMs <= 0) {
      isStationary = true;
      speedStatus = 'stopped';
    }
  }

  // If user is stopped/stationary, pause ETA
  if (isStationary || speedStatus === 'stopped') {
    return { etaSeconds: 0, etaFormatted: 'ETA paused', isEtaPaused: true };
  }

  // If speed is detecting or unavailable, return "ETA unavailable" until live speed is measured
  if (speedStatus === 'detecting' || speedStatus === 'unavailable') {
    return { etaSeconds: 0, etaFormatted: 'ETA unavailable', isEtaPaused: false };
  }

  const etaSeconds = Math.max(0, Math.round(remainingDistanceMeters / effectiveSpeedMs));

  if (!isFinite(etaSeconds)) {
    return { etaSeconds: 0, etaFormatted: '0 min', isEtaPaused: false };
  }

  if (etaSeconds < 30) {
    return { etaSeconds, etaFormatted: '< 1 min', isEtaPaused: false };
  }

  const minutes = Math.round(etaSeconds / 60);

  if (minutes < 60) {
    return { etaSeconds, etaFormatted: `${minutes} min`, isEtaPaused: false };
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;

  if (remMinutes === 0) {
    return { etaSeconds, etaFormatted: `${hours} hr`, isEtaPaused: false };
  }

  return { etaSeconds, etaFormatted: `${hours} hr ${remMinutes} min`, isEtaPaused: false };
}

/**
 * Formats distance in meters into human-readable text (m or km).
 *
 * @param {number} distanceMeters
 * @returns {string} Formatted distance (e.g., "720 m", "1.2 km")
 */
export function formatDistance(distanceMeters) {
  if (typeof distanceMeters !== 'number' || isNaN(distanceMeters) || distanceMeters <= 0) {
    return '0 m';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const km = Math.round((distanceMeters / 1000) * 10) / 10;
  return `${km} km`;
}

/**
 * Full live navigation progress calculation orchestrator.
 * Combines spatial polyline projection, speed conversion, ETA, and status messages.
 *
 * @param {object} params
 * @param {object|null} params.currentUserLocation - Trusted live GPS location
 * @param {object|null} params.selectedRoute - Currently selected UI route
 * @param {'walking'|'cycling'} [params.travelMode] - Travel mode ('walking'|'cycling')
 * @param {object|null} [params.previousLocation] - Optional previous GPS location fix
 * @param {number} [params.arrivalThreshold] - Arrival threshold in meters
 * @param {object} [params.options] - Extra options (e.g. previousSpeedMs)
 * @returns {object} Navigation progress state payload
 */
export function calculateNavigationProgress({
  currentUserLocation = null,
  selectedRoute = null,
  travelMode = 'walking',
  previousLocation = null,
  arrivalThreshold = DEFAULT_ARRIVAL_THRESHOLD_METERS,
  options = {},
} = {}) {
  // 1. Initial Empty / Missing State Defaults
  if (!currentUserLocation) {
    return {
      isNavigationActive: false,
      statusKey: 'NO_GPS',
      statusText: 'Start Live Location to see live progress.',
      progressPercent: 0,
      remainingDistanceMeters: 0,
      remainingDistanceFormatted: '0 m',
      travelledDistanceMeters: 0,
      totalDistanceMeters: 0,
      currentSpeedMs: 0,
      currentSpeedKmh: 0,
      currentSpeedFormatted: '0 km/h',
      isSpeedFromGps: false,
      speedSource: 'unknown',
      speedStatus: 'unavailable',
      isStationary: false,
      isEtaPaused: false,
      etaSeconds: 0,
      etaFormatted: '0 min',
      isArrived: false,
      distanceToRouteMeters: 0,
      projectedPoint: null,
    };
  }

  if (!selectedRoute) {
    return {
      isNavigationActive: false,
      statusKey: 'NO_ROUTE',
      statusText: 'Waiting for a route.',
      progressPercent: 0,
      remainingDistanceMeters: 0,
      remainingDistanceFormatted: '0 m',
      travelledDistanceMeters: 0,
      totalDistanceMeters: 0,
      currentSpeedMs: 0,
      currentSpeedKmh: 0,
      currentSpeedFormatted: '0 km/h',
      isSpeedFromGps: false,
      speedSource: 'unknown',
      speedStatus: 'unavailable',
      isStationary: false,
      isEtaPaused: false,
      etaSeconds: 0,
      etaFormatted: '0 min',
      isArrived: false,
      distanceToRouteMeters: 0,
      projectedPoint: null,
    };
  }

  // 2. Extract Route Geometry Polyline
  const polyline = routeToPolyline(selectedRoute);

  if (!Array.isArray(polyline) || polyline.length === 0) {
    const routeTotalDist = typeof selectedRoute.distanceMeters === 'number' ? selectedRoute.distanceMeters : 0;
    return {
      isNavigationActive: true,
      statusKey: 'NAVIGATING',
      statusText: 'Live navigation',
      progressPercent: 0,
      remainingDistanceMeters: routeTotalDist,
      remainingDistanceFormatted: formatDistance(routeTotalDist),
      travelledDistanceMeters: 0,
      totalDistanceMeters: routeTotalDist,
      currentSpeedMs: 0,
      currentSpeedKmh: 0,
      currentSpeedFormatted: '0 km/h',
      isSpeedFromGps: false,
      speedSource: 'unknown',
      speedStatus: 'unavailable',
      isStationary: false,
      isEtaPaused: false,
      etaSeconds: 0,
      etaFormatted: '0 min',
      isArrived: false,
      distanceToRouteMeters: 0,
      projectedPoint: null,
    };
  }

  // 3. Spatial Projection onto Selected Route Polyline
  const projection = projectPointOntoPolyline(currentUserLocation, polyline);

  if (!projection) {
    return {
      isNavigationActive: false,
      statusKey: 'UNAVAILABLE',
      statusText: 'Location unavailable',
      progressPercent: 0,
      remainingDistanceMeters: 0,
      remainingDistanceFormatted: '0 m',
      travelledDistanceMeters: 0,
      totalDistanceMeters: 0,
      currentSpeedMs: 0,
      currentSpeedKmh: 0,
      currentSpeedFormatted: '0 km/h',
      isSpeedFromGps: false,
      speedSource: 'unknown',
      speedStatus: 'unavailable',
      isStationary: false,
      isEtaPaused: false,
      etaSeconds: 0,
      etaFormatted: '0 min',
      isArrived: false,
      distanceToRouteMeters: 0,
      projectedPoint: null,
    };
  }

  // 4. Effective Speed & State Calculation
  const speedState = calculateEffectiveSpeed(
    currentUserLocation.speed,
    travelMode,
    previousLocation,
    currentUserLocation,
    options
  );

  // 5. Off-Route Evaluation (STEP GPS-7)
  const offRouteState = evaluateOffRouteState({
    currentUserLocation,
    selectedRoute,
    previousOffRouteState: options.previousOffRouteState || null,
  });

  // 6. Arrival & Status Detection
  const isArrived = projection.remainingDistanceMeters <= arrivalThreshold;

  let finalRemainingDist = projection.remainingDistanceMeters;
  let finalProgressPercent = projection.progressPercent;
  let etaObj = { etaSeconds: 0, etaFormatted: '0 min', isEtaPaused: false };
  let statusKey = 'NAVIGATING';
  let statusText = 'Live navigation';

  const accClassification = getAccuracyClassification(currentUserLocation.accuracy);
  if (accClassification.isLowAccuracy) {
    statusText = accClassification.label;
  } else if (offRouteState.isOffRoute) {
    statusKey = 'OFF_ROUTE';
    statusText = offRouteState.statusText;
  } else if (offRouteState.isUncertain) {
    statusKey = 'UNCERTAIN';
    statusText = offRouteState.statusText;
  } else if (speedState.isStationary || speedState.speedStatus === 'stopped') {
    statusKey = 'STOPPED';
    statusText = 'Stopped';
  }

  if (isArrived) {
    statusKey = 'ARRIVED';
    statusText = 'Arrived at destination';
    finalRemainingDist = 0;
    finalProgressPercent = 100;
    etaObj = { etaSeconds: 0, etaFormatted: '0 min', isEtaPaused: false };
  } else {
    etaObj = calculateLiveETA(finalRemainingDist, speedState, arrivalThreshold);
  }

  return {
    isNavigationActive: true,
    statusKey,
    statusText,
    progressPercent: finalProgressPercent,
    remainingDistanceMeters: finalRemainingDist,
    remainingDistanceFormatted: formatDistance(finalRemainingDist),
    travelledDistanceMeters: projection.travelledDistanceMeters,
    totalDistanceMeters: projection.totalDistanceMeters,
    currentSpeedMs: speedState.effectiveSpeedMs,
    currentSpeedKmh: speedState.liveSpeedKmh,
    currentSpeedFormatted: speedState.currentSpeedFormatted,
    isSpeedFromGps: speedState.isFromGps,
    speedSource: speedState.speedSource,
    speedStatus: speedState.speedStatus,
    isStationary: speedState.isStationary,
    isEtaPaused: etaObj.isEtaPaused,
    etaSeconds: etaObj.etaSeconds,
    etaFormatted: etaObj.etaFormatted,
    isArrived,
    distanceToRouteMeters: projection.distanceToRouteMeters,
    projectedPoint: projection.projectedPoint,
    // Step GPS-7 Off-Route Exports
    offRouteState,
    offRouteStatus: offRouteState.status,
    offRouteText: offRouteState.statusText,
    distanceFromRouteMeters: offRouteState.distanceFromRouteMeters,
    isOffRoute: offRouteState.isOffRoute,
    isUncertain: offRouteState.isUncertain,
    isOnRoute: offRouteState.isOnRoute,
  };
}
