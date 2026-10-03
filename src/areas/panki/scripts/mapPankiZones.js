import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapPankiGraphEdgesToZones } from '../zoneMapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run() {
  const zonesGeoJSONPath = path.resolve(__dirname, '../zones/zones.geojson');
  const graphDatasetPath = path.resolve(__dirname, '../data/processed/pankiGraph.json');

  const zonesGeoJSON = JSON.parse(fs.readFileSync(zonesGeoJSONPath, 'utf-8'));
  const pankiGraph = JSON.parse(fs.readFileSync(graphDatasetPath, 'utf-8'));

  const updatedGraph = mapPankiGraphEdgesToZones(pankiGraph, zonesGeoJSON);

  fs.writeFileSync(graphDatasetPath, JSON.stringify(updatedGraph, null, 2), 'utf-8');

  console.log('=================================================');
  console.log('GreenRoute: Panki Edge-to-Zone Mapping Complete');
  console.log('=================================================');
  console.log(`Environmental Zones Count: ${zonesGeoJSON.features.length}`);
  console.log(`Total Graph Edges Mapped: ${updatedGraph.metadata.totalEdgesMapped}`);
  console.log(`Unmapped Edges Count: ${updatedGraph.metadata.unmappedEdgesCount}`);
  console.log(`Multi-Zone Edges Count: ${updatedGraph.metadata.multiZoneEdgesCount}`);
  console.log('Edges Count per Zone:');
  for (const [zid, count] of Object.entries(updatedGraph.metadata.edgesPerZone)) {
    console.log(` - ${zid}: ${count} edges`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run();
}
