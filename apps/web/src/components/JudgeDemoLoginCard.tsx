import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, UserCheck, Eye, Key, ArrowRight, Check, Sparkles } from 'lucide-react';

interface JudgeDemoLoginCardProps {
  onSuccess?: () => void;
  compact?: boolean;
}

export const JudgeDemoLoginCard: React.FC<JudgeDemoLoginCardProps> = ({ onSuccess, compact = false }) => {
  const { login } = useAuth();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts = [
    {
      role: 'admin',
      title: 'Administrator',
      username: 'admin',
      email: 'admin@trustvault.local',
      password: 'AdminPass123!',
      badge: 'SYSTEM AUDITOR',
      badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
      glowBorder: 'hover:border-purple-500/60',
      icon: Shield,
      description: 'System-wide compliance, cryptographic audit chain verification, brute-force & IDOR anomaly detection, 1-click global scans.',
      testHighlight: 'Least privilege: Admin CANNOT view or download private user files without grant.',
    },
    {
      role: 'owner',
      title: 'Document Owner (Alice)',
      username: 'alice',
      email: 'alice@trustvault.local',
      password: 'AlicePass123!',
      badge: 'CISO / OWNER',
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
      glowBorder: 'hover:border-emerald-500/60',
      icon: UserCheck,
      description: 'Upload confidential documents, run AI Summaries & Security DLP Scans, issue single-use download tokens, manage sharing grants.',
      testHighlight: 'Owns "Enterprise Security Charter 2026.pdf" with pre-configured DLP checks.',
    },
    {
      role: 'viewer',
      title: 'Authorized Viewer (Bob)',
      username: 'bob',
      email: 'bob@trustvault.local',
      password: 'BobPass123!',
      badge: 'COLLABORATOR',
      badgeColor: 'bg-teal-950/80 text-teal-300 border-teal-800/80',
      glowBorder: 'hover:border-teal-500/60',
      icon: Eye,
      description: 'Read-only access to Alice\'s shared document. Probing any unshared document ID yields strict HTTP 404 (Existence Concealment).',
      testHighlight: 'Verifies read grant and zero metadata leakage on unshared documents.',
    },
  ];

  const handleQuickLogin = async (acc: typeof demoAccounts[0]) => {
    setLoadingRole(acc.role);
    setError(null);
    try {
      await login({
        usernameOrEmail: acc.username,
        password: acc.password,
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Auto-login failed. Please try registering or logging in manually.');
    } finally {
      setLoadingRole(null);
    }
  };

  const copyCreds = (acc: typeof demoAccounts[0], e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${acc.email} / ${acc.password}`);
    setCopiedRole(acc.role);
    setTimeout(() => setCopiedRole(null), 2000);
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'md:grid-cols-3 gap-5'}`}>
        {demoAccounts.map((acc) => {
          const Icon = acc.icon;
          const isLoading = loadingRole === acc.role;

          return (
            <div
              key={acc.role}
              className={`relative rounded-2xl glass-panel p-5 border border-slate-800 transition-all duration-300 flex flex-col justify-between group ${acc.glowBorder} hover:shadow-xl hover:-translate-y-1`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">{acc.title}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">{acc.email}</span>
                    </div>
                  </div>

                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${acc.badgeColor}`}>
                    {acc.badge}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {acc.description}
                </p>

                {/* Highlight test scenario */}
                <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4 text-[11px] text-slate-400">
                  <span className="font-semibold text-emerald-400">Evaluator Highlight: </span>
                  {acc.testHighlight}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <button
                  id={`btn-judge-login-${acc.role}`}
                  onClick={() => handleQuickLogin(acc)}
                  disabled={Boolean(loadingRole)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-500/20"
                >
                  {isLoading ? (
                    <span>Logging in...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Instant 1-Click Login as {acc.role.toUpperCase()}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between px-1 text-[10px] text-slate-500">
                  <span>Pass: <code className="text-slate-400 font-mono">{acc.password}</code></span>
                  <button
                    onClick={(e) => copyCreds(acc, e)}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1"
                  >
                    {copiedRole === acc.role ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3 h-3" />
                        <span>Copy Creds</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
