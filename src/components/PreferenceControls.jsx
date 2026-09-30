export default function PreferenceControls({ preferences, onChange }) {
  const handleChange = (key, value) => {
    onChange({ ...preferences, [key]: parseInt(value) });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6">Route Preferences</h3>
      
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-slate-700">Prioritize Time</label>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">{preferences.timeWeight}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={preferences.timeWeight}
            onChange={(e) => handleChange('timeWeight', e.target.value)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1.5 uppercase tracking-wider">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-slate-700">Prioritize Distance</label>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">{preferences.distanceWeight}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={preferences.distanceWeight}
            onChange={(e) => handleChange('distanceWeight', e.target.value)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1.5 uppercase tracking-wider">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-greenroute-800">Prioritize Environment</label>
            <span className="text-xs font-bold text-greenroute-800 bg-greenroute-100 px-2.5 py-1 rounded-md border border-greenroute-200">{preferences.environmentWeight}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={preferences.environmentWeight}
            onChange={(e) => handleChange('environmentWeight', e.target.value)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-greenroute-600 focus:outline-none focus:ring-2 focus:ring-greenroute-400"
          />
          <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1.5 uppercase tracking-wider">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
