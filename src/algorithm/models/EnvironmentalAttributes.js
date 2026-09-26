/**
 * Data structure representing environmental factors for a road/path segment or route.
 */
export class EnvironmentalAttributes {
  /**
   * @param {Object} [params]
   * @param {number} [params.pollution=0] - Air pollution / AQI metric (lower is cleaner)
   * @param {number} [params.heat=0] - Urban heat island / temperature metric (lower is cooler)
   * @param {number} [params.greenery=0] - Greenery / vegetation coverage index (0.0 to 1.0 or scale)
   * @param {number} [params.shade=0] - Tree shade / canopy coverage index (0.0 to 1.0 or scale)
   */
  constructor({ pollution = 0, heat = 0, greenery = 0, shade = 0 } = {}) {
    this.pollution = Math.max(0, Number(pollution) || 0);
    this.heat = Math.max(0, Number(heat) || 0);
    this.greenery = Math.max(0, Number(greenery) || 0);
    this.shade = Math.max(0, Number(shade) || 0);
  }
}
