import { Graph } from './Graph.js';
import { findDijkstraRoute, findCandidateRoutes } from './router.js';
import { Route } from './models/Route.js';
import { EnvironmentalAttributes } from './models/EnvironmentalAttributes.js';
import { rankRoutes, WEIGHT_PROFILES, calculateRouteScore } from './scoring.js';

/**
 * Hardcoded sample graph representing a network with 4 distinct alternative paths
 * between Origin (Node A) and Destination (Node D) for testing pathfinding and ranking.
 * 
 * Nodes:
 * - A: Start Node (Main St Hub)
 * - B: Green Park Ave
 * - C: Industrial Blvd
 * - D: Destination Node (Eco Quarter)
 * - E: Expressway Overpass (Fast travel time)
 * - F: Canopy Greenway Path (Maximum shade & greenery)
 * 
 * Distinct Alternative Paths between A and D:
 * 1. A -> C -> D : Industrial Short Cut (Distance: 650m, Time: 390s, High pollution)
 * 2. A -> B -> D : Green Park Boulevard (Distance: 700m, Time: 420s, Clean & green)
 * 3. A -> E -> D : Expressway Direct (Distance: 750m, Time: 270s, Fastest time)
 * 4. A -> F -> D : Canopy Eco Greenway (Distance: 850m, Time: 510s, Max greenery & shade)
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
  graph.addNode('E', { lat: 37.7765, lng: -122.4190 }, { name: 'Expressway Overpass' });
  graph.addNode('F', { lat: 37.7740, lng: -122.4175 }, { name: 'Canopy Greenway Path' });

  // Path 1: Industrial (Shortest distance: 650m)
  graph.addEdge('A', 'C', 500, 300, { pollution: 80, heat: 35, greenery: 0.1, shade: 0.2 });
  graph.addEdge('C', 'D', 150, 90, { pollution: 75, heat: 33, greenery: 0.2, shade: 0.15 });

  // Path 2: Green Park (Eco balanced: 700m)
  graph.addEdge('A', 'B', 300, 180, { pollution: 20, heat: 22, greenery: 0.8, shade: 0.7 });
  graph.addEdge('B', 'D', 400, 240, { pollution: 15, heat: 20, greenery: 0.9, shade: 0.85 });

  // Path 3: Expressway (Fastest time: 270s)
  graph.addEdge('A', 'E', 350, 120, { pollution: 50, heat: 28, greenery: 0.3, shade: 0.25 });
  graph.addEdge('E', 'D', 400, 150, { pollution: 50, heat: 28, greenery: 0.4, shade: 0.35 });

  // Path 4: Canopy Eco Greenway (Max greenery & shade)
  graph.addEdge('A', 'F', 400, 240, { pollution: 10, heat: 18, greenery: 0.95, shade: 0.90 });
  graph.addEdge('F', 'D', 450, 270, { pollution: 10, heat: 18, greenery: 0.95, shade: 0.90 });

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
    console.log(`Rank ${route.rank}: [${route.id}] "${route.name}" (${route.nodeIds.join(' -> ')})`);
    console.log(`  Distance: ${route.totalDistance}m | Time: ${route.totalTime}s | Eco Score: ${route.score} / 100`);
    if (route.normalizedFactors) {
      console.log(`  Normalized Factor Scores (1.0 = optimal):`);
      console.log(`    Time      : ${route.normalizedFactors.time}`);
      console.log(`    Distance  : ${route.normalizedFactors.distance}`);
      console.log(`    Pollution : ${route.normalizedFactors.pollution}`);
      console.log(`    Heat      : ${route.normalizedFactors.heat}`);
      console.log(`    Greenery  : ${route.normalizedFactors.greenery}`);
      console.log(`    Shade     : ${route.normalizedFactors.shade}`);
    }
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

/**
 * Demonstrates generating multiple candidate routes dynamically from a graph,
 * scoring each route, ranking candidates, and verifying that changing preference weights alters the ranking.
 * 
 * @returns {boolean} True if candidate route generation & ranking test passes
 */
export function runCandidateRoutesTest() {
  console.log('\n==================================================');
  console.log('=== MULTIPLE CANDIDATE ROUTES & RANKING DEMO ===');
  console.log('==================================================');

  const graph = createDemoGraph();
  const startNode = 'A';
  const targetNode = 'D';

  // 1. Generate & rank candidate routes with Balanced preference
  const balancedCandidates = findCandidateRoutes(graph, startNode, targetNode, { preference: 'balanced' });
  logRankingProfile('1. Graph Candidate Routes - Balanced Preference', balancedCandidates);

  // 2. Generate & rank candidate routes with Time-focused preference
  const timeCandidates = findCandidateRoutes(graph, startNode, targetNode, { preference: 'time' });
  logRankingProfile('2. Graph Candidate Routes - Time-Focused Preference', timeCandidates);

  // 3. Generate & rank candidate routes with Environment-focused preference
  const ecoCandidates = findCandidateRoutes(graph, startNode, targetNode, { preference: 'environment' });
  logRankingProfile('3. Graph Candidate Routes - Environment-Focused Preference', ecoCandidates);

  // Verification assertions
  console.log('\n--- Candidate Route Generation Verification ---');
  console.log(`Generated Route Count: ${balancedCandidates.length}`);
  const multiRoutesPassed = balancedCandidates.length >= 3;
  console.log(`Multiple Routes Generated (>=3): ${multiRoutesPassed ? 'PASSED' : 'FAILED'}`);

  const timeWinner = timeCandidates[0];
  const ecoWinner = ecoCandidates[0];

  console.log(`Time Preference Rank #1 Route       : ${timeWinner.name} (${timeWinner.nodeIds.join(' -> ')}) [Score: ${timeWinner.score}]`);
  console.log(`Environment Preference Rank #1 Route: ${ecoWinner.name} (${ecoWinner.nodeIds.join(' -> ')}) [Score: ${ecoWinner.score}]`);

  const dynamicRankingPassed = timeWinner.id !== ecoWinner.id || timeWinner.nodeIds.join('->') !== ecoWinner.nodeIds.join('->');
  console.log(`Preference Weight Shift Test        : ${dynamicRankingPassed ? 'PASSED (Rank #1 route changed with user preference)' : 'FAILED'}`);

  const passed = multiRoutesPassed && dynamicRankingPassed;
  console.log(`\nCandidate Routes Test Result        : ${passed ? 'PASSED' : 'FAILED'}`);
  return passed;
}

// Execute tests when module is run directly via Node
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const dijkstraOk = runDijkstraTest();
  const scoringOk = runScoringTest();
  const candidateOk = runCandidateRoutesTest();

  if (!dijkstraOk || !scoringOk || !candidateOk) {
    process.exit(1);
  }
}
