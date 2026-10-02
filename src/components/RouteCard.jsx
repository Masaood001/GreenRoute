export default function RouteCard({ route, isSelected, onClick }) {
  return (
    <div 
      onClick={() => onClick(route)}
      className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-300 relative overflow-hidden group ${
        isSelected 
          ? 'border-greenroute-500 bg-greenroute-50/30 shadow-md ring-2 ring-greenroute-500/20' 
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg hover:-translate-y-1'
      }`}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-1.5 h-full bg-greenroute-500"></div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-3 pl-1 gap-1 sm:gap-0">
        <div>
          <span className={`inline-block px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold mb-1.5 sm:mb-2.5 tracking-wide ${
            route.category === 'Greenest' ? 'bg-greenroute-100 text-greenroute-700 border border-greenroute-200' :
            route.category === 'Fastest' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
            route.category === 'Balanced' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
            'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            {route.category}
          </span>
          <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">{route.name}</h3>
        </div>
        <div className="flex sm:block justify-between w-full sm:w-auto mt-2 sm:mt-0 items-end sm:text-right">
          <div className="font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">{route.duration}</div>
          <div className="text-xs sm:text-sm font-semibold text-slate-500">{route.distance}</div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-4 sm:mt-5 mb-2 pl-1 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100">
        <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start flex-1 w-full sm:w-auto">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest sm:mb-1">Env Score</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
              route.environmentalScore > 80 ? 'bg-greenroute-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
              route.environmentalScore > 60 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-red-400'
            }`}></div>
            <span className="font-bold text-xs sm:text-sm text-slate-800">{route.environmentalScore}/100</span>
          </div>
        </div>
        <div className="w-full h-px sm:w-px sm:h-8 bg-slate-200"></div>
        <div className="flex gap-2 sm:gap-3 justify-start sm:justify-end flex-1 sm:pr-2">
          {route.greenery > 50 && (
            <div className="flex items-center text-greenroute-600 bg-white p-1.5 rounded-md border border-slate-200 shadow-sm" title="High Greenery">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {route.shade > 50 && (
            <div className="flex items-center text-slate-600 bg-white p-1.5 rounded-md border border-slate-200 shadow-sm" title="Good Shade">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {route.warning && (
        <div className="mt-3 flex items-start gap-2.5 text-xs font-medium text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
          <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="leading-relaxed">{route.warning}</p>
        </div>
      )}
    </div>
  );
}
