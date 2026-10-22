import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Key,
  Users,
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  ChevronDown,
  Zap,
} from 'lucide-react';
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

  const scrollToSimulator = () => {
    const el = document.getElementById('threat-simulator');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToFeatures = () => {
    const el = document.getElementById('enterprise-features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqs = [
    {
      q: 'Why does TrustVault return 404 Not Found instead of 403 Forbidden for unauthorized requests?',
      a: 'This is a core design decision known as Existence Concealment. If an unauthorized user probes a document ID and receives 403 Forbidden, they learn that a sensitive document exists at that ID. By strictly returning 404 Not Found, TrustVault eliminates IDOR probing and resource enumeration entirely.',
    },
    {
      q: 'How does the append-only cryptographic audit chain guarantee that logs have not been tampered with?',
      a: 'Each audit log row computes its SHA-256 hash using the previous row\'s hash plus the canonical JSON payload: current_hash = SHA256(previous_hash + payload), anchored at a Genesis hash. Furthermore, a PostgreSQL database trigger (trg_audit_log_immutable) strictly rejects any UPDATE or DELETE statement at the database kernel level.',
    },
    {
      q: 'How are disguised executable files or malware detected during upload?',
      a: 'TrustVault never relies on file extensions or frontend MIME claims. The backend StorageService inspects the actual binary magic bytes in the file header. Windows PE binaries (MZ), Linux ELF binaries, and ZIP archives are detected and rejected at the gateway boundary.',
    },
    {
      q: 'Can a system administrator view or download private user documents?',
      a: 'No. TrustVault enforces the Principle of Least Privilege. Administrators can inspect system health, verify the cryptographic audit chain, and detect brute-force anomalies, but they have zero implicit permission to read or download user files without an explicit grant.',
    },
    {
      q: 'How does search prevent metadata leakage across different users?',
      a: 'Search queries, total document counts, and category facets are protected at the database SQL query level via getDocumentAuthorizationSqlPredicate(). Unauthorized documents are filtered out before computing aggregates, guaranteeing zero metadata leakage.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* ========================================== */}
      {/* 1. HERO SECTION */}
      {/* ========================================== */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-cyber-grid bg-radial-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center">
            {/* Top Security Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 mb-8 animate-fadeIn">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Zero-Trust Document Core • FIPS 140-3 & SOC-2 Ready
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl leading-[1.1] mb-6">
              The Document Vault Where{' '}
              <span className="text-gradient-accent">Unauthorized Access</span> Is{' '}
              <span className="text-gradient-emerald">Cryptographically Impossible</span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mb-10 leading-relaxed font-normal">
              Enterprise-grade document security with mandatory central authorization,
              append-only SHA-256 audit chaining, isolated binary storage, and zero-leakage search. Built for
              uncompromising privacy and confidential collaboration.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-16">
              {isAuthenticated ? (
                <button
                  id="hero-btn-dashboard"
                  onClick={onNavigateToDashboard}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-base tracking-wide transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Enter My Vault ({username})</span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </button>
              ) : (
                <>
                  <button
                    id="hero-btn-launch"
                    onClick={() => onOpenAuth('register')}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-base tracking-wide transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Launch Secure Vault</span>
                    <ArrowRight className="w-5 h-5 ml-1" />
                  </button>

                  <button
                    id="hero-btn-signin"
                    onClick={() => onOpenAuth('login')}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-base tracking-wide border border-slate-700/80 hover:border-slate-600 transition-all shadow-lg hover:-translate-y-0.5"
                  >
                    <span>Sign In to Vault</span>
                  </button>
                </>
              )}

              <button
                id="hero-btn-simulator"
                onClick={scrollToSimulator}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-4 rounded-2xl bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white font-semibold text-base border border-slate-800 hover:border-slate-700 transition-all"
              >
                <Zap className="w-5 h-5 text-amber-400" />
                <span>Test Attack Simulator</span>
              </button>
            </div>

            {/* Live Trust Metrics Strip */}
            <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl glass-panel text-left">
              <div className="p-3">
                <div className="text-2xl lg:text-3xl font-extrabold text-emerald-400 font-mono">107 / 107</div>
                <div className="text-xs font-semibold text-slate-400 mt-1">Security Tests Passing</div>
                <div className="text-[11px] text-slate-500">Automated Threat Matrix (T01-T28)</div>
              </div>

              <div className="p-3 border-l border-slate-800">
                <div className="text-2xl lg:text-3xl font-extrabold text-white font-mono">0 Bytes</div>
                <div className="text-xs font-semibold text-slate-400 mt-1">Metadata Leakage</div>
                <div className="text-[11px] text-slate-500">SQL-level predicate isolation</div>
              </div>

              <div className="p-3 border-l border-slate-800">
                <div className="text-2xl lg:text-3xl font-extrabold text-teal-400 font-mono">100%</div>
                <div className="text-xs font-semibold text-slate-400 mt-1">Audit Chain Verifiable</div>
                <div className="text-[11px] text-slate-500">SHA-256 hash continuity from Genesis</div>
              </div>

              <div className="p-3 border-l border-slate-800">
                <div className="text-2xl lg:text-3xl font-extrabold text-emerald-400 font-mono">Argon2id</div>
                <div className="text-xs font-semibold text-slate-400 mt-1">Cryptographic Auth</div>
                <div className="text-[11px] text-slate-500">64MB memory-hard key derivation</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 2. LIVE INTERACTIVE THREAT SIMULATOR */}
      {/* ========================================== */}
      <section id="threat-simulator" className="py-20 bg-slate-950 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Test TrustVault’s Defenses in Real-Time
            </h2>
            <p className="text-base text-slate-400 mt-2 max-w-2xl mx-auto">
              Simulate exploit payloads right in your browser. Verify how TrustVault's central authorization engine,
              magic byte inspectors, and database triggers deflect malicious attempts instantly.
            </p>
          </div>

          <InteractiveAttackSimulator />
        </div>
      </section>

      {/* ========================================== */}
      {/* 3. ENTERPRISE PILLARS & SECURITY ARCHITECTURE */}
      {/* ========================================== */}
      <section id="enterprise-features" className="py-20 bg-slate-900/40 relative border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60">
              Zero-Trust Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
              Built on 6 Pillars of Cryptographic Defense
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-3">
              Standard cloud storage relies on loose discretionary ACLs that routinely leak files. TrustVault enforces
              rigorous, mathematically proven defense-in-depth across the entire stack.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Central Authorizer Kernel</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  One mandatory, non-bypassable <code className="text-emerald-400 font-mono">authorize()</code> function evaluates all requests.
                  Deny by default. Returns HTTP 404 for unauthorized reads to hide file existence and defeat IDOR enumeration.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 text-xs font-mono text-emerald-400 flex items-center justify-between">
                <span>Existence Concealment</span>
                <span>Active 🛡️</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-950/80 border border-teal-800/60 flex items-center justify-center text-teal-400 mb-5 shadow-lg shadow-teal-500/10">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Cryptographic Append-Only Audit</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Every mutation, download, and anomaly is chained via SHA-256 from the Genesis hash. Database triggers prevent
                  UPDATE and DELETE even by DBAs. Chain verification pinpoints tampering instantly.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 text-xs font-mono text-teal-400 flex items-center justify-between">
                <span>trg_audit_log_immutable</span>
                <span>Enforced 🔒</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-5 shadow-lg shadow-cyan-500/10">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Private Isolated Binary Vault</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Documents are stored outside the web root with random UUID keys (<code className="text-cyan-400 font-mono">UUID.bin</code>).
                  Deep binary magic byte sniffing rejects executables (PE/ELF) and archive bombs before staging.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 text-xs font-mono text-cyan-400 flex items-center justify-between">
                <span>Zero Static Exposure</span>
                <span>Isolated 📁</span>
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Atomic Single-Use Tokens</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  One-time download links are protected against race conditions using atomic database state transitions.
                  Once redeemed or expired, tokens immediately become invalid (HTTP 410 Gone).
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 text-xs font-mono text-emerald-400 flex items-center justify-between">
                <span>Replay Resistant</span>
                <span>Single-Use ⚡</span>
              </div>
            </div>

            {/* Pillar 5 */}
            <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-950/80 border border-teal-800/60 flex items-center justify-center text-teal-400 mb-5 shadow-lg shadow-teal-500/10">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Zero-Leakage Predicate Search</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Search filtering and facet aggregation happen strictly at the database SQL query level.
                  Inaccessible files never appear in category facet counts or total pagination counts.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 text-xs font-mono text-teal-400 flex items-center justify-between">
                <span>Anti-Metadata Leakage</span>
                <span>Filtered 🔍</span>
              </div>
            </div>

            {/* Pillar 6 */}
            <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 mb-5 shadow-lg shadow-purple-500/10">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Principle of Least Privilege</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Admins can review compliance, verify audit chains, and detect brute-force anomalies, but have
                  zero implicit access to view, download, or edit user documents without explicit grant delegation.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800/80 text-xs font-mono text-purple-400 flex items-center justify-between">
                <span>Admin Content Isolation</span>
                <span>Strict 🚫</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 4. WORKSPACES FOR COMPANY & USERS */}
      {/* ========================================== */}
      <section className="py-20 bg-slate-950 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Engineered for Every Stakeholder
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              Whether you are an individual document owner, an external business partner, or an enterprise compliance officer,
              TrustVault provides specialized, secure workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Persona 1: Document Owner */}
            <div className="glass-panel p-8 rounded-3xl border-emerald-900/40 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  DOCUMENT OWNERS
                </span>
                <h3 className="text-xl font-bold text-white mt-4 mb-3">Total Sovereignty Over Sensitive Files</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Upload confidential IP, contracts, and financial statements with guaranteed integrity checks.
                </p>

                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Optimistic concurrency version history</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Time-bound grant delegation (Read / Edit)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Sub-millisecond instant grant revocation</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Safe soft-delete & trash recovery</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={() => onOpenAuth('register')}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs border border-emerald-800/60 transition-colors"
                >
                  Create Owner Account →
                </button>
              </div>
            </div>

            {/* Persona 2: External Collaborators */}
            <div className="glass-panel p-8 rounded-3xl border-teal-900/40 hover:border-teal-500/50 transition-all flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-teal-950 text-teal-400 border border-teal-800/60">
                  GRANTEES & VIEWERS
                </span>
                <h3 className="text-xl font-bold text-white mt-4 mb-3">Frictionless, Secure Collaboration</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Review and collaborate on shared documents without worrying about malware or leaked access keys.
                </p>

                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Single-use atomic download tokens</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Zero file execution or inline script sniffing</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Shared workspace scope filtering</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Automatic grant expiration enforcement</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={() => onOpenAuth('register')}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-400 font-bold text-xs border border-teal-800/60 transition-colors"
                >
                  Access Shared Workspace →
                </button>
              </div>
            </div>

            {/* Persona 3: Compliance & Security Officers */}
            <div className="glass-panel p-8 rounded-3xl border-purple-900/40 hover:border-purple-500/50 transition-all flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-purple-950 text-purple-400 border border-purple-800/60">
                  AUDIT & COMPLIANCE
                </span>
                <h3 className="text-xl font-bold text-white mt-4 mb-3">Immutable Evidence & Anomaly Detection</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Maintain mathematical proof of compliance for HIPAA, SOC-2, and GDPR audits with zero blindspots.
                </p>

                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>One-click verifyChain() cryptographic test</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Real-time brute force & IDOR anomaly flags</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Database-enforced write-only immutability</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Zero access to document contents (Least Privilege)</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={() => onOpenAuth('register')}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-400 font-bold text-xs border border-purple-800/60 transition-colors"
                >
                  Open Audit Portal →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 5. COMPARISON TABLE */}
      {/* ========================================== */}
      <section className="py-20 bg-slate-900/30 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              TrustVault vs. Conventional Cloud Storage
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Why leading security teams replace legacy storage with a Zero-Trust Document Vault.
            </p>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300">
                    <th className="p-4 font-bold">Security Feature</th>
                    <th className="p-4 font-bold text-emerald-400">TrustVault Zero-Trust</th>
                    <th className="p-4 font-bold text-slate-500">Traditional S3 / GDrive / Dropbox</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="p-4 font-medium">Unauthorized Access Response</td>
                    <td className="p-4 text-emerald-400 font-semibold">404 Not Found (Hides Existence)</td>
                    <td className="p-4 text-slate-500">403 Forbidden (Confirms File Existence)</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Audit Log Immutability</td>
                    <td className="p-4 text-emerald-400 font-semibold">Cryptographic SHA-256 Chaining + DB Triggers</td>
                    <td className="p-4 text-slate-500">Plain text log files (Modifiable by Admins)</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Admin Document Access</td>
                    <td className="p-4 text-emerald-400 font-semibold">Blocked by Default (Least Privilege)</td>
                    <td className="p-4 text-slate-500">Unrestricted superadmin root file access</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">File Type Verification</td>
                    <td className="p-4 text-emerald-400 font-semibold">Binary Magic Byte Header Inspection</td>
                    <td className="p-4 text-slate-500">Filename extension or client MIME header only</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Download Links</td>
                    <td className="p-4 text-emerald-400 font-semibold">Atomic Single-Use Ephemeral Tokens</td>
                    <td className="p-4 text-slate-500">Static presigned URLs (replayable until expiry)</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Search Facet Isolation</td>
                    <td className="p-4 text-emerald-400 font-semibold">Database SQL predicate (0-byte leakage)</td>
                    <td className="p-4 text-slate-500">Aggregates leak document presence/counts</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 6. FREQUENTLY ASKED QUESTIONS */}
      {/* ========================================== */}
      <section className="py-20 bg-slate-950 border-t border-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Frequently Asked Security Questions
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Detailed technical rationales behind our zero-trust implementation decisions.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-5 text-left flex items-center justify-between space-x-4 hover:bg-slate-900/40 transition-colors"
                  >
                    <span className="font-semibold text-sm sm:text-base text-slate-200">{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-emerald-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-sm text-slate-400 border-t border-slate-800/60 leading-relaxed font-sans bg-slate-950/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 7. BOTTOM CTA BANNER */}
      {/* ========================================== */}
      <section className="py-20 bg-gradient-to-b from-slate-950 to-slate-900 border-t border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-cyber-grid opacity-30 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 items-center justify-center shadow-xl shadow-emerald-500/20 mb-6">
            <ShieldCheck className="w-8 h-8 text-slate-950" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to Protect Your Most Critical Documents?
          </h2>
          <p className="text-base text-slate-300 max-w-2xl mx-auto mb-8">
            Experience the peace of mind of a document sharing platform designed from first principles
            to make unauthorized access mathematically impossible.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => (isAuthenticated ? onNavigateToDashboard?.() : onOpenAuth('register'))}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-base tracking-wide transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40"
            >
              {isAuthenticated ? 'Open My Vault Dashboard →' : 'Create Free Vault Account →'}
            </button>

            <button
              onClick={scrollToSimulator}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base border border-slate-700 transition-colors"
            >
              Test Attack Simulator
            </button>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* 8. FOOTER */}
      {/* ========================================== */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-slate-950 font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-300">TrustVault Security Platform</p>
              <p className="text-[11px] text-slate-500">Cryptographically verifiable zero-trust repository</p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-slate-400">
            <span className="hover:text-emerald-400 cursor-pointer" onClick={scrollToSimulator}>
              Threat Simulator
            </span>
            <span className="hover:text-emerald-400 cursor-pointer" onClick={scrollToFeatures}>
              Architecture
            </span>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 flex items-center space-x-1"
            >
              <span>API Health</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-center md:text-right text-[11px] text-slate-600">
            <p>107 Automated Security Tests Passed • 100% Mutation Kill Rate</p>
            <p className="mt-0.5">Dual-Mode PostgreSQL & PGlite WASM</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
