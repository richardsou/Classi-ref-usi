import React, { useState } from 'react';
import { SHIFTS } from '../constants';
import { ScrapRecord, Shift, DefectType, DefectTypeConfig } from '../types';
import { PlusCircle, AlertCircle, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';
import { MessageModal } from './MessageModal';

interface ScrapFormProps {
  initialData?: ScrapRecord;
  defectTypes: DefectTypeConfig[];
  onSubmit: (data: {
    partName: string;
    defectType: DefectType;
    shift: Shift;
    quantity: number;
    date: string;
    notes: string;
  }) => Promise<void>;
  onCancel?: () => void;
}

export const ScrapForm: React.FC<ScrapFormProps> = ({ onSubmit, initialData, onCancel, defectTypes }) => {
  const [partName, setPartName] = useState(initialData?.partName || '');
  const [defectType, setDefectType] = useState<DefectType>(
    initialData?.defectType || (defectTypes.length > 0 ? defectTypes[0].name : '')
  );
  const [shift, setShift] = useState<Shift>(initialData?.shift || 'Turno 1');
  const [quantity, setQuantity] = useState(initialData?.quantity || 1);
  const [date, setDate] = useState(
    initialData?.timestamp 
      ? initialData.timestamp.toDate().toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName || quantity <= 0) {
      setError('Por favor, informe o nome da peça.');
      return;
    }

    if (partName.length < 6) {
      setError('O nome da peça deve ter no mínimo 6 dígitos.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        partName,
        defectType,
        shift,
        quantity,
        date,
        notes
      });
      // Reset form
      setPartName('');
      setQuantity(1);
      setNotes('');
    } catch (err) {
      setError('Erro ao salvar registro. Verifique sua conexão ou permissões.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {initialData ? <Edit2 className="w-6 h-6 text-blue-600" /> : <PlusCircle className="w-6 h-6 text-blue-600" />}
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Editar Registro' : 'Novo Registro de Refugo'}
          </h2>
        </div>
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100 transition-all"
          >
            Cancelar
          </button>
        )}
      </div>

      <MessageModal 
        isOpen={!!error}
        onClose={() => setError(null)}
        type="error"
        message={error || ''}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Data do Registro *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nome da Peça *</label>
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Ex: 12345 ou Bloco"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tipo de Defeito</label>
            <select
              value={defectType}
              onChange={(e) => setDefectType(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            >
              {defectTypes.map(type => (
                <option key={type.id} value={type.name}>{type.name}</option>
              ))}
              {defectTypes.length === 0 && (
                <option value="">Nenhum defeito cadastrado</option>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Turno</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as Shift)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            >
              {SHIFTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Quantidade *</label>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(Math.floor(parseInt(e.target.value) || 0))}
                onFocus={(e) => e.target.select()}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-center"
                required
              />
              <button 
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-24 resize-none"
            placeholder="Detalhes adicionais..."
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
        >
          {isSubmitting ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Registrar Refugo'}
        </button>
      </form>
    </motion.div>
  );
};
