import { EnvironmentalAttributes } from '../models/EnvironmentalAttributes.js';

/**
 * Pure mapping function to transform a Firebase environmental_data record
 * into an algorithm-compatible EnvironmentalAttributes model.
 *
 * Mapping Rules:
 * - airQuality.aqi        -> pollution
 * - temperature.celsius   -> heat
 * - shade.score / 100     -> shade (normalized to 0.0 - 1.0 scale)
 * - greenery.score / 100  -> greenery (normalized to 0.0 - 1.0 scale)
 *
 * @param {Object|null|undefined} firebaseData - Firebase environmental_data record
 * @returns {EnvironmentalAttributes} Initialized EnvironmentalAttributes instance
 */
export function mapFirebaseEnvToAttributes(firebaseData) {
  if (!firebaseData || typeof firebaseData !== 'object') {
    return new EnvironmentalAttributes();
  }

  const rawAqi = firebaseData.airQuality?.aqi;
  const rawCelsius = firebaseData.temperature?.celsius;
  const rawShade = firebaseData.shade?.score;
  const rawGreenery = firebaseData.greenery?.score;

  const pollution = rawAqi !== undefined && rawAqi !== null && !isNaN(Number(rawAqi))
    ? Number(rawAqi)
    : 0;

  const heat = rawCelsius !== undefined && rawCelsius !== null && !isNaN(Number(rawCelsius))
    ? Number(rawCelsius)
    : 0;

  const shade = rawShade !== undefined && rawShade !== null && !isNaN(Number(rawShade))
    ? Number(rawShade) / 100
    : 0;

  const greenery = rawGreenery !== undefined && rawGreenery !== null && !isNaN(Number(rawGreenery))
    ? Number(rawGreenery) / 100
    : 0;

  return new EnvironmentalAttributes({
    pollution,
    heat,
    shade,
    greenery,
  });
}
