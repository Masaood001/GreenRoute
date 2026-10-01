/**
 * Helper to retrieve all unique edges from a Graph instance.
 * @param {import('../Graph.js').Graph} graph 
 * @returns {Array<import('../models/Edge.js').Edge>}
 */
function getAllGraphEdges(graph) {
  if (!graph || !graph.nodes || typeof graph.getAllNodes !== 'function') {
    return [];
  }
  const edgesSet = new Set();
  for (const node of graph.getAllNodes()) {
    const neighbors = graph.getNeighbors(node.id) || [];
    for (const edge of neighbors) {
      edgesSet.add(edge);
    }
  }
  return Array.from(edgesSet);
}

/**
 * Checks whether an edge is affected by a path/node identifier string.
 *
 * Supported matching forms:
 * 1. Node-pair identifiers: "N1-N6" or "N1->N6" (bidirectional match against sourceId & targetId)
 * 2. Node identifiers: "N1" (matches any edge connected to node "N1")
 * 3. Edge metadata / ID: matches edge.metadata.pathId, edge.id, or edge.pathId
 *
 * @param {import('../models/Edge.js').Edge} edge 
 * @param {string} pathId 
 * @returns {boolean}
 */
function isEdgeAffectedByPathId(edge, pathId) {
  if (!edge || !pathId || typeof pathId !== 'string') return false;

  const cleanPathId = pathId.trim();
  if (!cleanPathId) return false;

  const src = String(edge.sourceId);
  const tgt = String(edge.targetId);

  // 1. Direct Node ID match (e.g., "N1")
  if (src === cleanPathId || tgt === cleanPathId) {
    return true;
  }

  // 2. Explicit edge ID or metadata pathId match
  if (
    edge.id === cleanPathId ||
    edge.pathId === cleanPathId ||
    edge.metadata?.pathId === cleanPathId ||
    edge.metadata?.id === cleanPathId
  ) {
    return true;
  }

  // 3. Directional or Bidirectional Node-Pair Match ("N1->N6" or "N1-N6")
  let parts = null;
  if (cleanPathId.includes('->')) {
    parts = cleanPathId.split('->');
  } else if (cleanPathId.includes('-')) {
    parts = cleanPathId.split('-');
  }

  if (parts && parts.length === 2) {
    const p1 = parts[0].trim();
    const p2 = parts[1].trim();
    if ((src === p1 && tgt === p2) || (src === p2 && tgt === p1)) {
      return true;
    }
  }

  return false;
}

/**
 * Fallback helper to check if an edge is affected by a location areaName string.
 * Compares areaName against node metadata names (sourceNode & targetNode) and edge metadata.
 *
 * @param {import('../models/Edge.js').Edge} edge 
 * @param {string} areaName 
 * @param {import('../Graph.js').Graph} graph 
 * @returns {boolean}
 */
function isEdgeAffectedByAreaName(edge, areaName, graph) {
  if (!edge || !areaName || typeof areaName !== 'string' || !graph) return false;

  const cleanArea = areaName.trim().toLowerCase();
  if (!cleanArea) return false;

  const sourceNode = typeof graph.getNode === 'function' ? graph.getNode(edge.sourceId) : null;
  const targetNode = typeof graph.getNode === 'function' ? graph.getNode(edge.targetId) : null;

  const srcName = String(sourceNode?.metadata?.name || sourceNode?.name || '').toLowerCase();
  const tgtName = String(targetNode?.metadata?.name || targetNode?.name || '').toLowerCase();
  const edgeName = String(edge.metadata?.name || edge.name || '').toLowerCase();

  const matchName = (nodeName) => {
    if (!nodeName) return false;
    // 1. Direct equality
    if (cleanArea === nodeName) return true;
    // 2. Substring containment
    if (cleanArea.length >= 3 && nodeName.includes(cleanArea)) return true;
    if (nodeName.length >= 3 && cleanArea.includes(nodeName)) return true;
    // 3. Significant word token overlap (e.g. "quad", "library", "hostel", "sports")
    const stopWords = ['the', 'and', 'near', 'from', 'with', 'block', 'building', 'path', 'road', 'walkway', 'entrance', 'wing'];
    const areaTokens = cleanArea.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !stopWords.includes(w));
    const nodeTokens = nodeName.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !stopWords.includes(w));

    return areaTokens.some((t) => nodeTokens.includes(t));
  };

  return matchName(srcName) || matchName(tgtName) || matchName(edgeName);
}

