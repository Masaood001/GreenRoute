import { useState } from 'react';

export default function SearchBox() {
  const [travelMode, setTravelMode] = useState('walking');

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-bold text-slate-800 mb-5">Plan Your Route</h2>
      
      <div className="space-y-5">
        {/* Origin / Dest Inputs */}
        <div className="relative flex flex-col gap-4">
          {/* Connecting Line */}
          <div className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-slate-200 z-0"></div>
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex flex-shrink-0 items-center justify-center">
              <div className="w-2.5 h-2.5 bg-slate-600 rounded-full"></div>
            </div>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-greenroute-500 focus:ring-1 focus:ring-greenroute-500 transition-colors"
              placeholder="Origin (e.g. Library)"
            />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-greenroute-50 border border-greenroute-200 flex flex-shrink-0 items-center justify-center">
              <svg className="w-4 h-4 text-greenroute-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-greenroute-500 focus:ring-1 focus:ring-greenroute-500 transition-colors"
              placeholder="Destination (e.g. Science Block)"
            />
          </div>
        </div>

        {/* Travel Mode */}
        <div className="pt-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Travel Mode</label>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setTravelMode('walking')}
              className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${
                travelMode === 'walking' 
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Walking
            </button>
            <button 
              onClick={() => setTravelMode('cycling')}
              className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${
                travelMode === 'cycling' 
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cycling
            </button>
          </div>
        </div>

        <button className="w-full mt-2 bg-greenroute-600 text-white py-3 rounded-lg font-bold hover:bg-greenroute-700 focus:outline-none focus:ring-2 focus:ring-greenroute-500 focus:ring-offset-2 transition-colors">
          Generate Routes
        </button>
      </div>
    </div>
  );
}
