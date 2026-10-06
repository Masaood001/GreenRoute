import React from 'react';

/**
 * GreenRoute Compact Live Navigation Progress UI Component
 * Displays real-time ETA, remaining distance, current speed, and route progress bar.
 *
 * @param {object} props
 * @param {object} [props.navigationProgress] - Output of calculateNavigationProgress
 * @param {boolean} [props.isLiveTracking] - Whether live GPS tracking is active
 * @param {object} [props.selectedRoute] - Currently selected route
 */
export default function NavigationProgress({
  navigationProgress = null,
  isLiveTracking = false,
  selectedRoute = null,
}) {
  if (!isLiveTracking && !selectedRoute) {
    return null;
  }

  const progress = navigationProgress || {
    isNavigationActive: false,
    statusText: isLiveTracking ? 'Waiting for a route.' : 'Start Live Location to see live progress.',
    progressPercent: 0,
    remainingDistanceFormatted: '0 m',
    currentSpeedFormatted: '0 km/h',
    etaFormatted: '0 min',
    isArrived: false,
  };

  const {
    statusText,
    progressPercent = 0,
    remainingDistanceFormatted = '0 m',
    currentSpeedFormatted = '0 km/h',
    etaFormatted = '0 min',
    isArrived = false,
    isOffRoute = false,
    isUncertain = false,
    isNavigationActive = false,
  } = progress;

  const clampedPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 transition-all">
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            isArrived
              ? 'bg-emerald-500 animate-pulse'
              : isOffRoute
              ? 'bg-rose-500 animate-pulse'
              : isUncertain
              ? 'bg-amber-400 animate-pulse'
              : isNavigationActive
              ? 'bg-blue-600 animate-pulse'
              : 'bg-slate-400'
          }`}></div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Navigation Progress
          </span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
          isArrived
            ? 'bg-emerald-100 text-emerald-800'
            : isOffRoute
            ? 'bg-rose-100 text-rose-800'
            : isUncertain
            ? 'bg-amber-100 text-amber-800'
            : isNavigationActive
            ? 'bg-blue-50 text-blue-700'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {statusText}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center my-3">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-tight">
            ETA
          </span>
          <span className="block text-sm sm:text-base font-extrabold text-blue-700 mt-0.5 truncate">
            {etaFormatted}
          </span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-tight">
            Remaining
          </span>
          <span className="block text-sm sm:text-base font-extrabold text-slate-800 mt-0.5 truncate">
            {remainingDistanceFormatted}
          </span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-tight">
            Speed
          </span>
          <span className="block text-sm sm:text-base font-extrabold text-emerald-700 mt-0.5 truncate">
            {currentSpeedFormatted}
          </span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-tight">
            Progress
          </span>
          <span className="block text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 truncate">
            {clampedPercent}%
          </span>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-3">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isArrived ? 'bg-emerald-500' : 'bg-blue-600'
          }`}
          style={{ width: `${clampedPercent}%` }}
        ></div>
      </div>

      {/* Arrival Banner */}
      {isArrived && (
        <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold text-center flex items-center justify-center gap-1.5">
          <span>🎉</span>
          <span>You have arrived at your destination!</span>
        </div>
      )}
    </div>
  );
}
