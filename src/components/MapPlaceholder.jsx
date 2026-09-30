export default function MapPlaceholder() {
  return (
    <div className="relative w-full h-full min-h-[400px] bg-[#eef2ec] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Illustrative Campus Map SVG */}
      <svg className="absolute inset-0 w-full h-full object-cover opacity-90" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <rect width="100%" height="100%" fill="#eef2ec" />
        
        {/* Parks/Green areas */}
        <path d="M 100 100 Q 200 50 300 150 T 500 200 T 700 100 L 800 0 L 0 0 Z" fill="#d1e2c4" />
        <path d="M 400 400 Q 500 350 600 450 T 800 500 L 800 600 L 300 600 Z" fill="#d1e2c4" />
        
        {/* Buildings (Gray blocks) */}
        <rect x="150" y="250" width="80" height="60" fill="#cbd5e1" rx="6" />
        <rect x="250" y="200" width="60" height="120" fill="#cbd5e1" rx="6" />
        <rect x="550" y="300" width="100" height="80" fill="#cbd5e1" rx="6" />
        <rect x="100" y="450" width="120" height="70" fill="#cbd5e1" rx="6" />
        <rect x="350" y="100" width="90" height="70" fill="#cbd5e1" rx="6" />
        <rect x="650" y="150" width="70" height="90" fill="#cbd5e1" rx="6" />
        
        {/* Roads (White lines) */}
        <path d="M 0 350 L 300 350 L 500 250 L 800 250" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M 300 0 L 300 350 L 400 600" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M 500 250 L 500 600" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        
        {/* The "Greener Route" - Dotted Green Line */}
        <path d="M 190 280 L 280 280 L 280 135 L 395 135 L 550 250" stroke="#22c55e" strokeWidth="6" fill="none" strokeDasharray="8 8" />
        
        {/* Location Markers */}
        <circle cx="190" cy="280" r="8" fill="#334155" />
        <circle cx="190" cy="280" r="14" fill="none" stroke="#334155" strokeWidth="2" opacity="0.5" />
        
        <circle cx="550" cy="250" r="8" fill="#22c55e" />
        <circle cx="550" cy="250" r="14" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.5" />
      </svg>
      
      {/* Overlay Content */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/60 rounded-lg px-3 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
          <span className="text-xs font-semibold text-slate-700 tracking-wide">Campus route preview</span>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-2">
        <button className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        <button className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
      </div>
    </div>
  );
}
