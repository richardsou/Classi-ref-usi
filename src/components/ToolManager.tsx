import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, orderBy, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Tool, ToolTransaction, ToolTransactionType, ToolTransactionReason, MachineType, UserProfile, ProductionLine } from '../types';
import { Wrench, Plus, ArrowRightLeft, Search, AlertCircle, Loader2, ArrowDown, ArrowUp, RotateCcw, Edit2, Trash2, Camera, X, LayoutDashboard } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firebase';
import { ToolDashboard } from './ToolDashboard';

interface ToolManagerProps {
  currentUser: { uid: string; name: string; email: string };
  permissions: any;
  isAdmin: boolean;
}

export const ToolManager: React.FC<ToolManagerProps> = ({ currentUser, permissions, isAdmin }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [transactions, setTransactions] = useState<ToolTransaction[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions' | 'dashboard'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showAddTool, setShowAddTool] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolToDelete, setToolToDelete] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<ToolTransaction | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<ToolTransaction | null>(null);
  const [transactionType, setTransactionType] = useState<ToolTransactionType>('Saída');

  // Add/Edit Tool Form
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [newToolCode, setNewToolCode] = useState('');
  const [newToolName, setNewToolName] = useState('');
  const [newToolMachine, setNewToolMachine] = useState<MachineType>('Torno');
  const [newToolStock, setNewToolStock] = useState(0);
  const [newToolImage, setNewToolImage] = useState<string>('');

  // Transaction Form
  const [transReason, setTransReason] = useState<ToolTransactionReason>('Em uso');
  const [transQuantity, setTransQuantity] = useState(1);
  const [transLine, setTransLine] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubTools = onSnapshot(collection(db, 'tools'), (snapshot) => {
      const t: Tool[] = [];
      snapshot.forEach(doc => t.push({ id: doc.id, ...doc.data() } as Tool));
      setTools(t);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tools'));

    const qTrans = query(collection(db, 'tool_transactions'), orderBy('createdAt', 'desc'));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const tr: ToolTransaction[] = [];
      snapshot.forEach(doc => tr.push({ id: doc.id, ...doc.data() } as ToolTransaction));
      setTransactions(tr);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tool_transactions'));

    const qLines = query(collection(db, 'production_lines'), orderBy('name', 'asc'));
    const unsubLines = onSnapshot(qLines, (snapshot) => {
      const l: ProductionLine[] = [];
      snapshot.forEach(doc => l.push({ id: doc.id, ...doc.data() } as ProductionLine));
      setLines(l);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'production_lines'));

    return () => {
      unsubTools();
      unsubTrans();
      unsubLines();
    };
  }, []);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedBase64 = await compressImage(file);
      setNewToolImage(compressedBase64);
    } catch (error) {
      console.error("Error compressing image", error);
      alert("Erro ao processar a imagem.");
    }
  };

  const resetToolForm = () => {
    setEditingToolId(null);
    setNewToolCode('');
    setNewToolName('');
    setNewToolMachine('Torno');
    setNewToolStock(0);
    setNewToolImage('');
  };

  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToolCode || !newToolName) return;
    setIsSubmitting(true);
    try {
      const toolData = {
        code: newToolCode,
        name: newToolName,
        machineType: newToolMachine,
        imageUrl: newToolImage
      };

      if (editingToolId) {
        await updateDoc(doc(db, 'tools', editingToolId), toolData);
      } else {
        const toolRef = await addDoc(collection(db, 'tools'), {
          ...toolData,
          stock: newToolStock,
          inUse: 0
        });

        if (newToolStock > 0) {
          await addDoc(collection(db, 'tool_transactions'), {
            toolId: toolRef.id,
            toolName: newToolName,
            type: 'Entrada',
            reason: 'Nova Entrada',
            quantity: newToolStock,
            createdAt: serverTimestamp(),
            createdBy: currentUser
          });
        }
      }

      setShowAddTool(false);
      resetToolForm();
    } catch (error) {
      handleFirestoreError(error, editingToolId ? OperationType.UPDATE : OperationType.CREATE, 'tools');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditTool = (tool: Tool) => {
    setEditingToolId(tool.id);
    setNewToolCode(tool.code);
    setNewToolName(tool.name);
    setNewToolMachine(tool.machineType);
    setNewToolStock(tool.stock);
    setNewToolImage(tool.imageUrl || '');
    setShowAddTool(true);
  };

  const confirmDeleteTool = async () => {
    if (!toolToDelete) return;
    try {
      // Delete the tool
      await deleteDoc(doc(db, 'tools', toolToDelete));
      
      // Delete all associated transactions
      const qTrans = query(collection(db, 'tool_transactions'), where('toolId', '==', toolToDelete));
      const transSnapshot = await getDocs(qTrans);
      
      if (!transSnapshot.empty) {
        const batch = writeBatch(db);
        transSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      
      setToolToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tools/${toolToDelete}`);
    }
  };

  const handleDeleteTool = (id: string) => {
    setToolToDelete(id);
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool || transQuantity <= 0) return;
    if (transactionType === 'Saída' && !transLine) return;

    setIsSubmitting(true);
    try {
      let tempStock = selectedTool.stock;
      let tempInUse = selectedTool.inUse;

      if (transactionToEdit) {
        // Revert old transaction
        const oldQty = transactionToEdit.quantity;
        const isOldReplacement = ['Colisão', 'Desgaste', 'Quebra'].includes(transactionToEdit.reason) && transactionToEdit.type === 'Saída';

        if (transactionToEdit.type === 'Saída') {
          tempStock += oldQty;
          if (!isOldReplacement) {
            tempInUse -= oldQty;
          }
        } else if (transactionToEdit.type === 'Retorno') {
          tempInUse += oldQty;
          if (transactionToEdit.reason === 'Retorno Almoxarifado') {
            tempStock -= oldQty;
          }
        } else if (transactionToEdit.type === 'Entrada') {
          tempStock -= oldQty;
        }
      }

      // Apply new transaction
      if (transactionType === 'Saída') {
        const isReplacement = ['Colisão', 'Desgaste', 'Quebra'].includes(transReason);

        if (tempStock < transQuantity) {
          alert('Estoque insuficiente!');
          setIsSubmitting(false);
          return;
        }
        tempStock -= transQuantity;
        if (!isReplacement) {
          tempInUse += transQuantity;
        }
      } else if (transactionType === 'Retorno') {
        if (tempInUse < transQuantity) {
          alert('Quantidade em uso insuficiente para retorno!');
          setIsSubmitting(false);
          return;
        }
        tempInUse -= transQuantity;
        if (transReason === 'Retorno Almoxarifado') {
          tempStock += transQuantity;
        }
      } else if (transactionType === 'Entrada') {
        tempStock += transQuantity;
      }

      tempStock = Math.max(0, tempStock);
      tempInUse = Math.max(0, tempInUse);

      await updateDoc(doc(db, 'tools', selectedTool.id), {
        stock: tempStock,
        inUse: tempInUse
      });

      if (transactionToEdit) {
        await updateDoc(doc(db, 'tool_transactions', transactionToEdit.id), {
          type: transactionType,
          reason: transReason,
          line: transLine || null,
          quantity: transQuantity,
        });
      } else {
        await addDoc(collection(db, 'tool_transactions'), {
          toolId: selectedTool.id,
          toolName: selectedTool.name,
          type: transactionType,
          reason: transReason,
          line: transLine || null,
          quantity: transQuantity,
          createdAt: serverTimestamp(),
          createdBy: currentUser
        });
        
        // Se for substituição na saída, registra automaticamente o retorno (descarte)
        if (transactionType === 'Saída' && ['Colisão', 'Desgaste', 'Quebra'].includes(transReason)) {
          let discardReason: ToolTransactionReason = 'Desgaste';
          if (transReason === 'Colisão') discardReason = 'Colisão';
          else if (transReason === 'Quebra') discardReason = 'Quebra';
          
          await addDoc(collection(db, 'tool_transactions'), {
            toolId: selectedTool.id,
            toolName: selectedTool.name,
            type: 'Retorno',
            reason: discardReason,
            line: transLine || null,
            quantity: transQuantity,
            createdAt: serverTimestamp(),
            createdBy: currentUser,
            isAutoGenerated: true
          });
        }
      }

      setShowTransaction(false);
      setTransactionToEdit(null);
      setTransQuantity(1);
      setTransLine('');
    } catch (error) {
      handleFirestoreError(error, transactionToEdit ? OperationType.UPDATE : OperationType.WRITE, 'tool_transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTransactionModal = (tool: Tool, type: ToolTransactionType) => {
    setSelectedTool(tool);
    setTransactionToEdit(null);
    setTransactionType(type);
    if (type === 'Saída') setTransReason('Em uso');
    else if (type === 'Retorno') setTransReason('Retorno Almoxarifado');
    else setTransReason('Nova Entrada');
    setShowTransaction(true);
  };

  const openEditTransaction = (t: ToolTransaction) => {
    const tool = tools.find(tool => tool.id === t.toolId);
    if (!tool) return;
    setSelectedTool(tool);
    setTransactionToEdit(t);
    setTransactionType(t.type);
    setTransReason(t.reason);
    setTransLine(t.line || '');
    setTransQuantity(t.quantity);
    setShowTransaction(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    try {
      const tool = tools.find(t => t.id === transactionToDelete.toolId);
      if (tool) {
        let newStock = tool.stock;
        let newInUse = tool.inUse;
        const qty = transactionToDelete.quantity;
        const isReplacement = ['Colisão', 'Desgaste', 'Quebra'].includes(transactionToDelete.reason) && transactionToDelete.type === 'Saída';

        if (transactionToDelete.type === 'Saída') {
          newStock += qty;
          if (!isReplacement) {
            newInUse -= qty;
          }
        } else if (transactionToDelete.type === 'Retorno') {
          newInUse += qty;
          if (transactionToDelete.reason === 'Retorno Almoxarifado') {
            newStock -= qty;
          }
        } else if (transactionToDelete.type === 'Entrada') {
          newStock -= qty;
        }

        newStock = Math.max(0, newStock);
        newInUse = Math.max(0, newInUse);

        await updateDoc(doc(db, 'tools', tool.id), {
          stock: newStock,
          inUse: newInUse
        });
      }

      await deleteDoc(doc(db, 'tool_transactions', transactionToDelete.id));
      setTransactionToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tool_transactions/${transactionToDelete.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" />
            Gestão de Ferramentas
          </h2>
          <p className="text-gray-500">Controle de entrada, saída e retorno de ferramentas de usinagem.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'inventory' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Ferramentas
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Movimentações
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Dashboard
          </button>
        </div>
      </div>

      {activeTab === 'inventory' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={() => { resetToolForm(); setShowAddTool(true); }}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Nova Ferramenta
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.code.toLowerCase().includes(searchTerm.toLowerCase())).map(tool => (
              <div key={tool.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    {tool.imageUrl && (
                      <img src={tool.imageUrl} alt={tool.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg mb-2 inline-block">
                        {tool.machineType}
                      </span>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">{tool.name}</h3>
                      <p className="text-sm text-gray-500">Cód: {tool.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => openEditTool(tool)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteTool(tool.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-3 rounded-xl text-center">
                    <p className="text-xs text-gray-500 font-medium mb-1">Em Estoque</p>
                    <p className="text-2xl font-black text-gray-900">{tool.stock}</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-xl text-center">
                    <p className="text-xs text-orange-600 font-medium mb-1">Em Uso</p>
                    <p className="text-2xl font-black text-orange-700">{tool.inUse}</p>
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openTransactionModal(tool, 'Entrada')}
                    className="flex flex-col items-center justify-center p-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors"
                    title="Entrada de Estoque"
                  >
                    <ArrowDown className="w-4 h-4 mb-1" />
                    <span className="text-xs font-bold">Entrada</span>
                  </button>
                  <button
                    onClick={() => openTransactionModal(tool, 'Saída')}
                    disabled={tool.stock <= 0}
                    className="flex flex-col items-center justify-center p-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
                    title="Enviar para Linha"
                  >
                    <ArrowUp className="w-4 h-4 mb-1" />
                    <span className="text-xs font-bold">Saída</span>
                  </button>
                  <button
                    onClick={() => openTransactionModal(tool, 'Retorno')}
                    disabled={tool.inUse <= 0}
                    className="flex flex-col items-center justify-center p-2 bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 transition-colors disabled:opacity-50"
                    title="Retornar da Linha"
                  >
                    <RotateCcw className="w-4 h-4 mb-1" />
                    <span className="text-xs font-bold">Retorno</span>
                  </button>
                </div>
              </div>
            ))}
            {tools.length === 0 && (
              <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
                <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhuma ferramenta cadastrada.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'transactions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-4 text-sm font-semibold text-gray-600">Data</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Ferramenta</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Tipo</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Motivo</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Qtd</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Linha</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Usuário</th>
                  <th className="p-4 text-sm font-semibold text-gray-600 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-sm text-gray-600">
                      {t.createdAt?.toDate().toLocaleString('pt-BR')}
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-900">
                      {t.toolName}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        t.type === 'Entrada' ? 'bg-green-100 text-green-800' :
                        t.type === 'Saída' ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{t.reason}</td>
                    <td className="p-4 text-sm font-bold text-gray-900">{t.quantity}</td>
                    <td className="p-4 text-sm text-gray-600">{t.line || '-'}</td>
                    <td className="p-4 text-sm text-gray-600">{t.createdBy.name}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditTransaction(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setTransactionToDelete(t)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      Nenhuma movimentação registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'dashboard' && (
        <ToolDashboard tools={tools} transactions={transactions} lines={lines} />
      )}

      {/* Add/Edit Tool Modal */}
      {showAddTool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">{editingToolId ? 'Editar Ferramenta' : 'Nova Ferramenta'}</h3>
              <button onClick={() => setShowAddTool(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTool} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto da Ferramenta</label>
                <div className="flex items-center gap-4">
                  {newToolImage ? (
                    <div className="relative">
                      <img src={newToolImage} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                      <button type="button" onClick={() => setNewToolImage('')} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                      <Camera className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-500 font-medium">Adicionar</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input type="text" required value={newToolCode} onChange={e => setNewToolCode(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome/Descrição</label>
                <input type="text" required value={newToolName} onChange={e => setNewToolName(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Máquina</label>
                <select value={newToolMachine} onChange={e => setNewToolMachine(e.target.value as MachineType)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Torno">Torno</option>
                  <option value="Centro de Usinagem">Centro de Usinagem</option>
                  <option value="Furação">Furação</option>
                </select>
              </div>
              {!editingToolId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                  <input type="number" min="0" required value={newToolStock} onChange={e => setNewToolStock(Number(e.target.value))} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowAddTool(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransaction && selectedTool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {transactionToEdit ? 'Editar Movimentação' : `${transactionType} de Ferramenta`}
            </h3>
            <p className="text-gray-500 text-sm mb-6">{selectedTool.name} (Cód: {selectedTool.code})</p>
            
            <form onSubmit={handleTransaction} className="space-y-4">
              {transactionToEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimentação</label>
                  <select value={transactionType} onChange={e => {
                    const type = e.target.value as ToolTransactionType;
                    setTransactionType(type);
                    if (type === 'Saída') setTransReason('Em uso');
                    else if (type === 'Retorno') setTransReason('Retorno Almoxarifado');
                    else setTransReason('Nova Entrada');
                  }} className="w-full p-3 border border-gray-200 rounded-xl">
                    <option value="Entrada">Entrada</option>
                    <option value="Saída">Saída</option>
                    <option value="Retorno">Retorno</option>
                  </select>
                </div>
              )}

              {transactionType === 'Saída' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Saída</label>
                    <select value={transReason} onChange={e => setTransReason(e.target.value as ToolTransactionReason)} className="w-full p-3 border border-gray-200 rounded-xl">
                      <option value="Em uso">Em uso (Setup/Troca normal)</option>
                      <option value="Colisão">Substituição por Colisão</option>
                      <option value="Desgaste">Substituição por Desgaste</option>
                      <option value="Quebra">Substituição por Quebra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Linha de Destino</label>
                    <select required value={transLine} onChange={e => setTransLine(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl">
                      <option value="">Selecione a linha...</option>
                      {lines.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {transactionType === 'Retorno' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Retorno</label>
                    <select value={transReason} onChange={e => setTransReason(e.target.value as ToolTransactionReason)} className="w-full p-3 border border-gray-200 rounded-xl">
                      <option value="Retorno Almoxarifado">Retorno ao Almoxarifado (Boa)</option>
                      <option value="Desgaste">Descarte por Desgaste</option>
                      <option value="Quebra">Descarte por Quebra</option>
                      <option value="Colisão">Descarte por Colisão</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Linha de Origem (Opcional)</label>
                    <select value={transLine} onChange={e => setTransLine(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl">
                      <option value="">Selecione a linha...</option>
                      {lines.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input type="number" min="1" required value={transQuantity} onChange={e => setTransQuantity(Number(e.target.value))} className="w-full p-3 border border-gray-200 rounded-xl" />
                {transactionType === 'Saída' && <p className="text-xs text-gray-500 mt-1">Disponível em estoque (antes da edição): {selectedTool.stock + (transactionToEdit?.type === 'Saída' ? transactionToEdit.quantity : 0)}</p>}
                {transactionType === 'Retorno' && <p className="text-xs text-gray-500 mt-1">Em uso atualmente (antes da edição): {selectedTool.inUse + (transactionToEdit?.type === 'Retorno' ? transactionToEdit.quantity : 0)}</p>}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => { setShowTransaction(false); setTransactionToEdit(null); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {toolToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
              <p className="text-gray-600 mb-6">Tem certeza que deseja excluir esta ferramenta? Todos os dados e histórico de movimentações associados a ela também serão excluídos permanentemente.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setToolToDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteTool}
                  className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Delete Transaction Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
              <p className="text-gray-600 mb-6">Tem certeza que deseja excluir esta movimentação? O estoque da ferramenta será ajustado automaticamente.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setTransactionToDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteTransaction}
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
