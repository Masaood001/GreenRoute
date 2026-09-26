import { useState } from 'react';
import Header from './components/Header';
import SearchBox from './components/SearchBox';
import MapPlaceholder from './components/MapPlaceholder';
import RouteComparison from './components/RouteComparison';
import PreferenceControls from './components/PreferenceControls';
import EnvironmentalInfo from './components/EnvironmentalInfo';
import RouteExplanation from './components/RouteExplanation';
import { mockRoutes, defaultPreferences } from './mockData';

function App() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [selectedRoute, setSelectedRoute] = useState(mockRoutes[1]); // Default to Greener Route

  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-greenroute-200 selection:text-greenroute-900">
      <Header />
      
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col xl:flex-row gap-8">
        
        {/* Left Sidebar - Search and Preferences */}
        <div className="w-full xl:w-[380px] flex flex-col shrink-0">
          <SearchBox />
          <PreferenceControls 
            preferences={preferences} 
            onChange={setPreferences} 
          />
        </div>

        {/* Center/Main Area - Map and Details */}
        <div className="flex-1 flex flex-col min-w-0 gap-8">
          <div className="h-[450px] lg:h-[550px] w-full shrink-0">
            <MapPlaceholder />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <RouteComparison 
                routes={mockRoutes} 
                selectedRoute={selectedRoute} 
                onSelectRoute={handleSelectRoute} 
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
