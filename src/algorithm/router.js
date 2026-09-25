import { Route } from './models/Route.js';
import { EnvironmentalAttributes } from './models/EnvironmentalAttributes.js';

/**
 * Priority queue helper using a simple array sorted by priority.
 * Suitable for small-to-medium routing graphs.
 */
class PriorityQueue {
  constructor() {
    this.elements = [];
  }

  enqueue(element, priority) {
    this.elements.push({ element, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    return this.elements.shift()?.element;
  }

  isEmpty() {
    return this.elements.length === 0;
  }
}

/**
 * Computes the shortest path between startNodeId and targetNodeId using Dijkstra's algorithm.
 * Modular cost function allows distance optimization now and eco-weighted optimization later.
 * 
 * @param {import('./Graph.js').Graph} graph - The road network graph
 * @param {string|number} startNodeId - Origin node ID
 * @param {string|number} targetNodeId - Destination node ID
 * @param {Object} [options]
 * @param {Function} [options.costFn] - Custom edge weight function (defaults to edge distance)
 * @returns {Route|null} Computed route object or null if no path exists
 */
export function findDijkstraRoute(graph, startNodeId, targetNodeId, options = {}) {
  // Validate presence of origin and destination nodes
  if (!graph.hasNode(startNodeId) || !graph.hasNode(targetNodeId)) {
    return null;
  }

  // Cost evaluator function (defaults to distance optimization)
  const getCost = options.costFn || ((edge) => edge.distance);

  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();

  // Initialize distances for all nodes in the graph to Infinity
  for (const node of graph.getAllNodes()) {
    distances.set(node.id, Infinity);
  }

  // Distance from start to start is 0
  distances.set(startNodeId, 0);
  pq.enqueue(startNodeId, 0);

  while (!pq.isEmpty()) {
    const currentId = pq.dequeue();

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Stop early if target node is reached
    if (currentId === targetNodeId) break;

    const currentDistance = distances.get(currentId);
    if (currentDistance === Infinity) break;

    // Explore outgoing neighbor edges
    const edges = graph.getNeighbors(currentId);
    for (const edge of edges) {
      const neighborId = edge.targetId;
      if (visited.has(neighborId)) continue;

      const edgeCost = getCost(edge);
      const newDistance = currentDistance + edgeCost;

      // Relaxation step
      if (newDistance < distances.get(neighborId)) {
        distances.set(neighborId, newDistance);
        previous.set(neighborId, { parentId: currentId, edge });
        pq.enqueue(neighborId, newDistance);
      }
    }
  }

  // Destination unreachable
  if (distances.get(targetNodeId) === Infinity) {
    return null;
  }

  // Reconstruct path from target back to start
  const nodeIds = [];
  const edges = [];
  let curr = targetNodeId;

  while (curr !== undefined) {
    nodeIds.unshift(curr);
    const prevEntry = previous.get(curr);
    if (prevEntry) {
      edges.unshift(prevEntry.edge);
      curr = prevEntry.parentId;
    } else {
      break;
    }
  }

  // Aggregate distance, travel time, and environmental attributes
  let totalDistance = 0;
  let totalTime = 0;
  let totalPollution = 0;
  let totalHeat = 0;
  let totalGreenery = 0;
  let totalShade = 0;

  for (const edge of edges) {
    totalDistance += edge.distance;
    totalTime += edge.time;
    totalPollution += edge.environmentalAttributes.pollution;
    totalHeat += edge.environmentalAttributes.heat;
    totalGreenery += edge.environmentalAttributes.greenery;
    totalShade += edge.environmentalAttributes.shade;
  }

  const edgeCount = edges.length || 1;
  const aggregatedEnvironmental = new EnvironmentalAttributes({
    pollution: Number((totalPollution / edgeCount).toFixed(2)),
    heat: Number((totalHeat / edgeCount).toFixed(2)),
    greenery: Number((totalGreenery / edgeCount).toFixed(2)),
    shade: Number((totalShade / edgeCount).toFixed(2)),
  });

  return new Route({
    nodeIds,
    edges,
    totalDistance,
    totalTime,
    aggregatedEnvironmental,
  });
}

/**
 * Placeholder for future A* route optimization.
 * @param {import('./Graph.js').Graph} _graph 
 * @param {string|number} _startNodeId 
 * @param {string|number} _targetNodeId 
 * @param {Function} [_heuristicFn] 
 * @param {Object} [_options] 
 * @returns {Route|null}
 */
export function findAStarRoute(_graph, _startNodeId, _targetNodeId, _heuristicFn, _options = {}) {
  // TODO: Implement A* pathfinding using geographic distance and environmental heuristics
  throw new Error('findAStarRoute is not implemented yet.');
}
