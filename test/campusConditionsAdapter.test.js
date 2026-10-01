import assert from "node:assert";
import {
  createCampusGraph,
  applyCampusConditionsToGraph,
  getPenalizedEdgeCost,
} from "../src/algorithm/index.js";

console.log("=================================================");
console.log("GreenRoute: Running Campus Conditions Adapter Unit Tests");
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

// A. Blocked Path Test
it("A. Blocked path: active blocked_path marks edge as blocked with Infinity penalty", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Paving Work",
      type: "blocked_path",
      severity: "medium",
      status: "active",
      affectedPathIds: ["N1-N6"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edgeN1N6 = graph.getNeighbors("N1").find((e) => e.targetId === "N6");
  const edgeN6N1 = graph.getNeighbors("N6").find((e) => e.targetId === "N1");

  assert.ok(edgeN1N6);
  assert.strictEqual(edgeN1N6.isBlocked, true);
  assert.strictEqual(edgeN1N6.penaltyMultiplier, Infinity);

  assert.ok(edgeN6N1);
  assert.strictEqual(edgeN6N1.isBlocked, true);
  assert.strictEqual(edgeN6N1.penaltyMultiplier, Infinity);
});

// B. Critical Condition Test
it("B. Critical condition: active critical severity marks edge as blocked with Infinity penalty", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Chemical Spill",
      type: "hazard",
      severity: "critical",
      status: "active",
      affectedPathIds: ["N1-N2"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edge = graph.getNeighbors("N1").find((e) => e.targetId === "N2");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, true);
  assert.strictEqual(edge.penaltyMultiplier, Infinity);
});

// C. High Severity Test
it("C. High severity: active high severity condition sets penaltyMultiplier to 4.0", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Fallen Tree Branch",
      type: "hazard",
      severity: "high",
      status: "active",
      affectedPathIds: ["N1-N2"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edge = graph.getNeighbors("N1").find((e) => e.targetId === "N2");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, false);
  assert.strictEqual(edge.penaltyMultiplier, 4.0);
});

// D. Medium Severity Test
it("D. Medium severity: active medium severity condition sets penaltyMultiplier to 2.0", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Sidewalk Resurfacing",
      type: "construction",
      severity: "medium",
      status: "active",
      affectedPathIds: ["N2-N3"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edge = graph.getNeighbors("N2").find((e) => e.targetId === "N3");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, false);
  assert.strictEqual(edge.penaltyMultiplier, 2.0);
});

// E. Low Severity Test
it("E. Low severity: active low severity condition sets penaltyMultiplier to 1.25", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Grass Mowing",
      type: "maintenance",
      severity: "low",
      status: "active",
      affectedPathIds: ["N3-N7"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edge = graph.getNeighbors("N3").find((e) => e.targetId === "N7");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, false);
  assert.strictEqual(edge.penaltyMultiplier, 1.25);
});

// F. Scheduled Condition Test
it("F. Scheduled condition: status === 'scheduled' has no effect on graph edges", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Future Event",
      type: "blocked_path",
      severity: "critical",
      status: "scheduled",
      affectedPathIds: ["N1-N6"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edge = graph.getNeighbors("N1").find((e) => e.targetId === "N6");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, false);
  assert.strictEqual(edge.penaltyMultiplier, 1.0);
  assert.strictEqual(edge.activeConditions.length, 0);
});

// G. Resolved Condition Test
it("G. Resolved condition: status === 'resolved' has no effect on graph edges", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Cleared Hazard",
      type: "blocked_path",
      severity: "critical",
      status: "resolved",
      affectedPathIds: ["N1-N6"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edge = graph.getNeighbors("N1").find((e) => e.targetId === "N6");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, false);
  assert.strictEqual(edge.penaltyMultiplier, 1.0);
  assert.strictEqual(edge.activeConditions.length, 0);
});

