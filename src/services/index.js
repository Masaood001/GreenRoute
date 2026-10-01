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
