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

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

const OVERPASS_QUERY = `[out:json][timeout:25];
(
  way["highway"](${PANKI_BBOX.minLat},${PANKI_BBOX.minLng},${PANKI_BBOX.maxLat},${PANKI_BBOX.maxLng});
);
out body;
>;
out skel qt;`;

export async function fetchPankiOSMData() {
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`[Panki Data Acquisition] Attempting Overpass API endpoint: ${endpoint}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${endpoint}?data=${encodeURIComponent(OVERPASS_QUERY)}`, {
        headers: { 'User-Agent': 'GreenRoute-PankiDataAcquisition/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (json && Array.isArray(json.elements) && json.elements.length > 0) {
        console.log(`[Panki Data Acquisition] Successfully retrieved ${json.elements.length} OSM elements from ${endpoint}.`);
        return json;
      }
    } catch (err) {
      console.warn(`[Panki Data Acquisition] Failed with ${endpoint}: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All Overpass API endpoints failed. Last error: ${lastError?.message}`);
}

export function processOSMToRoadFeatures(osmData) {
  const elements = osmData.elements || [];
  const nodesMap = new Map();
  const ways = [];

  for (const el of elements) {
    if (el.type === 'node') {
      nodesMap.set(el.id, { lat: el.lat, lon: el.lon });
    } else if (el.type === 'way' && el.tags && el.tags.highway) {
      ways.push(el);
    }
  }

  const features = [];
  let validCoordCount = 0;
  let missingNameCount = 0;

  for (const way of ways) {
    const wayNodes = way.nodes || [];
    const coordinates = [];

    for (const nodeId of wayNodes) {
      const node = nodesMap.get(nodeId);
      if (node && typeof node.lat === 'number' && typeof node.lon === 'number') {
        coordinates.push([node.lon, node.lat]);
        validCoordCount++;
      }
    }

    if (coordinates.length < 2) continue;

    const hasName = Boolean(way.tags.name);
    if (!hasName) missingNameCount++;

    features.push({
      id: `osm-way-${way.id}`,
      osmWayId: way.id,
      highwayType: way.tags.highway,
      name: way.tags.name || null,
      ref: way.tags.ref || null,
      maxspeed: way.tags.maxspeed || null,
      oneway: way.tags.oneway === 'yes',
      surface: way.tags.surface || null,
      nodeIds: wayNodes,
      coordinates,
      geometry: {
        type: 'LineString',
        coordinates,
      },
      sourceAttribution: '© OpenStreetMap contributors',
      license: 'ODbL (Open Database License)',
      isFabricated: false,
    });
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      datasetId: 'panki-osm-roads-raw',
      areaId: 'panki-kanpur',
      areaName: 'Panki',
      city: 'Kanpur',
      state: 'Uttar Pradesh',
      country: 'India',
      extractionDate: '2026-10-03',
      source: 'OpenStreetMap (Overpass API)',
      attribution: '© OpenStreetMap contributors (ODbL)',
      bbox: PANKI_BBOX,
      totalOsmElementsRetrieved: elements.length,
      totalOsmNodesRetrieved: nodesMap.size,
      totalOsmWaysRetrieved: ways.length,
      usableRoadPathFeatures: features.length,
      validCoordinatesCount: validCoordCount,
      missingNameFeaturesCount: missingNameCount,
      fabricatedFeaturesCount: 0,
    },
    features,
  };
}

async function run() {
  try {
    const rawDir = path.resolve(__dirname, '../data/raw');
    fs.mkdirSync(rawDir, { recursive: true });

    const rawOsmPath = path.join(rawDir, 'panki_osm_raw.json');
    const roadFeaturesPath = path.join(rawDir, 'panki_road_features.json');

    const osmData = await fetchPankiOSMData();
    fs.writeFileSync(rawOsmPath, JSON.stringify(osmData, null, 2), 'utf-8');
    console.log(`[Panki Data Acquisition] Saved raw OSM data to: ${rawOsmPath}`);

    const roadFeatures = processOSMToRoadFeatures(osmData);
    fs.writeFileSync(roadFeaturesPath, JSON.stringify(roadFeatures, null, 2), 'utf-8');
    console.log(`[Panki Data Acquisition] Saved ${roadFeatures.features.length} road features to: ${roadFeaturesPath}`);

    console.log('[Panki Data Acquisition] Acquisition complete!');
  } catch (err) {
    console.error('[Panki Data Acquisition] Error:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run();
}
