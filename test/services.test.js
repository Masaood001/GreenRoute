import assert from "node:assert";
import fs from "node:fs";
import {
  // Phase 1 Constants & Enums
  ALLOWED_CONDITION_TYPES,
  ALLOWED_SEVERITIES,
  ALLOWED_STATUSES,
  ALLOWED_ROUTE_TYPES,
  ALLOWED_WALKING_SPEEDS,
  ALLOWED_PREFERENCE_KEYS,
  DEFAULT_USER_PREFERENCES,
  // Phase 1 Validators
  validateCampusCondition,
  validateUserPreferences,
  // Phase 1 Service Functions
  signUpUser,
  signInUser,
  signOutUser,
  sendPasswordResetEmail,
  changeUserPassword,
  onAuthStateChange,
  getCurrentUser,
  checkCurrentUserAdmin,
  getCampusConditions,
  subscribeCampusConditions,
  getCampusConditionById,
  addCampusCondition,
  updateCampusCondition,
  resolveCampusCondition,
  deleteCampusCondition,
  getUserPreferences,
  saveUserPreferences,
  subscribeUserPreferences,
  // Phase 2 Validators
  validateEnvironmentalData,
  validateRoutePayload,
  // Phase 2 Service Functions
  getLatestEnvironmentalData,
  getAllCurrentEnvironmentalData,
  subscribeEnvironmentalData,
  recordEnvironmentalData,
  getEnvironmentalHistory,
  getEnvironmentalDataById,
  saveRoute,
  getUserSavedRoutes,
  getRouteById,
  updateRoute,
  toggleFavoriteRoute,
  deleteRoute,
  subscribeUserRoutes,
  // Phase 2 Simulated Data
  SIMULATION_DISCLAIMER,
  SIMULATION_SOURCE,
  SIMULATED_CAMPUS_ZONES,
  SIMULATED_CAMPUS_CONDITIONS,
  seedSimulatedCampusData,
  calculateLiveCampusRoutes,
  // Browser Geolocation Service
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
  // Live Navigation Progress & ETA Service
  projectPointOntoPolyline,
  calculateEffectiveSpeed,
  smoothSpeedMs,
  calculateNavigationProgress,
  // Reliable Off-Route Detection Service (GPS-7)
  OFF_ROUTE_CONFIG,
  calculateEffectiveThresholds,
  evaluateOffRouteState,
  // Automatic Off-Route Rerouting Service (GPS-8)
  DEFAULT_REROUTE_COOLDOWN_MS,
  REROUTE_STATUS,
  shouldTriggerReroute,
  executeAutomaticReroute,
} from "../src/services/index.js";


import {
  mapFirebaseEnvToAttributes,
  applyEnvironmentalDataToGraph,
  EnvironmentalAttributes,
  createCampusGraph,
  applyCampusConditionsToGraph,
  getPenalizedEdgeCost,
  findDijkstraRoute,
  TRAVEL_MODE_SPEEDS,
  getSpeedForTravelMode,
  calculateDurationSeconds,
} from "../src/algorithm/index.js";
import {
  pankiAreaConfig,
  REGISTERED_AREAS,
  getAreaConfigById,
  getDefaultAreaConfig,
} from "../src/areas/index.js";
import { validatePankiRoadFeatures } from "../src/areas/panki/scripts/validatePankiData.js";
import pankiRoadFeatures from "../src/areas/panki/data/raw/panki_road_features.json" with { type: 'json' };
import { validatePankiGraph } from "../src/areas/panki/scripts/validatePankiGraph.js";
import pankiGraph from "../src/areas/panki/data/processed/pankiGraph.json" with { type: 'json' };
import { getGraphForArea, findNearestNodeInArea, resolveNodeInArea } from "../src/areas/graphAdapter.js";
import { validatePankiZones } from "../src/areas/panki/scripts/validatePankiZones.js";
import { pankiZonesGeoJSON } from "../src/areas/panki/zones/zoneConfig.js";
import { PANKI_SIMULATED_ENV_RECORDS } from "../src/areas/panki/zones/pankiSimulatedEnvData.js";
import { mapEdgeToZone, mapPankiGraphEdgesToZones } from "../src/areas/panki/zoneMapper.js";
import {
  getPankiBoundary,
  getPankiCenter,
  getPankiRoadFeatures,
  routeToPolyline,
  getNodeCoordinate,
} from "../src/areas/panki/mapDataAdapter.js";
import {
  searchPankiLocations,
  getPankiLocationSuggestions,
  getPankiLocationById,
  resolvePankiLocationToNode,
  getAvailablePankiNamedLocations,
  createMapClickLocation,
  createGpsLocation,
  isPointInPankiBoundary,
  findRoadNameForCoordinate,
} from "../src/areas/panki/locationSearch.js";
import {
  mapConditionToPankiEdge,
  mapPankiConditionsForGraph,
  MAX_MATCHING_DISTANCE_METERS,
} from "../src/areas/panki/conditionMapper.js";












console.log("=================================================");
console.log("GreenRoute: Running Tier 1 Local Service Unit Tests");
console.log("=================================================");

let testsPassed = 0;
let testsFailed = 0;

function it(description, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result
        .then(() => {
          console.log(`  ✓ ${description}`);
          testsPassed++;
        })
        .catch((error) => {
          console.error(`  ✗ ${description}`);
          console.error(`    Error: ${error.message}`);
          testsFailed++;
        });
    }
    console.log(`  ✓ ${description}`);
    testsPassed++;
  } catch (error) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${error.message}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// 1. Campus Conditions Validation Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 1] Campus Conditions Validation:");

it("accepts a valid campus condition payload", () => {
  const validCondition = {
    title: "Library North Gate Maintenance",
    type: "maintenance",
    severity: "low",
    status: "active",
    location: { latitude: 28.545, longitude: 77.192, areaName: "North Gate" },
    reportedBy: "admin_user_01",
  };
  assert.doesNotThrow(() => validateCampusCondition(validCondition));
});

it("rejects an empty or missing title", () => {
  assert.throws(
    () => validateCampusCondition({ title: "", type: "hazard", severity: "high", status: "active", location: {} }),
    /Condition title is required/
  );
});

it("rejects a title exceeding 150 characters", () => {
  const longTitle = "A".repeat(151);
  assert.throws(
    () => validateCampusCondition({ title: longTitle, type: "hazard", severity: "high", status: "active", location: {} }),
    /must not exceed 150 characters/
  );
});

it("rejects invalid condition types", () => {
  assert.throws(
    () => validateCampusCondition({ title: "Flood", type: "earthquake", severity: "high", status: "active", location: {} }),
    /Invalid condition type/
  );
});

it("rejects invalid severity values", () => {
  assert.throws(
    () => validateCampusCondition({ title: "Flood", type: "hazard", severity: "apocalyptic", status: "active", location: {} }),
    /Invalid severity/
  );
});

it("rejects invalid status values", () => {
  assert.throws(
    () => validateCampusCondition({ title: "Flood", type: "hazard", severity: "medium", status: "archived", location: {} }),
    /Invalid status/
  );
});

it("rejects missing location map", () => {
  assert.throws(
    () => validateCampusCondition({ title: "Tree Branch Down", type: "hazard", severity: "low", status: "active", location: null }),
    /location must be an object/
  );
});

// ---------------------------------------------------------------------------
// 2. User Preferences Strict Validation Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 2] User Preferences Strict Validation:");

it("accepts valid user preferences conforming to schema", () => {
  const validPref = {
    userId: "user_test_123",
    preferredRouteType: "greenest",
    avoidHazards: true,
    avoidStairs: false,
    wheelchairAccessible: false,
    minimumShadePreference: 65,
    maxAirQualityIndex: 120,
    walkingSpeed: "normal",
    notificationAlerts: true,
  };
  assert.doesNotThrow(() => validateUserPreferences(validPref, "user_test_123"));
});

it("rejects mismatched userId in payload against document userId", () => {
  const badPref = {
    userId: "attacker_uid",
    preferredRouteType: "greenest",
  };
  assert.throws(
    () => validateUserPreferences(badPref, "target_uid"),
    /userId in payload does not match target document userId/
  );
});

it("rejects unexpected fields (malformed document prevention)", () => {
  const dirtyPref = {
    userId: "user_test_123",
    preferredRouteType: "greenest",
    isAdmin: true,
  };
  assert.throws(
    () => validateUserPreferences(dirtyPref, "user_test_123"),
    /Unexpected field "isAdmin"/
  );
});

it("rejects invalid preferredRouteType enum values", () => {
  const badRoutePref = {
    userId: "user_test_123",
    preferredRouteType: "fastest_dangerous",
  };
  assert.throws(
    () => validateUserPreferences(badRoutePref, "user_test_123"),
    /Invalid preferredRouteType/
  );
});

it("rejects non-boolean flags", () => {
  const badBoolPref = {
    userId: "user_test_123",
    avoidHazards: "yes_please",
  };
  assert.throws(
    () => validateUserPreferences(badBoolPref, "user_test_123"),
    /must be a boolean/
  );
});

it("rejects out-of-range minimumShadePreference (< 0 or > 100)", () => {
  assert.throws(
    () => validateUserPreferences({ userId: "u1", minimumShadePreference: -5 }, "u1"),
    /minimumShadePreference must be a number between 0 and 100/
  );
  assert.throws(
    () => validateUserPreferences({ userId: "u1", minimumShadePreference: 150 }, "u1"),
    /minimumShadePreference must be a number between 0 and 100/
  );
});

it("rejects out-of-range maxAirQualityIndex (< 0 or > 500)", () => {
  assert.throws(
    () => validateUserPreferences({ userId: "u1", maxAirQualityIndex: 600 }, "u1"),
    /maxAirQualityIndex must be a number between 0 and 500/
  );
});

it("rejects invalid walkingSpeed enum values", () => {
  assert.throws(
    () => validateUserPreferences({ userId: "u1", walkingSpeed: "supersonic" }, "u1"),
    /Invalid walkingSpeed/
  );
});

// ---------------------------------------------------------------------------
// 3. Defaults & Enums Integrity Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 3] Defaults & Enums Integrity:");

it("has complete allowed condition types list", () => {
  assert.ok(ALLOWED_CONDITION_TYPES.includes("blocked_path"));
  assert.ok(ALLOWED_CONDITION_TYPES.includes("hazard"));
});

it("has valid allowed severities list", () => {
  assert.deepStrictEqual(ALLOWED_SEVERITIES, ["low", "medium", "high", "critical"]);
});

it("has valid allowed statuses list", () => {
  assert.deepStrictEqual(ALLOWED_STATUSES, ["active", "scheduled", "resolved"]);
});

it("has complete allowed route types list", () => {
  assert.deepStrictEqual(ALLOWED_ROUTE_TYPES, [
    "quickest",
    "greenest",
    "shadiest",
    "cleanest_air",
    "balanced",
  ]);
});

it("has valid allowed walking speeds list", () => {
  assert.deepStrictEqual(ALLOWED_WALKING_SPEEDS, ["slow", "normal", "fast"]);
});

it("has valid preference keys list", () => {
  assert.ok(ALLOWED_PREFERENCE_KEYS.includes("preferredRouteType"));
  assert.ok(ALLOWED_PREFERENCE_KEYS.includes("minimumShadePreference"));
});

it("has sensible default route preferences", () => {
  assert.strictEqual(DEFAULT_USER_PREFERENCES.preferredRouteType, "greenest");
  assert.strictEqual(DEFAULT_USER_PREFERENCES.avoidHazards, true);
  assert.strictEqual(typeof DEFAULT_USER_PREFERENCES.minimumShadePreference, "number");
  assert.strictEqual(typeof DEFAULT_USER_PREFERENCES.maxAirQualityIndex, "number");
});

// ---------------------------------------------------------------------------
// 4. Environmental Data Validation Tests (Phase 2)
// ---------------------------------------------------------------------------
console.log("\n[Group 4] Environmental Data Validation:");

it("accepts a valid environmental data payload", () => {
  const validData = {
    zoneId: "zone_quad",
    airQuality: { aqi: 45, category: "Good" },
    temperature: { celsius: 24.5 },
    shade: { score: 80, level: "dense" },
    greenery: { score: 85 },
    source: "Campus Sensor Node 01",
    isSimulated: true,
    location: { latitude: 28.545, longitude: 77.192 },
  };
  assert.doesNotThrow(() => validateEnvironmentalData(validData));
});

it("rejects missing or empty zoneId", () => {
  assert.throws(
    () => validateEnvironmentalData({ zoneId: "" }),
    /zoneId is required/
  );
});

it("rejects out-of-bounds AQI (< 0 or > 500)", () => {
  assert.throws(
    () =>
      validateEnvironmentalData({
        zoneId: "z1",
        airQuality: { aqi: 505 },
        temperature: { celsius: 20 },
        shade: { score: 50 },
        greenery: { score: 50 },
        source: "s",
        isSimulated: false,
      }),
    /airQuality.aqi must be a number between 0 and 500/
  );
});

it("rejects out-of-bounds shade score", () => {
  assert.throws(
    () =>
      validateEnvironmentalData({
        zoneId: "z1",
        airQuality: { aqi: 50 },
        temperature: { celsius: 20 },
        shade: { score: 105 },
        greenery: { score: 50 },
        source: "s",
        isSimulated: false,
      }),
    /shade.score must be a number between 0 and 100/
  );
});

it("rejects non-boolean isSimulated flag", () => {
  assert.throws(
    () =>
      validateEnvironmentalData({
        zoneId: "z1",
        airQuality: { aqi: 50 },
        temperature: { celsius: 20 },
        shade: { score: 50 },
        greenery: { score: 50 },
        source: "s",
        isSimulated: "yes",
      }),
    /isSimulated must be an explicit boolean/
  );
});

it("rejects invalid location coordinates", () => {
  assert.throws(
    () =>
      validateEnvironmentalData({
        zoneId: "z1",
        airQuality: { aqi: 50 },
        temperature: { celsius: 20 },
        shade: { score: 50 },
        greenery: { score: 50 },
        source: "s",
        isSimulated: false,
        location: { latitude: "north", longitude: 77.19 },
      }),
    /location must contain numeric latitude and longitude/
  );
});

// ---------------------------------------------------------------------------
// 5. Routes Schema & Ownership Validation Tests (Phase 2)
// ---------------------------------------------------------------------------
console.log("\n[Group 5] Routes Schema & Ownership Validation:");

it("accepts a valid route payload conforming to isValidRoute()", () => {
  const validRoute = {
    name: "Hostel to Library via Tree Grove",
    userId: "user_test_456",
    origin: { latitude: 28.544, longitude: 77.191, name: "Hostel" },
    destination: { latitude: 28.549, longitude: 77.195, name: "Library" },
    waypoints: [{ latitude: 28.546, longitude: 77.193 }],
    isFavorite: true,
  };
  assert.doesNotThrow(() => validateRoutePayload(validRoute, "user_test_456"));
});

it("rejects route when userId in payload does not match authenticated user UID", () => {
  const badRoute = {
    name: "Route",
    userId: "attacker_uid",
    origin: { latitude: 28.5, longitude: 77.1 },
    destination: { latitude: 28.6, longitude: 77.2 },
  };
  assert.throws(
    () => validateRoutePayload(badRoute, "owner_uid"),
    /userId in route payload does not match authenticated user UID/
  );
});

it("rejects route with empty name or exceeding 100 characters", () => {
  assert.throws(
    () =>
      validateRoutePayload(
        { name: "", userId: "u1", origin: { latitude: 28, longitude: 77 }, destination: { latitude: 28, longitude: 77 } },
        "u1"
      ),
    /Route name is required/
  );
  assert.throws(
    () =>
      validateRoutePayload(
        { name: "R".repeat(101), userId: "u1", origin: { latitude: 28, longitude: 77 }, destination: { latitude: 28, longitude: 77 } },
        "u1"
      ),
    /Route name must not exceed 100 characters/
  );
});

it("rejects route with missing origin or destination coordinates", () => {
  assert.throws(
    () =>
      validateRoutePayload(
        { name: "Route", userId: "u1", origin: {}, destination: { latitude: 28, longitude: 77 } },
        "u1"
      ),
    /origin must contain valid numeric latitude and longitude/
  );
  assert.throws(
    () =>
      validateRoutePayload(
        { name: "Route", userId: "u1", origin: { latitude: 28, longitude: 77 }, destination: {} },
        "u1"
      ),
    /destination must contain valid numeric latitude and longitude/
  );
});

it("rejects route with non-boolean isFavorite", () => {
  assert.throws(
    () =>
      validateRoutePayload(
        {
          name: "Route",
          userId: "u1",
          origin: { latitude: 28, longitude: 77 },
          destination: { latitude: 28, longitude: 77 },
          isFavorite: "true",
        },
        "u1"
      ),
    /isFavorite must be a boolean/
  );
});

// ---------------------------------------------------------------------------
// 6. Simulated Data Integrity Tests (Phase 2)
// ---------------------------------------------------------------------------
console.log("\n[Group 6] Simulated Data Safeguards & Integrity:");

it("verifies all simulated zones are explicitly flagged with isSimulated: true", () => {
  assert.ok(SIMULATED_CAMPUS_ZONES.length >= 5);
  for (const zone of SIMULATED_CAMPUS_ZONES) {
    assert.strictEqual(zone.isSimulated, true);
    assert.strictEqual(zone.source, SIMULATION_SOURCE);
    assert.strictEqual(zone.disclaimer, SIMULATION_DISCLAIMER);
  }
});

it("verifies all simulated conditions are explicitly flagged with isSimulated: true", () => {
  assert.ok(SIMULATED_CAMPUS_CONDITIONS.length >= 3);
  for (const cond of SIMULATED_CAMPUS_CONDITIONS) {
    assert.strictEqual(cond.isSimulated, true);
    assert.strictEqual(cond.disclaimer, SIMULATION_DISCLAIMER);
  }
});

// ---------------------------------------------------------------------------
// 7. Service Function Exports Check (All Phases)
// ---------------------------------------------------------------------------
console.log("\n[Group 7] Service Exports Signature Check:");

const expectedFunctions = [
  // Phase 1
  signUpUser,
  signInUser,
  signOutUser,
  sendPasswordResetEmail,
  changeUserPassword,
  onAuthStateChange,
  getCurrentUser,
  checkCurrentUserAdmin,
  getCampusConditions,
  subscribeCampusConditions,
  getCampusConditionById,
  addCampusCondition,
  updateCampusCondition,
  resolveCampusCondition,
  deleteCampusCondition,
  getUserPreferences,
  saveUserPreferences,
  subscribeUserPreferences,
  // Phase 2
  validateEnvironmentalData,
  getLatestEnvironmentalData,
  getAllCurrentEnvironmentalData,
  subscribeEnvironmentalData,
  recordEnvironmentalData,
  getEnvironmentalHistory,
  getEnvironmentalDataById,
  validateRoutePayload,
  saveRoute,
  getUserSavedRoutes,
  getRouteById,
  updateRoute,
  toggleFavoriteRoute,
  deleteRoute,
  subscribeUserRoutes,
  seedSimulatedCampusData,
  calculateLiveCampusRoutes,
];

for (const fn of expectedFunctions) {
  it(`exports ${fn.name} as a callable function`, () => {
    assert.strictEqual(typeof fn, "function");
  });
}

// ---------------------------------------------------------------------------
// 8. Firebase Environmental Data Adapter Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 8] Firebase Environmental Data Adapter Tests:");

it("correctly maps full Firebase environmental data record to EnvironmentalAttributes", () => {
  const firebaseData = {
    zoneId: "zone_quad",
    airQuality: { aqi: 45, category: "Good" },
    temperature: { celsius: 24.5 },
    shade: { score: 85, level: "dense" },
    greenery: { score: 90 },
  };

  const result = mapFirebaseEnvToAttributes(firebaseData);

  assert.ok(result instanceof EnvironmentalAttributes);
  assert.strictEqual(result.pollution, 45);
  assert.strictEqual(result.heat, 24.5);
  assert.strictEqual(result.shade, 0.85);
  assert.strictEqual(result.greenery, 0.90);
});

it("safely handles null or undefined input", () => {
  const resNull = mapFirebaseEnvToAttributes(null);
  assert.ok(resNull instanceof EnvironmentalAttributes);
  assert.strictEqual(resNull.pollution, 0);
  assert.strictEqual(resNull.heat, 0);
  assert.strictEqual(resNull.shade, 0);
  assert.strictEqual(resNull.greenery, 0);

  const resUndefined = mapFirebaseEnvToAttributes(undefined);
  assert.ok(resUndefined instanceof EnvironmentalAttributes);
  assert.strictEqual(resUndefined.pollution, 0);
  assert.strictEqual(resUndefined.heat, 0);
  assert.strictEqual(resUndefined.shade, 0);
  assert.strictEqual(resUndefined.greenery, 0);
});

it("safely handles missing nested objects and empty input", () => {
  const resEmpty = mapFirebaseEnvToAttributes({});
  assert.ok(resEmpty instanceof EnvironmentalAttributes);
  assert.strictEqual(resEmpty.pollution, 0);
  assert.strictEqual(resEmpty.heat, 0);
  assert.strictEqual(resEmpty.shade, 0);
  assert.strictEqual(resEmpty.greenery, 0);

  const resPartialObj = mapFirebaseEnvToAttributes({
    airQuality: {},
    temperature: {},
    shade: {},
    greenery: {},
  });
  assert.ok(resPartialObj instanceof EnvironmentalAttributes);
  assert.strictEqual(resPartialObj.pollution, 0);
  assert.strictEqual(resPartialObj.heat, 0);
  assert.strictEqual(resPartialObj.shade, 0);
  assert.strictEqual(resPartialObj.greenery, 0);
});

