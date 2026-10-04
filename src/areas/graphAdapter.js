import { Graph, createCampusGraph } from '../algorithm/index.js';
import pankiGraphData from './panki/data/processed/pankiGraph.json' with { type: 'json' };

/**
 * Calculates Haversine distance in meters between two (lat, lng) pairs.
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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let cachedPankiGraphInstance = null;

/**
 * Creates and returns a Graph instance loaded with real Panki graph data.
 * @returns {Graph}
 */
export function loadPankiGraphInstance() {
  if (cachedPankiGraphInstance) {
    return cachedPankiGraphInstance;
  }

  const graph = new Graph();

  for (const nodeData of pankiGraphData.nodes) {
    graph.addNode(
      nodeData.id,
      { lat: nodeData.latitude, lng: nodeData.longitude },
      {
        name: nodeData.name || nodeData.id,
        osmNodeId: nodeData.osmNodeId,
        sourceType: nodeData.sourceType,
        isBoundaryNode: Boolean(nodeData.isBoundaryNode),
        isSampleCoordinate: false,
      }
    );
  }

  for (const edgeData of pankiGraphData.edges) {
    // Estimate walking time in seconds (average walking speed = 1.39 m/s)
    const timeSec = Math.max(1, Math.round(edgeData.distanceMeters / 1.39));

    // Default neutral environmental values for real road segments until env records applied
    const envAttrs = {
      pollution: 0,
      heat: 0,
      greenery: 0.50,
      shade: 0.50,
    };

    const edge = graph.addEdge(
      edgeData.fromNodeId,
      edgeData.toNodeId,
      edgeData.distanceMeters,
      timeSec,
      envAttrs,
      false // Panki graph already contains explicit directed edges for bidirectional roads
    );

    const edgeZoneId = edgeData.zoneId || edgeData.metadata?.zoneId || null;
    const edgeZoneIds = edgeData.metadata?.zoneIds || (edgeZoneId ? [edgeZoneId] : []);

    edge.id = edgeData.id;
    edge.zoneId = edgeZoneId;
    edge.metadata = {
      id: edgeData.id,
      osmWayId: edgeData.osmWayId,
      highwayType: edgeData.highwayType,
      name: edgeData.name || null,
      oneWay: Boolean(edgeData.oneWay),
      coordinates: edgeData.coordinates,
      zoneId: edgeZoneId,
      zoneIds: edgeZoneIds,
      isSampleData: false,
    };
  }

  return graph;
}

/**
 * Area Graph Resolver: returns populated Graph instance for specified areaId.
 * @param {string} [areaId='sample-campus'] - Area identifier ('panki-kanpur' | 'sample-campus')
 * @returns {Graph}
 */
export function getGraphForArea(areaId) {
  if (!areaId || areaId === 'sample-campus' || areaId === 'default') {
    return createCampusGraph();
  }

  if (areaId === 'panki-kanpur') {
    return loadPankiGraphInstance();
  }

  throw new Error(
    `Unknown area ID "${areaId}". Supported area IDs are "panki-kanpur" and "sample-campus".`
  );
}

/**
 * Finds the nearest graph node in specified area graph to given lat/lng coordinates.
 * @param {string} areaId - Area identifier ('panki-kanpur' | 'sample-campus')
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {object|null} Closest node info object or null
 */
export function findNearestNodeInArea(areaId, lat, lng) {
  const graph = getGraphForArea(areaId);
  if (!graph || !graph.nodes || graph.nodes.size === 0) return null;

  let nearestNode = null;
  let minDistance = Infinity;

  for (const [nodeId, nodeObj] of graph.nodes.entries()) {
    const dist = calculateHaversineMeters(lat, lng, nodeObj.coordinates.lat, nodeObj.coordinates.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestNode = {
        id: nodeId,
        latitude: nodeObj.coordinates.lat,
        longitude: nodeObj.coordinates.lng,
        name: nodeObj.metadata?.name || nodeId,
        distanceMeters: Math.round(dist * 10) / 10,
      };
    }
  }

  return nearestNode;
}

/**
 * Resolves node identifier or coordinate object to valid graph node ID in specified area.
 * @param {string} areaId
 * @param {string|object} nodeInput
 * @returns {string|null} Node ID
 */
export function resolveNodeInArea(areaId, nodeInput) {
  const graph = getGraphForArea(areaId);
  if (!graph) return null;

  if (typeof nodeInput === 'string') {
    if (graph.nodes.has(nodeInput)) {
      return nodeInput;
    }
    // Case-insensitive match on node ID
    for (const id of graph.nodes.keys()) {
      if (id.toLowerCase() === nodeInput.toLowerCase()) {
        return id;
      }
    }
  } else if (typeof nodeInput === 'object' && nodeInput !== null) {
    const lat = nodeInput.latitude ?? nodeInput.lat;
    const lng = nodeInput.longitude ?? nodeInput.lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const nearest = findNearestNodeInArea(areaId, lat, lng);
      return nearest ? nearest.id : null;
    }
  }

  return null;
}
