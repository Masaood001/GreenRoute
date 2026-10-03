export default function ProfileModal({ isOpen, onClose, user }) {
  if (!isOpen || !user) return null;

  const displayName = user.displayName || 'Not Set';
  const email = user.email || 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-greenroute-600 flex items-center justify-center text-white shadow-sm border border-greenroute-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">User Profile</h3>
              <p className="text-xs font-semibold text-greenroute-700 uppercase tracking-wider">Account Details</p>
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

        {/* Body */}
        <div className="p-6 space-y-4 text-sm text-slate-600">
          <div className="flex items-center gap-4 p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-extrabold text-lg flex items-center justify-center shadow-inner uppercase shrink-0">
              {(displayName !== 'Not Set' ? displayName[0] : email[0] || 'U')}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 text-base truncate">{displayName !== 'Not Set' ? displayName : email}</h4>
              <p className="text-xs text-slate-500 font-medium truncate">{email}</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Display Name</span>
              <span className="font-semibold text-slate-800 text-sm">{displayName}</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</span>
              <span className="font-semibold text-slate-800 text-sm truncate block">{email}</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Account Status</span>
                <span className="text-xs font-semibold text-emerald-700">Authenticated via Firebase</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
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
