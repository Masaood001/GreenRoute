export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-greenroute-600 rounded-xl flex items-center justify-center shadow-sm border border-greenroute-700">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-0.5 sm:mb-1 truncate">GreenRoute</h1>
          <p className="text-[10px] sm:text-xs font-semibold text-greenroute-700 uppercase tracking-wider truncate">Environmental-Aware Route Planning</p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-5">
        <button className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">About</button>
        <button className="text-sm font-semibold bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-sm ring-1 ring-slate-900/10">Sign In</button>
      </div>
    </header>
  );
}
