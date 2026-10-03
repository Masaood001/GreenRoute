import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PANKI_BBOX = {
  minLat: 26.4495,
  minLng: 80.2270,
  maxLat: 26.4697,
  maxLng: 80.2496,
};

export function validatePankiRoadFeatures(roadFeaturesDataset) {
  const errors = [];
  const warnings = [];

  if (!roadFeaturesDataset || roadFeaturesDataset.type !== 'FeatureCollection') {
    errors.push('Dataset must be a valid FeatureCollection.');
    return { isValid: false, errors, warnings, stats: {} };
  }

  const features = roadFeaturesDataset.features || [];
  if (features.length === 0) {
    errors.push('Dataset contains zero features.');
  }

  const seenOsmWayIds = new Set();
  let totalPoints = 0;
  let validCoordinatesCount = 0;
  let outOfBboxPointsCount = 0;
  let missingNameCount = 0;
  let fabricatedCount = 0;

  for (const [index, feature] of features.entries()) {
    // Check ID & Duplicate Handling
    if (!feature.id || !feature.osmWayId) {
      errors.push(`Feature at index ${index} is missing id or osmWayId.`);
    } else {
      if (seenOsmWayIds.has(feature.osmWayId)) {
        errors.push(`Duplicate OSM Way ID detected: ${feature.osmWayId}`);
      }
      seenOsmWayIds.add(feature.osmWayId);
    }

    // Check Highway Type
    if (!feature.highwayType || typeof feature.highwayType !== 'string') {
      errors.push(`Feature ${feature.id} missing highway type.`);
    }

    // Missing Name Check (Allowed)
    if (!feature.name) {
      missingNameCount++;
    }

    // Check Fabrication
    if (feature.isFabricated !== false) {
      fabricatedCount++;
      errors.push(`Feature ${feature.id} marked as fabricated or invalid fabrication flag.`);
    }

    // Check Geometry
    if (!feature.geometry || feature.geometry.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
      errors.push(`Feature ${feature.id} missing valid LineString geometry.`);
      continue;
    }

    const coords = feature.geometry.coordinates;
    if (coords.length < 2) {
      errors.push(`Feature ${feature.id} LineString contains less than 2 coordinates.`);
    }

    // Check Coordinates & Bounding Box
    for (const [lng, lat] of coords) {
      totalPoints++;
      if (typeof lng !== 'number' || typeof lat !== 'number' || Number.isNaN(lng) || Number.isNaN(lat)) {
        errors.push(`Feature ${feature.id} contains non-numeric coordinates: [${lng}, ${lat}]`);
        continue;
      }

      validCoordinatesCount++;

      // Check boundary relationship (allow slight overlap tolerance for intersecting ways)
      const buffer = 0.005;
      if (
        lat < PANKI_BBOX.minLat - buffer ||
        lat > PANKI_BBOX.maxLat + buffer ||
        lng < PANKI_BBOX.minLng - buffer ||
        lng > PANKI_BBOX.maxLng + buffer
      ) {
        outOfBboxPointsCount++;
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    stats: {
      totalUsableRoadFeatures: features.length,
      uniqueOsmWayIdsCount: seenOsmWayIds.size,
      totalCoordinatesEvaluated: totalPoints,
      validCoordinatesCount,
      outOfBboxPointsCount,
      missingNameFeaturesCount: missingNameCount,
      namedFeaturesCount: features.length - missingNameCount,
      fabricatedFeaturesCount: fabricatedCount,
    },
  };
}

function run() {
  const roadFeaturesPath = path.resolve(__dirname, '../data/raw/panki_road_features.json');
  if (!fs.existsSync(roadFeaturesPath)) {
    console.error(`File not found: ${roadFeaturesPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(roadFeaturesPath, 'utf-8');
  const dataset = JSON.parse(content);

  const result = validatePankiRoadFeatures(dataset);

  console.log('=================================================');
  console.log('GreenRoute: Panki Road Features Validation Report');
  console.log('=================================================');
  console.log(`Dataset Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`Usable Road Features: ${result.stats.totalUsableRoadFeatures}`);
  console.log(`Unique Source Way IDs: ${result.stats.uniqueOsmWayIdsCount}`);
  console.log(`Valid Coordinates: ${result.stats.validCoordinatesCount}/${result.stats.totalCoordinatesEvaluated}`);
  console.log(`Named Features: ${result.stats.namedFeaturesCount}`);
  console.log(`Missing Name Features (Allowed): ${result.stats.missingNameFeaturesCount}`);
  console.log(`Fabricated Data Count: ${result.stats.fabricatedFeaturesCount}`);

  if (result.errors.length > 0) {
    console.error('\nValidation Errors:');
    result.errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✓ All validation checks passed successfully with 0 errors.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run();
}
