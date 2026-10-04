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
import { mapPankiConditionsForGraph } from '../areas/panki/conditionMapper.js';

export default function MapView({
  selectedRoute,
  routes = [],
  areaId = 'panki-kanpur',
  originLocation,
  destinationLocation,
  activeConditions = [],
  onSelectOrigin,
  onSelectDestination,
  onMapClickLocation,
  onResolveCondition,
  onOpenReportModal,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [clickTarget, setClickTarget] = useState('origin'); // 'origin' | 'destination'
  const [lastClickedLoc, setLastClickedLoc] = useState(null);

  const layersRef = useRef({
    boundary: null,
    roads: null,
    routes: null,
    markers: null,
    conditions: null,
  });

  // Store active callbacks in ref to avoid stale closures in Leaflet event handlers
  const callbacksRef = useRef({
    onSelectOrigin,
    onSelectDestination,
    onMapClickLocation,
    onResolveCondition,
    clickTarget,
    areaId,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelectOrigin,
      onSelectDestination,
      onMapClickLocation,
      onResolveCondition,
      clickTarget,
      areaId,
    };
  }, [onSelectOrigin, onSelectDestination, onMapClickLocation, onResolveCondition, clickTarget, areaId]);

  // Global popup button click handler for resolving conditions
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const btn = e.target.closest('.resolve-cond-btn');
      if (btn) {
        const condId = btn.getAttribute('data-cond-id');
        if (condId && callbacksRef.current.onResolveCondition) {
          callbacksRef.current.onResolveCondition(condId);
        }
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

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

    // 6. Conditions Layer Group
    const conditionsLayer = L.layerGroup().addTo(map);

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

      setLastClickedLoc(locObj);

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
      conditions: conditionsLayer,
    };

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Route Polylines, Origin/Dest Markers, and Active Conditions
  useEffect(() => {
    const map = mapRef.current;
    const { routes: routesLayer, markers: markersLayer, conditions: conditionsLayer } = layersRef.current;
    if (!map || !routesLayer || !markersLayer || !conditionsLayer) return;

    routesLayer.clearLayers();
    markersLayer.clearLayers();
    conditionsLayer.clearLayers();

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

    // 5. Draw Active Panki Condition Overlays & Markers
    if (Array.isArray(activeConditions) && activeConditions.length > 0) {
      const { mappedConditions } = mapPankiConditionsForGraph(activeConditions);

      for (const cond of mappedConditions) {
        const cLat = cond.location?.latitude ?? cond.location?.lat;
        const cLng = cond.location?.longitude ?? cond.location?.lng;
        if (typeof cLat !== 'number' || typeof cLng !== 'number') continue;

        let iconBg = '#d97706'; // default amber/hazard
        let iconSymbol = '⚠️';
        const cType = String(cond.type || '').toLowerCase();
        const cSeverity = String(cond.severity || '').toLowerCase();

        if (cType === 'blocked_path') {
          iconBg = '#dc2626';
          iconSymbol = '⛔';
        } else if (cType === 'construction') {
          iconBg = '#ea580c';
          iconSymbol = '🚧';
        } else if (cType === 'maintenance') {
          iconBg = '#0284c7';
          iconSymbol = '🔧';
        } else if (cType === 'event') {
          iconBg = '#9333ea';
          iconSymbol = '🚩';
        }

        const condIcon = L.divIcon({
          className: 'custom-map-condition-marker',
          html: `
            <div style="background-color: ${iconBg}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 0 3px 8px rgba(0,0,0,0.4); border: 2px solid white;">
              ${iconSymbol}
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popupHtml = `
          <div style="font-family: sans-serif; min-width: 180px; padding: 2px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="background-color: ${iconBg}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase;">
                ${cType.replace('_', ' ')}
              </span>
              <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">
                ${cSeverity}
              </span>
            </div>
            <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
              ${cond.title || 'Road Condition'}
            </div>
            ${cond.description ? `<div style="font-size: 11px; color: #334155; margin-bottom: 6px;">${cond.description}</div>` : ''}
            <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-bottom: 8px;">
              Status: ${cond.status || 'active'} • ${cond.mappedEdgeId ? `Edge: ${cond.mappedEdgeId}` : 'Mapped'}
            </div>
            <button
              type="button"
              class="resolve-cond-btn"
              data-cond-id="${cond.id}"
              style="width: 100%; background-color: #0f172a; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer;"
            >
              Resolve Condition
            </button>
          </div>
        `;

        L.marker([cLat, cLng], { icon: condIcon })
          .bindPopup(popupHtml)
          .addTo(conditionsLayer);
      }
    }
  }, [selectedRoute, routes, areaId, originLocation, destinationLocation, activeConditions]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      <div ref={mapContainerRef} className="w-full h-full z-0 cursor-crosshair" />

      {/* Map Click Target Selector & Report Banner */}
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 flex-wrap max-w-[calc(100%-140px)] sm:max-w-none">
        <span className="text-xs font-bold text-slate-600 pl-2 pr-1 hidden sm:inline">Map Click:</span>
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
        {onOpenReportModal && (
          <button
            type="button"
            onClick={() => onOpenReportModal(lastClickedLoc || originLocation)}
            className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-sm flex items-center gap-1"
          >
            <span>⚠️</span>
            <span>Report Condition</span>
          </button>
        )}
      </div>

      {/* Area Badge */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 z-[400] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Panki Study Area (~5 km²)</span>
      </div>
    </div>
  );
}
