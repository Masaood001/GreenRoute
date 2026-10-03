import assert from "node:assert";
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
} from "../src/services/index.js";
import {
  mapFirebaseEnvToAttributes,
  applyEnvironmentalDataToGraph,
  EnvironmentalAttributes,
  createCampusGraph,
  applyCampusConditionsToGraph,
  getPenalizedEdgeCost,
  findDijkstraRoute,
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
} from "../src/areas/panki/locationSearch.js";











console.log("=================================================");
console.log("GreenRoute: Running Tier 1 Local Service Unit Tests");
console.log("=================================================");

let testsPassed = 0;
let testsFailed = 0;

function it(description, fn) {
  try {
    fn();
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
// Summary
// ---------------------------------------------------------------------------

console.log("\n=================================================");
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log("=================================================");

if (testsFailed > 0) {
  process.exit(1);
}
