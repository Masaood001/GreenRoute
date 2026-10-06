/**
 * GreenRoute Firebase Service Layer
 * Central export module for frontend and routing integration.
 */

// Firebase Core instances
export { app, auth, db, getFirebaseConfigStatus } from "../firebase.js";

// Authentication Service
export {
  signUpUser,
  signInUser,
  signOutUser,
  onAuthStateChange,
  getCurrentUser,
  checkCurrentUserAdmin,
  sendPasswordReset,
  sendPasswordResetEmail,
  changeUserPassword,
} from "./authService.js";

// Campus Conditions Service
export {
  ALLOWED_CONDITION_TYPES,
  ALLOWED_SEVERITIES,
  ALLOWED_STATUSES,
  validateCampusCondition,
  getCampusConditions,
  subscribeCampusConditions,
  getCampusConditionById,
  addCampusCondition,
  updateCampusCondition,
  resolveCampusCondition,
  deleteCampusCondition,
} from "./campusConditionsService.js";

// User Preferences Service
export {
  ALLOWED_ROUTE_TYPES,
  ALLOWED_WALKING_SPEEDS,
  ALLOWED_PREFERENCE_KEYS,
  DEFAULT_USER_PREFERENCES,
  validateUserPreferences,
  getUserPreferences,
  saveUserPreferences,
  subscribeUserPreferences,
} from "./userPreferencesService.js";

// Environmental Data Service
export {
  validateEnvironmentalData,
  getLatestEnvironmentalData,
  getAllCurrentEnvironmentalData,
  subscribeEnvironmentalData,
  recordEnvironmentalData,
  getEnvironmentalHistory,
  getEnvironmentalDataById,
} from "./environmentalDataService.js";

// Saved Routes Service
export {
  validateRoutePayload,
  saveRoute,
  getUserSavedRoutes,
  getRouteById,
  updateRoute,
  toggleFavoriteRoute,
  deleteRoute,
  subscribeUserRoutes,
} from "./routesService.js";

// Simulated Campus Benchmark Data
export {
  SIMULATION_DISCLAIMER,
  SIMULATION_SOURCE,
  SIMULATED_CAMPUS_ZONES,
  SIMULATED_CAMPUS_CONDITIONS,
  seedSimulatedCampusData,
} from "./simulatedData.js";

// Live Routing Integration Orchestration
export { calculateLiveCampusRoutes } from "./routingIntegrationService.js";

// Browser Geolocation Service
export {
  GEOLOCATION_ERROR_CODES,
  DEFAULT_GEOLOCATION_OPTIONS,
  normalizeLocation,
  normalizeGeolocationError,
  getCurrentLocation,
  startLocationTracking,
  stopLocationTracking,
  getAccuracyClassification,
  calculateDistanceMeters,
  shouldAcceptNewLocationFix,
} from "./geolocationService.js";

// Live Navigation Progress & ETA Service
export {
  DEFAULT_TRAVEL_SPEEDS_MS,
  DEFAULT_ARRIVAL_THRESHOLD_METERS,
  STATIONARY_SPEED_THRESHOLD_MS,
  MAX_REALISTIC_SPEED_MS,
  projectPointToSegment,
  projectPointOntoPolyline,
  calculateEffectiveSpeed,
  smoothSpeedMs,
  convertMsToKmh,
  calculateLiveETA,
  formatDistance,
  calculateNavigationProgress,
} from "./routeProgressService.js";

// Reliable Off-Route Detection Service (Step GPS-7)
export {
  OFF_ROUTE_CONFIG,
  calculateEffectiveThresholds,
  evaluateOffRouteState,
} from "./offRouteService.js";