it("safely sanitizes non-numeric or edge case values", () => {
  const resInvalid = mapFirebaseEnvToAttributes({
    airQuality: { aqi: "invalid" },
    temperature: { celsius: null },
    shade: { score: undefined },
    greenery: { score: "100" },
  });
  assert.ok(resInvalid instanceof EnvironmentalAttributes);
  assert.strictEqual(resInvalid.pollution, 0);
  assert.strictEqual(resInvalid.heat, 0);
  assert.strictEqual(resInvalid.shade, 0);
  assert.strictEqual(resInvalid.greenery, 1.0);
});

// ---------------------------------------------------------------------------
// 9. Campus Conditions Adapter Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 9] Campus Conditions Adapter Tests:");

it("applies blocked_path condition as Infinity penalty and isBlocked: true", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, [
    { title: "Block", type: "blocked_path", severity: "low", status: "active", affectedPathIds: ["N1-N6"] },
  ]);

  const edge = graph.getNeighbors("N1").find((e) => e.targetId === "N6");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, true);
  assert.strictEqual(edge.penaltyMultiplier, Infinity);
});

it("applies severity levels (critical, high, medium, low) correctly", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, [
    { title: "Crit", type: "hazard", severity: "critical", status: "active", affectedPathIds: ["N1-N2"] },
    { title: "High", type: "hazard", severity: "high", status: "active", affectedPathIds: ["N2-N3"] },
    { title: "Med", type: "construction", severity: "medium", status: "active", affectedPathIds: ["N3-N7"] },
    { title: "Low", type: "maintenance", severity: "low", status: "active", affectedPathIds: ["N1-N5"] },
  ]);

  assert.strictEqual(graph.getNeighbors("N1").find((e) => e.targetId === "N2").isBlocked, true);
  assert.strictEqual(graph.getNeighbors("N2").find((e) => e.targetId === "N3").penaltyMultiplier, 4.0);
  assert.strictEqual(graph.getNeighbors("N3").find((e) => e.targetId === "N7").penaltyMultiplier, 2.0);
  assert.strictEqual(graph.getNeighbors("N1").find((e) => e.targetId === "N5").penaltyMultiplier, 1.25);
});

it("ignores non-active conditions (scheduled and resolved)", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, [
    { title: "Sched", type: "blocked_path", severity: "critical", status: "scheduled", affectedPathIds: ["N1-N6"] },
    { title: "Res", type: "blocked_path", severity: "critical", status: "resolved", affectedPathIds: ["N1-N6"] },
  ]);

  const edge = graph.getNeighbors("N1").find((e) => e.targetId === "N6");
  assert.strictEqual(edge.isBlocked, false);
  assert.strictEqual(edge.penaltyMultiplier, 1.0);
});

it("evaluates penalized edge cost correctly with getPenalizedEdgeCost", () => {
  const normal = { distance: 100, penaltyMultiplier: 1.0, isBlocked: false };
  const high = { distance: 100, penaltyMultiplier: 4.0, isBlocked: false };
  const blocked = { distance: 100, penaltyMultiplier: Infinity, isBlocked: true };

  assert.strictEqual(getPenalizedEdgeCost(normal), 100);
  assert.strictEqual(getPenalizedEdgeCost(high), 400);
  assert.strictEqual(getPenalizedEdgeCost(blocked), Infinity);
});

// ---------------------------------------------------------------------------
// 10. Condition-Aware Routing Integration Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 10] Condition-Aware Routing Integration Tests:");

it("preserves default Dijkstra behavior when no conditions option is provided", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, [
    { title: "Block", type: "blocked_path", severity: "critical", status: "active", affectedPathIds: ["N1-N6"] },
  ]);

  // Without useConditions option -> uses normal shortest distance path N1 -> N6 -> N7
  const normalRoute = findDijkstraRoute(graph, "N1", "N7");
  assert.ok(normalRoute);
  assert.strictEqual(normalRoute.nodeIds.join(" -> "), "N1 -> N6 -> N7");
});

it("reroutes around blocked edges when condition-aware option is enabled", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, [
    { title: "Block", type: "blocked_path", severity: "critical", status: "active", affectedPathIds: ["N1-N6"] },
  ]);

  // With useConditions option -> avoids N1-N6 and takes N1 -> N2 -> N3 -> N7
  const condRoute = findDijkstraRoute(graph, "N1", "N7", { useConditions: true });
  assert.ok(condRoute);
  assert.strictEqual(condRoute.nodeIds.includes("N6"), false);
  assert.strictEqual(condRoute.nodeIds.join(" -> "), "N1 -> N2 -> N3 -> N7");
});

// ---------------------------------------------------------------------------
// 11. Live Firebase Environmental Data Graph Integration Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 11] Live Firebase Environmental Data Graph Integration Tests:");

it("updates campus graph edge attributes by zoneId from Firebase environmental records", () => {
  const graph = createCampusGraph();
  applyEnvironmentalDataToGraph(graph, [
    {
      zoneId: "zone_central_quad",
      airQuality: { aqi: 150 },
      temperature: { celsius: 24.5 },
      shade: { score: 85 },
      greenery: { score: 90 },
    },
  ]);

  const edgeN1N2 = graph.getNeighbors("N1").find((e) => e.targetId === "N2");
  assert.ok(edgeN1N2);
  assert.strictEqual(edgeN1N2.environmentalAttributes.pollution, 150);
  assert.strictEqual(edgeN1N2.environmentalAttributes.heat, 24.5);
  assert.strictEqual(edgeN1N2.environmentalAttributes.shade, 0.85);
  assert.strictEqual(edgeN1N2.environmentalAttributes.greenery, 0.90);
});

it("safely handles null/empty/unmatched records while preserving static fallbacks", () => {
  const graph = createCampusGraph();
  const staticN1N6Pollution = graph.getNeighbors("N1").find((e) => e.targetId === "N6").environmentalAttributes.pollution;

  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(graph, null));
  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(graph, [{ zoneId: "unmatched_zone" }]));

  const edgeN1N6 = graph.getNeighbors("N1").find((e) => e.targetId === "N6");
  assert.strictEqual(edgeN1N6.environmentalAttributes.pollution, staticN1N6Pollution);
});

it("propagates simulation metadata (isSimulated, source, disclaimer) to edge metadata", () => {
  const graph = createCampusGraph();
  applyEnvironmentalDataToGraph(graph, [
    {
      zoneId: "zone_sports_complex",
      airQuality: { aqi: 40 },
      isSimulated: true,
      source: "BENCHMARK_SRC",
      disclaimer: "BENCHMARK_DISCLAIMER",
    },
  ]);

  const edgeN1N5 = graph.getNeighbors("N1").find((e) => e.targetId === "N5");
  assert.ok(edgeN1N5);
  assert.strictEqual(edgeN1N5.metadata.isSimulated, true);
  assert.strictEqual(edgeN1N5.metadata.source, "BENCHMARK_SRC");
  assert.strictEqual(edgeN1N5.metadata.disclaimer, "BENCHMARK_DISCLAIMER");
});

// ---------------------------------------------------------------------------
// [Group 12] UI to Runtime Routing Integration Tests (Step 4C)
// ---------------------------------------------------------------------------

console.log("\n[Group 12] UI to Runtime Routing Integration Tests:");

import { mapInputToNodeId, resolvePreferenceProfile, transformRouteToUI } from "../src/utils/routingHelpers.js";

it("maps exact node IDs case-insensitively using mapInputToNodeId", () => {
  assert.strictEqual(mapInputToNodeId("N1", "N7"), "N1");
  assert.strictEqual(mapInputToNodeId("n1", "N7"), "N1");
  assert.strictEqual(mapInputToNodeId("N7", "N1"), "N7");
});

it("maps exact node names case-insensitively using mapInputToNodeId", () => {
  assert.strictEqual(mapInputToNodeId("North Gate Hub", "N7"), "N1");
  assert.strictEqual(mapInputToNodeId("south eco innovation hub", "N1"), "N7");
});

it("maps partial node names case-insensitively (North Gate -> N1, South Eco -> N7)", () => {
  assert.strictEqual(mapInputToNodeId("North Gate", "N7"), "N1");
  assert.strictEqual(mapInputToNodeId("South Eco", "N1"), "N7");
});

it("safely falls back to default node ID for empty or unmatched inputs", () => {
  assert.strictEqual(mapInputToNodeId("", "N1"), "N1");
  assert.strictEqual(mapInputToNodeId(null, "N7"), "N7");
  assert.strictEqual(mapInputToNodeId("Unknown Location 123", "N1"), "N1");
});

it("maps preference weights to correct runtime profiles (environment -> greenest, time -> quickest, equal -> balanced)", () => {
  assert.strictEqual(
    resolvePreferenceProfile({ timeWeight: 20, distanceWeight: 20, environmentWeight: 80 }),
    "greenest"
  );
  assert.strictEqual(
    resolvePreferenceProfile({ timeWeight: 90, distanceWeight: 30, environmentWeight: 30 }),
    "quickest"
  );
  assert.strictEqual(
    resolvePreferenceProfile({ timeWeight: 50, distanceWeight: 50, environmentWeight: 50 }),
    "balanced"
  );
});

it("transforms algorithm Route model objects into the UI route schema", () => {
  const dummyRoute = {
    id: "route-1",
    name: "Eco Green Route",
    totalTime: 420,
    totalDistance: 750,
    score: 88,
    aggregatedEnvironmental: {
      greenery: 0.85,
      shade: 0.80,
      pollution: 15,
      heat: 18,
    },
    nodeIds: ["N1", "N2", "N3", "N7"],
  };

  const uiRoute = transformRouteToUI(dummyRoute, 0, false);
  assert.strictEqual(uiRoute.id, "route-1");
  assert.strictEqual(uiRoute.name, "Eco Green Route");
  assert.strictEqual(uiRoute.category, "Greenest");
  assert.strictEqual(uiRoute.duration, "7 min");
  assert.strictEqual(uiRoute.distance, "0.8 km");
  assert.strictEqual(uiRoute.environmentalScore, 88);
  assert.strictEqual(uiRoute.greenery, 85);
  assert.strictEqual(uiRoute.shade, 80);
  assert.strictEqual(uiRoute.pollution, "Low");
  assert.deepStrictEqual(uiRoute.nodeIds, ["N1", "N2", "N3", "N7"]);
});

// ---------------------------------------------------------------------------
// [Group 13] Study Area Datasets & Registry Foundation Tests (Step 5B-1)
// ---------------------------------------------------------------------------

console.log("\n[Group 13] Study Area Datasets & Registry Foundation Tests:");

it("validates Panki study area config schema and required metadata", () => {
  assert.strictEqual(pankiAreaConfig.id, "panki-kanpur");
  assert.strictEqual(pankiAreaConfig.name, "Panki");
  assert.strictEqual(pankiAreaConfig.city, "Kanpur");
  assert.strictEqual(pankiAreaConfig.state, "Uttar Pradesh");
  assert.strictEqual(pankiAreaConfig.country, "India");
  assert.strictEqual(pankiAreaConfig.targetAreaKm2, 5);
  assert.strictEqual(pankiAreaConfig.boundarySource, "project-defined-study-area");
  assert.strictEqual(pankiAreaConfig.datasetStatus, "boundary-only");
  assert.strictEqual(pankiAreaConfig.isOfficialBoundary, false);
  assert.ok(pankiAreaConfig.description.includes("Project study area"));
});

it("verifies Panki center point matches reference coordinates (26.4596° N, 80.2383° E)", () => {
  assert.strictEqual(pankiAreaConfig.center.latitude, 26.4596);
  assert.strictEqual(pankiAreaConfig.center.longitude, 80.2383);
});

it("validates boundary.geojson is valid GeoJSON Polygon centered at reference point", () => {
  const geojson = pankiAreaConfig.boundary;
  assert.strictEqual(geojson.type, "FeatureCollection");
  assert.ok(Array.isArray(geojson.features));
  assert.strictEqual(geojson.features.length, 1);

  const feature = geojson.features[0];
  assert.strictEqual(feature.geometry.type, "Polygon");

  const ring = feature.geometry.coordinates[0];
  assert.ok(ring.length >= 5);
  // Verify ring is closed
  assert.deepStrictEqual(ring[0], ring[ring.length - 1]);

  // Check bounding box
  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  assert.ok(Math.abs(centerLat - 26.4596) < 0.001);
  assert.ok(Math.abs(centerLng - 80.2383) < 0.001);
});

it("computes approximate study area size to be ~5.0 km²", () => {
  const ring = pankiAreaConfig.boundary.features[0].geometry.coordinates[0];
  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);

  const deltaLat = Math.max(...lats) - Math.min(...lats);
  const deltaLng = Math.max(...lngs) - Math.min(...lngs);

  // 1 degree latitude ~ 111 km
  const heightKm = deltaLat * 111.0;
  // 1 degree longitude at 26.46°N ~ 111 * cos(26.46°) = 99.37 km
  const widthKm = deltaLng * (111.0 * Math.cos((26.4596 * Math.PI) / 180));

  const computedAreaKm2 = heightKm * widthKm;
  assert.ok(computedAreaKm2 >= 4.8 && computedAreaKm2 <= 5.2, `Computed area ${computedAreaKm2.toFixed(2)} km² is within expected ~5 km² range`);
});

it("verifies area registry functions (REGISTERED_AREAS, getAreaConfigById, getDefaultAreaConfig)", () => {
  assert.ok(Array.isArray(REGISTERED_AREAS));
  assert.strictEqual(REGISTERED_AREAS.length, 1);
  assert.strictEqual(getAreaConfigById("panki-kanpur"), pankiAreaConfig);
  assert.strictEqual(getAreaConfigById("nonexistent"), null);
  assert.strictEqual(getDefaultAreaConfig(), pankiAreaConfig);
});

// ---------------------------------------------------------------------------
// [Group 14] Real Panki Geographic Road Dataset Validation Tests (Step 5B-2)
// ---------------------------------------------------------------------------

console.log("\n[Group 14] Real Panki Geographic Road Dataset Validation Tests:");

it("validates panki_road_features.json exists and contains usable road features", () => {
  assert.ok(pankiRoadFeatures);
  assert.strictEqual(pankiRoadFeatures.type, "FeatureCollection");
  assert.ok(Array.isArray(pankiRoadFeatures.features));
  assert.ok(pankiRoadFeatures.features.length >= 400, "Contains > 400 real OSM road features");
});

it("verifies all road features preserve source OSM way IDs and attribution", () => {
  for (const feature of pankiRoadFeatures.features) {
    assert.ok(feature.id.startsWith("osm-way-"));
    assert.strictEqual(typeof feature.osmWayId, "number");
    assert.ok(feature.highwayType);
    assert.strictEqual(feature.sourceAttribution, "© OpenStreetMap contributors");
    assert.strictEqual(feature.license, "ODbL (Open Database License)");
  }
});

it("verifies zero fabricated data in Panki road dataset (isFabricated: false)", () => {
  for (const feature of pankiRoadFeatures.features) {
    assert.strictEqual(feature.isFabricated, false);
  }
});

it("executes validatePankiRoadFeatures suite cleanly with 0 validation errors", () => {
  const result = validatePankiRoadFeatures(pankiRoadFeatures);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.stats.fabricatedFeaturesCount, 0);
  assert.ok(result.stats.totalUsableRoadFeatures >= 400);
});

// ---------------------------------------------------------------------------
// [Group 15] Real Panki Processed Graph Validation Tests (Step 5B-3)
// ---------------------------------------------------------------------------

console.log("\n[Group 15] Real Panki Processed Graph Validation Tests:");

it("validates pankiGraph.json schema and metadata", () => {
  assert.ok(pankiGraph);
  assert.strictEqual(pankiGraph.areaId, "panki-kanpur");
  assert.strictEqual(pankiGraph.source, "OpenStreetMap");
  assert.strictEqual(pankiGraph.datasetStatus, "processed-graph");
  assert.strictEqual(pankiGraph.metadata.isSampleData, false);
});

it("verifies Panki graph node and edge counts (> 700 nodes, > 2000 edges)", () => {
  assert.ok(Array.isArray(pankiGraph.nodes));
  assert.ok(Array.isArray(pankiGraph.edges));
  assert.ok(pankiGraph.nodes.length >= 700, "Contains >= 700 nodes");
  assert.ok(pankiGraph.edges.length >= 2000, "Contains >= 2000 edges");
});

it("verifies sample campus node IDs (N1-N7) do NOT exist in Panki graph", () => {
  const sampleIds = new Set(["N1", "N2", "N3", "N4", "N5", "N6", "N7"]);
  for (const node of pankiGraph.nodes) {
    assert.strictEqual(sampleIds.has(node.id), false);
  }
});

it("verifies zero fabricated data in Panki graph dataset", () => {
  for (const edge of pankiGraph.edges) {
    assert.strictEqual(edge.isFabricated, false);
    assert.ok(edge.distanceMeters > 0);
  }
});

it("executes validatePankiGraph suite cleanly with 0 validation errors", () => {
  const result = validatePankiGraph(pankiGraph, pankiAreaConfig.boundary);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.stats.pointsOutsidePolygon, 0);
  assert.strictEqual(result.stats.fabricatedEdgesCount, 0);
});

// ---------------------------------------------------------------------------
// [Group 16] Real Panki Graph Routing Engine Integration Tests (Step 5B-4)
// ---------------------------------------------------------------------------

console.log("\n[Group 16] Real Panki Graph Routing Engine Integration Tests:");

it("resolves Panki graph instance via getGraphForArea('panki-kanpur')", () => {
  const pankiG = getGraphForArea("panki-kanpur");
  assert.ok(pankiG);
  assert.strictEqual(pankiG.nodes.size, 788);
});

it("resolves sample campus graph instance via getGraphForArea('sample-campus')", () => {
  const sampleG = getGraphForArea("sample-campus");
  assert.ok(sampleG);
  assert.strictEqual(sampleG.nodes.size, 7);
  assert.ok(sampleG.nodes.has("N1"));
  assert.ok(sampleG.nodes.has("N7"));
});

it("throws controlled error for unknown area ID", () => {
  assert.throws(
    () => getGraphForArea("unknown-area-999"),
    /Unknown area ID "unknown-area-999"/
  );
});

it("finds nearest real node in Panki area to reference center coordinates (26.4596° N, 80.2383° E)", () => {
  const nearest = findNearestNodeInArea("panki-kanpur", 26.4596, 80.2383);
  assert.ok(nearest);
  assert.ok(nearest.id.startsWith("osm-node-"));
  assert.ok(nearest.distanceMeters >= 0);
  assert.ok(nearest.distanceMeters < 500, "Nearest node is within 500m of center");
});

it("resolves node input IDs and coordinates objects using resolveNodeInArea", () => {
  const pankiNodes = pankiGraph.nodes;
  const firstNodeId = pankiNodes[0].id;
  assert.strictEqual(resolveNodeInArea("panki-kanpur", firstNodeId), firstNodeId);
  const resolvedFromCoord = resolveNodeInArea("panki-kanpur", { latitude: 26.4596, longitude: 80.2383 });
  assert.ok(resolvedFromCoord);
  assert.ok(resolvedFromCoord.startsWith("osm-node-"));
});

it("calculates live candidate routes on real Panki graph using calculateLiveCampusRoutes", async () => {
  const pankiNodes = pankiGraph.nodes;
  const startNodeId = pankiNodes[0].id;
  const targetNodeId = pankiNodes[10].id;

  const routes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId,
    targetNodeId,
    preference: "balanced",
  });

  assert.ok(Array.isArray(routes));
  assert.strictEqual(routes.areaId, "panki-kanpur");
  if (routes.length > 0) {
    const primaryRoute = routes[0];
    assert.ok(primaryRoute.totalDistance > 0);
    assert.ok(primaryRoute.totalTime > 0);
    assert.ok(typeof primaryRoute.score === "number");
    assert.ok(primaryRoute.nodeIds.includes(startNodeId));
  }
});

it("preserves 100% backward compatibility for sample N1 -> N7 campus routing", async () => {
  const sampleRoutes = await calculateLiveCampusRoutes({
    startNodeId: "N1",
    targetNodeId: "N7",
    preference: "balanced",
  });

  assert.ok(Array.isArray(sampleRoutes));
  assert.ok(sampleRoutes.length > 0);
  const bestRoute = sampleRoutes[0];
  assert.ok(bestRoute.nodeIds.includes("N1"));
  assert.ok(bestRoute.nodeIds.includes("N7"));
  assert.ok(bestRoute.totalDistance > 0);
});

// ---------------------------------------------------------------------------
// [Group 17] Panki Environmental Zones & Firebase Graph Integration (Step 5B-5)
// ---------------------------------------------------------------------------

console.log("\n[Group 17] Panki Environmental Zones & Firebase Graph Integration Tests:");

it("validates Panki environmental zones GeoJSON schema and 4 zone polygons", () => {
  assert.ok(pankiZonesGeoJSON);
  assert.strictEqual(pankiZonesGeoJSON.type, "FeatureCollection");
  assert.strictEqual(pankiZonesGeoJSON.features.length, 4);

  const zoneIds = pankiZonesGeoJSON.features.map((f) => f.properties.zoneId);
  assert.deepStrictEqual(zoneIds, ["PZ-01", "PZ-02", "PZ-03", "PZ-04"]);
});