/**
 * Applies active campus conditions to a Graph instance by attaching dynamic
 * runtime properties (`penaltyMultiplier`, `isBlocked`, `activeConditions`) to edges.
 *
 * Primary Strategy:
 * 1. Matches affectedPathIds against node-pairs ("N1-N6"), node IDs ("N1"), or edge IDs.
 * 2. Fallback Strategy: If affectedPathIds is missing, empty, or unmatched, matches location.areaName
 *    against graph node and edge names/metadata.
 *
 * Requirements:
 * - Safely handles null, undefined, empty, or malformed inputs.
 * - Only processes conditions where status === "active".
 * - Ignores conditions with status === "scheduled" or "resolved".
 * - Baseline state (no active conditions): penaltyMultiplier = 1.0, isBlocked = false, activeConditions = [].
 *
 * @param {import('../Graph.js').Graph} graph 
 * @param {Array<Object>} [conditions=[]] 
 * @returns {import('../Graph.js').Graph|null} The modified graph instance
 */
export function applyCampusConditionsToGraph(graph, conditions) {
  if (!graph || typeof graph.getAllNodes !== 'function') {
    return graph || null;
  }

  const allEdges = getAllGraphEdges(graph);

  // Step 1: Initialize baseline state on all edges
  for (const edge of allEdges) {
    edge.penaltyMultiplier = 1.0;
    edge.isBlocked = false;
    edge.activeConditions = [];
  }

  if (!Array.isArray(conditions) || conditions.length === 0) {
    return graph;
  }

  // Step 2: Filter active conditions
  const activeConditions = conditions.filter(
    (c) => c && typeof c === 'object' && c.status === 'active'
  );

  if (activeConditions.length === 0) {
    return graph;
  }

  // Step 3: Match active conditions to affected edges
  for (const condition of activeConditions) {
    const affectedPathIds = Array.isArray(condition.affectedPathIds)
      ? condition.affectedPathIds
      : [];

    let matchedCount = 0;

    // Primary matching: affectedPathIds
    if (affectedPathIds.length > 0) {
      for (const pathId of affectedPathIds) {
        for (const edge of allEdges) {
          if (isEdgeAffectedByPathId(edge, pathId)) {
            if (!edge.activeConditions.includes(condition)) {
              edge.activeConditions.push(condition);
              matchedCount++;
            }
          }
        }
      }
    }

    // Fallback matching: location.areaName (if affectedPathIds was empty OR did not match any edges)
    if (matchedCount === 0 && condition.location && typeof condition.location === 'object') {
      const areaName = condition.location.areaName;
      if (areaName && typeof areaName === 'string') {
        for (const edge of allEdges) {
          if (isEdgeAffectedByAreaName(edge, areaName, graph)) {
            if (!edge.activeConditions.includes(condition)) {
              edge.activeConditions.push(condition);
            }
          }
        }
      }
    }
  }

  // Step 4: Calculate final penaltyMultiplier & isBlocked for affected edges
  for (const edge of allEdges) {
    if (edge.activeConditions.length === 0) {
      continue;
    }

    let blocked = false;
    let maxMultiplier = 1.0;

    for (const cond of edge.activeConditions) {
      const type = String(cond.type || '').toLowerCase();
      const severity = String(cond.severity || '').toLowerCase();

      if (type === 'blocked_path' || severity === 'critical') {
        blocked = true;
      } else if (severity === 'high') {
        maxMultiplier = Math.max(maxMultiplier, 4.0);
      } else if (severity === 'medium') {
        maxMultiplier = Math.max(maxMultiplier, 2.0);
      } else if (severity === 'low') {
        maxMultiplier = Math.max(maxMultiplier, 1.25);
      }
    }

    if (blocked) {
      edge.isBlocked = true;
      edge.penaltyMultiplier = Infinity;
    } else {
      edge.isBlocked = false;
      edge.penaltyMultiplier = maxMultiplier;
    }
  }

  return graph;
}

/**
 * Evaluates the effective cost of an edge taking into account campus condition penalties.
 *
 * @param {import('../models/Edge.js').Edge} edge 
 * @param {Function} [baseCostFn] - Base cost evaluator (defaults to edge distance)
 * @returns {number} Penalized edge cost (or Infinity if blocked)
 */
export function getPenalizedEdgeCost(edge, baseCostFn) {
  if (!edge) return 0;
  if (edge.isBlocked === true) {
    return Infinity;
  }
  const evaluator = typeof baseCostFn === 'function' ? baseCostFn : (e) => (e?.distance ?? 0);
  const baseCost = evaluator(edge);
  const multiplier = typeof edge.penaltyMultiplier === 'number' ? edge.penaltyMultiplier : 1.0;
  return baseCost * multiplier;
}
