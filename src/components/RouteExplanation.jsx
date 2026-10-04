export default function RouteExplanation({ route }) {
  if (!route) return null;

  return (
    <div className="bg-greenroute-50/70 p-4 sm:p-6 rounded-2xl border border-greenroute-200 shadow-sm relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-greenroute-100 rounded-full opacity-50 blur-2xl pointer-events-none"></div>
      
      <div className="relative z-10 flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-greenroute-100 rounded-lg flex items-center justify-center border border-greenroute-200 shadow-sm text-greenroute-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-[13px] font-extrabold text-greenroute-900 uppercase tracking-widest">Why this route?</h3>
        </div>
        <span className="text-xs font-bold text-greenroute-800 bg-greenroute-100/90 px-2.5 py-1 rounded-lg border border-greenroute-200 shrink-0">
          {route.name}
        </span>
      </div>
      <p className="relative z-10 text-[15px] text-greenroute-900 font-medium leading-relaxed">
        {route.explanation}
      </p>
    </div>
  );
}
