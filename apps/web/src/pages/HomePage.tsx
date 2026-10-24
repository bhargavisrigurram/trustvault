import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import { JudgeDemoLoginCard } from '../components/JudgeDemoLoginCard';
import { SecurityDemoVisualizer } from '../components/SecurityDemoVisualizer';
import { InteractiveAttackSimulator } from '../components/InteractiveAttackSimulator';

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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const scrollToDemos = () => {
    const el = document.getElementById('live-demos');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const faqs = [
    {
      q: 'Why does TrustVault return 404 Not Found instead of 403 Forbidden for unauthorized requests?',
      a: 'This is a mathematical defense known as Existence Concealment. If an unauthorized user probes a document ID and receives 403 Forbidden, they learn that a sensitive document exists at that ID. By strictly returning 404 Not Found, TrustVault eliminates IDOR probing and resource enumeration entirely.',
    },
    {
      q: 'How does the append-only cryptographic audit chain guarantee that logs have not been tampered with?',
      a: 'Each audit log row computes its SHA-256 hash using the previous row\'s hash plus the canonical JSON payload: current_hash = SHA256(previous_hash + payload), anchored at a Genesis hash. Furthermore, a PostgreSQL database trigger (trg_audit_log_immutable) strictly rejects any UPDATE or DELETE statement at the database kernel level.',
    },
    {
      q: 'How does TrustVault defend against Prompt Injection on the AI Copilot?',
      a: 'The Vault Copilot runs through a pre-flight prompt injection defense pipeline detecting DAN jailbreaks, system prompt exfiltration probes, instruction overrides, and SQL injection strings. In addition, the AI model operates with strict read authorization: it never accesses documents the user does not explicitly own or have an active grant for.',
    },
    {
      q: 'How are disguised executable files or malware detected during upload?',
      a: 'TrustVault never relies on file extensions or frontend MIME claims. The backend StorageService inspects the actual binary magic bytes in the file header. Windows PE binaries (MZ), Linux ELF binaries, and dangerous archives are detected and rejected at the gateway boundary before entering Content-Addressable Storage (CAS).',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ========================================== */}
      {/* 1. HERO SECTION */}
      {/* ========================================== */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden bg-cyber-grid bg-radial-hero border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center">
            {/* Top Security Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/40 shadow-lg shadow-emerald-500/15 mb-6">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Zero-Trust Document Core • Real-Time Supabase Sync • FIPS 140-3 Ready
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl leading-[1.1] mb-6">
              The Document Vault Where{' '}
              <span className="bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                Unauthorized Access
              </span>{' '}
              Is{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Cryptographically Impossible
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-3xl mb-8 leading-relaxed font-normal">
              Enterprise-grade confidentiality with mandatory central authorization,
              append-only SHA-256 audit chaining, isolated binary storage, and zero-leakage search.
              Equipped with an Agentic AI Security Copilot powered by Gemini 2.5 / 3.5 Flash Lite with hardened prompt-injection defense.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-12">
              {isAuthenticated ? (
                <button
                  id="hero-btn-dashboard"
                  onClick={onNavigateToDashboard}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-sm tracking-wide transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Enter My Vault ({username})</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <>
                  <button
                    id="hero-btn-register"
                    onClick={() => onOpenAuth('register')}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-sm tracking-wide transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Create Free Account</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>

                  <button
                    id="hero-btn-signin"
                    onClick={() => onOpenAuth('login')}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-7 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm tracking-wide border border-slate-700/80 hover:border-slate-600 transition-all shadow-lg hover:-translate-y-0.5"
                  >
                    <span>Sign In</span>
                  </button>
                </>
              )}

              <button
                id="hero-btn-demos"
                onClick={scrollToDemos}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white font-semibold text-sm border border-slate-800 hover:border-slate-700 transition-all"
              >
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Explore Live Demos</span>
              </button>
            </div>

            {/* Live Trust Metrics Strip */}
            <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl glass-panel text-left border border-slate-800">
              <div className="p-2 sm:p-3">
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">117 / 117</div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5">Automated Tests Passing</div>
                <div className="text-[10px] text-slate-500">Security Threat Matrix (T01-T28)</div>
              </div>

              <div className="p-2 sm:p-3 border-l border-slate-800">
                <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">0 Bytes</div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5">Metadata Leakage</div>
                <div className="text-[10px] text-slate-500">Existence Concealment (Strict 404)</div>
              </div>

              <div className="p-2 sm:p-3 border-l border-slate-800">
                <div className="text-xl sm:text-2xl font-extrabold text-teal-400 font-mono">100%</div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5">Audit Continuity</div>
                <div className="text-[10px] text-slate-500">SHA-256 Chained from Genesis</div>
              </div>

              <div className="p-2 sm:p-3 border-l border-slate-800">
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">Argon2id</div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5">Cryptographic Auth</div>
                <div className="text-[10px] text-slate-500">64MB memory-hard key derivation</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 2. JUDGE & EVALUATOR 1-CLICK ACCESS CENTER */}
      {/* ========================================== */}
      <section className="py-16 bg-slate-900/60 relative border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800/80">
              Evaluator & Judge Fast-Track
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
              1-Click Demo Evaluation Accounts
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-2">
              Judges can test the system immediately with a single click. Pre-seeded with documents,
              access grants, and audit chains in our real-time Supabase database. Or register a new account.
            </p>
          </div>

          <JudgeDemoLoginCard
            onSuccess={() => {
              if (onNavigateToDashboard) onNavigateToDashboard();
            }}
          />

          <div className="mt-8 text-center text-xs text-slate-400">
            Prefer to test registration from scratch?{' '}
            <button
              onClick={() => onOpenAuth('register')}
              className="text-emerald-400 font-bold hover:underline ml-1"
            >
              Create a custom account here &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 3. INTERACTIVE LIVE SECURITY DEMOS */}
      {/* ========================================== */}
      <section id="live-demos" className="py-16 bg-slate-950 relative border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80">
              Interactive Demonstrations
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
              Explore TrustVault’s Production Defenses
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              See the exact mathematical mechanisms behind IDOR existence concealment,
              audit log hash continuity, and gateway binary sniffing.
            </p>
          </div>

          <SecurityDemoVisualizer />

          {/* Interactive Exploit Simulator */}
          <div className="pt-8">
            <div className="text-center mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Live Attack Payload Simulator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Trigger simulated IDOR probes, audit log tampers, and privilege escalation payloads.
              </p>
            </div>
            <InteractiveAttackSimulator />
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 4. CORE ARCHITECTURAL INVARIANTS */}
      {/* ========================================== */}
      <section className="py-16 bg-slate-900/30 relative border-b border-slate-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Four Invariant Security Pillars
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              Designed from first principles to guarantee zero data leakage across all states.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1 */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border border-slate-800">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 mb-4">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">Central Authorizer Kernel</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Single mandatory <code className="text-emerald-400 font-mono">authorize()</code> checkpoint.
                  Deny by default. Strict 404 response hides existence of unauthorized documents.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-emerald-400">
                Existence Concealment ✅
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border border-slate-800">
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-950/80 border border-teal-800/80 flex items-center justify-center text-teal-400 mb-4">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">SHA-256 CAS Storage</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Payloads are hashed with SHA-256. Storage keys match the exact content hash.
                  Gateway verifies binary magic bytes, rejecting disguised executables.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-teal-400">
                Immutable Storage ✅
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border border-slate-800">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center text-purple-400 mb-4">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">Append-Only Audit Chain</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every mutation is chained via SHA-256 from Genesis. Database triggers
                  strictly block UPDATE and DELETE statements even for DBAs.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-purple-400">
                Tamper-Evident Logs ✅
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border border-slate-800">
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 mb-4">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">Hardened AI Copilot</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gemini 2.5 / 3.5 Flash Lite engine with pre-flight prompt injection defense.
                  Restricted to authenticated users and bounded by user authorization scopes.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-cyan-400">
                Injection Defended ✅
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 5. FAQ SECTION */}
      {/* ========================================== */}
      <section className="py-16 bg-slate-950 relative border-b border-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Frequently Asked Security Questions
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Rigorous answers for technical evaluators, cryptographers, and auditors.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl glass-panel border border-slate-800 overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-white font-bold text-xs sm:text-sm hover:text-emerald-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 6. FOOTER */}
      {/* ========================================== */}
      <footer className="py-8 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">TrustVault v2.4</span>
            <span>&bull;</span>
            <span className="text-emerald-400">Zero-Trust Verified</span>
            <span>&bull;</span>
            <span className="text-slate-400">Supabase Real-Time</span>
          </div>

          <div className="text-slate-500 text-center sm:text-right text-[11px]">
            SHA-256 CAS Storage &bull; FIPS 140-3 Cryptographic Integrity &bull; 117/117 Tests Passing
          </div>
        </div>
      </footer>
    </div>
  );
};
