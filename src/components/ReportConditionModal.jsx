import { useState } from 'react';
import {
  ALLOWED_CONDITION_TYPES,
  ALLOWED_SEVERITIES,
  addCampusCondition,
} from '../services/index.js';

export default function ReportConditionModal({
  isOpen,
  onClose,
  location,
  user,
  onConditionReported,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('blocked_path');
  const [severity, setSeverity] = useState('high');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to report a road condition.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a condition title.');
      return;
    }
    if (!location) {
      setError('Please select a valid map location first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const lat = location.coordinate?.latitude ?? location.latitude ?? location.lat;
      const lng = location.coordinate?.longitude ?? location.longitude ?? location.lng;

      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        severity,
        status: 'active',
        location: {
          latitude: lat,
          longitude: lng,
          areaName: 'Panki Study Area',
          nodeId: location.nodeId || location.id || null,
        },
        affectedPathIds: location.nodeId ? [location.nodeId] : [],
        reportedBy: user.uid,
      };

      const createdId = await addCampusCondition(payload);

      setTitle('');
      setDescription('');
      setError(null);

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

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold">Report Road Condition</h3>
          </div>
          <button
            onClick={onClose}
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

          {/* Location Info */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
            <span className="font-bold text-slate-900 block mb-0.5">Selected Location:</span>
            <div className="font-mono text-slate-600">
              {location?.name || 'Map Point'}
              {location?.coordinate && (
                <span> ({location.coordinate.latitude.toFixed(4)}, {location.coordinate.longitude.toFixed(4)})</span>
              )}
            </div>
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

          {/* Condition Type & Severity Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Condition Type
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
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !user}
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
