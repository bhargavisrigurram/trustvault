import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Binary,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  EyeOff,
} from 'lucide-react';

export const SecurityDemoVisualizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'concealment' | 'hashchain' | 'magicbytes'>('concealment');

  // Existence Concealment Demo State
  const [docIdInput, setDocIdInput] = useState('doc_top_secret_board_minutes_2026');
  const [testedConcealment, setTestedConcealment] = useState(false);

  // Hash Chain Demo State
  const [tamperInjected, setTamperInjected] = useState(false);

  // Magic Byte Demo State
  const [selectedFileType, setSelectedFileType] = useState<'legit_pdf' | 'disguised_exe' | 'zip_slip'>('disguised_exe');

  return (
    <div className="w-full glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Visualizer Header Tabs */}
      <div className="border-b border-slate-800 bg-slate-950/70 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Interactive Live Security Visualizer
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80">
              PRODUCTION DEFENSES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Experience how TrustVault mathematically neutralizes attack vectors in real-time.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('concealment')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'concealment'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Existence Concealment
          </button>
          <button
            onClick={() => setActiveTab('hashchain')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'hashchain'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. SHA-256 Audit Chain
          </button>
          <button
            onClick={() => setActiveTab('magicbytes')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'magicbytes'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Magic Byte Sniffer
          </button>
        </div>
      </div>

      {/* Tab 1: Existence Concealment */}
      {activeTab === 'concealment' && (
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 space-y-4">
              <div className="flex items-center space-x-2 text-emerald-400">
                <EyeOff className="w-5 h-5" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Zero IDOR & Enumeration Defense</h4>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Most cloud platforms return <code className="text-rose-400 font-mono">403 Forbidden</code> when probing an unauthorized ID, confirming to an attacker that the secret document exists. TrustVault strictly returns <code className="text-emerald-400 font-mono">404 Not Found</code> with an identical response length and latency, eliminating metadata leakage.
              </p>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Simulate Probing Unauthorized Target ID:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={docIdInput}
                    onChange={(e) => setDocIdInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => setTestedConcealment(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-500/20"
                  >
                    <span>Send Probe</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vulnerable App */}
              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-rose-400 uppercase">Legacy / Vulnerable App</span>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="font-mono text-xs text-rose-300 bg-rose-950/60 p-2.5 rounded-lg border border-rose-900/60 mb-2">
                    HTTP/1.1 403 Forbidden<br />
                    {testedConcealment ? `{"error": "Access denied to ${docIdInput}. You lack OWNER grant."}` : 'Awaiting request...'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    ❌ <strong>Leaked Info:</strong> Confirms resource exists. Attacker knows document exists and starts targeted phishing.
                  </p>
                </div>
              </div>

              {/* TrustVault Zero-Trust */}
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase">TrustVault Defense</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="font-mono text-xs text-emerald-300 bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-900/60 mb-2">
                    HTTP/1.1 404 Not Found<br />
                    {testedConcealment ? '{"error": "Document not found"}' : 'Awaiting request...'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    ✅ <strong>Existence Concealed:</strong> Attacker learns zero information. Cannot distinguish between a non-existent document and a secret one.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: SHA-256 Audit Chain */}
      {activeTab === 'hashchain' && (
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Cryptographic Proof of Log Immutability</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Every operation links to the prior entry via SHA-256 hash continuity. Database triggers block UPDATE/DELETE.
              </p>
            </div>
            <button
              onClick={() => setTamperInjected(!tamperInjected)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                tamperInjected
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{tamperInjected ? 'Revert DB Tamper' : 'Inject Simulated DB Tamper'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Block 1 */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                <span>Block #1 (Genesis)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[11px] font-mono text-slate-400">Action: SYSTEM_BOOTSTRAP</p>
              <div className="text-[10px] font-mono p-2 rounded bg-slate-950 text-slate-500 truncate">
                PrevHash: 00000000000000000000000000000000
              </div>
              <div className="text-[10px] font-mono p-2 rounded bg-slate-950 text-emerald-400 truncate">
                Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
              </div>
            </div>

            {/* Block 2 */}
            <div className={`p-4 rounded-2xl transition-all space-y-2 ${
              tamperInjected
                ? 'bg-rose-950/30 border border-rose-500 shadow-lg shadow-rose-500/20'
                : 'bg-slate-900 border border-slate-800'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className={tamperInjected ? 'text-rose-400 font-extrabold' : 'text-emerald-400'}>
                  Block #2 {tamperInjected ? '(TAMPERED!)' : ''}
                </span>
                {tamperInjected ? (
                  <AlertTriangle className="w-4 h-4 text-rose-500 animate-bounce" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Action: {tamperInjected ? 'PRIVILEGE_ESCALATE (MODIFIED)' : 'DOCUMENT_CREATE'}
              </p>
              <div className="text-[10px] font-mono p-2 rounded bg-slate-950 text-slate-500 truncate">
                PrevHash: e3b0c44298fc1c149afbf4c8996fb924...
              </div>
              <div className={`text-[10px] font-mono p-2 rounded bg-slate-950 truncate ${
                tamperInjected ? 'text-rose-400 font-bold' : 'text-emerald-400'
              }`}>
                Hash: {tamperInjected ? '9fa2189d0b8d234... [MISMATCH]' : 'b5d4045c3f466fa91fe2cc6abe79232a...'}
              </div>
            </div>

            {/* Block 3 */}
            <div className={`p-4 rounded-2xl transition-all space-y-2 ${
              tamperInjected
                ? 'bg-rose-950/20 border border-rose-900/60 opacity-80'
                : 'bg-slate-900 border border-slate-800'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className={tamperInjected ? 'text-rose-400' : 'text-emerald-400'}>
                  Block #3 {tamperInjected ? '(CHAIN BROKEN)' : ''}
                </span>
                {tamperInjected ? (
                  <span className="text-[10px] bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded border border-rose-800">BROKEN</span>
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-400">Action: SHARE_GRANT</p>
              <div className="text-[10px] font-mono p-2 rounded bg-slate-950 text-slate-500 truncate">
                Expected PrevHash: b5d4045c3f466fa91fe2cc6abe79232a...
              </div>
              <div className="text-[10px] font-mono p-2 rounded bg-slate-950 text-slate-400 truncate">
                Status: {tamperInjected ? 'Audit Verification Failed at Block 2' : 'Chain Valid (100% Continuity)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Magic Byte Sniffer */}
      {activeTab === 'magicbytes' && (
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Binary className="w-4 h-4 text-emerald-400" />
              <span>Gateway Binary Magic Byte Verification</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Attackers disguise malware by renaming <code className="text-rose-400 font-mono">ransomware.exe</code> to <code className="text-emerald-400 font-mono">invoice.pdf</code>. TrustVault ignores filename extensions and inspects the raw file header bytes before admitting any content to Content-Addressable Storage (CAS).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setSelectedFileType('legit_pdf')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedFileType === 'legit_pdf'
                  ? 'bg-slate-900 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-emerald-400 mb-1">Legitimate PDF</div>
              <div className="text-[11px] font-mono text-slate-300">report.pdf (Magic: %PDF-1.7)</div>
            </button>

            <button
              onClick={() => setSelectedFileType('disguised_exe')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedFileType === 'disguised_exe'
                  ? 'bg-slate-900 border-rose-500 text-white shadow-md shadow-rose-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-rose-400 mb-1">Disguised Windows PE</div>
              <div className="text-[11px] font-mono text-slate-300">salary_sheet.pdf (Magic: 4D 5A 'MZ')</div>
            </button>

            <button
              onClick={() => setSelectedFileType('zip_slip')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedFileType === 'zip_slip'
                  ? 'bg-slate-900 border-amber-500 text-white shadow-md shadow-amber-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-amber-400 mb-1">Linux ELF Binary</div>
              <div className="text-[11px] font-mono text-slate-300">contract.png (Magic: 7F 45 4C 46)</div>
            </button>
          </div>

          {/* Inspection Terminal */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 border-b border-slate-800 pb-2">
              <span className="flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>StorageService.detectFileType(buffer)</span>
              </span>
              <span className="text-[10px]">CAS Gateway Check</span>
            </div>

            {selectedFileType === 'legit_pdf' && (
              <div className="space-y-1 text-slate-300 pt-1">
                <div>[Inspect] Header bytes: <span className="text-emerald-400 font-bold">25 50 44 46 (%PDF)</span></div>
                <div>[Inspect] MIME resolved: <span className="text-emerald-400">application/pdf</span></div>
                <div>[Security] Content safe. SHA-256 CAS Key: 7f83b1657ff1...</div>
                <div className="text-emerald-400 font-bold">✅ GATEWAY PERMITTED: Document admitted to encrypted storage.</div>
              </div>
            )}

            {selectedFileType === 'disguised_exe' && (
              <div className="space-y-1 text-slate-300 pt-1">
                <div>[Inspect] Header bytes: <span className="text-rose-400 font-bold">4D 5A (MZ DOS/PE Executable)</span></div>
                <div>[Security] Suffix claim was '.pdf' but binary is Windows Portable Executable!</div>
                <div className="text-rose-400 font-bold">❌ GATEWAY REJECTED: HTTP 400 MALICIOUS_EXECUTABLE_REJECTED</div>
                <div className="text-slate-400 text-[11px]">Audit log row written with SHA-256 chained entry: SUSPICIOUS_UPLOAD_BLOCKED</div>
              </div>
            )}

            {selectedFileType === 'zip_slip' && (
              <div className="space-y-1 text-slate-300 pt-1">
                <div>[Inspect] Header bytes: <span className="text-amber-400 font-bold">7F 45 4C 46 (ELF Linux Binary)</span></div>
                <div>[Security] Extension claim '.png' does not match ELF executable magic signature!</div>
                <div className="text-rose-400 font-bold">❌ GATEWAY REJECTED: HTTP 400 DISGUISED_BINARY_BLOCKED</div>
                <div className="text-slate-400 text-[11px]">Audit log row written: SUSPICIOUS_MIME_SPOOF_BLOCKED</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
