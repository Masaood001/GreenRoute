import { useState } from 'react';

export default function SearchBox({
  origin: originProp = 'North Gate',
  destination: destinationProp = 'South Eco',
  onSearch,
  loading = false,
}) {
  const [origin, setOrigin] = useState(originProp);
  const [destination, setDestination] = useState(destinationProp);
  const [travelMode, setTravelMode] = useState('walking');

  const handleGenerate = (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    if (onSearch) {
      onSearch({ origin, destination });
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 sm:mb-5">Plan Your Route</h2>

      <form onSubmit={handleGenerate} className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Origin</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <div className="w-3 h-3 rounded-full border-2 border-slate-400 group-focus-within:border-slate-600 transition-colors"></div>
            </div>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              disabled={loading}
              className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-greenroute-500 focus:border-greenroute-500 sm:text-sm transition-all outline-none disabled:opacity-60"
              placeholder="Enter starting point"
            />
          </div>
        </div>

        <div className="relative h-2">
          <div className="absolute left-5 -top-2 bottom-0 w-0.5 bg-slate-200"></div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Destination</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-greenroute-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={loading}
              className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-greenroute-500 focus:border-greenroute-500 sm:text-sm transition-all outline-none disabled:opacity-60"
              placeholder="Enter destination"
            />
          </div>
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
          disabled={loading}
          className="w-full mt-4 bg-slate-900 text-white py-3.5 px-4 rounded-xl font-bold hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20 transition-all shadow-md hover:shadow-lg active:scale-[0.98] outline-none disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating Routes...' : 'Generate Routes'}
        </button>
      </form>
    </div>
  );
}
