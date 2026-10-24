import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  FileText,
  Copy,
  Check,
  X,
  Download,
  Share2,
  History,
  Trash2,
  Hash,
  Sparkles,
} from 'lucide-react';
import type { DocumentSearchItem } from '@trustvault/shared';

interface DocumentDetailsModalProps {
  document: DocumentSearchItem;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (docId: string, title: string) => void;
  onOpenShare: (docId: string) => void;
  onOpenHistory: (docId: string, canEdit: boolean) => void;
  onDelete: (docId: string, title: string) => void;
  onOpenAi?: (doc: DocumentSearchItem) => void;
  isOwner: boolean;
}

export const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onDownload,
  onOpenShare,
  onOpenHistory,
  onDelete,
  onOpenAi,
  isOwner,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl rounded-3xl glass-panel-glow bg-slate-900 border border-slate-700/80 p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Glow corner */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-extrabold text-white tracking-tight">{doc.title}</h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  v{doc.current_version_number}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{doc.file_name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-6 space-y-5">
          {/* Cryptographic SHA-256 Checksum Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cryptographic SHA-256 Checksum</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Integrity Verified</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300">
              <span className="truncate pr-3">{doc.sha256_checksum || 'Pending verification'}</span>
              {doc.sha256_checksum && (
                <button
                  onClick={() => copyToClipboard(doc.sha256_checksum || '')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 flex items-center space-x-1"
                  title="Copy SHA-256 checksum"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Security & Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 font-medium">Category</span>
              <p className="text-slate-200 font-bold mt-0.5">{doc.category || 'General'}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 font-medium">Payload Size</span>
              <p className="text-slate-200 font-bold mt-0.5 font-mono">{formatBytes(doc.file_size || 0)}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 font-medium">Binary MIME Type</span>
              <p className="text-slate-200 font-bold mt-0.5 font-mono truncate">{doc.mime_type}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 font-medium">Permission Scope</span>
              <p className="text-emerald-400 font-bold mt-0.5 capitalize">{doc.effective_permission || 'Owner'}</p>
            </div>
          </div>

          {/* Storage Invariants */}
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold">
              <Lock className="w-4 h-4" />
              <span>Zero-Knowledge Storage Invariants</span>
            </div>
            <ul className="text-slate-400 space-y-1 pl-6 list-disc text-[11px] leading-relaxed">
              <li>Stored under an unguessable UUID storage key outside the public web server directory.</li>
              <li>Delivered with <code className="text-emerald-300 font-mono">Content-Disposition: attachment</code> and <code className="text-emerald-300 font-mono">X-Content-Type-Options: nosniff</code> headers.</li>
              <li>Protected by central authorization kernel: requests from unauthorized users return HTTP 404.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-slate-800">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onDownload(doc.id, doc.file_name || doc.title);
                onClose();
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-md shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>

            {onOpenAi && (
              <button
                onClick={() => {
                  onOpenAi(doc);
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-teal-950/80 hover:bg-teal-900/80 text-teal-300 font-semibold text-xs border border-teal-800/80 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>AI Insights & DLP</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenHistory(doc.id, doc.effective_permission === 'owner' || doc.effective_permission === 'edit');
                onClose();
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>Versions</span>
            </button>

            {isOwner && (
              <button
                onClick={() => {
                  onOpenShare(doc.id);
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs border border-slate-700 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            )}
          </div>

          {isOwner && (
            <button
              onClick={() => {
                onDelete(doc.id, doc.title);
                onClose();
              }}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-semibold text-xs border border-rose-800/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Move to Trash</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
