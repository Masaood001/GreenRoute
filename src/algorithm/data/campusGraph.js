import { Graph } from '../Graph.js';

/**
 * Sample realistic campus graph dataset for testing and local-area data foundation.
 * 
 * IMPORTANT NOTE:
 * The geographical coordinates (latitude, longitude) included in this dataset
 * are SAMPLE / DEMO COORDINATES for algorithm data foundation and testing.
 * They are clearly marked and do NOT represent actual real-world GPS coordinates of a physical campus.
 */

export const IS_SAMPLE_DATASET = true;

/**
 * Node definitions for the sample campus graph.
 * Represents intersections, entrances, landmarks, and hubs.
 */
export const CAMPUS_NODES = [
  {
    id: 'N1',
    name: 'North Gate Hub',
    latitude: 37.7740,
    longitude: -122.4190,
    metadata: {
      type: 'entrance',
      description: 'Main Northern Campus Entrance & Transit Hub',
      isSampleCoordinate: true,
    },
  },
  {
    id: 'N2',
    name: 'Central Quad Plaza',
    latitude: 37.7750,
    longitude: -122.4180,
    metadata: {
      type: 'plaza',
      description: 'Central pedestrian quadrangle surrounded by mature shade trees',
      isSampleCoordinate: true,
    },
  },
  {
    id: 'N3',
    name: 'Main Library Canopy Walk',
    latitude: 37.7755,
    longitude: -122.4170,
    metadata: {
      type: 'facility',
      description: 'High-vegetation eco corridor along the east side of main library',
      isSampleCoordinate: true,
    },
  },
  {
    id: 'N4',
    name: 'Science & Engineering Complex',
    latitude: 37.7765,
    longitude: -122.4165,
    metadata: {
      type: 'academic',
      description: 'Tech building cluster with delivery access road',
      isSampleCoordinate: true,
    },
  },
  {
    id: 'N5',
    name: 'North Perimeter Bypass Road',
    latitude: 37.7760,
    longitude: -122.4195,
    metadata: {
      type: 'road',
      description: 'Outer campus bypass route optimized for vehicular / shuttle speed',
      isSampleCoordinate: true,
    },
  },
  {
    id: 'N6',
    name: 'Student Life Center',
    latitude: 37.7745,
    longitude: -122.4160,
    metadata: {
      type: 'amenity',
      description: 'Central student services building and outdoor dining arcade',
      isSampleCoordinate: true,
    },
  },
  {
    id: 'N7',
    name: 'South Eco Innovation Hub',
    latitude: 37.7770,
    longitude: -122.4150,
    metadata: {
      type: 'destination',
      description: 'Southern eco-friendly research center and green pavilion',
      isSampleCoordinate: true,
    },
  },
];

/**
 * Edge definitions for the sample campus graph.
 * Represents path/road segments with distance, travel time, and environmental attributes.
 */
