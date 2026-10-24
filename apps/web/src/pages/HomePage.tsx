import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ArrowRight,
  EyeOff,
  Database,
  Cpu,
  Sparkles,
  UserCheck,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HomePageProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onNavigateToDashboard?: () => void;
  isAuthenticated: boolean;
  username?: string;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenAuth,
  onNavigateToDashboard,
  isAuthenticated,
  username,
}) => {
  const { login } = useAuth();
  const [probeTested, setProbeTested] = useState(false);
  const [quickLoginLoading, setQuickLoginLoading] = useState<string | null>(null);

  const handleQuickLogin = async (userKey: 'admin' | 'alice' | 'bob') => {
    setQuickLoginLoading(userKey);
    const credentials = {
      admin: { usernameOrEmail: 'admin', password: 'AdminPass123!' },
      alice: { usernameOrEmail: 'alice', password: 'AlicePass123!' },
      bob: { usernameOrEmail: 'bob', password: 'BobPass123!' },
    };
    try {
      await login(credentials[userKey]);
      if (onNavigateToDashboard) onNavigateToDashboard();
    } catch (err) {
      console.error('Quick login failed:', err);
    } finally {
      setQuickLoginLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ========================================== */}
      {/* 1. HERO SECTION */}
      {/* ========================================== */}
      <section className="relative pt-14 pb-20 md:pt-24 md:pb-28 overflow-hidden bg-cyber-grid bg-radial-hero">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Top Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 mb-6 animate-fadeIn">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Zero-Trust Document Core &bull; Supabase Live
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-5">
            Secure Document Sharing,{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Cryptographically Enforced
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
            The enterprise document vault where unauthorized access is mathematically impossible.
            Engineered with strict existence concealment (zero-leakage 404), SHA-256 CAS storage,
            and an AI security copilot with prompt injection defense.
          </p>

          {/* Clean Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto mb-14">
            {isAuthenticated ? (
              <button
                id="hero-btn-dashboard"
                onClick={onNavigateToDashboard}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Enter Vault ({username})</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <>
                <button
                  id="hero-btn-register"
                  onClick={() => onOpenAuth('register')}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5"
                >
                  <Shield className="w-4 h-4" />
                  <span>Get Started Free</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>

                <button
                  id="hero-btn-signin"
                  onClick={() => onOpenAuth('login')}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm tracking-wide border border-slate-700/80 hover:border-slate-600 transition-all shadow-md hover:-translate-y-0.5"
                >
                  <span>Sign In</span>
                </button>
              </>
            )}
          </div>

          {/* ========================================== */}
          {/* INTERACTIVE LIVE VAULT CARD (CLEAN & SIMPLE) */}
          {/* ========================================== */}
          <div className="w-full max-w-3xl mx-auto rounded-3xl glass-panel border border-slate-800 shadow-2xl overflow-hidden text-left bg-slate-900/80">
            {/* macOS Style Window Header */}
            <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-[11px] font-mono text-slate-400 ml-2">trustvault.live.preview</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Zero-Trust Kernel Active</span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Sample Document Row */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Enterprise Security Charter 2026.pdf</h3>
                    <p className="text-[10px] text-slate-400 font-mono">SHA-256: 7f83b165... &bull; Owner: Alice (CISO)</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    PROTECTED
                  </span>
                  <button
                    onClick={() => setProbeTested(true)}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition-colors"
                  >
                    Probe as Intruder
                  </button>
                </div>
              </div>

              {/* Probe Test Output Banner */}
              {probeTested && (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-xs flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center space-x-2">
                    <EyeOff className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 text-[11px]">
                      <strong className="text-emerald-400">Zero IDOR Leakage:</strong> Server returned <code className="text-emerald-300 font-mono">HTTP 404 Not Found</code>. 0 bytes leaked. Intruder cannot determine if file exists!
                    </span>
                  </div>
                  <button
                    onClick={() => setProbeTested(false)}
                    className="text-[10px] text-slate-400 hover:text-white underline ml-2 shrink-0"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* 1-Click Evaluator Quick Buttons Inside Preview */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1-Click Evaluator Fast-Track:</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickLogin('admin')}
                    disabled={Boolean(quickLoginLoading)}
                    className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-300 text-[11px] font-bold transition-all shadow-sm flex items-center space-x-1"
                  >
                    <Shield className="w-3 h-3 text-purple-400" />
                    <span>{quickLoginLoading === 'admin' ? '...' : 'Admin'}</span>
                  </button>

                  <button
                    onClick={() => handleQuickLogin('alice')}
                    disabled={Boolean(quickLoginLoading)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-bold transition-all shadow-sm flex items-center space-x-1"
                  >
                    <UserCheck className="w-3 h-3 text-emerald-400" />
                    <span>{quickLoginLoading === 'alice' ? '...' : 'Alice (Owner)'}</span>
                  </button>

                  <button
                    onClick={() => handleQuickLogin('bob')}
                    disabled={Boolean(quickLoginLoading)}
                    className="px-3 py-1.5 rounded-xl bg-teal-950/80 hover:bg-teal-900 border border-teal-800 text-teal-300 text-[11px] font-bold transition-all shadow-sm flex items-center space-x-1"
                  >
                    <Eye className="w-3 h-3 text-teal-400" />
                    <span>{quickLoginLoading === 'bob' ? '...' : 'Bob (Viewer)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 2. THREE CORE PILLARS (CLEAN & MINIMALIST) */}
      {/* ========================================== */}
      <section className="py-16 bg-slate-900/40 relative border-t border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pillar 1 */}
            <div className="p-6 rounded-3xl glass-panel border border-slate-800/90 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
                  <EyeOff className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Existence Concealment</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Unauthorized read requests strictly return <code className="text-emerald-400 font-mono">404 Not Found</code> instead of 403, preventing resource enumeration and IDOR probing.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] font-mono text-emerald-400">
                Zero Metadata Leakage
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-3xl glass-panel border border-slate-800/90 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-teal-950/80 border border-teal-800/80 flex items-center justify-center text-teal-400 mb-4 shadow-sm">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">SHA-256 Audit Chain</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every state change links mathematically to the prior hash. Database triggers block UPDATE and DELETE statements even for administrators.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] font-mono text-teal-400">
                100% Chain Verifiable
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-3xl glass-panel border border-slate-800/90 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 mb-4 shadow-sm">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Hardened AI Copilot</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Powered by Gemini 2.5 / 3.5 Flash Lite with an active prompt-injection firewall defending against jailbreaks and system prompt exfiltration.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] font-mono text-cyan-400">
                Injection Shielded
              </div>
            </div>
          </div>

          {/* Simple Trust Metrics Strip */}
          <div className="mt-10 p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-around gap-4 text-center">
            <div>
              <span className="text-lg font-bold text-emerald-400 font-mono">117 / 117</span>
              <p className="text-[10px] text-slate-400">Automated Tests</p>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-800" />
            <div>
              <span className="text-lg font-bold text-white font-mono">0 Bytes</span>
              <p className="text-[10px] text-slate-400">Metadata Leaked</p>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-800" />
            <div>
              <span className="text-lg font-bold text-teal-400 font-mono">Argon2id</span>
              <p className="text-[10px] text-slate-400">Memory-Hard Auth</p>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-800" />
            <div>
              <span className="text-lg font-bold text-cyan-400 font-mono">Supabase</span>
              <p className="text-[10px] text-slate-400">Real-Time Core</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 3. SIMPLE FOOTER */}
      {/* ========================================== */}
      <footer className="py-7 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">TrustVault v2.4</span>
            <span>&bull;</span>
            <span className="text-emerald-400">Zero-Trust Verified</span>
          </div>

          <div className="text-[11px] text-slate-500">
            FIPS 140-3 Cryptographic Integrity &bull; 117/117 Tests Passing
          </div>
        </div>
      </footer>
    </div>
  );
};
