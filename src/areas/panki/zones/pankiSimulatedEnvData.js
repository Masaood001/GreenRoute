/**
 * Benchmark Simulated Environmental Records for Panki Study Area
 *
 * IMPORTANT:
 * These records contain SIMULATED telemetry used for multi-objective route scoring
 * demonstrations in Panki, Kanpur, UP, India. They do NOT represent real-world sensor measurements.
 */

export const SIMULATION_SOURCE = 'GreenRoute Panki Study Area Benchmark Simulation';
export const SIMULATION_DISCLAIMER =
  'Simulated environmental telemetry for GreenRoute multi-objective routing demonstration in Panki, Kanpur. Not official government sensor data.';

export const PANKI_SIMULATED_ENV_RECORDS = [
  {
    zoneId: 'PZ-01',
    airQuality: { aqi: 110, category: 'Unhealthy for Sensitive Groups' },
    temperature: { celsius: 29.5 },
    shade: { score: 45, level: 'moderate' },
    greenery: { score: 40 },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    zoneId: 'PZ-02',
    airQuality: { aqi: 155, category: 'Unhealthy' },
    temperature: { celsius: 32.0 },
    shade: { score: 25, level: 'sparse' },
    greenery: { score: 20 },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    zoneId: 'PZ-03',
    airQuality: { aqi: 65, category: 'Moderate' },
    temperature: { celsius: 26.5 },
    shade: { score: 75, level: 'dense' },
    greenery: { score: 80 },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    zoneId: 'PZ-04',
    airQuality: { aqi: 48, category: 'Good' },
    temperature: { celsius: 25.0 },
    shade: { score: 85, level: 'dense' },
    greenery: { score: 90 },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
];

export function getPankiSimulatedEnvRecords() {
  return PANKI_SIMULATED_ENV_RECORDS;
}

export default PANKI_SIMULATED_ENV_RECORDS;
