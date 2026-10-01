/**
 * GreenRoute Simulated Campus Benchmark Data
 *
 * IMPORTANT DISCLAIMER:
 * All data in this file is strictly SIMULATED for offline development, routing algorithm testing,
 * and UI mocking. It does not represent live IoT sensor readings or actual campus field reports.
 */

import { addCampusCondition } from "./campusConditionsService.js";
import { recordEnvironmentalData } from "./environmentalDataService.js";

export const SIMULATION_DISCLAIMER =
  "SIMULATED DATA FOR DEVELOPMENT ONLY - NOT REAL SENSOR MEASUREMENTS";

export const SIMULATION_SOURCE = "SIMULATED_CAMPUS_BENCHMARK";

/**
 * Benchmark campus environmental zones with varying shade, greenness, and air quality profiles.
 */
export const SIMULATED_CAMPUS_ZONES = [
  {
    zoneId: "zone_central_quad",
    zoneName: "Central Quad Lawn & Peristyle",
    location: { latitude: 28.5458, longitude: 77.1925 },
    airQuality: { aqi: 35, category: "Good", pm25: 8.5, pm10: 18.0 },
    temperature: { celsius: 24.5, humidity: 48, feelsLike: 24.5 },
    shade: { score: 85, level: "dense" },
    greenery: { score: 90, description: "Mature banyan and neem canopy with grass lawn" },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    zoneId: "zone_science_promenade",
    zoneName: "Science Block Promenade",
    location: { latitude: 28.5472, longitude: 77.1941 },
    airQuality: { aqi: 62, category: "Moderate", pm25: 17.0, pm10: 38.0 },
    temperature: { celsius: 27.0, humidity: 42, feelsLike: 28.0 },
    shade: { score: 40, level: "partial" },
    greenery: { score: 50, description: "Paved boulevard with young ornamental trees" },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    zoneId: "zone_botanical_trail",
    zoneName: "Campus Botanical Garden Trail",
    location: { latitude: 28.5441, longitude: 77.1908 },
    airQuality: { aqi: 22, category: "Good", pm25: 5.0, pm10: 12.0 },
    temperature: { celsius: 22.8, humidity: 60, feelsLike: 22.8 },
    shade: { score: 95, level: "dense" },
    greenery: { score: 98, description: "Dense multi-story botanical flora and bamboo grove" },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    zoneId: "zone_hostel_avenue",
    zoneName: "Hostel Outer Ring Road",
    location: { latitude: 28.5432, longitude: 77.1952 },
    airQuality: { aqi: 78, category: "Moderate", pm25: 24.0, pm10: 52.0 },
    temperature: { celsius: 28.5, humidity: 40, feelsLike: 29.5 },
    shade: { score: 20, level: "none" },
    greenery: { score: 30, description: "Asphalt roadway with sparse roadside shrubs" },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    zoneId: "zone_sports_complex",
    zoneName: "Sports Complex & Track Pathway",
    location: { latitude: 28.5489, longitude: 77.1915 },
    airQuality: { aqi: 48, category: "Good", pm25: 12.0, pm10: 28.0 },
    temperature: { celsius: 26.2, humidity: 45, feelsLike: 26.5 },
    shade: { score: 15, level: "none" },
    greenery: { score: 45, description: "Open athletics turf with perimeter hedge" },
    source: SIMULATION_SOURCE,
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
];

/**
 * Benchmark campus conditions for testing detour routing and hazard avoidance.
 */
export const SIMULATED_CAMPUS_CONDITIONS = [
  {
    title: "North Quad Walkway Paving",
    description: "Paver block replacement work between Admin Building and Central Library",
    type: "construction",
    severity: "medium",
    status: "active",
    location: { latitude: 28.5465, longitude: 77.1932, areaName: "North Quad Walkway" },
    affectedPathIds: ["path_admin_lib_01"],
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    title: "Library East Ramp Fallen Branch",
    description: "Storm debris partially blocking wheelchair access ramp",
    type: "hazard",
    severity: "high",
    status: "active",
    location: { latitude: 28.5461, longitude: 77.1939, areaName: "Library East Entrance" },
    affectedPathIds: ["ramp_lib_east"],
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
  {
    title: "Hostel 3 Staircase Resurfacing",
    description: "Scheduled non-slip coating application on external stairs",
    type: "maintenance",
    severity: "low",
    status: "scheduled",
    location: { latitude: 28.5435, longitude: 77.1948, areaName: "Hostel 3 West Wing" },
    affectedPathIds: ["stairs_h3_west"],
    isSimulated: true,
    disclaimer: SIMULATION_DISCLAIMER,
  },
];

/**
 * Populates Firestore with simulated baseline data.
 * NOTE: Can only be executed by an authenticated administrator due to Firestore rules.
 *
 * @returns {Promise<{ conditionsCount: number, environmentalCount: number }>}
 */
export async function seedSimulatedCampusData() {
  let conditionsCount = 0;
  let environmentalCount = 0;

  for (const condition of SIMULATED_CAMPUS_CONDITIONS) {
    await addCampusCondition(condition);
    conditionsCount++;
  }

  for (const zone of SIMULATED_CAMPUS_ZONES) {
    await recordEnvironmentalData(zone);
    environmentalCount++;
  }

  return { conditionsCount, environmentalCount };
}
