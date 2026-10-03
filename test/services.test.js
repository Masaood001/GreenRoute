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
// Summary
// ---------------------------------------------------------------------------

console.log("\n=================================================");
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log("=================================================");

if (testsFailed > 0) {
  process.exit(1);
}
