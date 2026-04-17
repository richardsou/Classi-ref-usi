import React from 'react';
import { Factory } from 'lucide-react';
import { motion } from 'motion/react';

interface LoadingProps {
  appName?: string;
  logoUrl?: string;
  logoHeight?: number;
}

export const Loading: React.FC<LoadingProps> = ({ appName = 'Classificação de Refugo', logoUrl, logoHeight = 64 }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="flex flex-col items-center text-center">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="mb-6"
        >
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-auto object-contain"
              style={{ height: logoHeight }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
              <Factory className="w-10 h-10 text-white" />
            </div>
          )}
        </motion.div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Carregando {appName}</h2>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-0" />
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150" />
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-300" />
        </div>
      </div>
    </div>
  );
};