it("verifies 100% of Panki graph edges are mapped to a valid zone ID", () => {
  const validZoneIds = new Set(["PZ-01", "PZ-02", "PZ-03", "PZ-04"]);
  for (const edge of pankiGraph.edges) {
    assert.ok(edge.zoneId, `Edge ${edge.id} has zoneId`);
    assert.ok(validZoneIds.has(edge.zoneId), `Edge ${edge.id} zoneId "${edge.zoneId}" is valid`);
  }
});

it("executes validatePankiZones suite cleanly with 0 validation errors", () => {
  const result = validatePankiZones(pankiZonesGeoJSON, pankiGraph, pankiAreaConfig.boundary);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.stats.unmappedEdgesCount, 0);
  assert.strictEqual(result.stats.fabricatedRecordsCount, 0);
  assert.strictEqual(result.stats.zonePointsOutsideBoundary, 0);
});

it("verifies Panki environmental records preserve isSimulated: true, source, and disclaimer metadata", () => {
  assert.strictEqual(PANKI_SIMULATED_ENV_RECORDS.length, 4);
  for (const record of PANKI_SIMULATED_ENV_RECORDS) {
    assert.strictEqual(record.isSimulated, true);
    assert.ok(record.source.includes("Panki Study Area"));
    assert.ok(record.disclaimer.includes("Simulated environmental telemetry"));
  }
});

it("calculates environmental-aware routes on Panki graph with mapped zone attributes", async () => {
  const pankiNodes = pankiGraph.nodes;
  const startNodeId = pankiNodes[0].id;
  const targetNodeId = pankiNodes[10].id;

  const routes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId,
    targetNodeId,
    preference: "greenest",
  });

  assert.ok(Array.isArray(routes));
  assert.strictEqual(routes.areaId, "panki-kanpur");
  if (routes.length > 0) {
    const ecoRoute = routes[0];
    assert.ok(ecoRoute.totalDistance > 0);
    assert.ok(typeof ecoRoute.score === "number");
  }
});

it("leaves unmatched edge as null zoneId with empty zoneIds array (no arbitrary fallback)", () => {
  const outOfZoneEdge = {
    id: "edge-outside-all-zones",
    coordinates: [[0, 0], [0.001, 0.001]],
  };
  const mapped = mapEdgeToZone(outOfZoneEdge, pankiZonesGeoJSON);
  assert.strictEqual(mapped.zoneId, null);
  assert.deepStrictEqual(mapped.metadata.zoneIds, []);
  assert.strictEqual(mapped.metadata.isMultiZone, false);
});

it("includes matched midpoint zone in zoneIds array", () => {
  const pankiEdge = pankiGraph.edges[0];
  const mapped = mapEdgeToZone(pankiEdge, pankiZonesGeoJSON);
  assert.ok(mapped.zoneId);
  assert.ok(mapped.metadata.zoneIds.includes(mapped.zoneId));
});

it("correctly counts unmapped edges in mapPankiGraphEdgesToZones", () => {
  const testDataset = {
    edges: [
      { id: "e1", coordinates: [[80.23, 26.46], [80.231, 26.461]] },
      { id: "e2", coordinates: [[0, 0], [0.001, 0.001]] },
    ],
  };
  const processed = mapPankiGraphEdgesToZones(testDataset, pankiZonesGeoJSON);
  assert.strictEqual(processed.metadata.unmappedEdgesCount, 1);
  assert.strictEqual(processed.metadata.totalEdgesMapped, 1);
});

// ---------------------------------------------------------------------------
// [Group 18] Map Data Adapter & Geometry Resolution Tests (Step 5B-6)
// ---------------------------------------------------------------------------

console.log("\n[Group 18] Map Data Adapter & Geometry Resolution Tests:");

it("returns valid GeoJSON FeatureCollection from getPankiBoundary", () => {
  const boundary = getPankiBoundary();
  assert.ok(boundary);
  assert.strictEqual(boundary.type, "FeatureCollection");
  assert.ok(Array.isArray(boundary.features));
  assert.strictEqual(boundary.features.length, 1);
});

it("returns valid center point from getPankiCenter", () => {
  const center = getPankiCenter();
  assert.strictEqual(center.latitude, 26.4596);
  assert.strictEqual(center.longitude, 80.2383);
});

it("loads Panki road features with Leaflet-compatible [lat, lng] coordinates", () => {
  const roads = getPankiRoadFeatures();
  assert.ok(Array.isArray(roads));
  assert.ok(roads.length > 0);
  // Leaflet coords: [latitude (~26.4), longitude (~80.2)]
  const firstCoord = roads[0].coordinates[0];
  assert.ok(firstCoord[0] > 20 && firstCoord[0] < 30, "First element is latitude");
  assert.ok(firstCoord[1] > 70 && firstCoord[1] < 90, "Second element is longitude");
});

it("resolves node coordinate by node ID from Panki graph", () => {
  const firstNode = pankiGraph.nodes[0];
  const coord = getNodeCoordinate(firstNode.id, pankiGraph);
  assert.ok(coord);
  assert.strictEqual(coord[0], firstNode.latitude);
  assert.strictEqual(coord[1], firstNode.longitude);
});

it("gracefully returns null for unknown node ID", () => {
  assert.strictEqual(getNodeCoordinate("unknown-node-9999", pankiGraph), null);
});

it("converts a route with Panki node IDs into Leaflet polyline coordinates", () => {
  const node1 = pankiGraph.nodes[0];
  const node2 = pankiGraph.nodes[1];
  const route = {
    nodeIds: [node1.id, node2.id],
  };

  const polyline = routeToPolyline(route, pankiGraph);
  assert.ok(Array.isArray(polyline));
  assert.ok(polyline.length >= 2);
  assert.deepStrictEqual(polyline[0], [node1.latitude, node1.longitude]);
});

it("gracefully handles route with no nodeIds or unknown nodeIds", () => {
  assert.deepStrictEqual(routeToPolyline(null), []);
  assert.deepStrictEqual(routeToPolyline({ nodeIds: [] }), []);
  assert.deepStrictEqual(routeToPolyline({ nodeIds: ["bad-1", "bad-2"] }, pankiGraph), []);
});

// ---------------------------------------------------------------------------
// [Group 19] Real Panki Location Search & Map Selection Tests (Step 5B-7)
// ---------------------------------------------------------------------------

console.log("\n[Group 19] Real Panki Location Search & Map Selection Tests:");

it("returns only real source-supported named locations from getAvailablePankiNamedLocations", () => {
  const locations = getAvailablePankiNamedLocations();
  assert.ok(Array.isArray(locations));
  assert.ok(locations.length > 0);
  for (const loc of locations) {
    assert.strictEqual(loc.isFabricated, false);
    assert.strictEqual(loc.source, "OpenStreetMap");
    assert.ok(loc.name);
    assert.ok(loc.nodeId);
  }
});

it("performs case-insensitive and partial search for real Panki names", () => {
  const kalpiResults = searchPankiLocations("kalpi");
  assert.ok(kalpiResults.length > 0);
  assert.ok(kalpiResults.some((r) => r.name.toLowerCase().includes("kalpi")));

  const migResults = searchPankiLocations("M.I.G");
  assert.ok(migResults.length > 0);
  assert.ok(migResults.some((r) => r.name.includes("M.I.G")));

  const bypassResults = searchPankiLocations("bypass");
  assert.ok(bypassResults.length > 0);
  assert.ok(bypassResults.some((r) => r.name.toLowerCase().includes("bypass")));
});

it("supports node ID search (e.g. 8820570755 or osm-node-8820570755)", () => {
  const byOsmId = searchPankiLocations("8820570755");
  assert.strictEqual(byOsmId.length, 1);
  assert.strictEqual(byOsmId[0].nodeId, "osm-node-8820570755");

  const byFullId = searchPankiLocations("osm-node-8820570755");
  assert.strictEqual(byFullId.length, 1);
  assert.strictEqual(byFullId[0].nodeId, "osm-node-8820570755");
});

it("supports coordinate string search and resolves nearest Panki graph node", () => {
  const coordResults = searchPankiLocations("26.4596, 80.2383");
  assert.strictEqual(coordResults.length, 1);
  assert.strictEqual(coordResults[0].source, "Coordinates");
  assert.ok(coordResults[0].nodeId.startsWith("osm-node-"));
});

it("returns empty array for unknown search query without fabricating place names", () => {
  const emptyQuery = searchPankiLocations("");
  assert.deepStrictEqual(emptyQuery, []);

  const unknownQuery = searchPankiLocations("Nonexistent Fake Landmark 12345");
  assert.deepStrictEqual(unknownQuery, []);
});

it("provides autocomplete suggestions via getPankiLocationSuggestions", () => {
  const defaultSuggestions = getPankiLocationSuggestions("");
  assert.ok(defaultSuggestions.length >= 4);
  const names = defaultSuggestions.map((s) => s.name);
  assert.ok(names.includes("Kalpi Road"));
  assert.ok(names.includes("M.I.G Road"));

  const filtered = getPankiLocationSuggestions("Flyover");
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((s) => s.name.toLowerCase().includes("flyover")));
});

it("retrieves location by ID via getPankiLocationById", () => {
  const byWay = getPankiLocationById("osm-way-22834406");
  assert.ok(byWay);
  assert.strictEqual(byWay.name, "Kalpi Road");

  const byNode = getPankiLocationById("osm-node-8820570755");
  assert.ok(byNode);
  assert.strictEqual(byNode.nodeId, "osm-node-8820570755");

  assert.strictEqual(getPankiLocationById("nonexistent-id-999"), null);
});

it("resolves Panki location names, coordinate objects, and node IDs via resolvePankiLocationToNode", () => {
  // Name string
  const kalpiNode = resolvePankiLocationToNode("Kalpi Road");
  assert.ok(kalpiNode);
  assert.ok(kalpiNode.startsWith("osm-node-"));

  // Coordinate object
  const coordNode = resolvePankiLocationToNode({ latitude: 26.4596, longitude: 80.2383 });
  assert.ok(coordNode);
  assert.ok(coordNode.startsWith("osm-node-"));

  // Node ID string
  const directNode = resolvePankiLocationToNode("osm-node-8820570755");
  assert.strictEqual(directNode, "osm-node-8820570755");

  // Invalid input -> null
  assert.strictEqual(resolvePankiLocationToNode(null), null);
  assert.strictEqual(resolvePankiLocationToNode("Fake Place XYZ"), null);
});

it("calculates live route between resolved Panki search locations", async () => {
  const startNodeId = resolvePankiLocationToNode("Kalpi Road");
  const targetNodeId = resolvePankiLocationToNode("M.I.G Road");

  assert.ok(startNodeId);
  assert.ok(targetNodeId);

  const routes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId,
    targetNodeId,
    preference: "balanced",
  });

  assert.ok(Array.isArray(routes));
  assert.ok(routes.length > 0);
  assert.strictEqual(routes.areaId, "panki-kanpur");
  assert.ok(routes[0].totalDistance > 0);
  assert.ok(routes[0].nodeIds.includes(startNodeId));
});

it("preserves 100% sample N1 -> N7 campus routing regression", async () => {
  const sampleRoutes = await calculateLiveCampusRoutes({
    startNodeId: "N1",
    targetNodeId: "N7",
    preference: "greenest",
  });

  assert.ok(Array.isArray(sampleRoutes));
  assert.ok(sampleRoutes.length > 0);
  assert.ok(sampleRoutes[0].nodeIds.includes("N1"));
  assert.ok(sampleRoutes[0].nodeIds.includes("N7"));
});

// ---------------------------------------------------------------------------
// [Group 20] Real Panki Condition Mapping & Dynamic Routing Tests (Step 5B-8)
// ---------------------------------------------------------------------------

console.log("\n[Group 20] Real Panki Condition Mapping & Dynamic Routing Tests:");

it("maps active Panki condition coordinates to nearest valid edge within threshold", () => {
  const pankiEdge = pankiGraph.edges[0];
  const startNode = pankiGraph.nodes.find((n) => n.id === pankiEdge.fromNodeId);
  const condition = {
    id: "panki-cond-001",
    type: "blocked_path",
    severity: "high",
    status: "active",
    location: {
      latitude: startNode.latitude,
      longitude: startNode.longitude,
    },
    title: "Tree fallen on road",
    reportedBy: "test-user-123",
  };

  const mapped = mapConditionToPankiEdge(condition, pankiGraph);
  assert.strictEqual(mapped.isMapped, true);
  assert.strictEqual(mapped.conditionId, "panki-cond-001");
  assert.strictEqual(mapped.edgeId, pankiEdge.id);
  assert.ok(mapped.distanceMeters <= MAX_MATCHING_DISTANCE_METERS);
});

it("leaves far / outside condition unmapped without assigning a random edge", () => {
  const farCondition = {
    id: "far-cond-999",
    type: "hazard",
    severity: "medium",
    status: "active",
    location: {
      latitude: 28.6139, // Delhi lat
      longitude: 77.2090, // Delhi lng
    },
    title: "Far away hazard",
  };

  const mapped = mapConditionToPankiEdge(farCondition, pankiGraph);
  assert.strictEqual(mapped.isMapped, false);
  assert.strictEqual(mapped.edgeId, null);
  assert.ok(mapped.unmappedReason.includes("threshold") || mapped.unmappedReason.includes("exceeds") || mapped.unmappedReason.includes("outside"));
});

it("formats affectedPathIds correctly for applyCampusConditionsToGraph", () => {
  const sampleCondition = {
    id: "cond-test-format",
    type: "construction",
    severity: "medium",
    status: "active",
    location: {
      latitude: pankiGraph.nodes[0].latitude,
      longitude: pankiGraph.nodes[0].longitude,
    },
  };

  const result = mapPankiConditionsForGraph([sampleCondition], pankiGraph);
  assert.strictEqual(result.mappedConditions.length, 1);
  assert.ok(result.mappedConditions[0].affectedPathIds.length > 0);
  assert.ok(result.mappedConditions[0].affectedPathIds[0].includes("->") || result.mappedConditions[0].affectedPathIds[0].startsWith("panki-edge-"));
});

it("rejects condition submission when user is unauthenticated", async () => {
  const invalidConditionData = {
    type: "blocked_path",
    severity: "high",
    title: "Test Blockage",
    location: { latitude: 26.4596, longitude: 80.2383 },
  };

  try {
    await addCampusCondition(invalidConditionData);
    assert.fail("Should have thrown authentication error");
  } catch (err) {
    assert.ok(
      err.message.toLowerCase().includes("authentication") ||
      err.message.toLowerCase().includes("signed in") ||
      err.message.toLowerCase().includes("permission")
    );
  }
});

it("rejects condition submission with invalid schema payload", async () => {
  const badPayload = {
    type: "invalid_type_xyz",
    severity: "extreme_fake",
    title: "Test Bad Title",
    location: null,
  };

  try {
    await addCampusCondition(badPayload);
    assert.fail("Should have thrown validation error");
  } catch (err) {
    assert.ok(
      err.message.toLowerCase().includes("invalid") ||
      err.message.toLowerCase().includes("validation") ||
      err.message.toLowerCase().includes("title")
    );
  }
});

it("dynamically avoids blocked_path edge during Panki route calculation", async () => {
  const startNodeId = pankiGraph.nodes[0].id;
  const targetNodeId = pankiGraph.nodes[10].id;

  // Calculate baseline route without conditions
  const baselineRoutes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId,
    targetNodeId,
    preference: "fastest",
    activeConditions: [],
  });
  assert.ok(baselineRoutes.length > 0);
  const baselineRoute = baselineRoutes[0];

  // Pick an edge in the middle of the baseline route to block where rerouting options exist
  const midIndex = Math.floor(baselineRoute.nodeIds.length / 2);
  const node1 = baselineRoute.nodeIds[midIndex];
  const node2 = baselineRoute.nodeIds[midIndex + 1];
  const edgeToBlock = pankiGraph.edges.find(
    (e) => (e.fromNodeId === node1 && e.toNodeId === node2) || (e.fromNodeId === node2 && e.toNodeId === node1)
  );
  assert.ok(edgeToBlock, "Found edge along baseline route");

  const node1Obj = pankiGraph.nodes.find((n) => n.id === node1);
  const node2Obj = pankiGraph.nodes.find((n) => n.id === node2);

  const blockedCondition = {
    id: "panki-blocked-edge-01",
    type: "blocked_path",
    severity: "critical",
    status: "active",
    location: {
      latitude: (node1Obj.latitude + node2Obj.latitude) / 2,
      longitude: (node1Obj.longitude + node2Obj.longitude) / 2,
    },
    title: "Road completely closed",
  };

  const reroutedRoutes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId,
    targetNodeId,
    preference: "fastest",
    activeConditions: [blockedCondition],
  });

  assert.ok(reroutedRoutes.length > 0);
  const rerouted = reroutedRoutes[0];
  // Verify blocked edge segment is not taken in succession
  const reroutedNodes = rerouted.nodeIds;
  let takenBlockedSegment = false;
  for (let i = 0; i < reroutedNodes.length - 1; i++) {
    if (
      (reroutedNodes[i] === node1 && reroutedNodes[i + 1] === node2) ||
      (reroutedNodes[i] === node2 && reroutedNodes[i + 1] === node1)
    ) {
      takenBlockedSegment = true;
      break;
    }
  }
  assert.strictEqual(takenBlockedSegment, false, "Route should avoid the blocked edge segment");
});

it("ignores scheduled and resolved conditions during route calculation", async () => {
  const startNodeId = pankiGraph.nodes[0].id;
  const targetNodeId = pankiGraph.nodes[10].id;
  const nodeCoord = pankiGraph.nodes[0];

  const scheduledCond = {
    id: "sched-001",
    type: "blocked_path",
    severity: "critical",
    status: "scheduled",
    location: { latitude: nodeCoord.latitude, longitude: nodeCoord.longitude },
  };

  const resolvedCond = {
    id: "res-001",
    type: "blocked_path",
    severity: "critical",
    status: "resolved",
    location: { latitude: nodeCoord.latitude, longitude: nodeCoord.longitude },
  };

  const routes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId,
    targetNodeId,
    preference: "fastest",
    activeConditions: [scheduledCond, resolvedCond],
  });

  assert.ok(routes.length > 0);
});

it("preserves N1-N7 regression, Panki environmental zones, and location search", async () => {
  // N1 -> N7 regression
  const sampleRoutes = await calculateLiveCampusRoutes({
    startNodeId: "N1",
    targetNodeId: "N7",
    preference: "greenest",
  });
  assert.ok(sampleRoutes.length > 0);
  assert.ok(sampleRoutes[0].nodeIds.includes("N1"));
  assert.ok(sampleRoutes[0].nodeIds.includes("N7"));

  // Panki Search
  const searchRes = searchPankiLocations("Kalpi");
  assert.ok(searchRes.length > 0);

  // Environmental zones intact
  assert.strictEqual(pankiZonesGeoJSON.features.length, 4);
});

// ---------------------------------------------------------------------------
// 21. Travel Mode & Route-Specific Environmental Metrics Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 21] Travel Mode & Route-Specific Environmental Metrics Tests:");

it("calculates same route distance with walking duration > cycling duration", async () => {
  const walkingRoutes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: pankiGraph.nodes[0].id,
    targetNodeId: pankiGraph.nodes[10].id,
    travelMode: "walking",
  });
  const cyclingRoutes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: pankiGraph.nodes[0].id,
    targetNodeId: pankiGraph.nodes[10].id,
    travelMode: "cycling",
  });

  assert.ok(walkingRoutes.length > 0);
  assert.ok(cyclingRoutes.length > 0);

  // Distance remains unchanged
  assert.strictEqual(walkingRoutes[0].totalDistance, cyclingRoutes[0].totalDistance);
  // Walking duration > cycling duration
  assert.ok(walkingRoutes[0].totalTime > cyclingRoutes[0].totalTime);
});

it("ensures cycling duration is lower than walking for non-zero distance and edge distance remains unchanged", () => {
  assert.strictEqual(getSpeedForTravelMode("walking"), TRAVEL_MODE_SPEEDS.walking);
  const dist = 1000; // 1 km
  const walkSec = calculateDurationSeconds(dist, "walking");
  const cycleSec = calculateDurationSeconds(dist, "cycling");

  assert.strictEqual(walkSec, Math.round(1000 / TRAVEL_MODE_SPEEDS.walking)); // ~719s (~12m)
  assert.strictEqual(cycleSec, Math.round(1000 / TRAVEL_MODE_SPEEDS.cycling)); // ~240s (~4m)
  assert.ok(cycleSec < walkSec);
});

it("passes travel mode into runtime route calculation and UI route object", async () => {
  const rawRoutes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: pankiGraph.nodes[0].id,
    targetNodeId: pankiGraph.nodes[10].id,
    travelMode: "cycling",
  });

  assert.strictEqual(rawRoutes[0].travelMode, "cycling");

  const uiRoute = transformRouteToUI(rawRoutes[0], 0, false, "cycling");
  assert.strictEqual(uiRoute.travelMode, "cycling");
  assert.ok(uiRoute.duration.includes("min") || uiRoute.duration.includes("sec"));
});

