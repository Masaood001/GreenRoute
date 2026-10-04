import { useState, useEffect, useCallback } from 'react';
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
import { defaultPreferences } from './mockData';
import {
  calculateLiveCampusRoutes,
  onAuthStateChange,
  signOutUser,
  subscribeCampusConditions,
  resolveCampusCondition,
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

  // Authentication & Modals State
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportLocation, setReportLocation] = useState(null);

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

  const handleOpenReportModal = (loc) => {
    setReportLocation(loc || originLocation);
    setIsReportModalOpen(true);
  };

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

  // Re-calculate routes when active conditions update
  useEffect(() => {
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
            loading={loading}
          />

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
              activeConditions={activeConditions}
              onSelectOrigin={handleSelectOrigin}
              onSelectDestination={handleSelectDestination}
              onResolveCondition={handleResolveCondition}
              onOpenReportModal={handleOpenReportModal}
              onBoundaryError={handleBoundaryError}
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
        location={reportLocation}
        user={user}
        onConditionReported={() => {
          handleGenerateRoutes();
        }}
      />
    </div>
  );
}

export default App;
