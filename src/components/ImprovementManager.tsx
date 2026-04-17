import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ImprovementRecord, ImprovementCategory, ScrapRecord, UserPermissions } from '../types';
import { generateImprovementSuggestion, generateTopScrapsSuggestion } from '../services/geminiService';
import { Lightbulb, Plus, Loader2, Sparkles, Trash2, CheckCircle, Clock, Edit2, ChevronDown, ChevronUp, Save, X, Search, Activity, LayoutDashboard, Flag, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface ImprovementManagerProps {
  currentUser: { uid: string; name: string; email: string };
  records: ScrapRecord[];
  permissions: UserPermissions;
  isAdmin: boolean;
}

export const ImprovementManager: React.FC<ImprovementManagerProps> = ({ currentUser, records, permissions, isAdmin }) => {
  const [improvements, setImprovements] = useState<ImprovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'new' | 'settings'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Settings State
  const [prompts, setPrompts] = useState({
    analysis: `Forneça uma sugestão prática, estruturada e direta de como abordar e resolver esse problema. Inclua possíveis causas raízes a investigar e um plano de ação inicial.`,
    improvement: `Gere um Registro de Melhorias: Foco em ações de longo prazo e processos (ex: revisão de ficha técnica, treinamento de operadores ou manutenção preventiva) para este problema.`,
    email: `Gere um Modelo para E-mail (Comunicado Formal):\nAssunto: Informativo de Problema e Melhoria: [Resumo do Problema]\nCrie uma mensagem profissional e direta. NÃO USE EMOJIS. NÃO USE formatação Markdown (como asteriscos para negrito), use apenas texto simples.\nA mensagem deve conter:\n1. Descrição do Problema: Qual é o problema identificado.\n2. Riscos e Impactos: O que esse problema pode causar (impactos na produção, qualidade, segurança, etc.).\n3. Ação/Melhoria: O que está sendo feito ou proposto para resolver.\nTexto bem estruturado, com saudação inicial e encerramento profissional.`,
    whatsapp: `Gere um Modelo para WhatsApp (Comunicado Operacional):\nCrie uma mensagem clara e direta para a equipe. ABSOLUTAMENTE SEM EMOJIS. NÃO USE formatação Markdown (como asteriscos para negrito), use apenas texto simples.\nA mensagem deve conter:\n1. O Problema: Descrição breve do problema.\n2. O Risco: O que isso pode causar se não for resolvido.\n3. A Ação: O que deve ser feito ou está sendo feito.\nFormato em texto simples, fácil de ler no celular.`
  });
  const [isSavingPrompts, setIsSavingPrompts] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ImprovementCategory>('Fábrica');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'Baixa' | 'Média' | 'Alta'>('Média');
  const [deadline, setDeadline] = useState('');
  const [responsible, setResponsible] = useState('');
  const [beforeImage, setBeforeImage] = useState<string>('');
  const [afterImage, setAfterImage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Analysis State
  const [expandedAi, setExpandedAi] = useState<Record<string, boolean>>({});
  const [editingAiContent, setEditingAiContent] = useState<{id: string, type: string, content: string} | null>(null);

  // Individual Improvement AI State
  const [itemGeneratedContent, setItemGeneratedContent] = useState<Record<string, {
    analysis?: string;
    improvement?: string;
    email?: string;
    whatsapp?: string;
  }>>({});
  const [isItemGenerating, setIsItemGenerating] = useState<Record<string, {
    analysis?: boolean;
    improvement?: boolean;
    email?: boolean;
    whatsapp?: boolean;
  }>>({});

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedImprovement, setSelectedImprovement] = useState<ImprovementRecord | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [aiContentToDelete, setAiContentToDelete] = useState<{id: string, type: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'improvements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const imps: ImprovementRecord[] = [];
      snapshot.forEach((doc) => {
        imps.push({ id: doc.id, ...doc.data() } as ImprovementRecord);
      });
      setImprovements(imps);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'improvements');
      setLoading(false);
    });

    const unsubPrompts = onSnapshot(doc(db, 'settings', 'prompts'), (docSnap) => {
      if (docSnap.exists()) {
        setPrompts(docSnap.data() as any);
      }
    });

    return () => {
      unsubscribe();
      unsubPrompts();
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedBase64 = await compressImage(file);
      if (type === 'before') setBeforeImage(compressedBase64);
      else setAfterImage(compressedBase64);
    } catch (error) {
      console.error("Error compressing image", error);
      alert("Erro ao processar a imagem.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    setIsSubmitting(true);
    try {
      const recordData = {
        title,
        category,
        description,
        priority,
        deadline,
        responsible,
        beforeImage,
        afterImage,
        aiContent: itemGeneratedContent['new'] || {}
      };

      if (editingId) {
        await updateDoc(doc(db, 'improvements', editingId), recordData);
      } else {
        await addDoc(collection(db, 'improvements'), {
          ...recordData,
          status: 'Pendente',
          createdAt: serverTimestamp(),
          createdBy: currentUser
        });
      }

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('Fábrica');
      setPriority('Média');
      setDeadline('');
      setResponsible('');
      setBeforeImage('');
      setAfterImage('');
      setEditingId(null);
      setActiveTab('list');
      setItemGeneratedContent(prev => {
        const newState = { ...prev };
        delete newState['new'];
        return newState;
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'improvements');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editImprovement = (imp: ImprovementRecord) => {
    setTitle(imp.title);
    setCategory(imp.category);
    setDescription(imp.description);
    setPriority(imp.priority || 'Média');
    setDeadline(imp.deadline || '');
    setResponsible(imp.responsible || '');
    setBeforeImage(imp.beforeImage || '');
    setAfterImage(imp.afterImage || '');
    setEditingId(imp.id);
    setItemGeneratedContent(prev => ({ ...prev, 'new': imp.aiContent || {} }));
    setActiveTab('new');
  };

  const handleGenerateForItem = async (id: string, category: string, description: string, type: 'analysis' | 'email' | 'whatsapp' | 'improvement') => {
    setIsItemGenerating(prev => ({ ...prev, [id]: { ...prev[id], [type]: true } }));
    try {
      const result = await generateImprovementSuggestion(category, description, type, prompts);
      
      if (id === 'new') {
        setItemGeneratedContent(prev => ({
          ...prev,
          [id]: { ...prev[id], [type]: result }
        }));
      } else {
        const imp = improvements.find(i => i.id === id);
        if (imp) {
          const currentAiContent = imp.aiContent || {};
          await updateDoc(doc(db, 'improvements', id), {
            aiContent: { ...currentAiContent, [type]: result }
          });
        }
      }
      setExpandedAi(prev => ({ ...prev, [`${id}-${type}`]: true }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsItemGenerating(prev => ({ ...prev, [id]: { ...prev[id], [type]: false } }));
    }
  };

  const confirmDeleteAiContent = async () => {
    if (!aiContentToDelete) return;
    const { id, type } = aiContentToDelete;
    
    if (id === 'new') {
      setItemGeneratedContent(prev => {
        const newState = { ...prev };
        if (newState['new']) delete newState['new'][type as keyof typeof newState['new']];
        return newState;
      });
    } else {
      const imp = improvements.find(i => i.id === id);
      if (imp) {
        const currentAiContent = { ...imp.aiContent };
        delete currentAiContent[type as keyof typeof currentAiContent];
        await updateDoc(doc(db, 'improvements', id), { aiContent: currentAiContent });
      }
    }
    setAiContentToDelete(null);
  };

  const deleteAiContent = (id: string, type: string) => {
    setAiContentToDelete({ id, type });
  };

  const saveAiContent = async () => {
    if (!editingAiContent) return;
    const { id, type, content } = editingAiContent;
    
    if (id === 'new') {
      setItemGeneratedContent(prev => ({
        ...prev,
        [id]: { ...prev[id], [type]: content }
      }));
    } else {
      const imp = improvements.find(i => i.id === id);
      if (imp) {
        const currentAiContent = imp.aiContent || {};
        await updateDoc(doc(db, 'improvements', id), {
          aiContent: { ...currentAiContent, [type]: content }
        });
      }
    }
    setEditingAiContent(null);
  };

  const renderAiContent = (
    id: string, 
    type: 'analysis' | 'improvement' | 'email' | 'whatsapp', 
    title: string, 
    content: string, 
    colors: { bg: string, border: string, text: string, textDark: string, buttonBg: string, buttonHover: string }
  ) => {
    const isExpanded = expandedAi[`${id}-${type}`];
    const isEditing = editingAiContent?.id === id && editingAiContent?.type === type;

    return (
      <div className={`${colors.bg} border ${colors.border} p-4 rounded-xl mb-3`}>
        <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpandedAi(prev => ({ ...prev, [`${id}-${type}`]: !isExpanded }))}>
          <h4 className={`text-sm font-bold ${colors.textDark} flex items-center gap-2`}>
            <Sparkles className={`w-4 h-4 ${colors.text}`} />
            {title}
          </h4>
          <div className="flex items-center gap-2">
            {type === 'email' && (
              <a 
                href={`mailto:?subject=Informativo de Problema e Melhoria&body=${encodeURIComponent(content)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`px-3 py-1.5 ${colors.buttonBg} text-white text-xs font-bold rounded-lg ${colors.buttonHover} transition-colors`}
              >
                Abrir no E-mail
              </a>
            )}
            {type === 'whatsapp' && (
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(content)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`px-3 py-1.5 ${colors.buttonBg} text-white text-xs font-bold rounded-lg ${colors.buttonHover} transition-colors`}
              >
                Abrir no WhatsApp
              </a>
            )}
            <button onClick={(e) => { e.stopPropagation(); setEditingAiContent({ id, type, content }); setExpandedAi(prev => ({ ...prev, [`${id}-${type}`]: true })); }} className={`p-1.5 ${colors.text} hover:bg-white/50 rounded-lg transition-colors`} title="Editar">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteAiContent(id, type); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
              <Trash2 className="w-4 h-4" />
            </button>
            {isExpanded ? <ChevronUp className={`w-4 h-4 ${colors.text}`} /> : <ChevronDown className={`w-4 h-4 ${colors.text}`} />}
          </div>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingAiContent.content}
                      onChange={(e) => setEditingAiContent({ ...editingAiContent, content: e.target.value })}
                      className={`w-full p-3 border ${colors.border} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[150px]`}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingAiContent(null)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                        Cancelar
                      </button>
                      <button onClick={saveAiContent} className={`px-3 py-1.5 ${colors.buttonBg} text-white rounded-lg text-sm font-medium ${colors.buttonHover} transition-colors flex items-center gap-1`}>
                        <Save className="w-4 h-4" />
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`text-sm ${colors.textDark} markdown-body`}>
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const updateStatus = async (id: string, newStatus: ImprovementRecord['status']) => {
    try {
      await updateDoc(doc(db, 'improvements', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `improvements/${id}`);
    }
  };

  const archiveImprovement = async (id: string, currentArchived: boolean) => {
    try {
      await updateDoc(doc(db, 'improvements', id), { archived: !currentArchived });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `improvements/${id}`);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'improvements', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `improvements/${itemToDelete}`);
    }
  };

  const deleteImprovement = (id: string) => {
    setItemToDelete(id);
  };

  const getDeadlineStatus = (deadline?: string, status?: string) => {
    if (!deadline || status === 'Concluído') return 'normal';
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 2) return 'warning';
    return 'normal';
  };

  const handleSavePrompts = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrompts(true);
    try {
      await setDoc(doc(db, 'settings', 'prompts'), prompts);
      alert('Prompts salvos com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/prompts');
    } finally {
      setIsSavingPrompts(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const filteredImprovements = improvements.filter(imp => {
    const matchesSearch = imp.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          imp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArchiveStatus = showArchived ? imp.archived : !imp.archived;
    return matchesSearch && matchesArchiveStatus;
  });

  const exportToCsv = () => {
    // Definir as colunas (cabeçalhos)
    const headers = [
      'ID',
      'Título',
      'Categoria',
      'Descrição',
      'Prioridade',
      'Status',
      'Responsável',
      'Prazo',
      'Arquivado',
      'Criado Por',
      'Data de Criação'
    ];

    // Mapear os dados para o formato das colunas
    const csvData = filteredImprovements.map(imp => {
      const createdAtData = imp.createdAt as any;
      const createdAtStr = createdAtData?.toDate ? createdAtData.toDate().toLocaleString('pt-BR') : '';
      const deadlineStr = imp.deadline ? new Date(imp.deadline).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '';
      
      const sanitizeString = (str: string) => {
        if (!str) return '';
        // Substituir aspas duplas por formatacao do excel, remover quebras de linha que possam corromper
        let s = str.replace(/"/g, '""');
        s = s.replace(/(\r\n|\n|\r)/gm, ' ');
        return `"${s}"`;
      };

      const row = [
        imp.id,
        sanitizeString(imp.title),
        imp.category,
        sanitizeString(imp.description),
        imp.priority || '',
        imp.status,
        sanitizeString(imp.responsible || ''),
        deadlineStr,
        imp.archived ? 'Sim' : 'Não',
        sanitizeString(imp.createdBy.name),
        createdAtStr
      ];
      return row.join(';');
    });

    // Juntar cabeçalhos e linhas (usar \r\n para o excel reconhecer corretamente a quebra)
    const csvContent = "\uFEFF" + headers.join(';') + '\r\n' + csvData.join('\r\n');
    
    // Criar um blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Criar download automático
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `melhorias_relatorio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowExportConfirm(false);
  };

  const stats = {
    total: improvements.filter(i => !i.archived).length,
    pendente: improvements.filter(i => i.status === 'Pendente' && !i.archived).length,
    emAndamento: improvements.filter(i => i.status === 'Em Andamento' && !i.archived).length,
    concluido: improvements.filter(i => i.status === 'Concluído' && !i.archived).length,
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            Módulo de Melhorias (Kaizen)
          </h2>
          <p className="text-gray-500">Registre oportunidades e receba sugestões da Inteligência Artificial.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('list');
              setEditingId(null);
              setTitle('');
              setDescription('');
              setCategory('Fábrica');
              setPriority('Média');
              setDeadline('');
              setResponsible('');
              setItemGeneratedContent(prev => {
                const newState = { ...prev };
                delete newState['new'];
                return newState;
              });
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Registros
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {editingId ? 'Editar Melhoria' : 'Nova Melhoria'}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Configurações
          </button>
        </div>
      </div>

      {activeTab === 'settings' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900">Configurações de Prompts da IA</h3>
            <p className="text-gray-500 text-sm mt-1">Edite os prompts utilizados pelos botões de sugestão do Gemini neste módulo.</p>
          </div>
          
          <form onSubmit={handleSavePrompts} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Prompt: Analisar Problema
              </label>
              <p className="text-xs text-gray-500 mb-2">Usado no botão "Analisar Problema" para gerar causas raízes e plano de ação.</p>
              <textarea
                required
                value={prompts.analysis}
                onChange={(e) => setPrompts({ ...prompts, analysis: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none h-24 resize-y"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Prompt: Sugerir Ação (Melhoria)
              </label>
              <p className="text-xs text-gray-500 mb-2">Usado no botão "Sugerir Ação" para gerar ações de longo prazo e processos.</p>
              <textarea
                required
                value={prompts.improvement}
                onChange={(e) => setPrompts({ ...prompts, improvement: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-24 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Prompt: Gerar E-mail
              </label>
              <p className="text-xs text-gray-500 mb-2">Usado no botão "Gerar E-mail" para criar um comunicado formal.</p>
              <textarea
                required
                value={prompts.email}
                onChange={(e) => setPrompts({ ...prompts, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none h-32 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-500" />
                Prompt: Gerar WhatsApp
              </label>
              <p className="text-xs text-gray-500 mb-2">Usado no botão "Gerar WhatsApp" para criar um comunicado operacional.</p>
              <textarea
                required
                value={prompts.whatsapp}
                onChange={(e) => setPrompts({ ...prompts, whatsapp: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none h-32 resize-y"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="submit"
                disabled={isSavingPrompts}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {isSavingPrompts ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Salvar Prompts
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {activeTab === 'new' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da Melhoria</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ex: Instalação de sensor na máquina 05"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ImprovementCategory)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="Fábrica">Fábrica</option>
                  <option value="Máquina">Máquina</option>
                  <option value="Operação">Operação</option>
                  <option value="Instrução de Trabalho">Instrução de Trabalho</option>
                  <option value="Peça">Peça</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prazo (Opcional)</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsável (Opcional)</label>
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nome do responsável pela implementação"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto Antes (Opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'before')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
                {beforeImage && (
                  <div className="mt-2 relative inline-block">
                    <img src={beforeImage} alt="Antes" className="h-24 w-auto rounded-lg border border-gray-200 object-cover" />
                    <button type="button" onClick={() => setBeforeImage('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto Depois (Opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'after')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
                {afterImage && (
                  <div className="mt-2 relative inline-block">
                    <img src={afterImage} alt="Depois" className="h-24 w-auto rounded-lg border border-gray-200 object-cover" />
                    <button type="button" onClick={() => setAfterImage('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Problema e Proposta</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none mb-4"
                placeholder="Descreva o que está acontecendo e como você sugere resolver..."
              />

              {description.length > 10 && (isAdmin || permissions.generateAIAnalysis || permissions.generateAIImprovement || permissions.generateAIEmail || permissions.generateAIWhatsapp) && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    {(isAdmin || permissions.generateAIAnalysis) && (
                      <button
                        type="button"
                        onClick={() => handleGenerateForItem('new', category, description, 'analysis')}
                        disabled={isItemGenerating['new']?.analysis || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating['new']?.analysis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Sugestão Técnica
                      </button>
                    )}
                    {(isAdmin || permissions.generateAIImprovement) && (
                      <button
                        type="button"
                        onClick={() => handleGenerateForItem('new', category, description, 'improvement')}
                        disabled={isItemGenerating['new']?.improvement || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating['new']?.improvement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Registro de Melhoria
                      </button>
                    )}
                    {(isAdmin || permissions.generateAIEmail) && (
                      <button
                        type="button"
                        onClick={() => handleGenerateForItem('new', category, description, 'email')}
                        disabled={isItemGenerating['new']?.email || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating['new']?.email ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Comunicado (E-mail)
                      </button>
                    )}
                    {(isAdmin || permissions.generateAIWhatsapp) && (
                      <button
                        type="button"
                        onClick={() => handleGenerateForItem('new', category, description, 'whatsapp')}
                        disabled={isItemGenerating['new']?.whatsapp || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating['new']?.whatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        WhatsApp
                      </button>
                    )}
                  </div>

                  {itemGeneratedContent['new']?.analysis && renderAiContent('new', 'analysis', 'Sugestão Técnica', itemGeneratedContent['new'].analysis, { bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-indigo-600', textDark: 'text-indigo-900', buttonBg: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' })}
                  {itemGeneratedContent['new']?.improvement && renderAiContent('new', 'improvement', 'Registro de Melhoria', itemGeneratedContent['new'].improvement, { bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-600', textDark: 'text-emerald-900', buttonBg: 'bg-emerald-600', buttonHover: 'hover:bg-emerald-700' })}
                  {itemGeneratedContent['new']?.email && renderAiContent('new', 'email', 'Comunicado (E-mail)', itemGeneratedContent['new'].email, { bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-600', textDark: 'text-blue-900', buttonBg: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' })}
                  {itemGeneratedContent['new']?.whatsapp && renderAiContent('new', 'whatsapp', 'Template de WhatsApp', itemGeneratedContent['new'].whatsapp, { bg: 'bg-green-50/50', border: 'border-green-100', text: 'text-green-600', textDark: 'text-green-900', buttonBg: 'bg-green-600', buttonHover: 'hover:bg-green-700' })}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Registrar Melhoria
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-6">
          
          {/* Summary Dashboard */}
          {!showArchived && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Ativas</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <LayoutDashboard className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-600 mb-1">Pendentes</p>
                    <p className="text-2xl font-bold text-amber-700">{stats.pendente}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">Em Andamento</p>
                    <p className="text-2xl font-bold text-blue-700">{stats.emAndamento}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <Loader2 className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">Concluídas</p>
                    <p className="text-2xl font-bold text-green-700">{stats.concluido}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-700">Progresso Geral de Melhorias</span>
                  <span className="text-sm font-bold text-green-600">
                    {stats.total > 0 ? Math.round((stats.concluido / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                  {stats.total > 0 && (
                    <>
                      <div 
                        className="bg-green-500 h-full transition-all duration-500" 
                        style={{ width: `${(stats.concluido / stats.total) * 100}%` }}
                        title={`Concluídas: ${stats.concluido}`}
                      />
                      <div 
                        className="bg-blue-500 h-full transition-all duration-500" 
                        style={{ width: `${(stats.emAndamento / stats.total) * 100}%` }}
                        title={`Em Andamento: ${stats.emAndamento}`}
                      />
                      <div 
                        className="bg-amber-400 h-full transition-all duration-500" 
                        style={{ width: `${(stats.pendente / stats.total) * 100}%` }}
                        title={`Pendentes: ${stats.pendente}`}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar melhoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setShowArchived(false)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!showArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Ativos
                </button>
                <button
                  onClick={() => setShowArchived(true)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${showArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Arquivados
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-center">
              <button
                onClick={() => setShowExportConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                title="Exportar para Excel/CSV"
              >
                <Download className="w-4 h-4 text-green-600" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors w-full sm:w-auto ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors w-full sm:w-auto ${viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Kanban
                </button>
              </div>
            </div>
          </div>

          {filteredImprovements.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
              <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma melhoria encontrada.</p>
            </div>
          ) : viewMode === 'list' ? (
            filteredImprovements.map((imp) => {
              const deadlineStatus = getDeadlineStatus(imp.deadline, imp.status);
              return (
              <motion.div
                key={imp.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`bg-white p-6 rounded-2xl shadow-sm border ${deadlineStatus === 'overdue' ? 'border-red-300' : deadlineStatus === 'warning' ? 'border-amber-300' : 'border-gray-100'}`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                        {imp.category}
                      </span>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${
                        imp.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                        imp.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {imp.status === 'Concluído' && <CheckCircle className="w-3 h-3" />}
                        {imp.status === 'Em Andamento' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {imp.status === 'Pendente' && <Clock className="w-3 h-3" />}
                        {imp.status}
                      </span>
                      {imp.priority && (
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          imp.priority === 'Alta' ? 'bg-red-100 text-red-700' :
                          imp.priority === 'Média' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          Prioridade: {imp.priority}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{imp.title}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                      <p>Criado por {imp.createdBy.name} em {imp.createdAt?.toDate().toLocaleDateString('pt-BR')}</p>
                      {imp.deadline && <p className="font-medium text-gray-700">Prazo: {new Date(imp.deadline).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>}
                      {imp.responsible && <p className="font-medium text-gray-700">Responsável: {imp.responsible}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={imp.status}
                      onChange={(e) => updateStatus(imp.id, e.target.value as any)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em Andamento">Em Andamento</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                    <button
                      onClick={() => archiveImprovement(imp.id, !!imp.archived)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={imp.archived ? "Desarquivar" : "Arquivar"}
                    >
                      <Save className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => editImprovement(imp)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteImprovement(imp.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl mb-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Descrição do Problema</h4>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{imp.description}</p>
                </div>

                {(imp.beforeImage || imp.afterImage) && (
                  <div className="flex gap-4 mb-4 overflow-x-auto pb-2">
                    {imp.beforeImage && (
                      <div className="flex-shrink-0">
                        <h4 className="text-xs font-bold text-gray-500 mb-1">Antes</h4>
                        <img src={imp.beforeImage} alt="Antes" className="h-32 w-auto rounded-lg border border-gray-200 object-cover" />
                      </div>
                    )}
                    {imp.afterImage && (
                      <div className="flex-shrink-0">
                        <h4 className="text-xs font-bold text-gray-500 mb-1">Depois</h4>
                        <img src={imp.afterImage} alt="Depois" className="h-32 w-auto rounded-lg border border-gray-200 object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {(isAdmin || permissions.generateAIAnalysis || permissions.generateAIImprovement || permissions.generateAIEmail || permissions.generateAIWhatsapp) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(isAdmin || permissions.generateAIAnalysis) && (
                      <button
                        onClick={() => handleGenerateForItem(imp.id, imp.category, imp.description, 'analysis')}
                        disabled={isItemGenerating[imp.id]?.analysis || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating[imp.id]?.analysis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Sugestão Técnica
                      </button>
                    )}
                    {(isAdmin || permissions.generateAIImprovement) && (
                      <button
                        onClick={() => handleGenerateForItem(imp.id, imp.category, imp.description, 'improvement')}
                        disabled={isItemGenerating[imp.id]?.improvement || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating[imp.id]?.improvement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Registro de Melhoria
                      </button>
                    )}
                    {(isAdmin || permissions.generateAIEmail) && (
                      <button
                        onClick={() => handleGenerateForItem(imp.id, imp.category, imp.description, 'email')}
                        disabled={isItemGenerating[imp.id]?.email || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating[imp.id]?.email ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Comunicado (E-mail)
                      </button>
                    )}
                    {(isAdmin || permissions.generateAIWhatsapp) && (
                      <button
                        onClick={() => handleGenerateForItem(imp.id, imp.category, imp.description, 'whatsapp')}
                        disabled={isItemGenerating[imp.id]?.whatsapp || !navigator.onLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                        title={!navigator.onLine ? "Funcionalidade indisponível offline" : ""}
                      >
                        {isItemGenerating[imp.id]?.whatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        WhatsApp
                      </button>
                    )}
                  </div>
                )}

                {imp.aiContent?.analysis && renderAiContent(imp.id, 'analysis', 'Sugestão Técnica', imp.aiContent.analysis, { bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-indigo-600', textDark: 'text-indigo-900', buttonBg: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' })}
                {imp.aiContent?.improvement && renderAiContent(imp.id, 'improvement', 'Registro de Melhoria', imp.aiContent.improvement, { bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-600', textDark: 'text-emerald-900', buttonBg: 'bg-emerald-600', buttonHover: 'hover:bg-emerald-700' })}
                {imp.aiContent?.email && renderAiContent(imp.id, 'email', 'Comunicado (E-mail)', imp.aiContent.email, { bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-600', textDark: 'text-blue-900', buttonBg: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' })}
                {imp.aiContent?.whatsapp && renderAiContent(imp.id, 'whatsapp', 'Template de WhatsApp', imp.aiContent.whatsapp, { bg: 'bg-green-50/50', border: 'border-green-100', text: 'text-green-600', textDark: 'text-green-900', buttonBg: 'bg-green-600', buttonHover: 'hover:bg-green-700' })}
              </motion.div>
            )})
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-x-auto pb-4">
              {['Pendente', 'Em Andamento', 'Concluído'].map((status) => (
                <div 
                  key={status} 
                  className="bg-gray-50 rounded-2xl p-4 min-w-[300px] min-h-[500px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) updateStatus(id, status as any);
                  }}
                >
                  <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${
                    status === 'Concluído' ? 'text-green-700' :
                    status === 'Em Andamento' ? 'text-blue-700' :
                    'text-amber-700'
                  }`}>
                    {status === 'Concluído' && <CheckCircle className="w-4 h-4" />}
                    {status === 'Em Andamento' && <Loader2 className="w-4 h-4" />}
                    {status === 'Pendente' && <Clock className="w-4 h-4" />}
                    {status}
                    <span className="ml-auto bg-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
                      {filteredImprovements.filter(i => i.status === status).length}
                    </span>
                  </h3>
                  
                  <div className="space-y-3">
                    {filteredImprovements.filter(i => i.status === status).map((imp) => {
                      const deadlineStatus = getDeadlineStatus(imp.deadline, imp.status);
                      return (
                      <div 
                        key={imp.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', imp.id)}
                        onClick={() => setSelectedImprovement(imp)}
                        className={`bg-white p-4 rounded-xl shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${deadlineStatus === 'overdue' ? 'border-red-300' : deadlineStatus === 'warning' ? 'border-amber-300' : 'border-gray-100 hover:border-blue-300'}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-full">
                            {imp.category}
                          </span>
                          {imp.priority && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              imp.priority === 'Alta' ? 'bg-red-100 text-red-700' :
                              imp.priority === 'Média' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {imp.priority}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">{imp.title}</h4>
                        {imp.responsible && (
                          <p className="text-xs text-gray-500 mb-2">Resp: {imp.responsible}</p>
                        )}
                        {(imp.beforeImage || imp.afterImage) && (
                          <div className="flex gap-2 mb-2">
                            {imp.beforeImage && <img src={imp.beforeImage} alt="Antes" className="w-10 h-10 rounded object-cover border border-gray-200" />}
                            {imp.afterImage && <img src={imp.afterImage} alt="Depois" className="w-10 h-10 rounded object-cover border border-gray-200" />}
                          </div>
                        )}
                        {imp.deadline && (
                          <div className={`text-[10px] font-bold mt-2 ${deadlineStatus === 'overdue' ? 'text-red-600' : deadlineStatus === 'warning' ? 'text-amber-600' : 'text-gray-400'}`}>
                            Prazo: {new Date(imp.deadline).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                          </div>
                        )}
                        <div className="flex justify-end gap-1 mt-2 border-t border-gray-50 pt-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => archiveImprovement(imp.id, !!imp.archived)} className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors" title={imp.archived ? "Desarquivar" : "Arquivar"}>
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => editImprovement(imp)} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteImprovement(imp.id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kanban Details Modal */}
      <AnimatePresence>
        {selectedImprovement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImprovement(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                      {selectedImprovement.category}
                    </span>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${
                      selectedImprovement.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                      selectedImprovement.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedImprovement.status}
                    </span>
                    {selectedImprovement.priority && (
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        selectedImprovement.priority === 'Alta' ? 'bg-red-100 text-red-700' :
                        selectedImprovement.priority === 'Média' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {selectedImprovement.priority}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedImprovement.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                    <p>Criado por {selectedImprovement.createdBy.name}</p>
                    {selectedImprovement.deadline && <p className="font-medium text-gray-700">Prazo: {new Date(selectedImprovement.deadline).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>}
                    {selectedImprovement.responsible && <p className="font-medium text-gray-700">Resp: {selectedImprovement.responsible}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedImprovement(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl mb-6">
                <h4 className="text-sm font-bold text-gray-700 mb-2">Descrição do Problema</h4>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">{selectedImprovement.description}</p>
              </div>

              {(selectedImprovement.beforeImage || selectedImprovement.afterImage) && (
                <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                  {selectedImprovement.beforeImage && (
                    <div className="flex-shrink-0">
                      <h4 className="text-xs font-bold text-gray-500 mb-1">Antes</h4>
                      <img src={selectedImprovement.beforeImage} alt="Antes" className="h-48 w-auto rounded-lg border border-gray-200 object-cover" />
                    </div>
                  )}
                  {selectedImprovement.afterImage && (
                    <div className="flex-shrink-0">
                      <h4 className="text-xs font-bold text-gray-500 mb-1">Depois</h4>
                      <img src={selectedImprovement.afterImage} alt="Depois" className="h-48 w-auto rounded-lg border border-gray-200 object-cover" />
                    </div>
                  )}
                </div>
              )}

              {selectedImprovement.aiContent?.analysis && renderAiContent(selectedImprovement.id, 'analysis', 'Sugestão Técnica', selectedImprovement.aiContent.analysis, { bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-indigo-600', textDark: 'text-indigo-900', buttonBg: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' })}
              {selectedImprovement.aiContent?.improvement && renderAiContent(selectedImprovement.id, 'improvement', 'Registro de Melhoria', selectedImprovement.aiContent.improvement, { bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-600', textDark: 'text-emerald-900', buttonBg: 'bg-emerald-600', buttonHover: 'hover:bg-emerald-700' })}
              {selectedImprovement.aiContent?.email && renderAiContent(selectedImprovement.id, 'email', 'Comunicado (E-mail)', selectedImprovement.aiContent.email, { bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-600', textDark: 'text-blue-900', buttonBg: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' })}
              {selectedImprovement.aiContent?.whatsapp && renderAiContent(selectedImprovement.id, 'whatsapp', 'Template de WhatsApp', selectedImprovement.aiContent.whatsapp, { bg: 'bg-green-50/50', border: 'border-green-100', text: 'text-green-600', textDark: 'text-green-900', buttonBg: 'bg-green-600', buttonHover: 'hover:bg-green-700' })}

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                <button onClick={() => { setSelectedImprovement(null); editImprovement(selectedImprovement); }} className="px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-xl hover:bg-blue-100 transition-colors">
                  Editar
                </button>
                <button onClick={() => setSelectedImprovement(null)} className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {itemToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
                <p className="text-gray-600 mb-6">Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setItemToDelete(null)}
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

        {aiContentToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
                <p className="text-gray-600 mb-6">Tem certeza que deseja excluir este conteúdo gerado? Esta ação não pode ser desfeita.</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setAiContentToDelete(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDeleteAiContent}
                    className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showExportConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-100 text-green-700 rounded-full">
                    <Download className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Exportar Relatório</h3>
                </div>
                <p className="text-gray-600 mb-6 font-medium">
                  Será gerado um arquivo Excel/CSV contendo {filteredImprovements.length} {filteredImprovements.length === 1 ? 'registro' : 'registros'}. Deseja prosseguir com o download?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowExportConfirm(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={exportToCsv}
                    className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-xl font-medium transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Planilha
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) */}
      <AnimatePresence>
        {activeTab === 'list' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => setActiveTab('new')}
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[60] bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all outline-none flex items-center justify-center gap-2 group w-14 h-14 hover:w-auto hover:px-6"
          >
            <Plus className="w-6 h-6 shrink-0" />
            <span className="hidden group-hover:inline-block font-medium text-sm whitespace-nowrap pr-1 transition-all">Nova Melhoria</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