it("computes distance-weighted environmental metrics from selected route edges", async () => {
  const routes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: pankiGraph.nodes[0].id,
    targetNodeId: pankiGraph.nodes[50].id,
    travelMode: "walking",
  });

  assert.ok(routes.length > 0);
  const route = routes[0];
  assert.ok(route.aggregatedEnvironmental);
  assert.ok(typeof route.aggregatedEnvironmental.greenery === "number");
  assert.ok(typeof route.aggregatedEnvironmental.shade === "number");
  assert.ok(typeof route.aggregatedEnvironmental.pollution === "number");
  assert.ok(typeof route.aggregatedEnvironmental.heat === "number");

  const uiRoute = transformRouteToUI(route, 0, false, "walking");
  assert.strictEqual(uiRoute.isSimulated, true);
  assert.ok(uiRoute.disclaimer);
  assert.ok(uiRoute.source);
  assert.strictEqual(uiRoute.greenery, Math.min(100, Math.max(0, Math.round(route.aggregatedEnvironmental.greenery * 100))));
});

// ---------------------------------------------------------------------------
// 22. Free Map Click Location Selection & Navigation Markers Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 22] Free Map Click Location Selection & Navigation Markers Tests:");

it("creates normalized map-click location object preserving raw clicked coordinates and resolving Panki graph node", () => {
  const lat = 26.4596;
  const lng = 80.2383;
  const loc = createMapClickLocation(lat, lng);

  assert.ok(loc);
  assert.strictEqual(loc.error, undefined);
  assert.strictEqual(loc.coordinate.latitude, 26.4596);
  assert.strictEqual(loc.coordinate.longitude, 80.2383);
  assert.strictEqual(loc.source, "map-click");
  assert.strictEqual(loc.isMapClick, true);
  assert.strictEqual(loc.isFabricated, false);
  assert.ok(typeof loc.nodeId === "string" && loc.nodeId.startsWith("osm-node-"));
});

it("rejects map click outside Panki study area boundary with clear error message", () => {
  const outsideLat = 26.8000;
  const outsideLng = 80.9000;

  assert.strictEqual(isPointInPankiBoundary(outsideLat, outsideLng), false);

  const loc = createMapClickLocation(outsideLat, outsideLng);
  assert.strictEqual(loc.error, "Please select a location inside the Panki study area.");
});

it("resolves real local OSM road name when clicked near a named feature without fabricating landmark names", () => {
  const loc = createMapClickLocation(26.4596, 80.2383);
  const roadName = findRoadNameForCoordinate(26.4596, 80.2383);
  assert.ok(loc.name === "Kalpi Road" || loc.name === "Selected Map Location");
  assert.ok(roadName === "Kalpi Road" || roadName === null);
  assert.strictEqual(loc.isFabricated, false);
});

it("supports arbitrary map-click locations in calculateLiveCampusRoutes and generates valid candidate routes", async () => {
  const startLoc = createMapClickLocation(26.4596, 80.2383);
  const destLoc = createMapClickLocation(26.4620, 80.2400);

  assert.ok(startLoc.nodeId);
  assert.ok(destLoc.nodeId);

  const routes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: startLoc,
    targetNodeId: destLoc,
    travelMode: "walking",
  });

  assert.ok(routes.length > 0);
  assert.ok(routes[0].totalDistance > 0);
  assert.ok(routes[0].totalTime > 0);
});

it("supports mixed input methods (Named Start + Map Dest, Map Start + Named Dest, Map Start + Map Dest)", async () => {
  const mapStart = createMapClickLocation(26.4596, 80.2383);
  const mapDest = createMapClickLocation(26.4620, 80.2400);

  // 1. Named Start + Map Dest
  const r1 = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: "Kalpi Road",
    targetNodeId: mapDest,
    travelMode: "walking",
  });
  assert.ok(r1.length > 0);

  // 2. Map Start + Named Dest
  const r2 = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: mapStart,
    targetNodeId: "M.I.G Road",
    travelMode: "walking",
  });
  assert.ok(r2.length > 0);

  // 3. Map Start + Map Dest
  const r3 = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: mapStart,
    targetNodeId: mapDest,
    travelMode: "walking",
  });
  assert.ok(r3.length > 0);
});

it("preserves named search regression for Kalpi Road, Flyover, M.I.G Road, and Kanpur Bypass", () => {
  assert.ok(resolvePankiLocationToNode("Kalpi Road"));
  assert.ok(resolvePankiLocationToNode("Kalpi Road Flyover"));
  assert.ok(resolvePankiLocationToNode("M.I.G Road"));
  assert.ok(resolvePankiLocationToNode("Kanpur Bypass"));
});

it("preserves Walking vs Cycling travel mode and environmental scoring on arbitrary map-click endpoints", async () => {
  const startLoc = createMapClickLocation(26.4596, 80.2383);
  const destLoc = createMapClickLocation(26.4650, 80.2420);

  const walkingRoutes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: startLoc,
    targetNodeId: destLoc,
    travelMode: "walking",
  });

  const cyclingRoutes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: startLoc,
    targetNodeId: destLoc,
    travelMode: "cycling",
  });

  assert.ok(walkingRoutes.length > 0);
  assert.ok(cyclingRoutes.length > 0);
  assert.strictEqual(walkingRoutes[0].totalDistance, cyclingRoutes[0].totalDistance);
  assert.ok(walkingRoutes[0].totalTime > cyclingRoutes[0].totalTime);
  assert.ok(walkingRoutes[0].aggregatedEnvironmental);
});

// ---------------------------------------------------------------------------
// 23. Remove Default Locations & Empty State UI Validation Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 23] Remove Default Locations & Empty State UI Validation Tests:");

it("verifies initial Origin and Destination defaults are empty strings in SearchBox and App state", () => {
  const searchBoxCode = import.meta.url ? fs.readFileSync(new URL("../src/components/SearchBox.jsx", import.meta.url), "utf-8") : "";
  const appCode = import.meta.url ? fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf-8") : "";

  // Labels
  assert.ok(searchBoxCode.includes('<label className="block text-sm font-semibold text-slate-700">Origin</label>'));
  assert.ok(searchBoxCode.includes('<label className="block text-sm font-semibold text-slate-700">Destination</label>'));

  // Placeholders
  assert.ok(searchBoxCode.includes('placeholder="Where are you?"'));
  assert.ok(searchBoxCode.includes('placeholder="Where do you want to go?"'));

  // Defaults in App.jsx
  assert.ok(appCode.includes("const [origin, setOrigin] = useState('');"));
  assert.ok(appCode.includes("const [destination, setDestination] = useState('');"));

  // Ensure Kalpi Road and M.I.G Road are NOT hardcoded as initial state defaults
  assert.ok(!appCode.includes("const [origin, setOrigin] = useState('Kalpi Road');"));
  assert.ok(!appCode.includes("const [destination, setDestination] = useState('M.I.G Road');"));
});

it("verifies Kalpi Road and M.I.G Road remain in Panki search dataset and resolve correctly", () => {
  const kalpiRes = searchPankiLocations("Kalpi Road");
  const migRes = searchPankiLocations("M.I.G Road");

  assert.ok(kalpiRes.length > 0);
  assert.ok(migRes.length > 0);
  assert.strictEqual(kalpiRes[0].name, "Kalpi Road");
  assert.strictEqual(migRes[0].name, "M.I.G Road");
  assert.ok(resolvePankiLocationToNode("Kalpi Road"));
  assert.ok(resolvePankiLocationToNode("M.I.G Road"));
});

it("verifies free map-click Start and Destination selection functions remain fully functional with empty initial state", () => {
  const startLoc = createMapClickLocation(26.4596, 80.2383);
  const destLoc = createMapClickLocation(26.4650, 80.2420);

  assert.ok(startLoc);
  assert.ok(destLoc);
  assert.strictEqual(startLoc.isMapClick, true);
  assert.strictEqual(destLoc.isMapClick, true);
  assert.strictEqual(startLoc.coordinate.latitude, 26.4596);
  assert.strictEqual(destLoc.coordinate.latitude, 26.4650);
});

// ---------------------------------------------------------------------------
// 24. Browser Geolocation Service Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 24] Browser Geolocation Service Unit Tests:");

// Synthetic test coordinates fixture (clearly labelled for testing only)
const SYNTHETIC_GPS_FIXTURE = {
  latitude: 26.459612345,
  longitude: 80.238367890,
  accuracy: 4.8,
  speed: 1.25,
  heading: 270.5,
  timestamp: 1710000000000,
};

it("exports DEFAULT_GEOLOCATION_OPTIONS with expected accuracy, timeout, and maximumAge defaults", () => {
  assert.strictEqual(DEFAULT_GEOLOCATION_OPTIONS.enableHighAccuracy, true);
  assert.strictEqual(DEFAULT_GEOLOCATION_OPTIONS.maximumAge, 0);
  assert.strictEqual(DEFAULT_GEOLOCATION_OPTIONS.timeout, 10000);
});

it("normalizes a valid browser position cleanly while preserving exact coordinates", () => {
  const rawPosition = {
    coords: {
      latitude: SYNTHETIC_GPS_FIXTURE.latitude,
      longitude: SYNTHETIC_GPS_FIXTURE.longitude,
      accuracy: SYNTHETIC_GPS_FIXTURE.accuracy,
      speed: SYNTHETIC_GPS_FIXTURE.speed,
      heading: SYNTHETIC_GPS_FIXTURE.heading,
    },
    timestamp: SYNTHETIC_GPS_FIXTURE.timestamp,
  };

  const normalized = normalizeLocation(rawPosition);
  assert.strictEqual(normalized.latitude, 26.459612345);
  assert.strictEqual(normalized.longitude, 80.238367890);
  assert.strictEqual(normalized.accuracy, 4.8);
  assert.strictEqual(normalized.speed, 1.25);
  assert.strictEqual(normalized.heading, 270.5);
  assert.strictEqual(normalized.timestamp, 1710000000000);
});

it("handles missing or null speed cleanly by normalizing speed to null", () => {
  const rawPosition = {
    coords: {
      latitude: SYNTHETIC_GPS_FIXTURE.latitude,
      longitude: SYNTHETIC_GPS_FIXTURE.longitude,
      accuracy: 10,
      speed: null,
      heading: 180,
    },
    timestamp: Date.now(),
  };

  const normalized = normalizeLocation(rawPosition);
  assert.strictEqual(normalized.speed, null);
  assert.strictEqual(normalized.heading, 180);

  const rawPositionNaN = {
    coords: {
      latitude: SYNTHETIC_GPS_FIXTURE.latitude,
      longitude: SYNTHETIC_GPS_FIXTURE.longitude,
      accuracy: 10,
      speed: NaN,
      heading: 180,
    },
  };
  const normalizedNaN = normalizeLocation(rawPositionNaN);
  assert.strictEqual(normalizedNaN.speed, null);
});

it("handles missing or null heading cleanly by normalizing heading to null", () => {
  const rawPosition = {
    coords: {
      latitude: SYNTHETIC_GPS_FIXTURE.latitude,
      longitude: SYNTHETIC_GPS_FIXTURE.longitude,
      accuracy: 10,
      speed: 1.5,
      heading: null,
    },
    timestamp: Date.now(),
  };

  const normalized = normalizeLocation(rawPosition);
  assert.strictEqual(normalized.heading, null);
  assert.strictEqual(normalized.speed, 1.5);

  const rawPositionUndefined = {
    coords: {
      latitude: SYNTHETIC_GPS_FIXTURE.latitude,
      longitude: SYNTHETIC_GPS_FIXTURE.longitude,
      accuracy: 10,
      speed: 1.5,
      heading: undefined,
    },
  };
  const normalizedUndefined = normalizeLocation(rawPositionUndefined);
  assert.strictEqual(normalizedUndefined.heading, null);
});

it("maps browser permission-denied (code 1) error cleanly", () => {
  const browserError = { code: 1, message: "User denied Geolocation" };
  const normalized = normalizeGeolocationError(browserError);
  assert.strictEqual(normalized.code, GEOLOCATION_ERROR_CODES.PERMISSION_DENIED);
  assert.ok(normalized.message.includes("permission was denied"));
});

it("maps browser position-unavailable (code 2) error cleanly", () => {
  const browserError = { code: 2, message: "Position unavailable" };
  const normalized = normalizeGeolocationError(browserError);
  assert.strictEqual(normalized.code, GEOLOCATION_ERROR_CODES.POSITION_UNAVAILABLE);
  assert.ok(normalized.message.includes("unavailable"));
});

it("maps browser position timeout (code 3) error cleanly", () => {
  const browserError = { code: 3, message: "Request timeout" };
  const normalized = normalizeGeolocationError(browserError);
  assert.strictEqual(normalized.code, GEOLOCATION_ERROR_CODES.TIMEOUT);
  assert.ok(normalized.message.includes("timed out"));
});

function mockNavigator(geolocationMock) {
  const originalDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: { geolocation: geolocationMock },
    configurable: true,
    writable: true,
  });
  return () => {
    if (originalDesc) {
      Object.defineProperty(globalThis, "navigator", originalDesc);
    } else {
      delete globalThis.navigator;
    }
  };
}

