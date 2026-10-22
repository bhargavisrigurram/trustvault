import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldAlert, LogOut, FileText, Activity } from 'lucide-react';

interface NavbarProps {
  currentView: 'documents' | 'admin-audit';
  onNavigate: (view: 'documents' | 'admin-audit') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, logout, isAdmin } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'owner':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50';
      default:
        return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('documents')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
              TrustVault
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              Zero-Trust Core
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        {user && (
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              id="nav-documents"
              onClick={() => onNavigate('documents')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'documents'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Documents</span>
            </button>

            {isAdmin && (
              <button
                id="nav-admin-audit"
                onClick={() => onNavigate('admin-audit')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'admin-audit'
                    ? 'bg-purple-900/50 text-purple-200 border border-purple-700/60 shadow-sm'
                    : 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/50'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Audit & Security</span>
              </button>
            )}
          </nav>
        )}

        {/* User Info & Logout */}
        {user ? (
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-200">{user.username}</span>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${getRoleBadge(
                  user.role
                )}`}
              >
                {user.role}
              </span>
            </div>

            <button
              id="btn-logout"
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Secure Session Protected</span>
          </div>
        )}
      </div>
    </header>
  );
};
