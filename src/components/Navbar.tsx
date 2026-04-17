import React from 'react';
import { Menu, Factory, User, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
  userEmail: string | null;
  appName?: string;
  logoUrl?: string;
  logoHeight?: number;
  isOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onMenuClick, userEmail, appName = 'Classificação de Refugo', logoUrl, logoHeight = 24, isOnline = true 
}) => {
  return (
    <div className="lg:hidden bg-white border-b border-gray-100 p-4 sticky top-0 z-50 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-auto object-contain"
              style={{ height: logoHeight }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Factory className="w-4 h-4 text-white" />
            </div>
          )}
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">{appName}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isOnline && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 animate-pulse">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Offline</span>
          </div>
        )}
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
};
