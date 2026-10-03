/*
  GreenRoute - Panki Study Area Overpass QL Query
  Area: Panki, Kanpur, Uttar Pradesh, India
  Bounding Box: (South: 26.4495, West: 80.2270, North: 26.4697, East: 80.2496)
  Reference Center: 26.4596° N, 80.2383° E
  Source: OpenStreetMap (OSM)
*/

[out:json][timeout:30];
(
  // Retrieve all highway/road/path ways intersecting or inside the Panki study area bounding box
  way["highway"](26.4495,80.2270,26.4697,80.2496);
);
// Output way geometry details along with bounding box nodes
out body;
>;
out skel qt;
