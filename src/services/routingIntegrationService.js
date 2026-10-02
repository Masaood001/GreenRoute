import {
  createCampusGraph,
  applyEnvironmentalDataToGraph,
  applyCampusConditionsToGraph,
  findCandidateRoutes,
} from "../algorithm/index.js";
import { getAllCurrentEnvironmentalData } from "./environmentalDataService.js";
import { getCampusConditions } from "./campusConditionsService.js";

/**
 * Runtime orchestration service to calculate live campus routes by connecting
 * Firebase environmental data and active campus conditions to the campus graph algorithm.
 *
 * Execution Order:
 * 1. createCampusGraph() - Baseline campus graph
 * 2. getAllCurrentEnvironmentalData() - Fetch Firebase environmental data
 * 3. getCampusConditions({ status: 'active' }) - Fetch active campus conditions
 * 4. applyEnvironmentalDataToGraph(graph, envRecords) - Apply env attributes
 * 5. applyCampusConditionsToGraph(graph, activeConditions) - Apply dynamic penalties & blocks
 * 6. findCandidateRoutes(graph, startNodeId, targetNodeId, options) - Generate candidate routes
 * 7. Route ranking performed by findCandidateRoutes via rankRoutes
 * 8. Return resulting ranked candidate routes
 *
 * @param {Object|string} params - Parameter object or startNodeId string
 * @param {string} [params.startNodeId] - Origin campus node ID (e.g. 'N1')
 * @param {string} [params.targetNodeId] - Destination campus node ID (e.g. 'N7')
 * @param {string} [params.preference='balanced'] - Route preference profile ('balanced' | 'time' | 'environment')
 * @param {Object} [params.options={}] - Additional routing options (e.g. maxRoutes, weights, avoidHazards)
 * @param {string} [secondArg] - Target node ID if called positionally
 * @param {string} [thirdArg] - Preference profile if called positionally
 * @param {Object} [fourthArg] - Additional options if called positionally
 * @returns {Promise<Array<import('../algorithm/models/Route.js').Route>>} Ranked array of candidate routes
 */
export async function calculateLiveCampusRoutes(params = {}, secondArg, thirdArg, fourthArg) {
  let startNodeId;
  let targetNodeId;
  let preference;
  let options;

  if (typeof params === "object" && params !== null) {
    startNodeId = params.startNodeId;
    targetNodeId = params.targetNodeId;
    preference = params.preference ?? "balanced";
    options = params.options ?? {};
  } else {
    startNodeId = params;
    targetNodeId = secondArg;
    preference = thirdArg ?? "balanced";
    options = fourthArg ?? {};
  }

  // 1. Create baseline campus graph
  const graph = createCampusGraph();

  // 2. Fetch environmental data safely
  let envRecords = [];
  let envFailed = false;
  try {
    const fetchedEnv = await getAllCurrentEnvironmentalData();
    if (Array.isArray(fetchedEnv)) {
      envRecords = fetchedEnv;
    }
  } catch {
    envFailed = true;
    envRecords = [];
  }

  // 3. Fetch active campus conditions safely
  let activeConditions = [];
  let conditionsFailed = false;
  try {
    const fetchedConditions = await getCampusConditions({ status: "active" });
    if (Array.isArray(fetchedConditions)) {
      activeConditions = fetchedConditions;
    }
  } catch {
    conditionsFailed = true;
    activeConditions = [];
  }

  // 4. Apply environmental data to graph
  applyEnvironmentalDataToGraph(graph, envRecords);

  // 5. Apply campus conditions to graph
  applyCampusConditionsToGraph(graph, activeConditions);

  // 6 & 7. Calculate candidate routes (ranking is automatically performed by findCandidateRoutes)
  const routeOptions = {
    preference,
    ...options,
  };

  const routes = findCandidateRoutes(graph, startNodeId, targetNodeId, routeOptions) || [];

  // Attach non-fatal fallback indicator metadata to returned array
  const isFallback = envFailed || conditionsFailed;
  routes.isFallback = isFallback;
  routes.envFailed = envFailed;
  routes.conditionsFailed = conditionsFailed;

  // 8. Return resulting ranked candidate routes
  return routes;
}
