export default function EnvironmentalInfo({ route }) {
  if (!route) return null;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
      {/* Selected Route Header Summary */}
      <div className="border-b border-slate-100 pb-4 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide ${
                route.category === 'Greenest'
                  ? 'bg-greenroute-100 text-greenroute-700 border border-greenroute-200'
                  : route.category === 'Fastest'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-purple-100 text-purple-700 border border-purple-200'
              }`}
            >
              {route.category}
            </span>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide capitalize ${
                route.travelMode === 'cycling'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {route.travelMode || 'walking'}
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
              {route.name}
            </h3>
          </div>
          <div className="flex items-baseline gap-2 text-right">
            <span className="text-xl font-black text-slate-900">{route.duration}</span>
            <span className="text-xs font-semibold text-slate-500">({route.distance})</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-5 gap-3 sm:gap-0">
        <h3 className="text-base sm:text-lg font-bold text-slate-800">Environmental Impact</h3>
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-greenroute-50 px-3 py-1.5 rounded-lg border border-greenroute-200">
          <span className="text-[10px] sm:text-xs font-bold text-greenroute-800 uppercase tracking-wide">Score</span>
          <span className="text-sm sm:text-base font-black text-greenroute-600">{route.environmentalScore}/100</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
          <div className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 tracking-wider mb-2">Greenery</div>
          <div className="flex flex-col gap-2">
            <div className="text-xl font-extrabold text-greenroute-700 leading-none">{route.greenery}%</div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
              <div className="bg-greenroute-500 h-2 rounded-full" style={{ width: `${route.greenery}%` }}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
          <div className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 tracking-wider mb-2">Shade</div>
          <div className="flex flex-col gap-2">
            <div className="text-lg sm:text-xl font-extrabold text-slate-700 leading-none">{route.shade}%</div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
              <div className="bg-slate-700 h-2 rounded-full" style={{ width: `${route.shade}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 flex flex-col justify-center items-start h-full">
          <div className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 tracking-wider mb-2">Pollution</div>
          <div className={`px-3 py-1 rounded-md text-sm font-bold border ${
            route.pollution === 'Low' ? 'bg-greenroute-100 text-greenroute-800 border-greenroute-200' : 
            route.pollution === 'Moderate' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'
          }`}>
            {route.pollution}
          </div>
        </div>

        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 flex flex-col justify-center items-start h-full">
          <div className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 tracking-wider mb-2">Traffic / Heat</div>
          <div className={`px-3 py-1 rounded-md text-sm font-bold border ${
            route.traffic === 'Low' ? 'bg-greenroute-100 text-greenroute-800 border-greenroute-200' : 
            route.traffic === 'Moderate' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'
          }`}>
            {route.traffic} / {route.heat}
          </div>
        </div>
      </div>

      {route.isSimulated && (
        <div className="mt-4 p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600 flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] uppercase">Simulation</span>
          <span>{route.disclaimer || 'SIMULATED DATA FOR DEVELOPMENT ONLY'}</span>
        </div>
      )}
    </div>
  );
}
