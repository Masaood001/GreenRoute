export default function EnvironmentalInfo({ route }) {
  if (!route) return null;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-800">Environmental Impact</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Score</span>
          <span className="text-lg font-bold text-greenroute-600">{route.environmentalScore}<span className="text-xs text-slate-400 font-medium">/100</span></span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-[13px] mb-1.5">
            <span className="font-medium text-slate-700">Greenery</span>
            <span className="font-semibold text-greenroute-600">{route.greenery}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-greenroute-500 h-full rounded-full" style={{ width: `${route.greenery}%` }}></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[13px] mb-1.5">
            <span className="font-medium text-slate-700">Shade</span>
            <span className="font-semibold text-slate-600">{route.shade}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-slate-400 h-full rounded-full" style={{ width: `${route.shade}%` }}></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pollution</div>
            <div className="text-[13px] font-medium text-slate-800 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${route.pollution === 'Low' ? 'bg-greenroute-500' :
                  route.pollution === 'Moderate' ? 'bg-amber-400' : 'bg-red-500'
                }`}></div>
              {route.pollution}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Traffic / Heat</div>
            <div className="text-[13px] font-medium text-slate-800">
              {route.traffic} / {route.heat}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
