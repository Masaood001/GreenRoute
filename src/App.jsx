import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import SearchBox from './components/SearchBox';
import MapPlaceholder from './components/MapPlaceholder';
import RouteComparison from './components/RouteComparison';
import PreferenceControls from './components/PreferenceControls';
import EnvironmentalInfo from './components/EnvironmentalInfo';
import RouteExplanation from './components/RouteExplanation';
import AuthModal from './components/AuthModal';
import AboutModal from './components/AboutModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import ProfileModal from './components/ProfileModal';
import ReportConditionModal from './components/ReportConditionModal';
import NavigationProgress from './components/NavigationProgress';
import { defaultPreferences } from './mockData';
import {
  calculateLiveCampusRoutes,
  onAuthStateChange,
  signOutUser,
  subscribeCampusConditions,
  resolveCampusCondition,
  startLocationTracking,
  stopLocationTracking,
  GEOLOCATION_ERROR_CODES,
  shouldAcceptNewLocationFix,
  calculateNavigationProgress,
  DEFAULT_REROUTE_COOLDOWN_MS,
  shouldTriggerReroute,
  executeAutomaticReroute,
} from './services/index.js';


import {
  mapInputToNodeId,
  resolvePreferenceProfile,
  getPreferenceWeights,
  transformRouteToUI,
} from './utils/routingHelpers.js';
import { resolvePankiLocationToNode } from './areas/panki/locationSearch.js';
import { resolveNodeInArea } from './areas/graphAdapter.js';

