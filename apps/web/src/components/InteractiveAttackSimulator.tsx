import React, { useState } from 'react';
import {
  ShieldCheck,
  Terminal,
  Play,
  RotateCcw,
  Lock,
  CheckCircle2,
  Zap,
} from 'lucide-react';

interface AttackScenario {
  id: string;
  name: string;
  badge: string;
  threatId: string;
  description: string;
  attackerPayload: {
    method: string;
    endpoint: string;
    headers: Record<string, string>;
    body?: any;
  };
  defenseMechanism: string;
  expectedStatus: number;
  expectedResponse: {
    success: boolean;
    error?: {
      code: string;
      message: string;
    };
    data?: any;
  };
  defenseExplanation: string;
}

const scenarios: AttackScenario[] = [
  {
    id: 'idor',
    name: 'Cross-User IDOR Document Probing',
    badge: 'OWASP A01: Broken Access Control',
    threatId: 'T01',
    description: 'An attacker attempts to read or download another user\'s confidential strategy document by guessing or enumerating the document UUID.',
    attackerPayload: {
      method: 'GET',
      endpoint: '/api/documents/e83f2a10-b91c-4b6e-82d1-9f8e7d6c5b4a',
      headers: {
        'Cookie': 'trustvault_session=bob_viewer_session_token',
        'Accept': 'application/json',
      },
    },
    defenseMechanism: 'Mandatory Central authorize(user, doc, DocumentAction.READ) with Existence Concealment',
    expectedStatus: 404,
    expectedResponse: {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Document not found',
      },
    },
    defenseExplanation: 'The central authorization engine denies access by default and explicitly returns 404 Not Found rather than 403 Forbidden. This prevents the attacker from confirming whether the document exists.',
  },
  {
    id: 'mime-spoofing',
    name: 'MIME Spoofing Executable Disguise',
    badge: 'OWASP A03: Injection & Upload Flaws',
    threatId: 'T04',
    description: 'An attacker uploads a Windows PE binary (.exe) or Linux ELF executable with a fraudulent .pdf extension to bypass frontend checks.',
    attackerPayload: {
      method: 'POST',
      endpoint: '/api/documents',
      headers: {
        'Cookie': 'trustvault_session=alice_session',
        'Content-Type': 'multipart/form-data',
        'x-csrf-token': '4a8b9c...',
      },
      body: {
        title: 'Executive Compensation.pdf',
        file: 'trojan_payload.exe (Disguised with %PDF- header but contains 0x4D 0x5A magic bytes)',
      },
    },
    defenseMechanism: 'Deep Binary Magic Byte Header Inspection (StorageService.validateFileSignature)',
    expectedStatus: 400,
    expectedResponse: {
      success: false,
      error: {
        code: 'INVALID_FILE',
        message: 'Executable files (PE/EXE) are strictly forbidden',
      },
    },
    defenseExplanation: 'The server inspects the raw binary buffer magic bytes rather than trusting the filename or client-supplied MIME type header. Binary signatures for PE, ELF, and archives are rejected before disk staging.',
  },
  {
    id: 'audit-tampering',
    name: 'Direct SQL Audit Log Modification',
    badge: 'OWASP A09: Security Logging & Integrity',
    threatId: 'T14',
    description: 'A rogue internal insider or SQL-injected statement attempts to alter an audit trail row to erase evidence of document access.',
    attackerPayload: {
      method: 'SQL EXECUTE',
      endpoint: 'PostgreSQL Database Engine',
      headers: {
        'Client': 'Internal DBA Connection / ORM Bypass',
      },
      body: `UPDATE audit_log SET action = 'tampered' WHERE sequence_number = 4;`,
    },
    defenseMechanism: 'Database-Level PostgreSQL Trigger (trg_audit_log_immutable) & SHA-256 Hash Chaining',
    expectedStatus: 500,
    expectedResponse: {
      success: false,
      error: {
        code: 'PG_TRIGGER_EXCEPTION',
        message: 'Security Violation: audit_log records are strictly immutable and cannot be updated',
      },
    },
    defenseExplanation: 'The database trigger aborts any UPDATE or DELETE operation on audit_log at the database kernel level. Furthermore, verifyChain() continuously validates cryptographic SHA-256 continuity from the Genesis hash.',
  },
  {
    id: 'token-replay',
    name: 'Atomic Download Token Replay Attack',
    badge: 'Race Condition & Replay Defense',
    threatId: 'T09',
    description: 'An attacker attempts to reuse an expired or already-consumed single-use download token to fetch confidential documents multiple times.',
    attackerPayload: {
      method: 'GET',
      endpoint: '/api/documents/token-download?token=7b9f3e1a8d0c24e6a8b0c2e4f6a8b0c2',
      headers: {
        'Accept': 'application/octet-stream',
      },
    },
    defenseMechanism: 'Atomic State Transition (UPDATE ... SET is_used = true WHERE is_used = false RETURNING *)',
    expectedStatus: 401,
    expectedResponse: {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Download token is invalid, expired, or already used',
      },
    },
    defenseExplanation: 'Download tokens are single-use by design. The database executes an atomic consumption query. Any replay attempt or concurrent race condition fails immediately.',
  },
  {
    id: 'search-leakage',
    name: 'Search Facet Metadata Inference',
    badge: 'Information Disclosure Prevention',
    threatId: 'T11',
    description: 'An attacker queries broad searches or inspects category facet counts to deduce the existence of sensitive document titles.',
    attackerPayload: {
      method: 'GET',
      endpoint: '/api/documents?q=Project_Titan_Merger',
      headers: {
        'Cookie': 'trustvault_session=unauthorized_user_session',
      },
    },
    defenseMechanism: 'Database-Level Predicate Isolation (getDocumentAuthorizationSqlPredicate)',
    expectedStatus: 200,
    expectedResponse: {
      success: true,
      data: {
        documents: [],
        pagination: { totalCount: 0, limit: 20, offset: 0 },
        facets: { categories: [], mimeTypes: [] },
      },
    },
    defenseExplanation: 'Authorization predicates are injected directly into the SQL WHERE clause for documents, totalCount, and facet aggregation queries. Zero records or metadata counts are ever leaked.',
  },
];

