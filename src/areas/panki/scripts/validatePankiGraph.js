import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPointInPolygon,
  calculateLineStringDistance,
} from './buildPankiGraph.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function validatePankiGraph(graphDataset, boundaryGeoJSON) {
  const errors = [];
  const warnings = [];

  if (!graphDataset || typeof graphDataset !== 'object') {
    errors.push('Graph dataset must be a valid object.');
    return { isValid: false, errors, warnings, stats: {} };
  }

  if (graphDataset.areaId !== 'panki-kanpur') {
    errors.push(`Invalid areaId: expected "panki-kanpur", got "${graphDataset.areaId}"`);
  }

  if (graphDataset.datasetStatus !== 'processed-graph') {
    errors.push(`Invalid datasetStatus: expected "processed-graph", got "${graphDataset.datasetStatus}"`);
  }

  const nodes = graphDataset.nodes || [];
  const edges = graphDataset.edges || [];

  if (nodes.length === 0) {
    errors.push('Graph dataset contains zero nodes.');
  }

  if (edges.length === 0) {
    errors.push('Graph dataset contains zero edges.');
  }

  const nodeMap = new Map();
  const seenNodeIds = new Set();
  const sampleCampusNodeIds = new Set(['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7']);

  const polygonRing = boundaryGeoJSON.features[0].geometry.coordinates[0];
  let pointsOutsidePolygon = 0;
  let fabricatedNodesCount = 0;
  let fabricatedEdgesCount = 0;

  // 1. Validate Nodes
  for (const [index, node] of nodes.entries()) {
    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Node at index ${index} is missing valid id.`);
      continue;
    }

    if (sampleCampusNodeIds.has(node.id)) {
      errors.push(`Sample campus node ID "${node.id}" detected in real Panki graph!`);
    }

    if (seenNodeIds.has(node.id)) {
      errors.push(`Duplicate node ID detected: ${node.id}`);
    }
    seenNodeIds.add(node.id);
    nodeMap.set(node.id, node);

    if (typeof node.latitude !== 'number' || typeof node.longitude !== 'number' || Number.isNaN(node.latitude) || Number.isNaN(node.longitude)) {
      errors.push(`Node ${node.id} contains invalid coordinates: lat=${node.latitude}, lon=${node.longitude}`);
    }

    const inPoly = isPointInPolygon([node.longitude, node.latitude], polygonRing);
    if (!inPoly) {
      pointsOutsidePolygon++;
      errors.push(`Node ${node.id} at [${node.longitude}, ${node.latitude}] is outside the study polygon.`);
    }
  }

  // 2. Validate Edges
  const seenEdgeIds = new Set();
  let invalidFromToReferences = 0;
  let invalidDistances = 0;
  let distanceDiscrepancies = 0;

  for (const [index, edge] of edges.entries()) {
    if (!edge.id || typeof edge.id !== 'string') {
      errors.push(`Edge at index ${index} is missing valid id.`);
      continue;
    }

    if (seenEdgeIds.has(edge.id)) {
      errors.push(`Duplicate edge ID detected: ${edge.id}`);
    }
    seenEdgeIds.add(edge.id);

    // Check node references
    if (!nodeMap.has(edge.fromNodeId)) {
      invalidFromToReferences++;
      errors.push(`Edge ${edge.id} references non-existent fromNodeId "${edge.fromNodeId}".`);
    }

    if (!nodeMap.has(edge.toNodeId)) {
      invalidFromToReferences++;
      errors.push(`Edge ${edge.id} references non-existent toNodeId "${edge.toNodeId}".`);
    }

    // Check OSM way ID & Fabrication
    if (!edge.osmWayId || typeof edge.osmWayId !== 'number') {
      errors.push(`Edge ${edge.id} missing valid osmWayId.`);
    }

    if (edge.isFabricated !== false) {
      fabricatedEdgesCount++;
      errors.push(`Edge ${edge.id} is marked as fabricated or missing fabrication flag.`);
    }

    // Distance checks
    if (typeof edge.distanceMeters !== 'number' || edge.distanceMeters <= 0 || Number.isNaN(edge.distanceMeters)) {
      invalidDistances++;
      errors.push(`Edge ${edge.id} has invalid/non-positive distance: ${edge.distanceMeters}`);
    }

    // LineString geometry checks
    if (!edge.geometry || edge.geometry.type !== 'LineString' || !Array.isArray(edge.geometry.coordinates)) {
      errors.push(`Edge ${edge.id} missing valid LineString geometry.`);
      continue;
    }

    const coords = edge.geometry.coordinates;
    if (coords.length < 2) {
      errors.push(`Edge ${edge.id} LineString contains less than 2 coordinates.`);
    }

    // Calculate actual geodesic distance along geometry
    const calculatedDist = Math.round(calculateLineStringDistance(coords) * 100) / 100;
    if (Math.abs(calculatedDist - edge.distanceMeters) > 1.0) { // Tolerance of 1 meter
      distanceDiscrepancies++;
      errors.push(`Edge ${edge.id} distance mismatch: stored=${edge.distanceMeters}m, calculated=${calculatedDist}m`);
    }

    // Check edge geometry coordinates inside polygon
    for (const pt of coords) {
      if (!isPointInPolygon(pt, polygonRing)) {
        pointsOutsidePolygon++;
        errors.push(`Edge ${edge.id} contains coordinate [${pt[0]}, ${pt[1]}] outside the study polygon.`);
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    stats: {
      totalGraphNodes: nodes.length,
      totalGraphEdges: edges.length,
      boundaryDerivedNodesCount: nodes.filter((n) => n.isBoundaryNode).length,
      bidirectionalWayCount: graphDataset.metadata?.bidirectionalSourceWaysCount || 0,
      oneWayWayCount: graphDataset.metadata?.oneWaySourceWaysCount || 0,
      totalNetworkDistanceKm: graphDataset.metadata?.totalNetworkDistanceKm || 0,
      pointsOutsidePolygon,
      invalidFromToReferences,
      invalidDistances,
      distanceDiscrepancies,
      fabricatedNodesCount,
      fabricatedEdgesCount,
      highwayTypeCounts: graphDataset.metadata?.highwayTypeCounts || {},
    },
  };
}

function run() {
  const boundaryPath = path.resolve(__dirname, '../boundary.geojson');
  const graphPath = path.resolve(__dirname, '../data/processed/pankiGraph.json');

  if (!fs.existsSync(graphPath)) {
    console.error(`File not found: ${graphPath}`);
    process.exit(1);
  }

  const boundaryGeoJSON = JSON.parse(fs.readFileSync(boundaryPath, 'utf-8'));
  const graphDataset = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

  const result = validatePankiGraph(graphDataset, boundaryGeoJSON);

  console.log('=================================================');
  console.log('GreenRoute: Panki Processed Graph Validation Report');
  console.log('=================================================');
  console.log(`Dataset Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`Total Graph Nodes: ${result.stats.totalGraphNodes}`);
  console.log(`Total Graph Edges: ${result.stats.totalGraphEdges}`);
  console.log(`Boundary-Derived Nodes: ${result.stats.boundaryDerivedNodesCount}`);
  console.log(`Bidirectional Source Ways: ${result.stats.bidirectionalWayCount}`);
  console.log(`One-Way Source Ways: ${result.stats.oneWayWayCount}`);
  console.log(`Total Network Distance: ${result.stats.totalNetworkDistanceKm} km`);
  console.log(`Points Outside Study Polygon: ${result.stats.pointsOutsidePolygon}`);
  console.log(`Fabricated Data Count: ${result.stats.fabricatedEdgesCount + result.stats.fabricatedNodesCount}`);

  if (result.errors.length > 0) {
    console.error('\nValidation Errors:');
    result.errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✓ All graph validation checks passed successfully with 0 errors.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run();
}
