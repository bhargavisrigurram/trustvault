import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  X,
  Share2,
  UserPlus,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Link,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface ShareModalProps {
  documentId: string | null;
  documentTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onGrantCreated?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  documentId,
  documentTitle,
  isOpen,
  onClose,
  onGrantCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'grants' | 'token-link'>('grants');
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [grantee, setGrantee] = useState('');
  const [permission, setPermission] = useState<'read' | 'edit'>('read');
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Single-use token state
  const [tokenLoading, setTokenLoading] = useState(false);
  const [generatedTokenUrl, setGeneratedTokenUrl] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchGrants = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const data = await api.listGrants(documentId);
      // Filter out revoked grants from active view if desired, or show status
      setGrants(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch active grants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && documentId) {
      fetchGrants();
      setGrantee('');
      setError(null);
      setSuccessMessage(null);
      setGeneratedTokenUrl(null);
      setActiveTab('grants');
    }
  }, [isOpen, documentId]);

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !documentId) return null;

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGrantee = grantee.trim();
    if (!cleanGrantee) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.createGrant(documentId, {
        granteeUsernameOrEmail: cleanGrantee,
        permission,
        expiresInHours: expiresInHours > 0 ? expiresInHours : undefined,
      });

      setSuccessMessage(`✓ Successfully granted ${permission.toUpperCase()} access to ${cleanGrantee}!`);
      setGrantee('');
      await fetchGrants();
      if (onGrantCreated) onGrantCreated();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to grant permission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeGrant = async (grantId: string, username: string) => {
    try {
      await api.revokeGrant(documentId, grantId);
      setSuccessMessage(`✓ Revoked access for ${username}.`);
      await fetchGrants();
      if (onGrantCreated) onGrantCreated();
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke grant');
    }
  };

  const handleGenerateOneTimeLink = async () => {
    setTokenLoading(true);
    setError(null);
    try {
      const res = await api.issueDownloadToken(documentId);
      const fullUrl = `${window.location.origin}${api.getDownloadUrl(res.token)}`;
      setGeneratedTokenUrl(fullUrl);
      setTokenExpiresAt(res.expiresAt);
    } catch (err: any) {
      setError(err.message || 'Failed to generate single-use download token');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedTokenUrl) return;
    navigator.clipboard.writeText(generatedTokenUrl);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const quickCollaborators = [
    { label: 'bob', role: 'Viewer (Read-only)' },
    { label: 'alice', role: 'Owner' },
    { label: 'admin', role: 'Admin (Auditor)' },
  ];

  return (
    <div
      id="share-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="glass-panel w-full max-w-lg rounded-3xl shadow-2xl p-6 border border-slate-700/80 max-h-[90vh] flex flex-col bg-slate-900/95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">Access & Sharing Controls</h2>
              <p className="text-xs text-slate-400 truncate max-w-xs font-mono" title={documentTitle || documentId}>
                {documentTitle ? `Doc: ${documentTitle}` : `ID: ${documentId.slice(0, 8)}...`}
              </p>
            </div>
          </div>
          <button
            id="btn-close-share-modal"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Dialog (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800 my-3 text-xs flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('grants')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'grants'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Collaborator Grants</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('token-link')}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'token-link'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="w-3.5 h-3.5 text-cyan-400" />
            <span>Single-Use 60s Token</span>
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2 animate-fadeIn flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: COLLABORATOR GRANTS */}
        {activeTab === 'grants' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Add Grant Form */}
            <form onSubmit={handleCreateGrant} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Grant Access to Collaborator:</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Zero-Trust Kernel</span>
              </div>

              {/* Quick Collaborator Pickers */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-slate-500 font-medium">Quick Pick:</span>
                {quickCollaborators.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setGrantee(c.label)}
                    className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/60 text-[10px] font-mono text-slate-300 transition-colors flex items-center space-x-1"
                    title={`Click to select ${c.label} (${c.role})`}
                  >
                    <span>+ {c.label}</span>
                  </button>
                ))}
              </div>

              {/* Grantee Input */}
              <div>
                <input
                  id="input-grantee-username"
                  type="text"
                  required
                  value={grantee}
                  onChange={(e) => setGrantee(e.target.value)}
                  placeholder="Enter username or email (e.g. bob, alice, admin)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    Permission Scope
                  </label>
                  <select
                    id="select-grant-permission"
                    value={permission}
                    onChange={(e: any) => setPermission(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="read">Read & Download (Viewer)</option>
                    <option value="edit">Edit & Version (Collaborator)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    Auto-Expiration
                  </label>
                  <select
                    id="select-grant-expiration"
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={24}>24 Hours (1 Day)</option>
                    <option value={168}>7 Days (1 Week)</option>
                    <option value={720}>30 Days (1 Month)</option>
                    <option value={0}>Never Expires</option>
                  </select>
                </div>
              </div>

              <button
                id="btn-confirm-grant"
                type="submit"
                disabled={submitting || !grantee.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Cryptographically Authorizing...' : 'Grant Permission'}
              </button>
            </form>

            {/* Existing Active Grants List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Active Grants ({grants.filter((g) => !g.revoked_at).length})</span>
                </span>
                <span className="text-[10px] text-slate-500">Auto-Enforced</span>
              </div>

              {loading ? (
                <div className="text-center py-6 text-xs text-slate-400 font-mono animate-pulse">
                  Verifying cryptographic permissions in PostgreSQL...
                </div>
              ) : grants.filter((g) => !g.revoked_at).length === 0 ? (
                <div className="text-center py-6 px-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                  <Shield className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                  <p className="font-semibold text-slate-300">Private Document</p>
                  <p className="text-[11px] text-slate-500">
                    No active grants exist. Non-owners receive HTTP 404 existence concealment.
                  </p>
                </div>
              ) : (
                grants
                  .filter((g) => !g.revoked_at)
                  .map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white font-mono">{g.grantee_username || g.grantee_email}</span>
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              g.permission === 'edit'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-blue-950 text-blue-300 border border-blue-800'
                            }`}
                          >
                            {g.permission}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mt-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {g.expires_at ? `Expires: ${new Date(g.expires_at).toLocaleDateString()} ${new Date(g.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Permanent (No Expiration)'}
                          </span>
                        </div>
                      </div>

                      <button
                        id={`btn-revoke-${g.id}`}
                        onClick={() => handleRevokeGrant(g.id, g.grantee_username || g.grantee_email)}
                        title="Revoke Permission Immediately"
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition-colors flex items-center space-x-1 text-[11px] font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ONE-TIME DOWNLOAD TOKEN LINK */}
        {activeTab === 'token-link' && (
          <div className="flex-1 overflow-y-auto space-y-4 p-2 text-xs">
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/60 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-300 font-bold">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Single-Use 60-Second Download Token</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                TrustVault issues cryptographically random, ephemeral download tokens with a strict <strong>60-second lifetime</strong>. Once redeemed, the token is permanently consumed in database transactions—preventing replay attacks, link scrapers, and URL leaks.
              </p>
            </div>

            {!generatedTokenUrl ? (
              <div className="text-center py-6 space-y-3">
                <button
                  type="button"
                  onClick={handleGenerateOneTimeLink}
                  disabled={tokenLoading}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                >
                  {tokenLoading ? 'Generating Token...' : 'Generate 1-Time Secure Link'}
                </button>
                <p className="text-[11px] text-slate-500">
                  Generates an unguessable URL valid for exactly 1 download.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Single-Use Token Active:</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Expires: {tokenExpiresAt ? new Date(tokenExpiresAt).toLocaleTimeString() : '60 seconds'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                  {generatedTokenUrl}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Secure Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateOneTimeLink}
                    disabled={tokenLoading}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    New Token
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
