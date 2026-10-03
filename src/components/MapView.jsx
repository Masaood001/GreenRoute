import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getPankiBoundary,
  getPankiCenter,
  getPankiRoadFeatures,
  routeToPolyline,
  getNodeCoordinate,
} from '../areas/panki/mapDataAdapter.js';

export default function MapView({ selectedRoute, routes = [], areaId = 'panki-kanpur' }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({
    boundary: null,
    roads: null,
    routes: null,
    markers: null,
  });

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center = getPankiCenter(); // { latitude: 26.4596, longitude: 80.2383 }
    const map = L.map(mapContainerRef.current, {
      center: [center.latitude, center.longitude],
      zoom: 14,
      zoomControl: true,
    });

    // 1. Tile Layer with OpenStreetMap Attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // 2. Boundary Layer
    const boundaryGeoJSON = getPankiBoundary();
    const boundaryLayer = L.geoJSON(boundaryGeoJSON, {
      style: {
        color: '#059669',
        weight: 2,
        opacity: 0.8,
        fillColor: '#10b981',
        fillOpacity: 0.08,
        dashArray: '5, 5',
      },
    }).addTo(map);

    // 3. Road Network Background Layer
    const roadsLayer = L.layerGroup().addTo(map);
    const roadFeatures = getPankiRoadFeatures();
    for (const road of roadFeatures) {
      L.polyline(road.coordinates, {
        color: '#64748b',
        weight: 1.5,
        opacity: 0.35,
      }).addTo(roadsLayer);
    }

    // 4. Routes Layer Group
    const routesLayer = L.layerGroup().addTo(map);

    // 5. Markers Layer Group
    const markersLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    layersRef.current = {
      boundary: boundaryLayer,
      roads: roadsLayer,
      routes: routesLayer,
      markers: markersLayer,
    };

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Route Polylines and Markers when selectedRoute or routes change
  useEffect(() => {
    const map = mapRef.current;
    const { routes: routesLayer, markers: markersLayer } = layersRef.current;
    if (!map || !routesLayer || !markersLayer) return;

    routesLayer.clearLayers();
    markersLayer.clearLayers();

    // 1. Draw Alternative Candidate Routes
    if (Array.isArray(routes)) {
      for (const r of routes) {
        if (selectedRoute && r.id === selectedRoute.id) continue;
        const altPolyline = routeToPolyline(r);
        if (altPolyline.length > 0) {
          L.polyline(altPolyline, {
            color: '#3b82f6',
            weight: 3.5,
            opacity: 0.5,
            dashArray: '4, 4',
          }).addTo(routesLayer);
        }
      }
    }

    // 2. Draw Selected Route Polyline
    if (selectedRoute) {
      const polylineCoords = routeToPolyline(selectedRoute);
      if (polylineCoords.length > 0) {
        const routeLine = L.polyline(polylineCoords, {
          color: '#059669',
          weight: 5.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routesLayer);

        // Fit map bounds to selected route
        const bounds = routeLine.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }

        // 3. Draw Start / Origin Marker
        const firstNodeId = selectedRoute.nodeIds?.[0];
        const lastNodeId = selectedRoute.nodeIds?.[selectedRoute.nodeIds.length - 1];

        const startCoord = getNodeCoordinate(firstNodeId) || polylineCoords[0];
        const endCoord = getNodeCoordinate(lastNodeId) || polylineCoords[polylineCoords.length - 1];

        if (startCoord) {
          const startIcon = L.divIcon({
            className: 'custom-map-marker-start',
            html: `
              <div style="background-color: #059669; color: white; width: 28px; height: 28px; borderRadius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">
                A
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          L.marker(startCoord, { icon: startIcon })
            .bindPopup(`<b>Origin Node</b><br/>${firstNodeId || 'Start'}`)
            .addTo(markersLayer);
        }

        if (endCoord) {
          const endIcon = L.divIcon({
            className: 'custom-map-marker-end',
            html: `
              <div style="background-color: #dc2626; color: white; width: 28px; height: 28px; borderRadius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">
                B
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          L.marker(endCoord, { icon: endIcon })
            .bindPopup(`<b>Destination Node</b><br/>${lastNodeId || 'End'}`)
            .addTo(markersLayer);
        }
      } else {
        // Fallback for sample N1-N7 campus graph routes (e.g. SF coordinates)
        const sampleStartCoord = getNodeCoordinate(selectedRoute.nodeIds?.[0]);
        const sampleEndCoord = getNodeCoordinate(selectedRoute.nodeIds?.[selectedRoute.nodeIds.length - 1]);

        if (sampleStartCoord && sampleEndCoord) {
          const sampleLine = L.polyline([sampleStartCoord, sampleEndCoord], {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '6, 6',
          }).addTo(routesLayer);

          const sampleBounds = sampleLine.getBounds();
          if (sampleBounds.isValid()) {
            map.fitBounds(sampleBounds, { padding: [50, 50] });
          }
        }
      }
    }
  }, [selectedRoute, routes, areaId]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 z-[400] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Panki Study Area (~5 km²)</span>
      </div>
    </div>
  );
}
