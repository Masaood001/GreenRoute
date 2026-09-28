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
} from "../src/services/index.js";

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
];

for (const fn of expectedFunctions) {
  it(`exports ${fn.name} as a callable function`, () => {
    assert.strictEqual(typeof fn, "function");
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n=================================================");
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log("=================================================");

if (testsFailed > 0) {
  process.exit(1);
}
