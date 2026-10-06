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
import { mapPankiConditionsForGraph } from '../areas/panki/conditionMapper.js';
import { createMapClickLocation } from '../areas/panki/locationSearch.js';

export default function MapView({
  selectedRoute,
  routes = [],
  areaId = 'panki-kanpur',
  originLocation,
  destinationLocation,
  currentUserLocation,
  _isLiveTracking = false,
  isMapFollowingUser = false,

  onPauseMapFollow,
  onRecenter,
  activeConditions = [],
  onSelectOrigin,
  onSelectDestination,
  onMapClickLocation,
  onResolveCondition,
  onOpenReportModal,
  onBoundaryError,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [clickTarget, setClickTarget] = useState('start'); // 'start' | 'destination'
  const [lastClickedLoc, setLastClickedLoc] = useState(null);
  const [recenterNotice, setRecenterNotice] = useState(null);

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
    onOpenReportModal,
    onBoundaryError,
    onPauseMapFollow,
    onRecenter,
    clickTarget,
    areaId,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelectOrigin,
      onSelectDestination,
      onMapClickLocation,
      onResolveCondition,
      onOpenReportModal,
      onBoundaryError,
      onPauseMapFollow,
      onRecenter,
      clickTarget,
      areaId,
    };
  }, [
    onSelectOrigin,
    onSelectDestination,
    onMapClickLocation,
    onResolveCondition,
    onOpenReportModal,
    onBoundaryError,
    onPauseMapFollow,
    onRecenter,
    clickTarget,
    areaId,
  ]);


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

    // Detect manual user drag / pan / zoom to pause follow mode
    map.on('dragstart', () => {
      if (callbacksRef.current.onPauseMapFollow) {
        callbacksRef.current.onPauseMapFollow();
      }
    });

    map.on('movestart', (e) => {
      if (e.originalEvent && callbacksRef.current.onPauseMapFollow) {
        callbacksRef.current.onPauseMapFollow();
      }
    });

    map.on('zoomstart', (e) => {
      if (e.originalEvent && callbacksRef.current.onPauseMapFollow) {
        callbacksRef.current.onPauseMapFollow();
      }
    });

    // Map Click Listener -> Free Map Location Selection inside Panki
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const { onSelectOrigin, onSelectDestination, onMapClickLocation, onBoundaryError, clickTarget } = callbacksRef.current;

      const locObj = createMapClickLocation(lat, lng);

      if (locObj.error) {
        if (onBoundaryError) {
          onBoundaryError(locObj.error);
        }
        return;
      }

      if (onBoundaryError) {
        onBoundaryError(null);
      }

      setLastClickedLoc(locObj);

      if (onMapClickLocation) {
        onMapClickLocation(locObj, clickTarget);
      }

      if (clickTarget === 'start' || clickTarget === 'origin') {
        if (onSelectOrigin) onSelectOrigin(locObj);
        setClickTarget('destination');
      } else {
        if (onSelectDestination) onSelectDestination(locObj);
        setClickTarget('destination');
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

    // 3. Draw Start Marker (Navigation Pin - Green)
    let originCoord = null;
    let originName = 'Selected Map Location';
    let originLat = null;
    let originLng = null;

    if (originLocation) {
      if (typeof originLocation === 'object') {
        if (originLocation.coordinate) {
          originLat = originLocation.coordinate.latitude;
          originLng = originLocation.coordinate.longitude;
          originCoord = [originLat, originLng];
        } else if (typeof originLocation.latitude === 'number' && typeof originLocation.longitude === 'number') {
          originLat = originLocation.latitude;
          originLng = originLocation.longitude;
          originCoord = [originLat, originLng];
        }
        originName = originLocation.name || originLocation.label || 'Selected Map Location';
      } else if (typeof originLocation === 'string') {
        originCoord = getNodeCoordinate(originLocation);
        if (originCoord) {
          originLat = originCoord[0];
          originLng = originCoord[1];
        }
        originName = originLocation;
      }
    } else if (selectedRoute?.nodeIds?.[0]) {
      const firstNodeId = selectedRoute.nodeIds[0];
      originCoord = getNodeCoordinate(firstNodeId);
      if (originCoord) {
        originLat = originCoord[0];
        originLng = originCoord[1];
      }
      originName = `Panki Node (${firstNodeId})`;
    }

    if (originCoord && typeof originLat === 'number' && typeof originLng === 'number') {
      const startIcon = L.divIcon({
        className: 'custom-map-marker-start',
        html: `
          <div style="position: relative; width: 32px; height: 42px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.4));">
              <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="#10B981"/>
              <circle cx="16" cy="15" r="6" fill="white"/>
            </svg>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -40],
      });

      const startPopupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 2px; min-width: 160px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background-color: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
              Start
            </span>
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${originName}
          </div>
          <div style="font-size: 11px; color: #64748b; font-family: monospace;">
            ${originLat.toFixed(6)}, ${originLng.toFixed(6)}
          </div>
        </div>
      `;

      L.marker(originCoord, { icon: startIcon })
        .bindPopup(startPopupHtml)
        .addTo(markersLayer);
    }

    // 4. Draw Destination Marker (Navigation Pin - Red)
    let destCoord = null;
    let destName = 'Selected Map Location';
    let destLat = null;
    let destLng = null;

    if (destinationLocation) {
      if (typeof destinationLocation === 'object') {
        if (destinationLocation.coordinate) {
          destLat = destinationLocation.coordinate.latitude;
          destLng = destinationLocation.coordinate.longitude;
          destCoord = [destLat, destLng];
        } else if (typeof destinationLocation.latitude === 'number' && typeof destinationLocation.longitude === 'number') {
          destLat = destinationLocation.latitude;
          destLng = destinationLocation.longitude;
          destCoord = [destLat, destLng];
        }
        destName = destinationLocation.name || destinationLocation.label || 'Selected Map Location';
      } else if (typeof destinationLocation === 'string') {
        destCoord = getNodeCoordinate(destinationLocation);
        if (destCoord) {
          destLat = destCoord[0];
          destLng = destCoord[1];
        }
        destName = destinationLocation;
      }
    } else if (selectedRoute?.nodeIds?.length > 0) {
      const lastNodeId = selectedRoute.nodeIds[selectedRoute.nodeIds.length - 1];
      destCoord = getNodeCoordinate(lastNodeId);
      if (destCoord) {
        destLat = destCoord[0];
        destLng = destCoord[1];
      }
      destName = `Panki Node (${lastNodeId})`;
    }

    if (destCoord && typeof destLat === 'number' && typeof destLng === 'number') {
      const destIcon = L.divIcon({
        className: 'custom-map-marker-end',
        html: `
          <div style="position: relative; width: 32px; height: 42px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.4));">
              <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="#EF4444"/>
              <circle cx="16" cy="15" r="6" fill="white"/>
            </svg>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -40],
      });

      const destPopupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 2px; min-width: 160px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background-color: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
              Destination
            </span>
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${destName}
          </div>
          <div style="font-size: 11px; color: #64748b; font-family: monospace;">
            ${destLat.toFixed(6)}, ${destLng.toFixed(6)}
          </div>
        </div>
      `;

      L.marker(destCoord, { icon: destIcon })
        .bindPopup(destPopupHtml)
        .addTo(markersLayer);
    }

    // 5. Draw Live Blue User Location Marker & Accuracy Halo
    if (currentUserLocation && typeof currentUserLocation.latitude === 'number' && typeof currentUserLocation.longitude === 'number') {
      const userLat = currentUserLocation.latitude;
      const userLng = currentUserLocation.longitude;
      const userCoord = [userLat, userLng];

      // Draw Accuracy Circle/Halo if accuracy is available
      if (typeof currentUserLocation.accuracy === 'number' && currentUserLocation.accuracy > 0 && !isNaN(currentUserLocation.accuracy)) {
        L.circle(userCoord, {
          radius: currentUserLocation.accuracy,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          weight: 1.5,
          stroke: true,
        }).addTo(markersLayer);
      }

      // Draw Pulsing Blue Dot Marker
      const blueUserIcon = L.divIcon({
        className: 'custom-map-marker-user',
        html: `
          <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 24px; height: 24px; background-color: rgba(59, 130, 246, 0.35); border-radius: 50%; border: 1px solid #3b82f6;"></div>
            <div style="width: 16px; height: 16px; background-color: #2563eb; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      });

      const accuracyText = typeof currentUserLocation.accuracy === 'number'
        ? `±${Math.round(currentUserLocation.accuracy)}m accuracy`
        : 'Live GPS Position';

      const userPopupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 2px; min-width: 150px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background-color: #2563eb; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
              Current Location
            </span>
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            Live User Marker
          </div>
          <div style="font-size: 11px; color: #64748b; font-family: monospace;">
            ${userLat.toFixed(6)}, ${userLng.toFixed(6)}
          </div>
          <div style="font-size: 10px; color: #3b82f6; font-weight: 600; margin-top: 2px;">
            ${accuracyText}
          </div>
        </div>
      `;

      L.marker(userCoord, { icon: blueUserIcon })
        .bindPopup(userPopupHtml)
        .addTo(markersLayer);
    }

    // 6. Draw Active Panki Condition Overlays & Markers
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
  }, [selectedRoute, routes, areaId, originLocation, destinationLocation, currentUserLocation, activeConditions]);

  // Controlled Map Follow Effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapFollowingUser || !currentUserLocation) return;
    if (typeof currentUserLocation.latitude !== 'number' || typeof currentUserLocation.longitude !== 'number') return;

    const lat = currentUserLocation.latitude;
    const lng = currentUserLocation.longitude;
    map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }, [currentUserLocation, isMapFollowingUser]);

  const handleRecenterClick = () => {
    if (currentUserLocation && typeof currentUserLocation.latitude === 'number' && typeof currentUserLocation.longitude === 'number') {
      const map = mapRef.current;
      if (map) {
        const zoom = Math.max(map.getZoom(), 15);
        map.setView([currentUserLocation.latitude, currentUserLocation.longitude], zoom, { animate: true });
      }
      setRecenterNotice(null);
      if (onRecenter) {
        onRecenter();
      }
    } else {
      setRecenterNotice('Live location is not available yet.');
      setTimeout(() => setRecenterNotice(null), 3000);
    }
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      <div ref={mapContainerRef} className="w-full h-full z-0 cursor-crosshair" />

      {/* Map Click Target Selector & Report Banner */}
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 flex-wrap max-w-[calc(100%-140px)] sm:max-w-none">
        <span className="text-xs font-bold text-slate-600 pl-2 pr-1 hidden sm:inline">Map Click:</span>
        <button
          type="button"
          onClick={() => setClickTarget('start')}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
            clickTarget === 'start' || clickTarget === 'origin'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Set Start
        </button>
        <button
          type="button"
          onClick={() => setClickTarget('destination')}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
            clickTarget === 'destination'
              ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600/30'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Set Destination
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

      {/* Recenter / Map Follow Control */}
      <div className="absolute bottom-4 right-4 z-[400] flex flex-col items-end gap-2">
        {recenterNotice && (
          <div className="bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg border border-slate-700">
            {recenterNotice}
          </div>
        )}
        <button
          type="button"
          onClick={handleRecenterClick}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-md border transition-all flex items-center gap-1.5 ${
            isMapFollowingUser && currentUserLocation
              ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700 ring-2 ring-blue-400/30'
              : 'bg-white/95 text-slate-800 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>📍</span>
          <span>{isMapFollowingUser ? 'Following' : 'Recenter'}</span>
        </button>
      </div>
    </div>
  );
}
