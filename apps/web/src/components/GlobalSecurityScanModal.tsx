import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  X,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { api } from '../services/api';

interface GlobalSecurityScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSecurityScanModal: React.FC<GlobalSecurityScanModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{
    overallStatus: 'SECURE' | 'WARNING' | 'COMPROMISED';
    riskScore: number;
    auditChainValid: boolean;
    auditRecordsCount: number;
    documentsScanned: number;
    anomaliesCount: number;
    dlpFindingsCount: number;
    checks: Array<{ name: string; status: 'PASSED' | 'FAILED' | 'WARNING'; message: string }>;
    recommendations: string[];
    scannedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.runAutomatedSecurityScan();
      setScanResult(res);
    } catch (err: any) {
      setError(err.message || 'Automated security scan failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !scanResult && !loading) {
      executeScan();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getStatusBadge = (status: 'SECURE' | 'WARNING' | 'COMPROMISED') => {
    switch (status) {
      case 'SECURE':
        return {
          bg: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80',
          icon: ShieldCheck,
          text: 'POSTURE: ZERO-TRUST SECURE',
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-950/80 text-amber-400 border-amber-800/80',
          icon: AlertTriangle,
          text: 'POSTURE: ACTION REQUIRED',
        };
      default:
        return {
          bg: 'bg-rose-950/80 text-rose-400 border-rose-800/80',
          icon: ShieldAlert,
          text: 'POSTURE: SYSTEM COMPROMISED',
        };
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const badge = scanResult ? getStatusBadge(scanResult.overallStatus) : null;
  const BadgeIcon = badge?.icon;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Automated Security & Compliance Scanner
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/80">
                  ADMIN CORE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Full-spectrum evaluation: SHA-256 hash continuity, CAS storage, DB immutability, and AI guardrails
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={executeScan}
                className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white font-semibold text-xs"
              >
                Retry Scan
              </button>
            </div>
          )}

          {/* Loading Radar Animation */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-emerald-500/40 animate-spin" />
                <Shield className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-white">Running 1-Click Automated Scan...</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Inspecting audit log hash continuity, Content-Addressable Storage hashes, and active sessions...
                </p>
              </div>
            </div>
          )}

          {/* Scan Results Dashboard */}
          {!loading && scanResult && (
            <div className="space-y-6">
              {/* Top Score Banner */}
              <div className="p-5 rounded-2xl glass-panel border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  {BadgeIcon && (
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center">
                      <BadgeIcon className="w-6 h-6 text-emerald-400" />
                    </div>
                  )}
                  <div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge?.bg}`}>
                      {badge?.text}
                    </span>
                    <div className="text-xs text-slate-400 mt-1">
                      Scanned: {new Date(scanResult.scannedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-right">
                  <div>
                    <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                      {scanResult.riskScore} / 100
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Security Posture Score</div>
                  </div>

                  <button
                    onClick={executeScan}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center space-x-1.5 text-xs font-semibold"
                    title="Re-run security scan"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Rerun</span>
                  </button>
                </div>
              </div>

              {/* Metric Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-lg font-bold text-white font-mono">{scanResult.auditRecordsCount}</div>
                  <div className="text-[11px] text-slate-400">Audit Blocks Chained</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-lg font-bold text-white font-mono">{scanResult.documentsScanned}</div>
                  <div className="text-[11px] text-slate-400">Vault Documents</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className={`text-lg font-bold font-mono ${scanResult.anomaliesCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {scanResult.anomaliesCount}
                  </div>
                  <div className="text-[11px] text-slate-400">Active Anomalies</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className={`text-lg font-bold font-mono ${scanResult.dlpFindingsCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {scanResult.dlpFindingsCount}
                  </div>
                  <div className="text-[11px] text-slate-400">DLP Findings</div>
                </div>
              </div>

              {/* Automated Checks List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Automated Checks Evaluation ({scanResult.checks.length})
                </h4>
                <div className="space-y-2">
                  {scanResult.checks.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start space-x-2.5">
                        {c.status === 'PASSED' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : c.status === 'WARNING' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-semibold text-white">{c.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{c.message}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                          c.status === 'PASSED'
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                            : c.status === 'WARNING'
                            ? 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                            : 'bg-rose-950/80 text-rose-400 border-rose-800/80'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {scanResult.recommendations.length > 0 && (
                <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-300 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Zero-Trust Hardening Recommendations</span>
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                    {scanResult.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            Audit chain hash: <span className="text-emerald-400">Genesis anchored</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
