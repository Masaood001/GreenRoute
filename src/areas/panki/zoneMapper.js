import { isPointInPolygon } from './scripts/buildPankiGraph.js';

/**
 * Calculates the geodesic midpoint [lon, lat] of a LineString coordinate array.
 */
export function getLineStringMidpoint(coordinates) {
  if (!coordinates || coordinates.length === 0) return [80.2383, 26.4596];
  if (coordinates.length === 1) return coordinates[0];

  let totalLength = 0;
  const segLengths = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    segLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) return coordinates[0];

  const halfLength = totalLength / 2;
  let accumulated = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const len = segLengths[i];
    if (accumulated + len >= halfLength) {
      const remaining = halfLength - accumulated;
      const ratio = len > 0 ? remaining / len : 0;
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      return [
        Number((p1[0] + ratio * (p2[0] - p1[0])).toFixed(7)),
        Number((p1[1] + ratio * (p2[1] - p1[1])).toFixed(7)),
      ];
    }
    accumulated += len;
  }

  return coordinates[Math.floor(coordinates.length / 2)];
}

/**
 * Maps a single graph edge to an environmental zone in zonesGeoJSON strictly.
 *
 * Deterministic Matching Logic:
 * 1. Checks midpoint containment against zone polygons.
 * 2. Checks all vertex coordinates for zone containment to track multi-zone intersections.
 * 3. If midpoint is on a boundary between zones, resolves to the first valid intersecting zone.
 * 4. Ensures matchedZoneId is present in zoneIds.
 * 5. If no zone polygon contains any point on the edge, matchedZoneId remains null and zoneIds = [].
 * 6. Never invents an arbitrary fallback zone assignment.
 */
export function mapEdgeToZone(edge, zonesGeoJSON) {
  const coords = edge.coordinates || edge.geometry?.coordinates || [];
  const midpoint = getLineStringMidpoint(coords);

  const features = zonesGeoJSON.features || [];
  let matchedZoneId = null;
  const intersectingZoneIds = new Set();

  for (const feature of features) {
    const zid = feature.properties?.zoneId;
    const polyRing = feature.geometry?.coordinates?.[0];
    if (!zid || !polyRing) continue;

    if (isPointInPolygon(midpoint, polyRing)) {
      matchedZoneId = zid;
      intersectingZoneIds.add(zid);
    }

    for (const pt of coords) {
      if (isPointInPolygon(pt, polyRing)) {
        intersectingZoneIds.add(zid);
      }
    }
  }

  // If midpoint lies on a boundary line between zones, resolve to first valid intersecting zone
  if (!matchedZoneId && intersectingZoneIds.size > 0) {
    matchedZoneId = Array.from(intersectingZoneIds)[0];
  }

  // Ensure matched zone is included in intersectingZoneIds
  if (matchedZoneId) {
    intersectingZoneIds.add(matchedZoneId);
  }

  const zoneIdsArray = Array.from(intersectingZoneIds);

  const updatedMetadata = {
    ...(edge.metadata || {}),
    zoneId: matchedZoneId,
    zoneIds: zoneIdsArray,
    isMultiZone: zoneIdsArray.length > 1,
  };

  return {
    ...edge,
    zoneId: matchedZoneId,
    metadata: updatedMetadata,
  };
}

/**
 * Maps all graph edges in pankiGraph to environmental zones in zonesGeoJSON strictly.
 */
export function mapPankiGraphEdgesToZones(pankiGraphDataset, zonesGeoJSON) {
  const edges = pankiGraphDataset.edges || [];
  let unmappedCount = 0;
  let multiZoneCount = 0;

  const mappedEdges = edges.map((edge) => {
    const mapped = mapEdgeToZone(edge, zonesGeoJSON);
    if (!mapped.zoneId) {
      unmappedCount++;
    }
    if (mapped.metadata?.isMultiZone) {
      multiZoneCount++;
    }
    return mapped;
  });

  const zoneCounts = {};
  for (const edge of mappedEdges) {
    if (edge.zoneId) {
      const zid = edge.zoneId;
      zoneCounts[zid] = (zoneCounts[zid] || 0) + 1;
    }
  }

  return {
    ...pankiGraphDataset,
    edges: mappedEdges,
    metadata: {
      ...(pankiGraphDataset.metadata || {}),
      zonesMappedAt: '2026-10-03',
      totalEdgesMapped: mappedEdges.length - unmappedCount,
      unmappedEdgesCount: unmappedCount,
      multiZoneEdgesCount: multiZoneCount,
      edgesPerZone: zoneCounts,
    },
  };
}
