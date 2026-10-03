import { pankiAreaConfig } from './areaConfig.js';
import pankiGraphData from './data/processed/pankiGraph.json' with { type: 'json' };

/**
 * Map Data Adapter for Panki Area
 *
 * Provides helper utilities for rendering geographic features, boundaries,
 * road geometries, and route polylines on Leaflet interactive map components.
 */

// Build an edge lookup map: "fromNodeId-toNodeId" -> coordinates
const edgeLookupMap = new Map();
for (const edge of pankiGraphData.edges) {
  const key = `${edge.fromNodeId}-${edge.toNodeId}`;
  edgeLookupMap.set(key, edge.coordinates);
}

// Build a node lookup map: nodeId -> { lat, lng }
const nodeLookupMap = new Map();
for (const node of pankiGraphData.nodes) {
  nodeLookupMap.set(node.id, {
    lat: node.latitude,
    lng: node.longitude,
    name: node.name || node.id,
  });
}

/**
 * Returns Panki study area boundary GeoJSON.
 */
export function getPankiBoundary() {
  return pankiAreaConfig.boundary;
}

/**
 * Returns reference center point coordinates for Panki map initialization.
 */
export function getPankiCenter() {
  return pankiAreaConfig.center; // { latitude: 26.4596, longitude: 80.2383 }
}

/**
 * Returns road edge geometries from Panki graph dataset for background map rendering.
 * Converts GeoJSON [lon, lat] coordinates to Leaflet [lat, lon] pairs.
 */
export function getPankiRoadFeatures() {
  const roadPolylines = [];
  for (const edge of pankiGraphData.edges) {
    if (Array.isArray(edge.coordinates) && edge.coordinates.length >= 2) {
      const leafletCoords = edge.coordinates.map((c) => [c[1], c[0]]);
      roadPolylines.push({
        id: edge.id,
        highwayType: edge.highwayType,
        name: edge.name || null,
        coordinates: leafletCoords,
      });
    }
  }
  return roadPolylines;
}

/**
 * Resolves node ID to [lat, lng] Leaflet coordinate pair.
 * @param {string} nodeId
 * @param {object} [graph] Optional graph instance
 * @returns {Array<number>|null} [lat, lng] or null
 */
export function getNodeCoordinate(nodeId, graph) {
  if (!nodeId) return null;

  // 1. Check graph instance if provided
  if (graph && typeof graph.getNode === 'function') {
    const gNode = graph.getNode(nodeId);
    if (gNode && gNode.coordinates) {
      return [gNode.coordinates.lat, gNode.coordinates.lng];
    }
  }

  // 2. Check Panki node lookup map
  const pNode = nodeLookupMap.get(nodeId);
  if (pNode) {
    return [pNode.lat, pNode.lng];
  }

  return null;
}

/**
 * Converts a Route model or UI route object into an array of Leaflet [lat, lng] polyline coordinates.
 *
 * Uses actual edge geometry coordinates between consecutive nodes when available.
 *
 * @param {object} route - Route object containing nodeIds array
 * @param {object} [graph] - Optional Graph instance for edge lookup
 * @returns {Array<Array<number>>} Array of [lat, lng] coordinate pairs for Leaflet Polyline
 */
export function routeToPolyline(route, graph) {
  if (!route || !Array.isArray(route.nodeIds) || route.nodeIds.length === 0) {
    return [];
  }

  const nodeIds = route.nodeIds;
  const polyline = [];

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const fromId = nodeIds[i];
    const toId = nodeIds[i + 1];

    let segCoords = null;

    // Try graph instance neighbors
    if (graph && typeof graph.getNeighbors === 'function') {
      const neighbors = graph.getNeighbors(fromId) || [];
      const edge = neighbors.find((e) => e.targetId === toId);
      if (edge && edge.metadata?.coordinates) {
        segCoords = edge.metadata.coordinates;
      }
    }

    // Fallback to static Panki edge lookup map
    if (!segCoords) {
      const key = `${fromId}-${toId}`;
      segCoords = edgeLookupMap.get(key);
    }

    if (Array.isArray(segCoords) && segCoords.length >= 2) {
      for (let c = 0; c < segCoords.length; c++) {
        const pt = segCoords[c];
        const lat = pt[1];
        const lng = pt[0];

        // Avoid adding duplicate consecutive points
        if (
          polyline.length === 0 ||
          polyline[polyline.length - 1][0] !== lat ||
          polyline[polyline.length - 1][1] !== lng
        ) {
          polyline.push([lat, lng]);
        }
      }
    } else {
      // Fallback to node coordinates
      const fromPt = getNodeCoordinate(fromId, graph);
      const toPt = getNodeCoordinate(toId, graph);

      if (fromPt) {
        if (
          polyline.length === 0 ||
          polyline[polyline.length - 1][0] !== fromPt[0] ||
          polyline[polyline.length - 1][1] !== fromPt[1]
        ) {
          polyline.push(fromPt);
        }
      }
      if (toPt) {
        polyline.push(toPt);
      }
    }
  }

  return polyline;
}
