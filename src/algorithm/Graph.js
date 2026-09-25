import { Node } from './models/Node.js';
import { Edge } from './models/Edge.js';

/**
 * Graph data structure representing the road network for eco-routing.
 */
export class Graph {
  constructor() {
    /** @type {Map<string|number, Node>} */
    this.nodes = new Map();
    /** @type {Map<string|number, Edge[]>} */
    this.adjacencyList = new Map();
  }

  /**
   * Add a node to the graph.
   * @param {Node|string|number} nodeOrId 
   * @param {Object} [coordinates] 
   * @param {Object} [metadata] 
   * @returns {Node}
   */
  addNode(nodeOrId, coordinates, metadata) {
    const node = nodeOrId instanceof Node 
      ? nodeOrId 
      : new Node(nodeOrId, coordinates, metadata);
      
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, []);
    }
    return node;
  }

  /**
   * Add an edge to the graph.
   * @param {Edge|string|number} edgeOrSourceId 
   * @param {string|number} [targetId] 
   * @param {number} [distance] 
   * @param {number} [time] 
   * @param {Object} [environmentalAttributes] 
   * @param {boolean} [bidirectional=false] 
   * @returns {Edge}
   */
  addEdge(edgeOrSourceId, targetId, distance, time, environmentalAttributes, bidirectional = false) {
    let edge;
    if (edgeOrSourceId instanceof Edge) {
      edge = edgeOrSourceId;
    } else {
      edge = new Edge(edgeOrSourceId, targetId, distance, time, environmentalAttributes);
    }

    if (!this.nodes.has(edge.sourceId)) {
      this.addNode(edge.sourceId);
    }
    if (!this.nodes.has(edge.targetId)) {
      this.addNode(edge.targetId);
    }

    this.adjacencyList.get(edge.sourceId).push(edge);

    if (bidirectional) {
      const reverseEdge = new Edge(
        edge.targetId,
        edge.sourceId,
        edge.distance,
        edge.time,
        edge.environmentalAttributes
      );
      this.adjacencyList.get(edge.targetId).push(reverseEdge);
    }

    return edge;
  }

  /**
   * Check if node exists in graph.
   * @param {string|number} id 
   * @returns {boolean}
   */
  hasNode(id) {
    return this.nodes.has(id);
  }

  /**
   * Get node by ID.
   * @param {string|number} id 
   * @returns {Node|undefined}
   */
  getNode(id) {
    return this.nodes.get(id);
  }

  /**
   * Get outgoing edges for a given node.
   * @param {string|number} id 
   * @returns {Edge[]}
   */
  getNeighbors(id) {
    return this.adjacencyList.get(id) || [];
  }

  /**
   * Get all nodes in graph.
   * @returns {Node[]}
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }
}
