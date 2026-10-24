import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { VaultCopilotPage } from './pages/VaultCopilotPage';
import { VaultCopilotModal } from './components/VaultCopilotModal';
import { Shield } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState<'home' | 'documents' | 'admin-audit' | 'copilot'>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [globalCopilotOpen, setGlobalCopilotOpen] = useState(false);

  // When a user successfully authenticates, automatically close the modal and direct to documents
  useEffect(() => {
    if (user) {
      setAuthModalOpen(false);
      if (currentView === 'home') {
        setCurrentView('documents');
      }
    }
  }, [user]);

  // Support Browser Back and Forward buttons seamlessly
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        setCurrentView(e.state.view);
      } else {
        setCurrentView(user ? 'documents' : 'home');
      }
      setGlobalCopilotOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  const handleNavigate = (view: 'home' | 'documents' | 'admin-audit' | 'copilot') => {
    if (view === 'admin-audit' && (!user || !isAdmin)) return;
    if ((view === 'documents' || view === 'copilot') && !user) {
      handleOpenAuth('login');
      return;
    }
    window.history.pushState({ view }, '', `#${view}`);
    setCurrentView(view);
  };

  const handleOpenAuth = (mode?: 'login' | 'register') => {
    setAuthMode(mode || 'login');
    setAuthModalOpen(true);
  };

  const handleCloseAuth = () => {
    setAuthModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/20 animate-pulse">
          <Shield className="w-8 h-8 text-slate-950" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-400">Verifying Vault Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
        onOpenCopilot={() => handleNavigate('copilot')}
      />

      <main className="flex-1">
        {currentView === 'home' && (
          <HomePage
            onOpenAuth={handleOpenAuth}
            onNavigateToDashboard={() => handleNavigate('documents')}
            isAuthenticated={!!user}
            username={user?.username}
          />
        )}

        {currentView === 'documents' && (
          user ? (
            <DashboardPage />
          ) : (
            <AuthPage initialMode="login" />
          )
        )}

        {currentView === 'copilot' && (
          user ? (
            <VaultCopilotPage onBack={() => handleNavigate('documents')} />
          ) : (
            <AuthPage initialMode="login" />
          )
        )}

        {currentView === 'admin-audit' && (
          user && isAdmin ? <AdminAuditPage /> : <DashboardPage />
        )}
      </main>

      {/* Auth Modal when triggered from HomePage or guest navigation */}
      {authModalOpen && !user && (
        <AuthPage
          initialMode={authMode}
          isModal={true}
          onClose={handleCloseAuth}
        />
      )}

      {/* Modal fallback if triggered directly with document context */}
      {user && globalCopilotOpen && (
        <VaultCopilotModal
          isOpen={globalCopilotOpen}
          isModal={true}
          onClose={() => setGlobalCopilotOpen(false)}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

