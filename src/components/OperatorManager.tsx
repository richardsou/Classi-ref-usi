import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, handleFirestoreError, OperationType, doc, updateDoc, deleteDoc, writeBatch, setDoc } from '../firebase';
import { Operator, UserPermissions } from '../types';
import { Users, Plus, Search, Trash2, Edit2, Save, X, Download, Upload, FileSpreadsheet, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { MessageModal } from './MessageModal';

interface OperatorManagerProps {
  permissions: UserPermissions;
}

export const OperatorManager: React.FC<OperatorManagerProps> = ({ permissions }) => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [operatorToDelete, setOperatorToDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    id: '', // Matrícula
    name: '',
    function: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'operators'), orderBy('name', 'asc')), (snapshot) => {
      setOperators(snapshot.docs.map(doc => ({ ...doc.data() } as Operator)));
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'operators');
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.function) {
      setMessage({ type: 'error', text: 'Preencha todos os campos.' });
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        // Update
        const docRef = doc(db, 'operators', editingId);
        await updateDoc(docRef, {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        setMessage({ type: 'success', text: 'Operador atualizado com sucesso!' });
      } else {
        // Create
        // Check if ID already exists
        const exists = operators.some(o => o.id === formData.id);
        if (exists) {
          setMessage({ type: 'error', text: 'Esta matrícula já está cadastrada.' });
          setIsLoading(false);
          return;
        }

        await setDoc(doc(db, 'operators', formData.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        setMessage({ type: 'success', text: 'Operador cadastrado com sucesso!' });
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ id: '', name: '', function: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'operators');
      setMessage({ type: 'error', text: 'Erro ao salvar operador.' });
    } finally {
      setIsLoading(true); // Snapshot will set it back to false
    }
  };

  const confirmDelete = async () => {
    if (!operatorToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'operators', operatorToDelete));
      setMessage({ type: 'success', text: 'Operador excluído com sucesso!' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `operators/${operatorToDelete}`);
      setMessage({ type: 'error', text: 'Erro ao excluir operador.' });
    } finally {
      setOperatorToDelete(null);
    }
  };

  const handleDelete = (id: string) => {
    setOperatorToDelete(id);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setMessage({ type: 'error', text: 'A planilha está vazia.' });
          return;
        }

        // Validate headers
        const firstRow = data[0];
        if (!firstRow.Matricula || !firstRow.Nome || !firstRow.Funcao) {
          setMessage({ type: 'error', text: 'A planilha deve conter as colunas: Matricula, Nome, Funcao.' });
          return;
        }

        setIsLoading(true);
        const batch = writeBatch(db);
        
        data.forEach(row => {
          const id = String(row.Matricula).trim();
          if (id) {
            const docRef = doc(db, 'operators', id);
            batch.set(docRef, {
              id,
              name: String(row.Nome).trim(),
              function: String(row.Funcao).trim(),
              updatedAt: new Date().toISOString()
            });
          }
        });

        await batch.commit();
        setMessage({ type: 'success', text: `${data.length} operadores importados com sucesso!` });
      } catch (error) {
        console.error('Import error:', error);
        setMessage({ type: 'error', text: 'Erro ao processar planilha. Verifique o formato.' });
      } finally {
        setIsLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadExample = () => {
    const data = [
      { Matricula: '12345', Nome: 'João Silva', Funcao: 'Operador de Torno' },
      { Matricula: '67890', Nome: 'Maria Oliveira', Funcao: 'Ajustador' },
      { Matricula: '11223', Nome: 'Carlos Souza', Funcao: 'Líder de Produção' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Operadores");
    XLSX.writeFile(wb, "exemplo_importacao_operadores.xlsx");
  };

  const filteredOperators = operators.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.includes(searchTerm) ||
    o.function.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <MessageModal 
        isOpen={!!message}
        onClose={() => setMessage(null)}
        type={message?.type || 'success'}
        message={message?.text || ''}
      />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, matrícula ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadExample}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 text-gray-600 rounded-2xl hover:bg-gray-50 transition-all font-bold text-sm shadow-sm"
            title="Baixar Planilha de Exemplo"
          >
            <Download className="w-4 h-4" />
            Exemplo
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all font-bold text-sm shadow-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            Importar
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormData({ id: '', name: '', function: '' });
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-bold text-sm shadow-md shadow-blue-100"
          >
            <Plus className="w-4 h-4" />
            Novo Operador
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                {editingId ? 'Editar Operador' : 'Novo Operador'}
              </h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-50 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matrícula</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={!!editingId}
                  placeholder="Ex: 12345"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do operador"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Função</label>
                <input
                  type="text"
                  value={formData.function}
                  onChange={(e) => setFormData({ ...formData, function: e.target.value })}
                  placeholder="Ex: Operador I"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Salvar Alterações' : 'Cadastrar Operador'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operators List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Matrícula</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Função</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOperators.map((operator) => (
                <tr key={operator.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-tight">
                      {operator.id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{operator.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{operator.function}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingId(operator.id);
                          setFormData({ id: operator.id, name: operator.name, function: operator.function });
                          setIsAdding(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(operator.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOperators.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-12 h-12 text-gray-200" />
                      <p className="text-gray-400 font-bold">Nenhum operador encontrado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {operatorToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
              <p className="text-gray-600 mb-6">Tem certeza que deseja excluir este operador? Esta ação não pode ser desfeita.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setOperatorToDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
