import React from 'react';
import { LayoutDashboard, PlusCircle, Table, LogOut, Settings, Factory, Cog, FileSpreadsheet, Wifi, WifiOff, Package, ShieldCheck, BarChart3, ListFilter, Lightbulb, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';

import { UserPermissions } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'form' | 'list' | 'reports' | 'inserts' | 'defects' | 'settings' | 'manager' | 'insertDashboard' | 'improvements' | 'tools';
  setActiveTab: (tab: 'dashboard' | 'form' | 'list' | 'reports' | 'inserts' | 'defects' | 'settings' | 'manager' | 'insertDashboard' | 'improvements' | 'tools') => void;
  onLogout: () => void;
  userEmail: string | null;
  appName?: string;
  logoUrl?: string;
  logoHeight?: number;
  userRole?: 'admin' | 'operator' | 'viewer' | 'custom';
  permissions: UserPermissions;
  isOnline?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, setActiveTab, onLogout, userEmail, appName = 'Classificação de Refugo', logoUrl, logoHeight = 32, userRole = 'viewer', permissions, isOnline = true
}) => {
  const isAdmin = userRole === 'admin' || userEmail === 'jamaicamo94@gmail.com';
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Refugo', icon: <LayoutDashboard className="w-5 h-5" />, visible: isAdmin || permissions.dashboard },
    { id: 'insertDashboard', label: 'Dashboard Inserto', icon: <BarChart3 className="w-5 h-5" />, visible: isAdmin || permissions.inserts },
    { id: 'form', label: 'Novo Registro', icon: <PlusCircle className="w-5 h-5" />, visible: isAdmin || permissions.registration },
    { id: 'inserts', label: 'Almoxarifado', icon: <Package className="w-5 h-5" />, visible: isAdmin || permissions.warehouse },
    { id: 'tools', label: 'Ferramentas', icon: <Wrench className="w-5 h-5" />, visible: isAdmin || permissions.toolManagement },
    { id: 'improvements', label: 'Melhorias', icon: <Lightbulb className="w-5 h-5" />, visible: isAdmin || permissions.improvements },
    { id: 'settings', label: 'Configurações', icon: <Cog className="w-5 h-5" />, visible: isAdmin || permissions.settings },
    { id: 'manager', label: 'Painel do Gestor', icon: <ShieldCheck className="w-5 h-5" />, visible: isAdmin || permissions.warehouse || permissions.history || permissions.reports || permissions.categories || permissions.manageUsers || permissions.settings || permissions.insertEntries || permissions.insertWithdraw || permissions.insertHistory || permissions.insertReports || permissions.insertModels || permissions.insertLines || permissions.insertCorrection || permissions.improvements || permissions.toolManagement },
  ].filter(item => item.visible);

  return (
    <div className="w-64 bg-white border-r border-slate-200/60 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="Logo" 
            className="w-auto object-contain"
            style={{ height: logoHeight }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-100">
            <Factory className="w-5 h-5 text-white" />
          </div>
        )}
        <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">{appName}</h1>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-[13px] font-semibold group",
              activeTab === item.id 
                ? "bg-blue-50/50 text-blue-600 shadow-sm border border-blue-100/50" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <span className={cn(
              "transition-colors",
              activeTab === item.id ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
            )}>
              {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: "w-4 h-4" })}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <div className="px-4 py-3 bg-slate-50/80 rounded-2xl border border-slate-100 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sessão Ativa</span>
            {isOnline ? (
              <div className="flex items-center gap-1 text-emerald-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-500">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[9px] font-black uppercase">Offline</span>
              </div>
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-700 truncate">{userEmail || 'Visitante'}</p>
        </div>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50/50 transition-all text-[13px] font-semibold group"
        >
          <LogOut className="w-4 h-4 transition-colors group-hover:text-red-500" />
          Sair do Sistema
        </button>
      </div>
    </div>
  );
};
