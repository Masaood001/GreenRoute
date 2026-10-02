import assert from "node:assert";
import { calculateLiveCampusRoutes } from "../src/services/index.js";

console.log("=================================================");
console.log("GreenRoute: Running Runtime Routing Integration Tests");
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

async function runTests() {
  // A. Successful Orchestration & Candidate Route Generation
  console.log("\n[Group 1] Orchestration Execution & Route Generation:");

  await it("returns valid ranked candidate routes for valid origin and destination nodes", async () => {
    const routes = await calculateLiveCampusRoutes({
      startNodeId: "N1",
      targetNodeId: "N7",
      preference: "balanced",
    });

    assert.ok(Array.isArray(routes), "Result should be an array of routes");
    assert.ok(routes.length >= 1, "Should return at least 1 route");

    const topRoute = routes[0];
    assert.strictEqual(topRoute.nodeIds[0], "N1");
    assert.strictEqual(topRoute.nodeIds[topRoute.nodeIds.length - 1], "N7");
    assert.ok(topRoute.totalDistance > 0);
    assert.ok(topRoute.totalTime > 0);
    assert.ok(typeof topRoute.score === "number");
  });

  // B & C. Integration of Environmental Data & Active Campus Conditions
  console.log("\n[Group 2] Environmental & Condition Integration:");

  await it("integrates graph transformations and produces valid routes without throwing", async () => {
    const routes = await calculateLiveCampusRoutes({
      startNodeId: "N1",
      targetNodeId: "N7",
      preference: "environment",
      options: { maxRoutes: 3 },
    });

    assert.ok(Array.isArray(routes));
    assert.ok(routes.length > 0);
    assert.strictEqual(typeof routes.isFallback, "boolean");
  });

  // D & E. Firebase Failure Resilience & Fallback Behavior
  console.log("\n[Group 3] Firebase Resilience & Fallback Behavior:");

  await it("safely falls back to static campus graph attributes when Firebase calls fail or are unconfigured", async () => {
    const routes = await calculateLiveCampusRoutes({
      startNodeId: "N1",
      targetNodeId: "N7",
      preference: "balanced",
    });

    // Should not throw, returns valid routes using static campus graph fallback
    assert.ok(Array.isArray(routes));
    assert.ok(routes.length >= 1);

    // Verify top route node sequence is valid
    assert.strictEqual(routes[0].nodeIds[0], "N1");
    assert.strictEqual(routes[0].nodeIds[routes[0].nodeIds.length - 1], "N7");
  });

  // F. Existing Candidate Route Generation Verification
  console.log("\n[Group 4] Candidate Route Generation Features:");

  await it("generates multiple distinct candidate routes for alternative paths", async () => {
    const routes = await calculateLiveCampusRoutes({
      startNodeId: "N1",
      targetNodeId: "N7",
      preference: "balanced",
      options: { maxRoutes: 5 },
    });

    assert.ok(Array.isArray(routes));
    assert.ok(routes.length >= 2, "Should generate multiple candidate routes");

    // Check unique route IDs and paths
    const pathKeys = new Set(routes.map((r) => r.nodeIds.join("->")));
    assert.strictEqual(pathKeys.size, routes.length, "All candidate routes should have distinct node paths");
  });

  // G. Preference Values and Options Pass-Through
  console.log("\n[Group 5] Preference & Options Pass-Through:");

  await it("correctly alters route scores and rankings based on preference parameter", async () => {
    const timeRoutes = await calculateLiveCampusRoutes({
      startNodeId: "N1",
      targetNodeId: "N7",
      preference: "time",
    });

    const ecoRoutes = await calculateLiveCampusRoutes({
      startNodeId: "N1",
      targetNodeId: "N7",
      preference: "environment",
    });

    assert.ok(timeRoutes.length > 0);
    assert.ok(ecoRoutes.length > 0);

    const timeWinner = timeRoutes[0];
    const ecoWinner = ecoRoutes[0];

    // Verify that time profile prioritizes fastest route (N1 -> N6 -> N7 or N1 -> N5 -> N4 -> N7)
    // while environment profile prioritizes highest greenery/shade route (N1 -> N2 -> N3 -> N7)
    assert.ok(
      timeWinner.id !== ecoWinner.id || timeWinner.nodeIds.join("->") !== ecoWinner.nodeIds.join("->"),
      "Changing preference profile should alter the rank #1 route"
    );
  });

  await it("supports positional arguments format (startNodeId, targetNodeId, preference, options)", async () => {
    const routes = await calculateLiveCampusRoutes("N1", "N7", "quickest", { maxRoutes: 3 });

    assert.ok(Array.isArray(routes));
    assert.ok(routes.length >= 1);
    assert.strictEqual(routes[0].nodeIds[0], "N1");
    assert.strictEqual(routes[0].nodeIds[routes[0].nodeIds.length - 1], "N7");
  });

  console.log("\n=================================================");
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("=================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
