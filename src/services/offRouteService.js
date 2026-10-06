/**
 * GreenRoute Reliable Off-Route Detection Service (STEP GPS-7)
 * Evaluates whether current trusted GPS position is ON_ROUTE, UNCERTAIN, or OFF_ROUTE
 * relative to the selected route geometry using accuracy-aware thresholds,
 * consecutive observation confirmation, hysteresis, and stationary filtering.
 */

import { routeToPolyline } from '../areas/panki/mapDataAdapter.js';
import { projectPointOntoPolyline } from './routeProgressService.js';

export const OFF_ROUTE_CONFIG = Object.freeze({
  BASE_OFF_ROUTE_THRESHOLD_METERS: 30,  // Base off-route threshold in meters
  ACCURACY_ALLOWANCE_FACTOR: 0.5,        // 50% of GPS accuracy added to threshold
  MAX_ACCURACY_ALLOWANCE_METERS: 50,     // Cap accuracy allowance at 50m max
  HYSTERESIS_FACTOR: 0.7,                 // Return-to-route threshold is 70% of effective threshold
  REQUIRED_CONFIRMATION_COUNT: 3,        // Require 3 consecutive fixes to confirm OFF_ROUTE
  POOR_ACCURACY_UNCERTAIN_THRESHOLD: 100 // GPS accuracy >= 100m forces UNCERTAIN status if deviating
});

/**
 * Calculates accuracy-aware effective off-route and return-to-route thresholds in meters.
 *
 * @param {number} [gpsAccuracyMeters] - Reported GPS accuracy radius in meters
 * @returns {{
 *   effectiveThresholdMeters: number,
 *   returnToRouteThresholdMeters: number,
 *   cappedAllowance: number
 * }}
 */
export function calculateEffectiveThresholds(gpsAccuracyMeters = 0) {
  const acc = typeof gpsAccuracyMeters === 'number' && !isNaN(gpsAccuracyMeters) && gpsAccuracyMeters >= 0
    ? gpsAccuracyMeters
    : 0;

  const rawAllowance = acc * OFF_ROUTE_CONFIG.ACCURACY_ALLOWANCE_FACTOR;
  const cappedAllowance = Math.min(rawAllowance, OFF_ROUTE_CONFIG.MAX_ACCURACY_ALLOWANCE_METERS);

  const effectiveThresholdMeters = OFF_ROUTE_CONFIG.BASE_OFF_ROUTE_THRESHOLD_METERS + cappedAllowance;
  const returnToRouteThresholdMeters = effectiveThresholdMeters * OFF_ROUTE_CONFIG.HYSTERESIS_FACTOR;

  return {
    effectiveThresholdMeters: Math.round(effectiveThresholdMeters * 10) / 10,
    returnToRouteThresholdMeters: Math.round(returnToRouteThresholdMeters * 10) / 10,
    cappedAllowance: Math.round(cappedAllowance * 10) / 10,
  };
}

/**
 * Evaluates current GPS position relative to selected route geometry.
 * Determines whether user is ON_ROUTE, UNCERTAIN, or OFF_ROUTE.
 *
 * @param {object} params
 * @param {object|null} params.currentUserLocation - Trusted live GPS location fix
 * @param {object|null} params.selectedRoute - Currently selected route
 * @param {object|null} [params.previousOffRouteState] - Previous off-route state payload
 * @returns {object} Clean off-route evaluation contract payload
 */