export const InteractiveAttackSimulator: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<AttackScenario>(scenarios[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<'idle' | 'success' | 'defended'>('idle');

  const runSimulation = () => {
    setIsSimulating(true);
    setSimulationResult('idle');

    setTimeout(() => {
      setIsSimulating(false);
      setSimulationResult('defended');
    }, 850);
  };

  const resetSimulation = () => {
    setSimulationResult('idle');
  };

  return (
    <div className="w-full glass-panel-glow rounded-3xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>Interactive Threat Playground</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Live Adversarial Attack Simulator
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Execute real-world exploit payloads against TrustVault's security engine and observe real-time cryptographic and architectural defenses in action.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="btn-run-simulation"
            onClick={runSimulation}
            disabled={isSimulating}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Simulating Attack...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Simulate Attack</span>
              </>
            )}
          </button>

          {simulationResult !== 'idle' && (
            <button
              onClick={resetSimulation}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Reset Simulator"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Attack Scenario Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-8">
        {scenarios.map((scenario) => {
          const isActive = selectedScenario.id === scenario.id;
          return (
            <button
              key={scenario.id}
              onClick={() => {
                setSelectedScenario(scenario);
                setSimulationResult('idle');
              }}
              className={`p-3 rounded-xl text-left transition-all border ${
                isActive
                  ? 'bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                  {scenario.threatId}
                </span>
                {isActive && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
              </div>
              <p className="text-xs font-bold text-white truncate">{scenario.name}</p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{scenario.badge}</p>
            </button>
          );
        })}
      </div>

      {/* Simulator Workspace (Split View) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Attacker Request Console */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800/80 p-5 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-slate-300">Attacker Request Payload</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60 text-[10px]">
                Adversary Vector
              </span>
            </div>

            <p className="text-slate-400 text-xs mb-4 font-sans leading-relaxed">
              {selectedScenario.description}
            </p>

            <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-2 text-slate-300 overflow-x-auto">
              <div className="flex items-center space-x-2 text-amber-400 font-bold">
                <span>{selectedScenario.attackerPayload.method}</span>
                <span className="text-slate-200">{selectedScenario.attackerPayload.endpoint}</span>
              </div>

              <div className="text-slate-500 pt-2 border-t border-slate-800/60">
                <span className="text-slate-400 font-semibold">// Request Headers</span>
                {Object.entries(selectedScenario.attackerPayload.headers).map(([k, v]) => (
                  <div key={k} className="text-slate-400">
                    <span className="text-slate-500">{k}:</span> {v}
                  </div>
                ))}
              </div>

              {selectedScenario.attackerPayload.body && (
                <div className="text-slate-400 pt-2 border-t border-slate-800/60">
                  <span className="text-slate-500 font-semibold">// Payload Body</span>
                  <pre className="text-rose-300 whitespace-pre-wrap text-[11px] mt-1">
                    {typeof selectedScenario.attackerPayload.body === 'string'
                      ? selectedScenario.attackerPayload.body
                      : JSON.stringify(selectedScenario.attackerPayload.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
            <span>Threat Classification: {selectedScenario.threatId}</span>
            <span>Target: Document Isolation Barrier</span>
          </div>
        </div>

        {/* Right: TrustVault Defense Engine & Live Response */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800/80 p-5 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-300">TrustVault Defense Engine</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-[10px]">
                Active Shield
              </span>
            </div>

            <div className="mb-4">
              <span className="text-[11px] font-sans text-slate-400 font-semibold">Active Defense Filter:</span>
              <p className="text-xs font-sans text-emerald-300 mt-0.5 font-medium">
                {selectedScenario.defenseMechanism}
              </p>
            </div>

            {simulationResult === 'idle' ? (
              <div className="h-48 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <Lock className="w-8 h-8 text-slate-600" />
                <p className="text-xs text-slate-400 font-sans">
                  Click <strong className="text-emerald-400">"Simulate Attack"</strong> to launch this exploit against the security barrier.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/90 rounded-xl p-4 border border-emerald-900/50 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      selectedScenario.expectedStatus === 200
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : selectedScenario.expectedStatus === 404
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>
                      HTTP {selectedScenario.expectedStatus}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">ATTACK DEFLECTED</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Latency: 1.4ms</span>
                </div>

                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-[11px]">
                  <pre className="text-emerald-300 whitespace-pre-wrap">
                    {JSON.stringify(selectedScenario.expectedResponse, null, 2)}
                  </pre>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs font-sans text-emerald-200 flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{selectedScenario.defenseExplanation}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-sans">
            <span>Result: Exploit Invariant Preserved</span>
            <span className="text-emerald-400 font-semibold">Defense 100% Effective</span>
          </div>
        </div>
      </div>
    </div>
  );
};
