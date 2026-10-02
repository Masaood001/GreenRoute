export default function MapPlaceholder({ selectedRoute }) {
  return (
    <div className="relative w-full h-full min-h-[400px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col items-center justify-center">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTM5LjUgMGwuNS41di41aC00MHYtMWg0MHptMCAzOS41bC41LjV2LjVoLTQwdi0xaDQwem0tMzkuNS0zOS41di41SDB2LTFsLjUtLjV6bTM5LjUgM3YuNUgwdS0xbDQwLjV6IiBmaWxsPSJyZ2JhKDQ3LCA2MCwgNzQsIDAuMikiLz4KPC9zdmc+')]"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center max-w-md bg-white/90 backdrop-blur-md rounded-2xl border border-white shadow-xl">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5 border border-slate-200 text-slate-500 shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h3 className="text-xl font-extrabold text-slate-800 mb-2">Map Integration View</h3>
        {selectedRoute ? (
          <div className="mt-2 text-slate-700 space-y-2">
            <div className="font-bold text-greenroute-800 text-base">{selectedRoute.name} ({selectedRoute.duration} • {selectedRoute.distance})</div>
            {selectedRoute.nodeIds && selectedRoute.nodeIds.length > 0 && (
              <div className="text-xs font-semibold bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-mono">
                Path: {selectedRoute.nodeIds.join(' → ')}
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-600 mb-0 leading-relaxed font-medium">
            This container is ready to seamlessly integrate React-Leaflet or alternative map providers once the algorithm team provides real data.
          </p>
        )}
      </div>
      
      {/* Mock Map Controls */}
      <div className="absolute right-5 bottom-5 flex flex-col gap-3">
        <button className="w-12 h-12 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors hover:shadow-xl">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button className="w-12 h-12 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors hover:shadow-xl">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