function App() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [areaId, setAreaId] = useState('panki-kanpur');

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originLocation, setOriginLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);

  const [travelMode, setTravelMode] = useState('walking');
  const [routes, setRoutes] = useState([]);
  const [activeConditions, setActiveConditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  // Live GPS User Tracking & Rerouting State
  const [currentUserLocation, setCurrentUserLocation] = useState(null);
  const [previousUserLocation, setPreviousUserLocation] = useState(null);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [isMapFollowingUser, setIsMapFollowingUser] = useState(false);
  const [trackingError, setTrackingError] = useState(null);
  const trackingWatchIdRef = useRef(null);

  const [previousOffRouteState, setPreviousOffRouteState] = useState(null);
  const previousOffRouteStateRef = useRef(null);
  const lastReroutedGpsRef = useRef(null);
  const [rerouteStatus, setRerouteStatus] = useState('IDLE');
  const isReroutingRef = useRef(false);
  const lastRerouteTimeRef = useRef(null);

  const navigationProgress = calculateNavigationProgress({
    currentUserLocation,
    selectedRoute,
    travelMode,
    previousLocation: previousUserLocation,
    options: {
      previousOffRouteState,
    },
  });

  const offRouteState = navigationProgress?.offRouteState;

  // Keep state updated with latest offRouteState only when state values actually change
  useEffect(() => {
    if (offRouteState) {
      previousOffRouteStateRef.current = offRouteState;
      const currentOffRoute = offRouteState;
      queueMicrotask(() => {
        setPreviousOffRouteState((prev) => {
          if (
            prev?.status === currentOffRoute.status &&
            prev?.confirmationCount === currentOffRoute.confirmationCount &&
            prev?.routeId === currentOffRoute.routeId
          ) {
            return prev;
          }
          return currentOffRoute;
        });
      });
    }
  }, [offRouteState]);

  // Automatic Rerouting Effect (GPS-8)
  useEffect(() => {
    const isArrived = navigationProgress?.isArrived;

    const currentGpsKey = currentUserLocation
      ? `${currentUserLocation.latitude}_${currentUserLocation.longitude}_${currentUserLocation.timestamp || 0}`
      : null;

    if (
      shouldTriggerReroute({
        offRouteState,
        isRerouting: isReroutingRef.current,
        lastRerouteTime: lastRerouteTimeRef.current,
        isArrived,
        cooldownMs: DEFAULT_REROUTE_COOLDOWN_MS,
        lastReroutedGpsKey: lastReroutedGpsRef.current,
        currentGpsKey,
        currentRouteId: selectedRoute?.id,
      })
    ) {
      isReroutingRef.current = true;
      lastReroutedGpsRef.current = currentGpsKey;
      setRerouteStatus('REROUTING');

      executeAutomaticReroute({
        currentUserLocation,
        destinationLocation,
        destination,
        travelMode,
        preferences,
        areaId,
        activeConditions,
      })
        .then((result) => {
          lastRerouteTimeRef.current = Date.now();
          isReroutingRef.current = false;

          if (result.success && result.routes && result.routes.length > 0) {
            setRoutes(result.routes);
            setSelectedRoute(result.selectedRoute);
            if (result.newOriginLocation) {
              setOriginLocation(result.newOriginLocation);
              setOrigin(result.newOriginLocation.name || 'My Location');
            }
            // Reset GPS-7 off-route state for new route
            const resetState = {
              routeId: result.selectedRoute.id,
              status: 'ON_ROUTE',
              confirmationCount: 0,
              isOffRoute: false,
              isUncertain: false,
              isOnRoute: true,
            };
            previousOffRouteStateRef.current = resetState;
            setPreviousOffRouteState(resetState);
            setRerouteStatus('SUCCESS');

            setTimeout(() => {
              setRerouteStatus('IDLE');
            }, 3000);
          } else {
            setRerouteStatus('FAILED');
          }
        })
        .catch((err) => {
          console.error('Reroute execution error:', err);
          lastRerouteTimeRef.current = Date.now();
          isReroutingRef.current = false;
          setRerouteStatus('FAILED');
        });
    }
  }, [
    offRouteState,
    navigationProgress?.isArrived,
    currentUserLocation,
    destinationLocation,
    destination,
    travelMode,
    preferences,
    areaId,
    activeConditions,
    selectedRoute?.id,
  ]);




  // Authentication & Modals State
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Independent Report A Problem Location State
  const [reportStartLocation, setReportStartLocation] = useState(null);
  const [reportEndLocation, setReportEndLocation] = useState(null);
  const [reportSelectionMode, setReportSelectionMode] = useState(null);

  // Derived modal visibility state for hiding map toolbar controls
  const isAnyForegroundModalOpen = Boolean(
    isAuthOpen || isAboutOpen || isChangePasswordOpen || isProfileOpen || isReportModalOpen
  );
  const areMapControlsVisible = !isAnyForegroundModalOpen;

  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Real-time active conditions subscription
  useEffect(() => {
    const unsubscribe = subscribeCampusConditions(
      (fetchedConditions) => {
        setActiveConditions(fetchedConditions || []);
      },
      { status: 'active' }
    );
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUser(null);
      setIsProfileOpen(false);
      setIsChangePasswordOpen(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const [boundaryError, setBoundaryError] = useState(null);

  const handlePauseMapFollow = useCallback(() => {
    setIsMapFollowingUser(false);
  }, []);

  const handleRecenter = useCallback(() => {
    if (currentUserLocation && typeof currentUserLocation.latitude === 'number' && typeof currentUserLocation.longitude === 'number') {
      setIsMapFollowingUser(true);
      return { success: true };
    }
    return { success: false, message: 'Live location is not available yet.' };
  }, [currentUserLocation]);

  const handleToggleLiveTracking = useCallback(() => {
    if (trackingWatchIdRef.current !== null) {
      stopLocationTracking(trackingWatchIdRef.current);
      trackingWatchIdRef.current = null;
    }

    if (isLiveTracking) {
      setIsLiveTracking(false);
      setIsMapFollowingUser(false);
      setCurrentUserLocation(null);
      setPreviousUserLocation(null);
      setTrackingError(null);
    } else {
      setTrackingError(null);
      setIsLiveTracking(true);
      setIsMapFollowingUser(true);

      const options = {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      };

      const watchId = startLocationTracking(
        (location) => {
          setCurrentUserLocation((prevTrusted) => {
            if (shouldAcceptNewLocationFix(prevTrusted, location)) {
              if (prevTrusted) {
                setPreviousUserLocation(prevTrusted);
              }
              return {
                ...location,
                source: 'gps',
                isLive: true,
              };
            }
            return prevTrusted;
          });
          setTrackingError(null);
        },

        (err) => {
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
          setTrackingError(friendlyMessage);
          setBoundaryError(friendlyMessage);
        },
        options
      );

      if (watchId !== null) {
        trackingWatchIdRef.current = watchId;
      } else {
        setIsLiveTracking(false);
        setIsMapFollowingUser(false);
      }
    }
  }, [isLiveTracking]);


  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (trackingWatchIdRef.current !== null) {
        stopLocationTracking(trackingWatchIdRef.current);
        trackingWatchIdRef.current = null;
      }
    };
  }, []);

  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
  };

  const handleSelectOrigin = (loc) => {
    setBoundaryError(null);
    setOriginLocation(loc);
    setOrigin(typeof loc === 'object' ? loc.name || loc.label || loc.nodeId : loc);
  };

  const handleSelectDestination = (loc) => {
    setBoundaryError(null);
    setDestinationLocation(loc);
    setDestination(typeof loc === 'object' ? loc.name || loc.label || loc.nodeId : loc);
  };

  const handleBoundaryError = (errorMsg) => {
    setBoundaryError(errorMsg);
  };

  const handleOpenReportModal = () => {
    setReportStartLocation(null);
    setReportEndLocation(null);
    setReportSelectionMode(null);
    setIsReportModalOpen(true);
  };

  const handleSelectReportStart = useCallback((loc) => {
    setReportStartLocation(loc);
    setReportSelectionMode(null);
    setIsReportModalOpen(true);
  }, []);

  const handleSelectReportEnd = useCallback((loc) => {
    setReportEndLocation(loc);
    setReportSelectionMode(null);
    setIsReportModalOpen(true);
  }, []);

  const handleClearReportLocations = useCallback(() => {
    setReportStartLocation(null);
    setReportEndLocation(null);
    setReportSelectionMode(null);
  }, []);

  const handleResolveCondition = async (conditionId) => {
    try {
      await resolveCampusCondition(conditionId);
    } catch (err) {
      console.error('Error resolving condition:', err);
    }
  };

  const handleGenerateRoutes = useCallback(async (searchParams = {}) => {
    const currentOrigin = searchParams.originLocation ?? searchParams.origin ?? originLocation ?? origin;
    const currentDest = searchParams.destinationLocation ?? searchParams.destination ?? destinationLocation ?? destination;
    const currentMode = searchParams.travelMode ?? travelMode;

    const hasOrigin = Boolean(typeof currentOrigin === 'object' ? currentOrigin : (typeof currentOrigin === 'string' && currentOrigin.trim()));
    const hasDest = Boolean(typeof currentDest === 'object' ? currentDest : (typeof currentDest === 'string' && currentDest.trim()));

    if (!hasOrigin || !hasDest) {
      return;
    }

    if (searchParams.travelMode) setTravelMode(searchParams.travelMode);
    if (searchParams.originLocation) setOriginLocation(searchParams.originLocation);
    if (searchParams.destinationLocation) setDestinationLocation(searchParams.destinationLocation);

    if (typeof currentOrigin === 'string') setOrigin(currentOrigin);
    if (typeof currentDest === 'string') setDestination(currentDest);

    setLoading(true);
    setError(null);
    setBoundaryError(null);

    try {
      // 1. Resolve Panki graph nodes first
      let startNodeId = resolvePankiLocationToNode(currentOrigin) || resolveNodeInArea('panki-kanpur', currentOrigin);
      let targetNodeId = resolvePankiLocationToNode(currentDest) || resolveNodeInArea('panki-kanpur', currentDest);

      // 2. Sample Campus N1-N7 fallback check
      let targetAreaId = 'panki-kanpur';
      if (!startNodeId || !targetNodeId) {
        startNodeId = mapInputToNodeId(typeof currentOrigin === 'string' ? currentOrigin : currentOrigin?.name, 'N1');
        targetNodeId = mapInputToNodeId(typeof currentDest === 'string' ? currentDest : currentDest?.name, 'N7');
        if (startNodeId.startsWith('N') && targetNodeId.startsWith('N')) {
          targetAreaId = 'sample-campus';
        } else {
          startNodeId = startNodeId || 'osm-node-8820570755';
          targetNodeId = targetNodeId || 'osm-node-3156228563';
        }
      }

      setAreaId(targetAreaId);

      const preferenceProfile = resolvePreferenceProfile(preferences);
      const weights = getPreferenceWeights(preferences, preferenceProfile);

      const rawRoutes = await calculateLiveCampusRoutes({
        areaId: targetAreaId,
        startNodeId,
        targetNodeId,
        preference: preferenceProfile,
        travelMode: currentMode,
        options: { weights, avoidHazards: true, useConditions: true, travelMode: currentMode },
      });

      const fallbackStatus = Boolean(rawRoutes?.isFallback);
      setIsFallback(fallbackStatus);

      const formattedRoutes = (rawRoutes || []).map((r, index) =>
        transformRouteToUI(r, index, fallbackStatus, currentMode)
      );

      setRoutes(formattedRoutes);
      if (formattedRoutes.length > 0) {
        setSelectedRoute(formattedRoutes[0]);
      } else {
        setSelectedRoute(null);
      }
    } catch (err) {
      console.error('Error generating live routes:', err);
      setError(err.message || 'Failed to calculate routes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [origin, destination, originLocation, destinationLocation, preferences, travelMode]);

  // Re-calculate routes ONLY when active conditions update
  const prevActiveConditionsRef = useRef(activeConditions);
  useEffect(() => {
    if (prevActiveConditionsRef.current === activeConditions) {
      return;
    }
    prevActiveConditionsRef.current = activeConditions;

    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) {
        if ((originLocation || origin) && (destinationLocation || destination)) {
          handleGenerateRoutes();
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeConditions, handleGenerateRoutes, originLocation, origin, destinationLocation, destination]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-greenroute-200 selection:text-greenroute-900">
      <Header
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onSignOut={handleSignOut}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col xl:flex-row gap-8">

        {/* Left Sidebar - Search and Preferences */}
        <div className="w-full xl:w-[380px] flex flex-col shrink-0 gap-6">
          <SearchBox
            origin={originLocation || origin}
            destination={destinationLocation || destination}
            onSelectOrigin={handleSelectOrigin}
            onSelectDestination={handleSelectDestination}
            onSearch={handleGenerateRoutes}
            onBoundaryError={handleBoundaryError}
            isLiveTracking={isLiveTracking}
            isMapFollowingUser={isMapFollowingUser}
            currentUserLocation={currentUserLocation}
            trackingError={trackingError}
            onToggleLiveTracking={handleToggleLiveTracking}
            onRecenter={handleRecenter}
            loading={loading}
          />

          {(isLiveTracking || selectedRoute) && (
            <NavigationProgress
              navigationProgress={navigationProgress}
              isLiveTracking={isLiveTracking}
              selectedRoute={selectedRoute}
              rerouteStatus={rerouteStatus}
            />
          )}


          {(boundaryError || error) && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm font-semibold shadow-sm">
              <div className="flex items-center gap-2 mb-1 text-red-900 font-bold">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{boundaryError ? 'Selection Error' : 'Routing Error'}</span>
              </div>
              {boundaryError || error}
            </div>
          )}

          <PreferenceControls
            preferences={preferences}
            onChange={setPreferences}
          />
        </div>

        {/* Center/Main Area - Map and Details */}
        <div className="flex-1 flex flex-col min-w-0 gap-8">
          <div className="h-[450px] lg:h-[550px] w-full shrink-0">
            <MapPlaceholder
              selectedRoute={selectedRoute}
              routes={routes}
              areaId={areaId}
              originLocation={originLocation}
              destinationLocation={destinationLocation}
              currentUserLocation={currentUserLocation}
              isLiveTracking={isLiveTracking}
              isMapFollowingUser={isMapFollowingUser}
              onPauseMapFollow={handlePauseMapFollow}
              onRecenter={handleRecenter}
              activeConditions={activeConditions}
              onSelectOrigin={handleSelectOrigin}
              onSelectDestination={handleSelectDestination}
              onResolveCondition={handleResolveCondition}
              onOpenReportModal={handleOpenReportModal}
              onBoundaryError={handleBoundaryError}
              reportStartLocation={reportStartLocation}
              reportEndLocation={reportEndLocation}
              onSelectReportStart={handleSelectReportStart}
              onSelectReportEnd={handleSelectReportEnd}
              reportSelectionMode={reportSelectionMode}
              onSetReportSelectionMode={setReportSelectionMode}
              areMapControlsVisible={areMapControlsVisible}
            />

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <RouteComparison
                routes={routes}
                selectedRoute={selectedRoute}
                onSelectRoute={handleSelectRoute}
                loading={loading}
                isFallback={isFallback}
              />
            </div>

            <div className="flex flex-col h-full">
              <h2 className="text-xl font-bold text-slate-800 mb-5 pl-1">Route Details</h2>
              <EnvironmentalInfo route={selectedRoute} />
              <RouteExplanation route={selectedRoute} />
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
      />

      <ReportConditionModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        startLocation={reportStartLocation}
        endLocation={reportEndLocation}
        user={user}
        onSelectMapTarget={setReportSelectionMode}
        onClearReportLocations={handleClearReportLocations}
        onConditionReported={() => {
          handleGenerateRoutes();
        }}
      />
    </div>
  );
}

export default App;
