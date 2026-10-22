import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Key,
} from 'lucide-react';
import type { AuditRecord } from '@trustvault/shared';

export const AdminAuditPage: React.FC = () => {
  const [verification, setVerification] = useState<{
    valid: boolean;
    recordCount: number;
    genesisHash: string;
    headHash: string | null;
    brokenSequence?: number;
    error?: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [anomalies, setAnomalies] = useState<{
    repeatedDeniedAttempts: Array<{ actor_username: string; count: number; last_attempt: string }>;
    failedLogins: Array<{ actor_username: string; count: number; last_attempt: string }>;
    unusualDownloads: Array<{ actor_username: string; count: number }>;
  } | null>(null);

  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditChain();
      setVerification(res);
    } catch (err: any) {
      alert(err.message || 'Chain verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const res = await api.getAuditAnomalies();
      setAnomalies(res);
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.queryAuditLogs({
        eventType: eventTypeFilter || undefined,
        outcome: outcomeFilter || undefined,
        limit: 50,
      });
      setLogs(res.records);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error('Failed to query audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    handleVerify();
    fetchAnomalies();
    fetchLogs();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [eventTypeFilter, outcomeFilter]);

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'SUCCESS':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800/80';
      case 'DENIED':
        return 'bg-amber-950 text-amber-400 border-amber-800/80';
      default:
        return 'bg-rose-950 text-rose-400 border-rose-800/80';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2.5">
          <Key className="w-6 h-6 text-purple-400" />
          <span>Security & Cryptographic Audit Verification</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographically linked SHA-256 event chain, database immutability triggers, and anomaly monitoring
        </p>
      </div>

      {/* 1. Chain Verification Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            {verification?.valid ? (
              <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-900/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-900/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-white">Cryptographic Hash Chain Integrity</span>
                {verification && (
                  <span
                    id="chain-verification-status"
                    className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      verification.valid
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                    }`}
                  >
                    {verification.valid ? 'Verified Incorruptible' : 'Tamper Detected'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Every event payload is canonically stringified and mathematically chained: Hash(PrevHash + Data)
              </p>
            </div>
          </div>

          <button
            id="btn-reverify-chain"
            onClick={handleVerify}
            disabled={verifying}
            className="flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs tracking-wide transition-colors shadow-lg shadow-purple-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Recalculating...' : 'Verify Entire Chain'}</span>
          </button>
        </div>

        {verification && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block mb-1">Total Verified Events</span>
              <span className="text-xl font-bold text-white font-mono-code">{verification.recordCount}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block mb-1">Genesis Anchor Hash (Root)</span>
              <span className="font-mono-code text-[11px] text-slate-300 break-all">{verification.genesisHash}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block mb-1">Current Head Hash</span>
              <span className="font-mono-code text-[11px] text-emerald-400 break-all">
                {verification.headHash || 'N/A (Empty Chain)'}
              </span>
            </div>
          </div>
        )}

        {verification && !verification.valid && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
            <p className="font-bold flex items-center space-x-1.5 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>MATHEMATICAL CHAIN BREAKAGE DETECTED</span>
            </p>
            <p>Broken Sequence: #{verification.brokenSequence}</p>
            <p className="text-slate-300 mt-1">{verification.error}</p>
          </div>
        )}
      </div>

      {/* 2. Security Anomalies Detection */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Security Anomalies (Last 24 Hours)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Failed Logins / Brute Force */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase text-slate-400">Failed Logins</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">Threshold: &ge;3</span>
            </div>
            {anomalies?.failedLogins && anomalies.failedLogins.length > 0 ? (
              <div className="space-y-2">
                {anomalies.failedLogins.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs">
                    <p className="font-semibold text-rose-300">{item.actor_username}</p>
                    <p className="text-[11px] text-slate-400">{item.count} consecutive failures</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3">No brute-force anomalies detected</p>
            )}
          </div>

          {/* Repeated Denials / Probing */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase text-slate-400">Repeated Denials</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">Threshold: &ge;3</span>
            </div>
            {anomalies?.repeatedDeniedAttempts && anomalies.repeatedDeniedAttempts.length > 0 ? (
              <div className="space-y-2">
                {anomalies.repeatedDeniedAttempts.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-900/60 text-xs">
                    <p className="font-semibold text-amber-300">{item.actor_username}</p>
                    <p className="text-[11px] text-slate-400">{item.count} unauthorized attempts</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3">No unauthorized probing detected</p>
            )}
          </div>

          {/* High Download Volumes */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase text-slate-400">Download Volume</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">Threshold: &ge;10</span>
            </div>
            {anomalies?.unusualDownloads && anomalies.unusualDownloads.length > 0 ? (
              <div className="space-y-2">
                {anomalies.unusualDownloads.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-900/60 text-xs">
                    <p className="font-semibold text-blue-300">{item.actor_username}</p>
                    <p className="text-[11px] text-slate-400">{item.count} document downloads</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3">Normal download activity</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Live Audit Log Explorer */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">Immutable Event Journal</h2>
            <p className="text-xs text-slate-400">Showing {logs.length} of {totalCount} total verified events</p>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-3 text-xs">
            <select
              id="select-audit-event-type"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Event Types</option>
              <option value="auth.login.success">auth.login.success</option>
              <option value="auth.login.failure">auth.login.failure</option>
              <option value="auth.logout">auth.logout</option>
              <option value="document.create">document.create</option>
              <option value="document.download">document.download</option>
              <option value="document.version.create">document.version.create</option>
              <option value="document.edit">document.edit</option>
              <option value="document.delete">document.delete</option>
              <option value="document.recover">document.recover</option>
              <option value="grant.create">grant.create</option>
              <option value="grant.revoke">grant.revoke</option>
              <option value="token.issue">token.issue</option>
              <option value="token.redeem">token.redeem</option>
              <option value="token.reject">token.reject</option>
              <option value="access.denied">access.denied</option>
            </select>

            <select
              id="select-audit-outcome"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Outcomes</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="DENIED">DENIED</option>
              <option value="FAILURE">FAILURE</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4"># Seq</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4 font-mono-code">Current Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-code">
              {loadingLogs ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 font-sans">
                    Loading audit events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 font-sans">
                    No audit records matching query
                  </td>
                </tr>
              ) : (
                logs.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-bold">#{record.sequence_number}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(record.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-200">
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded text-[11px] border border-slate-700/60">
                        {record.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-300">
                      {record.actor_username || 'anonymous'}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getOutcomeBadge(
                          record.outcome
                        )}`}
                      >
                        {record.outcome}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <span className="truncate max-w-[130px]">{record.current_hash}</span>
                        <button
                          onClick={() => handleCopy(record.current_hash)}
                          title="Copy Full Hash"
                          className="hover:text-white"
                        >
                          {copiedHash === record.current_hash ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
