import { EnvironmentalAttributes } from './EnvironmentalAttributes.js';

/**
 * Data structure representing an edge (street/path segment) between graph nodes.
 */
export class Edge {
  /**
   * @param {string|number} sourceId - ID of starting node
   * @param {string|number} targetId - ID of destination node
   * @param {number} [distance=0] - Distance of the edge (e.g., meters)
   * @param {number} [time=0] - Estimated travel time (e.g., seconds)
   * @param {EnvironmentalAttributes|Object} [environmentalAttributes] - Environmental parameters
   */
  constructor(sourceId, targetId, distance = 0, time = 0, environmentalAttributes = {}) {
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.distance = distance;
    this.time = time;
    this.environmentalAttributes = environmentalAttributes instanceof EnvironmentalAttributes
      ? environmentalAttributes
      : new EnvironmentalAttributes(environmentalAttributes);
  }
}
