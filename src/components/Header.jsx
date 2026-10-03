import { useState, useRef, useEffect } from 'react';

export default function Header({
  user,
  onOpenAuth,
  onOpenAbout,
  onSignOut,
  onChangePassword,
  onOpenProfile,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.displayName || user?.email || 'User';

  const handleSignOutClick = () => {
    setIsMenuOpen(false);
    onSignOut();
  };

  const handleProfileClick = () => {
    setIsMenuOpen(false);
    onOpenProfile();
  };

  const handleChangePasswordClick = () => {
    setIsMenuOpen(false);
    onChangePassword();
  };

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
      <div className="flex items-center gap-3 sm:gap-5">
        <button
          onClick={onOpenAbout}
          className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          About
        </button>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 text-xs sm:text-sm font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors shadow-sm focus:outline-none"
              title={user.email}
            >
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center uppercase shrink-0">
                {displayName[0]}
              </div>
              <span className="truncate max-w-[100px] sm:max-w-[160px]">{displayName}</span>
              <svg className={`w-4 h-4 transition-transform duration-200 text-emerald-700 ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {user.displayName || 'Account User'}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                    {user.email}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    onClick={handleProfileClick}
                    className="w-full text-left px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>
                  <button
                    onClick={handleChangePasswordClick}
                    className="w-full text-left px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Change Password
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={handleSignOutClick}
                    className="w-full text-left px-4 py-2 text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="text-xs sm:text-sm font-semibold bg-slate-900 text-white px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-sm ring-1 ring-slate-900/10"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
