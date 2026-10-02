import { EnvironmentalAttributes } from '../models/EnvironmentalAttributes.js';

/**
 * Pure mapping function to transform a Firebase environmental_data record
 * into an algorithm-compatible EnvironmentalAttributes model.
 *
 * Mapping Rules:
 * - airQuality.aqi        -> pollution
 * - temperature.celsius   -> heat
 * - shade.score / 100     -> shade (normalized to 0.0 - 1.0 scale)
 * - greenery.score / 100  -> greenery (normalized to 0.0 - 1.0 scale)
 *
 * @param {Object|null|undefined} firebaseData - Firebase environmental_data record
 * @returns {EnvironmentalAttributes} Initialized EnvironmentalAttributes instance
 */
export function mapFirebaseEnvToAttributes(firebaseData) {
  if (!firebaseData || typeof firebaseData !== 'object') {
    return new EnvironmentalAttributes();
  }

  const rawAqi = firebaseData.airQuality?.aqi;
  const rawCelsius = firebaseData.temperature?.celsius;
  const rawShade = firebaseData.shade?.score;
  const rawGreenery = firebaseData.greenery?.score;

  const pollution = rawAqi !== undefined && rawAqi !== null && !isNaN(Number(rawAqi))
    ? Number(rawAqi)
    : 0;

  const heat = rawCelsius !== undefined && rawCelsius !== null && !isNaN(Number(rawCelsius))
    ? Number(rawCelsius)
    : 0;

  const shade = rawShade !== undefined && rawShade !== null && !isNaN(Number(rawShade))
    ? Number(rawShade) / 100
    : 0;

  const greenery = rawGreenery !== undefined && rawGreenery !== null && !isNaN(Number(rawGreenery))
    ? Number(rawGreenery) / 100
    : 0;

  return new EnvironmentalAttributes({
    pollution,
    heat,
    shade,
    greenery,
  });
}

/**
 * Helper to retrieve all unique edges from a Graph instance.
 * @param {import('../Graph.js').Graph} graph
 * @returns {Array<import('../models/Edge.js').Edge>}
 */
function getAllGraphEdges(graph) {
  if (!graph || !graph.nodes || typeof graph.getAllNodes !== 'function') {
    return [];
  }
  const edgesSet = new Set();
  for (const node of graph.getAllNodes()) {
    const neighbors = graph.getNeighbors(node.id) || [];
    for (const edge of neighbors) {
      edgesSet.add(edge);
    }
  }
  return Array.from(edgesSet);
}

/**
 * Benchmark fallback mapping from node pairs to zone IDs.
 */
const BENCHMARK_NODE_PAIR_ZONE_MAP = {
  'N1-N6': 'zone_hostel_avenue',
  'N6-N1': 'zone_hostel_avenue',
  'N6-N7': 'zone_hostel_avenue',
  'N7-N6': 'zone_hostel_avenue',

  'N1-N2': 'zone_central_quad',
  'N2-N1': 'zone_central_quad',
  'N2-N3': 'zone_central_quad',
  'N3-N2': 'zone_central_quad',

  'N3-N7': 'zone_botanical_trail',
  'N7-N3': 'zone_botanical_trail',

  'N5-N4': 'zone_science_promenade',
  'N4-N5': 'zone_science_promenade',
  'N4-N7': 'zone_science_promenade',
  'N7-N4': 'zone_science_promenade',

  'N1-N5': 'zone_sports_complex',
  'N5-N1': 'zone_sports_complex',
  'N2-N6': 'zone_sports_complex',
  'N6-N2': 'zone_sports_complex',
};

/**
 * Connects already-fetched Firebase environmental_data records to a Graph instance.
 * Updates matching graph edges' environmentalAttributes and metadata without calling Firebase.
 *
 * @param {import('../Graph.js').Graph} graph - Graph instance to update
 * @param {Array<Object>} envRecords - Array of Firebase environmental_data records
 * @returns {import('../Graph.js').Graph} The same graph instance
 */
export function applyEnvironmentalDataToGraph(graph, envRecords) {
  if (!graph || typeof graph.getAllNodes !== 'function') {
    return graph || null;
  }

  if (!Array.isArray(envRecords) || envRecords.length === 0) {
    return graph;
  }

  // Build efficient lookup map by zoneId
  const zoneMap = new Map();
  for (const record of envRecords) {
    if (record && typeof record === 'object' && record.zoneId) {
      zoneMap.set(String(record.zoneId), record);
    }
  }

  if (zoneMap.size === 0) {
    return graph;
  }

  const allEdges = getAllGraphEdges(graph);

  for (const edge of allEdges) {
    if (!edge) continue;

    let matchedZoneId = null;

    if (edge.metadata?.zoneId && zoneMap.has(String(edge.metadata.zoneId))) {
      matchedZoneId = String(edge.metadata.zoneId);
    } else if (edge.zoneId && zoneMap.has(String(edge.zoneId))) {
      matchedZoneId = String(edge.zoneId);
    } else if (Array.isArray(edge.metadata?.zoneIds)) {
      for (const zid of edge.metadata.zoneIds) {
        if (zoneMap.has(String(zid))) {
          matchedZoneId = String(zid);
          break;
        }
      }
    }

    if (!matchedZoneId) {
      const pairKey = `${edge.sourceId}-${edge.targetId}`;
      const fallbackZoneId = BENCHMARK_NODE_PAIR_ZONE_MAP[pairKey];
      if (fallbackZoneId && zoneMap.has(fallbackZoneId)) {
        matchedZoneId = fallbackZoneId;
      }
    }

    if (matchedZoneId) {
      const firebaseRecord = zoneMap.get(matchedZoneId);
      edge.environmentalAttributes = mapFirebaseEnvToAttributes(firebaseRecord);

      edge.metadata = edge.metadata || {};
      edge.metadata.isSimulated = Boolean(firebaseRecord.isSimulated);
      edge.metadata.source = firebaseRecord.source || null;
      edge.metadata.disclaimer = firebaseRecord.disclaimer || null;
    }
  }

  return graph;
}
