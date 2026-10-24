import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User as UserIcon, Mail, CheckCircle2, XCircle, ArrowRight, X, Sparkles } from 'lucide-react';
import { JudgeDemoLoginCard } from '../components/JudgeDemoLoginCard';

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

  useEffect(() => {
    setIsRegistering(initialMode === 'register');
  }, [initialMode]);

  // Form states
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'viewer' | 'owner' | 'admin'>('owner');

  // Password complexity checks
  const hasMinLength = password.length >= 10;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (!isPasswordValid) {
          throw new Error('Password does not satisfy security complexity rules');
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
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="w-full max-w-md relative">
      {/* Modal Close Button */}
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors z-20 shadow-lg"
          title="Close Dialog"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header Icon */}
      <div className="text-center mb-6">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 items-center justify-center shadow-xl shadow-emerald-500/20 mb-3">
          <Shield className="w-7 h-7 text-slate-950" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          {isRegistering ? 'Create Secure Vault Account' : 'Authenticate to TrustVault'}
        </h2>
        <p className="text-xs text-slate-400 mt-1 font-sans">
          {isRegistering
            ? 'Enterprise zero-knowledge storage with cryptographic audit logging'
            : 'Access protected documents and immutable audit trails'}
        </p>
      </div>

      {/* Auth Card */}
      <div className="glass-panel-glow bg-slate-900/90 rounded-2xl p-6 sm:p-7 shadow-2xl relative">
        {errorMessage && (
          <div className="mb-5 p-3 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering ? (
            <>
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    id="input-register-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alice_owner"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    id="input-register-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alice@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Role
                </label>
                <select
                  id="select-register-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="owner">Document Owner (Create & Manage Documents)</option>
                  <option value="viewer">Viewer (Collaborate on Shared Documents)</option>
                  <option value="admin">Admin (Audit Ledger & Anomaly Detection)</option>
                </select>
              </div>
            </>
          ) : (
            /* Username or Email */
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Username or Email
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="input-login-username"
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Username or Email"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="input-auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Real-time Password Complexity Tracker for Registration */}
          {isRegistering && (
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1.5 text-[11px]">
              <span className="font-semibold text-slate-400 block mb-1">Security Complexity Checklist:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>10+ Characters</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasUpper ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasUpper ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Uppercase (A-Z)</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasLower ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasLower ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Lowercase (a-z)</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasDigit ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasDigit ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Digit (0-9)</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Special Character</span>
                </div>
              </div>
            </div>
          )}

          <button
            id="btn-submit-auth"
            type="submit"
            disabled={loading || (isRegistering && !isPasswordValid)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <span>{loading ? 'Authenticating...' : isRegistering ? 'Register & Enter Vault' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-slate-800 text-center">
          <button
            id="btn-toggle-auth-mode"
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMessage(null);
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
          >
            {isRegistering
              ? 'Already possess vault credentials? Sign In'
              : 'Need a new secure account? Register now'}
          </button>
        </div>

        {/* Judge & Fast-Track 1-Click Evaluation Credentials */}
        {!isRegistering && (
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="flex items-center space-x-1.5 mb-2.5 text-slate-400 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-bold text-white uppercase text-[10px] tracking-wider">
                Evaluator / Judge 1-Click Fast Track
              </span>
            </div>
            <JudgeDemoLoginCard
              compact={true}
              onSuccess={() => {
                if (isModal && onClose) onClose();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      {content}
    </div>
  );
};
