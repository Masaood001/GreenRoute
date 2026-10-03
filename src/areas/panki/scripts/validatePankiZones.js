import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPointInPolygon } from './buildPankiGraph.js';
import { PANKI_SIMULATED_ENV_RECORDS } from '../zones/pankiSimulatedEnvData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPointInOrOnPolygon(point, polygonRing, eps = 1e-5) {
  if (isPointInPolygon(point, polygonRing)) return true;
  const lngs = polygonRing.map((c) => c[0]);
  const lats = polygonRing.map((c) => c[1]);
  const minLng = Math.min(...lngs) - eps;
  const maxLng = Math.max(...lngs) + eps;
  const minLat = Math.min(...lats) - eps;
  const maxLat = Math.max(...lats) + eps;

  return (
    point[0] >= minLng &&
    point[0] <= maxLng &&
    point[1] >= minLat &&
    point[1] <= maxLat
  );
}

export function validatePankiZones(zonesGeoJSON, pankiGraph, boundaryGeoJSON) {
  const errors = [];
  const warnings = [];

  if (!zonesGeoJSON || zonesGeoJSON.type !== 'FeatureCollection') {
    errors.push('Zones dataset must be a valid FeatureCollection.');
    return { isValid: false, errors, warnings, stats: {} };
  }

  const boundaryRing = boundaryGeoJSON.features[0].geometry.coordinates[0];
  const zoneFeatures = zonesGeoJSON.features || [];
  const seenZoneIds = new Set();

  let zonePointsOutsideBoundary = 0;

  for (const [index, feature] of zoneFeatures.entries()) {
    const zid = feature.properties?.zoneId;
    if (!zid) {
      errors.push(`Zone at index ${index} missing zoneId.`);
      continue;
    }

    if (seenZoneIds.has(zid)) {
      errors.push(`Duplicate zoneId detected: ${zid}`);
    }
    seenZoneIds.add(zid);

    const polyRing = feature.geometry?.coordinates?.[0];
    if (!polyRing || polyRing.length < 4) {
      errors.push(`Zone ${zid} contains invalid polygon geometry.`);
      continue;
    }

    // Verify zone polygon ring stays inside or on study area boundary
    for (const pt of polyRing) {
      if (!isPointInOrOnPolygon(pt, boundaryRing)) {
        zonePointsOutsideBoundary++;
        errors.push(`Zone ${zid} coordinate [${pt[0]}, ${pt[1]}] lies outside study boundary.`);
      }
    }
  }

  // Validate Graph Edge-to-Zone Mapping
  const edges = pankiGraph.edges || [];
  let unmappedEdgesCount = 0;
  let multiZoneEdgesCount = 0;
  let invalidZoneReferencesCount = 0;

  const edgesPerZone = {};

  for (const edge of edges) {
    const zid = edge.zoneId || edge.metadata?.zoneId;
    if (!zid) {
      unmappedEdgesCount++;
      errors.push(`Edge ${edge.id} has no assigned zoneId.`);
      continue;
    }

    if (!seenZoneIds.has(zid)) {
      invalidZoneReferencesCount++;
      errors.push(`Edge ${edge.id} references invalid/unregistered zoneId "${zid}".`);
    }

    edgesPerZone[zid] = (edgesPerZone[zid] || 0) + 1;

    if (edge.metadata?.isMultiZone) {
      multiZoneEdgesCount++;
    }
  }

  // Validate Simulated Environmental Records
  let simulatedRecordsCount = 0;
  let fabricatedRecordsCount = 0;

  for (const record of PANKI_SIMULATED_ENV_RECORDS) {
    if (record.isSimulated) {
      simulatedRecordsCount++;
    }
    if (!record.source || !record.disclaimer) {
      errors.push(`Simulated env record for zone ${record.zoneId} missing source or disclaimer.`);
    }
    // Check if any real-world measurement is claimed (must be explicitly marked simulated)
    if (record.isSimulated === false) {
      fabricatedRecordsCount++;
      errors.push(`Environmental record for ${record.zoneId} incorrectly marked non-simulated!`);
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    stats: {
      totalZones: zoneFeatures.length,
      totalEdgesMapped: edges.length - unmappedEdgesCount,
      unmappedEdgesCount,
      multiZoneEdgesCount,
      invalidZoneReferencesCount,
      zonePointsOutsideBoundary,
      pankiEnvRecordsUsedCount: PANKI_SIMULATED_ENV_RECORDS.length,
      simulatedRecordsCount,
      fabricatedRecordsCount,
      edgesPerZone,
    },
  };
}

function run() {
  const boundaryPath = path.resolve(__dirname, '../boundary.geojson');
  const zonesPath = path.resolve(__dirname, '../zones/zones.geojson');
  const graphPath = path.resolve(__dirname, '../data/processed/pankiGraph.json');

  const boundaryGeoJSON = JSON.parse(fs.readFileSync(boundaryPath, 'utf-8'));
  const zonesGeoJSON = JSON.parse(fs.readFileSync(zonesPath, 'utf-8'));
  const pankiGraph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

  const result = validatePankiZones(zonesGeoJSON, pankiGraph, boundaryGeoJSON);

  console.log('=================================================');
  console.log('GreenRoute: Panki Environmental Zones Validation Report');
  console.log('=================================================');
  console.log(`Validation Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`Environmental Zones Count: ${result.stats.totalZones}`);
  console.log(`Total Graph Edges Mapped: ${result.stats.totalEdgesMapped}`);
  console.log(`Unmapped Edges Count: ${result.stats.unmappedEdgesCount}`);
  console.log(`Multi-Zone Edges Count: ${result.stats.multiZoneEdgesCount}`);
  console.log(`Panki Environmental Records: ${result.stats.pankiEnvRecordsUsedCount}`);
  console.log(`Simulated Environmental Records: ${result.stats.simulatedRecordsCount}`);
  console.log(`Fabricated Real-World Measurements: ${result.stats.fabricatedRecordsCount}`);
  console.log(`Zone Geometry Outside Boundary: ${result.stats.zonePointsOutsideBoundary}`);

  if (result.errors.length > 0) {
    console.error('\nValidation Errors:');
    result.errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✓ All environmental zone validation checks passed successfully with 0 errors.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run();
}
