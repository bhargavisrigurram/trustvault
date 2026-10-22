import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Share2, UserPlus, Trash2, Clock, AlertCircle } from 'lucide-react';

interface ShareModalProps {
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ documentId, isOpen, onClose }) => {
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [grantee, setGrantee] = useState('');
  const [permission, setPermission] = useState<'read' | 'edit'>('read');
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrants = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const data = await api.listGrants(documentId);
      setGrants(data);
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
    }
  }, [isOpen, documentId]);

  if (!isOpen || !documentId) return null;

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantee.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.createGrant(documentId, {
        granteeUsernameOrEmail: grantee.trim(),
        permission,
        expiresInHours: expiresInHours && expiresInHours > 0 ? expiresInHours : undefined,
      });
      setGrantee('');
      await fetchGrants();
    } catch (err: any) {
      setError(err.message || 'Failed to grant permission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    try {
      await api.revokeGrant(documentId, grantId);
      await fetchGrants();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke grant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-700/80 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Access & Sharing Permissions</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Grant Form */}
        <form onSubmit={handleCreateGrant} className="pt-4 pb-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Grant Access to Collaborator</span>
          </div>

          <div>
            <input
              id="input-grantee-username"
              type="text"
              required
              value={grantee}
              onChange={(e) => setGrantee(e.target.value)}
              placeholder="Enter recipient username or email"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Permission</label>
              <select
                id="select-grant-permission"
                value={permission}
                onChange={(e: any) => setPermission(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="read">Read & Download</option>
                <option value="edit">Edit & Version</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Expiration</label>
              <select
                id="select-grant-expiration"
                value={expiresInHours || 0}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>1 Hour</option>
                <option value={24}>24 Hours</option>
                <option value={168}>7 Days</option>
                <option value={720}>30 Days</option>
                <option value={0}>Never Expires</option>
              </select>
            </div>
          </div>

          <button
            id="btn-confirm-grant"
            type="submit"
            disabled={submitting || !grantee.trim()}
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs tracking-wider uppercase transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            {submitting ? 'Issuing Grant...' : 'Grant Permission'}
          </button>
        </form>

        {/* Existing Grants List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Active Document Grants ({grants.length})
          </p>

          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400">Loading active grants...</div>
          ) : grants.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              No active grants. Only you can access this document.
            </div>
          ) : (
            grants.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-200">{g.grantee_username || g.grantee_email}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        g.permission === 'edit'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}
                    >
                      {g.permission}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>
                      {g.expires_at ? `Expires: ${new Date(g.expires_at).toLocaleDateString()}` : 'Never expires'}
                    </span>
                  </div>
                </div>

                <button
                  id={`btn-revoke-${g.id}`}
                  onClick={() => handleRevokeGrant(g.id)}
                  title="Revoke Access Immediately"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
