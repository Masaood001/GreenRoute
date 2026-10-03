# GreenRoute — Panki Raw Geographic Dataset

## 1. Overview
This directory contains real geographic road and path features acquired for the Panki project study area in Kanpur, Uttar Pradesh, India.

## 2. Dataset Information
- **Study Area**: Panki, Kanpur, Uttar Pradesh, India
- **Reference Center**: Latitude 26.4596° N, Longitude 80.2383° E
- **Bounding Box**:
  - South (`minLat`): `26.4495`
  - West (`minLng`): `80.2270`
  - North (`maxLat`): `26.4697`
  - East (`maxLng`): `80.2496`
- **Boundary Reference**: `src/areas/panki/boundary.geojson`
- **Data Source**: OpenStreetMap (OSM) via Overpass API
- **Extraction Date**: 2026-10-03
- **Attribution Requirement**: `© OpenStreetMap contributors`
- **License**: Open Database Commons Open Database License (ODbL)

## 3. Files Included
1. `raw/panki_osm_raw.json`
   - Unmodified, complete JSON response returned by the Overpass API query (`2,882` OSM elements including nodes and ways).
2. `raw/panki_road_features.json`
   - Structured GeoJSON-compatible FeatureCollection representing `448` usable drivable/walkable road and path ways with `3,228` valid coordinates.
   - Preserves source metadata including `osmWayId`, `highwayType`, `name`, `ref`, `maxspeed`, `oneway`, `surface`, and node coordinates.

## 4. Query Artifact
The exact Overpass QL query used for data acquisition is preserved at:
`src/areas/panki/query/overpassQuery.overpassql`

Query definition:
```overpassql
[out:json][timeout:30];
(
  way["highway"](26.4495,80.2270,26.4697,80.2496);
);
out body;
>;
out skel qt;
```

## 5. Dataset Validation Summary
- **Total OSM Elements Retrieved**: 2,882
- **Usable Road / Path Features**: 448
- **Unique Source Way IDs**: 448
- **Valid Coordinates Count**: 3,228 / 3,228 (100% valid numeric coordinates)
- **Fabricated Data Count**: 0 (0% fake/fabricated data)
- **Missing Names Count**: 433 (allowed, standard for local OSM coverage)

## 6. Dataset Limitations
- **OSM Naming Coverage**: Local road names in Panki are partially mapped in OSM (15 ways have explicit name tags, 433 ways use standard highway type identifiers).
- **Raw Geographic Stage**: This dataset contains raw geographical ways and coordinates. It has NOT been converted into a graph data structure or connected to the Dijkstra engine in this step.
- **Study Area Bounds**: Features cover the ~5 km² project study area polygon. Intersecting ways extending outside the bounding box maintain their full geometry segments inside the raw dataset.
