import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  LogOut,
  FileText,
  Activity,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  currentView: 'home' | 'documents' | 'admin-audit';
  onNavigate: (view: 'home' | 'documents' | 'admin-audit') => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenCopilot?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onOpenAuth, onOpenCopilot }) => {
  const { user, logout, isAdmin } = useAuth();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setApiOnline(data.status === 'UP'))
      .catch(() => setApiOnline(false));
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'owner':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50';
      default:
        return 'bg-teal-900/60 text-teal-300 border-teal-700/50';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => onNavigate(user ? 'documents' : 'home')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all">
            <Shield className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
                TrustVault
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                ZERO-TRUST
              </span>
            </div>
            <p className="text-[10px] text-slate-500 hidden md:block">Cryptographically Verifiable Document Core</p>
          </div>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => onNavigate('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              currentView === 'home'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Showcase & Threats
          </button>

          {user && (
            <button
              id="nav-documents"
              onClick={() => onNavigate('documents')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentView === 'documents'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>My Vault</span>
            </button>
          )}

          {user && isAdmin && (
            <button
              id="nav-admin-audit"
              onClick={() => onNavigate('admin-audit')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentView === 'admin-audit'
                  ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50 shadow-sm'
                  : 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Chain</span>
            </button>
          )}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          {/* API Health Pulse */}
          <div
            className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400"
            title="PostgreSQL & API Core Connectivity Status"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                apiOnline === true
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                  : apiOnline === false
                  ? 'bg-rose-500'
                  : 'bg-slate-500'
              }`}
            />
            <span>{apiOnline ? 'Core Online' : 'Connecting...'}</span>
          </div>

          {/* Supabase PostgreSQL Status */}
          <div
            className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400"
            title="Connected to Supabase PostgreSQL (hybpqldwblpxluvsqazz)"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold">Supabase</span>
            <span className="text-slate-500">Live</span>
          </div>

          {/* AI Copilot Quick Button - STRICTLY FOR LOGGED IN USERS ONLY */}
          {user && onOpenCopilot && (
            <button
              id="btn-nav-copilot"
              onClick={onOpenCopilot}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-950/70 border border-teal-800/80 hover:border-teal-500 text-teal-300 text-xs font-semibold shadow-sm transition-all hover:scale-105"
              title="Open Vault AI Copilot Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">AI Copilot</span>
            </button>
          )}

          {user ? (
            /* User Info & Logout */
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-white font-mono">{user.username}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border w-fit ml-auto uppercase ${getRoleBadge(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>

              <button
                id="btn-logout"
                onClick={logout}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors"
                title="Sign out of vault"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            /* Guest Actions: Sign In & Create Account */
            <div className="flex items-center space-x-2">
              <button
                id="btn-nav-login"
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors border border-slate-800 hover:border-slate-700"
              >
                Sign In
              </button>

              <button
                id="btn-nav-register"
                onClick={() => onOpenAuth('register')}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5"
              >
                <span>Create Account</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
