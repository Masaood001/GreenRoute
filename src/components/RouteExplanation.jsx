export default function RouteExplanation({ route }) {
  if (!route) return null;

  return (
    <div className="bg-greenroute-50/50 p-5 rounded-xl border border-greenroute-100">
      <h3 className="text-[11px] font-bold text-greenroute-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Why this route?
      </h3>
      <p className="text-[13px] text-slate-700 font-medium leading-relaxed">
        {route.explanation}
      </p>
    </div>
  );
}
