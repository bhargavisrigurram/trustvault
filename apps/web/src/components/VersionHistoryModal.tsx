import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, History, Download, Copy, Check, Upload, AlertCircle } from 'lucide-react';
import type { Document, DocumentVersion } from '@trustvault/shared';

interface VersionHistoryModalProps {
  documentId: string | null;
  canEdit: boolean;
  isOpen: boolean;
  onClose: () => void;
  onVersionUploaded: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  documentId,
  canEdit,
  isOpen,
  onClose,
  onVersionUploaded,
}) => {
  const [doc, setDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);

  const fetchVersions = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const data = await api.getDocument(documentId);
      setDoc(data.document);
      setVersions(data.versions);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && documentId) {
      fetchVersions();
      setNewVersionFile(null);
    }
  }, [isOpen, documentId]);

  if (!isOpen || !documentId) return null;

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownloadVersion = async (versionNumber: number) => {
    try {
      const { token } = await api.issueDownloadToken(documentId, versionNumber);
      const url = api.getDownloadUrl(token);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Failed to obtain download token');
    }
  };

  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionFile || !doc) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', newVersionFile);
      formData.append('expectedVersion', String(doc.current_version_number));

      await api.uploadVersion(documentId, formData);
      setNewVersionFile(null);
      await fetchVersions();
      onVersionUploaded();
    } catch (err: any) {
      setError(err.message || 'Failed to upload new version');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-slate-700/80 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Version History</h2>
              <p className="text-xs text-slate-400">{doc?.title || 'Loading document...'}</p>
            </div>
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

        {/* Content: Version List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading immutable versions...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">No versions found</div>
          ) : (
            versions.map((ver) => {
              const isCurrent = ver.version_number === doc?.current_version_number;
              return (
                <div
                  key={ver.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    isCurrent
                      ? 'bg-emerald-950/20 border-emerald-800/60 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isCurrent
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        v{ver.version_number}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                          Current Head
                        </span>
                      )}
                      <span className="text-sm font-medium text-slate-200">{ver.file_name}</span>
                    </div>

                    <button
                      id={`btn-download-v${ver.version_number}`}
                      onClick={() => handleDownloadVersion(ver.version_number)}
                      className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                    <span>Size: {(Number(ver.file_size) / 1024).toFixed(1)} KB</span>
                    <span>Format: {ver.mime_type}</span>
                    <span>Uploaded: {new Date(ver.created_at).toLocaleString()}</span>
                  </div>

                  {/* SHA-256 Checksum */}
                  <div className="flex items-center justify-between bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-[11px] font-mono-code text-slate-400">
                    <span className="truncate mr-2">SHA-256: {ver.sha256_checksum}</span>
                    <button
                      onClick={() => handleCopyHash(ver.sha256_checksum)}
                      title="Copy SHA-256 Checksum"
                      className="p-1 hover:text-white transition-colors flex-shrink-0"
                    >
                      {copiedHash === ver.sha256_checksum ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Upload New Version (For Owners and Editors) */}
        {canEdit && doc && !doc.is_deleted && (
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center space-x-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Create Immutable Version v{doc.current_version_number + 1}</span>
            </h3>

            <form onSubmit={handleUploadNewVersion} className="flex items-center space-x-3">
              <input
                id="input-new-version-file"
                type="file"
                required
                onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.csv"
                className="flex-1 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-emerald-400 hover:file:bg-slate-700 cursor-pointer"
              />

              <button
                id="btn-upload-version"
                type="submit"
                disabled={uploading || !newVersionFile}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {uploading ? 'Versioning...' : 'Upload Version'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
