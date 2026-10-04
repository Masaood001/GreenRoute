import rawFeaturesData from './data/raw/panki_road_features.json' with { type: 'json' };
import pankiGraphData from './data/processed/pankiGraph.json' with { type: 'json' };
import { findNearestNodeInArea, resolveNodeInArea } from '../graphAdapter.js';
import { pankiAreaConfig } from './areaConfig.js';
import { findNearestEdgeInPanki } from './conditionMapper.js';

// Build Node Lookup Map
const nodeMap = new Map();
for (const node of pankiGraphData.nodes) {
  nodeMap.set(node.id, node);
  if (node.osmNodeId) {
    nodeMap.set(String(node.osmNodeId), node);
  }
}

// Build Named Features Catalog from real OSM data
const pankiNamedLocations = [];
const seenNamesAndWays = new Set();

for (const feature of rawFeaturesData.features) {
  if (feature.name && !seenNamesAndWays.has(feature.id)) {
    seenNamesAndWays.add(feature.id);

    // Find valid starting or midpoint node in graph
    let resolvedNodeId = null;
    let locationCoord = null;

    if (feature.nodeIds && feature.nodeIds.length > 0) {
      for (const nid of feature.nodeIds) {
        const fullId = `osm-node-${nid}`;
        if (nodeMap.has(fullId)) {
          resolvedNodeId = fullId;
          const nObj = nodeMap.get(fullId);
          locationCoord = { latitude: nObj.latitude, longitude: nObj.longitude };
          break;
        }
      }
    }

    if (!locationCoord && feature.coordinates && feature.coordinates.length > 0) {
      const midIdx = Math.floor(feature.coordinates.length / 2);
      const midPoint = feature.coordinates[midIdx];
      locationCoord = { latitude: midPoint[1], longitude: midPoint[0] };
      if (!resolvedNodeId) {
        const nearest = findNearestNodeInArea('panki-kanpur', locationCoord.latitude, locationCoord.longitude);
        if (nearest) resolvedNodeId = nearest.id;
      }
    }

    pankiNamedLocations.push({
      id: feature.id,
      osmWayId: feature.osmWayId,
      name: feature.name,
      highwayType: feature.highwayType,
      coordinate: locationCoord,
      nodeId: resolvedNodeId,
      source: 'OpenStreetMap',
      isFabricated: false,
    });
  }
}

/**
 * Returns all real named locations present in the Panki OSM dataset.
 * @returns {Array<object>}
 */
export function getAvailablePankiNamedLocations() {
  return [...pankiNamedLocations];
}

/**
 * Searches Panki dataset by real feature names, OSM node IDs, or coordinates.
 * @param {string} query
 * @returns {Array<object>}
 */
export function searchPankiLocations(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim().toLowerCase();

  // 1. Check for Coordinate Input (e.g., "26.4596, 80.2383" or "26.46 80.24")
  const coordRegex = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/;
  const coordMatch = cleanQuery.match(coordRegex);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= 20 && lat <= 30 && lng >= 75 && lng <= 85) {
      const nearest = findNearestNodeInArea('panki-kanpur', lat, lng);
      if (nearest) {
        return [
          {
            id: `panki-coord-${lat.toFixed(4)}-${lng.toFixed(4)}`,
            name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            coordinate: { latitude: lat, longitude: lng },
            nodeId: nearest.id,
            source: 'Coordinates',
            distanceMeters: nearest.distanceMeters,
            isFabricated: false,
          },
        ];
      }
    }
  }

  // 2. Search Real Named Locations (Case-insensitive substring match)
  const nameMatches = pankiNamedLocations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(cleanQuery) ||
      cleanQuery.includes(loc.name.toLowerCase())
  );

  if (nameMatches.length > 0) {
    return nameMatches;
  }

  // 3. Search OSM Node IDs (e.g., "8820570755" or "osm-node-8820570755")
  const cleanNodeId = cleanQuery.replace(/^osm-node-/, '');
  if (nodeMap.has(cleanQuery) || nodeMap.has(cleanNodeId)) {
    const nodeObj = nodeMap.get(cleanQuery) || nodeMap.get(cleanNodeId);
    return [
      {
        id: nodeObj.id,
        name: `OSM Node ${nodeObj.osmNodeId || nodeObj.id}`,
        coordinate: { latitude: nodeObj.latitude, longitude: nodeObj.longitude },
        nodeId: nodeObj.id,
        sourceNodeId: nodeObj.osmNodeId,
        source: 'OpenStreetMap',
        isFabricated: false,
      },
    ];
  }

  // 4. Return empty array if no match found (No fake places!)
  return [];
}

/**
 * Gets location suggestions for auto-complete dropdowns.
 * @param {string} query
 * @returns {Array<object>}
 */
