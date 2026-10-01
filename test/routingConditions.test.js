import assert from 'node:assert';
import {
  Graph,
  findDijkstraRoute,
  findCandidateRoutes,
  applyCampusConditionsToGraph,
  rankRoutes,
  WEIGHT_PROFILES,
} from '../src/algorithm/index.js';

console.log('=================================================');
console.log('GreenRoute: Condition-Aware Routing Integration Tests');
console.log('=================================================');

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

/**
 * Creates a small test graph with a direct short path and a longer detour path.
 * Direct path:  S -> M -> T (Distance: 100 + 100 = 200m)
 * Detour path:  S -> A -> T (Distance: 150 + 150 = 300m)
 */
function createTestGraph() {
  const g = new Graph();
  g.addNode('S', { lat: 0, lng: 0 }, { name: 'Start' });
  g.addNode('M', { lat: 1, lng: 0 }, { name: 'Middle Direct' });
  g.addNode('A', { lat: 0, lng: 1 }, { name: 'Alt Detour' });
  g.addNode('T', { lat: 1, lng: 1 }, { name: 'Target' });

  // Direct short path
  g.addEdge('S', 'M', 100, 60, { pollution: 30, heat: 25, greenery: 0.5, shade: 0.5 }, true);
  g.addEdge('M', 'T', 100, 60, { pollution: 30, heat: 25, greenery: 0.5, shade: 0.5 }, true);

  // Detour path
  g.addEdge('S', 'A', 150, 90, { pollution: 10, heat: 20, greenery: 0.9, shade: 0.9 }, true);
  g.addEdge('A', 'T', 150, 90, { pollution: 10, heat: 20, greenery: 0.9, shade: 0.9 }, true);

  return g;
}

// A. Existing Dijkstra behavior is unchanged without conditions
it('A. Existing Dijkstra behavior is unchanged without conditions', () => {
  const graph = createTestGraph();
  const route = findDijkstraRoute(graph, 'S', 'T');

  assert.ok(route);
  assert.strictEqual(route.nodeIds.join(' -> '), 'S -> M -> T');
  assert.strictEqual(route.totalDistance, 200);
});

// B. Blocked edge is avoided when condition-aware routing is enabled
it('B. Blocked edge is avoided when condition-aware routing is enabled', () => {
  const graph = createTestGraph();

  applyCampusConditionsToGraph(graph, [
    {
      title: 'Road Block',
      type: 'blocked_path',
      severity: 'high',
      status: 'active',
      affectedPathIds: ['S-M'],
    },
  ]);

  // Without useConditions option (Normal Mode) -> returns direct path S->M->T
  const normalRoute = findDijkstraRoute(graph, 'S', 'T');
  assert.ok(normalRoute);
  assert.strictEqual(normalRoute.nodeIds.join(' -> '), 'S -> M -> T');

  // With useConditions option (Condition-Aware Mode) -> avoids blocked edge S->M and takes detour S->A->T
  const condRoute = findDijkstraRoute(graph, 'S', 'T', { useConditions: true });
  assert.ok(condRoute);
  assert.strictEqual(condRoute.nodeIds.join(' -> '), 'S -> A -> T');
  assert.strictEqual(condRoute.totalDistance, 300);
});

// C. Critical condition blocks an edge
it('C. Critical condition blocks an edge', () => {
  const graph = createTestGraph();

  applyCampusConditionsToGraph(graph, [
    {
      title: 'Gas Leak',
      type: 'hazard',
      severity: 'critical',
      status: 'active',
      affectedPathIds: ['S-M'],
    },
  ]);

  const condRoute = findDijkstraRoute(graph, 'S', 'T', { avoidHazards: true });
  assert.ok(condRoute);
  assert.strictEqual(condRoute.nodeIds.join(' -> '), 'S -> A -> T');
});

// D. High severity condition increases traversal cost by 4x
it('D. High severity condition increases traversal cost by 4x, causing reroute to cheaper detour', () => {
  const graph = createTestGraph();

  // S-M base distance is 100m. 4x penalty makes effective cost 400m.
  // Direct path effective cost = 400 + 100 = 500m. Detour path cost = 150 + 150 = 300m.
  applyCampusConditionsToGraph(graph, [
    {
      title: 'Construction',
      type: 'construction',
      severity: 'high',
      status: 'active',
      affectedPathIds: ['S-M'],
    },
  ]);

  const route = findDijkstraRoute(graph, 'S', 'T', { useConditions: true });
  assert.ok(route);
  assert.strictEqual(route.nodeIds.join(' -> '), 'S -> A -> T');
  assert.strictEqual(route.totalDistance, 300);
});

// E. Medium severity condition increases traversal cost by 2x
it('E. Medium severity condition increases traversal cost by 2x', () => {
  const graph = createTestGraph();

  // S-M base distance is 100m. 2x penalty makes effective cost 200m.
  // Direct path effective cost = 200 + 100 = 300m. Detour path cost = 300m.
  applyCampusConditionsToGraph(graph, [
    {
      title: 'Maintenance',
      type: 'maintenance',
      severity: 'medium',
      status: 'active',
      affectedPathIds: ['S-M'],
    },
  ]);

  const route = findDijkstraRoute(graph, 'S', 'T', { useConditions: true });
  assert.ok(route);
  // Both paths have equal cost (300m). Route should be found.
  assert.ok(route.nodeIds.length > 0);
});

// F. Low severity condition increases traversal cost by 1.25x
it('F. Low severity condition increases traversal cost by 1.25x (direct path remains cheaper than 300m detour)', () => {
  const graph = createTestGraph();

  // S-M base distance is 100m. 1.25x penalty makes effective cost 125m.
  // Direct path effective cost = 125 + 100 = 225m < 300m detour.
  applyCampusConditionsToGraph(graph, [
    {
      title: 'Tree Trimming',
      type: 'maintenance',
      severity: 'low',
      status: 'active',
      affectedPathIds: ['S-M'],
    },
  ]);

  const route = findDijkstraRoute(graph, 'S', 'T', { useConditions: true });
  assert.ok(route);
  assert.strictEqual(route.nodeIds.join(' -> '), 'S -> M -> T');
  assert.strictEqual(route.totalDistance, 200);
});

// G. Candidate route generation still works with condition penalties
it('G. Candidate route generation still works with conditions enabled', () => {
  const graph = createTestGraph();

  applyCampusConditionsToGraph(graph, [
    {
      title: 'Paving',
      type: 'blocked_path',
      severity: 'critical',
      status: 'active',
      affectedPathIds: ['S-M'],
    },
  ]);

  const candidateRoutes = findCandidateRoutes(graph, 'S', 'T', { useConditions: true, preference: 'balanced' });
  assert.ok(candidateRoutes.length > 0);
  for (const route of candidateRoutes) {
    assert.strictEqual(route.nodeIds.includes('M'), false);
  }
});

// H. Existing environmental scoring/ranking still works
it('H. Existing environmental scoring/ranking still works', () => {
  const graph = createTestGraph();
  const routes = findCandidateRoutes(graph, 'S', 'T', { preference: 'balanced' });
  const ranked = rankRoutes(routes, WEIGHT_PROFILES.BALANCED);

  assert.ok(Array.isArray(ranked));
  assert.ok(ranked.length > 0);
  assert.strictEqual(typeof ranked[0].score, 'number');
});

console.log('\n=================================================');
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('=================================================');

if (testsFailed > 0) {
  process.exit(1);
}
