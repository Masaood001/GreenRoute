export default function PreferenceControls({ preferences, onChange }) {
  const handleChange = (key, value) => {
    onChange({ ...preferences, [key]: parseInt(value) });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
      <h3 className="text-lg font-bold text-slate-800 mb-5">Route Preferences</h3>
      
      <div className="space-y-6">
        <div className="group">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-semibold text-slate-700">Prioritize Time</label>
            <span className="text-xs font-bold text-slate-600">{preferences.timeWeight}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={preferences.timeWeight}
            onChange={(e) => handleChange('timeWeight', e.target.value)}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600 focus:outline-none"
          />
        </div>

        <div className="group">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-semibold text-slate-700">Prioritize Distance</label>
            <span className="text-xs font-bold text-slate-600">{preferences.distanceWeight}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={preferences.distanceWeight}
            onChange={(e) => handleChange('distanceWeight', e.target.value)}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600 focus:outline-none"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 group">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-semibold text-greenroute-700">Prioritize Environment</label>
            <span className="text-xs font-bold text-greenroute-700">{preferences.environmentWeight}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="100" 
            value={preferences.environmentWeight}
            onChange={(e) => handleChange('environmentWeight', e.target.value)}
            className="w-full h-1.5 bg-greenroute-200 rounded-lg appearance-none cursor-pointer accent-greenroute-600 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
