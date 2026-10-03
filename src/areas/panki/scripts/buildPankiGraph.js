import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// 1. Geodesic & Polygon Math Helpers (Pure JS, 0 dependencies)
// ---------------------------------------------------------------------------

/**
 * Calculate Haversine distance in meters between two [lon, lat] points.
 */
export function calculateHaversineDistance(pt1, pt2) {
  const R = 6371000; // Earth radius in meters
  const lat1 = (pt1[1] * Math.PI) / 180;
  const lat2 = (pt2[1] * Math.PI) / 180;
  const dLat = ((pt2[1] - pt1[1]) * Math.PI) / 180;
  const dLon = ((pt2[0] - pt1[0]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Total length of a coordinate sequence in meters.
 */
export function calculateLineStringDistance(coordinates) {
  let totalMeters = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalMeters += calculateHaversineDistance(coordinates[i], coordinates[i + 1]);
  }
  return totalMeters;
}

/**
 * Ray-casting algorithm for Point-in-Polygon check.
 * @param {Array<number>} point [lon, lat]
 * @param {Array<Array<number>>} polygonRing Array of [lon, lat]
 */
export function isPointInPolygon(point, polygonRing) {
  const x = point[0];
  const y = point[1];
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
 * Calculate line segment intersection between (p1->p2) and boundary segment (b1->b2).
 * Returns [lon, lat] intersection point or null if no intersection.
 */
export function getSegmentIntersection(p1, p2, b1, b2) {
  const x1 = p1[0];
  const y1 = p1[1];
  const x2 = p2[0];
  const y2 = p2[1];

  const x3 = b1[0];
  const y3 = b1[1];
  const x4 = b2[0];
  const y4 = b2[1];

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-12) return null; // Parallel

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (y1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (y1 - x3)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    const ix = x1 + ua * (x2 - x1);
    const iy = y1 + ua * (y2 - y1);
    return [Number(ix.toFixed(7)), Number(iy.toFixed(7))];
  }
  return null;
}

// Highway filtering rules
const EXCLUDED_HIGHWAY_TYPES = new Set([
  'construction',
  'proposed',
  'abandoned',
  'raceway',
  'bridleway',
  'corridor',
  'elevator',
]);

// ---------------------------------------------------------------------------
// 2. Main Graph Builder
// ---------------------------------------------------------------------------

export function buildPankiGraphFromRawData(boundaryGeoJSON, rawOsmData) {
  const polygonRing = boundaryGeoJSON.features[0].geometry.coordinates[0];
  const elements = rawOsmData.elements || [];

  // Parse raw OSM nodes and usable ways
  const rawNodesMap = new Map();
  const rawWays = [];

  for (const el of elements) {
    if (el.type === 'node') {
      rawNodesMap.set(el.id, {
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        tags: el.tags || {},
      });
    } else if (el.type === 'way' && el.tags && el.tags.highway) {
      if (!EXCLUDED_HIGHWAY_TYPES.has(el.tags.highway)) {
        rawWays.push(el);
      }
    }
  }

  // Count OSM node usage to identify intersections/junctions across usable ways
  const nodeUsageCount = new Map();
  for (const way of rawWays) {
    const wayNodes = way.nodes || [];
    for (const nodeId of wayNodes) {
      nodeUsageCount.set(nodeId, (nodeUsageCount.get(nodeId) || 0) + 1);
    }
  }

  const nodesList = [];
  const edgesList = [];
  const graphNodeMap = new Map(); // key: "osm-node-ID" or "boundary-lon-lat" -> node object
  let nextBoundaryNodeCounter = 1;

  function getOrCreateOsmNode(osmNodeId) {
    const nodeKey = `osm-node-${osmNodeId}`;
    if (graphNodeMap.has(nodeKey)) {
      return graphNodeMap.get(nodeKey);
    }
    const rawNode = rawNodesMap.get(osmNodeId);
    if (!rawNode) return null;

    const nodeObj = {
      id: nodeKey,
      osmNodeId,
      latitude: rawNode.lat,
      longitude: rawNode.lon,
      sourceType: 'osm-node',
      isBoundaryNode: false,
      name: rawNode.tags?.name || null,
    };

    graphNodeMap.set(nodeKey, nodeObj);
    nodesList.push(nodeObj);
    return nodeObj;
  }

  function createBoundaryNode(coord) {
    const key = `panki-bnode-${nextBoundaryNodeCounter++}`;
    const nodeObj = {
      id: key,
      osmNodeId: null,
      latitude: coord[1],
      longitude: coord[0],
      sourceType: 'boundary-intersection',
      isBoundaryNode: true,
      name: 'Boundary Intersection',
    };
    graphNodeMap.set(key, nodeObj);
    nodesList.push(nodeObj);
    return nodeObj;
  }

  let edgeCounter = 1;
  let bidirectionalWayCount = 0;
  let oneWayWayCount = 0;

  for (const way of rawWays) {
    const wayNodeIds = way.nodes || [];
    if (wayNodeIds.length < 2) continue;

    const isOneWay =
      way.tags.oneway === 'yes' ||
      way.tags.oneway === '1' ||
      way.tags.oneway === 'true';

    if (isOneWay) {
      oneWayWayCount++;
    } else {
      bidirectionalWayCount++;
    }

    // Clip way coordinates against boundary polygon and identify graph segments
    const wayCoordsWithNodes = [];

    for (let i = 0; i < wayNodeIds.length; i++) {
      const nid = wayNodeIds[i];
      const rNode = rawNodesMap.get(nid);
      if (!rNode) continue;
      wayCoordsWithNodes.push({
        nodeId: nid,
        coord: [rNode.lon, rNode.lat],
      });
    }

    if (wayCoordsWithNodes.length < 2) continue;

    // Process segment by segment along the way
    let currentSegmentCoords = [];
    let currentStartGraphNode = null;

    for (let i = 0; i < wayCoordsWithNodes.length - 1; i++) {
      const curr = wayCoordsWithNodes[i];
      const next = wayCoordsWithNodes[i + 1];

      const p1 = curr.coord;
      const p2 = next.coord;

      const p1In = isPointInPolygon(p1, polygonRing);
      const p2In = isPointInPolygon(p2, polygonRing);

      // Find boundary intersection if segment crosses boundary
      let intersectPoint = null;
      if (p1In !== p2In) {
        for (let b = 0; b < polygonRing.length - 1; b++) {
          const b1 = polygonRing[b];
          const b2 = polygonRing[b + 1];
          const ix = getSegmentIntersection(p1, p2, b1, b2);
          if (ix) {
            intersectPoint = ix;
            break;
          }
        }
      }

      if (p1In && p2In) {
        // Entire segment inside boundary
        if (!currentStartGraphNode) {
          currentStartGraphNode = getOrCreateOsmNode(curr.nodeId);
          currentSegmentCoords = [p1];
        }
        currentSegmentCoords.push(p2);

        const isJunctionNode = (nodeUsageCount.get(next.nodeId) || 0) > 1;
        const isEndNode = i + 1 === wayCoordsWithNodes.length - 1;

        if (isJunctionNode || isEndNode) {
          const endGraphNode = getOrCreateOsmNode(next.nodeId);
          if (endGraphNode && currentStartGraphNode && endGraphNode.id !== currentStartGraphNode.id) {
            addGraphEdge({
              osmWayId: way.id,
              highwayType: way.tags.highway,
              name: way.tags.name || null,
              isOneWay,
              fromNode: currentStartGraphNode,
              toNode: endGraphNode,
              coordinates: [...currentSegmentCoords],
            });
          }
          currentStartGraphNode = endGraphNode;
          currentSegmentCoords = [p2];
        }
      } else if (p1In && !p2In) {
        // Exiting boundary
        if (!currentStartGraphNode) {
          currentStartGraphNode = getOrCreateOsmNode(curr.nodeId);
          currentSegmentCoords = [p1];
        }
        if (intersectPoint) {
          currentSegmentCoords.push(intersectPoint);
          const bNode = createBoundaryNode(intersectPoint);
          if (currentStartGraphNode && bNode.id !== currentStartGraphNode.id) {
            addGraphEdge({
              osmWayId: way.id,
              highwayType: way.tags.highway,
              name: way.tags.name || null,
              isOneWay,
              fromNode: currentStartGraphNode,
              toNode: bNode,
              coordinates: [...currentSegmentCoords],
            });
          }
        }
        currentStartGraphNode = null;
        currentSegmentCoords = [];
      } else if (!p1In && p2In) {
        // Entering boundary
        if (intersectPoint) {
          const bNode = createBoundaryNode(intersectPoint);
          currentStartGraphNode = bNode;
          currentSegmentCoords = [intersectPoint, p2];

          const isJunctionNode = (nodeUsageCount.get(next.nodeId) || 0) > 1;
          const isEndNode = i + 1 === wayCoordsWithNodes.length - 1;

          if (isJunctionNode || isEndNode) {
            const endGraphNode = getOrCreateOsmNode(next.nodeId);
            if (endGraphNode && bNode.id !== endGraphNode.id) {
              addGraphEdge({
                osmWayId: way.id,
                highwayType: way.tags.highway,
                name: way.tags.name || null,
                isOneWay,
                fromNode: bNode,
                toNode: endGraphNode,
                coordinates: [...currentSegmentCoords],
              });
            }
            currentStartGraphNode = endGraphNode;
            currentSegmentCoords = [p2];
          }
        }
      }
    }
  }

  function addGraphEdge({ osmWayId, highwayType, name, isOneWay, fromNode, toNode, coordinates }) {
    // Clean up adjacent duplicate coordinates
    const cleanCoords = [];
    for (let c = 0; c < coordinates.length; c++) {
      if (
        c === 0 ||
        coordinates[c][0] !== coordinates[c - 1][0] ||
        coordinates[c][1] !== coordinates[c - 1][1]
      ) {
        cleanCoords.push(coordinates[c]);
      }
    }
    if (cleanCoords.length < 2) return;

    const distMeters = Math.round(calculateLineStringDistance(cleanCoords) * 100) / 100;
    if (distMeters <= 0) return;

    // Forward edge
    const fwdEdgeId = `panki-edge-${edgeCounter++}`;
    edgesList.push({
      id: fwdEdgeId,
      osmWayId,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      distanceMeters: distMeters,
      highwayType,
      name,
      oneWay: isOneWay,
      coordinates: cleanCoords,
      geometry: {
        type: 'LineString',
        coordinates: cleanCoords,
      },
      isFabricated: false,
    });

    // Reverse edge if bidirectional
    if (!isOneWay) {
      const revCoords = [...cleanCoords].reverse();
      const revEdgeId = `panki-edge-${edgeCounter++}`;
      edgesList.push({
        id: revEdgeId,
        osmWayId,
        fromNodeId: toNode.id,
        toNodeId: fromNode.id,
        distanceMeters: distMeters,
        highwayType,
        name,
        oneWay: false,
        coordinates: revCoords,
        geometry: {
          type: 'LineString',
          coordinates: revCoords,
        },
        isFabricated: false,
      });
    }
  }

  // Filter out any nodes that ended up unused
  const usedNodeIds = new Set();
  for (const edge of edgesList) {
    usedNodeIds.add(edge.fromNodeId);
    usedNodeIds.add(edge.toNodeId);
  }
  const finalNodes = nodesList.filter((n) => usedNodeIds.has(n.id));

  // Compute Highway Type Counts
  const highwayTypeCounts = {};
  for (const edge of edgesList) {
    highwayTypeCounts[edge.highwayType] = (highwayTypeCounts[edge.highwayType] || 0) + 1;
  }

  const totalNetworkKm =
    Math.round(
      (edgesList.reduce((sum, e) => sum + e.distanceMeters, 0) / 1000) * 100
    ) / 100;

  const boundaryNodeCount = finalNodes.filter((n) => n.isBoundaryNode).length;

  return {
    areaId: 'panki-kanpur',
    source: 'OpenStreetMap',
    datasetStatus: 'processed-graph',
    nodes: finalNodes,
    edges: edgesList,
    metadata: {
      sourceExtraction: 'Step 5B-2 OpenStreetMap Overpass API',
      sourceDataFiles: [
        'src/areas/panki/data/raw/panki_osm_raw.json',
        'src/areas/panki/data/raw/panki_road_features.json',
      ],
      boundaryFile: 'src/areas/panki/boundary.geojson',
      generatedAt: '2026-10-03',
      attribution: '© OpenStreetMap contributors (ODbL)',
      isSampleData: false,
      totalGraphNodes: finalNodes.length,
      totalGraphEdges: edgesList.length,
      boundaryDerivedNodesCount: boundaryNodeCount,
      bidirectionalSourceWaysCount: bidirectionalWayCount,
      oneWaySourceWaysCount: oneWayWayCount,
      totalNetworkDistanceKm: totalNetworkKm,
      highwayTypeCounts,
      isFabricated: false,
    },
  };
}

function run() {
  const boundaryPath = path.resolve(__dirname, '../boundary.geojson');
  const rawOsmPath = path.resolve(__dirname, '../data/raw/panki_osm_raw.json');
  const outputGraphPath = path.resolve(__dirname, '../data/processed/pankiGraph.json');

  const boundaryGeoJSON = JSON.parse(fs.readFileSync(boundaryPath, 'utf-8'));
  const rawOsmData = JSON.parse(fs.readFileSync(rawOsmPath, 'utf-8'));

  const processedGraph = buildPankiGraphFromRawData(boundaryGeoJSON, rawOsmData);

  fs.mkdirSync(path.dirname(outputGraphPath), { recursive: true });
  fs.writeFileSync(outputGraphPath, JSON.stringify(processedGraph, null, 2), 'utf-8');

  console.log('=================================================');
  console.log('GreenRoute: Real Panki Graph Built Successfully');
  console.log('=================================================');
  console.log(`Total Graph Nodes: ${processedGraph.metadata.totalGraphNodes}`);
  console.log(`Total Graph Edges: ${processedGraph.metadata.totalGraphEdges}`);
  console.log(`Boundary-Derived Nodes: ${processedGraph.metadata.boundaryDerivedNodesCount}`);
  console.log(`Bidirectional Source Ways: ${processedGraph.metadata.bidirectionalSourceWaysCount}`);
  console.log(`One-Way Source Ways: ${processedGraph.metadata.oneWaySourceWaysCount}`);
  console.log(`Total Network Distance: ${processedGraph.metadata.totalNetworkDistanceKm} km`);
  console.log(`Output Location: ${outputGraphPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run();
}
