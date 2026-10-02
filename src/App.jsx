import { useState } from 'react';
import Header from './components/Header';
import SearchBox from './components/SearchBox';
import MapPlaceholder from './components/MapPlaceholder';
import RouteComparison from './components/RouteComparison';
import PreferenceControls from './components/PreferenceControls';
import EnvironmentalInfo from './components/EnvironmentalInfo';
import RouteExplanation from './components/RouteExplanation';
import { mockRoutes, defaultPreferences } from './mockData';
import { calculateLiveCampusRoutes } from './services/routingIntegrationService.js';
import {
  mapInputToNodeId,
  resolvePreferenceProfile,
  getPreferenceWeights,
  transformRouteToUI,
} from './utils/routingHelpers.js';

function App() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [selectedRoute, setSelectedRoute] = useState(mockRoutes[1]);
  const [origin, setOrigin] = useState('North Gate');
  const [destination, setDestination] = useState('South Eco');
  const [routes, setRoutes] = useState(mockRoutes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
  };

  const handleGenerateRoutes = async (searchParams = {}) => {
    const currentOrigin = searchParams.origin ?? origin;
    const currentDest = searchParams.destination ?? destination;

    if (searchParams.origin) setOrigin(searchParams.origin);
    if (searchParams.destination) setDestination(searchParams.destination);

    setLoading(true);
    setError(null);

    try {
      const startNodeId = mapInputToNodeId(currentOrigin, 'N1');
      const targetNodeId = mapInputToNodeId(currentDest, 'N7');
      const preferenceProfile = resolvePreferenceProfile(preferences);
      const weights = getPreferenceWeights(preferences, preferenceProfile);

      const rawRoutes = await calculateLiveCampusRoutes({
        startNodeId,
        targetNodeId,
        preference: preferenceProfile,
        options: { weights, avoidHazards: true, useConditions: true },
      });

      const fallbackStatus = Boolean(rawRoutes?.isFallback);
      setIsFallback(fallbackStatus);

      const formattedRoutes = (rawRoutes || []).map((r, index) =>
        transformRouteToUI(r, index, fallbackStatus)
      );

      setRoutes(formattedRoutes);
      if (formattedRoutes.length > 0) {
        setSelectedRoute(formattedRoutes[0]);
      } else {
        setSelectedRoute(null);
      }
    } catch (err) {
      console.error('Error generating live campus routes:', err);
      setError(err.message || 'Failed to calculate campus routes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-greenroute-200 selection:text-greenroute-900">
      <Header />

      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col xl:flex-row gap-8">

        {/* Left Sidebar - Search and Preferences */}
        <div className="w-full xl:w-[380px] flex flex-col shrink-0 gap-6">
          <SearchBox
            origin={origin}
            destination={destination}
            onSearch={handleGenerateRoutes}
            loading={loading}
          />

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm font-semibold shadow-sm">
              <div className="flex items-center gap-2 mb-1 text-red-900 font-bold">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Routing Error</span>
              </div>
              {error}
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
            <MapPlaceholder selectedRoute={selectedRoute} />
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
    </div>
  );
}

export default App;
