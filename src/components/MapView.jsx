import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getPankiBoundary,
  getPankiCenter,
  getPankiRoadFeatures,
  routeToPolyline,
  getNodeCoordinate,
} from '../areas/panki/mapDataAdapter.js';
import { findNearestNodeInArea } from '../areas/graphAdapter.js';

export default function MapView({
  selectedRoute,
  routes = [],
  areaId = 'panki-kanpur',
  originLocation,
  destinationLocation,
  onSelectOrigin,
  onSelectDestination,
  onMapClickLocation,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [clickTarget, setClickTarget] = useState('origin'); // 'origin' | 'destination'

  const layersRef = useRef({
    boundary: null,
    roads: null,
    routes: null,
    markers: null,
  });

  // Store active callbacks in ref to avoid stale closures in Leaflet event handlers
  const callbacksRef = useRef({
    onSelectOrigin,
    onSelectDestination,
    onMapClickLocation,
    clickTarget,
    areaId,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelectOrigin,
      onSelectDestination,
      onMapClickLocation,
      clickTarget,
      areaId,
    };
  }, [onSelectOrigin, onSelectDestination, onMapClickLocation, clickTarget, areaId]);

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

    // Map Click Listener -> Resolve Nearest Real Panki Node
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const currentArea = callbacksRef.current.areaId || 'panki-kanpur';
      const nearest = findNearestNodeInArea(currentArea, lat, lng);
      if (!nearest) return;

      const displayLabel =
        nearest.name && nearest.name !== nearest.id
          ? nearest.name
          : `Panki Node ${nearest.id.replace(/^osm-node-/, '')}`;

      const locObj = {
        id: nearest.id,
        name: displayLabel,
        coordinate: { latitude: nearest.latitude, longitude: nearest.longitude },
        nodeId: nearest.id,
        source: 'Map Click',
        distanceMeters: nearest.distanceMeters,
      };

      const { onSelectOrigin, onSelectDestination, onMapClickLocation, clickTarget } = callbacksRef.current;

      if (onMapClickLocation) {
        onMapClickLocation(locObj, clickTarget);
      }

      if (clickTarget === 'origin') {
        if (onSelectOrigin) onSelectOrigin(locObj);
        setClickTarget('destination');
      } else {
        if (onSelectDestination) onSelectDestination(locObj);
        setClickTarget('origin');
      }
    });

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

  // Update Route Polylines and Markers when selectedRoute, routes, or location props change
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
      }
    }

    // 3. Draw Origin Marker (A)
    let originCoord = null;
    let originLabel = 'Origin';

    if (originLocation) {
      if (typeof originLocation === 'object' && originLocation.coordinate) {
        originCoord = [originLocation.coordinate.latitude, originLocation.coordinate.longitude];
        originLabel = originLocation.name || 'Origin';
      } else if (typeof originLocation === 'string') {
        originCoord = getNodeCoordinate(originLocation);
        originLabel = originLocation;
      }
    } else if (selectedRoute?.nodeIds?.[0]) {
      const firstNodeId = selectedRoute.nodeIds[0];
      originCoord = getNodeCoordinate(firstNodeId);
      originLabel = `Origin Node (${firstNodeId})`;
    }

    if (originCoord) {
      const startIcon = L.divIcon({
        className: 'custom-map-marker-start',
        html: `
          <div style="background-color: #059669; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white;">
            A
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      L.marker(originCoord, { icon: startIcon })
        .bindPopup(`<b>Origin</b><br/>${originLabel}`)
        .addTo(markersLayer);
    }

    // 4. Draw Destination Marker (B)
    let destCoord = null;
    let destLabel = 'Destination';

    if (destinationLocation) {
      if (typeof destinationLocation === 'object' && destinationLocation.coordinate) {
        destCoord = [destinationLocation.coordinate.latitude, destinationLocation.coordinate.longitude];
        destLabel = destinationLocation.name || 'Destination';
      } else if (typeof destinationLocation === 'string') {
        destCoord = getNodeCoordinate(destinationLocation);
        destLabel = destinationLocation;
      }
    } else if (selectedRoute?.nodeIds?.length > 0) {
      const lastNodeId = selectedRoute.nodeIds[selectedRoute.nodeIds.length - 1];
      destCoord = getNodeCoordinate(lastNodeId);
      destLabel = `Destination Node (${lastNodeId})`;
    }

    if (destCoord) {
      const endIcon = L.divIcon({
        className: 'custom-map-marker-end',
        html: `
          <div style="background-color: #dc2626; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white;">
            B
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      L.marker(destCoord, { icon: endIcon })
        .bindPopup(`<b>Destination</b><br/>${destLabel}`)
        .addTo(markersLayer);
    }
  }, [selectedRoute, routes, areaId, originLocation, destinationLocation]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      <div ref={mapContainerRef} className="w-full h-full z-0 cursor-crosshair" />

      {/* Map Click Target Selector Banner */}
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-1">
        <span className="text-xs font-bold text-slate-600 pl-2 pr-1 hidden sm:inline">Set via Map Click:</span>
        <button
          type="button"
          onClick={() => setClickTarget('origin')}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
            clickTarget === 'origin'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Origin (A)
        </button>
        <button
          type="button"
          onClick={() => setClickTarget('destination')}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
            clickTarget === 'destination'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Destination (B)
        </button>
      </div>

      {/* Area Badge */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 z-[400] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Panki Study Area (~5 km²)</span>
      </div>
    </div>
  );
}
