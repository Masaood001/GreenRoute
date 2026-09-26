import { Graph } from './Graph.js';
import { findDijkstraRoute } from './router.js';
import { Route } from './models/Route.js';
import { EnvironmentalAttributes } from './models/EnvironmentalAttributes.js';
import { rankRoutes, WEIGHT_PROFILES, calculateRouteScore } from './scoring.js';

/**
 * Hardcoded sample graph representing a 4-node network for testing Dijkstra shortest path.
 * 
 * Nodes:
 * - A: Start Node (Main St Hub)
 * - B: Mid Node via Park (Longer distance, clean/green environment)
 * - C: Mid Node via Industrial (Shorter distance, dirty/hot environment)
 * - D: Destination Node (Eco Quarter)
 * 
 * Edge Distances:
 * - A -> B (300m), B -> D (400m) => Total = 700m
 * - A -> C (500m), C -> D (150m) => Total = 650m
 * 
 * Expected Shortest Path (Distance Only): A -> C -> D (650m)
 * 
 * @returns {Graph}
 */
export function createDemoGraph() {
  const graph = new Graph();

  // Add nodes with ID and geographical coordinates
  graph.addNode('A', { lat: 37.7749, lng: -122.4194 }, { name: 'Main St Hub' });
  graph.addNode('B', { lat: 37.7755, lng: -122.4180 }, { name: 'Green Park Ave' });
  graph.addNode('C', { lat: 37.7760, lng: -122.4170 }, { name: 'Industrial Blvd' });
  graph.addNode('D', { lat: 37.7770, lng: -122.4160 }, { name: 'Eco Quarter' });

  // Add edges (Source, Destination, Distance (meters), Travel Time (seconds), EnvironmentalAttributes)
  graph.addEdge('A', 'B', 300, 180, { pollution: 20, heat: 22, greenery: 0.8, shade: 0.7 });
  graph.addEdge('A', 'C', 500, 300, { pollution: 80, heat: 35, greenery: 0.1, shade: 0.2 });
  graph.addEdge('B', 'D', 400, 240, { pollution: 15, heat: 20, greenery: 0.9, shade: 0.85 });
  graph.addEdge('C', 'D', 150, 90, { pollution: 75, heat: 33, greenery: 0.2, shade: 0.15 });

  return graph;
}

/**
 * Creates a hardcoded test dataset of 3 distinct candidate routes.
 * Each route has different values for distance, travel time, pollution, heat, greenery, and shade.
 * 
 * @returns {Array<Route>}
 */
export function createCandidateRoutesDemo() {
  const routeHighway = new Route({
    id: 'route-highway',
    name: 'Highway Direct Route',
    totalDistance: 1000,
    totalTime: 600,
    aggregatedEnvironmental: new EnvironmentalAttributes({
      pollution: 75,
      heat: 34,
      greenery: 0.15,
      shade: 0.10,
    }),
  });

  const routeEcoPark = new Route({
    id: 'route-eco-park',
    name: 'Eco Park Trail Route',
    totalDistance: 1400,
    totalTime: 950,
    aggregatedEnvironmental: new EnvironmentalAttributes({
      pollution: 20,
      heat: 22,
      greenery: 0.85,
      shade: 0.80,
    }),
  });

  const routeSuburban = new Route({
    id: 'route-suburban',
    name: 'Suburban Boulevard Route',
    totalDistance: 1200,
    totalTime: 750,
    aggregatedEnvironmental: new EnvironmentalAttributes({
      pollution: 45,
      heat: 27,
      greenery: 0.50,
      shade: 0.45,
    }),
  });

  return [routeHighway, routeEcoPark, routeSuburban];
}

/**
 * Executes a basic test of the Dijkstra algorithm using the demo graph.
 * @returns {boolean} True if test passes
 */
export function runDijkstraTest() {
  const graph = createDemoGraph();
  const route = findDijkstraRoute(graph, 'A', 'D');

  console.log('\n=== Dijkstra Shortest-Path Test Output ===');
  if (!route) {
    console.error('FAILED: No route found between node A and D.');
    return false;
  }

  console.log(`Path Node Sequence: ${route.nodeIds.join(' -> ')}`);
  console.log(`Total Distance: ${route.totalDistance} meters`);
  console.log(`Total Travel Time: ${route.totalTime} seconds`);
  console.log('Aggregated Environmental Attributes:', route.aggregatedEnvironmental);

  const expectedPath = 'A -> C -> D';
  const expectedDistance = 650;
  const passed = route.nodeIds.join(' -> ') === expectedPath && route.totalDistance === expectedDistance;

  console.log(`Dijkstra Test Result: ${passed ? 'PASSED' : 'FAILED'}`);
  return passed;
}

/**
 * Helper to log candidate route ranking results.
 * @param {string} profileName 
 * @param {Array<Route>} rankedRoutes 
 */
