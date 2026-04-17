import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning';
  title?: string;
  message: string;
}

export const MessageModal: React.FC<MessageModalProps> = ({ 
  isOpen, 
  onClose, 
  type, 
  title, 
  message 
}) => {
  const config = {
    success: {
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      btn: 'bg-emerald-600 hover:bg-emerald-700',
      defaultTitle: 'Sucesso!'
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
      btn: 'bg-red-600 hover:bg-red-700',
      defaultTitle: 'Atenção'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      btn: 'bg-amber-600 hover:bg-amber-700',
      defaultTitle: 'Aviso'
    }
  };

  const { icon: Icon, color, bg, border, btn, defaultTitle } = config[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100"
          >
            <div className="p-8 text-center space-y-4">
              <div className={cn("w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg", bg)}>
                <Icon className={cn("w-8 h-8", color)} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  {title || defaultTitle}
                </h3>
                <p className="text-sm font-bold text-gray-500 leading-relaxed">
                  {message}
                </p>
              </div>

              <button
                onClick={onClose}
                className={cn(
                  "w-full py-4 rounded-2xl text-white font-black text-sm shadow-lg transition-all active:scale-95",
                  btn
                )}
              >
                Entendido
              </button>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
