import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { UploadModal } from '../components/UploadModal';
import { VersionHistoryModal } from '../components/VersionHistoryModal';
import { ShareModal } from '../components/ShareModal';
import {
  FileText,
  UploadCloud,
  Search,
  Download,
  Share2,
  History,
  Trash2,
  RotateCcw,
  Clock,
  User,
  Shield,
  FileSpreadsheet,
  FileImage,
  FileCode,
} from 'lucide-react';
import type { DocumentSearchItem, DocumentSearchFacets } from '@trustvault/shared';

export const DashboardPage: React.FC = () => {
  const { isOwner } = useAuth();

  // Search & Filter state
  const [scope, setScope] = useState<'all' | 'owned' | 'shared' | 'trash'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'title' | 'created_at' | 'file_size'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Documents and Facets
  const [documents, setDocuments] = useState<DocumentSearchItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<DocumentSearchFacets>({ categories: [], mimeTypes: [] });
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [historyCanEdit, setHistoryCanEdit] = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.searchDocuments({
        q: searchQuery || undefined,
        category: selectedCategory || undefined,
        fileType: selectedFileType || undefined,
        filter: scope,
        sortBy,
        sortOrder,
      });

      setDocuments(res.documents);
      setTotalCount(res.pagination.totalCount);
      setFacets(res.facets);
    } catch (err) {
      console.error('Failed to search documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [scope, selectedCategory, selectedFileType, sortBy, sortOrder]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDownload = async (doc: DocumentSearchItem) => {
    try {
      const { token } = await api.issueDownloadToken(doc.id);
      const url = api.getDownloadUrl(token);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Download failed');
    }
  };

  const handleDelete = async (doc: DocumentSearchItem) => {
    if (!confirm(`Are you sure you want to move "${doc.title}" to trash?`)) return;
    try {
      await api.deleteDocument(doc.id);
      await fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const handleRecover = async (doc: DocumentSearchItem) => {
    try {
      await api.recoverDocument(doc.id);
      await fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to recover document');
    }
  };

  const getFileIcon = (mime?: string | null) => {
    if (!mime) return <FileText className="w-5 h-5 text-emerald-400" />;
    if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-rose-400" />;
    if (mime.includes('image')) return <FileImage className="w-5 h-5 text-purple-400" />;
    if (mime.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    return <FileCode className="w-5 h-5 text-blue-400" />;
  };

  const getPermissionBadge = (perm: string) => {
    switch (perm) {
      case 'owner':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800/80';
      case 'edit':
        return 'bg-amber-950 text-amber-400 border-amber-800/80';
      default:
        return 'bg-blue-950 text-blue-400 border-blue-800/80';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Encrypted Document Vault</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Zero-knowledge document storage protected by mandatory central authorization
          </p>
        </div>

        {isOwner && (
          <button
            id="btn-open-upload"
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-emerald-600/20"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Store Document</span>
          </button>
        )}
      </div>

      {/* Scope Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          id="tab-scope-all"
          onClick={() => setScope('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            scope === 'all'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Accessible
        </button>

        <button
          id="tab-scope-owned"
          onClick={() => setScope('owned')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            scope === 'owned'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          My Documents
        </button>

        <button
          id="tab-scope-shared"
          onClick={() => setScope('shared')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            scope === 'shared'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Shared with Me
        </button>

        <button
          id="tab-scope-trash"
          onClick={() => setScope('trash')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            scope === 'trash'
              ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
              : 'text-slate-400 hover:text-rose-300'
          }`}
        >
          Trash
        </button>

        <div className="flex-1" />
        <span className="text-xs text-slate-500 font-mono">
          {totalCount} {totalCount === 1 ? 'document' : 'documents'}
        </span>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-panel p-4 rounded-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Text Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              id="input-search-query"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or filename..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              id="select-filter-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Categories</option>
              {facets.categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {/* File Type Dropdown */}
          <div>
            <select
              id="select-filter-filetype"
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Formats</option>
              <option value="pdf">PDF Documents</option>
              <option value="png">PNG Images</option>
              <option value="jpeg">JPEG Images</option>
              <option value="txt">Text Files</option>
              <option value="md">Markdown</option>
              <option value="csv">CSV Spreadsheets</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-1.5">
            <select
              id="select-sort-by"
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="updated_at">Recently Updated</option>
              <option value="created_at">Creation Date</option>
              <option value="title">Title (A-Z)</option>
              <option value="file_size">File Size</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white"
              title="Toggle sort direction"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Facet Chips */}
        {facets.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Categories:</span>
            {facets.categories.map((c) => (
              <button
                key={c.category}
                onClick={() => setSelectedCategory(selectedCategory === c.category ? '' : c.category)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  selectedCategory === c.category
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {c.category} ({c.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Document Grid / List */}
      {loading ? (
        <div className="text-center py-16 text-sm text-slate-400">Loading secure documents...</div>
      ) : documents.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No documents found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {scope === 'trash'
              ? 'Your trash is completely empty.'
              : 'No documents match your active search query or permission scope.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isOwner = doc.effective_permission === 'owner';
            const canEdit = doc.effective_permission === 'owner' || doc.effective_permission === 'edit';

            return (
              <div
                key={doc.id}
                className="glass-panel glass-panel-hover p-5 rounded-2xl flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Category and Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 truncate">
                      {doc.category}
                    </span>

                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                        v{doc.current_version_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${getPermissionBadge(
                          doc.effective_permission
                        )}`}
                      >
                        {doc.effective_permission}
                      </span>
                    </div>
                  </div>

                  {/* Title & File details */}
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex-shrink-0 mt-0.5">
                      {getFileIcon(doc.mime_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white truncate" title={doc.title}>
                        {doc.title}
                      </h3>
                      <p className="text-xs text-slate-400 truncate mt-0.5" title={doc.file_name || ''}>
                        {doc.file_name || 'No file attached'}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Info */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{doc.owner_username}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  {doc.is_deleted ? (
                    isOwner && (
                      <button
                        id={`btn-recover-${doc.id}`}
                        onClick={() => handleRecover(doc)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900 text-xs font-semibold transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Recover Document</span>
                      </button>
                    )
                  ) : (
                    <>
                      {/* Left actions: Download & History */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          id={`btn-download-${doc.id}`}
                          onClick={() => handleDownload(doc)}
                          title="Download Secure File"
                          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/60 text-xs font-semibold transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>

                        <button
                          id={`btn-history-${doc.id}`}
                          onClick={() => {
                            setHistoryDocId(doc.id);
                            setHistoryCanEdit(canEdit);
                          }}
                          title="View Version History & Uploads"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Right actions: Share & Delete (Owner only) */}
                      {isOwner && (
                        <div className="flex items-center space-x-1">
                          <button
                            id={`btn-share-${doc.id}`}
                            onClick={() => setShareDocId(doc.id)}
                            title="Share with Collaborators"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          <button
                            id={`btn-delete-${doc.id}`}
                            onClick={() => handleDelete(doc)}
                            title="Soft-Delete Document"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={fetchDocuments}
      />

      <VersionHistoryModal
        documentId={historyDocId}
        canEdit={historyCanEdit}
        isOpen={Boolean(historyDocId)}
        onClose={() => setHistoryDocId(null)}
        onVersionUploaded={fetchDocuments}
      />

      <ShareModal
        documentId={shareDocId}
        isOpen={Boolean(shareDocId)}
        onClose={() => setShareDocId(null)}
      />
    </div>
  );
};
