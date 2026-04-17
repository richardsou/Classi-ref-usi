import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MobileMenu } from './MobileMenu';
import { ShieldCheck } from 'lucide-react';

import { UserPermissions } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'form' | 'list' | 'reports' | 'inserts' | 'defects' | 'settings' | 'manager' | 'insertDashboard' | 'improvements' | 'tools';
  setActiveTab: (tab: 'dashboard' | 'form' | 'list' | 'reports' | 'inserts' | 'defects' | 'settings' | 'manager' | 'insertDashboard' | 'improvements' | 'tools') => void;
  onLogout: () => void;
  userEmail: string | null;
  appName?: string;
  logoUrl?: string;
  logoHeight?: number;
  userRole?: 'admin' | 'operator' | 'viewer' | 'custom';
  permissions: UserPermissions;
  isOnline: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, activeTab, setActiveTab, onLogout, userEmail, appName, logoUrl, logoHeight, userRole, permissions, isOnline
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isTabAllowed = (tab: string): boolean => {
    const isAdmin = userRole === 'admin' || userEmail === 'jamaicamo94@gmail.com';
    
    if (isAdmin) return true;

    switch (tab) {
      case 'dashboard': return permissions.dashboard;
      case 'insertDashboard': return permissions.inserts;
      case 'form': return permissions.registration;
      case 'list': return permissions.history;
      case 'reports': return permissions.reports;
      case 'inserts': return permissions.warehouse;
      case 'defects': return permissions.categories;
      case 'settings': return permissions.settings;
      case 'improvements': return permissions.improvements;
      case 'tools': return permissions.toolManagement;
      case 'manager': return permissions.warehouse || permissions.history || permissions.reports || permissions.categories || permissions.manageUsers || permissions.settings || 
                             permissions.insertEntries || permissions.insertWithdraw || permissions.insertHistory || permissions.insertReports || permissions.insertModels || permissions.insertLines || permissions.insertCorrection || permissions.improvements || permissions.toolManagement;
      default: return true;
    }
  };

  const hasAccess = isTabAllowed(activeTab);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <div className="hidden lg:block">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={onLogout}
          userEmail={userEmail}
          appName={appName}
          logoUrl={logoUrl}
          logoHeight={logoHeight}
          userRole={userRole}
          permissions={permissions}
          isOnline={isOnline}
        />
      </div>

      <Navbar 
        onMenuClick={() => setIsMobileMenuOpen(true)} 
        userEmail={userEmail}
        appName={appName}
        logoUrl={logoUrl}
        logoHeight={logoHeight}
        isOnline={isOnline}
      />

      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
        userEmail={userEmail}
        appName={appName}
        logoUrl={logoUrl}
        logoHeight={logoHeight}
        userRole={userRole}
        permissions={permissions}
      />

      <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-h-screen">
        <div className="max-w-7xl mx-auto">
          {hasAccess ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="p-4 bg-red-50 rounded-full mb-6">
                <ShieldCheck className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Acesso Negado</h2>
              <p className="text-gray-500 font-medium max-w-md mb-8">
                Você não tem permissão para acessar esta área. Entre em contato com o administrador se acreditar que isso é um erro.
              </p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
              >
                Voltar ao Início
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
