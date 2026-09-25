/**
 * Data structure representing a node (intersection/point) in the route graph.
 */
export class Node {
  /**
   * @param {string|number} id - Unique identifier for the node
   * @param {Object} [coordinates={ lat: 0, lng: 0 }] - Geographical coordinates
   * @param {number} coordinates.lat
   * @param {number} coordinates.lng
   * @param {Object} [metadata={}] - Additional attributes (e.g., name, type)
   */
  constructor(id, coordinates = { lat: 0, lng: 0 }, metadata = {}) {
    this.id = id;
    this.coordinates = coordinates;
    this.metadata = metadata;
  }
}
