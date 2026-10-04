import {
  applyEnvironmentalDataToGraph,
  applyCampusConditionsToGraph,
  findCandidateRoutes,
} from "../algorithm/index.js";
import { getGraphForArea, resolveNodeInArea } from "../areas/graphAdapter.js";
import { PANKI_SIMULATED_ENV_RECORDS } from "../areas/panki/zones/pankiSimulatedEnvData.js";
import { mapPankiConditionsForGraph } from "../areas/panki/conditionMapper.js";
import { getAllCurrentEnvironmentalData } from "./environmentalDataService.js";
import { getCampusConditions } from "./campusConditionsService.js";

/**
 * Runtime orchestration service to calculate live routes by connecting
 * Firebase environmental data and active area conditions to the area graph algorithm.
 *
 * Supports multi-area resolution (e.g. 'panki-kanpur' or 'sample-campus').
 *
 * @param {Object|string} params - Parameter object or startNodeId string
 * @param {string} [params.areaId='sample-campus'] - Area identifier ('panki-kanpur' | 'sample-campus')
 * @param {string|Object} [params.startNodeId] - Origin node ID or lat/lng coordinates object
 * @param {string|Object} [params.targetNodeId] - Destination node ID or lat/lng coordinates object
 * @param {string} [params.preference='balanced'] - Route preference profile ('balanced' | 'time' | 'environment')
 * @param {Object} [params.options={}] - Additional routing options (e.g. maxRoutes, weights, avoidHazards)
 * @param {string} [secondArg] - Target node ID if called positionally
 * @param {string} [thirdArg] - Preference profile if called positionally
 * @param {Object} [fourthArg] - Additional options if called positionally
 * @returns {Promise<Array<import('../algorithm/models/Route.js').Route>>} Ranked array of candidate routes
 */
export async function calculateLiveCampusRoutes(params = {}, secondArg, thirdArg, fourthArg) {
  let areaId;
  let startNodeInput;
  let targetNodeInput;
  let preference;
  let options;

  if (typeof params === "object" && params !== null) {
    areaId = params.areaId ?? params.options?.areaId ?? "sample-campus";
    startNodeInput = params.startNodeId;
    targetNodeInput = params.targetNodeId;
    preference = params.preference ?? "balanced";
    options = params.options ?? {};
    if (params.activeConditions && !options.conditions) {
      options.conditions = params.activeConditions;
    }
    if (params.conditions && !options.conditions) {
      options.conditions = params.conditions;
    }
  } else {
    areaId = fourthArg?.areaId ?? "sample-campus";
    startNodeInput = params;
    targetNodeInput = secondArg;
    preference = thirdArg ?? "balanced";
    options = fourthArg ?? {};
  }

  // 1. Resolve area graph
  const graph = getGraphForArea(areaId);

  // Resolve start and target node IDs for the area
  const startNodeId = resolveNodeInArea(areaId, startNodeInput) ?? startNodeInput;
  const targetNodeId = resolveNodeInArea(areaId, targetNodeInput) ?? targetNodeInput;

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

  // 3. Fetch active campus conditions safely or use passed options.conditions
  let activeConditions = [];
  let conditionsFailed = false;
  if (Array.isArray(options.conditions)) {
    activeConditions = options.conditions;
  } else {
    try {
      const fetchedConditions = await getCampusConditions({ status: "active" });
      if (Array.isArray(fetchedConditions)) {
        activeConditions = fetchedConditions;
      }
    } catch {
      conditionsFailed = true;
      activeConditions = [];
    }
  }

  // 4. Apply environmental data and active conditions to graph
  if (areaId === "sample-campus") {
    applyEnvironmentalDataToGraph(graph, envRecords);
    applyCampusConditionsToGraph(graph, activeConditions);
  } else if (areaId === "panki-kanpur") {
    // Combine Firebase environmental records with Panki simulated benchmark records
    const pankiEnvMap = new Map();
    for (const record of PANKI_SIMULATED_ENV_RECORDS) {
      if (record && record.zoneId) {
        pankiEnvMap.set(String(record.zoneId), record);
      }
    }
    for (const record of envRecords) {
      if (record && record.zoneId) {
        pankiEnvMap.set(String(record.zoneId), record);
      }
    }
    const combinedPankiEnvRecords = Array.from(pankiEnvMap.values());

    applyEnvironmentalDataToGraph(graph, combinedPankiEnvRecords);

    // Map Panki active conditions to graph edges
    const { mappedConditions } = mapPankiConditionsForGraph(activeConditions, graph);
    applyCampusConditionsToGraph(graph, mappedConditions);
  }

  // 5. Calculate candidate routes (ranking is automatically performed by findCandidateRoutes)
  const routeOptions = {
    preference,
    useConditions: activeConditions.length > 0,
    activeConditions,
    ...options,
  };

  const routes = findCandidateRoutes(graph, startNodeId, targetNodeId, routeOptions) || [];

  // Attach non-fatal fallback indicator metadata to returned array
  const isFallback = envFailed || conditionsFailed;
  routes.isFallback = isFallback;
  routes.envFailed = envFailed;
  routes.conditionsFailed = conditionsFailed;
  routes.areaId = areaId;

  // 6. Return resulting ranked candidate routes
  return routes;
}