// H. Node ID Mapping Test
it("H. Node ID mapping: affectedPathIds: ['N1'] affects all edges connected to N1", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "North Gate Plaza Construction",
      type: "construction",
      severity: "high",
      status: "active",
      affectedPathIds: ["N1"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const n1Edges = graph.getNeighbors("N1");
  assert.ok(n1Edges.length >= 3);
  for (const edge of n1Edges) {
    assert.strictEqual(edge.penaltyMultiplier, 4.0);
    assert.strictEqual(edge.activeConditions.length, 1);
  }

  // Edge N2->N3 should be unaffected
  const n2n3Edge = graph.getNeighbors("N2").find((e) => e.targetId === "N3");
  assert.ok(n2n3Edge);
  assert.strictEqual(n2n3Edge.penaltyMultiplier, 1.0);
});

// I. Bidirectional Mapping Test
it("I. Bidirectional mapping: condition 'N1-N6' affects both directions (N1->N6 and N6->N1)", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Bypass Work",
      type: "construction",
      severity: "medium",
      status: "active",
      affectedPathIds: ["N1-N6"],
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const fwd = graph.getNeighbors("N1").find((e) => e.targetId === "N6");
  const rev = graph.getNeighbors("N6").find((e) => e.targetId === "N1");

  assert.ok(fwd);
  assert.ok(rev);
  assert.strictEqual(fwd.penaltyMultiplier, 2.0);
  assert.strictEqual(rev.penaltyMultiplier, 2.0);
});

// J. Multiple Conditions Priority Test
it("J. Multiple conditions: blocked/critical takes priority; highest penalty used otherwise", () => {
  const graph = createCampusGraph();
  const conditions = [
    { title: "Low Maintenance", type: "maintenance", severity: "low", status: "active", affectedPathIds: ["N1-N2"] },
    { title: "High Hazard", type: "hazard", severity: "high", status: "active", affectedPathIds: ["N1-N2"] },
    { title: "Medium Construction", type: "construction", severity: "medium", status: "active", affectedPathIds: ["N1-N2"] },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  const edge = graph.getNeighbors("N1").find((e) => e.targetId === "N2");
  assert.ok(edge);
  assert.strictEqual(edge.isBlocked, false);
  assert.strictEqual(edge.penaltyMultiplier, 4.0);
  assert.strictEqual(edge.activeConditions.length, 3);

  // Now add a blocked condition
  const conditionsWithBlock = [
    ...conditions,
    { title: "Blockage", type: "blocked_path", severity: "low", status: "active", affectedPathIds: ["N1-N2"] },
  ];

  applyCampusConditionsToGraph(graph, conditionsWithBlock);
  assert.strictEqual(edge.isBlocked, true);
  assert.strictEqual(edge.penaltyMultiplier, Infinity);
  assert.strictEqual(edge.activeConditions.length, 4);
});

// K. Invalid/Null Inputs Test
it("K. Invalid/null inputs: does not crash on null/undefined graph or conditions", () => {
  assert.doesNotThrow(() => applyCampusConditionsToGraph(null, null));
  assert.doesNotThrow(() => applyCampusConditionsToGraph(undefined, []));
  assert.doesNotThrow(() => applyCampusConditionsToGraph(createCampusGraph(), null));
  assert.doesNotThrow(() => applyCampusConditionsToGraph(createCampusGraph(), [null, {}, undefined]));
});

// L. Baseline Test
it("L. Baseline: no active conditions leaves all edges unblocked with multiplier 1.0", () => {
  const graph = createCampusGraph();
  applyCampusConditionsToGraph(graph, []);

  for (const node of graph.getAllNodes()) {
    for (const edge of graph.getNeighbors(node.id)) {
      assert.strictEqual(edge.isBlocked, false);
      assert.strictEqual(edge.penaltyMultiplier, 1.0);
      assert.deepStrictEqual(edge.activeConditions, []);
    }
  }
});

// M. Cost Helper Test
it("M. Cost helper: getPenalizedEdgeCost returns baseCost * multiplier or Infinity for blocked edges", () => {
  const edgeNormal = { distance: 200, penaltyMultiplier: 1.0, isBlocked: false };
  const edgeHigh = { distance: 200, penaltyMultiplier: 4.0, isBlocked: false };
  const edgeBlocked = { distance: 200, penaltyMultiplier: Infinity, isBlocked: true };

  const costNormal = getPenalizedEdgeCost(edgeNormal);
  const costHigh = getPenalizedEdgeCost(edgeHigh);
  const costBlocked = getPenalizedEdgeCost(edgeBlocked);

  assert.strictEqual(costNormal, 200);
  assert.strictEqual(costHigh, 800);
  assert.strictEqual(costBlocked, Infinity);

  // Custom base cost evaluator
  const customCost = getPenalizedEdgeCost(edgeHigh, (e) => e.distance / 2);
  assert.strictEqual(customCost, 400);
});

// N. Location AreaName Fallback Tests
it("N1. Fallback: condition with empty affectedPathIds and matching location.areaName applies to correct edges", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Student Life Arcade Maintenance",
      type: "maintenance",
      severity: "medium",
      status: "active",
      affectedPathIds: [],
      location: { latitude: 37.7745, longitude: -122.416, areaName: "Student Life Center" },
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  // Student Life Center corresponds to node N6. Edges connected to N6 must be penalized with 2.0
  const n6Edges = graph.getNeighbors("N6");
  assert.ok(n6Edges.length > 0);
  for (const edge of n6Edges) {
    assert.strictEqual(edge.penaltyMultiplier, 2.0);
    assert.strictEqual(edge.activeConditions.length, 1);
  }

  // Unrelated edge N1-N2 should be unaffected (multiplier 1.0)
  const n1n2Edge = graph.getNeighbors("N1").find((e) => e.targetId === "N2");
  assert.ok(n1n2Edge);
  assert.strictEqual(n1n2Edge.penaltyMultiplier, 1.0);
});

