import { EnvironmentalAttributes } from './EnvironmentalAttributes.js';

/**
 * Data structure representing a calculated path or route result.
 */
export class Route {
  /**
   * @param {Object} [params]
   * @param {string|number|null} [params.id=null] - Route identifier
   * @param {string} [params.name=''] - Human-readable route name
   * @param {Array<string|number>} [params.nodeIds=[]] - Ordered list of node IDs forming the route
   * @param {Array<import('./Edge.js').Edge>} [params.edges=[]] - Ordered list of edges forming the route
   * @param {number} [params.totalDistance=0] - Aggregate distance
   * @param {number} [params.totalTime=0] - Aggregate travel time
   * @param {EnvironmentalAttributes} [params.aggregatedEnvironmental] - Aggregated environmental attributes
   * @param {number|null} [params.score=null] - Computed composite score
   * @param {number|null} [params.rank=null] - Route rank relative to candidates
   * @param {Object|null} [params.normalizedFactors=null] - Normalized factor scores (0.0 to 1.0)
   */
  constructor({
    id = null,
    name = '',
    nodeIds = [],
    edges = [],
    totalDistance = 0,
    totalTime = 0,
    aggregatedEnvironmental = new EnvironmentalAttributes(),
    score = null,
    rank = null,
    normalizedFactors = null,
  } = {}) {
    this.id = id;
    this.name = name;
    this.nodeIds = nodeIds;
    this.edges = edges;
    this.totalDistance = totalDistance;
    this.totalTime = totalTime;
    this.aggregatedEnvironmental = aggregatedEnvironmental;
    this.score = score;
    this.rank = rank;
    this.normalizedFactors = normalizedFactors;
  }
}

