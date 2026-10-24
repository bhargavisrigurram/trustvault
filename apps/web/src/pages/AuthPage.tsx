import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Lock,
  User as UserIcon,
  Mail,
  ArrowRight,
  X,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  isModal?: boolean;
  onClose?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  isModal = false,
  onClose,
}) => {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(initialMode === 'register');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setIsRegistering(initialMode === 'register');
  }, [initialMode]);

  // Form states
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'viewer' | 'owner' | 'admin'>('owner');

  // Password complexity checks for registration
  const hasMinLength = password.length >= 10;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (!isPasswordValid) {
          throw new Error('Password must be 10+ characters with uppercase, lowercase, number, and symbol.');
        }
        await register({
          username,
          email,
          password,
          role,
        });
      } else {
        await login({
          usernameOrEmail,
          password,
        });
      }
      if (isModal && onClose) {
        onClose();
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check credentials.';
      if (msg.includes('Account created!')) {
        setSuccessMessage(msg);
        setIsRegistering(false);
        setUsernameOrEmail(username);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userKey: 'admin' | 'alice' | 'bob') => {
    setLoading(true);
    setErrorMessage(null);
    const credentials = {
      admin: { usernameOrEmail: 'admin', password: 'AdminPass123!' },
      alice: { usernameOrEmail: 'alice', password: 'AlicePass123!' },
      bob: { usernameOrEmail: 'bob', password: 'BobPass123!' },
    };
    try {
      await login(credentials[userKey]);
      if (isModal && onClose) onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  const cardContent = (
    <div className="w-full max-w-md relative mx-auto">
      {/* Modal Close Button */}
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors z-20 shadow-md"
          title="Close Dialog"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Main Clean Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-800/90 shadow-2xl relative overflow-hidden bg-slate-900/95">
        {/* Subtle top glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Card Header & Tab Switcher */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight leading-tight">TrustVault</h2>
              <p className="text-[10px] text-emerald-400 font-semibold">Zero-Trust Security Core</p>
            </div>
          </div>

          {/* Clean Segmented Tab Switcher */}
          <div className="flex p-0.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                !isRegistering
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(true);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                isRegistering
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs flex items-center space-x-2">
            <UserCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert with Quick Switch to Sign In if already registered */}
        {errorMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            {isRegistering && errorMessage.toLowerCase().includes('already exists') && (
              <button
                type="button"
                onClick={() => {
                  setUsernameOrEmail(username || email);
                  setIsRegistering(false);
                  setErrorMessage(null);
                  setSuccessMessage('Account exists! Enter your password to sign in.');
                }}
                className="ml-2 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-[11px] whitespace-nowrap shadow-sm"
              >
                Sign In Now →
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegistering ? (
            <>
              {/* Register: Username */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Username</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="input-register-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. sarah_security"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Register: Email */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="input-register-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="sarah@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Register: Role */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Account Role</label>
                <select
                  id="select-register-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="owner">Document Owner (Full file ownership & sharing)</option>
                  <option value="viewer">Viewer (Read-only on shared files)</option>
                  <option value="admin">Admin (Audit ledger & automated security scan)</option>
                </select>
              </div>
            </>
          ) : (
            /* Login: Username or Email */
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Username or Email</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="input-login-username"
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="admin, alice, bob, or email"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Password with Show/Hide Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-300">Password</label>
              {isRegistering && (
                <span className={`text-[10px] font-mono ${isPasswordValid ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isPasswordValid ? '✓ Meets criteria' : '10+ chars, A-Z, 0-9, symbol'}
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                id="input-auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="btn-submit-auth"
            type="submit"
            disabled={loading || (isRegistering && !isPasswordValid)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed pt-2.5"
          >
            <span>{loading ? 'Authenticating...' : isRegistering ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* 1-Click Fast-Track Demo Logins (Clean compact pill bar with credentials) */}
        {!isRegistering && (
          <div className="mt-4 pt-3.5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>1-Click Evaluator Quick Login:</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-purple-800/60 hover:border-purple-500 text-purple-300 text-[10px] font-bold flex flex-col items-center justify-center space-y-0.5 transition-all shadow-sm"
              >
                <div className="flex items-center space-x-1">
                  <Shield className="w-3 h-3 text-purple-400" />
                  <span>Admin</span>
                </div>
                <span className="text-[8.5px] text-slate-400 font-mono">Pass: AdminPass123!</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('alice')}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-emerald-800/60 hover:border-emerald-500 text-emerald-300 text-[10px] font-bold flex flex-col items-center justify-center space-y-0.5 transition-all shadow-sm"
              >
                <div className="flex items-center space-x-1">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>Alice</span>
                </div>
                <span className="text-[8.5px] text-slate-400 font-mono">Pass: AlicePass123!</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('bob')}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-teal-800/60 hover:border-teal-500 text-teal-300 text-[10px] font-bold flex flex-col items-center justify-center space-y-0.5 transition-all shadow-sm"
              >
                <div className="flex items-center space-x-1">
                  <Eye className="w-3 h-3 text-teal-400" />
                  <span>Bob</span>
                </div>
                <span className="text-[8.5px] text-slate-400 font-mono">Pass: BobPass123!</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer switch prompt */}
        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMessage(null);
            }}
            className="text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {isRegistering ? (
              <span>Already possess vault credentials? <strong className="text-emerald-400">Sign In</strong></span>
            ) : (
              <span>Need a custom account? <strong className="text-emerald-400">Register</strong></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        {cardContent}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      {cardContent}
    </div>
  );
};