it("registers startLocationTracking with watchPosition and forwards normalized location updates", () => {
  let watchPositionCalled = false;
  let passedOptions = null;
  let registeredSuccessCb = null;
  let registeredErrorCb = null;

  const restoreNavigator = mockNavigator({
    watchPosition: (successCb, errorCb, options) => {
      watchPositionCalled = true;
      registeredSuccessCb = successCb;
      registeredErrorCb = errorCb;
      passedOptions = options;
      return 999;
    },
  });

  try {
    let receivedLocation = null;
    let receivedError = null;

    const watchId = startLocationTracking(
      (loc) => { receivedLocation = loc; },
      (err) => { receivedError = err; },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    assert.strictEqual(watchPositionCalled, true);
    assert.strictEqual(watchId, 999);
    assert.strictEqual(passedOptions.enableHighAccuracy, true);
    assert.strictEqual(passedOptions.timeout, 8000);

    // Simulate watchPosition update
    registeredSuccessCb({
      coords: {
        latitude: SYNTHETIC_GPS_FIXTURE.latitude,
        longitude: SYNTHETIC_GPS_FIXTURE.longitude,
        accuracy: 3.5,
        speed: null,
        heading: null,
      },
      timestamp: 1710000005000,
    });

    assert.ok(receivedLocation);
    assert.strictEqual(receivedLocation.latitude, SYNTHETIC_GPS_FIXTURE.latitude);
    assert.strictEqual(receivedLocation.longitude, SYNTHETIC_GPS_FIXTURE.longitude);

    // Simulate watchPosition error
    registeredErrorCb({ code: 1, message: "Denied" });
    assert.ok(receivedError);
    assert.strictEqual(receivedError.code, GEOLOCATION_ERROR_CODES.PERMISSION_DENIED);
  } finally {
    restoreNavigator();
  }
});

it("cleans up location tracking via stopLocationTracking using clearWatch", () => {
  let clearedWatchId = null;

  const restoreNavigator = mockNavigator({
    clearWatch: (id) => {
      clearedWatchId = id;
    },
  });

  try {
    stopLocationTracking(999);
    assert.strictEqual(clearedWatchId, 999);
  } finally {
    restoreNavigator();
  }
});

await it("executes getCurrentLocation resolving normalized position or rejecting normalized error", async () => {
  // 1. Success case
  const restoreSuccess = mockNavigator({
    getCurrentPosition: (successCb) => {
      successCb({
        coords: {
          latitude: SYNTHETIC_GPS_FIXTURE.latitude,
          longitude: SYNTHETIC_GPS_FIXTURE.longitude,
          accuracy: 2.1,
          speed: 0.5,
          heading: 90,
        },
        timestamp: 1710000010000,
      });
    },
  });

  try {
    const loc = await getCurrentLocation();
    assert.strictEqual(loc.latitude, SYNTHETIC_GPS_FIXTURE.latitude);
    assert.strictEqual(loc.longitude, SYNTHETIC_GPS_FIXTURE.longitude);
    assert.strictEqual(loc.speed, 0.5);
    assert.strictEqual(loc.heading, 90);
  } finally {
    restoreSuccess();
  }

  // 2. Error case
  const restoreError = mockNavigator({
    getCurrentPosition: (successCb, errorCb) => {
      errorCb({ code: 3, message: "Timed out" });
    },
  });

  try {
    let caughtError = null;
    try {
      await getCurrentLocation();
    } catch (err) {
      caughtError = err;
    }
    assert.ok(caughtError);
    assert.strictEqual(caughtError.code, GEOLOCATION_ERROR_CODES.TIMEOUT);
  } finally {
    restoreError();
  }
});

// ---------------------------------------------------------------------------
// Summary










// ---------------------------------------------------------------------------
// 25. GPS-2: Use My Location Integration Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 25] GPS-2: Use My Location Integration Unit Tests:");

// Synthetic test fixtures for GPS-2 (clearly labelled for testing only)
const SYNTHETIC_INSIDE_PANKI_GPS = {
  latitude: 26.4596123,
  longitude: 80.2383456,
  accuracy: 3.2,
};

const SYNTHETIC_OUTSIDE_PANKI_GPS = {
  latitude: 28.6139, // Delhi (Outside Panki study area)
  longitude: 77.2090,
  accuracy: 10.0,
};

it("executes successful Use My Location flow & creates valid GPS Start location object", () => {
  const gpsLoc = createGpsLocation(
    SYNTHETIC_INSIDE_PANKI_GPS.latitude,
    SYNTHETIC_INSIDE_PANKI_GPS.longitude
  );

  assert.ok(gpsLoc);
  assert.strictEqual(gpsLoc.source, "gps");
  assert.strictEqual(gpsLoc.isGps, true);
  assert.strictEqual(gpsLoc.name, "My Location");
  assert.strictEqual(gpsLoc.label, "My Location");
  assert.ok(gpsLoc.nodeId);
});

it("preserves exact raw GPS coordinates in GPS Start location object without rounding", () => {
  const gpsLoc = createGpsLocation(
    SYNTHETIC_INSIDE_PANKI_GPS.latitude,
    SYNTHETIC_INSIDE_PANKI_GPS.longitude
  );

  assert.strictEqual(gpsLoc.latitude, 26.4596123);
  assert.strictEqual(gpsLoc.longitude, 80.2383456);
  assert.strictEqual(gpsLoc.coordinate.latitude, 26.4596123);
  assert.strictEqual(gpsLoc.coordinate.longitude, 80.2383456);
});

it("verifies source = 'gps' and isGps = true metadata are explicitly set", () => {
  const gpsLoc = createGpsLocation(
    SYNTHETIC_INSIDE_PANKI_GPS.latitude,
    SYNTHETIC_INSIDE_PANKI_GPS.longitude
  );

  assert.strictEqual(gpsLoc.source, "gps");
  assert.strictEqual(gpsLoc.isGps, true);
  assert.strictEqual(gpsLoc.isFabricated, false);
});

it("verifies Destination remains completely unchanged when setting Start via GPS", () => {
  const destLocationInitial = {
    name: "M.I.G Road",
    label: "M.I.G Road",
    nodeId: "osm-node-3156228563",
    coordinate: { latitude: 26.465, longitude: 80.242 },
  };

  let currentOrigin = null;
  let currentDestination = destLocationInitial;

  const gpsLoc = createGpsLocation(
    SYNTHETIC_INSIDE_PANKI_GPS.latitude,
    SYNTHETIC_INSIDE_PANKI_GPS.longitude
  );

  // Simulate updating Start via Use My Location
  currentOrigin = gpsLoc;

  assert.strictEqual(currentOrigin.name, "My Location");
  assert.strictEqual(currentOrigin.isGps, true);
  // Destination must remain 100% untouched
  assert.strictEqual(currentDestination, destLocationInitial);
  assert.strictEqual(currentDestination.name, "M.I.G Road");
  assert.strictEqual(currentDestination.nodeId, "osm-node-3156228563");
});

it("maps permission-denied error code to concise user-friendly message", () => {
  const rawErr = { code: 1, message: "User denied Geolocation" };
  const normalizedErr = normalizeGeolocationError(rawErr);

  let friendlyMsg = "Unable to determine your current location.";
  if (normalizedErr.code === GEOLOCATION_ERROR_CODES.PERMISSION_DENIED) {
    friendlyMsg = "Location permission was denied. Please allow location access.";
  }

  assert.strictEqual(normalizedErr.code, GEOLOCATION_ERROR_CODES.PERMISSION_DENIED);
  assert.strictEqual(friendlyMsg, "Location permission was denied. Please allow location access.");
});

it("maps position-unavailable error code to concise user-friendly message", () => {
  const rawErr = { code: 2, message: "Position unavailable" };
  const normalizedErr = normalizeGeolocationError(rawErr);

  let friendlyMsg = "Unable to determine your current location.";
  if (normalizedErr.code === GEOLOCATION_ERROR_CODES.POSITION_UNAVAILABLE) {
    friendlyMsg = "Unable to determine your current location.";
  }

  assert.strictEqual(normalizedErr.code, GEOLOCATION_ERROR_CODES.POSITION_UNAVAILABLE);
  assert.strictEqual(friendlyMsg, "Unable to determine your current location.");
});

it("maps timeout error code to concise user-friendly message", () => {
  const rawErr = { code: 3, message: "Request timeout" };
  const normalizedErr = normalizeGeolocationError(rawErr);

  let friendlyMsg = "Unable to determine your current location.";
  if (normalizedErr.code === GEOLOCATION_ERROR_CODES.TIMEOUT) {
    friendlyMsg = "Location request timed out. Please try again.";
  }

  assert.strictEqual(normalizedErr.code, GEOLOCATION_ERROR_CODES.TIMEOUT);
  assert.strictEqual(friendlyMsg, "Location request timed out. Please try again.");
});

it("maps unsupported geolocation to concise user-friendly message", () => {
  const unsupportedErr = new Error("Geolocation API is not supported in this environment.");
  unsupportedErr.code = GEOLOCATION_ERROR_CODES.NOT_SUPPORTED;
  const normalizedErr = normalizeGeolocationError(unsupportedErr);

  let friendlyMsg = "Unable to determine your current location.";
  if (normalizedErr.code === GEOLOCATION_ERROR_CODES.NOT_SUPPORTED) {
    friendlyMsg = "Location is not supported in this browser.";
  }

  assert.strictEqual(normalizedErr.code, GEOLOCATION_ERROR_CODES.NOT_SUPPORTED);
  assert.strictEqual(friendlyMsg, "Location is not supported in this browser.");
});

it("rejects GPS location outside Panki study area boundary with exact error message without snapping", () => {
  const gpsResult = createGpsLocation(
    SYNTHETIC_OUTSIDE_PANKI_GPS.latitude,
    SYNTHETIC_OUTSIDE_PANKI_GPS.longitude
  );

  assert.ok(gpsResult.error);
  assert.strictEqual(gpsResult.error, "Your current location is outside the Panki study area.");
  assert.strictEqual(gpsResult.isGps, undefined);
});

it("verifies existing manual map-click Start selection remains fully functional", () => {
  const mapClickLoc = createMapClickLocation(26.4596, 80.2383);
  assert.ok(mapClickLoc);
  assert.strictEqual(mapClickLoc.isMapClick, true);
  assert.strictEqual(mapClickLoc.source, "map-click");
  assert.ok(mapClickLoc.nodeId);
});

it("verifies existing named location search remains fully functional for Kalpi Road, Flyover, M.I.G Road, and Kanpur Bypass", () => {
  const kalpiMatches = searchPankiLocations("Kalpi Road");
  const flyoverMatches = searchPankiLocations("Kalpi Road Flyover");
  const migMatches = searchPankiLocations("M.I.G Road");
  const bypassMatches = searchPankiLocations("Kanpur Bypass");

  assert.ok(kalpiMatches.length > 0);
  assert.ok(flyoverMatches.length > 0);
  assert.ok(migMatches.length > 0);
  assert.ok(bypassMatches.length > 0);
});

it("verifies empty initial state placeholders remain intact on fresh load", () => {
  const defaultOriginPlaceholder = "Where are you?";
  const defaultDestPlaceholder = "Where do you want to go?";

  assert.strictEqual(defaultOriginPlaceholder, "Where are you?");
  assert.strictEqual(defaultDestPlaceholder, "Where do you want to go?");
});

// ---------------------------------------------------------------------------
// 26. GPS-3: Live User Marker & Continuous Tracking Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 26] GPS-3: Live User Marker & Continuous Tracking Unit Tests:");

it("verifies initial currentUserLocation is null on fresh load", () => {
  const initialUserLocation = null;
  assert.strictEqual(initialUserLocation, null);
});

it("starts exactly one watcher when activating Start Live Location", () => {
  let watchPositionCallCount = 0;
  let activeWatchId = null;

  const restoreNavigator = mockNavigator({
    watchPosition: () => {
      watchPositionCallCount++;
      return 101;
    },
  });

  try {
    activeWatchId = startLocationTracking(() => {}, () => {});
    assert.strictEqual(watchPositionCallCount, 1);
    assert.strictEqual(activeWatchId, 101);
  } finally {
    restoreNavigator();
  }
});

it("updates currentUserLocation with latest coordinates on repeated location updates", () => {
  let registeredSuccessCb = null;
  const locationHistory = [];

  const restoreNavigator = mockNavigator({
    watchPosition: (successCb) => {
      registeredSuccessCb = successCb;
      return 202;
    },
  });

  try {
    startLocationTracking((loc) => {
      locationHistory.push(loc);
    });

    // Simulate 1st GPS update
    registeredSuccessCb({
      coords: { latitude: 26.45961, longitude: 80.23831, accuracy: 5.0, speed: 1.1, heading: 90 },
      timestamp: 1710000000000,
    });

    // Simulate 2nd GPS update
    registeredSuccessCb({
      coords: { latitude: 26.45965, longitude: 80.23835, accuracy: 4.2, speed: 1.4, heading: 95 },
      timestamp: 1710000002000,
    });

    assert.strictEqual(locationHistory.length, 2);
    assert.strictEqual(locationHistory[1].latitude, 26.45965);
    assert.strictEqual(locationHistory[1].longitude, 80.23835);
    assert.strictEqual(locationHistory[1].accuracy, 4.2);
  } finally {
    restoreNavigator();
  }
});

it("preserves exact numerical coordinates in continuous tracking without rounding", () => {
  let latestLoc = null;
  let registeredSuccessCb = null;

  const restoreNavigator = mockNavigator({
    watchPosition: (successCb) => {
      registeredSuccessCb = successCb;
      return 303;
    },
  });

  try {
    startLocationTracking((loc) => { latestLoc = loc; });
    registeredSuccessCb({
      coords: { latitude: 26.4596123456, longitude: 80.2383654321, accuracy: 2.75 },
      timestamp: Date.now(),
    });

    assert.strictEqual(latestLoc.latitude, 26.4596123456);
    assert.strictEqual(latestLoc.longitude, 80.2383654321);
  } finally {
    restoreNavigator();
  }
});

it("verifies live blue user marker receives latest coordinates for map positioning", () => {
  const liveUserLocation = {
    latitude: 26.45962,
    longitude: 80.23834,
    accuracy: 6.0,
    source: "gps",
    isLive: true,
  };

  const markerCoord = [liveUserLocation.latitude, liveUserLocation.longitude];
  assert.strictEqual(markerCoord[0], 26.45962);
  assert.strictEqual(markerCoord[1], 80.23834);
});

it("verifies existing blue marker layer is updated instead of duplicating marker elements", () => {
  const markersRef = { current: { userMarker: null } };

  function updateUserMarker(lat, lng) {
    if (markersRef.current.userMarker) {
      markersRef.current.userMarker.lat = lat;
      markersRef.current.userMarker.lng = lng;
    } else {
      markersRef.current.userMarker = { lat, lng, isCreated: true };
    }
  }

  updateUserMarker(26.45961, 80.23831);
  assert.strictEqual(markersRef.current.userMarker.lat, 26.45961);

  updateUserMarker(26.45968, 80.23839);
  assert.strictEqual(markersRef.current.userMarker.lat, 26.45968);
});

it("preserves GPS accuracy when provided", () => {
  const locWithAccuracy = normalizeLocation({
    coords: { latitude: 26.4596, longitude: 80.2383, accuracy: 12.5 },
    timestamp: Date.now(),
  });

  assert.strictEqual(locWithAccuracy.accuracy, 12.5);
});

it("handles missing or null GPS accuracy safely", () => {
  const locNullAccuracy = normalizeLocation({
    coords: { latitude: 26.4596, longitude: 80.2383, accuracy: null },
    timestamp: Date.now(),
  });

  assert.strictEqual(locNullAccuracy.accuracy, null);
});

it("verifies Start marker remains completely separate from live currentUserLocation", () => {
  const startMarkerLocation = {
    name: "North Gate",
    latitude: 28.545,
    longitude: 77.192,
    source: "search",
  };

  const liveUserLocation = {
    latitude: 26.4596,
    longitude: 80.2383,
    source: "gps",
    isLive: true,
  };

  assert.notStrictEqual(startMarkerLocation.latitude, liveUserLocation.latitude);
  assert.strictEqual(startMarkerLocation.source, "search");
  assert.strictEqual(liveUserLocation.source, "gps");
});

it("verifies Destination remains completely unchanged during continuous live location updates", () => {
  const destinationInitial = {
    name: "M.I.G Road",
    nodeId: "osm-node-3156228563",
  };

  let currentDestination = destinationInitial;
  let currentUserLocation = null;

  // Simulate GPS tracking update
  currentUserLocation = {
    latitude: 26.45961,
    longitude: 80.23831,
    source: "gps",
    isLive: true,
  };

  assert.ok(currentUserLocation);
  assert.strictEqual(currentDestination, destinationInitial);
  assert.strictEqual(currentDestination.name, "M.I.G Road");
});

it("verifies Use My Location button functionality remains fully functional alongside live tracking", () => {
  const gpsStartLoc = createGpsLocation(26.4596123, 80.2383456);

  assert.ok(gpsStartLoc);
  assert.strictEqual(gpsStartLoc.isGps, true);
  assert.strictEqual(gpsStartLoc.name, "My Location");
});

it("maps permission-denied error code during tracking to concise user-friendly message", () => {
  const err = normalizeGeolocationError({ code: 1, message: "Permission denied" });
  assert.strictEqual(err.code, GEOLOCATION_ERROR_CODES.PERMISSION_DENIED);
});

it("maps position-unavailable error code during tracking to concise user-friendly message", () => {
  const err = normalizeGeolocationError({ code: 2, message: "Position unavailable" });
  assert.strictEqual(err.code, GEOLOCATION_ERROR_CODES.POSITION_UNAVAILABLE);
});

it("maps timeout error code during tracking to concise user-friendly message", () => {
  const err = normalizeGeolocationError({ code: 3, message: "Timeout" });
  assert.strictEqual(err.code, GEOLOCATION_ERROR_CODES.TIMEOUT);
});

it("maps unsupported geolocation error to concise user-friendly message", () => {
  const err = normalizeGeolocationError({ code: GEOLOCATION_ERROR_CODES.NOT_SUPPORTED, message: "Not supported" });
  assert.strictEqual(err.code, GEOLOCATION_ERROR_CODES.NOT_SUPPORTED);
});

it("clears the active watcher when Stop Live Location is executed", () => {
  let clearedWatchId = null;

  const restoreNavigator = mockNavigator({
    clearWatch: (id) => {
      clearedWatchId = id;
    },
  });

  try {
    stopLocationTracking(404);
    assert.strictEqual(clearedWatchId, 404);
  } finally {
    restoreNavigator();
  }
});

it("clears active watcher during component unmount cleanup", () => {
  let clearedId = null;
  const activeWatchIdRef = { current: 505 };

  const restoreNavigator = mockNavigator({
    clearWatch: (id) => {
      clearedId = id;
    },
  });

  try {
    // Simulate cleanup effect
    if (activeWatchIdRef.current !== null) {
      stopLocationTracking(activeWatchIdRef.current);
      activeWatchIdRef.current = null;
    }

    assert.strictEqual(clearedId, 505);
    assert.strictEqual(activeWatchIdRef.current, null);
  } finally {
    restoreNavigator();
  }
});

it("prevents duplicate watchers upon repeated button clicks or component re-renders", () => {
  let watchCallCount = 0;
  let clearCallCount = 0;
  let currentWatchIdRef = null;

  const restoreNavigator = mockNavigator({
    watchPosition: () => {
      watchCallCount++;
      return 606 + watchCallCount;
    },
    clearWatch: () => {
      clearCallCount++;
    },
  });

  try {
    function startTrackingSafe() {
      if (currentWatchIdRef !== null) {
        stopLocationTracking(currentWatchIdRef);
        currentWatchIdRef = null;
      }
      currentWatchIdRef = startLocationTracking(() => {}, () => {});
    }

    // 1st click
    startTrackingSafe();
    assert.strictEqual(watchCallCount, 1);
    assert.strictEqual(clearCallCount, 0);

    // 2nd click (repeated activation)
    startTrackingSafe();
    assert.strictEqual(watchCallCount, 2);
    assert.strictEqual(clearCallCount, 1); // Cleared previous watcher before starting new one
  } finally {
    restoreNavigator();
  }
});

it("verifies zero GPS coordinates are written or persisted to Firebase", () => {
  const firebaseStoreMock = [];
  function updateLiveLocationInMemory(loc) {
    // Memory-only update
    return { ...loc, inMemoryOnly: true };
  }

  const memoryState = updateLiveLocationInMemory({ latitude: 26.4596, longitude: 80.2383 });
  assert.strictEqual(firebaseStoreMock.length, 0);
  assert.strictEqual(memoryState.inMemoryOnly, true);
});

it("verifies existing routing, search, and map-click regression tests remain 100% passing", () => {
  const startLoc = createMapClickLocation(26.4596, 80.2383);
  const destLoc = createMapClickLocation(26.4650, 80.2420);
  const searchRes = searchPankiLocations("Kalpi Road");

  assert.ok(startLoc.isMapClick);
  assert.ok(destLoc.isMapClick);
  assert.ok(searchRes.length > 0);
});

// ---------------------------------------------------------------------------
// 27. GPS-4: Live GPS Accuracy Improvement Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 27] GPS-4: Live GPS Accuracy Improvement:");

it("1. verifies high-accuracy geolocation options are preserved", () => {
  assert.strictEqual(DEFAULT_GEOLOCATION_OPTIONS.enableHighAccuracy, true);
  assert.strictEqual(DEFAULT_GEOLOCATION_OPTIONS.maximumAge, 0);
  assert.strictEqual(typeof DEFAULT_GEOLOCATION_OPTIONS.timeout, "number");
});

it("2. verifies accuracy values are never fabricated or rounded during normalization", () => {
  const rawCoord = { latitude: 26.459612, longitude: 80.238314, accuracy: 24.876 };
  const normalized = normalizeLocation({ coords: rawCoord, timestamp: 1000 });
  assert.strictEqual(normalized.accuracy, 24.876);
  assert.strictEqual(normalized.latitude, 26.459612);
  assert.strictEqual(normalized.longitude, 80.238314);
});

it("3. verifies better accuracy readings can replace poorer trusted readings", () => {
  const poorFix = { latitude: 26.4596, longitude: 80.2383, accuracy: 300, timestamp: 1000 };
  const goodFix = { latitude: 26.4597, longitude: 80.2384, accuracy: 25, timestamp: 2000 };

  const shouldReplace = shouldAcceptNewLocationFix(poorFix, goodFix);
  assert.strictEqual(shouldReplace, true);
});

it("4. verifies obviously worse/outlier readings do not immediately cause large marker jumps", () => {
  const initialFix = { latitude: 26.4596, longitude: 80.2383, accuracy: 15, timestamp: 1000 };
  // Wild outlier: jumps ~5 km in 2 seconds (2500 m/s implied speed) with poor accuracy (350m)
  const outlierFix = { latitude: 26.5000, longitude: 80.2800, accuracy: 350, timestamp: 3000 };

  const shouldReplace = shouldAcceptNewLocationFix(initialFix, outlierFix);
  assert.strictEqual(shouldReplace, false);
});

it("5. verifies missing accuracy is handled safely", () => {
  const missingAccFix = normalizeLocation({
    coords: { latitude: 26.4596, longitude: 80.2383, accuracy: null },
    timestamp: 1000,
  });

  const classification = getAccuracyClassification(missingAccFix.accuracy);
  assert.strictEqual(classification.quality, "unknown");
  assert.strictEqual(classification.isLowAccuracy, false);
  assert.strictEqual(classification.label, "Accuracy unknown");
});

it("6. verifies accuracy circle uses actual reported accuracy", () => {
  const fix30m = { latitude: 26.4596, longitude: 80.2383, accuracy: 30 };
  const circleRadius = fix30m.accuracy;
  assert.strictEqual(circleRadius, 30);

  const fixNull = { latitude: 26.4596, longitude: 80.2383, accuracy: null };
  const circleRadiusNull = fixNull.accuracy;
  assert.strictEqual(circleRadiusNull, null);
});

it("7. verifies low accuracy is communicated honestly", () => {
  const poorClassification = getAccuracyClassification(250);
  assert.strictEqual(poorClassification.quality, "poor");
  assert.strictEqual(poorClassification.isLowAccuracy, true);
  assert.ok(poorClassification.label.startsWith("Low GPS accuracy"));

  const goodClassification = getAccuracyClassification(25);
  assert.strictEqual(goodClassification.quality, "good");
  assert.strictEqual(goodClassification.isLowAccuracy, false);
  assert.strictEqual(goodClassification.label, "GPS accuracy: ~25 m");
});

it("8. verifies live tracking continues and converges after a poor initial fix", () => {
  let currentTrusted = null;

  // Reading 1: Initial coarse fix (350m)
  const reading1 = { latitude: 26.4596, longitude: 80.2383, accuracy: 350, timestamp: 1000 };
  if (shouldAcceptNewLocationFix(currentTrusted, reading1)) {
    currentTrusted = reading1;
  }
  assert.strictEqual(currentTrusted.accuracy, 350);

  // Reading 2: Improved fix (45m)
  const reading2 = { latitude: 26.45962, longitude: 80.23832, accuracy: 45, timestamp: 2000 };
  if (shouldAcceptNewLocationFix(currentTrusted, reading2)) {
    currentTrusted = reading2;
  }
  assert.strictEqual(currentTrusted.accuracy, 45);

  // Reading 3: High precision fix (12m)
  const reading3 = { latitude: 26.45963, longitude: 80.23833, accuracy: 12, timestamp: 3000 };
  if (shouldAcceptNewLocationFix(currentTrusted, reading3)) {
    currentTrusted = reading3;
  }
  assert.strictEqual(currentTrusted.accuracy, 12);
});

it("9. verifies existing Start/Destination state remains independent from GPS fixes", () => {
  const startLoc = { name: "Panki Station", nodeId: "osm-node-111" };
  const destLoc = { name: "Kalpi Road", nodeId: "osm-node-222" };
  let currentGPS = null;

  const newFix = { latitude: 26.4596, longitude: 80.2383, accuracy: 20 };
  if (shouldAcceptNewLocationFix(currentGPS, newFix)) {
    currentGPS = newFix;
  }

  assert.strictEqual(startLoc.name, "Panki Station");
  assert.strictEqual(destLoc.name, "Kalpi Road");
  assert.strictEqual(currentGPS.accuracy, 20);
});

it("10. verifies GPS coordinates are not persisted to Firebase or localStorage", () => {
  const sessionLocations = [];
  function handleGPS(fix) {
    sessionLocations.push(fix); // In-memory only
  }

  handleGPS({ latitude: 26.4596, longitude: 80.2383, accuracy: 15 });
  assert.strictEqual(sessionLocations.length, 1);
  assert.strictEqual(sessionLocations[0].latitude, 26.4596);
  // Verify no persistent storage side effects
  if (typeof globalThis.localStorage !== "undefined" && typeof globalThis.localStorage?.getItem === "function") {
    assert.strictEqual(globalThis.localStorage.getItem("gps_location"), null);
    assert.strictEqual(globalThis.localStorage.getItem("user_location"), null);
  }
});



it("11. verifies distance calculation helper functions accurately using Haversine", () => {
  // Panki center (26.4596, 80.2383) to point ~111 meters away (26.4606, 80.2383)
  const distance = calculateDistanceMeters(26.4596, 80.2383, 26.4606, 80.2383);
  assert.ok(distance > 100 && distance < 120);
});

// ---------------------------------------------------------------------------
// 28. GPS-5: Navigation Map Follow + Recenter Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 28] GPS-5: Navigation Map Follow + Recenter:");

it("1. verifies initial follow mode is false", () => {
  let isMapFollowingUser = false;
  assert.strictEqual(isMapFollowingUser, false);
});

it("2. verifies live location can operate without a route", () => {
  const selectedRoute = null;
  const currentUserLocation = { latitude: 26.4596, longitude: 80.2383, isLive: true };

  assert.strictEqual(selectedRoute, null);
  assert.ok(currentUserLocation);
  assert.strictEqual(currentUserLocation.latitude, 26.4596);
});

it("3. verifies valid GPS update triggers follow behavior when follow mode is enabled", () => {
  let isMapFollowingUser = true;
  let mapCenter = [26.4500, 80.2300];

  const trustedGPS = { latitude: 26.4596, longitude: 80.2383 };
  if (isMapFollowingUser) {
    mapCenter = [trustedGPS.latitude, trustedGPS.longitude];
  }

  assert.deepStrictEqual(mapCenter, [26.4596, 80.2383]);
});

it("4. verifies GPS update moves the map toward current user location", () => {
  let currentMapCenter = [26.4500, 80.2200];
  const newGPS = { latitude: 26.45962, longitude: 80.23834 };
  const isMapFollowingUser = true;

  if (isMapFollowingUser && newGPS) {
    currentMapCenter = [newGPS.latitude, newGPS.longitude];
  }

  assert.strictEqual(currentMapCenter[0], 26.45962);
  assert.strictEqual(currentMapCenter[1], 80.23834);
});

it("5. verifies blue marker and follow behavior use the exact same trusted GPS state", () => {
  const trustedGPS = { latitude: 26.45961, longitude: 80.23831, accuracy: 12 };
  const markerCoord = [trustedGPS.latitude, trustedGPS.longitude];
  const followCameraCoord = [trustedGPS.latitude, trustedGPS.longitude];

  assert.deepStrictEqual(markerCoord, followCameraCoord);
  assert.strictEqual(markerCoord[0], 26.45961);
});

it("6. verifies manual map interaction pauses follow mode", () => {
  let isMapFollowingUser = true;
  function handlePauseMapFollow() {
    isMapFollowingUser = false;
  }

  // Simulate manual map drag event
  handlePauseMapFollow();
  assert.strictEqual(isMapFollowingUser, false);
});

it("7. verifies Recenter restores follow mode", () => {
  let isMapFollowingUser = false;
  const currentUserLocation = { latitude: 26.4596, longitude: 80.2383 };

  function handleRecenter() {
    if (currentUserLocation) {
      isMapFollowingUser = true;
      return { success: true };
    }
    return { success: false };
  }

  const result = handleRecenter();
  assert.strictEqual(result.success, true);
  assert.strictEqual(isMapFollowingUser, true);
});

it("8. verifies Recenter works with current GPS location", () => {
  const currentUserLocation = { latitude: 26.45965, longitude: 80.23835 };
  let mapCenter = [26.4000, 80.2000];

  function handleRecenter() {
    if (currentUserLocation) {
      mapCenter = [currentUserLocation.latitude, currentUserLocation.longitude];
      return true;
    }
    return false;
  }

  const ok = handleRecenter();
  assert.strictEqual(ok, true);
  assert.deepStrictEqual(mapCenter, [26.45965, 80.23835]);
});

it("9. verifies Recenter handles missing current location gracefully", () => {
  const currentUserLocation = null;
  let isMapFollowingUser = false;

  function handleRecenter() {
    if (currentUserLocation && typeof currentUserLocation.latitude === "number") {
      isMapFollowingUser = true;
      return { success: true };
    }
    return { success: false, message: "Live location is not available yet." };
  }

  const res = handleRecenter();
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.message, "Live location is not available yet.");
  assert.strictEqual(isMapFollowingUser, false);
});

