export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-greenroute-600 flex items-center justify-center text-white shadow-sm border border-greenroute-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">About GreenRoute</h3>
              <p className="text-xs font-semibold text-greenroute-700 uppercase tracking-wider">Environmental-Aware Route Planning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
          <p className="font-medium text-slate-800">
            GreenRoute is an intelligent navigation and pathfinding system designed to generate eco-friendly, healthy, and context-aware travel routes.
          </p>

          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-greenroute-800">Key Features & Architecture</h4>
            
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-greenroute-500"></span>
                <span>Multi-Objective Route Comparison</span>
              </div>
              <p className="text-xs text-slate-600 pl-4">
                Generates and ranks multiple candidate paths balancing travel time, distance, canopy shade, vegetation greenery, urban heat island metrics, and air pollution.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Dynamic Area & Campus Conditions</span>
              </div>
              <p className="text-xs text-slate-600 pl-4">
                Incorporates live active hazards, maintenance, construction, and path blockages directly into pathfinding to safely reroute travelers.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Graph Engine & Preference Profiles</span>
              </div>
              <p className="text-xs text-slate-600 pl-4">
                Built on a modular graph architecture using Dijkstra pathfinding and Min-Max factor normalization. Supports customizable user preferences (Time, Distance, Environment).
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Firebase Services & Data Foundation</span>
              </div>
              <p className="text-xs text-slate-600 pl-4">
                Powered by Cloud Firestore for environmental data telemetry and authentication services. Designed for configurable area expansion, currently preparing for real-world dataset integration in Panki, Kanpur.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
