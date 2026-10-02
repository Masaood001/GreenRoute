export const mockRoutes = [
  {
    id: 'route-a',
    name: 'Fastest Route',
    category: 'Fastest',
    duration: '12 min',
    distance: '1.2 km',
    environmentalScore: 62,
    greenery: 40,
    pollution: 'Moderate',
    traffic: 'High',
    heat: 'High',
    shade: 20,
    warning: null,
    explanation: 'This route is the most direct and takes the least amount of time, but it passes through higher traffic areas with less shade.'
  },
  {
    id: 'route-b',
    name: 'Greener Route',
    category: 'Greenest',
    duration: '15 min',
    distance: '1.4 km',
    environmentalScore: 86,
    greenery: 90,
    pollution: 'Low',
    traffic: 'Low',
    heat: 'Low',
    shade: 80,
    warning: null,
    explanation: 'This route takes approximately 3 minutes longer but passes through a greener and more shaded area, avoiding major traffic.'
  },
  {
    id: 'route-c',
    name: 'Alternative Route',
    category: 'Balanced',
    duration: '14 min',
    distance: '1.3 km',
    environmentalScore: 75,
    greenery: 60,
    pollution: 'Low',
    traffic: 'Moderate',
    heat: 'Medium',
    shade: 50,
    warning: 'Avoids construction on Main St.',
    explanation: 'A balanced option that offers decent shade and avoids the current construction on the main road.'
  }
];

export const defaultPreferences = {
  timeWeight: 50,
  distanceWeight: 50,
  environmentWeight: 75
};
