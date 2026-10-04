import pankiGraphData from './data/processed/pankiGraph.json' with { type: 'json' };

export const MAX_MATCHING_DISTANCE_METERS = 150;

/**
 * Calculates Haversine distance in meters between two (lat, lon) pairs.
 */
function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates distance from a point to a line segment defined by two coordinates.
 */
function distanceToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  // Check endpoints distance
  const dA = calculateHaversineMeters(pLat, pLng, aLat, aLng);

  // Vector AB and AP in projected Cartesian approximation for close distances
  const dx = (bLng - aLng) * Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return dA;

  const px = (pLng - aLng) * Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);
  const py = pLat - aLat;

  let t = (px * dx + py * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * dy;
  const projLng = aLng + (t * dx) / Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);

  return calculateHaversineMeters(pLat, pLng, projLat, projLng);
}

/**
 * Finds the nearest edge in the Panki graph to a given (lat, lng) location.
 * @param {number} lat
 * @param {number} lng
 * @param {object} [graphData=pankiGraphData]
 * @returns {object|null}
 */
export function findNearestEdgeInPanki(lat, lng, graphData = pankiGraphData) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  const edges = Array.isArray(graphData)
    ? graphData
    : Array.isArray(graphData?.edges)
    ? graphData.edges
    : typeof graphData?.getEdges === 'function'
    ? graphData.getEdges()
    : pankiGraphData.edges;

  let minDistance = Infinity;
  let nearestEdge = null;

  for (const edge of edges) {
    if (!edge.coordinates || edge.coordinates.length < 2) continue;

    for (let i = 0; i < edge.coordinates.length - 1; i++) {
      const p1 = edge.coordinates[i];
      const p2 = edge.coordinates[i + 1];
      const dist = distanceToSegmentMeters(lat, lng, p1[1], p1[0], p2[1], p2[0]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestEdge = edge;
      }
    }
  }

  if (!nearestEdge) return null;

  return {
    edge: nearestEdge,
    distanceMeters: Math.round(minDistance * 10) / 10,
  };
}

/**
 * Maps a single campus condition record to the nearest Panki graph edge.
 * @param {object} condition
 * @param {object} [graphData=pankiGraphData]
 * @returns {object}
 */
export function mapConditionToPankiEdge(condition, graphData = pankiGraphData) {
  if (!condition || typeof condition !== 'object') {
    return {
      conditionId: null,
      isMapped: false,
      reason: 'Invalid condition object',
    };
  }

  const loc = condition.location;
  let lat = null;
  let lng = null;

  if (loc && typeof loc === 'object') {
    lat = loc.latitude ?? loc.lat;
    lng = loc.longitude ?? loc.lng;
    if (lat === undefined && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      lng = loc.coordinates[0];
      lat = loc.coordinates[1];
    }
  }

  if (lat === null || lng === null || typeof lat !== 'number' || typeof lng !== 'number') {
    return {
      conditionId: condition.id || null,
      isMapped: false,
      reason: 'Condition contains no valid latitude/longitude coordinates',
    };
  }

  const nearestResult = findNearestEdgeInPanki(lat, lng, graphData);
  if (!nearestResult || nearestResult.distanceMeters > MAX_MATCHING_DISTANCE_METERS) {
    const distStr = nearestResult ? `${nearestResult.distanceMeters}m` : 'N/A';
    const reasonText = `Condition location (${distStr}) exceeds maximum threshold of ${MAX_MATCHING_DISTANCE_METERS}m`;
    return {
      conditionId: condition.id || null,
      edgeId: null,
      latitude: lat,
      longitude: lng,
      distanceMeters: nearestResult ? nearestResult.distanceMeters : Infinity,
      type: condition.type,
      severity: condition.severity,
      status: condition.status,
      isMapped: false,
      reason: reasonText,
      unmappedReason: reasonText,
    };
  }

  const edge = nearestResult.edge;

  return {
    conditionId: condition.id || null,
    edgeId: edge.id,
    sourceWayId: edge.osmWayId,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    latitude: lat,
    longitude: lng,
    distanceMeters: nearestResult.distanceMeters,
    type: condition.type,
    severity: condition.severity,
    status: condition.status,
    title: condition.title,
    description: condition.description,
    reportedBy: condition.reportedBy,
    isMapped: true,
    affectedPathIds: [
      edge.id,
      `${edge.fromNodeId}->${edge.toNodeId}`,
      `${edge.toNodeId}->${edge.fromNodeId}`,
      String(edge.osmWayId),
    ],
  };
}

/**
 * Processes a collection of conditions and returns mapped condition records enriched for graph transformation.
 * @param {Array<object>} conditions
 * @param {object} [graphData=pankiGraphData]
 * @returns {object} { mappedConditions: Array, unmappedConditions: Array, stats: object }
 */
export function mapPankiConditionsForGraph(conditions, graphData = pankiGraphData) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return {
      mappedConditions: [],
      unmappedConditions: [],
      stats: { total: 0, mappedCount: 0, unmappedCount: 0, affectedEdgesCount: 0 },
    };
  }

  const mappedConditions = [];
  const unmappedConditions = [];
  const affectedEdgeSet = new Set();

  for (const cond of conditions) {
    const res = mapConditionToPankiEdge(cond, graphData);
    if (res.isMapped) {
      // Merge original condition data with enriched affectedPathIds
      mappedConditions.push({
        ...cond,
        affectedPathIds: res.affectedPathIds,
        mappedEdgeId: res.edgeId,
        distanceToEdgeMeters: res.distanceMeters,
      });
      affectedEdgeSet.add(res.edgeId);
    } else {
      unmappedConditions.push(res);
    }
  }

  return {
    mappedConditions,
    unmappedConditions,
    stats: {
      total: conditions.length,
      mappedCount: mappedConditions.length,
      unmappedCount: unmappedConditions.length,
      affectedEdgesCount: affectedEdgeSet.size,
    },
  };
}
