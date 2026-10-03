import { useState } from 'react';
import { signInUser, signUpUser, sendPasswordResetEmail } from '../services/index.js';

export default function AuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp' | 'forgotPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setLoading(false);
    setMode('signIn');
    onClose();
  };

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password;
    const trimmedName = displayName.trim();

    if (mode === 'forgotPassword') {
      if (!trimmedEmail) {
        setError('Please enter your email address.');
        return;
      }
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        await sendPasswordResetEmail(trimmedEmail);
        setSuccess('Password reset link sent! Check your email inbox.');
        setEmail('');
      } catch (err) {
        console.error('Password reset error:', err);
        const code = err.code || '';
        let message = 'Failed to send password reset email. Please try again.';
        if (code === 'auth/user-not-found') {
          message = 'No registered account was found with this email address.';
        } else if (code === 'auth/invalid-email') {
          message = 'Please enter a valid email address.';
        } else if (code === 'auth/too-many-requests') {
          message = 'Too many requests. Please try again later.';
        } else if (err.message && typeof err.message === 'string' && !err.message.includes('Firebase')) {
          message = err.message;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }

    if (mode === 'signUp' && trimmedPassword.length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'signIn') {
        await signInUser(trimmedEmail, trimmedPassword);
      } else {
        await signUpUser(trimmedEmail, trimmedPassword, trimmedName);
      }
      handleClose();
    } catch (err) {
      console.error('Authentication error:', err);
      const code = err.code || '';
      let message = 'An authentication error occurred. Please try again.';

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        message = 'Invalid email or password. Please check your credentials.';
      } else if (code === 'auth/email-already-in-use') {
        message = 'This email address is already registered. Please sign in instead.';
      } else if (code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters long.';
      } else if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Access temporarily disabled due to multiple failed login attempts. Please try again later.';
      } else if (err.message && typeof err.message === 'string' && !err.message.includes('Firebase')) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-greenroute-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              GR
            </div>
            <h3 className="font-extrabold text-slate-800 text-lg">
              {mode === 'signIn'
                ? 'Sign In to GreenRoute'
                : mode === 'signUp'
                ? 'Create Account'
                : 'Reset Password'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-start gap-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {mode === 'forgotPassword' && (
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Enter your email address below and we'll send you a password reset link to regain access to your account.
            </p>
          )}

          {mode === 'signUp' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Display Name (Optional)</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                placeholder="Alex Johnson"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-greenroute-500 focus:border-greenroute-500 outline-none transition-all disabled:opacity-60"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-greenroute-500 focus:border-greenroute-500 outline-none transition-all disabled:opacity-60"
            />
          </div>

          {mode !== 'forgotPassword' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                {mode === 'signIn' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgotPassword')}
                    className="text-xs font-bold text-greenroute-700 hover:text-greenroute-800 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-greenroute-500 focus:border-greenroute-500 outline-none transition-all disabled:opacity-60"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>
                  {mode === 'signIn'
                    ? 'Signing In...'
                    : mode === 'signUp'
                    ? 'Creating Account...'
                    : 'Sending Reset Link...'}
                </span>
              </>
            ) : (
              <span>
                {mode === 'signIn'
                  ? 'Sign In'
                  : mode === 'signUp'
                  ? 'Create Account'
                  : 'Send Reset Link'}
              </span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-center text-xs font-medium text-slate-600">
          {mode === 'signIn' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signUp')}
                className="font-bold text-greenroute-700 hover:text-greenroute-800 underline ml-1"
              >
                Create Account
              </button>
            </p>
          ) : mode === 'signUp' ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signIn')}
                className="font-bold text-greenroute-700 hover:text-greenroute-800 underline ml-1"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signIn')}
                className="font-bold text-greenroute-700 hover:text-greenroute-800 underline ml-1"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
