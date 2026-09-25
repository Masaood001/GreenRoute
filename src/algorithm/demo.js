import { Graph } from './Graph.js';
import { findDijkstraRoute } from './router.js';

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
 * Executes a basic test of the Dijkstra algorithm using the demo graph.
 * @returns {boolean} True if test passes
 */
export function runDijkstraTest() {
  const graph = createDemoGraph();
  const route = findDijkstraRoute(graph, 'A', 'D');

  console.log('=== Dijkstra Shortest-Path Test Output ===');
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

  console.log(`Test Result: ${passed ? 'PASSED' : 'FAILED'}`);
  return passed;
}

// Run test directly when executed via node
runDijkstraTest();
