/**
 * Panki Study Area Boundary GeoJSON Object
 *
 * Boundary Polygon (~5 km²) centered near Panki Dham Railway Station, Kanpur, UP, India.
 * Verified Reference Coordinates: Latitude 26.4596° N, Longitude 80.2383° E.
 *
 * NOTE: This is a project study area boundary, NOT an official administrative boundary of Panki.
 */
export const pankiBoundaryGeoJSON = {
  type: 'FeatureCollection',
  name: 'PankiStudyAreaBoundary',
  crs: {
    type: 'name',
    properties: {
      name: 'urn:ogc:def:crs:OGC:1.3:CRS84',
    },
  },
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'panki-kanpur-boundary',
        name: 'Panki Project Study Area Boundary',
        city: 'Kanpur',
        state: 'Uttar Pradesh',
        country: 'India',
        isOfficialBoundary: false,
        boundarySource: 'project-defined-study-area',
        description:
          'Project-defined ~5 km² study area boundary centered near Panki Dham Railway Station (26.4596° N, 80.2383° E)',
        targetAreaKm2: 5.0,
        referenceCenter: {
          latitude: 26.4596,
          longitude: 80.2383,
        },
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [80.2270, 26.4495],
            [80.2496, 26.4495],
            [80.2496, 26.4697],
            [80.2270, 26.4697],
            [80.2270, 26.4495],
          ],
        ],
      },
    },
  ],
};

/**
 * Panki Study Area Configuration
 */
export const pankiAreaConfig = {
  id: 'panki-kanpur',
  name: 'Panki',
  city: 'Kanpur',
  state: 'Uttar Pradesh',
  country: 'India',
  center: {
    latitude: 26.4596,
    longitude: 80.2383,
  },
  targetAreaKm2: 5,
  boundarySource: 'project-defined-study-area',
  datasetStatus: 'boundary-only',
  isOfficialBoundary: false,
  description:
    'Project study area foundation (~5 km²) around Panki Dham locality in Kanpur, UP, India. Used for configurable area datasets without hardcoding geographic limits in the routing engine.',
  boundary: pankiBoundaryGeoJSON,
};

export default pankiAreaConfig;