export const CAMPUS_EDGES = [
  // 1. Direct Main Corridor Segment 1: N1 -> N6
  {
    sourceId: 'N1',
    targetId: 'N6',
    distance: 300,
    time: 180,
    bidirectional: true,
    environmentalAttributes: { pollution: 45, heat: 28, greenery: 0.35, shade: 0.30 },
    metadata: { zoneId: 'zone_hostel_avenue' },
  },
  // 2. Direct Main Corridor Segment 2: N6 -> N7
  {
    sourceId: 'N6',
    targetId: 'N7',
    distance: 320,
    time: 190,
    bidirectional: true,
    environmentalAttributes: { pollution: 40, heat: 26, greenery: 0.40, shade: 0.35 },
    metadata: { zoneId: 'zone_hostel_avenue' },
  },
  // 3. Eco Quad Greenway Segment 1: N1 -> N2
  {
    sourceId: 'N1',
    targetId: 'N2',
    distance: 220,
    time: 140,
    bidirectional: true,
    environmentalAttributes: { pollution: 15, heat: 20, greenery: 0.85, shade: 0.80 },
    metadata: { zoneId: 'zone_central_quad' },
  },
  // 4. Eco Quad Greenway Segment 2: N2 -> N3
  {
    sourceId: 'N2',
    targetId: 'N3',
    distance: 240,
    time: 150,
    bidirectional: true,
    environmentalAttributes: { pollution: 10, heat: 18, greenery: 0.95, shade: 0.90 },
    metadata: { zoneId: 'zone_central_quad' },
  },
  // 5. Eco Quad Greenway Segment 3: N3 -> N7
  {
    sourceId: 'N3',
    targetId: 'N7',
    distance: 260,
    time: 160,
    bidirectional: true,
    environmentalAttributes: { pollution: 12, heat: 19, greenery: 0.90, shade: 0.85 },
    metadata: { zoneId: 'zone_botanical_trail' },
  },
  // 6. Perimeter Expressway Bypass Segment 1: N1 -> N5
  {
    sourceId: 'N1',
    targetId: 'N5',
    distance: 250,
    time: 90,
    bidirectional: true,
    environmentalAttributes: { pollution: 65, heat: 32, greenery: 0.20, shade: 0.15 },
    metadata: { zoneId: 'zone_sports_complex' },
  },
  // 7. Perimeter Expressway Bypass Segment 2: N5 -> N4
  {
    sourceId: 'N5',
    targetId: 'N4',
    distance: 280,
    time: 100,
    bidirectional: true,
    environmentalAttributes: { pollution: 60, heat: 30, greenery: 0.25, shade: 0.20 },
    metadata: { zoneId: 'zone_science_promenade' },
  },
  // 8. Perimeter Expressway Bypass Segment 3: N4 -> N7
  {
    sourceId: 'N4',
    targetId: 'N7',
    distance: 230,
    time: 80,
    bidirectional: true,
    environmentalAttributes: { pollution: 55, heat: 29, greenery: 0.30, shade: 0.25 },
    metadata: { zoneId: 'zone_science_promenade' },
  },
  // 9. Quad to Student Center Connector: N2 -> N6
  {
    sourceId: 'N2',
    targetId: 'N6',
    distance: 200,
    time: 120,
    bidirectional: true,
    environmentalAttributes: { pollution: 25, heat: 22, greenery: 0.70, shade: 0.65 },
    metadata: { zoneId: 'zone_sports_complex' },
  },
];

/**
 * Creates and returns a Graph loaded with the campus graph dataset.
 * 
 * @param {Array<Object>} [nodesData=CAMPUS_NODES] - Array of node objects
 * @param {Array<Object>} [edgesData=CAMPUS_EDGES] - Array of edge objects
 * @returns {Graph} Fully populated Graph instance
 */
export function createCampusGraph(nodesData = CAMPUS_NODES, edgesData = CAMPUS_EDGES) {
  const graph = new Graph();

  for (const nodeData of nodesData) {
    const lat = nodeData.latitude ?? nodeData.lat ?? nodeData.coordinates?.lat ?? 0;
    const lng = nodeData.longitude ?? nodeData.lng ?? nodeData.coordinates?.lng ?? 0;

    const metadata = {
      name: nodeData.name || '',
      isSampleCoordinate: nodeData.isSampleCoordinate ?? true,
      ...(nodeData.metadata || {}),
    };

    graph.addNode(nodeData.id, { lat, lng }, metadata);
  }

  for (const edgeData of edgesData) {
    const edge = graph.addEdge(
      edgeData.sourceId,
      edgeData.targetId,
      edgeData.distance ?? 0,
      edgeData.time ?? 0,
      edgeData.environmentalAttributes || {},
      edgeData.bidirectional ?? false
    );

    if (edgeData.metadata) {
      edge.metadata = { ...edgeData.metadata };
      if (edgeData.bidirectional) {
        const reverseNeighbors = graph.getNeighbors(edgeData.targetId);
        const reverseEdge = reverseNeighbors.find((e) => e.targetId === edgeData.sourceId);
        if (reverseEdge) {
          reverseEdge.metadata = { ...edgeData.metadata };
        }
      }
    }
  }

  return graph;
}
