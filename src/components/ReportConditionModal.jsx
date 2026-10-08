import { useState, useEffect, useRef } from 'react';
import {
  ALLOWED_CONDITION_TYPES,
  ALLOWED_SEVERITIES,
  addCampusCondition,
} from '../services/index.js';
import {
  getPankiLocationSuggestions,
  isPointInPankiBoundary,
} from '../areas/panki/locationSearch.js';
import { findNearestEdgeInPanki } from '../areas/panki/conditionMapper.js';

export default function ReportConditionModal({
  isOpen,
  onClose,
  user,
  onConditionReported,
  startLocation: externalStartLoc,
  endLocation: externalEndLoc,
  onSelectMapTarget,
  onClearReportLocations,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('blocked_path');
  const [severity, setSeverity] = useState('high');

  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);

  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [showEndDropdown, setShowEndDropdown] = useState(false);

  const [isMinimizedForMap, setIsMinimizedForMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startRef = useRef(null);
  const endRef = useRef(null);

  const prevStartRef = useRef(externalStartLoc);
  const prevEndRef = useRef(externalEndLoc);

  // Sync external map selections to local modal state asynchronously
  useEffect(() => {
    if (externalStartLoc && externalStartLoc !== prevStartRef.current) {
      prevStartRef.current = externalStartLoc;
      queueMicrotask(() => {
        setStartLocation(externalStartLoc);
        setStartQuery(externalStartLoc.name || externalStartLoc.label || 'Selected Map Point');
      });
    }
  }, [externalStartLoc]);

  useEffect(() => {
    if (externalEndLoc && externalEndLoc !== prevEndRef.current) {
      prevEndRef.current = externalEndLoc;
      queueMicrotask(() => {
        setEndLocation(externalEndLoc);
        setEndQuery(externalEndLoc.name || externalEndLoc.label || 'Selected Map Point');
      });
    }
  }, [externalEndLoc]);

  // Reset form state when modal opens cleanly
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      queueMicrotask(() => {
        setTitle('');
        setDescription('');
        setType('blocked_path');
        setSeverity('high');
        setStartLocation(null);
        setEndLocation(null);
        setStartQuery('');
        setEndQuery('');
        setError(null);
        setIsMinimizedForMap(false);
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartSearchChange = (val) => {
    setStartQuery(val);
    if (!val.trim()) {
      setStartLocation(null);
      setStartSuggestions([]);
      setShowStartDropdown(false);
      return;
    }
    const suggestions = getPankiLocationSuggestions(val);
    setStartSuggestions(suggestions);
    setShowStartDropdown(true);
  };

  const handleSelectStartSuggestion = (loc) => {
    const lat = loc.coordinate?.latitude ?? loc.latitude;
    const lng = loc.coordinate?.longitude ?? loc.longitude;
    if (lat !== undefined && lng !== undefined && !isPointInPankiBoundary(lat, lng)) {
      setError('Problem Start Point must be inside the Panki study area.');
      return;
    }
    setStartLocation(loc);
    setStartQuery(loc.name || loc.label || 'Selected Location');
    setShowStartDropdown(false);
    setError(null);
  };

  const handleEndSearchChange = (val) => {
    setEndQuery(val);
    if (!val.trim()) {
      setEndLocation(null);
      setEndSuggestions([]);
      setShowEndDropdown(false);
      return;
    }
    const suggestions = getPankiLocationSuggestions(val);
    setEndSuggestions(suggestions);
    setShowEndDropdown(true);
  };

  const handleSelectEndSuggestion = (loc) => {
    const lat = loc.coordinate?.latitude ?? loc.latitude;
    const lng = loc.coordinate?.longitude ?? loc.longitude;
    if (lat !== undefined && lng !== undefined && !isPointInPankiBoundary(lat, lng)) {
      setError('Problem End Point must be inside the Panki study area.');
      return;
    }
    setEndLocation(loc);
    setEndQuery(loc.name || loc.label || 'Selected Location');
    setShowEndDropdown(false);
    setError(null);
  };

  const handleSelectOnMap = (targetField) => {
    setIsMinimizedForMap(true);
    if (onSelectMapTarget) {
      onSelectMapTarget(targetField);
    }
  };

  const handleCloseModal = () => {
    setTitle('');
    setDescription('');
    setStartLocation(null);
    setEndLocation(null);
    setStartQuery('');
    setEndQuery('');
    setError(null);
    setIsMinimizedForMap(false);
    if (onClearReportLocations) {
      onClearReportLocations();
    }
    onClose();
  };

  const getLat = (loc) => loc?.coordinate?.latitude ?? loc?.latitude ?? loc?.lat;
  const getLng = (loc) => loc?.coordinate?.longitude ?? loc?.longitude ?? loc?.lng;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to report a road condition.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a condition title / summary.');
      return;
    }
    if (!startLocation) {
      setError('Please specify where the problem starts.');
      return;
    }
    if (!endLocation) {
      setError('Please specify where the problem ends.');
      return;
    }

    const startLat = getLat(startLocation);
    const startLng = getLng(startLocation);
    const endLat = getLat(endLocation);
    const endLng = getLng(endLocation);

    if (typeof startLat !== 'number' || typeof startLng !== 'number') {
      setError('Problem Start Point has invalid coordinates.');
      return;
    }
    if (typeof endLat !== 'number' || typeof endLng !== 'number') {
      setError('Problem End Point has invalid coordinates.');
      return;
    }

    if (!isPointInPankiBoundary(startLat, startLng)) {
      setError('Problem Start Point must be inside the Panki study area.');
      return;
    }
    if (!isPointInPankiBoundary(endLat, endLng)) {
      setError('Problem End Point must be inside the Panki study area.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const representativeLat = (startLat + endLat) / 2;
      const representativeLng = (startLng + endLng) / 2;

      // Identify affected graph path edges safely
      const affectedPathIds = [];
      const startEdgeRes = findNearestEdgeInPanki(startLat, startLng);
      const endEdgeRes = findNearestEdgeInPanki(endLat, endLng);

      if (startEdgeRes?.edge) {
        affectedPathIds.push(
          startEdgeRes.edge.id,
          `${startEdgeRes.edge.fromNodeId}->${startEdgeRes.edge.toNodeId}`,
          `${startEdgeRes.edge.toNodeId}->${startEdgeRes.edge.fromNodeId}`
        );
      }
      if (endEdgeRes?.edge) {
        affectedPathIds.push(
          endEdgeRes.edge.id,
          `${endEdgeRes.edge.fromNodeId}->${endEdgeRes.edge.toNodeId}`,
          `${endEdgeRes.edge.toNodeId}->${endEdgeRes.edge.fromNodeId}`
        );
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        severity,
        status: 'active',
        location: {
          latitude: representativeLat,
          longitude: representativeLng,
          areaName: 'Panki Study Area',
          nodeId: startLocation.nodeId || endLocation.nodeId || null,
        },
        startLocation: {
          name: startLocation.name || startLocation.label || 'Problem Start',
          latitude: startLat,
          longitude: startLng,
          nodeId: startLocation.nodeId || null,
        },
        endLocation: {
          name: endLocation.name || endLocation.label || 'Problem End',
          latitude: endLat,
          longitude: endLng,
          nodeId: endLocation.nodeId || null,
        },
        affectedPathIds: [...new Set(affectedPathIds)],
        reportedBy: user.uid,
      };

      const createdId = await addCampusCondition(payload);

      setTitle('');
      setDescription('');
      setStartLocation(null);
      setEndLocation(null);
      setStartQuery('');
      setEndQuery('');
      setError(null);

      if (onClearReportLocations) {
        onClearReportLocations();
      }
      if (onConditionReported) {
        onConditionReported(createdId);
      }
      onClose();
    } catch (err) {
      console.error('Error reporting condition:', err);
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    Boolean(user) &&
    Boolean(title.trim()) &&
    Boolean(startLocation) &&
    Boolean(endLocation) &&
    !loading;

  if (isMinimizedForMap) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-bounce">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping"></span>
          <span className="text-xs font-bold tracking-wide">
            Click map to select location point...
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimizedForMap(false)}
          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
        >
          Return to Form
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">Report Road Condition</h3>
              <p className="text-[11px] text-slate-400 font-medium">Specify the affected road segment (Start to End)</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {!user && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Please sign in to submit a road condition report.</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-semibold">
              {error}
            </div>
          )}

          {/* Condition Type & Severity Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Problem Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
              >
                {ALLOWED_CONDITION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
              >
                {ALLOWED_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Problem Start Point */}
          <div className="relative" ref={startRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Problem Start Point *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={startQuery}
                onChange={(e) => handleStartSearchChange(e.target.value)}
                onFocus={() => {
                  if (startQuery.trim()) setShowStartDropdown(true);
                }}
                placeholder="Where does the problem start?"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 text-sm outline-none font-medium"
              />
              <button
                type="button"
                onClick={() => handleSelectOnMap('report-start')}
                className="px-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm"
              >
                <span>📍</span>
                <span>Select on Map</span>
              </button>
            </div>
            {startLocation && (
              <div className="mt-1 text-[11px] font-mono text-emerald-700 font-semibold flex items-center gap-1 pl-1">
                <span>✓ Valid Start Point:</span>
                <span>({getLat(startLocation)?.toFixed(4)}, {getLng(startLocation)?.toFixed(4)})</span>
              </div>
            )}
            {showStartDropdown && startSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[700] max-h-40 overflow-y-auto">
                {startSuggestions.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectStartSuggestion(loc)}
                    className="w-full text-left px-3.5 py-2 hover:bg-amber-50 text-xs font-medium text-slate-800 border-b border-slate-100 last:border-0"
                  >
                    <div className="font-bold">{loc.name || loc.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {loc.coordinate?.latitude?.toFixed(4)}, {loc.coordinate?.longitude?.toFixed(4)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Problem End Point */}
          <div className="relative" ref={endRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Problem End Point *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={endQuery}
                onChange={(e) => handleEndSearchChange(e.target.value)}
                onFocus={() => {
                  if (endQuery.trim()) setShowEndDropdown(true);
                }}
                placeholder="Where does the problem end?"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 text-sm outline-none font-medium"
              />
              <button
                type="button"
                onClick={() => handleSelectOnMap('report-end')}
                className="px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm"
              >
                <span>📍</span>
                <span>Select on Map</span>
              </button>
            </div>
            {endLocation && (
              <div className="mt-1 text-[11px] font-mono text-emerald-700 font-semibold flex items-center gap-1 pl-1">
                <span>✓ Valid End Point:</span>
                <span>({getLat(endLocation)?.toFixed(4)}, {getLng(endLocation)?.toFixed(4)})</span>
              </div>
            )}
            {showEndDropdown && endSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[700] max-h-40 overflow-y-auto">
                {endSuggestions.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectEndSuggestion(loc)}
                    className="w-full text-left px-3.5 py-2 hover:bg-amber-50 text-xs font-medium text-slate-800 border-b border-slate-100 last:border-0"
                  >
                    <div className="font-bold">{loc.name || loc.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {loc.coordinate?.latitude?.toFixed(4)}, {loc.coordinate?.longitude?.toFixed(4)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Title / Summary *
            </label>
            <input
              type="text"
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Waterlogging near Kalpi Road intersection"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 text-sm outline-none font-medium"
              required
            />
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide extra details for travelers (e.g. construction equipment blocking left lane)..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 text-sm outline-none font-medium"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting Report...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