it("N2. Fallback: condition with unmatched affectedPathIds falls back to location.areaName matching", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Quad Walkway Resurfacing",
      type: "construction",
      severity: "high",
      status: "active",
      affectedPathIds: ["unmatched_path_key_xyz"],
      location: { latitude: 37.775, longitude: -122.418, areaName: "Central Quad Plaza" },
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  // Central Quad Plaza corresponds to node N2. Edges connected to N2 must be penalized with 4.0
  const n2Edges = graph.getNeighbors("N2");
  assert.ok(n2Edges.length > 0);
  for (const edge of n2Edges) {
    assert.strictEqual(edge.penaltyMultiplier, 4.0);
  }
});

it("N3. Fallback: condition with missing or null location does not crash", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Null Location Test",
      type: "hazard",
      severity: "high",
      status: "active",
      affectedPathIds: [],
      location: null,
    },
    {
      title: "Undefined Location Test",
      type: "hazard",
      severity: "high",
      status: "active",
      affectedPathIds: [],
    },
  ];

  assert.doesNotThrow(() => applyCampusConditionsToGraph(graph, conditions));

  for (const node of graph.getAllNodes()) {
    for (const edge of graph.getNeighbors(node.id)) {
      assert.strictEqual(edge.isBlocked, false);
      assert.strictEqual(edge.penaltyMultiplier, 1.0);
    }
  }
});

it("N4. Fallback: condition with unknown areaName does not crash and does not affect unrelated edges", () => {
  const graph = createCampusGraph();
  const conditions = [
    {
      title: "Unknown Spot",
      type: "hazard",
      severity: "high",
      status: "active",
      affectedPathIds: [],
      location: { latitude: 0, longitude: 0, areaName: "Galactic Space Station 99" },
    },
  ];

  applyCampusConditionsToGraph(graph, conditions);

  for (const node of graph.getAllNodes()) {
    for (const edge of graph.getNeighbors(node.id)) {
      assert.strictEqual(edge.isBlocked, false);
      assert.strictEqual(edge.penaltyMultiplier, 1.0);
      assert.strictEqual(edge.activeConditions.length, 0);
    }
  }
});

console.log("\n=================================================");
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log("=================================================");

if (testsFailed > 0) {
  process.exit(1);
}