export function getPankiLocationSuggestions(query) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    // Deduplicate named locations by name for initial suggestions
    const uniqueMap = new Map();
    for (const loc of pankiNamedLocations) {
      if (!uniqueMap.has(loc.name)) {
        uniqueMap.set(loc.name, loc);
      }
    }
    return Array.from(uniqueMap.values());
  }
  return searchPankiLocations(query);
}

/**
 * Gets a location by its ID or OSM Way ID.
 * @param {string|number} id
 * @returns {object|null}
 */
export function getPankiLocationById(id) {
  if (!id) return null;
  const strId = String(id);
  const found = pankiNamedLocations.find(
    (loc) => loc.id === strId || String(loc.osmWayId) === strId || loc.nodeId === strId
  );
  if (found) return found;

  if (nodeMap.has(strId)) {
    const nodeObj = nodeMap.get(strId);
    return {
      id: nodeObj.id,
      name: `OSM Node ${nodeObj.osmNodeId || nodeObj.id}`,
      coordinate: { latitude: nodeObj.latitude, longitude: nodeObj.longitude },
      nodeId: nodeObj.id,
      source: 'OpenStreetMap',
      isFabricated: false,
    };
  }

  return null;
}

/**
 * Checks if a given (lat, lng) coordinate point is strictly inside the Panki study area boundary.
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function isPointInPankiBoundary(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return false;
  }
  const polygonRing = pankiAreaConfig.boundary?.features?.[0]?.geometry?.coordinates?.[0];
  if (!polygonRing || !Array.isArray(polygonRing)) {
    return false;
  }

  const x = lng;
  const y = lat;
  let inside = false;

  for (let i = 0, j = polygonRing.length - 1; i < polygonRing.length; j = i++) {
    const xi = polygonRing[i][0];
    const yi = polygonRing[i][1];
    const xj = polygonRing[j][0];
    const yj = polygonRing[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Resolves a real road name in the local Panki dataset near the given coordinate, if available.
 * @param {number} lat
 * @param {number} lng
 * @returns {string|null} Real road name or null
 */
export function findRoadNameForCoordinate(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  const nearestResult = findNearestEdgeInPanki(lat, lng);
  if (nearestResult && nearestResult.distanceMeters <= 80 && nearestResult.edge) {
    const edgeName = nearestResult.edge.name || nearestResult.edge.metadata?.name;
    if (edgeName && typeof edgeName === 'string' && edgeName.trim() && !edgeName.startsWith('osm-')) {
      return edgeName.trim();
    }
  }

  return null;
}

/**
 * Creates a normalized location object for a free map click, preserving raw coordinates and resolving to the Panki graph.
 * Enforces boundary containment and generates no fake landmark names.
 * @param {number} lat
 * @param {number} lng
 * @returns {object} Location object or error object
 */
export function createMapClickLocation(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return { error: 'Invalid coordinates provided.' };
  }

  if (!isPointInPankiBoundary(lat, lng)) {
    return { error: 'Please select a location inside the Panki study area.' };
  }

  const nearestNode = findNearestNodeInArea('panki-kanpur', lat, lng);
  const roadName = findRoadNameForCoordinate(lat, lng);
  const displayLabel = roadName || 'Selected Map Location';

  return {
    id: `map-click-${lat.toFixed(6)}-${lng.toFixed(6)}`,
    name: displayLabel,
    label: displayLabel,
    coordinate: { latitude: lat, longitude: lng },
    nodeId: nearestNode ? nearestNode.id : null,
    resolvedNodeId: nearestNode ? nearestNode.id : null,
    source: 'map-click',
    isMapClick: true,
    isFabricated: false,
    distanceToNodeMeters: nearestNode ? nearestNode.distanceMeters : null,
  };
}

/**
 * Resolves any Panki location input (object, name string, node ID, or coordinate)
 * to a valid Panki graph node ID.
 * @param {object|string} locationInput
 * @returns {string|null}
 */
export function resolvePankiLocationToNode(locationInput) {
  if (!locationInput) return null;

  if (typeof locationInput === 'object') {
    if (locationInput.nodeId) return locationInput.nodeId;
    if (locationInput.resolvedNodeId) return locationInput.resolvedNodeId;
    if (locationInput.coordinate) {
      return resolveNodeInArea('panki-kanpur', locationInput.coordinate);
    }
    if (typeof locationInput.latitude === 'number' && typeof locationInput.longitude === 'number') {
      return resolveNodeInArea('panki-kanpur', locationInput);
    }
  }

  if (typeof locationInput === 'string') {
    // Check if locationInput matches a known location
    const searchResults = searchPankiLocations(locationInput);
    if (searchResults.length > 0 && searchResults[0].nodeId) {
      return searchResults[0].nodeId;
    }
    return resolveNodeInArea('panki-kanpur', locationInput);
  }

  return null;
}