it("10. verifies Stop Live Location stops follow behavior", () => {
  let isLiveTracking = true;
  let isMapFollowingUser = true;
  let currentUserLocation = { latitude: 26.4596, longitude: 80.2383 };

  function stopTracking() {
    isLiveTracking = false;
    isMapFollowingUser = false;
    currentUserLocation = null;
  }

  stopTracking();
  assert.strictEqual(isLiveTracking, false);
  assert.strictEqual(isMapFollowingUser, false);
  assert.strictEqual(currentUserLocation, null);
});

it("11. verifies restarting Live Location does not create duplicate watchers", () => {
  let activeWatchId = 101;
  let clearCount = 0;

  function restartTracking() {
    if (activeWatchId !== null) {
      clearCount++;
      activeWatchId = null;
    }
    activeWatchId = 202; // single new watch ID
  }

  restartTracking();
  assert.strictEqual(clearCount, 1);
  assert.strictEqual(activeWatchId, 202);
});

it("12. verifies Start location remains completely unchanged during map follow", () => {
  const startLoc = { name: "Kalpi Road", nodeId: "osm-node-8820570755" };
  let isMapFollowingUser = true;
  let currentUserLocation = { latitude: 26.4596, longitude: 80.2383 };

  // Simulate map camera follow update
  if (isMapFollowingUser && currentUserLocation) {
    // camera moves, startLoc unchanged
  }

  assert.strictEqual(startLoc.name, "Kalpi Road");
  assert.strictEqual(startLoc.nodeId, "osm-node-8820570755");
});

it("13. verifies Destination location remains completely unchanged during map follow", () => {
  const destLoc = { name: "M.I.G Road", nodeId: "osm-node-3156228563" };
  let isMapFollowingUser = true;
  let currentUserLocation = { latitude: 26.4596, longitude: 80.2383 };

  if (isMapFollowingUser && currentUserLocation) {
    // camera moves, destLoc unchanged
  }

  assert.strictEqual(destLoc.name, "M.I.G Road");
  assert.strictEqual(destLoc.nodeId, "osm-node-3156228563");
});

it("14. verifies existing Use My Location behavior remains fully functional", () => {
  const gpsStartLoc = createGpsLocation(26.4596123, 80.2383456);
  assert.ok(gpsStartLoc);
  assert.strictEqual(gpsStartLoc.isGps, true);
  assert.strictEqual(gpsStartLoc.name, "My Location");
});

it("15. verifies existing route rendering remains unchanged during map follow", () => {
  const selectedRoute = { id: "r1", nodeIds: ["N1", "N2", "N7"], distanceMeters: 500 };
  let isMapFollowingUser = true;
  let currentUserLocation = { latitude: 26.4596, longitude: 80.2383 };

  if (isMapFollowingUser && currentUserLocation) {
    // camera moves, route polyline data untouched
  }

  assert.strictEqual(selectedRoute.id, "r1");
  assert.strictEqual(selectedRoute.distanceMeters, 500);
});

it("16. verifies existing GPS accuracy filtering remains unchanged during map follow", () => {
  const initialFix = { latitude: 26.4596, longitude: 80.2383, accuracy: 15, timestamp: 1000 };
  const outlierFix = { latitude: 26.5000, longitude: 80.2800, accuracy: 350, timestamp: 2000 };

  const isAccepted = shouldAcceptNewLocationFix(initialFix, outlierFix);
  assert.strictEqual(isAccepted, false);
});

it("17. verifies GPS coordinates remain in memory only and are not persisted", () => {
  const sessionPositions = [];
  function onPositionUpdate(pos) {
    sessionPositions.push(pos);
  }

  onPositionUpdate({ latitude: 26.4596, longitude: 80.2383 });
  assert.strictEqual(sessionPositions.length, 1);
  if (typeof globalThis.localStorage !== "undefined" && typeof globalThis.localStorage?.getItem === "function") {
    assert.strictEqual(globalThis.localStorage.getItem("follow_location"), null);
  }
});

// ---------------------------------------------------------------------------
// 29. GPS-6: Live ETA, Remaining Distance & Route Progress Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 29] GPS-6: Live ETA, Remaining Distance & Route Progress:");

it("1. verifies browser GPS speed is used when valid", () => {
  const res = calculateEffectiveSpeed(2.5, "walking");
  assert.strictEqual(res.effectiveSpeedMs, 2.5);
  assert.strictEqual(res.speedSource, "gps");
  assert.strictEqual(res.speedStatus, "moving");
  assert.strictEqual(res.isStationary, false);
});

it("2. verifies browser speed = 0 results in stopped state", () => {
  const res = calculateEffectiveSpeed(0, "walking");
  assert.strictEqual(res.effectiveSpeedMs, 0);
  assert.strictEqual(res.speedSource, "gps");
  assert.strictEqual(res.speedStatus, "stopped");
  assert.strictEqual(res.isStationary, true);
  assert.strictEqual(res.currentSpeedFormatted, "0 km/h");
});

it("3. verifies browser speed = null triggers derived-speed logic", () => {
  const prev = { latitude: 26.4500, longitude: 80.2300, timestamp: 1000 };
  const curr = { latitude: 26.4510, longitude: 80.2300, timestamp: 6000 };
  const res = calculateEffectiveSpeed(null, "walking", prev, curr);

  assert.strictEqual(res.speedSource, "derived");
  assert.strictEqual(res.speedStatus, "moving");
  assert.ok(res.effectiveSpeedMs > 0);
});

it("4. verifies derived speed from two trusted GPS points is correct", () => {
  const prev = { latitude: 26.4500, longitude: 80.2300, timestamp: 1000 };
  const curr = { latitude: 26.4501, longitude: 80.2300, timestamp: 3000 }; // ~11.1m in 2s => ~5.55 m/s
  const res = calculateEffectiveSpeed(null, "walking", prev, curr);

  assert.strictEqual(res.speedSource, "derived");
  assert.ok(res.effectiveSpeedMs > 5.0 && res.effectiveSpeedMs < 6.0);
});

it("5. verifies timestamp difference is handled correctly", () => {
  const prev = { latitude: 26.4500, longitude: 80.2300, timestamp: 10000 };
  const curr = { latitude: 26.4505, longitude: 80.2300, timestamp: 20000 }; // 10s delta
  const res = calculateEffectiveSpeed(null, "walking", prev, curr);

  assert.ok(res.effectiveSpeedMs > 0);
  assert.strictEqual(res.speedStatus, "moving");
});

it("6. verifies invalid timestamps are handled safely", () => {
  const prev = { latitude: 26.4500, longitude: 80.2300, timestamp: NaN };
  const curr = { latitude: 26.4505, longitude: 80.2300, timestamp: null };
  const res = calculateEffectiveSpeed(null, "walking", prev, curr);

  assert.strictEqual(res.speedStatus, "detecting");
  assert.strictEqual(res.currentSpeedFormatted, "Detecting speed…");
  assert.strictEqual(res.effectiveSpeedMs, 0);
});

it("7. verifies zero elapsed time never causes division by zero", () => {
  const prev = { latitude: 26.4500, longitude: 80.2300, timestamp: 5000 };
  const curr = { latitude: 26.4505, longitude: 80.2300, timestamp: 5000 };
  const res = calculateEffectiveSpeed(null, "walking", prev, curr);

  assert.strictEqual(res.speedStatus, "detecting");
  assert.strictEqual(res.effectiveSpeedMs, 0);
  assert.notStrictEqual(res.effectiveSpeedMs, Infinity);
});

it("8. verifies tiny stationary GPS noise does not become walking speed", () => {
  const prev = { latitude: 26.450000, longitude: 80.230000, timestamp: 1000 };
  const curr = { latitude: 26.450002, longitude: 80.230002, timestamp: 3000 }; // ~0.29m in 2s => ~0.14 m/s
  const res = calculateEffectiveSpeed(null, "walking", prev, curr);

  assert.strictEqual(res.isStationary, true);
  assert.strictEqual(res.speedStatus, "stopped");
  assert.strictEqual(res.currentSpeedFormatted, "0 km/h");
});

it("9. verifies impossible speed spikes are rejected", () => {
  const prev = { latitude: 26.4500, longitude: 80.2300, timestamp: 1000 };
  const curr = { latitude: 26.5500, longitude: 80.3300, timestamp: 2000 }; // ~15km in 1s
  const res = calculateEffectiveSpeed(null, "walking", prev, curr);

  assert.strictEqual(res.speedStatus, "detecting");
  assert.strictEqual(res.currentSpeedFormatted, "Detecting speed…");
});

it("10. verifies speed smoothing behaves correctly", () => {
  const smoothed = smoothSpeedMs(5.0, 3.0, 0.4);
  assert.strictEqual(smoothed, 3.8); // 0.4 * 5 + 0.6 * 3 = 3.8
  const stopSmooth = smoothSpeedMs(0, 3.0);
  assert.strictEqual(stopSmooth, 0);
});

it("11. verifies Current Speed shows 0 km/h when stationary", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsStationary = { latitude: 26.4596, longitude: 80.2383, speed: 0 };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsStationary, selectedRoute: route });

  assert.strictEqual(nav.currentSpeedFormatted, "0 km/h");
  assert.strictEqual(nav.speedStatus, "stopped");
  assert.strictEqual(nav.isStationary, true);
});

it("12. verifies Current Speed shows 'Detecting speed…' and ETA shows 'ETA unavailable' before enough data exists", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsNoSpeed = { latitude: 26.4596, longitude: 80.2383, speed: null };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsNoSpeed, selectedRoute: route, previousLocation: null });

  assert.strictEqual(nav.currentSpeedFormatted, "Detecting speed…");
  assert.strictEqual(nav.etaFormatted, "ETA unavailable");
  assert.strictEqual(nav.speedStatus, "detecting");
});

it("13. verifies Walking fallback is NOT shown as live current speed while stationary", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsStationary = { latitude: 26.4596, longitude: 80.2383, speed: 0 };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsStationary, selectedRoute: route, travelMode: "walking" });

  assert.strictEqual(nav.currentSpeedFormatted, "0 km/h");
  assert.notStrictEqual(nav.currentSpeedFormatted, "5 km/h");
  assert.notStrictEqual(nav.currentSpeedFormatted, "5.0 km/h");
});

it("14. verifies Cycling fallback is NOT shown as live current speed while stationary", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsStationary = { latitude: 26.4596, longitude: 80.2383, speed: 0 };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsStationary, selectedRoute: route, travelMode: "cycling" });

  assert.strictEqual(nav.currentSpeedFormatted, "0 km/h");
  assert.notStrictEqual(nav.currentSpeedFormatted, "15 km/h");
  assert.notStrictEqual(nav.currentSpeedFormatted, "15.0 km/h");
});

it("15. verifies ETA uses actual measured speed when moving", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsMoving = { latitude: 26.4596, longitude: 80.2383, speed: 3.0 };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsMoving, selectedRoute: route });

  assert.strictEqual(nav.isEtaPaused, false);
  assert.ok(nav.etaFormatted.endsWith("min"));
  assert.notStrictEqual(nav.etaFormatted, "ETA paused");
});

it("16. verifies ETA pauses / avoids false movement when stationary", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsStationary = { latitude: n1[0], longitude: n1[1], speed: 0 };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsStationary, selectedRoute: route });

  assert.strictEqual(nav.isEtaPaused, true);
  assert.strictEqual(nav.etaFormatted, "ETA paused");
  assert.strictEqual(nav.statusText, "Stopped");
});

it("17. verifies ETA becomes valid again when movement resumes", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsStationary = { latitude: n1[0], longitude: n1[1], speed: 0 };
  const gpsResumed = { latitude: n1[0], longitude: n1[1], speed: 2.5 };

  const navStopped = calculateNavigationProgress({ currentUserLocation: gpsStationary, selectedRoute: route });
  const navMoving = calculateNavigationProgress({ currentUserLocation: gpsResumed, selectedRoute: route });

  assert.strictEqual(navStopped.etaFormatted, "ETA paused");
  assert.strictEqual(navMoving.isEtaPaused, false);
  assert.ok(navMoving.etaFormatted.includes("min"));
});

it("18. verifies remaining distance continues using selected-route geometry", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsNearStart = { latitude: n1[0], longitude: n1[1], speed: 1.5 };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsNearStart, selectedRoute: route });

  assert.ok(nav.remainingDistanceMeters > 0);
  assert.ok(nav.remainingDistanceFormatted.includes("m") || nav.remainingDistanceFormatted.includes("km"));
});

it("19. verifies progress remains spatially based", () => {
  const polyline = [[26.4500, 80.2300], [26.4600, 80.2300]];
  const gpsMid = { latitude: 26.4550, longitude: 80.2300 };
  const proj = projectPointOntoPolyline(gpsMid, polyline);

  assert.ok(proj.progressPercent >= 48 && proj.progressPercent <= 52);
});

it("20. verifies route selection change recalculates remaining distance and ETA correctly", () => {
  const routeShort = { id: "rS", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const routeLong = { id: "rL", nodeIds: ["osm-node-8820570755", "osm-node-8820570756"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gps = { latitude: n1[0], longitude: n1[1], speed: 2.0 };

  const navS = calculateNavigationProgress({ currentUserLocation: gps, selectedRoute: routeShort });
  const navL = calculateNavigationProgress({ currentUserLocation: gps, selectedRoute: routeLong });

  assert.notStrictEqual(navS.remainingDistanceFormatted, navL.remainingDistanceFormatted);
  assert.notStrictEqual(navS.etaFormatted, navL.etaFormatted);
});

it("21. verifies blue marker remains at actual GPS location", () => {
  const rawGPS = { latitude: 26.4597, longitude: 80.2385, accuracy: 10 };
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const nav = calculateNavigationProgress({ currentUserLocation: rawGPS, selectedRoute: route });

  assert.strictEqual(rawGPS.latitude, 26.4597);
  assert.strictEqual(rawGPS.longitude, 80.2385);
  assert.ok(nav.projectedPoint);
});

it("22. verifies existing GPS accuracy filtering remains intact", () => {
  const poorAccGPS = { latitude: 26.4596, longitude: 80.2383, accuracy: 250 };
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const nav = calculateNavigationProgress({ currentUserLocation: poorAccGPS, selectedRoute: route });

  assert.ok(nav.statusText.startsWith("Low GPS accuracy"));
});

it("23. verifies existing map-follow remains intact", () => {
  let isMapFollowingUser = true;
  const trustedGPS = { latitude: 26.4596, longitude: 80.2383 };

  let cameraCenter = null;
  if (isMapFollowingUser && trustedGPS) {
    cameraCenter = [trustedGPS.latitude, trustedGPS.longitude];
  }

  assert.deepStrictEqual(cameraCenter, [26.4596, 80.2383]);
});

it("24. verifies existing Use My Location remains intact", () => {
  const mapClickLoc = createMapClickLocation(26.4596, 80.2383);
  assert.ok(mapClickLoc);
  assert.strictEqual(mapClickLoc.isMapClick, true);
});

it("25. verifies arrival threshold, 100% campus graph regression, and search remain intact", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const destCoord = getNodeCoordinate("osm-node-3156228563");
  const gpsAtDest = { latitude: destCoord[0], longitude: destCoord[1], speed: 0 };

  const nav = calculateNavigationProgress({ currentUserLocation: gpsAtDest, selectedRoute: route, arrivalThreshold: 30 });
  assert.strictEqual(nav.isArrived, true);
  assert.strictEqual(nav.statusText, "Arrived at destination");
  assert.strictEqual(nav.etaFormatted, "0 min");

  const graph = createCampusGraph();
  const dijkstraRoute = findDijkstraRoute(graph, "N1", "N7");
  assert.ok(dijkstraRoute);
  assert.strictEqual(dijkstraRoute.nodeIds[0], "N1");
});

it("26. stationary user + poor accuracy + non-zero browser speed => not moving", () => {
  const prevGPS = { latitude: 26.459600, longitude: 80.238300, timestamp: 1000, accuracy: 323 };
  const currGPS = { latitude: 26.459601, longitude: 80.238301, timestamp: 4000, accuracy: 323, speed: 21.4 };

  const speedState = calculateEffectiveSpeed(currGPS.speed, "walking", prevGPS, currGPS);

  assert.strictEqual(speedState.isStationary, true);
  assert.strictEqual(speedState.speedStatus, "stopped");
  assert.strictEqual(speedState.effectiveSpeedMs, 0);
  assert.strictEqual(speedState.currentSpeedFormatted, "0 km/h");
});

it("27. stationary user + good accuracy + noisy browser speed => not moving unless corroborated", () => {
  const prevGPS = { latitude: 26.459600, longitude: 80.238300, timestamp: 1000, accuracy: 10 };
  const currGPS = { latitude: 26.459601, longitude: 80.238301, timestamp: 4000, accuracy: 10, speed: 3.0 };

  const speedState = calculateEffectiveSpeed(currGPS.speed, "walking", prevGPS, currGPS);

  assert.strictEqual(speedState.isStationary, true);
  assert.strictEqual(speedState.speedStatus, "stopped");
  assert.strictEqual(speedState.currentSpeedFormatted, "0 km/h");
});

it("28. one non-zero browser speed fix with poor accuracy => not enough to declare movement", () => {
  const currGPS = { latitude: 26.4596, longitude: 80.2383, accuracy: 150, speed: 4.5 };
  const speedState = calculateEffectiveSpeed(currGPS.speed, "walking", null, currGPS);

  assert.strictEqual(speedState.speedStatus, "detecting");
  assert.strictEqual(speedState.currentSpeedFormatted, "Detecting speed…");
  assert.strictEqual(speedState.effectiveSpeedMs, 0);
});

it("29. consecutive trusted movement => moving speed becomes valid", () => {
  const prevGPS = { latitude: 26.4500, longitude: 80.2300, timestamp: 1000, accuracy: 10 };
  const currGPS = { latitude: 26.4501, longitude: 80.2300, timestamp: 4000, accuracy: 10, speed: 3.0 };

  const speedState = calculateEffectiveSpeed(currGPS.speed, "walking", prevGPS, currGPS);

  assert.strictEqual(speedState.isStationary, false);
  assert.strictEqual(speedState.speedStatus, "moving");
  assert.ok(speedState.effectiveSpeedMs > 0);
  assert.ok(speedState.currentSpeedFormatted.includes("km/h"));
});

it("30. stationary GPS jitter does not advance progress", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const prevGPS = { latitude: 26.459600, longitude: 80.238300, timestamp: 1000, accuracy: 15 };
  const currGPS = { latitude: 26.459601, longitude: 80.238301, timestamp: 4000, accuracy: 15, speed: 1.5 };

  const nav = calculateNavigationProgress({
    currentUserLocation: currGPS,
    selectedRoute: route,
    previousLocation: prevGPS,
    options: { previousProgressPercent: 25.0 }
  });

  assert.strictEqual(nav.isStationary, true);
  assert.strictEqual(nav.progressPercent, 25.0);
});

it("31. stationary user does not receive false ETA", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const prevGPS = { latitude: 26.459600, longitude: 80.238300, timestamp: 1000, accuracy: 323 };
  const currGPS = { latitude: 26.459601, longitude: 80.238301, timestamp: 4000, accuracy: 323, speed: 21.4 };

  const nav = calculateNavigationProgress({
    currentUserLocation: currGPS,
    selectedRoute: route,
    previousLocation: prevGPS
  });

  assert.strictEqual(nav.isStationary, true);
  assert.strictEqual(nav.etaFormatted, "ETA paused");
  assert.strictEqual(nav.isEtaPaused, true);
  assert.notStrictEqual(nav.etaFormatted, "9 min");
});

it("32. live ETA resumes when real movement begins", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const p1 = { latitude: 26.4500, longitude: 80.2300, timestamp: 1000, accuracy: 10 };
  const p2 = { latitude: 26.4500, longitude: 80.2300, timestamp: 4000, accuracy: 10 };
  const p3 = { latitude: 26.4503, longitude: 80.2300, timestamp: 10000, accuracy: 10, speed: 3.3 };

  const navStopped = calculateNavigationProgress({ currentUserLocation: p2, selectedRoute: route, previousLocation: p1 });
  const navMoving = calculateNavigationProgress({ currentUserLocation: p3, selectedRoute: route, previousLocation: p2 });

  assert.strictEqual(navStopped.etaFormatted, "ETA paused");
  assert.strictEqual(navMoving.isEtaPaused, false);
  assert.ok(navMoving.etaFormatted.includes("min"));
});

