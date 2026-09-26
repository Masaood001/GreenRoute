import { Route } from './models/Route.js';
import { EnvironmentalAttributes } from './models/EnvironmentalAttributes.js';
import { rankRoutes, WEIGHT_PROFILES } from './scoring.js';

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
 * Resolves a weight object or preference string to a concrete factor weight mapping.
 * 
 * @param {Object} [options] 
 * @returns {Object} Weight mapping object
 */
export function resolveWeights(options = {}) {
  if (options.weights && typeof options.weights === 'object') {
    return options.weights;
  }
  const pref = String(options.preference || options.profile || '').toLowerCase();
  if (pref.includes('time') || pref.includes('fast')) {
    return WEIGHT_PROFILES.TIME_FOCUSED;
  }
  if (pref.includes('env') || pref.includes('eco') || pref.includes('green')) {
    return WEIGHT_PROFILES.ENVIRONMENT_FOCUSED;
  }
  return WEIGHT_PROFILES.BALANCED;
}

/**
 * Modular function to generate, score, and rank multiple candidate routes between origin and destination nodes.
 * Combines multi-objective optimization (distance, time, eco) and edge-penalized path discovery.
 * 
 * @param {import('./Graph.js').Graph} graph - Road network graph
 * @param {string|number} startNodeId - Source node ID
 * @param {string|number} targetNodeId - Destination node ID
 * @param {Object} [options]
 * @param {number} [options.maxRoutes=5] - Maximum number of candidate routes to generate
 * @param {Object|string} [options.weights] - Custom weight profile or preference key
 * @param {string} [options.preference] - Preference profile name ('balanced' | 'time' | 'environment')
 * @returns {Array<Route>} Ranked array of candidate routes sorted by composite score descending
 */
export function findCandidateRoutes(graph, startNodeId, targetNodeId, options = {}) {
  if (!graph || !graph.hasNode(startNodeId) || !graph.hasNode(targetNodeId)) {
    return [];
  }

  const maxRoutes = options.maxRoutes || 5;
  const weights = resolveWeights(options);

  // Multi-objective strategies for discovering candidate routes
  const strategies = [
    { name: 'Shortest Distance Route', costFn: (edge) => edge.distance },
    { name: 'Fastest Travel Time Route', costFn: (edge) => edge.time },
    {
      name: 'Eco Green Route',
      costFn: (edge) => {
        const env = edge.environmentalAttributes || {};
        const pol = env.pollution || 0;
        const heat = env.heat || 0;
        const green = env.greenery || 0;
        const shade = env.shade || 0;
        const ecoFactor = (1 + pol / 40 + heat / 40) / (0.1 + green + shade);
        return edge.distance * ecoFactor;
      },
    },
  ];

  const uniqueRoutes = new Map();

  // Step 1: Run Dijkstra under each multi-objective strategy
  for (const strat of strategies) {
    const route = findDijkstraRoute(graph, startNodeId, targetNodeId, { costFn: strat.costFn });
    if (route && route.nodeIds.length > 0) {
      const key = route.nodeIds.join('->');
      if (!uniqueRoutes.has(key)) {
        route.name = strat.name;
        route.id = `route-${uniqueRoutes.size + 1}`;
        uniqueRoutes.set(key, route);
      }
    }
  }

  // Step 2: Edge-penalization to uncover alternative physical paths through the network
  const initialRoutes = Array.from(uniqueRoutes.values());
  for (const baseRoute of initialRoutes) {
    if (uniqueRoutes.size >= maxRoutes) break;

    for (const edgeToPenalize of baseRoute.edges) {
      if (uniqueRoutes.size >= maxRoutes) break;

      const penaltyCostFn = (edge) => {
        const isPenalized =
          edge.sourceId === edgeToPenalize.sourceId && edge.targetId === edgeToPenalize.targetId;
        return edge.distance * (isPenalized ? 10.0 : 1.0);
      };

      const altRoute = findDijkstraRoute(graph, startNodeId, targetNodeId, { costFn: penaltyCostFn });
      if (altRoute && altRoute.nodeIds.length > 0) {
        const key = altRoute.nodeIds.join('->');
        if (!uniqueRoutes.has(key)) {
          altRoute.name = `Alternative Path ${uniqueRoutes.size + 1}`;
          altRoute.id = `route-${uniqueRoutes.size + 1}`;
          uniqueRoutes.set(key, altRoute);
        }
      }
    }
  }

  const candidateList = Array.from(uniqueRoutes.values());

  if (candidateList.length === 0) {
    return [];
  }

  // Step 3: Score and rank all candidate routes using scoring.js
  return rankRoutes(candidateList, weights);
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

