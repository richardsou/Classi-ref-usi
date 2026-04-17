import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, handleFirestoreError, OperationType, doc, updateDoc, setDoc, getDoc, deleteDoc, auth } from '../firebase';
import { Insert, InsertTransaction, InsertStock, UserPermissions, ProductionLine, AppSettings, Operator, Shift, UserProfile } from '../types';
import { Package, Plus, Minus, History, Search, AlertTriangle, Factory, Filter, Trash2, Edit2, Save, X, ChevronDown, ChevronUp, Settings2, CheckCircle2, AlertCircle, Box, Cpu, Layers, Component, Wrench, Hammer, Cog, UserCheck, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { MessageModal } from './MessageModal';

interface InsertManagerProps {
  permissions: UserPermissions;
  userProfile: UserProfile | null;
  operatorName?: string;
  operatorId?: string;
  onRegisterOperator?: () => void;
}

export const InsertManager: React.FC<InsertManagerProps> = ({ 
  permissions, 
  userProfile,
  operatorName = '', 
  operatorId = '',
  onRegisterOperator
}) => {
  const [inserts, setInserts] = useState<Insert[]>([]);
  const [transactions, setTransactions] = useState<InsertTransaction[]>([]);
  const [stocks, setStocks] = useState<InsertStock[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'stock' | 'withdraw'>(permissions.insertWithdraw ? 'withdraw' : 'stock');
  
  // Form states
  const [isMovingStock, setIsMovingStock] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [stockMovement, setStockMovement] = useState({
    insertId: '',
    type: 'exit' as 'exit',
    quantity: 1,
    line: '',
    operatorId: operatorId || '' // Matrícula
  });

  useEffect(() => {
    if (operatorId) {
      setStockMovement(prev => ({ ...prev, operatorId }));
    }
  }, [operatorId]);

  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const MODEL_ICONS = [Package, Box, Cpu, Layers, Component, Wrench, Hammer, Cog];
  
  const getModelIcon = (id: string) => {
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % MODEL_ICONS.length;
    return MODEL_ICONS[index];
  };

  const LINE_COLORS = [
    { name: 'Azul', class: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Esmeralda', class: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-50' },
    { name: 'Âmbar', class: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-50' },
    { name: 'Rosa', class: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-50' },
    { name: 'Índigo', class: 'bg-indigo-500', text: 'text-indigo-500', bg: 'bg-indigo-50' },
    { name: 'Laranja', class: 'bg-orange-500', text: 'text-orange-500', bg: 'bg-orange-50' },
    { name: 'Ciano', class: 'bg-cyan-500', text: 'text-cyan-500', bg: 'bg-cyan-50' },
    { name: 'Violeta', class: 'bg-violet-500', text: 'text-violet-500', bg: 'bg-violet-50' },
    { name: 'Fúcsia', class: 'bg-fuchsia-500', text: 'text-fuchsia-500', bg: 'bg-fuchsia-50' },
    { name: 'Lima', class: 'bg-lime-500', text: 'text-lime-500', bg: 'bg-lime-50' },
  ];

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const unsubInserts = onSnapshot(query(collection(db, 'inserts'), orderBy('code', 'asc')), (snapshot) => {
      setInserts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insert)));
    });

    const unsubTransactions = onSnapshot(query(collection(db, 'insert_transactions'), orderBy('timestamp', 'desc')), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InsertTransaction)));
    });

    const unsubStocks = onSnapshot(collection(db, 'insert_stocks'), (snapshot) => {
      setStocks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InsertStock)));
      setIsLoading(false);
    });

    const unsubLines = onSnapshot(query(collection(db, 'production_lines'), orderBy('name', 'asc')), (snapshot) => {
      setProductionLines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionLine)));
    });

    const unsubOperators = onSnapshot(query(collection(db, 'operators'), orderBy('name', 'asc')), (snapshot) => {
      setOperators(snapshot.docs.map(doc => ({ ...doc.data() } as Operator)));
    });

    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as AppSettings);
      }
    });

    return () => {
      unsubInserts();
      unsubTransactions();
      unsubStocks();
      unsubLines();
      unsubOperators();
      unsubSettings();
    };
  }, []);

  const handleStockMovement = async () => {
    const { insertId, quantity, line: selectedLine, operatorId: manualOperatorId } = stockMovement;
    const type = 'exit';
    
    const line = selectedLine;
    const finalOperatorId = manualOperatorId;
    const operator = operators.find(o => o.id === finalOperatorId);
    const finalOperatorName = operator?.name || operatorName || 'Operador';
    const finalOperatorFunction = operator?.function || '';

    // Determine shift automatically
    let determinedShift: Shift | undefined = undefined;
    if (settings?.shifts) {
      const now = new Date();
      const currentTimeStr = format(now, 'HH:mm');
      
      for (const [shiftName, config] of Object.entries(settings.shifts)) {
        const { start, end } = config;
        if (!start || !end) continue;

        if (start <= end) {
          // Normal shift (e.g., 08:00 to 17:00)
          if (currentTimeStr >= start && currentTimeStr <= end) {
            determinedShift = shiftName as Shift;
            break;
          }
        } else {
          // Overnight shift (e.g., 22:00 to 06:00)
          if (currentTimeStr >= start || currentTimeStr <= end) {
            determinedShift = shiftName as Shift;
            break;
          }
        }
      }
    }

    if (!insertId) {
      setMessage({ type: 'error', text: 'Selecione um inserto.' });
      return;
    }
    if (!line) {
      setMessage({ type: 'error', text: 'Selecione uma linha de produção.' });
      return;
    }
    if (!finalOperatorId) {
      setMessage({ type: 'error', text: 'Informe a matrícula do operador.' });
      return;
    }
    if (finalOperatorId.length < 3) {
      setMessage({ type: 'error', text: 'A matrícula deve ter no mínimo 3 dígitos.' });
      return;
    }
    if (quantity <= 0) {
      setMessage({ type: 'error', text: 'A quantidade deve ser maior que zero.' });
      return;
    }

    const insert = inserts.find(i => i.id === insertId);
    if (!insert) return;

    setIsLoading(true);
    try {
      // 1. Check Stock for Exits (Always from Almoxarifado)
      const stockId = `${insertId}_Almoxarifado`;
      const stockRef = doc(db, 'insert_stocks', stockId);
      const stockSnap = await getDoc(stockRef);
      
      let currentQty = 0;
      if (stockSnap.exists()) {
        currentQty = stockSnap.data().quantity;
      }

      if (currentQty < Number(quantity)) {
        setMessage({ type: 'error', text: 'Falta de saldo ou estoque insuficiente para esta retirada.' });
        setIsLoading(false);
        return;
      }

      // 2. Record Transaction
      await addDoc(collection(db, 'insert_transactions'), {
        insertId,
        insertCode: insert.code,
        type,
        quantity: Number(quantity),
        line,
        operatorName: finalOperatorName,
        operatorId: finalOperatorId,
        operatorFunction: finalOperatorFunction,
        shift: determinedShift,
        timestamp: serverTimestamp(),
        performedBy: userProfile ? {
          uid: auth.currentUser?.uid || '',
          name: userProfile.displayName || auth.currentUser?.email || 'Usuário',
          email: userProfile.email
        } : undefined
      });

      // 3. Update Stock (Always in Almoxarifado)
      const newQty = currentQty - Number(quantity);
      
      await setDoc(stockRef, {
        insertId,
        line: 'Almoxarifado',
        quantity: Math.max(0, newQty)
      }, { merge: true });

      setMessage({ type: 'success', text: `Retirada realizada com sucesso!` });
      setIsMovingStock(false);
      setStockMovement({ insertId: '', type: 'exit', quantity: 1, line: '', operatorId: '' });
    } catch (error) {
      console.error('Error moving stock:', error);
      handleFirestoreError(error, OperationType.WRITE, 'insert_stocks');
      setMessage({ type: 'error', text: 'Erro ao salvar movimentação. Verifique sua conexão e permissões.' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStocks = useMemo(() => {
    return stocks.filter(s => {
      const insert = inserts.find(i => i.id === s.insertId);
      // Filter out stocks without a valid insert model
      if (!insert) return false;

      const matchesSearch = !searchTerm || 
        insert.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insert.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.line.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [stocks, inserts, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Gestão de Insertos</h2>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <button
            onClick={() => setActiveView('stock')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              activeView === 'stock' ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            Visualizar Estoque
          </button>
          <button
            onClick={() => setActiveView('withdraw')}
            disabled={!permissions.insertWithdraw}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              activeView === 'withdraw' ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50",
              !permissions.insertWithdraw && "opacity-50 cursor-not-allowed"
            )}
          >
            Realizar Retirada
          </button>
        </div>
      </div>
      
      {/* Inline Success Message */}
      <AnimatePresence>
        {message && message.type === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl border bg-emerald-50 border-emerald-100 text-emerald-800 flex items-center justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-bold">{message.text}</p>
            </div>
            <button 
              onClick={() => setMessage(null)}
              className="p-1 hover:bg-white/50 rounded-lg transition-all"
            >
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message Modal */}
      <MessageModal 
        isOpen={!!message && message.type === 'error'}
        onClose={() => setMessage(null)}
        type="error"
        message={message?.text || ''}
      />

      {activeView === 'stock' && (
          <>
            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por código, descrição ou linha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs"
                />
              </div>

              <button
                onClick={() => setIsMovingStock(true)}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-xl shadow-md shadow-blue-100 hover:bg-blue-700 transition-all text-xs"
              >
                <Plus className="w-4 h-4" />
                Movimentar Estoque
              </button>
            </div>

            {/* Stock Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredStocks.map((stock) => {
                const insert = inserts.find(i => i.id === stock.insertId);
                const isLowStock = insert && stock.quantity <= insert.minStock;
                
                return (
                  <motion.div
                    layout
                    key={stock.id}
                    className={cn(
                      "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group",
                      isLowStock && "border-amber-200 bg-amber-50/30"
                    )}
                  >
                    {isLowStock && (
                      <div className="absolute top-0 right-0 p-1.5 bg-amber-500 text-white rounded-bl-lg shadow-sm">
                        <AlertTriangle className="w-3 h-3" />
                      </div>
                    )}
                    <div className="space-y-3 cursor-pointer"
                      onClick={() => {
                        setStockMovement({
                          insertId: stock.insertId,
                          type: 'exit',
                          quantity: 1,
                          line: stock.line,
                          operatorId: ''
                        });
                        setIsMovingStock(true);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50 flex items-center justify-center">
                          {insert?.imageUrl ? (
                            <img src={insert.imageUrl} alt={insert.code} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            (() => {
                              const Icon = getModelIcon(insert?.id || '');
                              return <Icon className="w-6 h-6 text-gray-300" />;
                            })()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest truncate">{insert?.code || 'N/A'}</p>
                          <h3 className="text-xs font-bold text-gray-900 truncate">{insert?.description || 'Desconhecido'}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full", productionLines.find(l => l.name === stock.line)?.color || 'bg-gray-300')} />
                            <p className="text-[10px] text-gray-500 font-bold truncate">{stock.line}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-col">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Qtd</p>
                          <p className={cn(
                            "text-xl font-black tracking-tight",
                            isLowStock ? "text-amber-600" : "text-gray-900"
                          )}>
                            {stock.quantity}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStockMovement({
                                insertId: stock.insertId,
                                type: 'exit',
                                quantity: 1,
                                line: stock.line,
                                operatorId: ''
                              });
                              setIsMovingStock(true);
                            }}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              
              {filteredStocks.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Nenhum estoque encontrado.</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeView === 'withdraw' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar modelo de inserto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs"
                />
              </div>
              <button
                onClick={() => {
                  setStockMovement({
                    insertId: '',
                    type: 'exit',
                    quantity: 1,
                    line: '',
                    operatorId: ''
                  });
                  setIsMovingStock(true);
                }}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-xl shadow-md shadow-blue-100 hover:bg-blue-700 transition-all text-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Nova Saída (Manual)
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {inserts.filter(i => 
                !searchTerm || 
                i.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                i.description.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((insert) => (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={insert.id}
                  onClick={() => {
                    setStockMovement({
                      insertId: insert.id,
                      type: 'exit',
                      quantity: 1,
                      line: '',
                      operatorId: ''
                    });
                    setIsMovingStock(true);
                  }}
                  className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 transition-all flex flex-col items-center text-center group"
                >
                  <div className="w-full aspect-square rounded-xl overflow-hidden border border-gray-50 mb-2 bg-gray-50 flex items-center justify-center">
                    {insert.imageUrl ? (
                      <img 
                        src={insert.imageUrl} 
                        alt={insert.code} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      (() => {
                        const Icon = getModelIcon(insert.id);
                        return <Icon className="w-6 h-6 text-gray-300 group-hover:scale-110 transition-transform duration-500" />;
                      })()
                    )}
                  </div>
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">{insert.code}</p>
                  <h4 className="text-[11px] font-bold text-gray-900 line-clamp-2 leading-tight">{insert.description}</h4>
                </motion.div>
              ))}
              
              {inserts.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Nenhum modelo cadastrado.</p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Modals */}
      <AnimatePresence>
        {isMovingStock && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Retirar Inserto</h3>
                <button onClick={() => { setIsMovingStock(false); setModalSearchTerm(''); }} className="p-2 hover:bg-gray-50 rounded-xl">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">Inserto</label>
                  {!stockMovement.insertId && (
                    <input
                      type="text"
                      placeholder="Buscar modelo..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 mb-2 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    />
                  )}
                  <select
                    value={stockMovement.insertId}
                    onChange={(e) => setStockMovement({ ...stockMovement, insertId: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="">Selecione um inserto...</option>
                    {inserts
                      .filter(i => 
                        !modalSearchTerm || 
                        i.code.toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
                        i.description.toLowerCase().includes(modalSearchTerm.toLowerCase())
                      )
                      .map(i => {
                        const totalStock = stocks.filter(s => s.insertId === i.id).reduce((acc, s) => acc + s.quantity, 0);
                        return (
                          <option key={i.id} value={i.id}>{i.code} - {i.description} (Em uso: {totalStock})</option>
                        )
                      })}
                  </select>
                </div>

                {stockMovement.insertId && (
                  <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    {inserts.find(i => i.id === stockMovement.insertId)?.imageUrl && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-blue-200 flex-shrink-0 bg-white">
                        <img 
                          src={inserts.find(i => i.id === stockMovement.insertId)?.imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-black text-blue-600 uppercase tracking-widest">
                        {inserts.find(i => i.id === stockMovement.insertId)?.code}
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        {inserts.find(i => i.id === stockMovement.insertId)?.description}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">Linha de Produção</label>
                  <select
                    value={stockMovement.line}
                    onChange={(e) => setStockMovement({ ...stockMovement, line: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="">Selecione uma linha...</option>
                    {productionLines.map(l => {
                      const lineStock = stockMovement.insertId 
                        ? stocks.find(s => s.insertId === stockMovement.insertId && s.line === l.name)?.quantity || 0 
                        : 0;
                      return (
                        <option key={l.id} value={l.name} className={cn("font-bold", LINE_COLORS.find(c => c.class === l.color)?.text)}>
                          {l.name} {stockMovement.insertId ? `(Em uso: ${lineStock})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Quantidade</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStockMovement({ ...stockMovement, quantity: Math.max(1, stockMovement.quantity - 1) })}
                        className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all flex-1 flex items-center justify-center"
                      >
                        <Minus className="w-6 h-6" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={stockMovement.quantity}
                        onChange={(e) => setStockMovement({ ...stockMovement, quantity: Number(e.target.value) })}
                        min="1"
                        className="w-20 bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500 outline-none text-center font-black text-lg"
                      />
                      <button
                        onClick={() => setStockMovement({ ...stockMovement, quantity: stockMovement.quantity + 1 })}
                        className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all flex-1 flex items-center justify-center"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">Matrícula Operador</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        list="operators-list"
                        value={stockMovement.operatorId}
                        onChange={(e) => setStockMovement({ ...stockMovement, operatorId: e.target.value })}
                        placeholder="Ex: 12345"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      />
                      <datalist id="operators-list">
                        {operators.map(o => (
                          <option key={o.id} value={o.id}>{o.name} - {o.function}</option>
                        ))}
                      </datalist>
                    </div>
                    {stockMovement.operatorId.length >= 5 && (
                      operators.find(o => o.id === stockMovement.operatorId) ? (
                        <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          {operators.find(o => o.id === stockMovement.operatorId)?.name}
                        </p>
                      ) : (
                        <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                          <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Operador não encontrado
                          </p>
                          {onRegisterOperator && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                onRegisterOperator();
                                setIsMovingStock(false);
                              }}
                              className="w-full py-2 bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-amber-700 transition-all"
                            >
                              Cadastrar Operador
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <button
                  onClick={handleStockMovement}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-100 mt-4"
                >
                  Confirmar Retirada
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