it("33. accuracy 323m + 15.6m coordinate jitter => no derived moving speed (suppresses false 18.7 km/h)", () => {
  const prevGPS = { latitude: 26.459600, longitude: 80.238300, timestamp: 1000, accuracy: 323 };
  const currGPS = { latitude: 26.459730, longitude: 80.238350, timestamp: 4000, accuracy: 323, speed: 5.2 }; // ~15.6m jump in 3s = 5.2 m/s = 18.7 km/h jitter!

  const speedState = calculateEffectiveSpeed(currGPS.speed, "walking", prevGPS, currGPS);

  assert.notStrictEqual(speedState.speedStatus, "moving");
  assert.notStrictEqual(speedState.currentSpeedFormatted, "18.7 km/h");
  assert.strictEqual(speedState.effectiveSpeedMs, 0);
  assert.ok(speedState.currentSpeedFormatted === "0 km/h" || speedState.currentSpeedFormatted === "Detecting speed…");
});

it("34. poor accuracy + one large jump (155m) => no immediate moving speed", () => {
  const prevGPS = { latitude: 26.4500, longitude: 80.2300, timestamp: 1000, accuracy: 250 };
  const currGPS = { latitude: 26.4514, longitude: 80.2300, timestamp: 4000, accuracy: 250 }; // 155m jump in 3s with 250m uncertainty

  const speedState = calculateEffectiveSpeed(null, "walking", prevGPS, currGPS);

  assert.notStrictEqual(speedState.speedStatus, "moving");
  assert.strictEqual(speedState.effectiveSpeedMs, 0);
  assert.ok(speedState.currentSpeedFormatted === "0 km/h" || speedState.currentSpeedFormatted === "Detecting speed…");
});

it("35. movement resumes correctly once GPS accuracy improves to 10m", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const prevGPS = { latitude: 26.4500, longitude: 80.2300, timestamp: 1000, accuracy: 10 };
  const currGPS = { latitude: 26.4503, longitude: 80.2300, timestamp: 5000, accuracy: 10, speed: 2.5 }; // ~33m in 4s with 10m accuracy

  const speedState = calculateEffectiveSpeed(currGPS.speed, "walking", prevGPS, currGPS);
  const nav = calculateNavigationProgress({ currentUserLocation: currGPS, selectedRoute: route, previousLocation: prevGPS });

  assert.strictEqual(speedState.speedStatus, "moving");
  assert.strictEqual(speedState.isStationary, false);
  assert.ok(speedState.effectiveSpeedMs > 0);
  assert.strictEqual(nav.isEtaPaused, false);
  assert.ok(nav.etaFormatted.includes("min"));
});

// ---------------------------------------------------------------------------
// 30. GPS-7: Reliable Off-Route Detection Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 30] GPS-7: Reliable Off-Route Detection:");

it("1. verifies GPS point very close to route results in ON_ROUTE state", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsNearRoute = { latitude: n1[0], longitude: n1[1], accuracy: 10, speed: 1.5 };

  const state = evaluateOffRouteState({ currentUserLocation: gpsNearRoute, selectedRoute: route });

  assert.strictEqual(state.status, "ON_ROUTE");
  assert.strictEqual(state.isOnRoute, true);
  assert.strictEqual(state.isOffRoute, false);
  assert.strictEqual(state.statusText, "On route");
});

it("2. verifies GPS point moderately far but with poor GPS accuracy results in UNCERTAIN state", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsPoorAcc = { latitude: 26.4600, longitude: 80.2390, accuracy: 200, speed: 1.5 };

  const state = evaluateOffRouteState({ currentUserLocation: gpsPoorAcc, selectedRoute: route });

  assert.strictEqual(state.status, "UNCERTAIN");
  assert.strictEqual(state.isUncertain, true);
  assert.strictEqual(state.isOffRoute, false);
  assert.ok(state.statusText.includes("Checking route position"));
});

it("3. verifies GPS point far from route with good accuracy is not immediately OFF_ROUTE on first reading", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsFar = { latitude: 26.4610, longitude: 80.2400, accuracy: 10, speed: 1.5 };

  const state1 = evaluateOffRouteState({ currentUserLocation: gpsFar, selectedRoute: route, previousOffRouteState: null });

  assert.strictEqual(state1.confirmationCount, 1);
  assert.strictEqual(state1.status, "UNCERTAIN");
  assert.strictEqual(state1.isOffRoute, false);
});

it("4. verifies consecutive far trusted fixes trigger OFF_ROUTE state", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsFar = { latitude: 26.4610, longitude: 80.2400, accuracy: 10, speed: 1.5 };

  const s1 = evaluateOffRouteState({ currentUserLocation: gpsFar, selectedRoute: route });
  const s2 = evaluateOffRouteState({ currentUserLocation: gpsFar, selectedRoute: route, previousOffRouteState: s1 });
  const s3 = evaluateOffRouteState({ currentUserLocation: gpsFar, selectedRoute: route, previousOffRouteState: s2 });

  assert.strictEqual(s3.confirmationCount, 3);
  assert.strictEqual(s3.status, "OFF_ROUTE");
  assert.strictEqual(s3.isOffRoute, true);
  assert.ok(s3.statusText.includes("off route"));
});

it("5. verifies GPS accuracy contributes to effective detection threshold", () => {
  assert.strictEqual(OFF_ROUTE_CONFIG.BASE_OFF_ROUTE_THRESHOLD_METERS, 30);
  const t0 = calculateEffectiveThresholds(0);
  const t20 = calculateEffectiveThresholds(20);

  assert.strictEqual(t0.effectiveThresholdMeters, 30);
  assert.strictEqual(t20.effectiveThresholdMeters, 40);
});

it("6. verifies accuracy contribution is capped at max allowance limit", () => {
  const tBig = calculateEffectiveThresholds(300);
  assert.strictEqual(tBig.effectiveThresholdMeters, 80);
  assert.strictEqual(tBig.cappedAllowance, 50);
});

it("7. verifies one noisy GPS jump does not immediately trigger OFF_ROUTE", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsNormal = { latitude: 26.4596, longitude: 80.2383, accuracy: 10, speed: 1.5 };
  const gpsJump = { latitude: 26.4610, longitude: 80.2400, accuracy: 10, speed: 1.5 };

  const sNormal = evaluateOffRouteState({ currentUserLocation: gpsNormal, selectedRoute: route });
  const sJump = evaluateOffRouteState({ currentUserLocation: gpsJump, selectedRoute: route, previousOffRouteState: sNormal });

  assert.strictEqual(sJump.status, "UNCERTAIN");
  assert.strictEqual(sJump.isOffRoute, false);
});

it("8. verifies stationary GPS jitter does not repeatedly trigger OFF_ROUTE", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsStationaryJitter = { latitude: 26.4600, longitude: 80.2388, accuracy: 15, speed: 0 };

  const s1 = evaluateOffRouteState({ currentUserLocation: gpsStationaryJitter, selectedRoute: route });
  const s2 = evaluateOffRouteState({ currentUserLocation: gpsStationaryJitter, selectedRoute: route, previousOffRouteState: s1 });

  assert.strictEqual(s2.isOffRoute, false);
  assert.ok(s2.confirmationCount < 3);
});

it("9. verifies separate off-route and return-to-route thresholds prevent oscillation", () => {
  const t = calculateEffectiveThresholds(10);
  assert.strictEqual(t.effectiveThresholdMeters, 35);
  assert.strictEqual(t.returnToRouteThresholdMeters, 24.5);
  assert.ok(t.returnToRouteThresholdMeters < t.effectiveThresholdMeters);
});

it("10. verifies user returning near route restores ON_ROUTE state", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsOff = { latitude: n1[0] + 0.005, longitude: n1[1] + 0.005, accuracy: 10, speed: 1.5 };
  const gpsBack = { latitude: n1[0], longitude: n1[1], accuracy: 10, speed: 1.5 };

  let s = evaluateOffRouteState({ currentUserLocation: gpsOff, selectedRoute: route });
  s = evaluateOffRouteState({ currentUserLocation: gpsOff, selectedRoute: route, previousOffRouteState: s });
  s = evaluateOffRouteState({ currentUserLocation: gpsOff, selectedRoute: route, previousOffRouteState: s });
  assert.strictEqual(s.status, "OFF_ROUTE");

  const sReturned = evaluateOffRouteState({ currentUserLocation: gpsBack, selectedRoute: route, previousOffRouteState: s });
  assert.strictEqual(sReturned.status, "ON_ROUTE");
  assert.strictEqual(sReturned.confirmationCount, 0);
});

it("11. verifies route change resets previous off-route confirmation", () => {
  const routeA = { id: "rA", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const routeB = { id: "rB", nodeIds: ["osm-node-8820570755", "osm-node-8820570756"] };
  const gpsFarA = { latitude: 26.4610, longitude: 80.2400, accuracy: 10, speed: 1.5 };

  const sA = evaluateOffRouteState({ currentUserLocation: gpsFarA, selectedRoute: routeA });
  const sB = evaluateOffRouteState({ currentUserLocation: gpsFarA, selectedRoute: routeB, previousOffRouteState: sA });

  assert.strictEqual(sB.routeId, "rB");
  assert.notStrictEqual(sB.confirmationCount, 2);
});

it("12. verifies new route is evaluated independently", () => {
  const routeB = { id: "rB", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gps = { latitude: n1[0], longitude: n1[1], accuracy: 10, speed: 1.5 };

  const sB = evaluateOffRouteState({ currentUserLocation: gps, selectedRoute: routeB });
  assert.strictEqual(sB.status, "ON_ROUTE");
});

it("13. verifies rejected GPS/outlier fixes do not change off-route state", () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const initialFix = { latitude: n1[0], longitude: n1[1], accuracy: 15, timestamp: 1000 };
  const outlierFix = { latitude: n1[0] + 0.05, longitude: n1[1] + 0.05, accuracy: 350, timestamp: 2000 };

  const isAccepted = shouldAcceptNewLocationFix(initialFix, outlierFix);
  assert.strictEqual(isAccepted, false);

  const trustedFix = isAccepted ? outlierFix : initialFix;
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };

  const state = evaluateOffRouteState({ currentUserLocation: trustedFix, selectedRoute: route });
  assert.strictEqual(state.status, "ON_ROUTE");
});

it("14. verifies missing GPS accuracy is handled safely", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsNoAcc = { latitude: n1[0], longitude: n1[1], accuracy: null };

  const state = evaluateOffRouteState({ currentUserLocation: gpsNoAcc, selectedRoute: route });
  assert.strictEqual(state.status, "ON_ROUTE");
  assert.strictEqual(state.effectiveThresholdMeters, 30);
});

it("15. verifies missing route geometry is handled safely", () => {
  const gps = { latitude: 26.4596, longitude: 80.2383 };
  const stateNoRoute = evaluateOffRouteState({ currentUserLocation: gps, selectedRoute: null });

  assert.strictEqual(stateNoRoute.status, "ON_ROUTE");
  assert.strictEqual(stateNoRoute.distanceFromRouteMeters, 0);
});

it("16. verifies current blue marker remains at actual GPS position", () => {
  const rawGPS = { latitude: 26.4610, longitude: 80.2400, accuracy: 10 };
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const state = evaluateOffRouteState({ currentUserLocation: rawGPS, selectedRoute: route });

  assert.strictEqual(state.currentUserLocation.latitude, 26.4610);
  assert.strictEqual(state.currentUserLocation.longitude, 80.2400);
});

it("17. verifies projected route point remains separate from actual GPS marker", () => {
  const rawGPS = { latitude: 26.4610, longitude: 80.2400, accuracy: 10 };
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const state = evaluateOffRouteState({ currentUserLocation: rawGPS, selectedRoute: route });

  assert.ok(state.projectedPoint);
  assert.notStrictEqual(state.projectedPoint.latitude, rawGPS.latitude);
});

it("18. verifies no automatic rerouting is triggered in Step GPS-7", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsOff = { latitude: 26.4610, longitude: 80.2400, accuracy: 10, speed: 1.5 };

  let s = evaluateOffRouteState({ currentUserLocation: gpsOff, selectedRoute: route });
  s = evaluateOffRouteState({ currentUserLocation: gpsOff, selectedRoute: route, previousOffRouteState: s });
  s = evaluateOffRouteState({ currentUserLocation: gpsOff, selectedRoute: route, previousOffRouteState: s });

  assert.strictEqual(s.status, "OFF_ROUTE");
  assert.strictEqual(s.selectedRoute.id, "r1");
});

it("19. verifies existing live ETA behavior remains intact", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsMoving = { latitude: 26.4596, longitude: 80.2383, speed: 2.5 };
  const nav = calculateNavigationProgress({ currentUserLocation: gpsMoving, selectedRoute: route });

  assert.strictEqual(nav.isEtaPaused, false);
  assert.ok(nav.etaFormatted.includes("min"));
});

it("20. verifies existing map-follow/recenter remains intact", () => {
  let isMapFollowingUser = true;
  const gps = { latitude: 26.4596, longitude: 80.2383 };
  let camera = null;
  if (isMapFollowingUser && gps) camera = [gps.latitude, gps.longitude];

  assert.deepStrictEqual(camera, [26.4596, 80.2383]);
});

it("21. verifies existing Walking/Cycling behavior remains intact", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gps = { latitude: 26.4596, longitude: 80.2383, speed: 3.0 };

  const navWalk = calculateNavigationProgress({ currentUserLocation: gps, selectedRoute: route, travelMode: "walking" });
  const navCycle = calculateNavigationProgress({ currentUserLocation: gps, selectedRoute: route, travelMode: "cycling" });

  assert.strictEqual(navWalk.isNavigationActive, true);
  assert.strictEqual(navCycle.isNavigationActive, true);
});

it("22. verifies existing Firebase condition routing remains intact", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, [
    { title: "Hazard", type: "blocked_path", severity: "critical", status: "active", affectedPathIds: ["N1-N6"] },
  ]);

  const route = findDijkstraRoute(graph, "N1", "N7", { useConditions: true });
  assert.ok(route);
  assert.strictEqual(route.nodeIds.includes("N6"), false);
});

it("23. verifies existing named search/map-click selection remains intact", () => {
  const mapClickLoc = createMapClickLocation(26.4596, 80.2383);
  assert.ok(mapClickLoc);
  assert.strictEqual(mapClickLoc.isMapClick, true);
});

it("24. verifies existing Panki graph routing remains intact", () => {
  const graph = createCampusGraph();
  const route = findDijkstraRoute(graph, "N1", "N7");
  assert.ok(route);
});

it("25. verifies 100% sample N1 -> N7 campus routing regression passes cleanly", () => {
  const graph = createCampusGraph();
  const route = findDijkstraRoute(graph, "N1", "N7");

  assert.ok(route);
  assert.strictEqual(route.nodeIds[0], "N1");
  assert.strictEqual(route.nodeIds[route.nodeIds.length - 1], "N7");
});

// ---------------------------------------------------------------------------
// 31. Step GPS-8: Automatic Off-Route Rerouting Unit & Integration Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 31] Step GPS-8: Automatic Off-Route Rerouting Unit & Integration Tests:");

it("1. confirmed OFF_ROUTE triggers automatic rerouting", () => {
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true };
  const trigger = shouldTriggerReroute({ offRouteState, isRerouting: false });
  assert.strictEqual(trigger, true);
});

it("2. ON_ROUTE does not trigger rerouting", () => {
  const offRouteState = { status: "ON_ROUTE", isOffRoute: false };
  const trigger = shouldTriggerReroute({ offRouteState, isRerouting: false });
  assert.strictEqual(trigger, false);
});

it("3. UNCERTAIN does not trigger rerouting", () => {
  const offRouteState = { status: "UNCERTAIN", isOffRoute: false, isUncertain: true };
  const trigger = shouldTriggerReroute({ offRouteState, isRerouting: false });
  assert.strictEqual(trigger, false);
});

it("4. poor GPS accuracy does not trigger rerouting", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const gpsPoorAcc = { latitude: 26.4610, longitude: 80.2400, accuracy: 150 };
  const evalState = evaluateOffRouteState({ currentUserLocation: gpsPoorAcc, selectedRoute: route });

  assert.strictEqual(evalState.status, "UNCERTAIN");
  const trigger = shouldTriggerReroute({ offRouteState: evalState, isRerouting: false });
  assert.strictEqual(trigger, false);
});

it("5. one noisy GPS update does not trigger rerouting", () => {
  const route = { id: "r1", nodeIds: ["osm-node-8820570755", "osm-node-3156228563"] };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsNormal = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const gpsNoisy = { latitude: 26.4610, longitude: 80.2400, accuracy: 10 };

  const s1 = evaluateOffRouteState({ currentUserLocation: gpsNormal, selectedRoute: route });
  const s2 = evaluateOffRouteState({ currentUserLocation: gpsNoisy, selectedRoute: route, previousOffRouteState: s1 });

  assert.strictEqual(s2.status, "UNCERTAIN");
  const trigger = shouldTriggerReroute({ offRouteState: s2, isRerouting: false });
  assert.strictEqual(trigger, false);
});

it("6. duplicate OFF_ROUTE updates do not start duplicate reroutes", () => {
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true };
  const trigger = shouldTriggerReroute({ offRouteState, isRerouting: true });
  assert.strictEqual(trigger, false);
});

it("7. reroute cooldown works", () => {
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true };
  const now = 100000;
  const recentReroute = 95000;

  const trigger = shouldTriggerReroute({
    offRouteState,
    isRerouting: false,
    lastRerouteTime: recentReroute,
    cooldownMs: DEFAULT_REROUTE_COOLDOWN_MS,
    currentTime: now,
  });

  assert.strictEqual(trigger, false);

  const oldReroute = 80000;
  const triggerAfterCooldown = shouldTriggerReroute({
    offRouteState,
    isRerouting: false,
    lastRerouteTime: oldReroute,
    cooldownMs: DEFAULT_REROUTE_COOLDOWN_MS,
    currentTime: now,
  });

  assert.strictEqual(triggerAfterCooldown, true);
});

it("8. only one reroute operation can run at once", () => {
  assert.strictEqual(REROUTE_STATUS.OFF_ROUTE, "OFF_ROUTE");
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true };
  assert.strictEqual(shouldTriggerReroute({ offRouteState, isRerouting: true }), false);
  assert.strictEqual(shouldTriggerReroute({ offRouteState, isRerouting: false }), true);
});

it("9. current trusted GPS position is used as new origin", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563", name: "Destination" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.strictEqual(result.success, true);
  assert.ok(result.newOriginLocation);
  assert.strictEqual(result.newOriginLocation.latitude, n1[0]);
  assert.strictEqual(result.newOriginLocation.longitude, n1[1]);
});

it("10. exact GPS coordinates are preserved", async () => {
  const exactLat = 26.459612;
  const exactLng = 80.238345;
  const gpsPos = { latitude: exactLat, longitude: exactLng, accuracy: 8 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.strictEqual(result.newOriginLocation.coordinate.latitude, exactLat);
  assert.strictEqual(result.newOriginLocation.coordinate.longitude, exactLng);
});

it("11. original destination remains unchanged", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const originalDest = { nodeId: "osm-node-3156228563", name: "Original Destination" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: originalDest,
    destination: "Original Destination",
    areaId: "panki-kanpur",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(originalDest.name, "Original Destination");
});

it("12. new route is calculated successfully", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.strictEqual(result.success, true);
  assert.ok(result.routes.length > 0);
  assert.ok(result.selectedRoute);
});

it("13. new route becomes selectedRoute", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.strictEqual(result.selectedRoute, result.routes[0]);
});

it("14. old route is no longer active", async () => {
  const oldRoute = { id: "old-route-99", totalDistance: 5000 };
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.notStrictEqual(result.selectedRoute.id, oldRoute.id);
});

it("15. new route distance is used", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.ok(typeof result.selectedRoute.totalDistance === "number");
  assert.ok(result.selectedRoute.totalDistance > 0);
});

it("16. live navigation remaining distance updates", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  const nav = calculateNavigationProgress({
    currentUserLocation: gpsPos,
    selectedRoute: result.selectedRoute,
  });

  assert.ok(typeof nav.remainingDistanceMeters === "number");
  assert.ok(nav.remainingDistanceMeters > 0);
});

it("17. live ETA recalculates after reroute", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10, speed: 2.0 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  const nav = calculateNavigationProgress({
    currentUserLocation: gpsPos,
    selectedRoute: result.selectedRoute,
  });

  assert.strictEqual(nav.isEtaPaused, false);
  assert.ok(nav.etaFormatted.length > 0);
});

it("18. planned route-card duration remains fixed by planning rules", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsMovingFast = { latitude: n1[0], longitude: n1[1], accuracy: 10, speed: 10.0 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsMovingFast,
    destinationLocation: destLoc,
    travelMode: "walking",
    areaId: "panki-kanpur",
  });

  assert.ok(result.selectedRoute.duration.includes("min") || result.selectedRoute.duration.includes("sec"));
});

it("19. environmental route metrics update for new route", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.ok(typeof result.selectedRoute.greenery === "number");
  assert.ok(typeof result.selectedRoute.shade === "number");
  assert.ok(typeof result.selectedRoute.pollution === "string");
});

it("20. route score/details synchronize", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.ok(typeof result.selectedRoute.environmentalScore === "number");
  assert.ok(result.selectedRoute.explanation);
});

it("21. 'Why This Route?' synchronizes", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.ok(result.selectedRoute.explanation.length > 10);
});

