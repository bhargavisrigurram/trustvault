import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { Shield } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState<'documents' | 'admin-audit'>('documents');

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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar currentView="documents" onNavigate={() => {}} />
        <AuthPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'admin-audit' && !isAdmin) return;
          setCurrentView(view);
        }}
      />
      <main className="flex-1">
        {currentView === 'admin-audit' && isAdmin ? <AdminAuditPage /> : <DashboardPage />}
      </main>
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