function logRankingProfile(profileName, rankedRoutes) {
  console.log(`\n--------------------------------------------------`);
  console.log(`Profile: ${profileName}`);
  console.log(`--------------------------------------------------`);

  rankedRoutes.forEach((route) => {
    console.log(`Rank ${route.rank}: [${route.id}] "${route.name}"`);
    console.log(`  Final Composite Score: ${route.score} / 100`);
    console.log(`  Normalized Factor Scores (1.0 = optimal):`);
    console.log(`    Time      : ${route.normalizedFactors.time}`);
    console.log(`    Distance  : ${route.normalizedFactors.distance}`);
    console.log(`    Pollution : ${route.normalizedFactors.pollution}`);
    console.log(`    Heat      : ${route.normalizedFactors.heat}`);
    console.log(`    Greenery  : ${route.normalizedFactors.greenery}`);
    console.log(`    Shade     : ${route.normalizedFactors.shade}`);
  });
}

/**
 * Executes comprehensive environmental route scoring and ranking tests.
 * Demonstrates Balanced, Time-focused, and Environment-focused preference profiles,
 * as well as edge cases (min===max, missing values, invalid values).
 * 
 * @returns {boolean} True if all scoring tests pass
 */
export function runScoringTest() {
  console.log('\n==================================================');
  console.log('=== ENVIRONMENTAL ROUTE SCORING DEMO & TEST ===');
  console.log('==================================================');

  // Load candidate routes
  const candidates = createCandidateRoutesDemo();

  console.log('\n--- Candidate Routes Dataset ---');
  candidates.forEach((r) => {
    console.log(`- [${r.id}] "${r.name}" | Dist: ${r.totalDistance}m | Time: ${r.totalTime}s | Pollution: ${r.aggregatedEnvironmental.pollution} | Heat: ${r.aggregatedEnvironmental.heat}°C | Greenery: ${r.aggregatedEnvironmental.greenery} | Shade: ${r.aggregatedEnvironmental.shade}`);
  });

  // A. Balanced Weights
  const balancedRanked = rankRoutes(createCandidateRoutesDemo(), WEIGHT_PROFILES.BALANCED);
  logRankingProfile('A. Balanced Weights (Equal Priority)', balancedRanked);

  // B. Time-focused Weights
  const timeRanked = rankRoutes(createCandidateRoutesDemo(), WEIGHT_PROFILES.TIME_FOCUSED);
  logRankingProfile('B. Time-focused Weights (Priority: Speed & Distance)', timeRanked);

  // C. Environment-focused Weights
  const ecoRanked = rankRoutes(createCandidateRoutesDemo(), WEIGHT_PROFILES.ENVIRONMENT_FOCUSED);
  logRankingProfile('C. Environment-focused Weights (Priority: Air Quality, Shade, Vegetation)', ecoRanked);

  // Verify weight sensitivity
  const timeWinner = timeRanked[0].id;
  const ecoWinner = ecoRanked[0].id;

  console.log('\n--- Preference Profile Weight Sensitivity Check ---');
  console.log(`Time-Focused Winner  : [${timeRanked[0].id}] ${timeRanked[0].name}`);
  console.log(`Environment Winner   : [${ecoRanked[0].id}] ${ecoRanked[0].name}`);

  const dynamicRankingPassed = timeWinner === 'route-highway' && ecoWinner === 'route-eco-park';
  console.log(`Weight Sensitivity Test: ${dynamicRankingPassed ? 'PASSED (Changing weights updates ranking as expected)' : 'FAILED'}`);

  // Edge cases verification
  console.log('\n--- Edge Cases & Robustness Test ---');

  // Edge Case 1: Equal min/max values across routes
  const identicalRoutes = [
    new Route({ id: 'r1', totalDistance: 500, totalTime: 300 }),
    new Route({ id: 'r2', totalDistance: 500, totalTime: 300 }),
  ];
  const identicalRanked = rankRoutes(identicalRoutes, WEIGHT_PROFILES.BALANCED);
  const equalMinMaxPassed = !isNaN(identicalRanked[0].score) && identicalRanked[0].score === 100;
  console.log(`1. Equal Min/Max Normalization (no div by 0): ${equalMinMaxPassed ? 'PASSED' : 'FAILED'}`);

  // Edge Case 2: Missing environmental attributes
  const missingAttrRoute = new Route({ id: 'r-sparse', totalDistance: 800 });
  const missingAttrScore = calculateRouteScore(missingAttrRoute, WEIGHT_PROFILES.BALANCED);
  const missingAttrPassed = !isNaN(missingAttrScore) && missingAttrScore > 0;
  console.log(`2. Missing Environmental Attributes Handling: ${missingAttrPassed ? 'PASSED' : 'FAILED'}`);

  // Edge Case 3: Invalid / negative values
  const invalidValRoute = new Route({
    id: 'r-invalid',
    totalDistance: -500,
    aggregatedEnvironmental: { pollution: 'invalid_string', heat: null },
  });
  const invalidValScore = calculateRouteScore(invalidValRoute, WEIGHT_PROFILES.BALANCED);
  const invalidValPassed = !isNaN(invalidValScore);
  console.log(`3. Invalid / Negative Numeric Sanitization: ${invalidValPassed ? 'PASSED' : 'FAILED'}`);

  const allPassed = dynamicRankingPassed && equalMinMaxPassed && missingAttrPassed && invalidValPassed;
  console.log(`\nOverall Scoring Test Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  return allPassed;
}

// Execute tests when module is run directly via Node
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const dijkstraOk = runDijkstraTest();
  const scoringOk = runScoringTest();

  if (!dijkstraOk || !scoringOk) {
    process.exit(1);
  }
}
