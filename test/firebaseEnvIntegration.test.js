import assert from 'node:assert';
import {
  createCampusGraph,
  applyEnvironmentalDataToGraph,
  findCandidateRoutes,
} from '../src/algorithm/index.js';

console.log('=================================================');
console.log('GreenRoute: Running Firebase Env Integration Tests');
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

// ---------------------------------------------------------------------------
// A & B. Firebase Record Zone Updates
// ---------------------------------------------------------------------------
console.log('\n[Group 1] Zone Matching & Attribute Mapping:');

it('updates matching graph edges by zoneId with correct mapped environmental attributes', () => {
  const graph = createCampusGraph();
  const envRecords = [
    {
      zoneId: 'zone_central_quad',
      airQuality: { aqi: 150 },
      temperature: { celsius: 24.5 },
      shade: { score: 85 },
      greenery: { score: 90 },
    },
  ];

  applyEnvironmentalDataToGraph(graph, envRecords);

  // Check matched edges (N1-N2 and N2-N3 belong to zone_central_quad)
  const edgeN1N2 = graph.getNeighbors('N1').find((e) => e.targetId === 'N2');
  const edgeN2N3 = graph.getNeighbors('N2').find((e) => e.targetId === 'N3');

  assert.ok(edgeN1N2, 'Edge N1-N2 should exist');
  assert.ok(edgeN2N3, 'Edge N2-N3 should exist');

  assert.strictEqual(edgeN1N2.environmentalAttributes.pollution, 150);
  assert.strictEqual(edgeN1N2.environmentalAttributes.heat, 24.5);
  assert.strictEqual(edgeN1N2.environmentalAttributes.shade, 0.85);
  assert.strictEqual(edgeN1N2.environmentalAttributes.greenery, 0.90);

  assert.strictEqual(edgeN2N3.environmentalAttributes.pollution, 150);
  assert.strictEqual(edgeN2N3.environmentalAttributes.heat, 24.5);
  assert.strictEqual(edgeN2N3.environmentalAttributes.shade, 0.85);
  assert.strictEqual(edgeN2N3.environmentalAttributes.greenery, 0.90);
});

// ---------------------------------------------------------------------------
// C. Unmatched ZoneId Behavior
// ---------------------------------------------------------------------------
console.log('\n[Group 2] Unmatched Zone Handling:');

it('does not throw and does not modify unrelated edges when zoneId is unmatched', () => {
  const graph = createCampusGraph();
  const initialN1N6Pollution = graph.getNeighbors('N1').find((e) => e.targetId === 'N6').environmentalAttributes.pollution;

  const envRecords = [
    {
      zoneId: 'zone_unknown_outer_space',
      airQuality: { aqi: 500 },
      temperature: { celsius: 50 },
    },
  ];

  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(graph, envRecords));

  const edgeN1N6 = graph.getNeighbors('N1').find((e) => e.targetId === 'N6');
  assert.strictEqual(edgeN1N6.environmentalAttributes.pollution, initialN1N6Pollution);
});

// ---------------------------------------------------------------------------
// D. Null / Undefined / Empty Input Behavior
// ---------------------------------------------------------------------------
console.log('\n[Group 3] Robustness & Guard Clause Verification:');

it('safely handles null, undefined, empty array, or invalid environmental data without throwing', () => {
  const graph = createCampusGraph();
  const initialN1N2Pollution = graph.getNeighbors('N1').find((e) => e.targetId === 'N2').environmentalAttributes.pollution;

  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(graph, null));
  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(graph, undefined));
  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(graph, []));
  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(graph, [null, undefined, {}, { zoneId: '' }]));
  assert.doesNotThrow(() => applyEnvironmentalDataToGraph(null, [{ zoneId: 'zone_central_quad' }]));

  const edgeN1N2 = graph.getNeighbors('N1').find((e) => e.targetId === 'N2');
  assert.strictEqual(edgeN1N2.environmentalAttributes.pollution, initialN1N2Pollution);
});

// ---------------------------------------------------------------------------
// E. Simulated Metadata Preservation
// ---------------------------------------------------------------------------
console.log('\n[Group 4] Simulation Metadata Propagation:');

