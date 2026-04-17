import React, { useState } from 'react';
import { DefectTypeConfig } from '../types';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { Settings, Plus, Trash2, Edit2, X, Check, GripVertical, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SUGGESTED_COLORS } from '../constants';

interface DefectManagerProps {
  defectTypes: DefectTypeConfig[];
}

export const DefectManager: React.FC<DefectManagerProps> = ({ defectTypes }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [isLoading, setIsLoading] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<string | null>(null);

  const getSuggestedColor = () => {
    const usedColors = new Set(defectTypes.map(t => t.color.toLowerCase()));
    const availableColor = SUGGESTED_COLORS.find(c => !usedColors.has(c.toLowerCase()));
    return availableColor || SUGGESTED_COLORS[Math.floor(Math.random() * SUGGESTED_COLORS.length)];
  };

  const handleStartAdding = () => {
    setNewColor(getSuggestedColor());
    setIsAdding(true);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'defect_types'), {
        name: newName.trim(),
        color: newColor,
        order: defectTypes.length,
        createdAt: serverTimestamp()
      });
      setNewName('');
      setNewColor(getSuggestedColor());
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'defect_types');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (id: string, name: string, color: string) => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'defect_types', id), {
        name: name.trim(),
        color: color,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `defect_types/${id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!typeToDelete) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'defect_types', typeToDelete));
      setTypeToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `defect_types/${typeToDelete}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Gerenciar Defeitos</h2>
          </div>
          <button
            onClick={handleStartAdding}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-bold text-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Novo Defeito
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            <AnimatePresence>
              {isAdding && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
                >
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent flex-shrink-0"
                    />
                    <input
                      type="text"
                      placeholder="Nome do defeito"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={isLoading}
                      className="flex-1 sm:flex-none p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsAdding(false)}
                      className="flex-1 sm:flex-none p-2 bg-white text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {defectTypes.map((type) => (
              <div 
                key={type.id}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 group"
              >
                <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />
                
                {editingId === type.id ? (
                  <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1 flex items-center gap-3">
                      <input
                        type="color"
                        defaultValue={type.color}
                        id={`color-${type.id}`}
                        className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent flex-shrink-0"
                      />
                      <input
                        type="text"
                        defaultValue={type.name}
                        id={`name-${type.id}`}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          const name = (document.getElementById(`name-${type.id}`) as HTMLInputElement).value;
                          const color = (document.getElementById(`color-${type.id}`) as HTMLInputElement).value;
                          handleUpdate(type.id, name, color);
                        }}
                        disabled={isLoading}
                        className="flex-1 sm:flex-none p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 sm:flex-none p-2 bg-white text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="w-6 h-6 rounded-full shadow-inner flex-shrink-0" 
                      style={{ backgroundColor: type.color }} 
                    />
                    <span className="flex-1 font-medium text-gray-700 truncate">{type.name}</span>
                    <div className="flex items-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingId(type.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTypeToDelete(type.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {defectTypes.length === 0 && !isAdding && (
              <div className="text-center py-12 text-gray-500 italic">
                Nenhum tipo de defeito cadastrado.
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {typeToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Defeito?</h3>
                <p className="text-gray-500 mb-6">
                  Você tem certeza que deseja excluir este tipo de defeito? Registros existentes que usam este defeito ainda o exibirão, mas ele não estará disponível para novos registros.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTypeToDelete(null)}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50"
                  >
                    {isLoading ? 'Excluindo...' : 'Sim, Excluir'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