export function evaluateOffRouteState({
  currentUserLocation = null,
  selectedRoute = null,
  previousOffRouteState = null,
} = {}) {
  const currentRouteId = selectedRoute?.id || null;

  // 1. Initial Checks / Missing Data Defaults
  if (!currentUserLocation || !selectedRoute) {
    return {
      status: 'ON_ROUTE',
      statusText: 'On route',
      distanceFromRouteMeters: 0,
      effectiveThresholdMeters: OFF_ROUTE_CONFIG.BASE_OFF_ROUTE_THRESHOLD_METERS,
      returnToRouteThresholdMeters: OFF_ROUTE_CONFIG.BASE_OFF_ROUTE_THRESHOLD_METERS * OFF_ROUTE_CONFIG.HYSTERESIS_FACTOR,
      confirmationCount: 0,
      projectedPoint: null,
      currentUserLocation,
      selectedRoute,
      routeId: currentRouteId,
      isOffRoute: false,
      isUncertain: false,
      isOnRoute: true,
    };
  }

  // 2. Extract Route Geometry Polyline & Project GPS Point
  const polyline = routeToPolyline(selectedRoute);
  const projection = projectPointOntoPolyline(currentUserLocation, polyline);

  if (!projection) {
    return {
      status: 'ON_ROUTE',
      statusText: 'On route',
      distanceFromRouteMeters: 0,
      effectiveThresholdMeters: OFF_ROUTE_CONFIG.BASE_OFF_ROUTE_THRESHOLD_METERS,
      returnToRouteThresholdMeters: OFF_ROUTE_CONFIG.BASE_OFF_ROUTE_THRESHOLD_METERS * OFF_ROUTE_CONFIG.HYSTERESIS_FACTOR,
      confirmationCount: 0,
      projectedPoint: null,
      currentUserLocation,
      selectedRoute,
      routeId: currentRouteId,
      isOffRoute: false,
      isUncertain: false,
      isOnRoute: true,
    };
  }

  const distanceFromRouteMeters = Math.round(projection.distanceToRouteMeters * 10) / 10;
  const projectedPoint = projection.projectedPoint;

  // 3. Accuracy-Aware Threshold Calculation
  const accuracyMeters = typeof currentUserLocation.accuracy === 'number' && !isNaN(currentUserLocation.accuracy)
    ? currentUserLocation.accuracy
    : 0;

  const { effectiveThresholdMeters, returnToRouteThresholdMeters } = calculateEffectiveThresholds(accuracyMeters);

  // 4. Handle Route Switch Reset (Requirement 11)
  const isSameRoute = previousOffRouteState && previousOffRouteState.routeId === currentRouteId;
  const prevStatus = isSameRoute ? (previousOffRouteState.status || 'ON_ROUTE') : 'ON_ROUTE';
  const prevConfirmationCount = isSameRoute ? (previousOffRouteState.confirmationCount || 0) : 0;

  let newStatus = 'ON_ROUTE';
  let newConfirmationCount = 0;
  let statusText = 'On route';

  // 5. Evaluate Distance & State Transitions with Hysteresis & Consecutive Fix Confirmation
  if (prevStatus === 'OFF_ROUTE') {
    // Once OFF_ROUTE, require distance to drop below returnToRouteThresholdMeters to transition back to ON_ROUTE
    if (distanceFromRouteMeters <= returnToRouteThresholdMeters) {
      newStatus = 'ON_ROUTE';
      newConfirmationCount = 0;
      statusText = 'On route';
    } else {
      newStatus = 'OFF_ROUTE';
      newConfirmationCount = Math.max(OFF_ROUTE_CONFIG.REQUIRED_CONFIRMATION_COUNT, prevConfirmationCount);
      statusText = `You're off route (${Math.round(distanceFromRouteMeters)} m from route)`;
    }
  } else {
    // Currently ON_ROUTE or UNCERTAIN
    if (distanceFromRouteMeters <= returnToRouteThresholdMeters) {
      newStatus = 'ON_ROUTE';
      newConfirmationCount = 0;
      statusText = 'On route';
    } else if (distanceFromRouteMeters <= effectiveThresholdMeters) {
      newStatus = 'ON_ROUTE';
      newConfirmationCount = 0;
      statusText = 'On route';
    } else {
      // Distance exceeds effectiveThresholdMeters
      const isStationary = typeof currentUserLocation.speed === 'number' && currentUserLocation.speed < 0.3;

      // Check if GPS accuracy is too poor to confidently declare OFF_ROUTE
      if (accuracyMeters >= OFF_ROUTE_CONFIG.POOR_ACCURACY_UNCERTAIN_THRESHOLD) {
        newStatus = 'UNCERTAIN';
        newConfirmationCount = 1;
        statusText = `Checking route position… (${Math.round(distanceFromRouteMeters)} m from route)`;
      } else if (isStationary && distanceFromRouteMeters < effectiveThresholdMeters * 1.5) {
        // Stationary GPS jitter: treat as UNCERTAIN
        newStatus = 'UNCERTAIN';
        newConfirmationCount = Math.min(1, prevConfirmationCount);
        statusText = 'Checking route position…';
      } else {
        // Active deviation with reliable GPS
        newConfirmationCount = prevConfirmationCount + 1;

        if (newConfirmationCount >= OFF_ROUTE_CONFIG.REQUIRED_CONFIRMATION_COUNT) {
          newStatus = 'OFF_ROUTE';
          statusText = `You're off route (${Math.round(distanceFromRouteMeters)} m from route)`;
        } else {
          newStatus = 'UNCERTAIN';
          statusText = 'Checking route position…';
        }
      }
    }
  }

  return {
    status: newStatus,
    statusText,
    distanceFromRouteMeters,
    effectiveThresholdMeters,
    returnToRouteThresholdMeters,
    confirmationCount: newConfirmationCount,
    projectedPoint,
    currentUserLocation,
    selectedRoute,
    routeId: currentRouteId,
    isOffRoute: newStatus === 'OFF_ROUTE',
    isUncertain: newStatus === 'UNCERTAIN',
    isOnRoute: newStatus === 'ON_ROUTE',
  };
}