it('preserves isSimulated, source, and disclaimer metadata when available', () => {
  const graph = createCampusGraph();
  const envRecords = [
    {
      zoneId: 'zone_sports_complex',
      airQuality: { aqi: 48 },
      temperature: { celsius: 26.2 },
      shade: { score: 15 },
      greenery: { score: 45 },
      isSimulated: true,
      source: 'SIMULATED_CAMPUS_BENCHMARK',
      disclaimer: 'SIMULATED DATA FOR DEVELOPMENT ONLY',
    },
  ];

  applyEnvironmentalDataToGraph(graph, envRecords);

  const edgeN1N5 = graph.getNeighbors('N1').find((e) => e.targetId === 'N5');
  assert.ok(edgeN1N5);
  assert.strictEqual(edgeN1N5.metadata.isSimulated, true);
  assert.strictEqual(edgeN1N5.metadata.source, 'SIMULATED_CAMPUS_BENCHMARK');
  assert.strictEqual(edgeN1N5.metadata.disclaimer, 'SIMULATED DATA FOR DEVELOPMENT ONLY');
  assert.strictEqual(edgeN1N5.metadata.zoneId, 'zone_sports_complex');
});

// ---------------------------------------------------------------------------
// F. Static Fallback Preservation
// ---------------------------------------------------------------------------
console.log('\n[Group 5] Static Fallback Retention:');

it('preserves static graph attributes as fallback for edges without a matching record', () => {
  const graph = createCampusGraph();
  const staticN1N5Pollution = graph.getNeighbors('N1').find((e) => e.targetId === 'N5').environmentalAttributes.pollution;

  // Only update zone_hostel_avenue
  applyEnvironmentalDataToGraph(graph, [
    {
      zoneId: 'zone_hostel_avenue',
      airQuality: { aqi: 99 },
    },
  ]);

  // zone_hostel_avenue edge updated
  const edgeN1N6 = graph.getNeighbors('N1').find((e) => e.targetId === 'N6');
  assert.strictEqual(edgeN1N6.environmentalAttributes.pollution, 99);

  // zone_sports_complex edge (N1-N5) unchanged fallback
  const edgeN1N5 = graph.getNeighbors('N1').find((e) => e.targetId === 'N5');
  assert.strictEqual(edgeN1N5.environmentalAttributes.pollution, staticN1N5Pollution);
});

// ---------------------------------------------------------------------------
// G. Dynamic Route Scoring / Ranking Impact
// ---------------------------------------------------------------------------
console.log('\n[Group 6] Dynamic Route Scoring & Ranking Sensitivity:');

it('affects candidate route environmental scoring and ranking when Firebase data is applied', () => {
  const baselineGraph = createCampusGraph();
  const baselineCandidates = findCandidateRoutes(baselineGraph, 'N1', 'N7', { preference: 'environment' });

  // Update zone_central_quad (which is on the Eco Quad path N1->N2->N3->N7) with severe pollution
  const pollutedGraph = createCampusGraph();
  applyEnvironmentalDataToGraph(pollutedGraph, [
    {
      zoneId: 'zone_central_quad',
      airQuality: { aqi: 350 }, // Hazardous pollution
      temperature: { celsius: 42 },
      shade: { score: 0 },
      greenery: { score: 0 },
    },
  ]);

  const updatedCandidates = findCandidateRoutes(pollutedGraph, 'N1', 'N7', { preference: 'environment' });

  // Find Eco Quad route in both
  const baselineEcoRoute = baselineCandidates.find((r) => r.nodeIds.includes('N2'));
  const updatedEcoRoute = updatedCandidates.find((r) => r.nodeIds.includes('N2'));

  assert.ok(baselineEcoRoute);
  assert.ok(updatedEcoRoute);

  // Pollution on aggregated attributes should be significantly higher now
  assert.ok(updatedEcoRoute.aggregatedEnvironmental.pollution > baselineEcoRoute.aggregatedEnvironmental.pollution);
  // Eco score for that route should drop
  assert.ok(updatedEcoRoute.score < baselineEcoRoute.score);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n=================================================');
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('=================================================');

if (testsFailed > 0) {
  process.exit(1);
}