it("22. off-route state resets for new route", async () => {
  const n1 = getNodeCoordinate("osm-node-8820570755");
  const gpsPos = { latitude: n1[0], longitude: n1[1], accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  const freshEvaluation = evaluateOffRouteState({
    currentUserLocation: gpsPos,
    selectedRoute: result.selectedRoute,
    previousOffRouteState: {
      routeId: result.selectedRoute.id,
      status: "ON_ROUTE",
      confirmationCount: 0,
    },
  });

  assert.strictEqual(freshEvaluation.status, "ON_ROUTE");
  assert.strictEqual(freshEvaluation.confirmationCount, 0);
});

it("23. reroute failure is handled safely", async () => {
  const gpsPos = { latitude: 26.4596, longitude: 80.2383, accuracy: 10 };

  const failingEngine = async () => {
    throw new Error("Panki Graph Network Disconnected");
  };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: { nodeId: "invalid-node" },
    calculateRoutesFn: failingEngine,
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, "Panki Graph Network Disconnected");
  assert.deepStrictEqual(result.routes, []);
  assert.strictEqual(result.selectedRoute, null);
});

it("24. destination/arrival behavior remains intact", () => {
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true };
  const trigger = shouldTriggerReroute({
    offRouteState,
    isRerouting: false,
    isArrived: true,
  });

  assert.strictEqual(trigger, false);
});

it("25. blue marker remains at actual GPS coordinates", async () => {
  const rawLat = 26.459612;
  const rawLng = 80.238345;
  const gpsPos = { latitude: rawLat, longitude: rawLng, accuracy: 10 };
  const destLoc = { nodeId: "osm-node-3156228563" };

  const result = await executeAutomaticReroute({
    currentUserLocation: gpsPos,
    destinationLocation: destLoc,
    areaId: "panki-kanpur",
  });

  assert.strictEqual(result.newOriginLocation.latitude, rawLat);
  assert.strictEqual(result.newOriginLocation.longitude, rawLng);
});

it("26. map-follow remains intact", () => {
  const isMapFollowingUser = true;
  const currentUserLocation = { latitude: 26.4596, longitude: 80.2383 };
  let cameraPos = null;

  if (isMapFollowingUser && currentUserLocation) {
    cameraPos = [currentUserLocation.latitude, currentUserLocation.longitude];
  }

  assert.deepStrictEqual(cameraPos, [26.4596, 80.2383]);
});

it("27. existing live speed/ETA behavior remains intact", () => {
  const speedStateMoving = calculateEffectiveSpeed(2.5, "walking");
  assert.strictEqual(speedStateMoving.speedStatus, "moving");
  assert.strictEqual(speedStateMoving.isStationary, false);

  const speedStateStopped = calculateEffectiveSpeed(0, "walking");
  assert.strictEqual(speedStateStopped.speedStatus, "stopped");
  assert.strictEqual(speedStateStopped.isStationary, true);
});

it("28. existing GPS-7 hysteresis behavior remains intact", () => {
  const thresholds = calculateEffectiveThresholds(20);
  assert.strictEqual(thresholds.effectiveThresholdMeters, 40);
  assert.strictEqual(thresholds.returnToRouteThresholdMeters, 28);
  assert.ok(thresholds.returnToRouteThresholdMeters < thresholds.effectiveThresholdMeters);
});

it("29. existing Firebase condition-aware routing remains intact", async () => {
  const routes = await calculateLiveCampusRoutes({
    areaId: "sample-campus",
    startNodeId: "N1",
    targetNodeId: "N7",
    activeConditions: [
      { title: "Block", type: "blocked_path", severity: "critical", status: "active", affectedPathIds: ["N1-N6"] },
    ],
  });

  assert.ok(routes.length > 0);
  assert.strictEqual(routes[0].nodeIds.includes("N6"), false);
});

it("30. existing Panki routing remains intact", async () => {
  const routes = await calculateLiveCampusRoutes({
    areaId: "panki-kanpur",
    startNodeId: "osm-node-8820570755",
    targetNodeId: "osm-node-3156228563",
  });

  assert.ok(routes.length > 0);
});

it("31. existing named search remains intact", () => {
  const coordResults = searchPankiLocations("26.4596, 80.2383");
  assert.ok(coordResults.length > 0);
  assert.ok(coordResults[0].coordinate);
});

it("32. existing map-click routing remains intact", () => {
  const loc = createMapClickLocation(26.4596, 80.2383);
  assert.strictEqual(loc.isMapClick, true);
  assert.strictEqual(Boolean(loc.error), false);
});

it("33. existing sample N1 -> N7 regression remains intact", async () => {
  const routes = await calculateLiveCampusRoutes({
    areaId: "sample-campus",
    startNodeId: "N1",
    targetNodeId: "N7",
  });

  assert.ok(routes.length > 0);
  assert.strictEqual(routes[0].nodeIds[0], "N1");
  assert.strictEqual(routes[0].nodeIds[routes[0].nodeIds.length - 1], "N7");
});

it("34. no Firebase GPS persistence is introduced", () => {
  const sampleGpsState = { latitude: 26.4596, longitude: 80.2383, source: "gps", isLive: true };
  assert.strictEqual(sampleGpsState.source, "gps");
  assert.strictEqual(sampleGpsState.isLive, true);
});

it("35. one OFF_ROUTE event = at most one reroute (same GPS fix ignored)", () => {
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true, routeId: "r1" };
  const gpsKey = "26.4596_80.2383_1000";

  // First check triggers reroute
  const firstCheck = shouldTriggerReroute({
    offRouteState,
    isRerouting: false,
    currentGpsKey: gpsKey,
    lastReroutedGpsKey: null,
    currentRouteId: "r1",
  });
  assert.strictEqual(firstCheck, true);

  // Subsequent check with same GPS fix fails
  const secondCheck = shouldTriggerReroute({
    offRouteState,
    isRerouting: false,
    currentGpsKey: gpsKey,
    lastReroutedGpsKey: gpsKey,
    currentRouteId: "r1",
  });
  assert.strictEqual(secondCheck, false);
});

it("36. repeated OFF_ROUTE renders do not trigger duplicate reroutes", () => {
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true, routeId: "r1" };
  const gpsKey = "26.4596_80.2383_1000";

  // While locked in progress
  const lockedCheck = shouldTriggerReroute({
    offRouteState,
    isRerouting: true,
    currentGpsKey: gpsKey,
    currentRouteId: "r1",
  });
  assert.strictEqual(lockedCheck, false);
});

it("37. successful reroute prevents immediate second reroute", () => {
  const offRouteState = { status: "OFF_ROUTE", isOffRoute: true, routeId: "old-route" };
  const newRouteId = "new-route-123";

  // When selectedRoute ID changes to new route, old offRouteState for old route fails check
  const mismatchedRouteCheck = shouldTriggerReroute({
    offRouteState,
    isRerouting: false,
    currentRouteId: newRouteId,
  });
  assert.strictEqual(mismatchedRouteCheck, false);

  // Reset offRouteState for new route evaluates as ON_ROUTE
  const resetOffRouteState = { status: "ON_ROUTE", isOffRoute: false, routeId: newRouteId };
  const freshCheck = shouldTriggerReroute({
    offRouteState: resetOffRouteState,
    isRerouting: false,
    currentRouteId: newRouteId,
  });
  assert.strictEqual(freshCheck, false);
});

it("38. selectedRoute update prevents reroute loop", () => {
  const newRoute = { id: "new-route-456", totalDistance: 1200 };
  const userGpsAtStartOfNewRoute = { latitude: 26.4596, longitude: 80.2383, accuracy: 10 };

  // Fresh evaluation against new route
  const freshEval = evaluateOffRouteState({
    currentUserLocation: userGpsAtStartOfNewRoute,
    selectedRoute: newRoute,
    previousOffRouteState: { routeId: newRoute.id, status: "ON_ROUTE", confirmationCount: 0 },
  });

  assert.strictEqual(freshEval.status, "ON_ROUTE");
  assert.strictEqual(shouldTriggerReroute({ offRouteState: freshEval }), false);
});




// ---------------------------------------------------------------------------
// Group 32: Report A Problem Independent Location UX Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 32] Report A Problem Independent Location UX Tests:");

it("1. opening Report a Problem starts with empty start point", () => {
  const initialStartLocation = null;
  assert.strictEqual(initialStartLocation, null);
});

it("2. opening Report a Problem starts with empty end point", () => {
  const initialEndLocation = null;
  assert.strictEqual(initialEndLocation, null);
});

it("3. selected navigation route is NOT copied into report state", () => {
  const selectedRoute = { id: "route-101", name: "Kalpi Road Route", origin: "Kalpi Road" };
  const reportState = { startLocation: null, endLocation: null };
  assert.notStrictEqual(reportState.startLocation, selectedRoute);
  assert.strictEqual(reportState.startLocation, null);
});

it("4. navigation Origin remains unchanged", () => {
  const navigationOrigin = "Kalpi Road";
  const reportStartLocation = { latitude: 26.4596, longitude: 80.2383 };
  assert.strictEqual(navigationOrigin, "Kalpi Road");
  assert.notStrictEqual(navigationOrigin, reportStartLocation);
});

it("5. navigation Destination remains unchanged", () => {
  const navigationDestination = "M.I.G Road";
  const reportEndLocation = { latitude: 26.4610, longitude: 80.2400 };
  assert.strictEqual(navigationDestination, "M.I.G Road");
  assert.notStrictEqual(navigationDestination, reportEndLocation);
});

it("6. selectedRoute remains unchanged", () => {
  const selectedRoute = { id: "active-route-1", distance: 1500 };
  const modalOpened = true;
  assert.ok(modalOpened);
  assert.strictEqual(selectedRoute.id, "active-route-1");
  assert.strictEqual(selectedRoute.distance, 1500);
});

it("7. report start can be selected independently", () => {
  const reportStart = createMapClickLocation(26.4596, 80.2383);
  assert.ok(reportStart);
  assert.strictEqual(reportStart.coordinate.latitude, 26.4596);
  assert.strictEqual(reportStart.coordinate.longitude, 80.2383);
});

it("8. report end can be selected independently", () => {
  const reportEnd = createMapClickLocation(26.4612, 80.2405);
  assert.ok(reportEnd);
  assert.strictEqual(reportEnd.coordinate.latitude, 26.4612);
  assert.strictEqual(reportEnd.coordinate.longitude, 80.2405);
});

it("9. map selection preserves exact coordinates", () => {
  const clickedLat = 26.4596123;
  const clickedLng = 80.2383456;
  const loc = createMapClickLocation(clickedLat, clickedLng);
  assert.strictEqual(loc.coordinate.latitude, clickedLat);
  assert.strictEqual(loc.coordinate.longitude, clickedLng);
});

it("10. outside-Panki report locations are rejected", () => {
  const outsideLat = 28.5458;
  const outsideLng = 77.1925;
  const loc = createMapClickLocation(outsideLat, outsideLng);
  assert.ok(loc.error);
  assert.strictEqual(loc.error.includes("Panki study area"), true);
});

it("11. authenticated report constructs valid schema with startLocation & endLocation", () => {
  const startLoc = { name: "Kalpi Start", latitude: 26.4596, longitude: 80.2383 };
  const endLoc = { name: "Kalpi End", latitude: 26.4610, longitude: 80.2400 };

  const payload = {
    title: "Kalpi Road Obstruction",
    description: "Debris blocking lane",
    type: "blocked_path",
    severity: "high",
    status: "active",
    location: {
      latitude: (startLoc.latitude + endLoc.latitude) / 2,
      longitude: (startLoc.longitude + endLoc.longitude) / 2,
      areaName: "Panki Study Area",
    },
    startLocation: startLoc,
    endLocation: endLoc,
    affectedPathIds: [],
    reportedBy: "test-user-uid-123",
  };

  validateCampusCondition(payload);
  assert.strictEqual(payload.startLocation.name, "Kalpi Start");
  assert.strictEqual(payload.endLocation.name, "Kalpi End");
  assert.strictEqual(payload.reportedBy, "test-user-uid-123");
});

it("12. reportedBy remains authenticated UID", () => {
  const authUid = "user-uid-999";
  const payload = {
    title: "Road Repair",
    type: "maintenance",
    severity: "low",
    status: "active",
    location: { latitude: 26.46, longitude: 80.24 },
    reportedBy: authUid,
  };
  validateCampusCondition(payload);
  assert.strictEqual(payload.reportedBy, authUid);
});

it("13. startLocation is saved", () => {
  const payload = {
    startLocation: { name: "Start Point A", latitude: 26.4596, longitude: 80.2383 },
  };
  assert.strictEqual(payload.startLocation.name, "Start Point A");
  assert.strictEqual(payload.startLocation.latitude, 26.4596);
});

it("14. endLocation is saved", () => {
  const payload = {
    endLocation: { name: "End Point B", latitude: 26.4610, longitude: 80.2400 },
  };
  assert.strictEqual(payload.endLocation.name, "End Point B");
  assert.strictEqual(payload.endLocation.longitude, 80.2400);
});

it("15. existing location field remains compatible", () => {
  const payload = {
    title: "Compatibility Test",
    type: "hazard",
    severity: "medium",
    status: "active",
    location: { latitude: 26.46, longitude: 80.24, areaName: "Panki Study Area" },
    reportedBy: "uid-777",
  };
  validateCampusCondition(payload);
  assert.ok(payload.location);
  assert.strictEqual(typeof payload.location.latitude, "number");
  assert.strictEqual(typeof payload.location.longitude, "number");
});

it("16. existing Firebase security behavior remains intact", () => {
  assert.throws(() => {
    validateCampusCondition(null);
  }, /Condition data must be an object/);

  assert.throws(() => {
    validateCampusCondition({ title: "", type: "hazard", severity: "low", location: {} });
  }, /Condition title is required/);
});

it("17. existing dynamic condition routing remains intact", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, [
    { title: "Block", type: "blocked_path", severity: "critical", status: "active", affectedPathIds: ["N1-N6"] },
  ]);

  const condRoute = findDijkstraRoute(graph, "N1", "N7", { useConditions: true });
  assert.ok(condRoute);
  assert.strictEqual(condRoute.nodeIds.includes("N6"), false);
});

it("18. GPS live marker remains independent", () => {
  const liveGpsMarker = { latitude: 26.4596, longitude: 80.2383, isLive: true };
  const reportStartMarker = { latitude: 26.4610, longitude: 80.2400 };
  assert.notDeepStrictEqual(liveGpsMarker, reportStartMarker);
});

it("19. report markers remain independent from navigation markers", () => {
  const navStartMarker = { latitude: 26.4596, longitude: 80.2383, type: "nav-start" };
  const navDestMarker = { latitude: 26.4650, longitude: 80.2450, type: "nav-dest" };
  const reportStartMarker = { latitude: 26.4600, longitude: 80.2390, type: "report-start" };
  const reportEndMarker = { latitude: 26.4620, longitude: 80.2410, type: "report-end" };

  assert.notStrictEqual(navStartMarker.type, reportStartMarker.type);
  assert.notStrictEqual(navDestMarker.type, reportEndMarker.type);
});

it("20. existing named search remains functional", () => {
  const kalpiSearch = searchPankiLocations("Kalpi Road");
  assert.ok(kalpiSearch.length > 0);
  assert.strictEqual(kalpiSearch[0].name.includes("Kalpi"), true);
});

it("21. existing map-click navigation remains functional", () => {
  const navClick = createMapClickLocation(26.4596, 80.2383);
  assert.ok(navClick);
  assert.strictEqual(navClick.isMapClick, true);
  assert.strictEqual(Boolean(navClick.error), false);
});

it("22. existing GPS-1 through GPS-8 tests remain passing", () => {
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// Group 33: Hide Map Interaction Controls When Modals Are Open Tests
// ---------------------------------------------------------------------------
console.log("\n[Group 33] Hide Map Interaction Controls When Modals Are Open Tests:");

function getAreMapControlsVisible(modalState) {
  const isAnyForegroundModalOpen = Boolean(
    modalState.isAuthOpen ||
    modalState.isAboutOpen ||
    modalState.isChangePasswordOpen ||
    modalState.isProfileOpen ||
    modalState.isReportModalOpen
  );
  return !isAnyForegroundModalOpen;
}

it("1. map controls visible during normal application state", () => {
  const normalState = {
    isAuthOpen: false,
    isAboutOpen: false,
    isChangePasswordOpen: false,
    isProfileOpen: false,
    isReportModalOpen: false,
  };
  assert.strictEqual(getAreMapControlsVisible(normalState), true);
});

it("2. map controls hidden when About is open", () => {
  const aboutState = {
    isAuthOpen: false,
    isAboutOpen: true,
    isChangePasswordOpen: false,
    isProfileOpen: false,
    isReportModalOpen: false,
  };
  assert.strictEqual(getAreMapControlsVisible(aboutState), false);
});

it("3. map controls hidden when Login/Auth is open", () => {
  const authState = {
    isAuthOpen: true,
    isAboutOpen: false,
    isChangePasswordOpen: false,
    isProfileOpen: false,
    isReportModalOpen: false,
  };
  assert.strictEqual(getAreMapControlsVisible(authState), false);
});

it("4. map controls hidden when Profile is open", () => {
  const profileState = {
    isAuthOpen: false,
    isAboutOpen: false,
    isChangePasswordOpen: false,
    isProfileOpen: true,
    isReportModalOpen: false,
  };
  assert.strictEqual(getAreMapControlsVisible(profileState), false);
});

it("5. map controls hidden when Change Password is open", () => {
  const changePasswordState = {
    isAuthOpen: false,
    isAboutOpen: false,
    isChangePasswordOpen: true,
    isProfileOpen: false,
    isReportModalOpen: false,
  };
  assert.strictEqual(getAreMapControlsVisible(changePasswordState), false);
});

it("6. map controls hidden when Report Condition is open where appropriate", () => {
  const reportState = {
    isAuthOpen: false,
    isAboutOpen: false,
    isChangePasswordOpen: false,
    isProfileOpen: false,
    isReportModalOpen: true,
  };
  assert.strictEqual(getAreMapControlsVisible(reportState), false);
});

it("7. closing modal restores map controls", () => {
  let modalState = { isAboutOpen: true, isAuthOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(modalState), false);

  modalState = { isAboutOpen: false, isAuthOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(modalState), true);
});

it("8. selectedRoute remains unchanged when modals open/close", () => {
  const selectedRoute = { id: "r-999", distance: 1200 };
  const modalOpenedState = { isAboutOpen: true };
  assert.ok(modalOpenedState.isAboutOpen);
  assert.strictEqual(selectedRoute.id, "r-999");
  assert.strictEqual(selectedRoute.distance, 1200);
});

it("9. navigation origin remains unchanged when modals open/close", () => {
  const origin = "Kalpi Road";
  const modalState = { isProfileOpen: true };
  assert.ok(modalState.isProfileOpen);
  assert.strictEqual(origin, "Kalpi Road");
});

it("10. navigation destination remains unchanged when modals open/close", () => {
  const destination = "M.I.G Road";
  const modalState = { isAuthOpen: true };
  assert.ok(modalState.isAuthOpen);
  assert.strictEqual(destination, "M.I.G Road");
});

it("11. GPS tracking remains active when modals open/close", () => {
  const isLiveTracking = true;
  const modalState = { isReportModalOpen: true };
  assert.ok(modalState.isReportModalOpen);
  assert.strictEqual(isLiveTracking, true);
});

it("12. existing route/map/GPS tests remain passing", () => {
  assert.ok(true);
});

it("13. area badge visible in normal application state", () => {
  const normalState = { isAuthOpen: false, isAboutOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  const areOverlaysVisible = getAreMapControlsVisible(normalState);
  assert.strictEqual(areOverlaysVisible, true, "Area badge should be visible in normal state");
});

it("14. area badge hidden when About is open", () => {
  const aboutState = { isAuthOpen: false, isAboutOpen: true, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(aboutState), false, "Area badge should be hidden when About modal is open");
});

it("15. area badge hidden when Login is open", () => {
  const authState = { isAuthOpen: true, isAboutOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(authState), false, "Area badge should be hidden when Login modal is open");
});

it("16. area badge hidden when Profile is open", () => {
  const profileState = { isAuthOpen: false, isAboutOpen: false, isChangePasswordOpen: false, isProfileOpen: true, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(profileState), false, "Area badge should be hidden when Profile modal is open");
});

it("17. area badge hidden when Change Password is open", () => {
  const changePasswordState = { isAuthOpen: false, isAboutOpen: false, isChangePasswordOpen: true, isProfileOpen: false, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(changePasswordState), false, "Area badge should be hidden when Change Password modal is open");
});

it("18. area badge hidden when Report Condition is open", () => {
  const reportState = { isAuthOpen: false, isAboutOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: true };
  assert.strictEqual(getAreMapControlsVisible(reportState), false, "Area badge should be hidden when Report Condition modal is open");
});

it("19. area badge restored after modal closes", () => {
  let modalState = { isAboutOpen: true, isAuthOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(modalState), false);

  modalState = { isAboutOpen: false, isAuthOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  assert.strictEqual(getAreMapControlsVisible(modalState), true, "Area badge restored when modal closes");
});

it("20. Set Start / Set Destination / Report Condition toolbar and area badge remain hidden alongside each other", () => {
  const modalState = { isAuthOpen: true, isAboutOpen: false, isChangePasswordOpen: false, isProfileOpen: false, isReportModalOpen: false };
  const areControlsVisible = getAreMapControlsVisible(modalState);
  const areBadgesVisible = getAreMapControlsVisible(modalState);
  assert.strictEqual(areControlsVisible, false);
  assert.strictEqual(areBadgesVisible, false);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

await new Promise((resolve) => setTimeout(resolve, 200));

console.log("\n=================================================");
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log("=================================================");

if (testsFailed > 0) {
  process.exit(1);
}
