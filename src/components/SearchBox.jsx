import { useState, useEffect, useRef } from 'react';
import {
  getPankiLocationSuggestions,
  searchPankiLocations,
  createGpsLocation,
} from '../areas/panki/locationSearch.js';
import {
  getCurrentLocation,
  GEOLOCATION_ERROR_CODES,
  getAccuracyClassification,
} from '../services/index.js';


export default function SearchBox({
  origin: originProp = '',
  destination: destinationProp = '',
  onSearch,
  onSelectOrigin,
  onSelectDestination,
  onBoundaryError,
  isLiveTracking = false,
  isMapFollowingUser = false,
  currentUserLocation = null,
  trackingError = null,
  onToggleLiveTracking,
  onRecenter,
  loading = false,
}) {

  const [origin, setOrigin] = useState(
    typeof originProp === 'object' ? originProp.name || '' : originProp || ''
  );
  const [destination, setDestination] = useState(
    typeof destinationProp === 'object' ? destinationProp.name || '' : destinationProp || ''
  );
  const [travelMode, setTravelMode] = useState('walking');
  const [locLoading, setLocLoading] = useState(false);

  // Dropdown Autocomplete States
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);

  const originBoxRef = useRef(null);
  const destBoxRef = useRef(null);

  const [prevOriginProp, setPrevOriginProp] = useState(originProp);
  const [prevDestProp, setPrevDestProp] = useState(destinationProp);

  if (originProp !== prevOriginProp) {
    setPrevOriginProp(originProp);
    setOrigin(typeof originProp === 'object' ? originProp.name || '' : originProp || '');
  }

  if (destinationProp !== prevDestProp) {
    setPrevDestProp(destinationProp);
    setDestination(typeof destinationProp === 'object' ? destinationProp.name || '' : destinationProp || '');
  }

  // Click outside listener to close suggestion dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (originBoxRef.current && !originBoxRef.current.contains(event.target)) {
        setShowOriginSuggestions(false);
      }
      if (destBoxRef.current && !destBoxRef.current.contains(event.target)) {
        setShowDestSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOriginChange = (val) => {
    setOrigin(val);
    const suggestions = getPankiLocationSuggestions(val);
    setOriginSuggestions(suggestions);
    setShowOriginSuggestions(true);
  };

  const handleDestChange = (val) => {
    setDestination(val);
    const suggestions = getPankiLocationSuggestions(val);
    setDestSuggestions(suggestions);
    setShowDestSuggestions(true);
  };

  const isOriginGps = typeof originProp === 'object' && (originProp?.source === 'gps' || originProp?.isGps);
  const isOriginFromMap = typeof originProp === 'object' && (originProp?.source === 'map-click' || originProp?.isMapClick);
  const isDestFromMap = typeof destinationProp === 'object' && (destinationProp?.source === 'map-click' || destinationProp?.isMapClick);

  const isFormValid = Boolean(
    typeof origin === 'object' ? origin : (typeof origin === 'string' && origin.trim())
  ) && Boolean(
    typeof destination === 'object' ? destination : (typeof destination === 'string' && destination.trim())
  );

  const selectOriginItem = (item) => {
    setOrigin(item.name);
    setShowOriginSuggestions(false);
    if (onSelectOrigin) onSelectOrigin(item);
  };

  const selectDestItem = (item) => {
    setDestination(item.name);
    setShowDestSuggestions(false);
    if (onSelectDestination) onSelectDestination(item);
  };

  const handleUseMyLocation = async () => {
    setLocLoading(true);
    if (onBoundaryError) onBoundaryError(null);

    try {
      const pos = await getCurrentLocation();
      const { latitude, longitude } = pos;

      const gpsLoc = createGpsLocation(latitude, longitude);

      if (gpsLoc.error) {
        if (onBoundaryError) onBoundaryError(gpsLoc.error);
        return;
      }

      setOrigin(gpsLoc.name || 'My Location');
      setShowOriginSuggestions(false);
      if (onSelectOrigin) onSelectOrigin(gpsLoc);
    } catch (err) {
      let friendlyMessage = 'Unable to determine your current location.';
      if (err && err.code) {
        switch (err.code) {
          case GEOLOCATION_ERROR_CODES.PERMISSION_DENIED:
            friendlyMessage = 'Location permission was denied. Please allow location access.';
            break;
          case GEOLOCATION_ERROR_CODES.POSITION_UNAVAILABLE:
            friendlyMessage = 'Unable to determine your current location.';
            break;
          case GEOLOCATION_ERROR_CODES.TIMEOUT:
            friendlyMessage = 'Location request timed out. Please try again.';
            break;
          case GEOLOCATION_ERROR_CODES.NOT_SUPPORTED:
            friendlyMessage = 'Location is not supported in this browser.';
            break;
          default:
            friendlyMessage = err.message || friendlyMessage;
            break;
        }
      }
      if (onBoundaryError) onBoundaryError(friendlyMessage);
    } finally {
      setLocLoading(false);
    }
  };

  const handleGenerate = (e) => {
    if (e) e.preventDefault();
    if (loading || !isFormValid) return;

    let originLocObj;
    if (typeof originProp === 'object' && originProp !== null && (originProp.name === origin || originProp.label === origin || originProp.isGps || originProp.source === 'gps')) {
      originLocObj = originProp;
    } else {
      const originResults = searchPankiLocations(origin);
      originLocObj = originResults.length > 0 ? originResults[0] : { name: origin, nodeId: origin };
    }

    let destLocObj;
    if (typeof destinationProp === 'object' && destinationProp !== null && (destinationProp.name === destination || destinationProp.label === destination)) {
      destLocObj = destinationProp;
    } else {
      const destResults = searchPankiLocations(destination);
      destLocObj = destResults.length > 0 ? destResults[0] : { name: destination, nodeId: destination };
    }

    if (onSearch) {
      onSearch({
        origin: originLocObj.nodeId || originLocObj.resolvedNodeId || origin,
        destination: destLocObj.nodeId || destLocObj.resolvedNodeId || destination,
        originLocation: originLocObj,
        destinationLocation: destLocObj,
        travelMode,
      });
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 sm:mb-5">Plan Your Route</h2>

      <form onSubmit={handleGenerate} className="space-y-4 sm:space-y-5">
        {/* ORIGIN INPUT */}
        <div className="relative" ref={originBoxRef}>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
            <label className="block text-sm font-semibold text-slate-700">Origin</label>
            <div className="flex items-center gap-1.5">
              {isOriginGps ? (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span>📍</span> GPS
                </span>
              ) : isOriginFromMap ? (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span>📍</span> Selected on map
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={loading || locLoading}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>📍</span>
                <span>{locLoading ? 'Locating...' : 'Use My Location'}</span>
              </button>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
              <div className="w-3 h-3 rounded-full border-2 border-emerald-600 bg-emerald-500 transition-colors"></div>
            </div>
            <input
              type="text"
              value={origin}
              onChange={(e) => handleOriginChange(e.target.value)}
              onFocus={() => {
                setOriginSuggestions(getPankiLocationSuggestions(origin));
                setShowOriginSuggestions(true);
              }}
              disabled={loading}
              className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-greenroute-500 focus:border-greenroute-500 sm:text-sm transition-all outline-none disabled:opacity-60"
              placeholder="Where are you?"
            />
          </div>

          {/* Origin Suggestions Dropdown */}
          {showOriginSuggestions && originSuggestions.length > 0 && (
            <div className="absolute z-[500] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1 text-sm">
              <div className="px-3 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                Panki Locations (OSM Data)
              </div>
              {originSuggestions.map((item, idx) => (
                <button
                  key={`orig-${item.id || idx}`}
                  type="button"
                  onClick={() => selectOriginItem(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center justify-between group border-b border-slate-50 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-slate-800 group-hover:text-emerald-900 block">
                      {item.name}
                    </span>
                    <span className="text-xs text-slate-400 block font-mono">
                      {item.highwayType ? `Type: ${item.highwayType}` : item.source || 'Panki Area'}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded group-hover:bg-emerald-200 group-hover:text-emerald-800">
                    Select
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative h-2">
          <div className="absolute left-5 -top-2 bottom-0 w-0.5 bg-slate-200"></div>
        </div>

        {/* DESTINATION INPUT */}
        <div className="relative" ref={destBoxRef}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-700">Destination</label>
            {isDestFromMap && (
              <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span>📍</span> Selected on map
              </span>
            )}
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              value={destination}
              onChange={(e) => handleDestChange(e.target.value)}
              onFocus={() => {
                setDestSuggestions(getPankiLocationSuggestions(destination));
                setShowDestSuggestions(true);
              }}
              disabled={loading}
              className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-greenroute-500 focus:border-greenroute-500 sm:text-sm transition-all outline-none disabled:opacity-60"
              placeholder="Where do you want to go?"
            />
          </div>

          {/* Destination Suggestions Dropdown */}
          {showDestSuggestions && destSuggestions.length > 0 && (
            <div className="absolute z-[500] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1 text-sm">
              <div className="px-3 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                Panki Locations (OSM Data)
              </div>
              {destSuggestions.map((item, idx) => (
                <button
                  key={`dest-${item.id || idx}`}
                  type="button"
                  onClick={() => selectDestItem(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-50 transition-colors flex items-center justify-between group border-b border-slate-50 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-slate-800 group-hover:text-red-900 block">
                      {item.name}
                    </span>
                    <span className="text-xs text-slate-400 block font-mono">
                      {item.highwayType ? `Type: ${item.highwayType}` : item.source || 'Panki Area'}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded group-hover:bg-red-200 group-hover:text-red-800">
                    Select
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-500 font-medium mr-1">Quick:</span>
          {getPankiLocationSuggestions('').slice(0, 3).map((item) => (
            <button
              key={`pill-${item.name}`}
              type="button"
              onClick={() => {
                if (!origin) {
                  selectOriginItem(item);
                } else {
                  selectDestItem(item);
                }
              }}
              className="text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
            >
              + {item.name}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Travel Mode</label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setTravelMode('walking')}
              className={`flex-1 flex justify-center items-center gap-2 py-2.5 px-3 rounded-xl border transition-all duration-200 ${travelMode === 'walking' ? 'bg-greenroute-50 border-greenroute-600 text-greenroute-800 ring-2 ring-greenroute-600/20 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm'}`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 21v-7.5a2.25 2.25 0 00-2.25-2.25h-1.5a1.5 1.5 0 01-1.5-1.5v-1.5a1.5 1.5 0 011.5-1.5h1.5a2.25 2.25 0 002.25-2.25V2.25" />
              </svg>
              <span className="text-sm font-semibold truncate">Walking</span>
            </button>
            <button
              type="button"
              onClick={() => setTravelMode('cycling')}
              className={`flex-1 flex justify-center items-center gap-2 py-2.5 px-3 rounded-xl border transition-all duration-200 ${travelMode === 'cycling' ? 'bg-greenroute-50 border-greenroute-600 text-greenroute-800 ring-2 ring-greenroute-600/20 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm'}`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16a2 2 0 001.996-2.047L10 13V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4c0 1.053.895 1.953 1.996 2.047A2 2 0 008 16zm0 0a2 2 0 002-2H6a2 2 0 002 2zm8 0a2 2 0 001.996-2.047L18 13V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v4c0 1.053.895 1.953 1.996 2.047A2 2 0 0016 16zm0 0a2 2 0 002-2h-4a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold truncate">Cycling</span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !isFormValid}
          className="w-full mt-4 bg-slate-900 text-white py-3.5 px-4 rounded-xl font-bold hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20 transition-all shadow-md hover:shadow-lg active:scale-[0.98] outline-none disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating Routes...' : 'Generate Routes'}
        </button>

        {/* Live Location Controls & Status Indicator */}
        {(() => {
          const accInfo = currentUserLocation?.accuracy != null ? getAccuracyClassification(currentUserLocation.accuracy) : null;
          let statusText = 'Location not active';

          if (isLiveTracking) {
            if (!currentUserLocation) {
              statusText = 'Improving GPS accuracy…';
            } else if (isMapFollowingUser) {
              statusText = accInfo ? `Following you (~${Math.round(currentUserLocation.accuracy)} m)` : 'Following you';
            } else {
              statusText = accInfo ? `Follow paused (~${Math.round(currentUserLocation.accuracy)} m)` : 'Follow paused';
            }
          } else if (trackingError) {
            statusText = 'Location unavailable';
          }

          return (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  isLiveTracking && currentUserLocation
                    ? (isMapFollowingUser ? 'bg-blue-600 animate-pulse' : 'bg-amber-500 animate-pulse')
                    : isLiveTracking
                    ? 'bg-amber-500 animate-ping'
                    : trackingError
                    ? 'bg-red-500'
                    : 'bg-slate-300'
                }`}></div>
                <span className="text-xs font-semibold text-slate-700">
                  {statusText}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isLiveTracking && (
                  <button
                    type="button"
                    onClick={onRecenter}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1 shadow-sm ${
                      isMapFollowingUser
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    <span>📍</span>
                    <span>{isMapFollowingUser ? 'Following' : 'Recenter'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onToggleLiveTracking}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-sm ${
                    isLiveTracking
                      ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <span>📍</span>
                  <span>{isLiveTracking ? 'Live Location On' : 'Start Live Location'}</span>
                </button>
              </div>
            </div>
          );
        })()}


      </form>
    </div>
  );
}
